import { Router } from 'express';
import { query } from '../db.js';
import { asyncHandler } from '../middleware.js';

const router = Router();

// GET /api/courses — list published courses (public)
router.get('/courses', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, slug, title, description, level, thumbnail_url, sort_order,
            price_idr, price_label, period_label, tagline, features, cta_label,
            is_featured, is_available
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
    `SELECT id, slug, title, description, sort_order,
            jf_topic, cefr_level, title_en, scenario,
            cando_statements, skill_distribution, quiz_spec
     FROM modules
     WHERE course_id = $1
     ORDER BY sort_order ASC, created_at ASC`,
    [course.rows[0].id]
  );

  const moduleIds = modules.rows.map((m) => m.id);
  const lessonsByModule = {};
  const vocabByModule = {};
  const vocabByLesson = {};
  const grammarByModule = {};
  const grammarByLesson = {};

  if (moduleIds.length > 0) {
    // Include content + video_url so the dashboard can render lesson bodies
    // without an extra round-trip per lesson. Quiz questions are still
    // lazy-loaded via /api/lessons/:id (smaller default payload for long courses).
    const [lessons, vocab, grammar] = await Promise.all([
      query(
        `SELECT id, module_id, slug, title, type, content, video_url, duration_minutes, sort_order
         FROM lessons WHERE module_id = ANY($1::uuid[])
         ORDER BY sort_order ASC, created_at ASC`,
        [moduleIds]
      ),
      query(
        `SELECT id, module_id, lesson_id, japanese, reading, indonesian, category, note, sort_order
         FROM module_vocabulary WHERE module_id = ANY($1::uuid[])
         ORDER BY sort_order ASC, created_at ASC`,
        [moduleIds]
      ),
      query(
        `SELECT id, module_id, lesson_id, pattern, meaning, example, notes, sort_order
         FROM module_grammar WHERE module_id = ANY($1::uuid[])
         ORDER BY sort_order ASC, created_at ASC`,
        [moduleIds]
      ),
    ]);
    for (const l of lessons.rows) {
      (lessonsByModule[l.module_id] ||= []).push(l);
    }
    // Durasi modul = sum dari lesson.duration_minutes. Dihitung di sini (bukan
    // SUM() di SQL) karena kita sudah fetch lessons; hindari round-trip ekstra.
    for (const v of vocab.rows) {
      (vocabByModule[v.module_id] ||= []).push(v);
      if (v.lesson_id) (vocabByLesson[v.lesson_id] ||= []).push(v);
    }
    for (const g of grammar.rows) {
      (grammarByModule[g.module_id] ||= []).push(g);
      if (g.lesson_id) (grammarByLesson[g.lesson_id] ||= []).push(g);
    }
  }

  res.json({
    course: {
      ...course.rows[0],
      modules: modules.rows.map((m) => {
        const mLessons = lessonsByModule[m.id] || [];
        const totalMinutes = mLessons.reduce(
          (sum, l) => sum + (Number(l.duration_minutes) || 0), 0
        );
        return {
          ...m,
          total_minutes: totalMinutes || null,
          lessons: mLessons.map((l) => ({
            ...l,
            vocabulary: vocabByLesson[l.id] || [],
            grammar: grammarByLesson[l.id] || [],
          })),
          vocabulary: vocabByModule[m.id] || [],
          grammar: grammarByModule[m.id] || [],
        };
      }),
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
      `SELECT id, question, question_type, explanation, sort_order
       FROM quiz_questions
       WHERE lesson_id = $1
       ORDER BY sort_order ASC`,
      [row.id]
    );
    const qIds = questions.rows.map((q) => q.id);
    let optsByQ = {};
    if (qIds.length > 0) {
      // is_correct is exposed on purpose: the dashboard grades client-side
      // (same as the static data/quizzes.json we're replacing), so parity
      // matters. Once we add server-side scoring / attempts, strip this and
      // add POST /api/quiz-check instead.
      const opts = await query(
        `SELECT id, question_id, option_text, is_correct, sort_order
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
    `SELECT id, name, title, bio, tags, photo_url, photo_position, sort_order
     FROM sensei
     WHERE is_published = TRUE
     ORDER BY sort_order ASC, created_at ASC`
  );
  res.json({ sensei: result.rows });
}));

// GET /api/testimonials — public list of published testimonials
router.get('/testimonials', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, name, location, occupation, photo_url, photo_position, quote, course_slug, sort_order
     FROM testimonials
     WHERE is_published = TRUE
     ORDER BY sort_order ASC, created_at ASC`
  );
  res.json({ testimonials: result.rows });
}));

export default router;
