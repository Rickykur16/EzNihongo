import { isLearnerFlowOperation, isLearnerFlowErrorCode } from './learning-flow-telemetry.js';
import { MAX_QUERY_COUNT } from './request-query-count.js';

const KEYS = new Set(['event', 'schemaVersion', 'timestamp', 'operation', 'status',
  'outcome', 'durationMs', 'queryCount', 'queryCountCapped', 'flowVersion',
  'placement', 'transferAvailable', 'grade', 'errorCode']);
const OUTCOMES = new Set(['rate_limited', 'server_error', 'conflict', 'rejected',
  'empty', 'already_completed', 'idempotent_replay', 'success']);
const PLACEMENTS = new Set(['inline', 'legacy', 'legacy_session']);
const GRADES = new Set(['correct', 'incorrect']);
const COMMIT = /^[0-9a-f]{40}$/u;
const ENVIRONMENT = /^[a-z][a-z0-9-]{0,39}$/u;
const fail = code => { throw new Error(code); };
const percentile = (sorted, fraction) => sorted[Math.ceil(sorted.length * fraction) - 1];
const outcomeMatchesStatus = (status, outcome) => status === 429
  ? outcome === 'rate_limited' : status >= 500
    ? outcome === 'server_error' : status === 409
      ? outcome === 'conflict' : status >= 400
        ? outcome === 'rejected' : status === 204
          ? outcome === 'empty' : status >= 200 && status < 300 &&
          ['success', 'already_completed', 'idempotent_replay'].includes(outcome);

export function summarizeLearningFlowBaseline(lines, { environment, commitSha } = {}) {
  if (!ENVIRONMENT.test(environment || '') || !COMMIT.test(commitSha || '')) {
    fail('baseline_metadata_required');
  }
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > 100000) {
    fail('baseline_samples_invalid');
  }
  const groups = new Map();
  let first = null, last = null;
  for (const line of lines) {
    if (typeof line !== 'string' || !line.trim() || line.length > 8192) fail('baseline_event_invalid');
    let event;
    try { event = JSON.parse(line); } catch { fail('baseline_event_invalid'); }
    if (!event || typeof event !== 'object' || Array.isArray(event) ||
        Object.keys(event).some(key => !KEYS.has(key)) ||
        event.event !== 'learning_flow_request' || event.schemaVersion !== 1 ||
        !isLearnerFlowOperation(event.operation) ||
        !Number.isInteger(event.status) || event.status < 100 || event.status > 599 ||
        !OUTCOMES.has(event.outcome) || !outcomeMatchesStatus(event.status, event.outcome) ||
        !Number.isInteger(event.durationMs) || event.durationMs < 0 || event.durationMs > 3600000 ||
        !Number.isInteger(event.queryCount) || event.queryCount < 0 ||
        event.queryCount > MAX_QUERY_COUNT ||
        Object.hasOwn(event, 'queryCountCapped') && event.queryCountCapped !== false ||
        typeof event.timestamp !== 'string' ||
        Number.isNaN(Date.parse(event.timestamp)) ||
        new Date(event.timestamp).toISOString() !== event.timestamp ||
        event.flowVersion != null && ![1, 2].includes(event.flowVersion) ||
        event.placement != null && !PLACEMENTS.has(event.placement) ||
        event.transferAvailable != null && typeof event.transferAvailable !== 'boolean' ||
        event.grade != null && !GRADES.has(event.grade) ||
        event.errorCode != null && !isLearnerFlowErrorCode(event.errorCode)) {
      fail('baseline_event_invalid');
    }
    first = first == null || event.timestamp < first ? event.timestamp : first;
    last = last == null || event.timestamp > last ? event.timestamp : last;
    if (!groups.has(event.operation)) groups.set(event.operation, []);
    groups.get(event.operation).push({ durationMs: event.durationMs,
      queryCount: event.queryCount });
  }
  const operations = {};
  for (const [operation, samples] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const durations = samples.map(sample => sample.durationMs).sort((a, b) => a - b);
    const queries = samples.map(sample => sample.queryCount).sort((a, b) => a - b);
    operations[operation] = { sampleCount: samples.length,
      durationMs: { p50: percentile(durations, 0.5), p95: percentile(durations, 0.95) },
      queryCount: { p50: percentile(queries, 0.5), p95: percentile(queries, 0.95) } };
  }
  return { schemaVersion: 1, environment, commitSha,
    provenance: 'operator_supplied_unverified', readinessDecision: 'not_evaluated',
    percentileMethod: 'nearest_rank', sampleCount: lines.length,
    observedFrom: first, observedThrough: last, operations };
}
