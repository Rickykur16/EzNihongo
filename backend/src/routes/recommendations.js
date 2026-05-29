import { Router } from 'express';
import crypto from 'crypto';
import { query } from '../db.js';
import { asyncHandler, requireAuth } from '../middleware.js';
import { callClaude, ANTHROPIC_MODEL, anthropicEnabled } from '../anthropic.js';

// Belajar adaptif — deteksi kelemahan per kategori (vocabulary/grammar/
// listening) dari hasil per-soal (quiz_question_results, diisi handler
// quiz-attempt di progress.js) lalu rekomendasi pelajaran untuk diulang +
// catatan coaching personal dari Maneko-chan (AI, opsional). Lihat
// migration 027 dan CLAUDE.md.

const router = Router();
router.use(requireAuth);

const WEAK_THRESHOLD = 0.70; // akurasi di bawah ini dianggap lemah
const MIN_SAMPLE = 8;        // minimal jumlah soal sebelum menilai sebuah kategori
const LOOKBACK_DAYS = 90;
const MAX_LESSONS = 3;

const CATEGORY_LABEL = {
  vocabulary: 'Kosakata',
  grammar: 'Tata Bahasa',
  listening: 'Menyimak',
};

// System statis (cacheable) — persona Maneko-chan, selaras dengan tutor.js.
const COACH_SYSTEM = `Kamu adalah "Maneko-chan", maskot kucing tutor bahasa Jepang yang ramah, sabar, dan suportif di aplikasi belajar EzNihongo. Muridmu orang Indonesia level pemula (JLPT N5/N4). Balas HANYA dengan teks catatan singkat (tanpa markdown, tanpa salam pembuka), 2-3 kalimat, hangat dan memotivasi.`;

export const COACH_PROMPT_DEFAULT = `Murid bernama {{studentName}} sedang belajar bahasa Jepang.
Dari hasil kuis terakhir, area paling lemahnya adalah: {{weakCategory}} (akurasi {{accuracyPct}}%).
Pelajaran yang disarankan untuk diulang: {{lessonTitles}}.

Tulis catatan singkat (2-3 kalimat) dalam Bahasa Indonesia sebagai Maneko-chan:
akui usahanya, sebut area yang perlu difokuskan, dan dorong dia mengulang
pelajaran itu. Nada positif, tidak menggurui.`;

async function loadCoachPrompt() {
  try {
    const r = await query(`SELECT value FROM app_settings WHERE key = 'coaching_note_prompt'`);
    const v = r.rows[0]?.value;
    return (v && v.trim()) ? v : COACH_PROMPT_DEFAULT;
  } catch {
    return COACH_PROMPT_DEFAULT;
  }
}

function fillTemplate(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_m, k) => (vars[k] != null ? String(vars[k]) : ''));
}

function firstName(full) {
  return String(full || '').trim().split(/\s+/)[0] || 'kamu';
}

// GET /api/recommendations/me — area lemah + pelajaran rekomendasi + catatan AI.
router.get('/recommendations/me', asyncHandler(async (req, res) => {
  // 1. Agregasi akurasi per kategori dalam jendela lookback.
  const agg = await query(
    `SELECT question_category,
            COUNT(*)::int AS attempts,
            SUM((is_correct)::int)::int AS correct
       FROM quiz_question_results
      WHERE user_id = $1 AND created_at > NOW() - make_interval(days => $2::int)
      GROUP BY question_category`,
    [req.user.id, LOOKBACK_DAYS]
  );

  const categories = agg.rows.map((r) => {
    const attempts = r.attempts || 0;
    const correct = r.correct || 0;
    const accuracy = attempts > 0 ? correct / attempts : 0;
    const enough = attempts >= MIN_SAMPLE;
    return {
      category: r.question_category,
      label: CATEGORY_LABEL[r.question_category] || r.question_category,
      attempts,
      correct,
      accuracy: Math.round(accuracy * 100) / 100,
      weak: enough && accuracy < WEAK_THRESHOLD,
      insufficientData: !enough,
    };
  });

  const totalAttempts = categories.reduce((s, c) => s + c.attempts, 0);
  const hasData = totalAttempts > 0;

  // Kategori terlemah = yang ditandai weak dengan akurasi terendah.
  const weakest = categories
    .filter((c) => c.weak)
    .sort((a, b) => a.accuracy - b.accuracy)[0] || null;

  // 2. Pelajaran kandidat untuk kategori terlemah: ter-enroll, memuat soal
  // kategori itu, dan skor terbaik siswa < passing (atau belum pernah).
  let recommendedLessons = [];
  if (weakest) {
    const lr = await query(
      `SELECT l.id, l.slug, l.title,
              m.slug AS module_slug, m.title AS module_title,
              MAX(qa.score::float / NULLIF(qa.total_questions, 0)) AS best_ratio
         FROM lessons l
         JOIN modules m ON m.id = l.module_id
         JOIN user_enrollments e ON e.course_id = m.course_id AND e.user_id = $1
         JOIN quiz_questions qq ON qq.lesson_id = l.id AND qq.question_category = $2
         LEFT JOIN quiz_attempts qa
                ON qa.lesson_id = l.id AND qa.user_id = $1 AND qa.score IS NOT NULL
        GROUP BY l.id, l.slug, l.title, m.slug, m.title
       HAVING COALESCE(MAX(qa.score::float / NULLIF(qa.total_questions, 0)), 0) < $3
        ORDER BY best_ratio ASC NULLS LAST, l.sort_order
        LIMIT $4`,
      [req.user.id, weakest.category, WEAK_THRESHOLD, MAX_LESSONS]
    );
    recommendedLessons = lr.rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      moduleSlug: r.module_slug,
      moduleTitle: r.module_title,
      bestPct: r.best_ratio != null ? Math.round(r.best_ratio * 100) : null,
    }));
  }

  // 3. Catatan coaching (AI kalau tersedia, kalau tidak berbasis-aturan).
  let coachingNote = null;
  let noteSource = null;

  if (weakest) {
    const accuracyPct = Math.round(weakest.accuracy * 100);
    const lessonTitles = recommendedLessons.map((l) => l.title).join(', ')
      || '(belum ada pelajaran khusus)';

    // Weakness signature untuk cache — akurasi di-bucket ke 5% terdekat supaya
    // drift kecil tidak membatalkan cache.
    const bucket = Math.round(accuracyPct / 5) * 5;
    const lessonIdsSig = recommendedLessons.map((l) => l.id).sort().join(',');
    const noteHash = crypto.createHash('sha256')
      .update(`coaching|${ANTHROPIC_MODEL}|${weakest.category}|${bucket}|${lessonIdsSig}`)
      .digest('hex');

    const cached = await query(`SELECT note FROM coaching_note_cache WHERE note_hash = $1`, [noteHash]);
    if (cached.rows.length > 0) {
      query(`UPDATE coaching_note_cache SET last_used_at = NOW() WHERE note_hash = $1`, [noteHash]).catch(() => {});
      coachingNote = cached.rows[0].note;
      noteSource = 'ai';
    } else if (anthropicEnabled()) {
      const userRow = await query(`SELECT full_name FROM users WHERE id = $1`, [req.user.id]);
      const tpl = await loadCoachPrompt();
      const userContent = fillTemplate(tpl, {
        studentName: firstName(userRow.rows[0]?.full_name),
        weakCategory: weakest.label,
        accuracyPct: String(accuracyPct),
        lessonTitles,
      });
      const note = await callClaude({ system: COACH_SYSTEM, userContent, maxTokens: 300 });
      if (note) {
        coachingNote = note.slice(0, 800);
        noteSource = 'ai';
        await query(
          `INSERT INTO coaching_note_cache (note_hash, note, model)
           VALUES ($1, $2, $3) ON CONFLICT (note_hash) DO NOTHING`,
          [noteHash, coachingNote, ANTHROPIC_MODEL]
        );
      }
    }

    // Fallback berbasis-aturan kalau AI nonaktif / gagal (endpoint tidak 503).
    if (!coachingNote) {
      coachingNote = `Latihan ${weakest.label.toLowerCase()}-mu masih ${accuracyPct}%. `
        + (recommendedLessons.length
            ? 'Coba ulangi pelajaran yang disarankan di bawah, ya!'
            : 'Terus berlatih dengan lebih banyak kuis untuk menguatkannya, ya!');
      noteSource = 'rule';
    }
  } else if (hasData) {
    coachingNote = 'Mantap! Semua kategori kuismu sudah di atas target. Pertahankan dan lanjut ke pelajaran berikutnya, ya!';
    noteSource = 'rule';
  }

  res.json({
    hasData,
    categories,
    weakest: weakest ? weakest.category : null,
    recommendedLessons,
    coachingNote,
    noteSource,
  });
}));

export default router;
