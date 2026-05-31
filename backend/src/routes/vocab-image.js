import { Router } from 'express';
import { query } from '../db.js';
import { asyncHandler } from '../middleware.js';

// Serve gambar AI per kosakata dari vocab_image_cache. Public (tidak perlu
// auth) — gambar dipakai di kartu deck siswa. 404 kalau belum di-generate.
// Cache-control panjang karena bytes immutable per vocabulary_id (regenerate
// admin akan mengubah row + bust di-browser pakai query param ?v=).

const router = Router();

router.get('/vocab-image', asyncHandler(async (req, res) => {
  const vid = String(req.query.vocabularyId || '').trim();
  if (!vid) return res.status(400).send('vocabularyId required');
  const r = await query(
    `SELECT image_bytes, mime FROM vocab_image_cache WHERE vocabulary_id = $1`,
    [vid]
  );
  if (r.rows.length === 0) return res.status(404).send('not found');
  const { image_bytes, mime } = r.rows[0];
  res.setHeader('Content-Type', mime || 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(image_bytes);
}));

export default router;
