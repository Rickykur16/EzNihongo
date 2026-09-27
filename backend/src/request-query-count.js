import { AsyncLocalStorage } from 'node:async_hooks';

export const MAX_QUERY_COUNT = 10000;
const requestQueries = new AsyncLocalStorage();

export function runWithRequestQueryCount(fn) {
  const state = { queryCount: 0, queryCountCapped: false };
  return requestQueries.run(state, () => fn(state));
}

export function countRequestQuery() {
  const state = requestQueries.getStore();
  if (!state) return;
  if (state.queryCount < MAX_QUERY_COUNT) state.queryCount++;
  else state.queryCountCapped = true;
}
