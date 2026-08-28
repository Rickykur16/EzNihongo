// Analisis belajar Bunpou — sisi BACA. Sisi tulis ada di routes/grammar-task.js
// (penilaian kalimat + pencatatan percobaan) dan routes/progress.js (soal kuis
// yang ditautkan ke pola). Model penguasaannya sendiri di grammar-mastery.js.
//
// Dipakai strip "Pemahaman Bunpou" di halaman Tata Bahasa (welcome.html) dan
// daftar pola terlemah di panel "Fokus belajarmu".

import { Router } from 'express';
import { query } from '../db.js';
import { asyncHandler, requireAuth } from '../middleware.js';
import { requireLessonCourseAccess } from '../entitlements.js';
import {
  loadMastery, summarize, focusSentence, STATE_LABEL, MIN_ATTEMPTS_FOR_SCORE,
} from '../grammar-mastery.js';

const router = Router();
router.use(requireAuth);

// Pola grammar milik satu pelajaran. Sengaja UNION dua jalur, bukan cabang
// berdasarkan `lessons.type`: pola bisa menempel lewat module_grammar.lesson_id
// (pelajaran Tata Bahasa) ATAU lewat lesson_grammar_task_items (Tugas Bunpou),
// dan tipe pelajarannya tidak bisa dipercaya sebagai penanda — migration 099
// sudah mengubah 18 pelajaran Tata Bahasa Bab 12-20 dari 'text' jadi 'video'
// tanpa mengubah relasi grammar-nya sama sekali.
async function conceptsForLesson(lessonId) {
  // LEFT JOIN + OR, bukan UNION dua cabang: PK (lesson_id, grammar_id) menjamin
  // paling banyak satu baris join, jadi pola yang muncul di kedua jalur tidak
  // terduplikasi dan urutannya tetap mengikuti urutan tugas kalau ada.
  const r = await query(
    `SELECT g.id, g.pattern, g.meaning,
            COALESCE(gi.sort_order, g.sort_order) AS sort_order
       FROM module_grammar g
       LEFT JOIN lesson_grammar_task_items gi
              ON gi.grammar_id = g.id AND gi.lesson_id = $1
      WHERE g.lesson_id = $1 OR gi.lesson_id IS NOT NULL
      ORDER BY sort_order ASC NULLS LAST, g.pattern ASC`,
    [lessonId]
  );
  return r.rows;
}

// Tugas Bunpou tempat sebuah pola bisa dilatih ("Latihan sekarang"). Satu pola
// bisa dipakai di beberapa tugas — ambil yang paling awal supaya deep-link-nya
// stabil antar render.
async function practiceTargets(grammarIds) {
  const map = new Map();
  if (!grammarIds.length) return map;
  const r = await query(
    `SELECT DISTINCT ON (gi.grammar_id)
            gi.grammar_id, l.id AS lesson_id, l.slug AS lesson_slug, l.title,
            m.slug AS module_slug
       FROM lesson_grammar_task_items gi
       JOIN lessons l ON l.id = gi.lesson_id
       JOIN modules m ON m.id = l.module_id
      WHERE gi.grammar_id = ANY($1::uuid[])
      ORDER BY gi.grammar_id, m.sort_order ASC, l.sort_order ASC`,
    [grammarIds]
  );
  for (const row of r.rows) {
    map.set(row.grammar_id, {
      lessonId: row.lesson_id,
      lessonSlug: row.lesson_slug,
      moduleSlug: row.module_slug,
      title: row.title,
    });
  }
  return map;
}

function conceptPayload(row, mastery, practice) {
  return {
    grammarId: row.id,
    pattern: row.pattern,
    meaning: row.meaning,
    state: mastery.state,
    stateLabel: STATE_LABEL[mastery.state] || mastery.state,
    // null di bawah MIN_ATTEMPTS_FOR_SCORE percobaan — frontend tidak punya
    // angka untuk dirender, jadi tidak bisa mengklaim penguasaan terlalu dini.
    score: mastery.score,
    attempts: mastery.attempts,
    productionAttempts: mastery.productionAttempts,
    recognitionAttempts: mastery.recognitionAttempts,
    lastAttemptAt: mastery.lastAttemptAt,
    dueReview: mastery.dueReview,
    practice: practice || null,
  };
}

// GET /api/grammar/mastery/lesson/:lessonId
// Ringkasan + per-pola untuk strip "Pemahaman Bunpou" di halaman pelajaran.
router.get('/grammar/mastery/lesson/:lessonId', requireLessonCourseAccess('lessonId'),
  asyncHandler(async (req, res) => {
    const rows = await conceptsForLesson(req.params.lessonId);
    if (rows.length === 0) {
      return res.json({
        lessonId: req.params.lessonId, concepts: [], summary: null, focus: null,
        minAttemptsForScore: MIN_ATTEMPTS_FOR_SCORE,
      });
    }

    const ids = rows.map((r) => r.id);
    const [mastery, practice] = await Promise.all([
      loadMastery(req.user.id, ids),
      practiceTargets(ids),
    ]);

    const entries = rows.map((row) => ({ row, mastery: mastery.get(row.id) }));
    const concepts = entries.map((e) => conceptPayload(e.row, e.mastery, practice.get(e.row.id)));
    const summary = summarize(entries);

    // Satu fokus saja, bukan daftar keluhan: yang paling lemah dulu, baru yang
    // sudah lama tidak disentuh, baru yang datanya belum cukup.
    const pick = entries
      .filter((e) => e.mastery.state === 'NEEDS_PRACTICE')
      .sort((a, b) => (a.mastery.score ?? 0) - (b.mastery.score ?? 0))[0]
      || entries.filter((e) => e.mastery.dueReview)[0]
      || null;

    let focus = null;
    if (pick) {
      focus = {
        grammarId: pick.row.id,
        pattern: pick.row.pattern,
        message: focusSentence(pick.row.pattern, pick.mastery, pick.mastery.dominantError),
        practice: practice.get(pick.row.id) || null,
      };
    }

    res.json({
      lessonId: req.params.lessonId,
      concepts, summary, focus,
      minAttemptsForScore: MIN_ATTEMPTS_FOR_SCORE,
    });
  })
);

// GET /api/grammar/mastery/me?limit=3 — pola terlemah lintas pelajaran, untuk
// panel "Fokus belajarmu" di dashboard. Hanya melihat pola yang siswa memang
// pernah sentuh (tanpa percobaan tidak ada yang bisa disimpulkan).
router.get('/grammar/mastery/me', asyncHandler(async (req, res) => {
  const limit = Math.min(10, Math.max(1, Number(req.query.limit) || 3));

  const seen = await query(
    `SELECT DISTINCT grammar_id FROM (
        SELECT grammar_id FROM grammar_attempts
         WHERE user_id = $1 AND created_at > NOW() - INTERVAL '180 days'
        UNION ALL
        SELECT grammar_id FROM quiz_question_results
         WHERE user_id = $1 AND grammar_id IS NOT NULL
           AND created_at > NOW() - INTERVAL '180 days'
     ) t WHERE grammar_id IS NOT NULL`,
    [req.user.id]
  );
  const ids = seen.rows.map((r) => r.grammar_id);
  if (ids.length === 0) return res.json({ hasData: false, weakConcepts: [], summary: null });

  const meta = await query(
    `SELECT id, pattern, meaning, sort_order FROM module_grammar WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  const [mastery, practice] = await Promise.all([
    loadMastery(req.user.id, ids),
    practiceTargets(ids),
  ]);

  const entries = meta.rows.map((row) => ({ row, mastery: mastery.get(row.id) }));
  const weak = entries
    .filter((e) => e.mastery.state === 'NEEDS_PRACTICE' || e.mastery.dueReview)
    .sort((a, b) => {
      // Yang benar-benar lemah lebih dulu daripada yang sekadar perlu diulang.
      const rank = (e) => (e.mastery.state === 'NEEDS_PRACTICE' ? 0 : 1);
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      return (a.mastery.score ?? 100) - (b.mastery.score ?? 100);
    })
    .slice(0, limit)
    .map((e) => ({
      ...conceptPayload(e.row, e.mastery, practice.get(e.row.id)),
      message: focusSentence(e.row.pattern, e.mastery, e.mastery.dominantError),
    }));

  res.json({
    hasData: true,
    weakConcepts: weak,
    summary: summarize(entries),
    minAttemptsForScore: MIN_ATTEMPTS_FOR_SCORE,
  });
}));

export default router;
