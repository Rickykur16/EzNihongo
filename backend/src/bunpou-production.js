import { createHash, randomUUID } from 'node:crypto';
import { withAdvisoryLock } from './db.js';
import { evaluateGrammarSentence, GRAMMAR_EVAL_TIMEOUT_MS } from './routes/grammar-task.js';

export const PRODUCTION_LEASE_MS = GRAMMAR_EVAL_TIMEOUT_MS * 2;
const failure = (status, error) => ({ status, body: { error } });
const pending = () => failure(409, 'evaluation_pending');
const savedProduction = row => ({ status: 200, body: {
  ...row.result, saved: true, passed: true, assistanceState: row.assistance_state,
} });

// assertAccess(client) runs under the lock before reservation/replay and again
// after evaluation, inside finalization. It
// must return true on valid access, false on revocation/expiry/flag changes.
// Slots are zero-based. Ledger responses store the successful response body.
export function createProductionSubmitter({
  withLock = withAdvisoryLock,
  evaluate = evaluateGrammarSentence,
} = {}) {
  return async function submitProduction({ session, user, body = {}, assertAccess }) {
    if (typeof assertAccess !== 'function') throw new TypeError('assertAccess required');
    const { grammarId, slot } = body;
    const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : '';
    const sentence = typeof body.sentence === 'string' ? body.sentence.trim() : '';
    const inputMode = body.inputMode ?? 'text';
    if (typeof requestId !== 'string' || !requestId.trim() || requestId.length > 200) {
      return failure(400, 'invalid_request_id');
    }
    if (!sentence || sentence.length > 200) return failure(400, 'invalid_sentence');
    if (!['text', 'speech'].includes(inputMode)) return failure(400, 'invalid_input_mode');
    const grammar = Array.isArray(session.production_snapshot)
      ? session.production_snapshot.find(item => item.grammarId === grammarId) : null;
    if (!grammar) return failure(404, 'grammar_not_in_session');
    if (!Number.isInteger(grammar.requiredCount) || grammar.requiredCount < 1 || !grammar.fingerprint) {
      return failure(409, 'production_snapshot_invalid');
    }
    if (!Number.isInteger(slot) || slot < 0 || slot >= grammar.requiredCount) return failure(400, 'invalid_slot');
    const payloadHash = createHash('sha256').update(JSON.stringify({
      operation: 'production', sessionId: session.id, grammarId, slot, sentence, inputMode,
    })).digest('hex');
    const token = randomUUID();
    const lock = fn => withLock(`bunpou:${user.id}`, fn);
    const readRequest = async client => (await client.query(
      `SELECT *, reserved_until > clock_timestamp() AS lease_active
         FROM grammar_task_requests WHERE user_id = $1 AND request_id = $2 FOR UPDATE`,
      [user.id, requestId]
    )).rows[0];
    const matches = row => row.payload_hash === payloadHash && row.session_id === session.id && row.operation === 'production';
    const terminalResponse = row => row.sentence === sentence && row.input_mode === inputMode
      ? savedProduction(row) : failure(409, 'production_completed');
    const readPassedSlot = async client => (await client.query(
      `SELECT result, assistance_state, sentence, input_mode FROM grammar_task_productions
        WHERE session_id = $1 AND grammar_id = $2 AND slot = $3 AND passed = TRUE FOR UPDATE`,
      [session.id, grammarId, slot]
    )).rows[0];
    const release = client => client.query(
      `UPDATE grammar_task_requests SET reserved_until = clock_timestamp()
        WHERE user_id = $1 AND request_id = $2 AND reservation_token = $3 AND response IS NULL`,
      [user.id, requestId, token]
    );
    const reserved = await lock(async client => {
      if (await assertAccess(client) !== true) return failure(403, 'access_denied');
      const existing = await readRequest(client);
      if (existing && !matches(existing)) return failure(409, 'request_id_conflict');
      if (existing?.response != null) return { status: 200, body: existing.response };
      // Older pilot answers can have evidence without a request-ledger row.
      const priorAttempt = await client.query(
        `SELECT 1 FROM grammar_attempts WHERE user_id = $1 AND request_id = $2 LIMIT 1`,
        [user.id, requestId]
      );
      if (priorAttempt.rows.length) return failure(409, 'request_id_conflict');
      if (existing?.lease_active) return pending();
      const terminal = await readPassedSlot(client);
      const response = terminal ? terminalResponse(terminal) : null;
      if (response?.status === 409) return response;
      if (!terminal) {
        const activeSlot = await client.query(
          `SELECT 1 FROM grammar_task_requests
            WHERE user_id = $1 AND session_id = $2 AND grammar_id = $3 AND production_slot = $4
              AND operation = 'production' AND response IS NULL
              AND reserved_until > clock_timestamp() AND request_id <> $5 LIMIT 1`,
          [user.id, session.id, grammarId, slot, requestId]
        );
        if (activeSlot.rows.length) return pending();
      }
      if (existing) {
        await client.query(
          `UPDATE grammar_task_requests
              SET reservation_token = $3, reserved_until = clock_timestamp() + ($4 * interval '1 millisecond'),
                  grammar_id = $5, production_slot = $6, response = $7
            WHERE user_id = $1 AND request_id = $2`,
          [user.id, requestId, token, PRODUCTION_LEASE_MS, grammarId, slot, response ? JSON.stringify(response.body) : null]
        );
      } else {
        await client.query(
          `INSERT INTO grammar_task_requests
             (user_id, request_id, session_id, payload_hash, operation, reservation_token, reserved_until,
              grammar_id, production_slot, response)
           VALUES ($1,$2,$3,$4,'production',$5,clock_timestamp() + ($6 * interval '1 millisecond'),$7,$8,$9)`,
          [user.id, requestId, session.id, payloadHash, token, PRODUCTION_LEASE_MS,
            grammarId, slot, response ? JSON.stringify(response.body) : null]
        );
      }
      return response;
    });
    if (reserved) return reserved;

    try {
      // Never retain a database transaction or advisory lock during AI work.
      const { result, evalSource, model } = await evaluate({
        grammar, grammarId, instruction: grammar.instruction || '', sentence, inputMode,
      });
      return await lock(async client => {
        const access = await assertAccess(client);
        if (access !== true) {
          await release(client);
          return failure(403, 'access_denied');
        }
        const reservation = await readRequest(client);
        if (!reservation || !matches(reservation)) return failure(409, 'request_id_conflict');
        if (reservation.response != null) return { status: 200, body: reservation.response };
        if (reservation.reservation_token !== token || !reservation.lease_active) return pending();
        const finishRequest = async response => {
          // Expiration during the guard or writes rolls the entire transaction back.
          const finalized = await client.query(
            `UPDATE grammar_task_requests SET response = $4
              WHERE user_id = $1 AND request_id = $2 AND reservation_token = $3
                AND response IS NULL AND reserved_until > clock_timestamp() RETURNING request_id`,
            [user.id, requestId, token, JSON.stringify(response.body)]
          );
          if (!finalized.rows.length) throw Object.assign(new Error('evaluation_pending'), { status: 409 });
          return response;
        };
        const terminal = await readPassedSlot(client);
        if (terminal) {
          const response = terminalResponse(terminal);
          if (response.status === 409) { await release(client); return response; }
          return finishRequest(response);
        }
        const history = await client.query(
          `SELECT 1 FROM grammar_attempts
            WHERE user_id = $1 AND grammar_id = $2 AND source = 'production'
              AND correction IS NOT NULL AND btrim(correction) <> '' LIMIT 1`,
          [user.id, grammarId]
        );
        const assistanceState = history.rows.length || String(result.correction || '').trim()
          ? 'correction_served' : 'none_observed';
        const passed = result.correct === true && result.usesPattern === true;
        const ordinal = await client.query(
          `SELECT COUNT(*)::int + 1 AS n FROM grammar_attempts
            WHERE user_id = $1 AND practice_session_id = $2 AND grammar_id = $3 AND source = 'production'`,
          [user.id, session.id, grammarId]
        );
        await client.query(
          `INSERT INTO grammar_attempts (
             user_id, grammar_id, lesson_id, source, input_mode, sentence,
             correct, uses_pattern, passed, grammar_score, primary_error, error_types,
             severity, concept_signal, feedback, correction, eval_source, model,
             practice_session_id, practice_item_id, content_revision_id, question_fingerprint,
             request_id, request_payload_hash, attempt_ordinal, assistance_state,
             independent_eligible, evaluation_kind, evidence_schema_version
           ) VALUES ($1,$2,$3,'production',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
             $18,NULL,$19,$20,$21,$22,$23,$24,$25,'ai',1)`,
          [user.id, grammarId, session.task_lesson_id, inputMode, sentence,
            result.correct, result.usesPattern, passed, result.grammarScore, result.primaryError,
            result.errorTypes || [], result.severity, result.conceptSignal,
            result.feedback || null, result.correction || null, evalSource, model,
            session.id, session.content_revision_id, grammar.fingerprint,
            requestId, payloadHash, ordinal.rows[0].n, assistanceState, assistanceState === 'none_observed']
        );
        await client.query(
          `INSERT INTO grammar_task_productions
             (session_id, grammar_id, slot, sentence, input_mode, result, request_id, assistance_state, passed, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
           ON CONFLICT (session_id, grammar_id, slot) DO UPDATE SET
             sentence = EXCLUDED.sentence, input_mode = EXCLUDED.input_mode, result = EXCLUDED.result,
             request_id = EXCLUDED.request_id, assistance_state = EXCLUDED.assistance_state,
             passed = EXCLUDED.passed, updated_at = NOW()`,
          [session.id, grammarId, slot, sentence, inputMode, JSON.stringify(result), requestId, assistanceState, passed]
        );
        const response = { status: 200, body: { ...result, saved: true, passed, assistanceState } };
        await finishRequest(response);
        await client.query(
          `UPDATE grammar_task_sessions SET version = version + 1, updated_at = NOW() WHERE id = $1`,
          [session.id]
        );
        return response;
      });
    } catch (err) {
      await lock(release);
      if (Number.isInteger(err.status) && err.status >= 400 && err.status <= 599) return failure(err.status, err.message);
      throw err;
    }
  };
}

export const submitProduction = createProductionSubmitter();
