// Bunpou Flow pilot (Paket 1) — server-authorized practice sessions for
// Tugas Bunpou practice, so a student's
// progress survives a page refresh or a popup
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
// Production reuses the legacy evaluator, with reservation and finalization
// outside its AI call. New evidence stays in the same grammar_attempts table.

import { Router } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { query, withTransaction } from '../db.js';
import { asyncHandler, requireAuth } from '../middleware.js';
import { userCanAccessCourse, courseIdForLessonId } from '../entitlements.js';
import { deriveDrills, arrangeIsCorrect } from '../grammar-drills.js';
import { loadPilotConfig } from '../bunpou-flow-config.js';
import { loadCompanionContext } from '../bunpou-flow-content.js';
import { submitProduction } from '../bunpou-production.js';
import { pilotAccessError, sessionAccessError, taskScopeError } from '../bunpou-session-access.js';
import {
  questionFingerprint, deriveAssistanceState, independentEligible,
  publicSessionItem, overlayFor, isPilotLesson, primaryErrorFor, answerSentenceFor,
  SESSION_MINUTES, DRILL_MAX_WRONG, EVIDENCE_SCHEMA_VERSION,
  dialogCheckDrills, attemptSourceFor, sessionRevisionId,
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
const productionLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20,
  standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Too many requests, slow down' } });

// Builds the (grammarId, step, drill) rows a fresh session should store, in
// the same order Step 1 then Step 2 would appear per pattern — order has no
// grading effect (items are addressed by opaque itemId) but keeps the GET
// response stable and easy to eyeball while testing.
function plannedItems(items, drillsByGrammar, published) {
  const out = [];
  for (const item of items) {
    const d = drillsByGrammar.get(item.id) || {};
    if (d.step1) out.push({ grammarId: item.id, step: 1, drill: d.step1 });
    if (d.step2) out.push({ grammarId: item.id, step: 2, drill: d.step2 });
  }
  // Paket 2: pemeriksaan mandiri ditempatkan di AKHIR tugas yang sudah ada,
  // bukan sebagai halaman assessment kedua (rencana Paket 2). Karena
  // seluruh blok ini di-push setelah loop Step 1/2 di atas, urutan item
  // sesi menjadi: semua Step 1/2 dulu, baru pemeriksaan. Pola yang
  // pemeriksaannya belum layak sekadar tidak menyumbang item — tidak
  // memblokir pola lain, dan tidak pernah diganti soal karangan.
  const checks = (published && published.dialogChecks) || {};
  for (const item of items) {
    for (const drill of dialogCheckDrills(checks[item.id])) {
      out.push({ grammarId: item.id, step: drill.step, drill });
    }
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

async function itemsForSession(sessionId, client = { query }) {
  const r = await client.query(
    `SELECT * FROM grammar_task_session_items WHERE session_id = $1 ORDER BY step ASC, grammar_id ASC`,
    [sessionId]
  );
  return r.rows.map(publicSessionItem);
}

async function productionsForSession(sessionId, client = { query }) {
  const r = await client.query(`SELECT grammar_id AS "grammarId", slot, sentence, result,
    request_id AS "requestId", passed, assistance_state AS "assistanceState"
    FROM grammar_task_productions WHERE session_id = $1 ORDER BY grammar_id, slot`, [sessionId]);
  return r.rows;
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

  const context = await loadCompanionContext(sourceLessonId);
  if (!context) return res.status(404).json({ error: 'no_task_for_lesson' });
  if (!context.current) return res.status(409).json({ error: 'companion_needs_review' });
  const { taskLessonId, items, pool, published, fingerprint } = context;
  const revisionId = sessionRevisionId(fingerprint, published);

  const drillsByGrammar = deriveDrills(items, pool);
  const planned = plannedItems(items, drillsByGrammar, published);

  const session = await withTransaction(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, ['bunpou:' + req.user.id]);
    const denied = await pilotAccessError(client, req.user, sourceLessonId);
    if (denied) return { denied };
    const scopeError = await taskScopeError(client, sourceLessonId, taskLessonId, items.map(item => item.id));
    if (scopeError) return { denied: scopeError };
    const existing = await client.query(
      `SELECT * FROM grammar_task_sessions WHERE user_id = $1 AND task_lesson_id = $2
       AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`, [req.user.id, taskLessonId]);
    if (existing.rows[0]?.content_revision_id === revisionId) return { ...existing.rows[0], contentChanged: false };
    const productionSnapshot = items.map(item => ({
      grammarId: item.id, pattern: item.pattern, meaning: item.meaning,
      example: item.example, instruction: item.instruction || '',
      requiredCount: Math.max(1, Number(item.requiredCount) || 1),
      fingerprint: questionFingerprint(item.id, 3, { prompt: item.instruction, sentence: item.pattern, example: item.example }),
    }));
    const ins = await client.query(
      `INSERT INTO grammar_task_sessions (user_id, source_lesson_id, task_lesson_id, content_revision_id, expires_at, production_snapshot)
       VALUES ($1, $2, $3, $4, NOW() + ($5 || ' minutes')::interval, $6)
       RETURNING id, expires_at`,
      [req.user.id, sourceLessonId, taskLessonId, revisionId, String(SESSION_MINUTES), JSON.stringify(productionSnapshot)]
    );
    const created = ins.rows[0];
    for (const p of planned) {
      const overlay = overlayFor(published, p.grammarId, p.step);
      const snapshot = {
        ...p.drill,
        overlayHint: overlay?.hint || null,
        // deriveDrills() tidak pernah menghasilkan `explanation` (dicek:
        // nol kemunculan di grammar-drills.js), jadi fallback ini nol-dampak
        // untuk Step 1/2 dan hanya menyalurkan pembahasan soal pemeriksaan.
        overlayExplanation: overlay?.explanation || p.drill.explanation || null,
      };
      const fingerprint = questionFingerprint(p.grammarId, p.step, p.drill);
      await client.query(
        `INSERT INTO grammar_task_session_items (session_id, grammar_id, step, question_fingerprint, snapshot)
         VALUES ($1, $2, $3, $4, $5)`,
        [created.id, p.grammarId, p.step, fingerprint, JSON.stringify(snapshot)]
      );
    }
    return { ...created, contentChanged: existing.rows.length > 0 };
  });

  if (session.denied) return res.status(session.denied.status).json({ error: session.denied.error });
  res.json({
    sessionId: session.id,
    taskLessonId,
    expiresAt: session.expires_at,
    contentChanged: session.contentChanged,
    items: await itemsForSession(session.id),
    productions: await productionsForSession(session.id),
  });
}));

// GET /api/grammar-task/sessions/:id
router.get('/grammar-task/sessions/:id', requireAuth, sessionLimiter, asyncHandler(async (req, res) => {
  const session = await loadOwnedActiveSession(req, res, req.params.id);
  if (!session) return;

  const context = await loadCompanionContext(session.source_lesson_id);
  const contentChanged = !context?.current || sessionRevisionId(context.fingerprint, context.published) !== session.content_revision_id;

  const result = await withTransaction(async client => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, ['bunpou:' + req.user.id]);
    const denied = await sessionAccessError(client, req.user, session.id);
    if (denied) return { status: denied.status, body: { error: denied.error } };
    return { status: 200, body: { sessionId: session.id, taskLessonId: session.task_lesson_id,
      expiresAt: session.expires_at, contentChanged,
      items: await itemsForSession(session.id, client),
      productions: await productionsForSession(session.id, client) } };
  });
  res.status(result.status).json(result.body);
}));

router.post('/grammar-task/sessions/:id/production', requireAuth, productionLimiter, asyncHandler(async (req, res) => {
  const session = await loadOwnedActiveSession(req, res, req.params.id);
  if (!session) return;
  const result = await submitProduction({ session, user: req.user, body: req.body || {},
    assertAccess: async client => !(await sessionAccessError(client, req.user, session.id)),
  });
  res.status(result.status).json(result.body);
}));

// POST /api/grammar-task/sessions/:id/items/:itemId/answer
// body: { optionIndex } for a choice item, or { order: number[] } for an
// arrange item; required { requestId } for replay-safe idempotency.
router.post('/grammar-task/sessions/:id/items/:itemId/answer', requireAuth, sessionLimiter,
  asyncHandler(async (req, res) => {
    const session = await loadOwnedActiveSession(req, res, req.params.id);
    if (!session) return;
    if (!isUuid(req.params.itemId)) return res.status(400).json({ error: 'invalid_item_id' });

    const requestId = typeof req.body?.requestId === 'string' ? req.body.requestId.trim() : '';
    if (!requestId || requestId.length > 200) return res.status(400).json({ error: 'invalid_request_id' });
    const order = Array.isArray((req.body || {}).order) ? req.body.order : null;
    const optionIndex = (req.body || {}).optionIndex;
    const isArrangeSubmit = order != null;
    if (!isArrangeSubmit && !Number.isInteger(optionIndex)) {
      return res.status(400).json({ error: 'optionIndex or order required' });
    }

    const result = await withTransaction(async (client) => {
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, ['bunpou:' + req.user.id]);
      const denied = await sessionAccessError(client, req.user, session.id);
      if (denied) return { status: denied.status, body: { error: denied.error } };
      const payloadHash = crypto.createHash('sha256').update(JSON.stringify({
        sessionId: session.id, itemId: req.params.itemId,
        optionIndex: isArrangeSubmit ? null : optionIndex, order,
      })).digest('hex');
      const previous = await client.query(
        `SELECT * FROM grammar_task_requests WHERE user_id = $1 AND request_id = $2 FOR UPDATE`,
        [req.user.id, requestId]);
      if (previous.rows[0]) {
        const saved = previous.rows[0];
        if (saved.operation !== 'answer' || saved.payload_hash !== payloadHash) {
          return { status: 409, body: { error: 'request_id_conflict' } };
        }
        return saved.response ? { status: 200, body: saved.response }
          : { status: 409, body: { error: 'evaluation_pending' } };
      }
      const oldRequest = await client.query(`SELECT 1 FROM grammar_attempts WHERE user_id = $1 AND request_id = $2`, [req.user.id, requestId]);
      if (oldRequest.rows.length) return { status: 409, body: { error: 'request_id_conflict' } };
      const remember = async (body) => {
        await client.query(`INSERT INTO grammar_task_requests (user_id,request_id,session_id,payload_hash,operation,response)
          VALUES ($1,$2,$3,$4,'answer',$5)`, [req.user.id, requestId, session.id, payloadHash, JSON.stringify(body)]);
        return { status: 200, body };
      };
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
      if (isArrange && (order.length !== drill.tokens.length || new Set(order).size !== order.length
        || order.some(index => !Number.isInteger(index) || index < 0 || index >= drill.tokens.length))) {
        return { status: 400, body: { error: 'invalid_order' } };
      }

      // A solved item stays solved — answering it again (network retry,
      // double click, a second tab) must not mint another grammar_attempts
      // row or XP-equivalent progress (T08).
      if (item.passed === true || item.revealed_at) {
        return remember({ ...publicSessionItem(item), alreadyCompleted: true });
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
        `SELECT i.revealed_at, i.hint_served_at, i.passed FROM grammar_task_session_items i
          JOIN grammar_task_sessions s ON s.id = i.session_id
          WHERE s.user_id = $1 AND i.question_fingerprint = $2
            AND (i.revealed_at IS NOT NULL OR i.hint_served_at IS NOT NULL OR i.passed = TRUE)
            AND i.item_id <> $3`,
        [req.user.id, item.question_fingerprint, item.item_id]
      );
      const assistanceState = deriveAssistanceState({
        hintServedAt: item.hint_served_at || taintedRes.rows.some(row => row.hint_served_at),
        revealedAt: item.revealed_at,
        tainted: taintedRes.rows.some(row => row.revealed_at || row.passed),
      });

      const attemptOrdinalRes = await client.query(
        `SELECT COUNT(*)::int + 1 AS n FROM grammar_attempts WHERE practice_item_id = $1`,
        [req.params.itemId]
      );
      const primaryError = passed ? null : primaryErrorFor(item.step, drill.rule);
      const sentence = answerSentenceFor(drill, { isArrange, order, optionIndex });

      // The request record, item state and attempt commit together. Any
      // constraint/storage error rolls back the entire transition.
        await client.query(
          `INSERT INTO grammar_attempts (
             user_id, grammar_id, lesson_id, source, input_mode, sentence,
             correct, uses_pattern, passed, primary_error, error_types, eval_source,
             practice_session_id, practice_item_id, content_revision_id, question_fingerprint,
             request_id, request_payload_hash, attempt_ordinal, assistance_state,
             independent_eligible, evaluation_kind, evidence_schema_version,
             check_family_id
           ) VALUES ($1,$2,$3,$4,'text',$5,$6,$6,$6,$7,$8,'ai',
             $9,$10,$11,$12,$13,$14,$15,$16,$17,'deterministic',$18,$19)`,
          [
            req.user.id, item.grammar_id, session.task_lesson_id,
            attemptSourceFor(item.step),
            sentence, passed, primaryError, primaryError ? [primaryError] : [],
            session.id, req.params.itemId, session.content_revision_id, item.question_fingerprint,
            requestId, payloadHash, attemptOrdinalRes.rows[0].n, assistanceState,
            independentEligible(assistanceState), EVIDENCE_SCHEMA_VERSION,
            // NULL untuk Step 1/2 biasa; terisi hanya untuk item pemeriksaan,
            // supaya Smart Review bisa melihat keluarga soal apa yang sudah
            // benar-benar dikerjakan siswa ini.
            drill.checkFamilyId || null,
          ]
        );
      return remember({ ...publicSessionItem(upd.rows[0]), assistanceState,
        independentEligible: independentEligible(assistanceState) });
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
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, ['bunpou:' + req.user.id]);
      const denied = await sessionAccessError(client, req.user, session.id);
      if (denied) return { status: denied.status, body: { error: denied.error } };
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
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, ['bunpou:' + req.user.id]);
      const denied = await sessionAccessError(client, req.user, session.id);
      if (denied) return { status: denied.status, body: { error: denied.error } };
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
