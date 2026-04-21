import { Router } from 'express';
import { query } from '../db.js';
import { asyncHandler } from '../middleware.js';

const router = Router();

// GET /api/courses — list published courses (public)
router.get('/courses', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, slug, title, description, level, thumbnail_url, sort_order,
            price_idr, price_label, period_label, tagline, features, cta_label, is_featured
     FROM courses
     WHERE is_published = TRUE
     ORDER BY sort_order ASC, created_at ASC`
  );
  res.json({ courses: result.rows });
}));

// GET /api/courses/:slug — course detail with modules + lessons (public)
router.get('/courses/:slug', asyncHandler(async (req, res) => {
  const course = await query(
    `SELECT id, slug, title, description, level, thumbnail_url
     FROM courses
     WHERE slug = $1 AND is_published = TRUE
     LIMIT 1`,
    [req.params.slug]
  );
  if (course.rows.length === 0) return res.status(404).json({ error: 'Course not found' });

  const modules = await query(
    `SELECT id, slug, title, description, sort_order
     FROM modules
     WHERE course_id = $1
     ORDER BY sort_order ASC, created_at ASC`,
    [course.rows[0].id]
  );

  const moduleIds = modules.rows.map((m) => m.id);
  let lessonsByModule = {};
  if (moduleIds.length > 0) {
    const lessons = await query(
      `SELECT id, module_id, slug, title, type, duration_minutes, sort_order
       FROM lessons
       WHERE module_id = ANY($1::uuid[])
       ORDER BY sort_order ASC, created_at ASC`,
      [moduleIds]
    );
    for (const l of lessons.rows) {
      if (!lessonsByModule[l.module_id]) lessonsByModule[l.module_id] = [];
      lessonsByModule[l.module_id].push(l);
    }
  }

  res.json({
    course: {
      ...course.rows[0],
      modules: modules.rows.map((m) => ({
        ...m,
        lessons: lessonsByModule[m.id] || [],
      })),
    },
  });
}));

// GET /api/lessons/:id — single lesson with content + quiz (public read)
router.get('/lessons/:id', asyncHandler(async (req, res) => {
  const lesson = await query(
    `SELECT l.*, m.course_id, m.title AS module_title, c.slug AS course_slug
     FROM lessons l
     JOIN modules m ON m.id = l.module_id
     JOIN courses c ON c.id = m.course_id
     WHERE l.id = $1 AND c.is_published = TRUE
     LIMIT 1`,
    [req.params.id]
  );
  if (lesson.rows.length === 0) return res.status(404).json({ error: 'Lesson not found' });

  const row = lesson.rows[0];
  const response = {
    id: row.id,
    moduleId: row.module_id,
    slug: row.slug,
    title: row.title,
    type: row.type,
    content: row.content,
    videoUrl: row.video_url,
    durationMinutes: row.duration_minutes,
  };

  if (row.type === 'quiz') {
    const questions = await query(
      `SELECT id, question, question_type, sort_order
       FROM quiz_questions
       WHERE lesson_id = $1
       ORDER BY sort_order ASC`,
      [row.id]
    );
    const qIds = questions.rows.map((q) => q.id);
    let optsByQ = {};
    if (qIds.length > 0) {
      // Intentionally do NOT expose is_correct here — client shouldn't know answers.
      const opts = await query(
        `SELECT id, question_id, option_text, sort_order
         FROM quiz_options
         WHERE question_id = ANY($1::uuid[])
         ORDER BY sort_order ASC`,
        [qIds]
      );
      for (const o of opts.rows) {
        if (!optsByQ[o.question_id]) optsByQ[o.question_id] = [];
        optsByQ[o.question_id].push(o);
      }
    }
    response.questions = questions.rows.map((q) => ({
      ...q,
      options: optsByQ[q.id] || [],
    }));
  }

  res.json({ lesson: response });
}));

// GET /api/sensei — public list of published sensei
router.get('/sensei', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, name, title, bio, tags, photo_url, sort_order
     FROM sensei
     WHERE is_published = TRUE
     ORDER BY sort_order ASC, created_at ASC`
  );
  res.json({ sensei: result.rows });
}));

// GET /api/testimonials — public list of published testimonials
router.get('/testimonials', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, name, location, occupation, photo_url, quote, course_slug, sort_order
     FROM testimonials
     WHERE is_published = TRUE
     ORDER BY sort_order ASC, created_at ASC`
  );
  res.json({ testimonials: result.rows });
}));

export default router;
