// Bunpou Flow pilot (Paket 1) — server-authorized practice sessions for
// Tugas Bunpou Step 1 (recognition) / Step 2 (controlled), so a student's
// progress through those two steps survives a page refresh or a popup
// close/reopen. This is NOT a second grading engine: questions are derived
// with the exact same grammar-drills.js helpers the legacy
// POST /grammar-task/drill-answer endpoint uses, and graded answers still
// land in grammar_attempts — the one table grammar-mastery.js already reads.
//
// Scope is deliberately narrow and gated hard, independent of whatever the
// frontend does: every mutating request re-verifies (a) the pilot flag is on
// for *this* lesson specifically (isPilotLesson), and (b) the caller still
// has course access, even if a session was created earlier while they did.
// A misconfigured or manipulated sourceLessonId/lessonId can not reach
// content from another course or a lesson the pilot isn't scoped to (T04).
//
// Kept in its own file rather than appended to routes/grammar-task.js so
// that file — one of the ones this pilot must not otherwise change the
// behaviour of — stays untouched apart from the two `export` keywords noted
// in loadTaskConcepts/loadModulePool.

import { Router } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { query, withTransaction } from '../db.js';
import { asyncHandler, requireAuth } from '../middleware.js';
import { userCanAccessCourse, courseIdForLessonId } from '../entitlements.js';
import { deriveDrills, arrangeIsCorrect } from '../grammar-drills.js';
import { loadTaskConcepts, loadModulePool } from './grammar-task.js';
import { loadPilotConfig } from '../bunpou-flow-config.js';
import {
  contentRevisionId, questionFingerprint, deriveAssistanceState, independentEligible,
  publicSessionItem, overlayFor, isPilotLesson, primaryErrorFor, answerSentenceFor,
  SESSION_MINUTES, DRILL_MAX_WRONG, EVIDENCE_SCHEMA_VERSION,
} from '../bunpou-flow-service.js';

const router = Router();

const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v) { return typeof v === 'string' && CANONICAL_UUID.test(v); }

// Same order of magnitude as grammar-task.js#drillLimiter (Step 1/2 traffic
// this route now also serves — deterministic grading, no AI call).
const sessionLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 90,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down' },
});

// Builds the (grammarId, step, drill) rows a fresh session should store, in
// the same order Step 1 then Step 2 would appear per pattern — order has no
// grading effect (items are addressed by opaque itemId) but keeps the GET
// response stable and easy to eyeball while testing.
function plannedItems(items, drillsByGrammar) {
  const out = [];
  for (const item of items) {
    const d = drillsByGrammar.get(item.id) || {};
    if (d.step1) out.push({ grammarId: item.id, step: 1, drill: d.step1 });
    if (d.step2) out.push({ grammarId: item.id, step: 2, drill: d.step2 });
  }
  return out;
}

async function assertCourseAccess(req, res, sourceLessonId) {
  const courseId = await courseIdForLessonId(sourceLessonId);
  if (!courseId) { res.status(404).json({ error: 'lesson_not_found' }); return null; }
  if (!(await userCanAccessCourse(req.user, courseId))) {
    res.status(403).json({ error: 'not_enrolled' });
    return null;
  }
  return courseId;
}

// Shared load+ownership+expiry+access guard used by every /sessions/:id...
// route. Returns the session row on success, or null after already sending
// a response.
async function loadOwnedActiveSession(req, res, sessionId) {
  if (!isUuid(sessionId)) { res.status(400).json({ error: 'invalid_session_id' }); return null; }
  const r = await query(`SELECT * FROM grammar_task_sessions WHERE id = $1`, [sessionId]);
  const session = r.rows[0];
  // 404 rather than 403 for a session owned by someone else — do not confirm
  // that a given session id exists to a caller who does not own it.
  if (!session || session.user_id !== req.user.id) { res.status(404).json({ error: 'session_not_found' }); return null; }
  if (new Date(session.expires_at) <= new Date()) { res.status(410).json({ error: 'session_expired' }); return null; }
  // Re-check the pilot flag on every resume/answer/hint/reveal, not just at
  // creation — an admin flipping the flag off (or repointing it elsewhere),
  // e.g. because a published companion turned out to have a mistake, must
  // stop a still-open session from continuing to serve/log against it,
  // rather than leaving it live for up to SESSION_MINUTES more.
  const config = await loadPilotConfig();
  if (!isPilotLesson(config, session.source_lesson_id)) {
    res.status(403).json({ error: 'pilot_not_enabled_for_lesson' });
    return null;
  }
  const courseId = await assertCourseAccess(req, res, session.source_lesson_id);
  if (!courseId) return null;
  return session;
}

async function itemsForSession(sessionId) {
  const r = await query(
    `SELECT * FROM grammar_task_session_items WHERE session_id = $1 ORDER BY step ASC, grammar_id ASC`,
    [sessionId]
  );
  return r.rows.map(publicSessionItem);
}

// POST /api/grammar-task/sessions   body: { sourceLessonId }
// Resumes the caller's most recent non-expired session for the paired task
// lesson if its content revision still matches; otherwise starts a new one.
router.post('/grammar-task/sessions', requireAuth, sessionLimiter, asyncHandler(async (req, res) => {
  const sourceLessonId = String((req.body || {}).sourceLessonId || '');
  if (!isUuid(sourceLessonId)) return res.status(400).json({ error: 'invalid_source_lesson_id' });

  const config = await loadPilotConfig();
  if (!isPilotLesson(config, sourceLessonId)) {
    return res.status(403).json({ error: 'pilot_not_enabled_for_lesson' });
  }
  if (!(await assertCourseAccess(req, res, sourceLessonId))) return;

  const taskRow = await query(
    `SELECT id FROM lessons WHERE type = 'grammar_task' AND popup_after_lesson_id = $1 LIMIT 1`,
    [sourceLessonId]
  );
  const taskLessonId = taskRow.rows[0]?.id;
  if (!taskLessonId) return res.status(404).json({ error: 'no_task_for_lesson' });

  const [items, pool] = await Promise.all([
    loadTaskConcepts(taskLessonId),
    loadModulePool(taskLessonId),
  ]);
  const revisionId = contentRevisionId(items, pool);

  const existing = await query(
    `SELECT * FROM grammar_task_sessions
      WHERE user_id = $1 AND task_lesson_id = $2 AND expires_at > NOW()
      ORDER BY created_at DESC LIMIT 1`,
    [req.user.id, taskLessonId]
  );
  if (existing.rows.length > 0 && existing.rows[0].content_revision_id === revisionId) {
    const session = existing.rows[0];
    return res.json({
      sessionId: session.id,
      taskLessonId,
      expiresAt: session.expires_at,
      contentChanged: false,
      items: await itemsForSession(session.id),
    });
  }
  const contentChanged = existing.rows.length > 0;

  const drillsByGrammar = deriveDrills(items, pool);
  const planned = plannedItems(items, drillsByGrammar);

  const sourceRow = await query(`SELECT bunpou_flow_published FROM lessons WHERE id = $1`, [sourceLessonId]);
  const published = sourceRow.rows[0]?.bunpou_flow_published || null;

  const session = await withTransaction(async (client) => {
    const ins = await client.query(
      `INSERT INTO grammar_task_sessions (user_id, source_lesson_id, task_lesson_id, content_revision_id, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + ($5 || ' minutes')::interval)
       RETURNING id, expires_at`,
      [req.user.id, sourceLessonId, taskLessonId, revisionId, String(SESSION_MINUTES)]
    );
    const created = ins.rows[0];
    for (const p of planned) {
      const overlay = overlayFor(published, p.grammarId, p.step);
      const snapshot = {
        ...p.drill,
        overlayHint: overlay?.hint || null,
        overlayExplanation: overlay?.explanation || null,
      };
      const fingerprint = questionFingerprint(p.grammarId, p.step, p.drill);
      await client.query(
        `INSERT INTO grammar_task_session_items (session_id, grammar_id, step, question_fingerprint, snapshot)
         VALUES ($1, $2, $3, $4, $5)`,
        [created.id, p.grammarId, p.step, fingerprint, JSON.stringify(snapshot)]
      );
    }
    return created;
  });

  res.json({
    sessionId: session.id,
    taskLessonId,
    expiresAt: session.expires_at,
    contentChanged,
    items: await itemsForSession(session.id),
  });
}));

// GET /api/grammar-task/sessions/:id
router.get('/grammar-task/sessions/:id', requireAuth, sessionLimiter, asyncHandler(async (req, res) => {
  const session = await loadOwnedActiveSession(req, res, req.params.id);
  if (!session) return;

  const [items, pool] = await Promise.all([
    loadTaskConcepts(session.task_lesson_id),
    loadModulePool(session.task_lesson_id),
  ]);
  const contentChanged = contentRevisionId(items, pool) !== session.content_revision_id;

  res.json({
    sessionId: session.id,
    taskLessonId: session.task_lesson_id,
    expiresAt: session.expires_at,
    contentChanged,
    items: await itemsForSession(session.id),
  });
}));

// POST /api/grammar-task/sessions/:id/items/:itemId/answer
// body: { optionIndex } for a choice item, or { order: number[] } for an
// arrange item; optional { requestId } for replay-safe idempotency.
router.post('/grammar-task/sessions/:id/items/:itemId/answer', requireAuth, sessionLimiter,
  asyncHandler(async (req, res) => {
    const session = await loadOwnedActiveSession(req, res, req.params.id);
    if (!session) return;
    if (!isUuid(req.params.itemId)) return res.status(400).json({ error: 'invalid_item_id' });

    const requestId = (req.body || {}).requestId ? String(req.body.requestId).slice(0, 200) : null;
    const order = Array.isArray((req.body || {}).order) ? req.body.order : null;
    const optionIndex = Number((req.body || {}).optionIndex);
    const isArrangeSubmit = order != null;
    if (!isArrangeSubmit && !Number.isInteger(optionIndex)) {
      return res.status(400).json({ error: 'optionIndex or order required' });
    }

    const result = await withTransaction(async (client) => {
      const r = await client.query(
        `SELECT * FROM grammar_task_session_items
          WHERE session_id = $1 AND item_id = $2 FOR UPDATE`,
        [session.id, req.params.itemId]
      );
      const item = r.rows[0];
      if (!item) return { status: 404, body: { error: 'item_not_found' } };

      const drill = item.snapshot;
      const isArrange = drill.variant === 'arrange';
      if (isArrangeSubmit !== isArrange) return { status: 400, body: { error: 'wrong_answer_shape' } };
      if (!isArrange && (optionIndex < 0 || optionIndex >= (drill.options || []).length)) {
        return { status: 400, body: { error: 'optionIndex out of range' } };
      }

      const payloadHash = crypto.createHash('sha256')
        .update(JSON.stringify({ optionIndex: isArrange ? null : optionIndex, order: isArrange ? order : null }))
        .digest('hex');

      // A request id is only ever reused by (a) the same client retrying the
      // exact same submit (network timeout, double click) or (b) a bug/abuse
      // sending a second, different answer under the first one's id. (a)
      // replays the stored outcome; (b) is rejected outright rather than
      // silently regrading over the first answer (T09).
      if (requestId && item.last_request_id === requestId) {
        if (item.last_request_payload_hash === payloadHash) {
          return { status: 200, body: publicSessionItem(item) };
        }
        return { status: 409, body: { error: 'request_id_conflict' } };
      }
      // A solved item stays solved — answering it again (network retry,
      // double click, a second tab) must not mint another grammar_attempts
      // row or XP-equivalent progress (T08).
      if (item.passed === true) {
        return { status: 200, body: publicSessionItem(item) };
      }

      const passed = isArrange ? arrangeIsCorrect(drill, order) : (optionIndex === drill.correctIndex);
      const wrongCount = passed ? item.wrong_count : item.wrong_count + 1;

      const upd = await client.query(
        `UPDATE grammar_task_session_items
            SET wrong_count = $3, passed = $4, answered_at = NOW(),
                last_request_id = $5, last_request_payload_hash = $6
          WHERE session_id = $1 AND item_id = $2
          RETURNING *`,
        [session.id, req.params.itemId, wrongCount, passed, requestId, payloadHash]
      );
      await client.query(
        `UPDATE grammar_task_sessions SET version = version + 1, updated_at = NOW() WHERE id = $1`,
        [session.id]
      );

      // A previously answer-revealed exposure of this exact question — even
      // in an earlier, now-expired session — taints this attempt too; a new
      // session must not launder a memorized key back into "independent".
      const taintedRes = await client.query(
        `SELECT 1 FROM grammar_attempts
          WHERE user_id = $1 AND question_fingerprint = $2
            AND assistance_state IN ('answer_served', 'correction_served')
          LIMIT 1`,
        [req.user.id, item.question_fingerprint]
      );
      const assistanceState = deriveAssistanceState({
        hintServedAt: item.hint_served_at,
        revealedAt: item.revealed_at,
        tainted: taintedRes.rows.length > 0,
      });

      const attemptOrdinalRes = await client.query(
        `SELECT COUNT(*)::int + 1 AS n FROM grammar_attempts WHERE practice_item_id = $1`,
        [req.params.itemId]
      );
      const primaryError = passed ? null : primaryErrorFor(item.step, drill.rule);
      const sentence = answerSentenceFor(drill, { isArrange, order, optionIndex });

      // A plain try/catch around the INSERT is not enough on its own: once
      // any statement errors inside a Postgres transaction, the whole
      // transaction is aborted until it hits a ROLLBACK (or a ROLLBACK TO a
      // SAVEPOINT) — catching the JS error without one still leaves the
      // session/item UPDATE above unable to COMMIT (it silently becomes a
      // ROLLBACK), even though this handler would otherwise report 200 with
      // the graded result as if it had been saved. The SAVEPOINT scopes a
      // request_id collision (e.g. the same id reused across two different
      // items) to just this INSERT, so the item's own grading update still
      // commits.
      await client.query('SAVEPOINT grammar_attempts_insert');
      try {
        await client.query(
          `INSERT INTO grammar_attempts (
             user_id, grammar_id, lesson_id, source, input_mode, sentence,
             correct, uses_pattern, passed, primary_error, error_types, eval_source,
             practice_session_id, practice_item_id, content_revision_id, question_fingerprint,
             request_id, request_payload_hash, attempt_ordinal, assistance_state,
             independent_eligible, evaluation_kind, evidence_schema_version
           ) VALUES ($1,$2,$3,$4,'text',$5,$6,$6,$6,$7,$8,'ai',
             $9,$10,$11,$12,$13,$14,$15,$16,$17,'deterministic',$18)`,
          [
            req.user.id, item.grammar_id, session.task_lesson_id,
            item.step === 1 ? 'recognition' : 'controlled',
            sentence, passed, primaryError, primaryError ? [primaryError] : [],
            session.id, req.params.itemId, session.content_revision_id, item.question_fingerprint,
            requestId, payloadHash, attemptOrdinalRes.rows[0].n, assistanceState,
            independentEligible(assistanceState), EVIDENCE_SCHEMA_VERSION,
          ]
        );
      } catch (err) {
        // Same replay guarded by the DB unique(user_id, request_id) index
        // instead of the in-memory check above (a second request that raced
        // past the SELECT before this one committed) — not a grading failure,
        // the row lock above already ensured only one of them updated the
        // item, so just report the (already-updated) item state.
        if (err.code !== '23505') throw err;
        await client.query('ROLLBACK TO SAVEPOINT grammar_attempts_insert');
      }

      return { status: 200, body: publicSessionItem(upd.rows[0]) };
    });

    res.status(result.status).json(result.body);
  })
);

// POST /api/grammar-task/sessions/:id/items/:itemId/hint
// Only logs (and serves) a hint when the admin has actually curated one for
// this question — an absent hint is reported as unavailable, never
// fabricated, and never recorded as assistance that was not really given.
router.post('/grammar-task/sessions/:id/items/:itemId/hint', requireAuth, sessionLimiter,
  asyncHandler(async (req, res) => {
    const session = await loadOwnedActiveSession(req, res, req.params.id);
    if (!session) return;
    if (!isUuid(req.params.itemId)) return res.status(400).json({ error: 'invalid_item_id' });

    const result = await withTransaction(async (client) => {
      const r = await client.query(
        `SELECT * FROM grammar_task_session_items WHERE session_id = $1 AND item_id = $2 FOR UPDATE`,
        [session.id, req.params.itemId]
      );
      const item = r.rows[0];
      if (!item) return { status: 404, body: { error: 'item_not_found' } };
      const hint = item.snapshot?.overlayHint || null;
      if (!hint) return { status: 200, body: { available: false } };
      if (!item.hint_served_at) {
        await client.query(
          `UPDATE grammar_task_session_items SET hint_served_at = NOW() WHERE session_id = $1 AND item_id = $2`,
          [session.id, req.params.itemId]
        );
      }
      return { status: 200, body: { available: true, hint } };
    });
    res.status(result.status).json(result.body);
  })
);

// POST /api/grammar-task/sessions/:id/items/:itemId/reveal
// Validates the wrong-answer threshold has actually been reached server-side
// (never trusts a client-sent wrongCount) before logging the exposure and
// returning the key/explanation.
router.post('/grammar-task/sessions/:id/items/:itemId/reveal', requireAuth, sessionLimiter,
  asyncHandler(async (req, res) => {
    const session = await loadOwnedActiveSession(req, res, req.params.id);
    if (!session) return;
    if (!isUuid(req.params.itemId)) return res.status(400).json({ error: 'invalid_item_id' });

    const result = await withTransaction(async (client) => {
      const r = await client.query(
        `SELECT * FROM grammar_task_session_items WHERE session_id = $1 AND item_id = $2 FOR UPDATE`,
        [session.id, req.params.itemId]
      );
      const item = r.rows[0];
      if (!item) return { status: 404, body: { error: 'item_not_found' } };
      if (item.passed === true) return { status: 200, body: publicSessionItem(item) };
      if ((item.wrong_count || 0) < DRILL_MAX_WRONG) {
        return { status: 403, body: { error: 'reveal_not_eligible' } };
      }
      if (!item.revealed_at) {
        const upd = await client.query(
          `UPDATE grammar_task_session_items SET revealed_at = NOW()
            WHERE session_id = $1 AND item_id = $2 RETURNING *`,
          [session.id, req.params.itemId]
        );
        return { status: 200, body: publicSessionItem(upd.rows[0]) };
      }
      return { status: 200, body: publicSessionItem(item) };
    });
    res.status(result.status).json(result.body);
  })
);

export default router;
