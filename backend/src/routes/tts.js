import { Router } from 'express';
import dialogueFurigana from '../../../src/dialogue-furigana.js';
import { normalizeDialogScene, sceneTurnVoices, validateSceneVoices } from '../dialogue-scene.js';
import { isCanonicalUuid } from '../live-class-admin-rules.js';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { asyncHandler, optionalAuth } from '../middleware.js';
import { assembleListeningWav, listeningTurnGaps, stripListeningMarkup, validateListeningPcm, MAX_LISTENING_PCM_BYTES } from '../listening-audio.js';

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
export const TTS_LISTENING_MODEL = process.env.ELEVENLABS_LISTENING_MODEL || 'eleven_v4';
export const TTS_LISTENING_SETTINGS_VERSION = 'listening-v4-pcm-v1';
const LISTENING_OUTPUT = 'pcm_24000';
// V4 supports stability and similarity; speed/style/speaker boost and SSML
// breaks belong to other models. Playback speed is a separate player control.
const LISTENING_SETTINGS = Object.freeze({ stability: 0.6, similarity_boost: 0.8 });
const listeningInFlight = new Map();
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
// Catatan: parseDialog berubah terima 1-turn TANPA bump version — teks
// 1-turn yang terdampak otomatis dapet hash baru karena voice list-nya
// berubah (single → role voice); bump global = regenerate SEMUA cache
// (cost ElevenLabs), gak perlu.
export function ttsHashKey(text, voices) {
  // An unordered set collides when A and B exchange voices. Preserve the old
  // cache only where ordering cannot matter (a single distinct voice).
  const voiceKey = new Set(voices).size <= 1
    ? voices.join(':')
    : `ordered-v1:${JSON.stringify(voices)}`;
  return crypto.createHash('sha256')
    .update(`elevenlabs|${voiceKey}|${ELEVEN_MODEL}|${SETTINGS_VERSION}|${text}`)
    .digest('hex');
}
// Backward alias buat code dalam file ini.
const hashKey = ttsHashKey;

export function listeningHashKey(text, turnVoices) {
  const turns = parseDialog(text) || [{ speaker: '', text }];
  return crypto.createHash('sha256').update(JSON.stringify({
    profile: TTS_LISTENING_SETTINGS_VERSION, model: TTS_LISTENING_MODEL,
    output: LISTENING_OUTPUT, container: 'wav', settings: LISTENING_SETTINGS,
    turns: turns.map((turn, i) => ({ speaker: turn.speaker, voiceId: turnVoices[i].voiceId, role: turnVoices[i].role })),
    gaps: listeningTurnGaps(turns, turnVoices), text,
  })).digest('hex');
}

// Re-export helpers buat admin endpoints (test/cache management).
export {
  ELEVEN_VOICE_ID as TTS_ELEVEN_VOICE_ID,
  ELEVEN_MODEL as TTS_ELEVEN_MODEL,
  SETTINGS_VERSION as TTS_SETTINGS_VERSION,
};

function sendAudio(res, buf, contentType, privateResponse = false) {
  res.set('Content-Type', contentType || 'audio/mpeg');
  res.set('Cache-Control', privateResponse ? 'private, no-store' : 'public, max-age=31536000, immutable');
  res.send(buf);
}

// Detect JLPT-style dialog: lines like "A: ...", "B: ...", "女: ...", "男: ...",
// or a real character name ("アンナ: ...", "ハディ: ..." — see dialogue_speakers,
// migration 148). Speaker label = 1-12 char before first colon, either ASCII
// (legacy TTS routing codes: N/A/B/W/F/M, still produced by the AI dialog
// generator) or a kanji/kana run (a chosen speaker name, or the legacy
// 男/女/男の人/女の人 words — now a case of the same character class rather
// than a separate alternative). Return turns array, or null kalau bukan
// dialog (plain text). Satu baris ber-prefix juga dianggap dialog (mis. soal
// 即時応答 cuma 1 ucapan) — dapet voice sesuai role & prefix-nya gak ikut
// kebaca; teks polos tanpa prefix tetap null → single-voice fallback.
export function parseDialog(text) {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const SPEAKER_RE = /^([A-Za-z0-9]{1,12}|[一-龥ぁ-んァ-ヶー]{1,12}):\s*(.+)$/;
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
  return turns.length >= 1 ? turns : null;
}

// Map speaker label → { voiceId, role }. Roles: narrator/dialogue/single.
// - Narrator: N / Narrator / ナレーター / Nasi → formal calm
// - Dialogue: everything else — a registered character voiced by a REAL
//   ElevenLabs voice_id (see dialogue_speakers / loadSpeakerRegistry below),
//   or (unregistered legacy content) a guessed env voice by gender-word/
//   letter pattern, or plain alternation. All of these get the SAME
//   voice_settings preset — tuning never depended on the female/male split,
//   only voice IDENTITY did, so there is nothing to distinguish once
//   identity comes from a real voice_id instead of a binary guess.
//
// `registry` (optional, Map<name, voiceId>, see dialogue_speakers /
// loadSpeakerRegistry below) is checked BEFORE the pattern guesses — an
// admin-assigned real ElevenLabs voice always wins over guessing. Without
// it (existing 2-arg callers), behaviour is unchanged: a chosen name that
// isn't in the registry yet still gets a reasonable voice from the
// patterns/alternation below rather than erroring, so a stale or missing
// registry never breaks generation, it just falls back to a guess.
const NARRATOR_PATTERNS = /^(n|narrator|nasi|ナレーター|nrs)$/;
const FEMALE_PATTERNS = /^(a|w|f|女|onna|cewe|cewek|female|woman|women|yumi|aiko|hana|sakura|mei|emi|wanita)/;
const MALE_PATTERNS = /^(b|m|男|otoko|cowo|cowok|male|man|men|ken|taro|hiroshi|takeshi|jiro|pria)/;
export function voiceForSpeaker(speaker, orderIndex, registry) {
  const s = String(speaker || '').toLowerCase();
  if (NARRATOR_PATTERNS.test(s)) return { voiceId: ELEVEN_VOICE_NARRATOR, role: 'narrator' };
  const known = registry && registry.get(String(speaker || '').trim());
  if (known) return { voiceId: known, role: 'dialogue' };
  if (FEMALE_PATTERNS.test(s)) return { voiceId: ELEVEN_VOICE_FEMALE, role: 'dialogue' };
  if (MALE_PATTERNS.test(s)) return { voiceId: ELEVEN_VOICE_MALE, role: 'dialogue' };
  // Unknown → alternate by order (genap=female-env, ganjil=male-env)
  return orderIndex % 2 === 0
    ? { voiceId: ELEVEN_VOICE_FEMALE, role: 'dialogue' }
    : { voiceId: ELEVEN_VOICE_MALE, role: 'dialogue' };
}

// Loaded once per request and threaded through to voiceForSpeaker — a named
// speaker's voice never depends on which letter code they used to be.
// Map<name, voiceId> — voiceId is a REAL ElevenLabs voice_id chosen by the
// admin from ElevenLabs' own catalog (see fetchElevenVoices below), not a
// female/male bucket.
export async function loadSpeakerRegistry() {
  const r = await query('SELECT name, voice_id FROM dialogue_speakers');
  return new Map(r.rows.map((row) => [row.name, row.voice_id]));
}

// Per-role voice_settings — narrator formal-steady (style 0 = neutral-clear,
// gak interpret emosi), dialog speaker conversational-expressive (style tinggi
// + low stability → follow text emotion / tag inflection). Speed < 1.0 = pace
// JLPT real test (~0.9-0.95). Settings ini bisa di-tune per taste — bump
// SETTINGS_VERSION kalau mau invalidate cache full. Satu preset `dialogue`
// dipakai SEMUA speaker non-narrator apa pun voice_id-nya — identitas suara
// datang dari voice_id itu sendiri (ElevenLabs), bukan dari role ini.
const VOICE_SETTINGS = {
  narrator: { stability: 0.55, similarity_boost: 0.8,  style: 0.0,  use_speaker_boost: true, speed: 0.95 },
  dialogue: { stability: 0.35, similarity_boost: 0.75, style: 0.4,  use_speaker_boost: true, speed: 0.92 },
  single:   { stability: 0.4,  similarity_boost: 0.8,  style: 0.0,  use_speaker_boost: true, speed: 1.0 }, // legacy vocab/sentence
};

// Narrator selalu pakai v2 — v3 cenderung interpret konten JLPT plain
// ("男の人と女の人が話しています...") sebagai monotone-depressed karena
// gak ada cue emosi di text. v2 lebih netral-clear, cocok buat instruksi
// JLPT formal. Dialog speaker (A/B) tetap pake env model (biasanya v3)
// supaya emotion tag [questioning]/[excited]/dll jalan.
const NARRATOR_MODEL_OVERRIDE = 'eleven_multilingual_v2';

const modelForRole = (role) => (role === 'narrator' ? NARRATOR_MODEL_OVERRIDE : ELEVEN_MODEL);

// Materials are typed with a space between words (たなかさんは がくせいです) so
// beginners can read them and the arrange drill can cut them. ElevenLabs
// reads those spaces as pauses, so speech came out halting. Spaces between
// two Japanese characters are dropped from what is SPOKEN only; the stored
// and displayed text keeps them. Spaces next to Latin text, [emotion] tags
// or SSML stay.
const JP_CHAR = '[\\u3001-\\u30ff\\u3400-\\u9fff\\uf900-\\ufaff\\uff01-\\uffef]';
const JP_GAP = new RegExp(`(${JP_CHAR})[ \\u3000]+(?=${JP_CHAR})`, 'gu');
export function speechText(text) {
  return String(text).replace(JP_GAP, '$1');
}

// What a dialogue turn SAYS: kanji the editor gave a furigana reading are
// spoken as that reading, so ElevenLabs can never pick another reading for a
// kanji the student is learning (and a dialogue rewritten from kana to the
// kanji already taught keeps the same audio). `furigana` is the row's
// dialog_furigana; a line only applies while speaker+text still match it.
export function spokenTurnText(turn, index, furigana) {
  let line = null;
  try { line = furigana ? dialogueFurigana.lineFor(dialogueFurigana.normalize(furigana), index, turn) : null; }
  catch { line = null; }
  let text = turn.text;
  for (const r of [...(line?.readings || [])].sort((a, b) => b.start - a.start)) {
    text = text.slice(0, r.start) + r.reading + text.slice(r.end);
  }
  return speechText(text);
}

export async function fetchElevenAudio(voiceId, text, role = 'single', retry = 0) {
  const settings = VOICE_SETTINGS[role] || VOICE_SETTINGS.single;
  const modelId = modelForRole(role);
  // Narrator dipaksa v2 → tag emotion [calm]/[questioning]/dll bakal dibaca
  // literal. Strip tag dari text supaya gak keluar sebagai kata "calm" /
  // "questioning" di audio.
  const cleanText = speechText(role === 'narrator'
    ? text.replace(/\[[a-z_]{1,24}\]\s*/gi, '').trim()
    : text);
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

export function elevenLabsEnabled() {
  return !!ELEVEN_API_KEY;
}

export async function fetchElevenListeningPcm(voiceId, text, retry = 0) {
  const spoken = speechText(stripListeningMarkup(text));
  if (!spoken) throw new Error('listening_text_empty');
  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${LISTENING_OUTPUT}`,
    { method: 'POST', headers: { 'xi-api-key': ELEVEN_API_KEY, 'Content-Type': 'application/json', 'Accept': 'audio/pcm' },
      body: JSON.stringify({ text: spoken, model_id: TTS_LISTENING_MODEL, voice_settings: LISTENING_SETTINGS }),
      signal: AbortSignal.timeout(60000),
    }
  );
  if (!upstream.ok) {
    if (retry < 3 && (upstream.status === 409 || upstream.status === 429 || upstream.status >= 500)) {
      await upstream.body?.cancel();
      await new Promise(resolve => setTimeout(resolve, 500 * (retry + 1)));
      return fetchElevenListeningPcm(voiceId, text, retry + 1);
    }
    await upstream.body?.cancel();
    throw new Error(`listening_tts_upstream_${upstream.status}`);
  }
  const chunks = []; let size = 0;
  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_LISTENING_PCM_BYTES) throw new Error('listening_pcm_too_long');
      chunks.push(Buffer.from(value));
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
  return validateListeningPcm(Buffer.concat(chunks, size), upstream.headers.get('content-type') || '');
}

async function renderListeningAudio(text, turns, turnVoices, scene, res, privateResponse) {
  const key = listeningHashKey(text, turnVoices);
  if (!listeningInFlight.has(key)) {
    const pending = (async () => {
      const cached = await query('SELECT audio, content_type FROM tts_cache WHERE text_hash = $1', [key]);
      if (cached.rows[0]) {
        query('UPDATE tts_cache SET last_used_at = NOW() WHERE text_hash = $1', [key]).catch(() => {});
        return cached.rows[0];
      }
      if (!ELEVEN_API_KEY || turnVoices.some(voice => !voice.voiceId)) throw ttsError('tts_disabled');
      await validateSceneVoices(scene, fetchElevenVoices);
      const clips = [], gaps = listeningTurnGaps(turns, turnVoices);
      let size = gaps.reduce((total, milliseconds) => total + milliseconds * 48, 0);
      for (let i = 0; i < turns.length; i++) {
        const clip = await fetchElevenListeningPcm(turnVoices[i].voiceId, turns[i].text);
        size += clip.length;
        if (size > MAX_LISTENING_PCM_BYTES) throw new Error('listening_audio_too_long');
        clips.push(clip);
      }
      const audio = assembleListeningWav(clips, gaps);
      const saved = await query(`INSERT INTO tts_cache (text_hash, text, provider, voice, model, audio, content_type, byte_size, settings_version)
        VALUES ($1,$2,'elevenlabs',$3,$4,$5,'audio/wav',$6,$7)
        ON CONFLICT (text_hash) DO NOTHING RETURNING audio, content_type`,
      [key, text, turnVoices.map(voice => voice.voiceId).join(','), TTS_LISTENING_MODEL, audio, audio.length, TTS_LISTENING_SETTINGS_VERSION]);
      // Across backend processes, the first committed take wins. Both admin
      // preview and the student hear that take, even on simultaneous cache misses.
      return saved.rows[0] || (await query('SELECT audio, content_type FROM tts_cache WHERE text_hash = $1', [key])).rows[0];
    })();
    listeningInFlight.set(key, pending);
    pending.finally(() => { if (listeningInFlight.get(key) === pending) listeningInFlight.delete(key); }).catch(() => {});
  }
  try {
    const saved = await listeningInFlight.get(key);
    return sendAudio(res, saved.audio, saved.content_type, privateResponse);
  } catch (error) {
    if (error.code === 'tts_disabled') return res.status(503).json({ error: 'tts_disabled' });
    console.error('Listening TTS:', error.message);
    return res.status(502).json({ error: 'tts_upstream' });
  }
}

// GET https://api.elevenlabs.io/v1/voices — powers the admin dialogue
// editor's speaker picker, so an admin assigns a genuine ElevenLabs voice
// (real name + voice_id) per character instead of a binary female/male
// bucket. Read-only, no caching (admin-only, low call volume) — always
// fresh so a voice renamed/added/removed in the ElevenLabs dashboard shows
// up immediately rather than through a stale local copy.
export async function fetchElevenVoices() {
  const upstream = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': ELEVEN_API_KEY },
  });
  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    const err = new Error(`ElevenLabs voices ${upstream.status}: ${detail.slice(0, 200)}`);
    err.upstreamStatus = upstream.status;
    throw err;
  }
  const data = await upstream.json();
  return (Array.isArray(data.voices) ? data.voices : []).map((v) => ({
    voiceId: v.voice_id,
    name: v.name,
    previewUrl: v.preview_url || null,
    labels: v.labels || {},
  }));
}

// ── Dialogue turns: one cached take per turn, shared by admin and students ──
// The dialogue player (chat bubbles, per-line play, the stage — see
// /tts/dialog below and grammarKaraokePlay in welcome.html) plays each turn
// as its own clip. ElevenLabs never returns the same take twice, so the ONLY
// way the admin's "Tes giliran ini" can sound like what students hear is for
// both to read the very same stored take. Each turn is therefore cached on
// its own, keyed by exactly what shapes its audio — voice, role, turn text —
// and not by the whole dialogue: editing one line re-voices only that line,
// and "Buat ulang" (POST /admin/tts/dialog-turn) replaces one take for
// everyone. Same generation call as /api/tts (fetchElevenAudio, no SSML
// <break>: the player inserts its own gap between clips).
const DIALOG_TURN_PREFIX = 'dialogturn1';
// Keyed by what is spoken (spokenTurnText): a turn typed without spaces keeps
// its stored take, a spaced one gets a new key and is re-voiced once without
// the pauses, and kanji with furigana share the take of their kana spelling.
export function dialogTurnKey(spoken, voice) {
  return ttsHashKey(`${DIALOG_TURN_PREFIX}\n${voice.role}\n${spoken}`, [voice.voiceId]);
}

async function selectTurnAudio(keys) {
  if (!keys.length) return new Map();
  const r = await query(`SELECT text_hash, audio FROM tts_cache WHERE text_hash = ANY($1::text[])`, [keys]);
  return new Map(r.rows.map((row) => [row.text_hash, row.audio]));
}

async function storeTurnAudio(key, turn, voice, audio, replace) {
  await query(
    `INSERT INTO tts_cache (text_hash, text, provider, voice, model, audio, content_type, byte_size, settings_version)
     VALUES ($1,$2,'elevenlabs',$3,$4,$5,'audio/mpeg',$6,$7)
     ON CONFLICT (text_hash) DO ${replace
    ? 'UPDATE SET audio = EXCLUDED.audio, byte_size = EXCLUDED.byte_size, created_at = NOW(), last_used_at = NOW()'
    : 'NOTHING'}`,
    [key, turn.text, voice.voiceId, modelForRole(voice.role), audio, audio.length, SETTINGS_VERSION]
  );
}

// Takes generated before turns were cached one by one, adopted once so the
// deploy neither re-bills ElevenLabs nor swaps voices without a reason. The
// admin's own earlier "Tes giliran" take (the old /admin/tts/preview row for
// that single "SPEAKER: text" line) wins over the student's whole-dialogue
// take (old "dialogsegs1" row): it is the one a person actually listened to.
async function adoptLegacyTakes(missingTurns, turns, turnVoices, keys, dialogText, spoken) {
  // Legacy takes were voiced from the stored text as typed: spaces became
  // pauses and kanji were read however ElevenLabs guessed.
  const missing = missingTurns.filter((i) => spoken[i] === turns[i].text);
  if (!missing.length) return;
  const testedKeys = missing.map((i) => ttsHashKey(`${turns[i].speaker}: ${turns[i].text}`, [turnVoices[i].voiceId]));
  const tested = await selectTurnAudio(testedKeys);
  let segments = null;
  if (dialogText && missing.some((_, n) => !tested.has(testedKeys[n]))) {
    const r = await query(`SELECT alignment FROM tts_cache WHERE text_hash = $1`,
      [ttsHashKey('dialogsegs1\n' + dialogText, turnVoices.map((v) => v.voiceId))]);
    const segs = r.rows[0]?.alignment?.segments;
    if (Array.isArray(segs) && segs.length === turns.length
      && segs.every((seg, i) => seg?.speaker === turns[i].speaker && typeof seg.audio_base64 === 'string')) segments = segs;
  }
  for (let n = 0; n < missing.length; n++) {
    const i = missing[n];
    const audio = tested.get(testedKeys[n]) || (segments && Buffer.from(segments[i].audio_base64, 'base64'));
    if (audio?.length) await storeTurnAudio(keys[i], turns[i], turnVoices[i], audio, false);
  }
}

function ttsError(code, message) {
  const err = new Error(message || code);
  err.code = code;
  return err;
}

// Audio for `indices` (default: every turn), in that order. Lookup order:
// the turn's own row → a legacy take (above) → a fresh generation.
// `regenerate` skips straight to generation and REPLACES the stored take.
// Always answers with what the table holds afterwards, so two requests that
// generate the same missing turn at once still settle on one take.
// Throws code 'tts_disabled' (no key / a turn without a voice) or any
// upstream/voice-catalog error.
export async function resolveDialogTurns({ turns, turnVoices, dialogText = '', indices = null, scene = null, furigana = null, regenerate = false }) {
  const want = indices || turns.map((_, i) => i);
  const spoken = turns.map((turn, i) => spokenTurnText(turn, i, furigana));
  const keys = spoken.map((text, i) => dialogTurnKey(text, turnVoices[i]));
  const wantKeys = [...new Set(want.map((i) => keys[i]))];
  let found = regenerate ? new Map() : await selectTurnAudio(wantKeys);
  let missing = want.filter((i) => !found.has(keys[i]));
  if (!regenerate && missing.length) {
    await adoptLegacyTakes(missing, turns, turnVoices, keys, dialogText, spoken);
    found = await selectTurnAudio(wantKeys);
    missing = want.filter((i) => !found.has(keys[i]));
  }
  if (missing.length) {
    if (!ELEVEN_API_KEY || missing.some((i) => !turnVoices[i].voiceId)) throw ttsError('tts_disabled');
    await validateSceneVoices(scene, fetchElevenVoices);
    // Serial, not Promise.all: ElevenLabs answers 409/429 to parallel calls
    // on one voice. A line said twice by the same voice is generated once.
    const done = new Set();
    for (const i of missing) {
      if (done.has(keys[i])) continue;
      done.add(keys[i]);
      const audio = await fetchElevenAudio(turnVoices[i].voiceId, spoken[i], turnVoices[i].role);
      await storeTurnAudio(keys[i], turns[i], turnVoices[i], audio, regenerate);
    }
    found = await selectTurnAudio(wantKeys);
  }
  query(`UPDATE tts_cache SET last_used_at = NOW() WHERE text_hash = ANY($1::text[])`, [wantKeys]).catch(() => {});
  const audio = want.map((i) => found.get(keys[i]));
  if (audio.some((buf) => !buf)) throw ttsError('tts_upstream', 'turn audio missing after generation');
  return audio;
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
                OR EXISTS (SELECT 1 FROM vocabulary_examples WHERE japanese = $1 OR reading = $1)
                OR EXISTS (SELECT 1 FROM quiz_questions WHERE audio_script = $1 AND assessment_meta->>'version' IS NULL AND audio_scene IS NULL)
                OR EXISTS (SELECT 1 FROM module_grammar WHERE example_dialog = $1 OR example = $1)
                OR EXISTS (SELECT 1 FROM grammar_examples WHERE japanese = $1)
                OR EXISTS (SELECT 1 FROM kana_items WHERE character = $1)
                OR EXISTS (SELECT 1 FROM kana_examples WHERE japanese = $1 OR reading = $1)
     LIMIT 1`,
    [text]
  );
  if (known.rows.length === 0) return res.status(403).json({ error: 'unknown text' });

  return renderTtsAudio(text, res);
}));

// Callers must authorize the source text first. Assessment callers use their
// immutable, owned attempt and never send the script to the student client.
export async function renderTtsAudio(text, res, { privateResponse = false, dialogScene = null, listening = false } = {}) {

  // Detect dialog vs single-voice. Single-voice fallback kalau parse gagal.
  const turns = parseDialog(text);
  const isDialog = !!turns;
  const registry = isDialog ? await loadSpeakerRegistry() : null;
  let scene, turnVoices;
  try {
    scene = normalizeDialogScene(dialogScene);
    if (scene && !isDialog) throw new Error('Skrip audio harus memakai label pemeran.');
    turnVoices = isDialog
      ? sceneTurnVoices(turns, scene, (t, i) => voiceForSpeaker(t.speaker, i, registry))
      : [{ voiceId: ELEVEN_VOICE_ID, role: 'single' }];
  } catch (err) { return res.status(422).json({ error: 'dialog_voice_missing', detail: err.message }); }
  if (listening) return renderListeningAudio(text, turns || [{ speaker: '', text }], turnVoices, scene, res, privateResponse);
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
    return sendAudio(res, cached.rows[0].audio, cached.rows[0].content_type, privateResponse);
  }

  // Explicit character voices work without female/male environment defaults.
  // A missing voice on any actual turn must fail before contacting ElevenLabs.
  if (!ELEVEN_API_KEY || voices.some(v => !v)) {
    return res.status(503).json({ error: 'tts_disabled' });
  }

  let combined;
  try {
    await validateSceneVoices(scene, fetchElevenVoices);
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
  return sendAudio(res, combined, 'audio/mpeg', privateResponse);
}

// GET /api/tts/dialog?text=<dialog "A: ... B: ...">
// Per-turn segmented audio for the dialogue player: each turn gets its own
// independently-playable clip, so the client can play them sequentially
// with a highlighted "active" line, or jump straight to any single line.
// A plain concatenated blob (like /api/tts returns) can't support either
// of those. Every clip is the turn's shared cached take (resolveDialogTurns),
// the same one the admin hears in "Tes giliran ini".
router.get('/tts/dialog', optionalAuth, ttsLimiter, asyncHandler(async (req, res) => {
  const text = String(req.query.text || '').trim();
  if (!text) return res.status(400).json({ error: 'text required' });
  if (text.length > MAX_TEXT_LEN) return res.status(400).json({ error: 'text too long' });

  const known = await query(
    `SELECT 1 WHERE EXISTS (SELECT 1 FROM module_vocabulary WHERE japanese = $1 OR reading = $1)
                OR EXISTS (SELECT 1 FROM vocabulary_examples WHERE japanese = $1 OR reading = $1)
                OR EXISTS (SELECT 1 FROM quiz_questions WHERE audio_script = $1 AND assessment_meta->>'version' IS NULL AND audio_scene IS NULL)
                OR EXISTS (SELECT 1 FROM module_grammar WHERE example_dialog = $1 OR example = $1)
                OR EXISTS (SELECT 1 FROM grammar_examples WHERE japanese = $1)
                OR EXISTS (SELECT 1 FROM kana_items WHERE character = $1)
                OR EXISTS (SELECT 1 FROM kana_examples WHERE japanese = $1 OR reading = $1)
     LIMIT 1`,
    [text]
  );
  if (known.rows.length === 0) return res.status(403).json({ error: 'unknown text' });

  const turns = parseDialog(text);
  if (!turns) return res.status(400).json({ error: 'not_a_dialog' });
  let scene = null, furigana = null;
  if (req.query.grammarId) {
    if (!isCanonicalUuid(req.query.grammarId)) return res.status(400).json({error: 'invalid grammarId'});
    const grammar = await query('SELECT dialog_scene, dialog_furigana FROM module_grammar WHERE id = $1 AND example_dialog = $2', [req.query.grammarId, text]);
    if (!grammar.rows.length) return res.status(409).json({error: 'dialog_changed'});
    scene = grammar.rows[0].dialog_scene;
    furigana = grammar.rows[0].dialog_furigana || null;
  }
  const registry = await loadSpeakerRegistry();
  let turnVoices;
  try { turnVoices = sceneTurnVoices(turns, scene, (t, i) => voiceForSpeaker(t.speaker, i, registry)); }
  catch (err) { return res.status(422).json({error: 'dialog_voice_missing', detail: err.message}); }

  let audio;
  try {
    audio = await resolveDialogTurns({ turns, turnVoices, dialogText: text, scene, furigana });
  } catch (err) {
    if (err.code === 'tts_disabled') return res.status(503).json({ error: 'tts_disabled' });
    console.error('TTS dialog upstream:', err.message);
    return res.status(502).json({ error: 'tts_upstream' });
  }
  return res.json({
    format: 'dialog-segments-v1',
    segments: turns.map((turn, i) => ({
      speaker: turn.speaker,
      role: turnVoices[i].role,
      audio_base64: audio[i].toString('base64'),
      content_type: 'audio/mpeg',
    })),
  });
}));

// GET /api/tts/version — public, untuk frontend append `?v=` ke URL TTS
// supaya browser HTTP cache invalidate kalau settings_version berubah.
router.get('/tts/version', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300'); // small TTL biar bump nyebar dalam ~5 menit.
  res.json({ version: SETTINGS_VERSION });
});

export default router;
