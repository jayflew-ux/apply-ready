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

const TIMEOUT_MS = 10000;
const MAX_BODY_BYTES = 400_000;

// Statuses that prove the page is not there.
const DEAD_STATUSES = new Set([404, 410]);

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Phrases job boards use when a posting is closed. Deliberately specific:
// a generic word like "closed" or "expired" appears on plenty of live pages,
// so only unambiguous full phrases count as proof.
const EXPIRED_PHRASES = [
  'no longer accepting application',
  'no longer accepting candidates',
  'is no longer available',
  'this job is no longer',
  'this position is no longer',
  'posting is no longer',
  'job posting has expired',
  'this posting has expired',
  'this job has expired',
  'job has been filled',
  'position has been filled',
  'position is now filled',
  'this role has been filled',
  'applications are closed',
  'application window has closed',
  'this job is closed',
  'posting has closed',
  'we are no longer hiring for this',
  'job not found',
  'job no longer exists',
  'this opportunity is no longer',
];

// Strips markup so phrase matching runs against visible-ish text.
function toPlainText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function findExpiryPhrase(text) {
  return EXPIRED_PHRASES.find(p => text.includes(p)) || null;
}

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
      // Reachable is not the same as open. Read the page and look for the
      // language boards use when a posting has closed or been filled.
      let body = '';
      try {
        const type = res.headers.get('content-type') || '';
        if (type.includes('html') || type.includes('text')) {
          const buf = await res.arrayBuffer();
          body = Buffer.from(buf.slice(0, MAX_BODY_BYTES)).toString('utf8');
        }
      } catch { /* body unreadable — fall through as verified-by-status */ }

      if (body) {
        const phrase = findExpiryPhrase(toPlainText(body));
        if (phrase) {
          return { status: 'expired', reachable: false, code: res.status, phrase };
        }
      }

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

  let expired = 0;

  listings.forEach((listing, i) => {
    const check = checks[i];
    if (!check.reachable) {
      dropped += 1;
      if (check.status === 'expired') expired += 1;
      const detail = check.phrase ? ` ["${check.phrase}"]` : '';
      console.warn(`Dropped listing: ${listing.title} @ ${listing.company} (${check.status})${detail} ${listing.url || 'no url'}`);
      return;
    }
    kept.push({ ...listing, link_status: check.status });
  });

  const verifiedCount = kept.filter(l => l.link_status === 'verified').length;

  return {
    ...result,
    listings: kept,
    verification: { checked: listings.length, kept: kept.length, dropped, expired, verified: verifiedCount },
  };
}

module.exports = { verifyListings, checkUrl };
