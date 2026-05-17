import { Router } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { asyncHandler, optionalAuth } from '../middleware.js';

const router = Router();

// Natural-voice TTS via ElevenLabs, cached permanently in Postgres so the
// upstream API is hit at most once per unique string. If ELEVENLABS_API_KEY is
// unset the endpoint returns 503 and the frontend falls back to the browser's
// Web Speech API.
const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVEN_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '';
const ELEVEN_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
// 300 ok untuk satu kata/kalimat vocab, tapi listening dialog JLPT bisa
// 200-500 char (multi-turn). Naikin ke 1500 — masih jauh dari biaya
// signifikan, dan whitelist DB udah ngamanin set of generatable strings.
const MAX_TEXT_LEN = 1500;

// Each card / sentence click is one request. 40/min/IP leaves room for a long
// deck while keeping abuse noisy. The DB-existence check below is the real guard
// against burning quota on arbitrary text.
const ttsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down' },
});

function hashKey(text) {
  return crypto.createHash('sha256')
    .update(`elevenlabs|${ELEVEN_VOICE_ID}|${ELEVEN_MODEL}|${text}`)
    .digest('hex');
}

function sendAudio(res, buf, contentType) {
  res.set('Content-Type', contentType || 'audio/mpeg');
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(buf);
}

// GET /api/tts?text=<plain japanese> — returns mp3 audio
router.get('/tts', optionalAuth, ttsLimiter, asyncHandler(async (req, res) => {
  const text = String(req.query.text || '').trim();
  if (!text) return res.status(400).json({ error: 'text required' });
  if (text.length > MAX_TEXT_LEN) return res.status(400).json({ error: 'text too long' });

  // Only synthesize text that actually exists in the curriculum — caps the set
  // of strings an attacker could ever cause us to generate. Quiz listening
  // dialogs (audio_script) di-whitelist juga supaya JLPT-style audio jalan.
  const known = await query(
    `SELECT 1 WHERE EXISTS (SELECT 1 FROM module_vocabulary WHERE japanese = $1 OR reading = $1)
                OR EXISTS (SELECT 1 FROM vocabulary_examples WHERE japanese = $1)
                OR EXISTS (SELECT 1 FROM quiz_questions WHERE audio_script = $1)
     LIMIT 1`,
    [text]
  );
  if (known.rows.length === 0) return res.status(403).json({ error: 'unknown text' });

  const key = hashKey(text);
  const cached = await query(
    `SELECT audio, content_type FROM tts_cache WHERE text_hash = $1`,
    [key]
  );
  if (cached.rows.length > 0) {
    query(`UPDATE tts_cache SET last_used_at = NOW() WHERE text_hash = $1`, [key]).catch(() => {});
    return sendAudio(res, cached.rows[0].audio, cached.rows[0].content_type);
  }

  if (!ELEVEN_API_KEY || !ELEVEN_VOICE_ID) {
    return res.status(503).json({ error: 'tts_disabled' });
  }

  let upstream;
  try {
    upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(ELEVEN_VOICE_ID)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVEN_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: ELEVEN_MODEL,
          voice_settings: { stability: 0.4, similarity_boost: 0.8 },
        }),
      }
    );
  } catch (err) {
    console.error('TTS upstream fetch failed:', err.message);
    return res.status(502).json({ error: 'tts_upstream' });
  }
  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    console.error('TTS upstream error', upstream.status, detail.slice(0, 200));
    return res.status(502).json({ error: 'tts_upstream' });
  }

  const buf = Buffer.from(await upstream.arrayBuffer());
  await query(
    `INSERT INTO tts_cache (text_hash, text, provider, voice, model, audio, content_type, byte_size)
     VALUES ($1,$2,'elevenlabs',$3,$4,$5,'audio/mpeg',$6)
     ON CONFLICT (text_hash) DO NOTHING`,
    [key, text, ELEVEN_VOICE_ID, ELEVEN_MODEL, buf, buf.length]
  );
  return sendAudio(res, buf, 'audio/mpeg');
}));

export default router;
