// Passive, bounded learner-flow telemetry. Every emitted dimension is selected
// from a fixed vocabulary; never log a URL, request body, response snapshot,
// learner identifier, prompt, answer, or idempotency key.
import { MAX_QUERY_COUNT, runWithRequestQueryCount } from './request-query-count.js';
const ROUTES = [
  ['GET', /^\/lessons\/[^/]+\/dialogue-questions$/, 'inline_fetch'],
  ['POST', /^\/dialogue-questions\/[^/]+\/answer$/, 'dialogue_answer'],
  ['GET', /^\/dialogue-questions\/[^/]+\/attempts\/latest$/, 'dialogue_latest'],
  ['POST', /^\/grammar-task\/sessions$/, 'session_create_or_resume'],
  ['GET', /^\/grammar-task\/sessions\/[^/]+$/, 'session_get'],
  ['POST', /^\/grammar-task\/sessions\/[^/]+\/production$/, 'session_production'],
  ['POST', /^\/grammar-task\/sessions\/[^/]+\/items\/[^/]+\/answer$/, 'session_answer'],
  ['POST', /^\/grammar-task\/sessions\/[^/]+\/items\/[^/]+\/hint$/, 'session_hint'],
  ['POST', /^\/grammar-task\/sessions\/[^/]+\/items\/[^/]+\/reveal$/, 'session_reveal'],
];

const ERROR_CODES = new Set([
  'account_unavailable', 'answer_schema_invalid', 'companion_needs_review',
  'evaluation_pending', 'inline_placement_unavailable', 'invalid_item_id',
  'invalid_lesson_id', 'invalid_order', 'invalid_question_id',
  'invalid_question_version', 'invalid_request_id', 'invalid_session_flow_version',
  'invalid_session_id', 'invalid_source_lesson_id', 'item_not_found',
  'lesson_not_found', 'no_task_for_lesson', 'not_enrolled',
  'option_index_invalid', 'pilot_not_enabled_for_lesson',
  'production_completed', 'question_fingerprint_conflict',
  'question_not_found', 'question_owner_changed', 'question_version_conflict',
  'request_id_conflict', 'reveal_not_eligible', 'session_expired',
  'session_not_found', 'session_scope_changed', 'too_many_requests',
  'wrong_answer_shape',
]);
const OPERATIONS = new Set(ROUTES.map(([, , operation]) => operation));
export const isLearnerFlowOperation = value => OPERATIONS.has(value);
export const isLearnerFlowErrorCode = value => ERROR_CODES.has(value);

export function learnerFlowOperation(method, path) {
  const normalized = String(path || '').replace(/^\/api(?=\/)/, '');
  return ROUTES.find(([verb, pattern]) => verb === method && pattern.test(normalized))?.[2] || null;
}

function classify(status, operation, body, disposition) {
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'server_error';
  if (status === 409) return 'conflict';
  if (status >= 400) return 'rejected';
  if (status === 204) return 'empty';
  if (disposition === 'replay' &&
      (operation === 'dialogue_answer' || operation === 'session_answer')) {
    return 'idempotent_replay';
  }
  if (operation === 'session_answer' && body?.alreadyCompleted === true) return 'already_completed';
  return 'success';
}

export function learnerFlowEvent({ operation, status, body, durationMs, timestamp,
  disposition = null, queryCount = null, queryCountCapped = false }) {
  const event = {
    event: 'learning_flow_request', schemaVersion: 1, timestamp,
    operation, status, outcome: classify(status, operation, body, disposition), durationMs,
  };
  const version = body?.flowVersion ?? body?.placement?.flowVersion;
  if (version === 1 || version === 2) event.flowVersion = version;
  const placement = body?.placement?.mode;
  if (operation === 'inline_fetch' && ['inline', 'legacy', 'legacy_session'].includes(placement)) {
    event.placement = placement;
  }
  if (operation === 'session_create_or_resume' || operation === 'session_get') {
    if (Array.isArray(body?.items)) event.transferAvailable = body.items.some(item => item?.step === 5);
  }
  if (operation === 'dialogue_answer' && typeof body?.correct === 'boolean') {
    event.grade = body.correct ? 'correct' : 'incorrect';
  }
  if (operation === 'session_answer' && typeof body?.passed === 'boolean') {
    event.grade = body.passed ? 'correct' : 'incorrect';
  }
  if (status >= 400 && ERROR_CODES.has(body?.error)) event.errorCode = body.error;
  if (Number.isInteger(queryCount) && queryCount >= 0) {
    event.queryCount = Math.min(MAX_QUERY_COUNT, queryCount);
    if (queryCountCapped || queryCount > MAX_QUERY_COUNT) event.queryCountCapped = true;
  }
  return event;
}

export function createLearnerFlowTelemetry({
  logger = event => console.info(JSON.stringify(event)), clock = () => Date.now(),
} = {}) {
  return (req, res, next) => {
    const operation = learnerFlowOperation(req.method, req.path);
    if (!operation) return next();
    return runWithRequestQueryCount(state => {
      const start = clock();
      let body;
      const sendJson = res.json;
      res.json = function (value) {
        body = value;
        return sendJson.call(this, value);
      };
      res.once('finish', () => {
        const end = clock();
        const event = learnerFlowEvent({ operation, status: res.statusCode,
          body, disposition: res.locals?.learningFlowDisposition,
          queryCount: state.queryCount, queryCountCapped: state.queryCountCapped,
          timestamp: new Date(end).toISOString(),
          durationMs: Math.max(0, Math.round(end - start)) });
        try { logger(event); } catch { /* metrics must never change a learner response */ }
      });
      next();
    });
  };
}
