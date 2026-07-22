const { usageStore, recordUsage } = require('../lib/usage'); // eslint-disable-line no-unused-vars
const { serviceClient } = require('../lib/db');

// Runs each request inside a token-accounting context. When the response
// finishes, any tokens accumulated by AI calls are flushed to the user's
// profile. Non-AI requests accumulate nothing and skip the flush.
module.exports = function trackUsage(req, res, next) {
  const store = { input: 0, output: 0, calls: 0 };

  res.on('finish', () => {
    if ((store.input || store.output) && req.user?.id) {
      flushUsage(req.user.id, store).catch(err =>
        console.error('usage flush failed:', err.message),
      );
    }
  });

  usageStore.run(store, () => next());
};

async function flushUsage(userId, store) {
  const { data } = await serviceClient
    .from('profiles')
    .select('input_tokens_used, output_tokens_used, ai_calls')
    .eq('id', userId)
    .single();

  await serviceClient
    .from('profiles')
    .update({
      input_tokens_used: (data?.input_tokens_used || 0) + store.input,
      output_tokens_used: (data?.output_tokens_used || 0) + store.output,
      ai_calls: (data?.ai_calls || 0) + store.calls,
    })
    .eq('id', userId);
}
