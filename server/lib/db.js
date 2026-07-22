const { createClient } = require('@supabase/supabase-js');

// Service-role client — bypasses RLS. Use only in trusted server code
// (usage tracking, admin queries), never exposed to the client.
const serviceClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

module.exports = { serviceClient };
