import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, asyncHandler } from '../middleware.js';

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
router.get('/stats/me', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT xp, level, streak_days, last_active_date,
            total_lessons_completed, total_minutes_learned
     FROM user_stats WHERE user_id = $1 LIMIT 1`,
    [req.user.id]
  );
  res.json({ stats: result.rows[0] || {
    xp: 0, level: 1, streak_days: 0, last_active_date: null,
    total_lessons_completed: 0, total_minutes_learned: 0,
  } });
}));

// POST /api/enrollments
router.post('/enrollments', asyncHandler(async (req, res) => {
  const { courseId } = req.body || {};
  if (!courseId) return res.status(400).json({ error: 'courseId required' });
  await query(
    `INSERT INTO user_enrollments (user_id, course_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [req.user.id, courseId]
  );
  res.json({ ok: true });
}));

// GET /api/enrollments/me
router.get('/enrollments/me', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT c.id, c.slug, c.title, c.description, c.level, c.thumbnail_url, e.enrolled_at
     FROM user_enrollments e
     JOIN courses c ON c.id = e.course_id
     WHERE e.user_id = $1
     ORDER BY e.enrolled_at DESC`,
    [req.user.id]
  );
  res.json({ enrollments: result.rows });
}));

export default router;
