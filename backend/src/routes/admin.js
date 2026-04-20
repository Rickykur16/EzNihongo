import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireAdmin, asyncHandler } from '../middleware.js';

const router = Router();

// Every route in this file requires admin
router.use(requireAuth, requireAdmin);

// ===== COURSES =====

router.get('/courses', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT * FROM courses ORDER BY sort_order ASC, created_at ASC`
  );
  res.json({ courses: result.rows });
}));

router.post('/courses', asyncHandler(async (req, res) => {
  const { slug, title, description, level, thumbnailUrl, sortOrder, isPublished } = req.body || {};
  if (!slug || !title) return res.status(400).json({ error: 'slug and title required' });
  const result = await query(
    `INSERT INTO courses (slug, title, description, level, thumbnail_url, sort_order, is_published)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [slug, title, description || null, level || null, thumbnailUrl || null, sortOrder || 0, !!isPublished]
  );
  res.status(201).json({ course: result.rows[0] });
}));

router.put('/courses/:id', asyncHandler(async (req, res) => {
  const { slug, title, description, level, thumbnailUrl, sortOrder, isPublished } = req.body || {};
  const result = await query(
    `UPDATE courses SET
       slug = COALESCE($2, slug),
       title = COALESCE($3, title),
       description = COALESCE($4, description),
       level = COALESCE($5, level),
       thumbnail_url = COALESCE($6, thumbnail_url),
       sort_order = COALESCE($7, sort_order),
       is_published = COALESCE($8, is_published)
     WHERE id = $1 RETURNING *`,
    [req.params.id, slug, title, description, level, thumbnailUrl, sortOrder, isPublished]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ course: result.rows[0] });
}));

router.delete('/courses/:id', asyncHandler(async (req, res) => {
  await query(`DELETE FROM courses WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
}));

// ===== MODULES =====

router.post('/modules', asyncHandler(async (req, res) => {
  const { courseId, slug, title, description, sortOrder } = req.body || {};
  if (!courseId || !slug || !title) {
    return res.status(400).json({ error: 'courseId, slug, title required' });
  }
  const result = await query(
    `INSERT INTO modules (course_id, slug, title, description, sort_order)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [courseId, slug, title, description || null, sortOrder || 0]
  );
  res.status(201).json({ module: result.rows[0] });
}));

router.put('/modules/:id', asyncHandler(async (req, res) => {
  const { slug, title, description, sortOrder } = req.body || {};
  const result = await query(
    `UPDATE modules SET
       slug = COALESCE($2, slug),
       title = COALESCE($3, title),
       description = COALESCE($4, description),
       sort_order = COALESCE($5, sort_order)
     WHERE id = $1 RETURNING *`,
    [req.params.id, slug, title, description, sortOrder]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ module: result.rows[0] });
}));

router.delete('/modules/:id', asyncHandler(async (req, res) => {
  await query(`DELETE FROM modules WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
}));

// ===== LESSONS =====

router.post('/lessons', asyncHandler(async (req, res) => {
  const { moduleId, slug, title, type, content, videoUrl, durationMinutes, sortOrder } = req.body || {};
  if (!moduleId || !slug || !title) {
    return res.status(400).json({ error: 'moduleId, slug, title required' });
  }
  const result = await query(
    `INSERT INTO lessons (module_id, slug, title, type, content, video_url, duration_minutes, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [moduleId, slug, title, type || 'text', content || null, videoUrl || null, durationMinutes || null, sortOrder || 0]
  );
  res.status(201).json({ lesson: result.rows[0] });
}));

router.put('/lessons/:id', asyncHandler(async (req, res) => {
  const { slug, title, type, content, videoUrl, durationMinutes, sortOrder } = req.body || {};
  const result = await query(
    `UPDATE lessons SET
       slug = COALESCE($2, slug),
       title = COALESCE($3, title),
       type = COALESCE($4, type),
       content = COALESCE($5, content),
       video_url = COALESCE($6, video_url),
       duration_minutes = COALESCE($7, duration_minutes),
       sort_order = COALESCE($8, sort_order)
     WHERE id = $1 RETURNING *`,
    [req.params.id, slug, title, type, content, videoUrl, durationMinutes, sortOrder]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ lesson: result.rows[0] });
}));

router.delete('/lessons/:id', asyncHandler(async (req, res) => {
  await query(`DELETE FROM lessons WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
}));

// ===== QUIZ QUESTIONS (with options in one call) =====

router.get('/lessons/:lessonId/quiz', asyncHandler(async (req, res) => {
  const questions = await query(
    `SELECT * FROM quiz_questions WHERE lesson_id = $1 ORDER BY sort_order ASC`,
    [req.params.lessonId]
  );
  const qIds = questions.rows.map((q) => q.id);
  let optsByQ = {};
  if (qIds.length > 0) {
    const opts = await query(
      `SELECT * FROM quiz_options WHERE question_id = ANY($1::uuid[]) ORDER BY sort_order ASC`,
      [qIds]
    );
    for (const o of opts.rows) {
      if (!optsByQ[o.question_id]) optsByQ[o.question_id] = [];
      optsByQ[o.question_id].push(o);
    }
  }
  res.json({
    questions: questions.rows.map((q) => ({ ...q, options: optsByQ[q.id] || [] })),
  });
}));

router.post('/quiz-questions', asyncHandler(async (req, res) => {
  const {
    lessonId, question, questionType, correctAnswer, explanation, sortOrder, options,
  } = req.body || {};
  if (!lessonId || !question) return res.status(400).json({ error: 'lessonId and question required' });

  const qRes = await query(
    `INSERT INTO quiz_questions (lesson_id, question, question_type, correct_answer, explanation, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [lessonId, question, questionType || 'multiple_choice', correctAnswer || null, explanation || null, sortOrder || 0]
  );
  const q = qRes.rows[0];

  if (Array.isArray(options) && options.length > 0) {
    for (let i = 0; i < options.length; i++) {
      const o = options[i];
      await query(
        `INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [q.id, o.text || o.option_text, !!o.isCorrect || !!o.is_correct, i]
      );
    }
  }

  res.status(201).json({ question: q });
}));

router.put('/quiz-questions/:id', asyncHandler(async (req, res) => {
  const { question, questionType, correctAnswer, explanation, sortOrder, options } = req.body || {};
  const result = await query(
    `UPDATE quiz_questions SET
       question = COALESCE($2, question),
       question_type = COALESCE($3, question_type),
       correct_answer = COALESCE($4, correct_answer),
       explanation = COALESCE($5, explanation),
       sort_order = COALESCE($6, sort_order)
     WHERE id = $1 RETURNING *`,
    [req.params.id, question, questionType, correctAnswer, explanation, sortOrder]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

  if (Array.isArray(options)) {
    // Replace options wholesale
    await query(`DELETE FROM quiz_options WHERE question_id = $1`, [req.params.id]);
    for (let i = 0; i < options.length; i++) {
      const o = options[i];
      await query(
        `INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [req.params.id, o.text || o.option_text, !!o.isCorrect || !!o.is_correct, i]
      );
    }
  }

  res.json({ question: result.rows[0] });
}));

router.delete('/quiz-questions/:id', asyncHandler(async (req, res) => {
  await query(`DELETE FROM quiz_questions WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
}));

// ===== USERS (admin view only) =====

router.get('/users', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT u.id, u.email, u.full_name, u.google_name, u.avatar_url, u.created_at,
            COALESCE(s.xp, 0) AS xp, COALESCE(s.streak_days, 0) AS streak_days,
            COALESCE(s.total_lessons_completed, 0) AS total_lessons_completed,
            s.last_active_date
     FROM users u
     LEFT JOIN user_stats s ON s.user_id = u.id
     ORDER BY u.created_at DESC
     LIMIT 500`
  );
  res.json({ users: result.rows });
}));

// ===== DISCUSSIONS (admin moderation) =====

router.get('/discussions', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT d.id, d.lesson_id, d.parent_id, d.content, d.is_admin_reply, d.is_deleted,
            d.created_at, d.user_id, u.full_name, u.email, u.avatar_url,
            l.title AS lesson_title
     FROM discussions d
     JOIN users u ON u.id = d.user_id
     JOIN lessons l ON l.id = d.lesson_id
     ORDER BY d.created_at DESC
     LIMIT 200`
  );
  res.json({ discussions: result.rows });
}));

export default router;
