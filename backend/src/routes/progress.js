import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, asyncHandler } from '../middleware.js';
import { isAdminEmail } from '../auth.js';

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
router.get('/progress/lesson/:lessonId', asyncHandler(async (req, res) => {
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
router.post('/progress/lesson/:lessonId/complete', asyncHandler(async (req, res) => {
  const lesson = await query(
    `SELECT id, duration_minutes FROM lessons WHERE id = $1 LIMIT 1`,
    [req.params.lessonId]
  );
  if (lesson.rows.length === 0) return res.status(404).json({ error: 'Lesson not found' });

  const upsert = await query(
    `INSERT INTO user_progress (user_id, lesson_id, completed, completed_at)
     VALUES ($1, $2, TRUE, NOW())
     ON CONFLICT (user_id, lesson_id) DO UPDATE
     SET completed = TRUE, completed_at = COALESCE(user_progress.completed_at, NOW()), updated_at = NOW()
     RETURNING (xmax = 0) AS inserted`,
    [req.user.id, req.params.lessonId]
  );
  const isFirstComplete = upsert.rows[0].inserted;

  if (isFirstComplete) {
    const mins = lesson.rows[0].duration_minutes || 0;
    const xpGained = 10 + mins;
    await query(
      `INSERT INTO user_stats (user_id, xp, total_lessons_completed, total_minutes_learned, last_active_date)
       VALUES ($1, $2, 1, $3, CURRENT_DATE)
       ON CONFLICT (user_id) DO UPDATE
       SET xp = user_stats.xp + $2,
           total_lessons_completed = user_stats.total_lessons_completed + 1,
           total_minutes_learned = user_stats.total_minutes_learned + $3,
           streak_days = CASE
             WHEN user_stats.last_active_date = CURRENT_DATE THEN user_stats.streak_days
             WHEN user_stats.last_active_date = CURRENT_DATE - 1 THEN user_stats.streak_days + 1
             ELSE 1
           END,
           last_active_date = CURRENT_DATE,
           updated_at = NOW()`,
      [req.user.id, xpGained, mins]
    );
  }

  res.json({ ok: true, firstComplete: isFirstComplete });
}));

// In-progress attempt token TTL — kalau user refresh dalam window ini,
// kasih EXISTING sampled questions (anti-soal-baru-tiap-refresh).
const ATTEMPT_RESUME_MINUTES = 30;

// Compute cooldown summary buat lesson tertentu. Returns { lastAttempt,
// canAttempt, nextAttemptAt, cooldownHoursLeft, inProgress } yang dipakai
// `/quiz/start` + `GET /lessons/:id` quiz branch.
async function lessonAttemptStatus(userId, lessonId, cooldownHours) {
  const r = await query(
    `SELECT id, attempt_token, score, total_questions, sampled_question_ids,
            started_at, completed_at
       FROM quiz_attempts
      WHERE user_id = $1 AND lesson_id = $2
      ORDER BY completed_at DESC NULLS LAST, started_at DESC NULLS LAST
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
  const qRes = await query(
    `SELECT id, question, question_type, question_category, section_number,
            section_label, section_instruction, audio_script, explanation, sort_order
       FROM quiz_questions
      WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  const oRes = await query(
    `SELECT id, question_id, option_text, sort_order
       FROM quiz_options
      WHERE question_id = ANY($1::uuid[])
      ORDER BY sort_order ASC`,
    [ids]
  );
  const optsByQ = {};
  for (const o of oRes.rows) {
    (optsByQ[o.question_id] ||= []).push(o);
  }
  // Preserve ID order = sampled order (after shuffle).
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
router.post('/progress/lesson/:lessonId/quiz/start', asyncHandler(async (req, res) => {
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

  // Cooldown — kasih info hasil terakhir + waktu next attempt.
  if (!status.canAttempt) {
    return res.status(429).json({
      blocked: true,
      reason: 'cooldown',
      cooldownHours,
      cooldownHoursLeft: status.cooldownHoursLeft,
      nextAttemptAt: status.nextAttemptAt,
      lastAttempt: status.lastAttempt,
      passingScorePct,
    });
  }

  // Resume — kasih attempt yang sama (sampled soal sama, attempt_token sama).
  if (status.inProgress) {
    const ip = status.inProgress;
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

  // Sample baru.
  const idsRes = await query(
    `SELECT id FROM quiz_questions WHERE lesson_id = $1`,
    [lessonId]
  );
  const allIds = idsRes.rows.map((r) => r.id);
  if (allIds.length === 0) return res.status(404).json({ error: 'Lesson has no quiz questions' });

  const sampledIds = sampleQuestionIds(allIds, lesson.questions_per_attempt);
  const questions = await loadQuestionsByIds(sampledIds);

  const insertRes = await query(
    `INSERT INTO quiz_attempts (user_id, lesson_id, attempt_token, sampled_question_ids, started_at)
     VALUES ($1, $2, gen_random_uuid(), $3::jsonb, NOW())
     RETURNING attempt_token, started_at`,
    [req.user.id, lessonId, JSON.stringify(sampledIds)]
  );
  const { attempt_token: attemptToken, started_at: startedAt } = insertRes.rows[0];
  const expiresAt = new Date(new Date(startedAt).getTime() + ATTEMPT_RESUME_MINUTES * 60000).toISOString();

  res.json({
    attemptToken,
    questions,
    passingScorePct,
    totalQuestions: questions.length,
    poolSize: allIds.length,
    expiresAt,
  });
}));

// POST /api/progress/lesson/:lessonId/quiz-attempt
// Submit attempt. Body: { attemptToken, answers: [{ questionId, optionId }] }
// Update row existing (yang dibuat di /quiz/start) — bukan INSERT baru.
// Compute passed = (score/total)*100 >= passing_score_pct. Return next
// attempt window.
router.post('/progress/lesson/:lessonId/quiz-attempt', asyncHandler(async (req, res) => {
  const lessonId = req.params.lessonId;
  const { attemptToken } = req.body || {};
  const rawAnswers = Array.isArray(req.body?.answers) ? req.body.answers : [];
  if (!attemptToken) return res.status(400).json({ error: 'attemptToken required' });

  const attemptRes = await query(
    `SELECT id, sampled_question_ids, started_at, completed_at, score
       FROM quiz_attempts
      WHERE user_id = $1 AND lesson_id = $2 AND attempt_token = $3
      LIMIT 1`,
    [req.user.id, lessonId, attemptToken]
  );
  if (attemptRes.rows.length === 0) {
    return res.status(404).json({ error: 'attempt_not_found' });
  }
  const attempt = attemptRes.rows[0];
  if (attempt.completed_at && attempt.score !== null) {
    return res.status(409).json({ error: 'already_submitted' });
  }

  const sampledIds = Array.isArray(attempt.sampled_question_ids) ? attempt.sampled_question_ids : [];
  const sampledSet = new Set(sampledIds);

  const lessonRow = await query(
    `SELECT passing_score_pct, cooldown_hours FROM lessons WHERE id = $1 LIMIT 1`,
    [lessonId]
  );
  const passingScorePct = lessonRow.rows[0]?.passing_score_pct ?? 70;
  const cooldownHours = lessonRow.rows[0]?.cooldown_hours ?? 12;

  const rows = await query(
    `SELECT q.id AS question_id, o.id AS option_id, o.is_correct
       FROM quiz_questions q
       LEFT JOIN quiz_options o ON o.question_id = q.id
      WHERE q.id = ANY($1::uuid[])`,
    [sampledIds]
  );

  const optionLookup = new Map();
  const questionIds = new Set();
  for (const r of rows.rows) {
    questionIds.add(r.question_id);
    if (r.option_id) {
      optionLookup.set(r.option_id, {
        questionId: r.question_id,
        isCorrect: !!r.is_correct,
      });
    }
  }
  const total = sampledIds.length || questionIds.size;
  const correctByQuestion = {};
  for (const qid of sampledIds) correctByQuestion[qid] = false;

  for (const a of rawAnswers) {
    if (!sampledSet.has(a?.questionId)) continue;
    const opt = optionLookup.get(a?.optionId);
    if (!opt) continue;
    if (opt.questionId !== a.questionId) continue;
    if (opt.isCorrect) correctByQuestion[opt.questionId] = true;
  }
  const score = Object.values(correctByQuestion).filter(Boolean).length;
  const pct = total > 0 ? (score / total) * 100 : 0;
  const passed = pct >= passingScorePct;

  await query(
    `UPDATE quiz_attempts
        SET score = $1, total_questions = $2, completed_at = NOW()
      WHERE id = $3`,
    [score, total, attempt.id]
  );

  const nextAttemptAt = new Date(Date.now() + cooldownHours * 3600 * 1000).toISOString();
  res.json({
    score, total, correctByQuestion,
    passingScorePct, passed,
    cooldownHours, nextAttemptAt,
  });
}));

// GET /api/progress/lesson/:lessonId/quiz-status
// Cooldown + last attempt info, dipakai welcome.html quiz landing.
router.get('/progress/lesson/:lessonId/quiz-status', asyncHandler(async (req, res) => {
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
router.put('/progress/lesson/:lessonId/note', asyncHandler(async (req, res) => {
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
router.post('/enrollments', asyncHandler(async (req, res) => {
  const { courseSlug, courseId } = req.body || {};
  if (!courseSlug && !courseId) {
    return res.status(400).json({ error: 'courseSlug or courseId required' });
  }

  const lookup = courseId
    ? await query(`SELECT id, is_published, is_available FROM courses WHERE id = $1`, [courseId])
    : await query(`SELECT id, is_published, is_available FROM courses WHERE slug = $1`, [courseSlug]);

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

  const ins = await query(
    `INSERT INTO user_enrollments (user_id, course_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, course_id) DO NOTHING
     RETURNING id`,
    [req.user.id, course.id]
  );
  res.json({ ok: true, alreadyEnrolled: ins.rows.length === 0, courseId: course.id });
}));

// GET /api/enrollments/me
// Admins get implicit access to every published course so they can preview
// content and test the enrolled UX without needing a real enrollment row.
// Useful while there's no payment gateway yet and admins need to inspect
// student-side flows repeatedly.
router.get('/enrollments/me', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT c.id, c.slug, c.title, c.description, c.level, c.thumbnail_url, e.enrolled_at
     FROM user_enrollments e
     JOIN courses c ON c.id = e.course_id
     WHERE e.user_id = $1
     ORDER BY e.enrolled_at DESC`,
    [req.user.id]
  );

  if (isAdminEmail(req.user.email)) {
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
