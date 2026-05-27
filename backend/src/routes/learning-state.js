import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, asyncHandler } from '../middleware.js';

const router = Router();
router.use(requireAuth);

// GET /api/learning-state — one row per user: { progress, quizScores, updatedAt }
// Mirror dari kanji-progress.js, tapi untuk main site (realm `users`).
// Progres main site di-key dengan slug "<moduleId>:<lessonId>" di frontend,
// jadi disimpan apa adanya sebagai blob (bukan tabel relational user_progress).
router.get('/', asyncHandler(async (req, res) => {
  const row = await query(
    `SELECT progress, quiz_scores, updated_at
     FROM user_learning_state WHERE user_id = $1 LIMIT 1`,
    [req.user.id]
  );
  const data = row.rows[0];
  res.json({
    progress: data?.progress || {},
    quizScores: data?.quiz_scores || {},
    updatedAt: data?.updated_at || null,
  });
}));

// PUT /api/learning-state — upsert full blob.
// Body: { progress: object, quizScores: object }
// Client sudah merge local+cloud (union) lalu tulis balik, sama seperti flow
// kanji_progress.
router.put('/', asyncHandler(async (req, res) => {
  const progress = req.body?.progress && typeof req.body.progress === 'object' && !Array.isArray(req.body.progress)
    ? req.body.progress : {};
  const quizScores = req.body?.quizScores && typeof req.body.quizScores === 'object' && !Array.isArray(req.body.quizScores)
    ? req.body.quizScores : {};

  // Cap ukuran — completion map + skor kuis untuk satu user harusnya jauh di
  // bawah 1MB; >2MB berarti ada yang salah (storage bug / abuse).
  const approxBytes = JSON.stringify({ progress, quizScores }).length;
  if (approxBytes > 2_000_000) {
    return res.status(413).json({ error: 'payload_too_large' });
  }

  await query(
    `INSERT INTO user_learning_state (user_id, progress, quiz_scores)
     VALUES ($1, $2::jsonb, $3::jsonb)
     ON CONFLICT (user_id) DO UPDATE
       SET progress = EXCLUDED.progress,
           quiz_scores = EXCLUDED.quiz_scores,
           updated_at = NOW()`,
    [req.user.id, JSON.stringify(progress), JSON.stringify(quizScores)]
  );

  res.json({ ok: true });
}));

export default router;
