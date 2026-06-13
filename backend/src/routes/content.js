import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { asyncHandler } from '../middleware.js';
import { loadCourseVocab, deriveCompounds } from '../kanji-compounds.js';

const router = Router();

// Per-IP throttle on quiz/check. Each option click sends one request, so a
// real student doing a 10-question quiz uses ~10 hits. 60/min leaves headroom
// for retries while making brute-forcing all options across many questions
// noisy enough to notice in logs.
const quizCheckLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down' },
});

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
            jf_topic, cefr_level, title_en, scenario, section_name,
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
  const deckByLesson = {};
  const kanjiByLesson = {};
  const grammarTaskByLesson = {};

  if (moduleIds.length > 0) {
    // Include content + video_url so the dashboard can render lesson bodies
    // without an extra round-trip per lesson. Quiz questions are still
    // lazy-loaded via /api/lessons/:id (smaller default payload for long courses).
    const [lessons, vocab, grammar] = await Promise.all([
      query(
        `SELECT id, module_id, slug, title, type, content, video_url, duration_minutes, sort_order, popup_after_lesson_id
         FROM lessons WHERE module_id = ANY($1::uuid[])
         ORDER BY sort_order ASC, created_at ASC`,
        [moduleIds]
      ),
      query(
        `SELECT id, module_id, lesson_id, japanese, reading, romaji, indonesian, category, note, sort_order
         FROM module_vocabulary WHERE module_id = ANY($1::uuid[])
         ORDER BY sort_order ASC, created_at ASC`,
        [moduleIds]
      ),
      query(
        `SELECT id, module_id, lesson_id, pattern, meaning, example, notes, example_dialog, example_dialog_id, sort_order
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
    // Pre-fetch multi contoh grammar untuk semua pola di module (mirror
    // vocabulary_examples). Index by grammar_id → array of examples.
    const grammarIds = grammar.rows.map((g) => g.id);
    const grammarExamplesByGrammar = {};
    if (grammarIds.length > 0) {
      const gexRes = await query(
        `SELECT grammar_id, japanese, highlight, indonesian, sort_order
         FROM grammar_examples WHERE grammar_id = ANY($1::uuid[])
         ORDER BY sort_order ASC, created_at ASC`,
        [grammarIds]
      );
      for (const e of gexRes.rows) {
        (grammarExamplesByGrammar[e.grammar_id] ||= []).push(e);
      }
    }
    for (const g of grammar.rows) {
      g.examples = grammarExamplesByGrammar[g.id] || [];
      (grammarByModule[g.module_id] ||= []).push(g);
      if (g.lesson_id) (grammarByLesson[g.lesson_id] ||= []).push(g);
    }

    // Deck lessons: pull their picked vocab items (+ example sentences) so the
    // dashboard can render the interactive deck without extra round-trips.
    const deckLessonIds = lessons.rows.filter((l) => l.type === 'deck').map((l) => l.id);
    if (deckLessonIds.length > 0) {
      const deckRows = await query(
        `SELECT di.lesson_id, di.sort_order, di.accent_color,
                v.id, v.japanese, v.reading, v.romaji, v.indonesian, v.category
         FROM lesson_deck_items di
         JOIN module_vocabulary v ON v.id = di.vocabulary_id
         WHERE di.lesson_id = ANY($1::uuid[])
         ORDER BY di.lesson_id, di.sort_order ASC, v.japanese ASC`,
        [deckLessonIds]
      );
      const vocabIds = [...new Set(deckRows.rows.map((r) => r.id))];
      const examplesByVocab = {};
      if (vocabIds.length > 0) {
        const ex = await query(
          `SELECT vocabulary_id, japanese, reading, highlight, indonesian, sort_order
           FROM vocabulary_examples WHERE vocabulary_id = ANY($1::uuid[])
           ORDER BY vocabulary_id, sort_order ASC, created_at ASC`,
          [vocabIds]
        );
        for (const e of ex.rows) {
          (examplesByVocab[e.vocabulary_id] ||= []).push({
            japanese: e.japanese, reading: e.reading, highlight: e.highlight, indonesian: e.indonesian,
          });
        }
      }
      for (const r of deckRows.rows) {
        (deckByLesson[r.lesson_id] ||= []).push({
          id: r.id,
          japanese: r.japanese,
          reading: r.reading,
          romaji: r.romaji,
          indonesian: r.indonesian,
          category: r.category,
          accentColor: r.accent_color,
          examples: examplesByVocab[r.id] || [],
        });
      }
    }

    // Kanji-type lessons: pull kanji_items per lesson supaya dashboard
    // bisa render grid kanji tanpa round-trip terpisah (mirror deck).
    const kanjiLessonIds = lessons.rows.filter((l) => l.type === 'kanji').map((l) => l.id);
    if (kanjiLessonIds.length > 0) {
      const kanjiRows = await query(
        `SELECT lesson_id, id, character, jlpt_level, on_reading, kun_reading,
                meaning_id, mnemonic, compounds, stroke_count, bab_kode, sort_order
           FROM kanji_items
          WHERE lesson_id = ANY($1::uuid[])
          ORDER BY lesson_id, sort_order ASC, character ASC`,
        [kanjiLessonIds]
      );
      // Derive contoh kosakata sama seperti "Daftar Kanji" (/api/kanji) supaya
      // kanji yang sama tampil identik di pelajaran & Daftar Kanji.
      const courseVocab = await loadCourseVocab(req.params.slug);
      for (const r of kanjiRows.rows) {
        (kanjiByLesson[r.lesson_id] ||= []).push({
          id: r.id,
          character: r.character,
          jlpt_level: r.jlpt_level,
          on_reading: r.on_reading,
          kun_reading: r.kun_reading,
          meaning_id: r.meaning_id,
          mnemonic: r.mnemonic,
          compounds: deriveCompounds(r.character, r.compounds, courseVocab),
          stroke_count: r.stroke_count,
          bab_kode: r.bab_kode,
        });
      }
    }

    // Grammar-task lessons: pull the grammar points picked into the task so the
    // dashboard can render the speaking task without extra round-trips.
    const grammarTaskLessonIds = lessons.rows.filter((l) => l.type === 'grammar_task').map((l) => l.id);
    if (grammarTaskLessonIds.length > 0) {
      const gtRows = await query(
        `SELECT gi.lesson_id, gi.sort_order, gi.instruction, gi.required_count,
                g.id, g.pattern, g.meaning, g.example, g.notes
         FROM lesson_grammar_task_items gi
         JOIN module_grammar g ON g.id = gi.grammar_id
         WHERE gi.lesson_id = ANY($1::uuid[])
         ORDER BY gi.lesson_id, gi.sort_order ASC, g.sort_order ASC`,
        [grammarTaskLessonIds]
      );
      for (const r of gtRows.rows) {
        (grammarTaskByLesson[r.lesson_id] ||= []).push({
          id: r.id,
          pattern: r.pattern,
          meaning: r.meaning,
          example: r.example,
          notes: r.notes,
          instruction: r.instruction,
          requiredCount: r.required_count,
        });
      }
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
            deck: deckByLesson[l.id] || [],
            kanji: kanjiByLesson[l.id] || [],
            grammarTask: grammarTaskByLesson[l.id] || [],
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
    // Quiz lessons: jangan dump soal. Frontend ambil soal via
    // POST /api/progress/lesson/:id/quiz/start (auth required, mulai attempt).
    // Endpoint ini cuma return metadata + pool size buat card landing.
    const poolRes = await query(
      `SELECT COUNT(*)::int AS n FROM quiz_questions WHERE lesson_id = $1`,
      [row.id]
    );
    response.quizMeta = {
      passingScorePct: row.passing_score_pct ?? 70,
      questionsPerAttempt: row.questions_per_attempt || poolRes.rows[0]?.n || 0,
      cooldownHours: row.cooldown_hours ?? 12,
      poolSize: poolRes.rows[0]?.n || 0,
    };
  }

  if (row.type === 'deck') {
    const deckRows = await query(
      `SELECT di.sort_order, di.accent_color,
              v.id, v.japanese, v.reading, v.romaji, v.indonesian, v.category
       FROM lesson_deck_items di
       JOIN module_vocabulary v ON v.id = di.vocabulary_id
       WHERE di.lesson_id = $1
       ORDER BY di.sort_order ASC, v.japanese ASC`,
      [row.id]
    );
    const vocabIds = deckRows.rows.map((r) => r.id);
    const examplesByVocab = {};
    if (vocabIds.length > 0) {
      const ex = await query(
        `SELECT vocabulary_id, japanese, reading, highlight, indonesian, sort_order
         FROM vocabulary_examples WHERE vocabulary_id = ANY($1::uuid[])
         ORDER BY vocabulary_id, sort_order ASC, created_at ASC`,
        [vocabIds]
      );
      for (const e of ex.rows) {
        (examplesByVocab[e.vocabulary_id] ||= []).push({
          japanese: e.japanese, reading: e.reading, highlight: e.highlight, indonesian: e.indonesian,
        });
      }
    }
    response.deck = deckRows.rows.map((r) => ({
      id: r.id,
      japanese: r.japanese,
      reading: r.reading,
      romaji: r.romaji,
      indonesian: r.indonesian,
      category: r.category,
      accentColor: r.accent_color,
      examples: examplesByVocab[r.id] || [],
    }));
  }

  if (row.type === 'kanji') {
    const kanjiRows = await query(
      `SELECT id, character, jlpt_level, on_reading, kun_reading,
              meaning_id, mnemonic, compounds, stroke_count, bab_kode, sort_order
         FROM kanji_items
        WHERE lesson_id = $1
        ORDER BY sort_order ASC, character ASC`,
      [row.id]
    );
    const courseVocab = await loadCourseVocab(row.course_slug);
    response.kanji = kanjiRows.rows.map((r) => ({
      ...r,
      compounds: deriveCompounds(r.character, r.compounds, courseVocab),
    }));
  }

  if (row.type === 'grammar_task') {
    const gt = await query(
      `SELECT g.id, g.pattern, g.meaning, g.example, g.notes, gi.sort_order,
              gi.instruction, gi.required_count
       FROM lesson_grammar_task_items gi
       JOIN module_grammar g ON g.id = gi.grammar_id
       WHERE gi.lesson_id = $1
       ORDER BY gi.sort_order ASC, g.sort_order ASC`,
      [row.id]
    );
    response.grammarTask = gt.rows.map((r) => ({
      id: r.id, pattern: r.pattern, meaning: r.meaning, example: r.example, notes: r.notes,
      instruction: r.instruction, requiredCount: r.required_count,
    }));
  }

  res.json({ lesson: response });
}));

// POST /api/lessons/:lessonId/quiz/check — per-question feedback.
// Body: { questionId, optionId }
// Returns: { isCorrect, correctOptionId, explanation }
// Stateless — does NOT write to quiz_attempts. The dashboard hits this on
// every option click so the student gets immediate feedback without ever
// receiving the answer key in advance.
router.post('/lessons/:lessonId/quiz/check', quizCheckLimiter, asyncHandler(async (req, res) => {
  const lessonId = req.params.lessonId;
  const { questionId, optionId } = req.body || {};
  if (!questionId || !optionId) {
    return res.status(400).json({ error: 'questionId and optionId required' });
  }

  // Single round-trip: question + all options, scoped to this lesson.
  const rows = await query(
    `SELECT q.explanation, o.id AS option_id, o.is_correct
       FROM quiz_questions q
       LEFT JOIN quiz_options o ON o.question_id = q.id
      WHERE q.lesson_id = $1 AND q.id = $2`,
    [lessonId, questionId]
  );
  if (rows.rows.length === 0) {
    return res.status(404).json({ error: 'Question not found' });
  }

  let correctOptionId = null;
  let chosen = null;
  for (const r of rows.rows) {
    if (r.is_correct) correctOptionId = r.option_id;
    if (r.option_id === optionId) chosen = r;
  }
  if (!chosen) {
    return res.status(400).json({ error: 'Option does not belong to this question' });
  }

  res.json({
    isCorrect: !!chosen.is_correct,
    correctOptionId,
    explanation: rows.rows[0].explanation || '',
  });
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
