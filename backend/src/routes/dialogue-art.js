import { Router } from 'express';
import { query } from '../db.js';
import { asyncHandler } from '../middleware.js';
import { isCharacterKey, isExpressionKey, loadArtManifest } from '../dialogue-art.js';

// Character art for the dialogue stage (migration 177). Public, like
// /vocab-image and the bundled assets/dialogue files it stands in for: it is
// artwork, not learner data. Uploads happen in routes/admin.js.
const router = Router();

// Which characters have uploaded art. Short cache: an upload shows up for
// students within a minute, and the image URLs themselves are versioned.
router.get('/dialogue-art', asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json(await loadArtManifest());
}));

router.get('/dialogue-art/:characterKey/:expressionKey', asyncHandler(async (req, res) => {
  const { characterKey, expressionKey } = req.params;
  if (!isCharacterKey(characterKey) || !isExpressionKey(expressionKey)) return res.status(404).send('not found');
  const r = await query(`SELECT image, mime, version FROM dialogue_character_art
    WHERE character_key = $1 AND expression_key = $2`, [characterKey, expressionKey]);
  const art = r.rows[0];
  if (!art) return res.status(404).send('not found');
  res.setHeader('Content-Type', art.mime);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // The manifest hands out ?v=<version>; a replaced image gets a new URL, so the
  // current version can be cached for good. Any other URL is revalidated.
  res.setHeader('Cache-Control', String(req.query.v) === String(art.version)
    ? 'public, max-age=31536000, immutable' : 'no-cache');
  res.send(art.image);
}));

export default router;
