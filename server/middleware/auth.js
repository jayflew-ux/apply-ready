const { createClient } = require('@supabase/supabase-js');

const serviceClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

// Reject a promise if it doesn't settle in time, so a stuck network call
// surfaces as a clean error instead of hanging the request forever.
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out`)), ms),
    ),
  ]);
}

module.exports = async function auth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    const token = header.slice(7);

    const { data, error } = await withTimeout(
      serviceClient.auth.getUser(token),
      10000,
      'Auth check',
    );

    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    if (!process.env.SUPABASE_ANON_KEY) {
      console.error('SUPABASE_ANON_KEY is not set — cannot create RLS client');
      return res.status(503).json({ error: 'Server is misconfigured (missing database key). Please contact support.' });
    }

    req.user = data.user;
    // Scoped client that respects RLS for this user's token
    req.db = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    req.serviceDb = serviceClient;
    next();
  } catch (err) {
    // Never let auth hang the request — return a clean error
    console.error('Auth middleware error:', err.message);
    res.status(503).json({ error: 'Authentication is temporarily unavailable. Please try again.' });
  }
};
