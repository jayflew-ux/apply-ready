const { createClient } = require('@supabase/supabase-js');

const serviceClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

module.exports = async function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header required' });
  }

  const token = header.slice(7);

  const { data: { user }, error } = await serviceClient.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = user;
  // Scoped client that respects RLS for this user's token
  req.db = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  // Service client for operations that need to bypass RLS (e.g., inserting shared job cache)
  req.serviceDb = serviceClient;
  next();
};
