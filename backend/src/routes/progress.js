import { Router } from 'express';
import { submitQuizAttempt } from '../quiz-submission.js';
import { query, withAdvisoryLock } from '../db.js';
import { requireAuth, asyncHandler } from '../middleware.js';
import { isAdminEmail } from '../auth.js';
import { requireLessonCourseAccess } from '../entitlements.js';
import { completeLessonWithStats, reconcileLegacyProgress } from '../progress-service.js';

const router = Router();

// All routes require auth
router.use(requireAuth);

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

// In-progress attempt token TTL — kalau user refresh dalam window ini,
// kasih EXISTING sampled questions (anti-soal-baru-tiap-refresh).
const ATTEMPT_RESUME_MINUTES = 30;

// Compute cooldown summary buat lesson tertentu. Returns { lastAttempt,
// canAttempt, nextAttemptAt, cooldownHoursLeft, inProgress } yang dipakai
// `/quiz/start` + `GET /lessons/:id` quiz branch.
//
// `runQuery` opsional — passed in dari `withAdvisoryLock` callback supaya
// status check terjadi dalam transaction yang sama dengan INSERT, anti
// race condition. Default ke global query() (auto-pool connect).
async function lessonAttemptStatus(userId, lessonId, cooldownHours, runQuery = query) {
  const r = await runQuery(
    `SELECT id, attempt_token, score, total_questions, sampled_question_ids,
            started_at, completed_at
       FROM quiz_attempts
      WHERE user_id = $1 AND lesson_id = $2
      ORDER BY COALESCE(completed_at, started_at) DESC NULLS LAST, started_at DESC NULLS LAST, id DESC
      LIMIT 1`,
    [userId, lessonId]
  );
  if (r.rows.length === 0) {
    return { lastAttempt: null, canAttempt: true, nextAttemptAt: null,
      cooldownHoursLeft: 0, inProgress: null };
  }
  const a = r.rows[0];

  // Attempt in-progress (score belum di-isi) — resume kalau started_at masih
  // dalam ATTEMPT_RESUME_MINUTES window. Kalau udah expired, treat as a
  // completed-but-unsubmitted attempt → next attempt sesuai cooldown dari started_at.
  if (a.score === null && a.started_at) {
    const startedMs = new Date(a.started_at).getTime();
    const ageMin = (Date.now() - startedMs) / 60000;
    if (ageMin < ATTEMPT_RESUME_MINUTES) {
      return {
        lastAttempt: null,
        canAttempt: true,
        nextAttemptAt: null,
        cooldownHoursLeft: 0,
        inProgress: a,
      };
    }
    // Treat the expired in-progress as completed-at = started_at.
  }

  const baseTime = a.completed_at || a.started_at;
  const baseMs = new Date(baseTime).getTime();
  const cooldownMs = cooldownHours * 3600 * 1000;
  const nextMs = baseMs + cooldownMs;
  const hoursLeft = Math.max(0, (nextMs - Date.now()) / 3600000);
  const canAttempt = hoursLeft <= 0;
  return {
    lastAttempt: a.score !== null ? {
      id: a.id,
      score: a.score,
      totalQuestions: a.total_questions,
      completedAt: a.completed_at,
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

async function loadQuestionsByIds(ids) {
  if (ids.length === 0) return [];
  // Paralel: questions row + options dalam 1 round trip (sebelumnya sequential).
  const [qRes, oRes] = await Promise.all([
    query(
      `SELECT id, question, question_type, question_category, section_number,
              section_label, section_instruction, audio_script, passage, image_url,
              explanation, sort_order
         FROM quiz_questions
        WHERE id = ANY($1::uuid[])`,
      [ids]
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
// Mulai attempt baru (atau resume in-progress dalam 30 menit). Cek
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

  // Lesson meta + pool IDs paralel — di luar lock karena read-only & idempotent.
  const [lessonRow, poolIdsRes] = await Promise.all([
    query(
      `SELECT id, type, passing_score_pct, questions_per_attempt, cooldown_hours
         FROM lessons WHERE id = $1 LIMIT 1`,
      [lessonId]
    ),
    query(`SELECT id FROM quiz_questions WHERE lesson_id = $1`, [lessonId]),
  ]);
  if (lessonRow.rows.length === 0) return res.status(404).json({ error: 'Lesson not found' });
  const lesson = lessonRow.rows[0];
  if (lesson.type !== 'quiz') return res.status(400).json({ error: 'lesson_not_quiz' });

  const passingScorePct = lesson.passing_score_pct ?? 70;
  const cooldownHours = lesson.cooldown_hours ?? 12;
  const allIds = poolIdsRes.rows.map((r) => r.id);
  if (allIds.length === 0) return res.status(404).json({ error: 'Lesson has no quiz questions' });

  // Critical section — lock per (user, lesson). Status check & INSERT
  // share the same transaction supaya concurrent requests serialize.
  let result;
  try {
    result = await withAdvisoryLock(`quiz:${req.user.id}:${lessonId}`, async (client) => {
      const runQuery = (text, params) => client.query(text, params);
      const status = await lessonAttemptStatus(req.user.id, lessonId, cooldownHours, runQuery);

      if (!status.canAttempt) {
        return { kind: 'blocked', status };
      }
      if (status.inProgress) {
        return { kind: 'resume', inProgress: status.inProgress };
      }

      const sampledIds = sampleQuestionIds(allIds, lesson.questions_per_attempt);
      const insertRes = await runQuery(
        `INSERT INTO quiz_attempts (user_id, lesson_id, attempt_token, sampled_question_ids, started_at)
         VALUES ($1, $2, gen_random_uuid(), $3::jsonb, NOW())
         RETURNING attempt_token, started_at`,
        [req.user.id, lessonId, JSON.stringify(sampledIds)]
      );
      return {
        kind: 'new',
        sampledIds,
        attemptToken: insertRes.rows[0].attempt_token,
        startedAt: insertRes.rows[0].started_at,
      };
    });
  } catch (err) {
    console.error('quiz/start lock error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }

  if (result.kind === 'blocked') {
    const s = result.status;
    return res.status(429).json({
      blocked: true,
      reason: 'cooldown',
      cooldownHours,
      cooldownHoursLeft: s.cooldownHoursLeft,
      nextAttemptAt: s.nextAttemptAt,
      lastAttempt: s.lastAttempt,
      passingScorePct,
    });
  }

  if (result.kind === 'resume') {
    const ip = result.inProgress;
    const sampledIds = Array.isArray(ip.sampled_question_ids) ? ip.sampled_question_ids : [];
    const questions = await loadQuestionsByIds(sampledIds);
    const expiresAt = new Date(new Date(ip.started_at).getTime() + ATTEMPT_RESUME_MINUTES * 60000).toISOString();
    return res.json({
      resumed: true,
      attemptToken: ip.attempt_token,
      questions,
      passingScorePct,
      totalQuestions: questions.length,
      expiresAt,
    });
  }

  // result.kind === 'new'
  const questions = await loadQuestionsByIds(result.sampledIds);
  const expiresAt = new Date(new Date(result.startedAt).getTime() + ATTEMPT_RESUME_MINUTES * 60000).toISOString();
  res.json({
    attemptToken: result.attemptToken,
    questions,
    passingScorePct,
    totalQuestions: questions.length,
    poolSize: allIds.length,
    expiresAt,
  });
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
    })
  );
  res.status(outcome.status).json(outcome.body);
}));


// GET /api/progress/lesson/:lessonId/quiz-status
// Cooldown + last attempt info, dipakai welcome.html quiz landing.
router.get('/progress/lesson/:lessonId/quiz-status', requireLessonCourseAccess('lessonId'), asyncHandler(async (req, res) => {
  const lessonId = req.params.lessonId;
  const lessonRow = await query(
    `SELECT id, type, passing_score_pct, questions_per_attempt, cooldown_hours
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
    `SELECT COUNT(*)::int AS n FROM quiz_questions WHERE lesson_id = $1`,
    [lessonId]
  );
  const poolSize = poolRes.rows[0]?.n || 0;

  res.json({
    lessonId,
    passingScorePct,
    questionsPerAttempt: lesson.questions_per_attempt || poolSize,
    cooldownHours,
    poolSize,
    canAttempt: status.canAttempt,
    cooldownHoursLeft: status.cooldownHoursLeft,
    nextAttemptAt: status.nextAttemptAt,
    lastAttempt: status.lastAttempt,
    inProgress: !!status.inProgress,
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
