/**
 * Verifies that job listing URLs point at something real before we show them.
 *
 * The AI is instructed never to invent listings, but instructions are not
 * proof — a fabricated or hallucinated URL would still reach the user. This
 * makes an actual network request per listing and drops the ones that are
 * demonstrably dead.
 *
 * Job boards commonly block automated requests, so a refusal is NOT evidence
 * that a posting is fake. We only drop a listing on hard proof of absence:
 * the host does not resolve, the connection fails, or the server says the
 * page is gone (404/410). Everything else is kept and marked.
 */

const TIMEOUT_MS = 8000;

// Statuses that prove the page is not there.
const DEAD_STATUSES = new Set([404, 410]);

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function checkUrl(url) {
  if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    return { status: 'invalid', reachable: false };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': UA, Accept: 'text/html,*/*' },
    });

    if (DEAD_STATUSES.has(res.status)) {
      return { status: 'dead', reachable: false, code: res.status };
    }
    if (res.status >= 200 && res.status < 400) {
      return { status: 'verified', reachable: true, code: res.status };
    }
    // 401/403/405/429/5xx — bot blocking or a hiccup, not proof of absence.
    return { status: 'unverified', reachable: true, code: res.status };
  } catch (err) {
    // DNS failure means the host itself does not exist — strong signal of a
    // fabricated URL. A timeout or reset is just a slow/hostile server.
    const msg = String(err?.cause?.code || err?.message || '');
    if (/ENOTFOUND|EAI_AGAIN|ERR_NAME/i.test(msg)) {
      return { status: 'dead', reachable: false, reason: 'host not found' };
    }
    return { status: 'unverified', reachable: true, reason: 'unreachable from server' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Takes the raw findListings result and returns it with dead listings removed
 * and each survivor tagged with link_status ('verified' | 'unverified').
 */
async function verifyListings(result) {
  const listings = Array.isArray(result?.listings) ? result.listings : [];
  if (listings.length === 0) return { ...result, listings: [], verification: null };

  const checks = await Promise.all(listings.map(l => checkUrl(l.url)));

  const kept = [];
  let dropped = 0;

  listings.forEach((listing, i) => {
    const check = checks[i];
    if (!check.reachable) {
      dropped += 1;
      console.warn(`Dropped unverifiable listing: ${listing.title} @ ${listing.company} (${check.status}) ${listing.url || 'no url'}`);
      return;
    }
    kept.push({ ...listing, link_status: check.status });
  });

  const verifiedCount = kept.filter(l => l.link_status === 'verified').length;

  return {
    ...result,
    listings: kept,
    verification: { checked: listings.length, kept: kept.length, dropped, verified: verifiedCount },
  };
}

module.exports = { verifyListings, checkUrl };
