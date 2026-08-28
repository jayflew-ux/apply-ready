const express = require('express');
const auth = require('../middleware/auth');
const { serviceClient } = require('../lib/db');
const { verifyListings } = require('../lib/verifyListings');

const router = express.Router();

router.use(auth);

// Gate: only profiles flagged is_admin get past here.
router.use(async (req, res, next) => {
  try {
    const { data } = await serviceClient
      .from('profiles')
      .select('is_admin')
      .eq('id', req.user.id)
      .single();

    if (!data?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (err) {
    next(err);
  }
});

// All users with usage stats
router.get('/users', async (req, res, next) => {
  try {
    const { data, error } = await serviceClient
      .from('profiles')
      .select('id, email, full_name, subscription_status, resume_builds_used, input_tokens_used, output_tokens_used, ai_calls, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const users = data || [];
    const totals = users.reduce(
      (acc, u) => ({
        users: acc.users + 1,
        resumes: acc.resumes + (u.resume_builds_used || 0),
        input_tokens: acc.input_tokens + (u.input_tokens_used || 0),
        output_tokens: acc.output_tokens + (u.output_tokens_used || 0),
        ai_calls: acc.ai_calls + (u.ai_calls || 0),
      }),
      { users: 0, resumes: 0, input_tokens: 0, output_tokens: 0, ai_calls: 0 },
    );

    res.json({ users, totals });
  } catch (err) {
    next(err);
  }
});

// Sweep every stored listing across all accounts and drop any that are dead
// or closed. Listings cached before link-checking existed were never verified,
// so this cleans them out without waiting for each user's cache to expire.
// Costs nothing in AI spend — it is HTTP checks only.
router.post('/sweep-listings', async (req, res, next) => {
  try {
    const { data: profiles, error } = await serviceClient
      .from('profiles')
      .select('id, email, discover_listings')
      .not('discover_listings', 'is', null);

    if (error) throw error;

    const summary = { accounts_scanned: 0, listings_checked: 0, listings_removed: 0, accounts_updated: 0, details: [] };

    for (const profile of profiles || []) {
      const stored = profile.discover_listings;
      const before = stored?.listings?.length || 0;
      if (!before) continue;

      summary.accounts_scanned += 1;
      summary.listings_checked += before;

      const cleaned = await verifyListings(stored);
      const after = cleaned.listings?.length || 0;
      const removed = before - after;

      if (removed > 0) {
        await serviceClient
          .from('profiles')
          .update({ discover_listings: cleaned })
          .eq('id', profile.id);

        summary.listings_removed += removed;
        summary.accounts_updated += 1;
        summary.details.push({ email: profile.email, before, after, removed });
      }
    }

    res.json(summary);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
