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
//
// JLPT dialog mode: text dengan baris "A: ... \n B: ..." auto-detected →
// per-turn audio digenerate dengan voice yang sesuai speaker (cewe/cowo),
// di-concat jadi 1 MP3. Voice IDs di env: ELEVENLABS_VOICE_FEMALE +
// ELEVENLABS_VOICE_MALE. Fallback ke ELEVENLABS_VOICE_ID kalau kosong.
const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVEN_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '';
const ELEVEN_VOICE_NARRATOR = process.env.ELEVENLABS_VOICE_NARRATOR || ELEVEN_VOICE_ID;
const ELEVEN_VOICE_FEMALE = process.env.ELEVENLABS_VOICE_FEMALE || ELEVEN_VOICE_ID;
const ELEVEN_VOICE_MALE = process.env.ELEVENLABS_VOICE_MALE || ELEVEN_VOICE_ID;
const ELEVEN_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
// Multi-turn dialog JLPT bisa 200-500 char. Naikin ke 1500 — whitelist DB
// udah ngamanin set of generatable strings.
const MAX_TEXT_LEN = 1500;

const ttsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down' },
});

// Cache key includes all voice IDs + model + voice_settings VERSION supaya
// kalau model atau settings ganti, cache otomatis invalidate (gak perlu
// manual DELETE). Format:
// `elevenlabs|<voiceA>:<voiceB>:...|<model>|v2|<text>`
// (versi naik kalau voice_settings preset berubah signifikan)
const SETTINGS_VERSION = 'v6'; // jeda 1.5s setelah narrator (was 700ms)
export function ttsHashKey(text, voices) {
  const sortedVoices = voices.slice().sort().join(':');
  return crypto.createHash('sha256')
    .update(`elevenlabs|${sortedVoices}|${ELEVEN_MODEL}|${SETTINGS_VERSION}|${text}`)
    .digest('hex');
}
// Backward alias buat code dalam file ini.
const hashKey = ttsHashKey;

// Re-export helpers buat admin endpoints (test/cache management).
export {
  ELEVEN_VOICE_ID as TTS_ELEVEN_VOICE_ID,
  ELEVEN_MODEL as TTS_ELEVEN_MODEL,
  SETTINGS_VERSION as TTS_SETTINGS_VERSION,
};

function sendAudio(res, buf, contentType) {
  res.set('Content-Type', contentType || 'audio/mpeg');
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(buf);
}

// Detect JLPT-style dialog: lines like "A: ...", "B: ...", "女: ...", "男: ...".
// Speaker label = 1-10 char before first colon. Return turns array, or null
// kalau bukan dialog (plain text).
export function parseDialog(text) {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const SPEAKER_RE = /^([A-Za-z0-9]{1,12}|男|女|男性|女性|男の人|女の人):\s*(.+)$/;
  const turns = [];
  for (const line of lines) {
    const m = line.match(SPEAKER_RE);
    if (m) {
      turns.push({ speaker: m[1], text: m[2].trim() });
    } else if (turns.length > 0) {
      // Continuation of previous turn (line break without speaker prefix).
      turns[turns.length - 1].text += ' ' + line;
    } else {
      // Bukan dialog format — line pertama udah ga punya speaker prefix.
      return null;
    }
  }
  return turns.length >= 2 ? turns : null;
}

// Map speaker label → { voiceId, role }. 3 roles: narrator/female/male.
// - Narrator: N / Narrator / ナレーター / Nasi → formal calm
// - Female: A / W / F / 女 / nama cewe umum → conversational expressive
// - Male: B / M / 男 / nama cowo umum → conversational expressive
const NARRATOR_PATTERNS = /^(n|narrator|nasi|ナレーター|nrs)$/;
const FEMALE_PATTERNS = /^(a|w|f|女|onna|cewe|cewek|female|woman|women|yumi|aiko|hana|sakura|mei|emi|wanita)/;
const MALE_PATTERNS = /^(b|m|男|otoko|cowo|cowok|male|man|men|ken|taro|hiroshi|takeshi|jiro|pria)/;
export function voiceForSpeaker(speaker, orderIndex) {
  const s = String(speaker || '').toLowerCase();
  if (NARRATOR_PATTERNS.test(s)) return { voiceId: ELEVEN_VOICE_NARRATOR, role: 'narrator' };
  if (FEMALE_PATTERNS.test(s)) return { voiceId: ELEVEN_VOICE_FEMALE, role: 'female' };
  if (MALE_PATTERNS.test(s)) return { voiceId: ELEVEN_VOICE_MALE, role: 'male' };
  // Unknown → alternate by order (genap=female, ganjil=male)
  return orderIndex % 2 === 0
    ? { voiceId: ELEVEN_VOICE_FEMALE, role: 'female' }
    : { voiceId: ELEVEN_VOICE_MALE, role: 'male' };
}

// Per-role voice_settings — narrator formal-steady (style 0 = neutral-clear,
// gak interpret emosi), dialog speaker conversational-expressive (style tinggi
// + low stability → follow text emotion / tag inflection). Speed < 1.0 = pace
// JLPT real test (~0.9-0.95). Settings ini bisa di-tune per taste — bump
// SETTINGS_VERSION kalau mau invalidate cache full.
const VOICE_SETTINGS = {
  narrator: { stability: 0.55, similarity_boost: 0.8,  style: 0.0,  use_speaker_boost: true, speed: 0.95 },
  female:   { stability: 0.35, similarity_boost: 0.75, style: 0.4,  use_speaker_boost: true, speed: 0.92 },
  male:     { stability: 0.35, similarity_boost: 0.75, style: 0.4,  use_speaker_boost: true, speed: 0.92 },
  single:   { stability: 0.4,  similarity_boost: 0.8,  style: 0.0,  use_speaker_boost: true, speed: 1.0 }, // legacy vocab/sentence
};

// Narrator selalu pakai v2 — v3 cenderung interpret konten JLPT plain
// ("男の人と女の人が話しています...") sebagai monotone-depressed karena
// gak ada cue emosi di text. v2 lebih netral-clear, cocok buat instruksi
// JLPT formal. Dialog speaker (A/B) tetap pake env model (biasanya v3)
// supaya emotion tag [questioning]/[excited]/dll jalan.
const NARRATOR_MODEL_OVERRIDE = 'eleven_multilingual_v2';

export async function fetchElevenAudio(voiceId, text, role = 'single', retry = 0) {
  const settings = VOICE_SETTINGS[role] || VOICE_SETTINGS.single;
  const modelId = role === 'narrator' ? NARRATOR_MODEL_OVERRIDE : ELEVEN_MODEL;
  // Narrator dipaksa v2 → tag emotion [calm]/[questioning]/dll bakal dibaca
  // literal. Strip tag dari text supaya gak keluar sebagai kata "calm" /
  // "questioning" di audio.
  const cleanText = role === 'narrator'
    ? text.replace(/\[[a-z_]{1,24}\]\s*/gi, '').trim()
    : text;
  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVEN_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: modelId,
        voice_settings: settings,
      }),
    }
  );
  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    // Retry on transient errors: 409 (already_running), 429 (rate limit),
    // 500-503. Backoff: 500ms × (retry+1). Max 3 retries.
    if (retry < 3 && (upstream.status === 409 || upstream.status === 429 || upstream.status >= 500)) {
      await new Promise((r) => setTimeout(r, 500 * (retry + 1)));
      return fetchElevenAudio(voiceId, text, role, retry + 1);
    }
    const err = new Error(`ElevenLabs ${upstream.status}: ${detail.slice(0, 200)}`);
    err.upstreamStatus = upstream.status;
    throw err;
  }
  return Buffer.from(await upstream.arrayBuffer());
}

// GET /api/tts?text=<plain japanese OR dialog "A: ... B: ...">
router.get('/tts', optionalAuth, ttsLimiter, asyncHandler(async (req, res) => {
  const text = String(req.query.text || '').trim();
  if (!text) return res.status(400).json({ error: 'text required' });
  if (text.length > MAX_TEXT_LEN) return res.status(400).json({ error: 'text too long' });

  // Whitelist anti-abuse: text harus berasal dari curriculum content.
  // Quiz audio_script di-include karena listening dialog disimpan as-is.
  const known = await query(
    `SELECT 1 WHERE EXISTS (SELECT 1 FROM module_vocabulary WHERE japanese = $1 OR reading = $1)
                OR EXISTS (SELECT 1 FROM vocabulary_examples WHERE japanese = $1)
                OR EXISTS (SELECT 1 FROM quiz_questions WHERE audio_script = $1)
     LIMIT 1`,
    [text]
  );
  if (known.rows.length === 0) return res.status(403).json({ error: 'unknown text' });

  // Detect dialog vs single-voice. Single-voice fallback kalau parse gagal.
  const turns = parseDialog(text);
  const isDialog = !!turns;
  const turnVoices = isDialog
    ? turns.map((t, i) => voiceForSpeaker(t.speaker, i))
    : [{ voiceId: ELEVEN_VOICE_ID, role: 'single' }];
  const voices = turnVoices.map((v) => v.voiceId);

  // Cache key includes voice list — single-voice vs dialog versions stored
  // separately (different output → different hash).
  const key = hashKey(text, voices);
  const cached = await query(
    `SELECT audio, content_type FROM tts_cache WHERE text_hash = $1`,
    [key]
  );
  if (cached.rows.length > 0) {
    query(`UPDATE tts_cache SET last_used_at = NOW() WHERE text_hash = $1`, [key]).catch(() => {});
    return sendAudio(res, cached.rows[0].audio, cached.rows[0].content_type);
  }

  // Disabled kalau API key kosong, atau (non-dialog tanpa voice ID),
  // atau (dialog tanpa satupun voice cewe/cowo/narrator yang ke-set).
  const dialogVoicesEmpty = !ELEVEN_VOICE_FEMALE && !ELEVEN_VOICE_MALE && !ELEVEN_VOICE_NARRATOR;
  if (!ELEVEN_API_KEY || (!isDialog && !ELEVEN_VOICE_ID) || (isDialog && dialogVoicesEmpty)) {
    return res.status(503).json({ error: 'tts_disabled' });
  }

  let combined;
  try {
    if (isDialog) {
      // Generate per turn SERIAL (bukan Promise.all paralel) karena
      // ElevenLabs free tier:
      //   - max 5 concurrent requests (429 concurrent_limit_exceeded)
      //   - 409 "already_running" kalau voice ID sama dipanggil paralel
      // Serial lebih lambat tapi reliable. Anyway cuma kena first request
      // (cache miss); user berikutnya hit cache.
      // Tambah jeda di akhir tiap turn (kecuali yang terakhir) via SSML
      // <break> tag — model ElevenLabs (v2 multilingual & v3) handle jeda
      // sebagai trailing silence di audio. Concat hasilnya = natural pause.
      // - Setelah narrator (instruksi mondai): 1500ms — JLPT real test
      //   biasa ada jeda ~1.5s sebelum dialog mulai.
      // - Antar dialog speaker (A/B): 700ms — natural conversational gap.
      const buffers = [];
      for (let i = 0; i < turns.length; i++) {
        const isLast = i === turns.length - 1;
        const breakMs = turnVoices[i].role === 'narrator' ? 1500 : 700;
        const textWithBreak = isLast ? turns[i].text : `${turns[i].text} <break time="${breakMs}ms" />`;
        buffers.push(await fetchElevenAudio(turnVoices[i].voiceId, textWithBreak, turnVoices[i].role));
      }
      combined = Buffer.concat(buffers);
    } else {
      combined = await fetchElevenAudio(ELEVEN_VOICE_ID, text, 'single');
    }
  } catch (err) {
    console.error('TTS upstream:', err.message);
    return res.status(502).json({ error: 'tts_upstream' });
  }

  await query(
    `INSERT INTO tts_cache (text_hash, text, provider, voice, model, audio, content_type, byte_size, settings_version)
     VALUES ($1,$2,'elevenlabs',$3,$4,$5,'audio/mpeg',$6,$7)
     ON CONFLICT (text_hash) DO NOTHING`,
    [key, text, voices.join(','), ELEVEN_MODEL, combined, combined.length, SETTINGS_VERSION]
  );
  return sendAudio(res, combined, 'audio/mpeg');
}));

// GET /api/tts/version — public, untuk frontend append `?v=` ke URL TTS
// supaya browser HTTP cache invalidate kalau settings_version berubah.
router.get('/tts/version', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300'); // small TTL biar bump nyebar dalam ~5 menit.
  res.json({ version: SETTINGS_VERSION });
});

export default router;
