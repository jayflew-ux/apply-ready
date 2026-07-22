const { AsyncLocalStorage } = require('async_hooks');

// Request-scoped token accumulator. Lets us tally Anthropic usage across every
// AI call in a request without threading a logger through all 10 AI functions.
const usageStore = new AsyncLocalStorage();

// Record one API response's usage into the current request's store.
// Counts every input token (fresh + cached) plus output tokens.
function recordUsage(usage) {
  const store = usageStore.getStore();
  if (!store || !usage) return;
  store.input +=
    (usage.input_tokens || 0) +
    (usage.cache_read_input_tokens || 0) +
    (usage.cache_creation_input_tokens || 0);
  store.output += usage.output_tokens || 0;
  store.calls += 1;
}

module.exports = { usageStore, recordUsage };
