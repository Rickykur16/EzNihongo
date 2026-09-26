import { Router } from 'express';
import { submitQuizAttempt } from '../quiz-submission.js';
import { query, withAdvisoryLock } from '../db.js';
import { requireAuth, asyncHandler } from '../middleware.js';
import { isAdminEmail } from '../auth.js';
import { requireLessonCourseAccess } from '../entitlements.js';
import { completeLessonWithStats, reconcileLegacyProgress } from '../progress-service.js';
import { kanaAssessmentKind, sampleKanaPlacementQuestions } from '../kana-placement.js';
import { isChapterAssessment, createChapterSnapshot, publicChapterQuestions, publicChapterRules, validateChapterDraft } from '../chapter-assessment.js';
import { renderTtsAudio } from './tts.js';
import { isCanonicalUuid } from '../live-class-admin-rules.js';
import rateLimit from 'express-rate-limit';

const router = Router();
const assessmentAudioLimiter = rateLimit({ windowMs: 60000, limit: 40, standardHeaders: 'draft-7', legacyHeaders: false });

// All routes require auth
router.use(requireAuth);
router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });

// GET /api/progress/me — all lessons the user has progress on
router.get('/progress/me', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT lesson_id, completed, completed_at, note, updated_at
     FROM user_progress WHERE user_id = $1`,
    [req.user.id]
  );
  res.json({ progress: result.rows });
}));

// GET /api/progress/lesson/:lessonId
router.get('/progress/lesson/:lessonId', requireLessonCourseAccess('lessonId'), asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT lesson_id, completed, completed_at, note
     FROM user_progress
     WHERE user_id = $1 AND lesson_id = $2
     LIMIT 1`,
    [req.user.id, req.params.lessonId]
  );
  res.json({ progress: result.rows[0] || null });
}));

// POST /api/progress/lesson/:lessonId/complete
router.post('/progress/lesson/:lessonId/complete', requireLessonCourseAccess('lessonId'), asyncHandler(async (req, res) => {
  const outcome = await withAdvisoryLock(
    `lesson-complete:${req.user.id}:${req.params.lessonId}`,
    (client) => completeLessonWithStats(client, { userId: req.user.id, lessonId: req.params.lessonId })
  );
  if (!outcome.found) return res.status(404).json({ error: 'Lesson not found' });
  if (outcome.requiresQuizPass) return res.status(409).json({ error: 'quiz_pass_required' });
  res.json({ ok: true, firstComplete: outcome.firstComplete });
}));

// POST /api/progress/reconcile — move legacy learning-state completion flags
// into canonical user_progress.  Safe to call on every signed-in boot: only
// missing FALSE/NULL → TRUE rows change, and historical XP is never minted.
router.post('/progress/reconcile', asyncHandler(async (req, res) => {
  const outcome = await withAdvisoryLock(
    `progress-reconcile:${req.user.id}`,
    (client) => reconcileLegacyProgress(client, req.user.id)
  );
  res.json({ ok: true, candidates: outcome.candidates, reconciled: outcome.reconciled });
}));

// Starting an assignment commits to its saved packet until submission. There
// is no refresh/absence TTL: reopening the site must resume the same attempt.
function attemptQuestionCount(attempt) {
  if (isChapterAssessment(attempt?.assessment_snapshot?.policy)) return attempt.assessment_snapshot.questions?.length || 0;
  return Array.isArray(attempt?.sampled_question_ids) ? attempt.sampled_question_ids.length : 0;
}

// Read-only boot discovery. Match the lesson-status ordering exactly, so old
// abandoned legacy rows superseded by later attempts never reappear. Active
// immutable chapter snapshots retain the priority they have in /quiz/start.
router.get('/progress/quiz/unfinished', asyncHandler(async (req, res) => {
  const admin = await isAdminEmail(req.user.email);
  const result = await query(`WITH ranked AS (
    SELECT a.id, a.attempt_token, a.lesson_id, a.started_at, a.completed_at, a.score,
      a.sampled_question_ids, a.assessment_snapshot,
      l.slug AS lesson_slug, l.title AS lesson_title, m.slug AS module_slug, c.slug AS course_slug,
      ROW_NUMBER() OVER (PARTITION BY a.lesson_id ORDER BY
        (a.completed_at IS NULL AND a.assessment_snapshot IS NOT NULL) DESC,
        COALESCE(a.completed_at, a.started_at) DESC NULLS LAST,
        a.started_at DESC NULLS LAST, a.id DESC) AS attempt_rank
    FROM quiz_attempts a JOIN lessons l ON l.id=a.lesson_id
      JOIN modules m ON m.id=l.module_id JOIN courses c ON c.id=m.course_id
    WHERE a.user_id=$1 AND l.type='quiz'
      AND ($2::boolean OR (c.is_published=TRUE AND EXISTS (
        SELECT 1 FROM user_enrollments e WHERE e.user_id=$1 AND e.course_id=c.id
          AND e.status='active' AND (e.expires_at IS NULL OR e.expires_at>NOW()))))
  ) SELECT * FROM ranked r WHERE attempt_rank=1 AND completed_at IS NULL AND score IS NULL
      AND started_at IS NOT NULL AND attempt_token IS NOT NULL
      AND CASE WHEN jsonb_typeof(sampled_question_ids)='array'
        THEN jsonb_array_length(sampled_question_ids)>0 ELSE FALSE END
      AND (assessment_snapshot IS NOT NULL OR NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(r.sampled_question_ids)='array'
          THEN r.sampled_question_ids ELSE '[]'::jsonb END) selected(question_id)
        WHERE NOT EXISTS (SELECT 1 FROM quiz_questions q
          WHERE q.id::text=selected.question_id AND q.lesson_id=r.lesson_id)))
    ORDER BY started_at DESC, id DESC LIMIT 1`, [req.user.id, admin]);
  const a = result.rows[0];
  res.json({ attempt: a ? {
    attemptToken: a.attempt_token, lessonId: a.lesson_id, lessonSlug: a.lesson_slug,
    lessonTitle: a.lesson_title, moduleSlug: a.module_slug, courseSlug: a.course_slug,
    startedAt: a.started_at, totalQuestions: attemptQuestionCount(a),
    assessmentVersion: a.assessment_snapshot?.version || null,
  } : null });
}));

// Compute cooldown summary buat lesson tertentu. Returns { lastAttempt,
// canAttempt, nextAttemptAt, cooldownHoursLeft, inProgress } yang dipakai
// `/quiz/start` + `GET /lessons/:id` quiz branch.
//
// `runQuery` opsional — passed in dari `withAdvisoryLock` callback supaya
// status check terjadi dalam transaction yang sama dengan INSERT, anti
// race condition. Default ke global query() (auto-pool connect).
async function lessonAttemptStatus(userId, lessonId, cooldownHours, runQuery = query) {
  const r = await runQuery(
    `SELECT id, attempt_token, score, total_questions, sampled_question_ids, grading_result,
            started_at, completed_at, assessment_snapshot, draft_answers, draft_revision
       FROM quiz_attempts
      WHERE user_id = $1 AND lesson_id = $2
      ORDER BY (completed_at IS NULL AND assessment_snapshot IS NOT NULL) DESC,
        COALESCE(completed_at, started_at) DESC NULLS LAST, started_at DESC NULLS LAST, id DESC
      LIMIT 1`,
    [userId, lessonId]
  );
  if (r.rows.length === 0) {
    return { lastAttempt: null, canAttempt: true, nextAttemptAt: null,
      cooldownHoursLeft: 0, inProgress: null };
  }
  const a = r.rows[0];

  if (a.score === null && !a.completed_at && a.started_at) {
    return {
      lastAttempt: null,
      canAttempt: true,
      nextAttemptAt: null,
      cooldownHoursLeft: 0,
      inProgress: a,
    };
  }

  const baseTime = a.completed_at || a.started_at;
  const baseMs = new Date(baseTime).getTime();
  const cooldownMs = (a.assessment_snapshot?.policy.cooldownHours ?? cooldownHours) * 3600 * 1000;
  const nextMs = baseMs + cooldownMs;
  const hoursLeft = Math.max(0, (nextMs - Date.now()) / 3600000);
  const canAttempt = hoursLeft <= 0;
  return {
    lastAttempt: a.score !== null ? {
      id: a.id,
      score: a.score,
      totalQuestions: a.total_questions,
      completedAt: a.completed_at,
      attemptToken: a.attempt_token,
      assessmentVersion: a.assessment_snapshot?.version || null,
      sectionResults: a.grading_result?.sectionResults || [],
      objectiveResults: a.grading_result?.objectiveResults || [],
      passed: typeof a.grading_result?.passed === 'boolean' ? a.grading_result.passed : null,
    } : null,
    canAttempt,
    nextAttemptAt: canAttempt ? null : new Date(nextMs).toISOString(),
    cooldownHoursLeft: canAttempt ? 0 : Number(hoursLeft.toFixed(2)),
    inProgress: null,
  };
}

// Sample N question IDs dari pool. Fisher-Yates shuffle, take N.
// Kalau questionsPerAttempt null/0, ambil semua.
function sampleQuestionIds(allIds, questionsPerAttempt) {
  if (!questionsPerAttempt || questionsPerAttempt >= allIds.length) {
    // Tetap shuffle supaya order di-render acak juga (kalau pool == sample).
    const shuffled = allIds.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  const ids = allIds.slice();
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, questionsPerAttempt);
}

async function loadQuestionsByIds(ids, lessonId) {
  if (ids.length === 0) return [];
  // Paralel: questions row + options dalam 1 round trip (sebelumnya sequential).
  const [qRes, oRes] = await Promise.all([
    query(
      `SELECT id, question, question_type, question_category, section_number,
              section_label, section_instruction,
              CASE WHEN audio_scene IS NULL THEN audio_script ELSE NULL END AS audio_script,
              (question_category = 'listening' AND audio_scene IS NOT NULL) AS has_audio,
              passage, image_url,
              explanation, sort_order
         FROM quiz_questions
        WHERE id = ANY($1::uuid[]) AND lesson_id=$2`,
      [ids, lessonId]
    ),
    query(
      `SELECT id, question_id, option_text, image_url, sort_order
         FROM quiz_options
        WHERE question_id = ANY($1::uuid[])
        ORDER BY sort_order ASC`,
      [ids]
    ),
  ]);
  const optsByQ = {};
  for (const o of oRes.rows) {
    (optsByQ[o.question_id] ||= []).push(o);
  }
  const byId = new Map(qRes.rows.map((q) => [q.id, q]));
  return ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((q) => ({ ...q, options: optsByQ[q.id] || [] }));
}

// POST /api/progress/lesson/:lessonId/quiz/start
// Mulai attempt baru (atau resume in-progress sampai dikumpulkan). Cek
// cooldown dulu — kalau masih dalam window, return blocked + countdown.
// Kalau OK: sample N soal acak dari pool, INSERT attempt row, return
// attemptToken + soal.
//
// Anti-race: cooldown check + INSERT terjadi dalam satu transaction
// yang dikunci via pg_advisory_xact_lock(user_id||lesson_id). Dua
// request concurrent untuk (user, lesson) sama → request kedua block
// sampai yg pertama commit, lalu re-check cooldown → block 429.
router.post('/progress/lesson/:lessonId/quiz/start', requireLessonCourseAccess('lessonId'), asyncHandler(async (req, res) => {
  const lessonId = req.params.lessonId;
  const resumeOnly = req.body?.resumeOnly === true;
  const expectedToken = req.body?.attemptToken;
  if (resumeOnly && !isCanonicalUuid(expectedToken)) return res.status(400).json({ error: 'invalid_attempt_token' });

  // Lesson meta + pool IDs paralel — di luar lock karena read-only & idempotent.
  const [lessonRow, poolIdsRes] = await Promise.all([
    query(
      `SELECT id, slug, type, passing_score_pct, questions_per_attempt, cooldown_hours, assessment_policy
         FROM lessons WHERE id = $1 LIMIT 1`,
      [lessonId]
    ),
    query(`SELECT id, section_number, question_type FROM quiz_questions WHERE lesson_id = $1`, [lessonId]),
  ]);
  if (lessonRow.rows.length === 0) return res.status(404).json({ error: 'Lesson not found' });
  const lesson = lessonRow.rows[0];
  if (lesson.type !== 'quiz') return res.status(400).json({ error: 'lesson_not_quiz' });

  const passingScorePct = lesson.passing_score_pct ?? 70;
  const cooldownHours = lesson.cooldown_hours ?? 12;
  const chapterPolicy = isChapterAssessment(lesson.assessment_policy) ? { ...lesson.assessment_policy, cooldownHours } : null;
  const poolRows = poolIdsRes.rows;
  const allIds = poolRows.map((r) => r.id);

  // Critical section — lock per (user, lesson). Status check & INSERT
  // share the same transaction supaya concurrent requests serialize.
  let result;
  try {
    result = await withAdvisoryLock(`quiz:${req.user.id}:${lessonId}`, async (client) => {
      const runQuery = (text, params) => client.query(text, params);
      const status = await lessonAttemptStatus(req.user.id, lessonId, cooldownHours, runQuery);

      if (resumeOnly && status.inProgress?.attempt_token !== expectedToken) return { kind: 'resume_missing' };

      if (!status.canAttempt) {
        return { kind: 'blocked', status };
      }
      if (status.inProgress) {
        return { kind: 'resume', inProgress: status.inProgress };
      }
      if (!allIds.length) return { kind: 'empty' };

      let snapshot = null;
      if (chapterPolicy) {
        const previous = await client.query(`SELECT assessment_snapshot->>'form' AS form FROM quiz_attempts
          WHERE user_id=$1 AND lesson_id=$2 AND assessment_snapshot->>'version'=$3
          ORDER BY started_at DESC, id DESC LIMIT 1`, [req.user.id, lessonId, chapterPolicy.version]);
        const bank = await client.query(`SELECT q.*, COALESCE((SELECT jsonb_agg(to_jsonb(o) ORDER BY o.sort_order)
          FROM quiz_options o WHERE o.question_id=q.id), '[]'::jsonb) AS options
          FROM quiz_questions q WHERE q.lesson_id=$1 AND q.assessment_meta->>'version'=$2`, [lessonId, chapterPolicy.version]);
        snapshot = createChapterSnapshot(chapterPolicy, bank.rows, previous.rows[0]?.form);
      }
      const sampledIds = snapshot ? snapshot.questions.map(q => q.id) : kanaAssessmentKind(lesson.slug)
        ? sampleKanaPlacementQuestions(poolRows, lesson.questions_per_attempt).map((row) => row.id)
        : sampleQuestionIds(allIds, lesson.questions_per_attempt);
      const insertRes = await runQuery(
        `INSERT INTO quiz_attempts (user_id, lesson_id, attempt_token, sampled_question_ids, assessment_snapshot, started_at)
         VALUES ($1, $2, gen_random_uuid(), $3::jsonb, $4::jsonb, NOW())
         RETURNING attempt_token, started_at`,
        [req.user.id, lessonId, JSON.stringify(sampledIds), snapshot ? JSON.stringify(snapshot) : null]
      );
      return {
        kind: 'new',
        sampledIds,
        attemptToken: insertRes.rows[0].attempt_token,
        startedAt: insertRes.rows[0].started_at,
        snapshot,
      };
    });
  } catch (err) {
    console.error('quiz/start lock error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }

  if (result.kind === 'resume_missing') return res.status(409).json({ error: 'attempt_not_pending' });
  if (result.kind === 'empty') return res.status(404).json({ error: 'Lesson has no quiz questions' });
  if (result.kind === 'blocked') {
    const s = result.status;
    return res.status(429).json({
      blocked: true,
      reason: 'cooldown',
      cooldownHours,
      cooldownHoursLeft: s.cooldownHoursLeft,
      nextAttemptAt: s.nextAttemptAt,
      lastAttempt: s.lastAttempt,
      passingScorePct: chapterPolicy?.passingScorePct ?? passingScorePct,
    });
  }

  if (result.kind === 'resume') {
    const ip = result.inProgress;
    const sampledIds = Array.isArray(ip.sampled_question_ids) ? ip.sampled_question_ids : [];
    const questions = ip.assessment_snapshot ? publicChapterQuestions(ip.assessment_snapshot) : await loadQuestionsByIds(sampledIds, lessonId);
    if (questions.length !== sampledIds.length || !questions.length) return res.status(409).json({ error: 'quiz_questions_changed' });
    return res.json({
      resumed: true,
      attemptToken: ip.attempt_token,
      questions,
      passingScorePct: ip.assessment_snapshot?.policy.passingScorePct ?? passingScorePct,
      totalQuestions: questions.length,
      questionsPerAttempt: questions.length,
      expiresAt: null,
      draftEnabled: true, draftAnswers: ip.draft_answers || [], draftRevision: ip.draft_revision || 0,
      ...(ip.assessment_snapshot ? { assessmentVersion: ip.assessment_snapshot.version, assessmentForm: ip.assessment_snapshot.form,
        assessmentRules: publicChapterRules(ip.assessment_snapshot.policy), objectives: ip.assessment_snapshot.policy.objectives } : {}),
    });
  }

  // result.kind === 'new'
  const questions = result.snapshot ? publicChapterQuestions(result.snapshot) : await loadQuestionsByIds(result.sampledIds, lessonId);
  if (questions.length !== result.sampledIds.length || !questions.length) return res.status(409).json({ error: 'quiz_questions_changed' });
  res.json({
    attemptToken: result.attemptToken,
    questions,
    passingScorePct: result.snapshot?.policy.passingScorePct ?? passingScorePct,
    totalQuestions: questions.length,
    questionsPerAttempt: questions.length,
    poolSize: result.snapshot ? 48 : allIds.length,
    expiresAt: null,
    draftEnabled: true, draftAnswers: [], draftRevision: 0,
    ...(result.snapshot ? { assessmentVersion: result.snapshot.version, assessmentForm: result.snapshot.form,
      assessmentRules: publicChapterRules(result.snapshot.policy), objectives: result.snapshot.policy.objectives } : {}),
  });
}));

// Drafts are revision-checked so a stale tab cannot overwrite newer work.
router.put('/progress/lesson/:lessonId/quiz/draft', requireLessonCourseAccess('lessonId'), asyncHandler(async (req, res) => {
  const { attemptToken, answers, revision } = req.body || {};
  if (!isCanonicalUuid(attemptToken) || !Number.isInteger(revision) || revision < 0) return res.status(400).json({ error: 'invalid_draft' });
  const outcome = await withAdvisoryLock(`quiz:${req.user.id}:${req.params.lessonId}`, async client => {
    const found = await client.query(`SELECT id, assessment_snapshot, sampled_question_ids, completed_at, draft_revision FROM quiz_attempts
      WHERE user_id=$1 AND lesson_id=$2 AND attempt_token=$3 FOR UPDATE`, [req.user.id, req.params.lessonId, attemptToken]);
    const attempt = found.rows[0];
    if (!attempt) return { status: 404, body: { error: 'attempt_not_found' } };
    if (attempt.completed_at) return { status: 409, body: { error: 'attempt_completed' } };
    if (attempt.draft_revision !== revision) return { status: 409, body: { error: 'draft_conflict' } };
    const chapter = isChapterAssessment(attempt.assessment_snapshot?.policy);
    if (chapter) {
      if (!validateChapterDraft(attempt.assessment_snapshot, answers)) return { status: 400, body: { error: 'invalid_draft' } };
    } else {
      const status = await lessonAttemptStatus(req.user.id, req.params.lessonId, 0, (sql, params) => client.query(sql, params));
      if (status.inProgress?.id !== attempt.id) return { status: 409, body: { error: 'attempt_superseded' } };
      const ids = Array.isArray(attempt.sampled_question_ids) ? attempt.sampled_question_ids : [];
      if (!ids.length || new Set(ids).size !== ids.length || !Array.isArray(answers) || answers.length > ids.length) return { status: 400, body: { error: 'invalid_draft' } };
      const saved = await client.query(`SELECT q.id, q.question_type,
        COALESCE((SELECT jsonb_agg(o.id) FROM quiz_options o WHERE o.question_id=q.id), '[]'::jsonb) AS option_ids
        FROM quiz_questions q WHERE q.lesson_id=$1 AND q.id=ANY($2::uuid[])`, [req.params.lessonId, ids]);
      if (saved.rows.length !== ids.length) return { status: 409, body: { error: 'quiz_questions_changed' } };
      const seen = new Set();
      const valid = answers.every(answer => {
        const question = saved.rows.find(q => q.id === answer?.questionId);
        if (!question || seen.has(question.id)) return false;
        seen.add(question.id);
        return question.question_type === 'fill_blank'
          ? !answer.optionId && typeof answer.textAnswer === 'string' && !!answer.textAnswer.trim() && answer.textAnswer.length <= 200
          : !answer.textAnswer && question.option_ids.includes(answer.optionId);
      });
      if (!valid) return { status: 400, body: { error: 'invalid_draft' } };
    }
    const cleanAnswers = answers.map(a => a.optionId ? { questionId: a.questionId, optionId: a.optionId } : { questionId: a.questionId, textAnswer: a.textAnswer });
    await client.query(`UPDATE quiz_attempts SET draft_answers=$2::jsonb, draft_revision=draft_revision+1 WHERE id=$1`, [attempt.id, JSON.stringify(cleanAnswers)]);
    return { status: 200, body: { revision: revision + 1 } };
  });
  res.set('Cache-Control', 'private, no-store').status(outcome.status).json(outcome.body);
}));

router.get('/progress/lesson/:lessonId/quiz/review', requireLessonCourseAccess('lessonId'), asyncHandler(async (req, res) => {
  const token = req.query.attemptToken;
  if (!isCanonicalUuid(token)) return res.status(400).json({ error: 'invalid_attempt_token' });
  const found = await query(`SELECT grading_result FROM quiz_attempts WHERE user_id=$1 AND lesson_id=$2
    AND attempt_token=$3 AND completed_at IS NOT NULL AND assessment_snapshot IS NOT NULL`, [req.user.id, req.params.lessonId, token]);
  if (!found.rows[0]?.grading_result) return res.status(404).json({ error: 'review_not_available' });
  res.set('Cache-Control', 'private, no-store').json(found.rows[0].grading_result);
}));

router.get('/progress/lesson/:lessonId/quiz/audio/:questionId', assessmentAudioLimiter, requireLessonCourseAccess('lessonId'), asyncHandler(async (req, res) => {
  const token = req.query.attemptToken;
  if (!isCanonicalUuid(token) || !isCanonicalUuid(req.params.questionId)) return res.status(400).json({ error: 'invalid_audio_request' });
  const found = await query(`SELECT assessment_snapshot, sampled_question_ids FROM quiz_attempts WHERE user_id=$1 AND lesson_id=$2 AND attempt_token=$3`, [req.user.id, req.params.lessonId, token]);
  const attempt = found.rows[0];
  const snapshot = attempt?.assessment_snapshot;
  let question = isChapterAssessment(snapshot?.policy) && snapshot.questions.find(q => q.id === req.params.questionId && q.question_category === 'listening');
  // Legacy attempts have no immutable bank snapshot. Authorize their sampled
  // ID and lesson before reading the saved script/scene, never from the client.
  if (!snapshot && Array.isArray(attempt?.sampled_question_ids) && attempt.sampled_question_ids.includes(req.params.questionId)) {
    const saved = await query(`SELECT audio_script, audio_scene FROM quiz_questions
      WHERE id=$1 AND lesson_id=$2 AND question_category='listening'`, [req.params.questionId, req.params.lessonId]);
    question = saved.rows[0];
  }
  if (!question?.audio_script?.trim()) return res.status(404).json({ error: 'audio_not_available' });
  return renderTtsAudio(question.audio_script, res, { privateResponse: true, dialogScene: question.audio_scene });
}));

// POST /api/progress/lesson/:lessonId/quiz-attempt
// One transaction saves the authoritative grade, detailed answers and passed
// lesson completion. Retrying the same token returns the persisted response.
router.post('/progress/lesson/:lessonId/quiz-attempt', requireLessonCourseAccess('lessonId'), asyncHandler(async (req, res) => {
  const lessonId = req.params.lessonId;
  const outcome = await withAdvisoryLock(`quiz:${req.user.id}:${lessonId}`, client =>
    submitQuizAttempt(client, {
      userId: req.user.id, lessonId,
      attemptToken: req.body?.attemptToken, answers: req.body?.answers,
      draftRevision: req.body?.draftRevision,
    })
  );
  res.status(outcome.status).json(outcome.body);
}));


// GET /api/progress/lesson/:lessonId/quiz-status
// Cooldown + last attempt info, dipakai welcome.html quiz landing.
router.get('/progress/lesson/:lessonId/quiz-status', requireLessonCourseAccess('lessonId'), asyncHandler(async (req, res) => {
  const lessonId = req.params.lessonId;
  const lessonRow = await query(
    `SELECT id, type, passing_score_pct, questions_per_attempt, cooldown_hours, assessment_policy
       FROM lessons WHERE id = $1 LIMIT 1`,
    [lessonId]
  );
  if (lessonRow.rows.length === 0) return res.status(404).json({ error: 'Lesson not found' });
  const lesson = lessonRow.rows[0];
  if (lesson.type !== 'quiz') return res.status(400).json({ error: 'lesson_not_quiz' });

  const passingScorePct = lesson.passing_score_pct ?? 70;
  const cooldownHours = lesson.cooldown_hours ?? 12;
  const status = await lessonAttemptStatus(req.user.id, lessonId, cooldownHours);

  // Pool size (untuk indikator "X soal pool, N akan diuji").
  const poolRes = await query(
    `SELECT COUNT(*)::int AS n FROM quiz_questions WHERE lesson_id = $1
      AND ($2::text IS NULL OR assessment_meta->>'version'=$2)`,
    [lessonId, isChapterAssessment(lesson.assessment_policy) ? lesson.assessment_policy.version : null]
  );
  const poolSize = poolRes.rows[0]?.n || 0;
  const resumingLegacy = !!status.inProgress && !status.inProgress.assessment_snapshot && isChapterAssessment(lesson.assessment_policy);
  const displayPolicy = resumingLegacy ? null : status.inProgress?.assessment_snapshot?.policy || lesson.assessment_policy;
  const questionsPerAttempt = status.inProgress ? attemptQuestionCount(status.inProgress)
    : isChapterAssessment(displayPolicy) ? publicChapterRules(displayPolicy).questionsPerForm
    : Math.min(lesson.questions_per_attempt || poolSize, poolSize);

  res.json({
    lessonId,
    passingScorePct: isChapterAssessment(displayPolicy) ? publicChapterRules(displayPolicy).passingScorePct : passingScorePct,
    questionsPerAttempt,
    totalQuestions: questionsPerAttempt,
    cooldownHours,
    poolSize,
    canAttempt: status.canAttempt,
    cooldownHoursLeft: status.cooldownHoursLeft,
    nextAttemptAt: status.nextAttemptAt,
    lastAttempt: status.lastAttempt,
    inProgress: !!status.inProgress,
    inProgressAttemptToken: status.inProgress?.attempt_token || null,
    resumingLegacy,
    ...(isChapterAssessment(displayPolicy) ? { assessmentVersion: displayPolicy.version,
      assessmentRules: publicChapterRules(displayPolicy), objectives: displayPolicy.objectives } : {}),
  });
}));

// PUT /api/progress/lesson/:lessonId/note
router.put('/progress/lesson/:lessonId/note', requireLessonCourseAccess('lessonId'), asyncHandler(async (req, res) => {
  const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 10000) : '';
  await query(
    `INSERT INTO user_progress (user_id, lesson_id, note)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, lesson_id) DO UPDATE
     SET note = EXCLUDED.note, updated_at = NOW()`,
    [req.user.id, req.params.lessonId, note]
  );
  res.json({ ok: true });
}));

// GET /api/stats/me
// Returns lifetime stats + today's habit progress in one round-trip so the
// dashboard can render the streak chip and daily-goal pill without a second
// fetch. Goal target is hardcoded (10 min OR 1 lesson per day) for now;
// promote to user_stats.daily_goal_minutes if customisation is needed.
router.get('/stats/me', asyncHandler(async (req, res) => {
  const [statsRes, todayRes] = await Promise.all([
    query(
      `SELECT xp, level, streak_days, last_active_date,
              total_lessons_completed, total_minutes_learned
       FROM user_stats WHERE user_id = $1 LIMIT 1`,
      [req.user.id]
    ),
    query(
      `SELECT COALESCE(SUM(l.duration_minutes), 0)::int AS minutes_today,
              COUNT(*)::int AS lessons_today
       FROM user_progress up
       JOIN lessons l ON l.id = up.lesson_id
       WHERE up.user_id = $1
         AND up.completed = TRUE
         AND DATE(up.completed_at) = CURRENT_DATE`,
      [req.user.id]
    ),
  ]);

  const base = statsRes.rows[0] || {
    xp: 0, level: 1, streak_days: 0, last_active_date: null,
    total_lessons_completed: 0, total_minutes_learned: 0,
  };

  const goalMinutes = 10;
  const goalLessons = 1;
  const minutesToday = todayRes.rows[0]?.minutes_today ?? 0;
  const lessonsToday = todayRes.rows[0]?.lessons_today ?? 0;
  // Either target hits — flexible for short lessons (1 done = enough) and
  // long ones (10 minutes deep into a single video also counts).
  const goalMet = minutesToday >= goalMinutes || lessonsToday >= goalLessons;

  res.json({
    stats: {
      ...base,
      today: { minutesToday, lessonsToday, goalMinutes, goalLessons, goalMet },
    },
  });
}));

// POST /api/enrollments
// Accepts { courseSlug } or { courseId }. Slug is the usual path — frontend only
// knows slugs. We look up the course row and enforce that it's purchasable
// (published + available) before enrolling. This is the single source of truth
// for access — do NOT trust localStorage on the frontend.
//
// Free-only (Phase 2): this endpoint self-enrolls a user with ZERO payment
// check, so it only ever applies to courses explicitly marked is_free=TRUE.
// A paid course (is_free=FALSE) must go through POST /api/orders instead;
// an unclassified course (is_free IS NULL — not yet reviewed by an admin,
// see migration 121) is blocked from both paths until it's classified.
router.post('/enrollments', asyncHandler(async (req, res) => {
  const { courseSlug, courseId } = req.body || {};
  if (!courseSlug && !courseId) {
    return res.status(400).json({ error: 'courseSlug or courseId required' });
  }

  const lookup = courseId
    ? await query(`SELECT id, is_published, is_available, is_free FROM courses WHERE id = $1`, [courseId])
    : await query(`SELECT id, is_published, is_available, is_free FROM courses WHERE slug = $1`, [courseSlug]);

  if (lookup.rows.length === 0) {
    return res.status(404).json({ error: 'Kursus tidak ditemukan.' });
  }
  const course = lookup.rows[0];
  if (!course.is_published) {
    return res.status(403).json({ error: 'Kursus belum terbit.' });
  }
  if (course.is_available === false) {
    return res.status(403).json({ error: 'Kursus belum tersedia untuk pembelian.' });
  }
  // Strict IS TRUE — excludes both FALSE (paid) and NULL (unclassified) by
  // construction, so neither can slip through as "not FALSE therefore free".
  if (course.is_free !== true) {
    return res.status(403).json({ error: 'payment_required' });
  }

  // An existing row that's been admin-revoked must NOT be silently
  // reactivated by self-enroll — that would defeat the revoke. Report it
  // distinctly instead of the generic "already enrolled".
  const existing = await query(
    `SELECT id, status FROM user_enrollments WHERE user_id = $1 AND course_id = $2 LIMIT 1`,
    [req.user.id, course.id]
  );
  if (existing.rows.length > 0 && existing.rows[0].status === 'revoked') {
    return res.status(403).json({ error: 'access_revoked' });
  }

  const ins = await query(
    `INSERT INTO user_enrollments (user_id, course_id, status, source)
     VALUES ($1, $2, 'active', 'self_enroll')
     ON CONFLICT (user_id, course_id) DO NOTHING
     RETURNING id`,
    [req.user.id, course.id]
  );
  res.json({ ok: true, alreadyEnrolled: ins.rows.length === 0, courseId: course.id });
}));

// GET /api/enrollments/me
// Only currently-active (not revoked, not expired) entitlements — this is
// what the frontend uses to decide which courses to render/fetch, so a
// revoked or lapsed course must disappear from here.
// Admins get implicit access to every published course so they can preview
// content and test the enrolled UX without needing a real enrollment row.
// Useful while there's no payment gateway yet and admins need to inspect
// student-side flows repeatedly.
router.get('/enrollments/me', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT c.id, c.slug, c.title, c.description, c.level, c.thumbnail_url,
            e.enrolled_at, e.expires_at, e.source
     FROM user_enrollments e
     JOIN courses c ON c.id = e.course_id
     WHERE e.user_id = $1
       AND e.status = 'active' AND (e.expires_at IS NULL OR e.expires_at > NOW())
     ORDER BY e.enrolled_at DESC`,
    [req.user.id]
  );

  if (await isAdminEmail(req.user.email)) {
    const all = await query(
      `SELECT id, slug, title, description, level, thumbnail_url
       FROM courses WHERE is_published = TRUE
       ORDER BY sort_order ASC, created_at ASC`
    );
    const have = new Set(result.rows.map((r) => r.id));
    for (const c of all.rows) {
      if (!have.has(c.id)) result.rows.push({ ...c, enrolled_at: null });
    }
  }

  res.json({ enrollments: result.rows });
}));

export default router;
