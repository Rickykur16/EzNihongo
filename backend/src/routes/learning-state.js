import { Router } from 'express';
import { query, withAdvisoryLock } from '../db.js';
import { requireAuth, asyncHandler } from '../middleware.js';
import { mergeBestQuizScores, mergeCompletionProgress, mergeCurrentLessonProgress } from '../learning-foundations.js';
import { reconcileLegacyProgress } from '../progress-service.js';

const router = Router();
router.use(requireAuth);

// GET /api/learning-state — slug-keyed cache used by the lesson page.
// Legacy/device flags live in user_learning_state. Only keys that still map to
// the current lesson catalog are returned, with canonical relational
// user_progress completions overlaid so Dashboard and Belajar agree.
router.get('/', asyncHandler(async (req, res) => {
  const [row, catalog] = await Promise.all([
    query(
      `SELECT progress, quiz_scores, updated_at
       FROM user_learning_state WHERE user_id = $1 LIMIT 1`,
      [req.user.id]
    ),
    query(
      `SELECT c.slug AS course_slug, m.slug AS module_slug, l.slug AS lesson_slug,
              COALESCE(p.completed, FALSE) AS completed
         FROM lessons l
         JOIN modules m ON m.id = l.module_id
         JOIN courses c ON c.id = m.course_id
         LEFT JOIN user_progress p ON p.lesson_id = l.id AND p.user_id = $1`,
      [req.user.id]
    ),
  ]);
  const data = row.rows[0];
  res.json({
    progress: mergeCurrentLessonProgress(data?.progress || {}, catalog.rows),
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

  // Merge + relational reconciliation share one user-scoped transaction.
  // A stale phone can never erase progress or a better quiz score from a
  // second device, and Dashboard never depends on a device-local blob.
  const outcome = await withAdvisoryLock(
    `progress-reconcile:${req.user.id}`,
    async (client) => {
      const current = await client.query(
        `SELECT progress, quiz_scores FROM user_learning_state WHERE user_id = $1 LIMIT 1`,
        [req.user.id]
      );
      const mergedProgress = mergeCompletionProgress(current.rows[0]?.progress || {}, progress);
      const mergedQuizScores = mergeBestQuizScores(current.rows[0]?.quiz_scores || {}, quizScores);
      const catalog = await client.query(
        `SELECT c.slug AS course_slug, m.slug AS module_slug, l.slug AS lesson_slug,
                COALESCE(p.completed, FALSE) AS completed
           FROM lessons l
           JOIN modules m ON m.id = l.module_id
           JOIN courses c ON c.id = m.course_id
           LEFT JOIN user_progress p ON p.lesson_id = l.id AND p.user_id = $1`,
        [req.user.id]
      );
      const currentProgress = mergeCurrentLessonProgress(mergedProgress, catalog.rows);
      await client.query(
        `INSERT INTO user_learning_state (user_id, progress, quiz_scores)
         VALUES ($1, $2::jsonb, $3::jsonb)
         ON CONFLICT (user_id) DO UPDATE
           SET progress = EXCLUDED.progress,
               quiz_scores = EXCLUDED.quiz_scores,
               updated_at = NOW()`,
        [req.user.id, JSON.stringify(currentProgress), JSON.stringify(mergedQuizScores)]
      );
      const reconciliation = await reconcileLegacyProgress(client, req.user.id);
      return { reconciliation };
    }
  );

  res.json({ ok: true, ...outcome });
}));

export default router;
