const AdzunaAdapter = require('./adzunaAdapter');
const MockAdapter = require('./mockAdapter');

let _adapter = null;

function getAdapter() {
  if (_adapter) return _adapter;
  if (process.env.JOB_API_ID && process.env.JOB_API_KEY) {
    console.log('[JobAdapter] Using Adzuna');
    _adapter = new AdzunaAdapter(process.env.JOB_API_ID, process.env.JOB_API_KEY);
  } else {
    console.warn('[JobAdapter] No API credentials found — using mock data. Set JOB_API_ID and JOB_API_KEY for live listings.');
    _adapter = new MockAdapter();
  }
  return _adapter;
}

module.exports = { getAdapter };
