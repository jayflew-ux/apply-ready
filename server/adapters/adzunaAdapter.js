const axios = require('axios');

// Maps user-facing region labels to Adzuna country codes
const REGION_TO_COUNTRIES = {
  'united states': ['us'],
  'us': ['us'],
  'united kingdom': ['gb'],
  'uk': ['gb'],
  'canada': ['ca'],
  'australia': ['au'],
  'germany': ['de'],
  'france': ['fr'],
  'netherlands': ['nl'],
  'new zealand': ['nz'],
  'singapore': ['sg'],
  'india': ['in'],
  'south africa': ['za'],
  'brazil': ['br'],
  'mexico': ['mx'],
  'remote': ['us', 'gb', 'ca', 'au'],
  'remote — anywhere': ['us', 'gb', 'ca', 'au'],
  'remote — within us': ['us'],
  'remote — within uk': ['gb'],
  'remote — within canada': ['ca'],
  'remote — within australia': ['au'],
};

function regionsToCodes(regions) {
  const codes = new Set();
  regions.forEach(r => {
    const key = r.toLowerCase().trim();
    const mapped = REGION_TO_COUNTRIES[key];
    if (mapped) {
      mapped.forEach(c => codes.add(c));
    } else {
      codes.add('us'); // fallback
    }
  });
  return [...codes];
}

function normalizeJob(item, country) {
  const remoteText = (item.title + ' ' + (item.description || '')).toLowerCase();
  let remote_type = 'onsite';
  if (remoteText.includes('fully remote') || remoteText.includes('100% remote')) remote_type = 'remote';
  else if (remoteText.includes('remote') || remoteText.includes('hybrid')) remote_type = 'hybrid';

  return {
    external_id: `adzuna-${item.id}`,
    source: 'adzuna',
    title: item.title,
    company: item.company?.display_name || 'Unknown',
    location: item.location?.display_name || '',
    region: country.toUpperCase(),
    remote_type,
    description: item.description || '',
    compensation_min: item.salary_min || null,
    compensation_max: item.salary_max || null,
    compensation_currency: country === 'gb' ? 'GBP' : country === 'au' ? 'AUD' : country === 'ca' ? 'CAD' : 'USD',
    url: item.redirect_url || null,
    posted_at: item.created || null,
  };
}

class AdzunaAdapter {
  constructor(appId, appKey) {
    this.appId = appId;
    this.appKey = appKey;
    this.baseUrl = 'https://api.adzuna.com/v1/api/jobs';
  }

  async searchCountry({ country, keywords, page, limit }) {
    const what = keywords.join(' ');
    const url = `${this.baseUrl}/${country}/search/${page}`;
    const { data } = await axios.get(url, {
      params: {
        app_id: this.appId,
        app_key: this.appKey,
        results_per_page: limit,
        what,
        sort_by: 'date',
        content_type: 'application/json',
      },
      timeout: 10000,
    });
    return {
      jobs: (data.results || []).map(item => normalizeJob(item, country)),
      total: data.count || 0,
    };
  }

  async search({ keywords = [], regions = [], page = 1, limit = 20 }) {
    const countries = regions.length ? regionsToCodes(regions) : ['us'];
    const perCountry = Math.ceil(limit / countries.length);

    const results = await Promise.allSettled(
      countries.map(country =>
        this.searchCountry({ country, keywords, page, limit: perCountry }),
      ),
    );

    const allJobs = [];
    const seen = new Set();
    let total = 0;

    results.forEach(r => {
      if (r.status === 'fulfilled') {
        total += r.value.total;
        r.value.jobs.forEach(j => {
          if (!seen.has(j.external_id)) {
            seen.add(j.external_id);
            allJobs.push(j);
          }
        });
      }
    });

    // Sort by posted_at desc
    allJobs.sort((a, b) => new Date(b.posted_at || 0) - new Date(a.posted_at || 0));

    return { jobs: allJobs.slice(0, limit), total, page, limit };
  }
}

module.exports = AdzunaAdapter;
