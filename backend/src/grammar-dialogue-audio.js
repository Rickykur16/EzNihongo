import crypto from 'node:crypto';
import { prepareDialogue, dialogueTimings, ROLES } from '../../src/grammar-dialogue-core.js';

// Bump whenever spoken input or voice settings change, so a cached fingerprint
// never stands in for audio a different pipeline would have produced.
export const AUDIO_PIPELINE_VERSION = 'grammar-dialogue-2';
export function defaultDialogueVoices(env = process.env) {
  return {
    N: env.ELEVENLABS_VOICE_NARRATOR || env.ELEVENLABS_VOICE_ID || '',
    A: env.ELEVENLABS_VOICE_FEMALE || env.ELEVENLABS_VOICE_ID || '',
    B: env.ELEVENLABS_VOICE_MALE || env.ELEVENLABS_VOICE_ID || '',
  };
}
export function audioFingerprint(draft, engine, takeId) {
  return crypto.createHash('sha256').update(JSON.stringify({
    pipeline: AUDIO_PIPELINE_VERSION, draft, engine, takeId,
  })).digest('hex');
}
export function providerError(status, detail) {
  const message = String(detail?.message || '');
  const code = detail?.status || detail?.code;
  if (code === 'missing_permissions') {
    const permission = message.match(/\b(?:voices_read|voices_write|text_to_speech)\b/)?.[0];
    return 'Izin ElevenLabs kurang' + (permission ? ': ' + permission : '') + '. Periksa izin API key.';
  }
  if (status === 401) return 'Autentikasi ElevenLabs gagal. Periksa API key di server.';
  if (status === 403) return 'Akses suara ditolak. Periksa My Voices dan izin akun ElevenLabs.';
  if (status === 402 || code === 'quota_exceeded') return 'Kuota ElevenLabs tidak mencukupi.';
  if (status === 429) return 'ElevenLabs sedang membatasi permintaan. Coba beberapa saat lagi.';
  return 'Generasi ElevenLabs gagal (HTTP ' + status + '). Konfigurasi terpublikasi tidak berubah.';
}

// Copied verbatim from VOICE_SETTINGS in routes/tts.js, where they were tuned by
// ear for this exact material: dialogue speakers get low stability + real style so
// the delivery follows the sentence instead of reciting it, and a sub-1.0 speed to
// match JLPT listening pace. That module is a Router with load-time side effects
// (rate limiter, env reads, db import) and does not export these, so they are
// duplicated here rather than imported — keep the two in sync by hand.
const DIALOGUE_VOICE_SETTINGS = {
  narrator: { stability: 0.55, similarity_boost: 0.8, style: 0, use_speaker_boost: true, speed: 0.95 },
  female: { stability: 0.35, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true, speed: 0.92 },
  male: { stability: 0.35, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true, speed: 0.92 },
};

// Never retry paid generation automatically: an interrupted request may have been charged.
export async function generateDialogueAudio(raw, engine, {
  apiKey = process.env.ELEVENLABS_API_KEY, voices = defaultDialogueVoices(), fetcher = fetch,
} = {}) {
  if (!apiKey) throw new Error('API key ElevenLabs belum tersedia di server.');
  if (!['dialogue-v3', 'turns-v2'].includes(engine)) throw new Error('Mesin audio tidak valid.');
  const { draft, inputs } = prepareDialogue(raw, voices, engine);
  async function request(url, body) {
    let response;
    try {
      response = await fetcher(url, {
        method: 'POST', headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(90000),
      });
    } catch {
      throw new Error('Koneksi generasi terputus. Periksa riwayat sebelum membuat ulang; permintaan mungkin sudah menggunakan kredit.');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(providerError(response.status, data.detail));
    if (typeof data.audio_base64 !== 'string' || data.audio_base64.length > 28000000) throw new Error('Data audio ElevenLabs tidak valid.');
    return data;
  }
  if (engine === 'dialogue-v3') {
    const data = await request('https://api.elevenlabs.io/v1/text-to-dialogue/with-timestamps?output_format=mp3_44100_128', {
      inputs, model_id: 'eleven_v3', language_code: 'ja', apply_text_normalization: 'off',
    });
    const audio = Buffer.from(data.audio_base64, 'base64');
    if (!audio.length) throw new Error('Audio kosong.');
    return { audio, alignment: { mode: 'continuous', turns: dialogueTimings(data.voice_segments, draft.turns) } };
  }
  // Baseline for an A/B audition with identical, reviewed kana input.
  const buffers = [], turns = [];
  let offset = 0;
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const data = await request('https://api.elevenlabs.io/v1/text-to-speech/' +
      encodeURIComponent(input.voice_id) + '/with-timestamps?output_format=mp3_44100_128', {
      text: input.text, model_id: 'eleven_multilingual_v2', apply_text_normalization: 'off',
      voice_settings: DIALOGUE_VOICE_SETTINGS[ROLES[draft.turns[i].speaker]],
    });
    const audio = Buffer.from(data.audio_base64, 'base64');
    const endTimes = data.alignment?.character_end_times_seconds;
    if (!audio.length || !Array.isArray(endTimes) || !endTimes.length ||
      endTimes.some(t => !Number.isFinite(t) || t < 0) || Math.max(...endTimes) <= 0) throw new Error('Timestamp ucapan tidak tersedia.');
    // Separate MP3 ranges, not approximate global timestamps from byte lengths.
    turns.push({ id: draft.turns[i].id, start: 0, end: Math.max(...endTimes), byteStart: offset, byteEnd: offset + audio.length });
    buffers.push(audio); offset += audio.length;
  }
  return { audio: Buffer.concat(buffers), alignment: { mode: 'segments', turns } };
}

export function sendAudioBytes(req, res, buffer, hash, publicAudio = false) {
  res.set('Content-Type', 'audio/mpeg');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cache-Control', publicAudio ? 'public, max-age=31536000, immutable' : 'private, no-store');
  res.set('Accept-Ranges', 'bytes');
  res.set('ETag', '"' + hash + '"');
  if (!req.headers.range) return res.send(buffer);
  const match = String(req.headers.range).match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (!match[1] && !match[2])) return res.status(416).set('Content-Range', 'bytes */' + buffer.length).end();
  const start = match[1] ? Number(match[1]) : Math.max(0, buffer.length - Number(match[2]));
  const end = match[1] ? (match[2] ? Math.min(Number(match[2]), buffer.length - 1) : buffer.length - 1) : buffer.length - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= buffer.length) {
    return res.status(416).set('Content-Range', 'bytes */' + buffer.length).end();
  }
  return res.status(206).set('Content-Range', 'bytes ' + start + '-' + end + '/' + buffer.length).send(buffer.subarray(start, end + 1));
}
