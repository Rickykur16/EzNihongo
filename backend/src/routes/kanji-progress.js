import { Router } from 'express';
import { query } from '../db.js';
import { asyncHandler } from '../middleware.js';
import { requireKanjiAuth } from '../kanji-middleware.js';

const router = Router();
router.use(requireKanjiAuth);

// GET /api/kanji-progress — one row per user: { known_kanji, fsrs_data, updated_at }
// Replaces the Supabase `user_progress` blob read in app/kanji.html.
router.get('/', asyncHandler(async (req, res) => {
  const row = await query(
    `SELECT known_kanji, fsrs_data, updated_at
     FROM kanji_progress WHERE user_id = $1 LIMIT 1`,
    [req.user.id]
  );
  const data = row.rows[0];
  res.json({
    knownKanji: data?.known_kanji || [],
    fsrsData: data?.fsrs_data || {},
    updatedAt: data?.updated_at || null,
  });
}));

// PUT /api/kanji-progress — upsert the full blob
// Body: { knownKanji: string[], fsrsData: object }
// We trust the client to have already merged local+cloud (same as the old
// Supabase flow — client does a load+merge then writes back the union).
router.put('/', asyncHandler(async (req, res) => {
  const knownKanji = Array.isArray(req.body?.knownKanji) ? req.body.knownKanji : [];
  const fsrsData = req.body?.fsrsData && typeof req.body.fsrsData === 'object'
    ? req.body.fsrsData : {};

  // Cap payload size. A pathological client (or storage bug) could otherwise
  // blow up the DB — 2229 kanji × ~4 bytes + FSRS state per kanji is well
  // under 1MB; if you see >2MB something is wrong.
  const approxBytes = JSON.stringify({ knownKanji, fsrsData }).length;
  if (approxBytes > 2_000_000) {
    return res.status(413).json({ error: 'payload_too_large' });
  }

  await query(
    `INSERT INTO kanji_progress (user_id, known_kanji, fsrs_data)
     VALUES ($1, $2::jsonb, $3::jsonb)
     ON CONFLICT (user_id) DO UPDATE
       SET known_kanji = EXCLUDED.known_kanji,
           fsrs_data = EXCLUDED.fsrs_data,
           updated_at = NOW()`,
    [req.user.id, JSON.stringify(knownKanji), JSON.stringify(fsrsData)]
  );

  res.json({ ok: true });
}));

export default router;
