// Suara dari ElevenLabs. Model & suara dicari lewat API (bukan ditebak),
// bisa di-override lewat ELEVENLABS_MODEL / ELEVENLABS_VOICE_ID.
const API = 'https://api.elevenlabs.io';

function key() {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error('ELEVENLABS_API_KEY belum diisi di .env.');
  return k;
}

async function call(pathname, init = {}) {
  const res = await fetch(API + pathname, {
    ...init,
    headers: { 'xi-api-key': key(), 'content-type': 'application/json', ...(init.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`ElevenLabs ${res.status} di ${pathname}: ${body.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return res;
}

// "v4" → cari model yang id/namanya memuat v4. Gagal → tampilkan daftar model yang ada.
export async function resolveModel() {
  if (process.env.ELEVENLABS_MODEL) return process.env.ELEVENLABS_MODEL;
  const want = (process.env.ELEVENLABS_MODEL_HINT || 'v4').toLowerCase();
  const models = await (await call('/v1/models')).json();
  const hit = models.find((m) => m.model_id.toLowerCase().includes(want) || (m.name || '').toLowerCase().includes(want));
  if (!hit) {
    throw new Error(`Model ElevenLabs "${want}" tidak ditemukan. Yang tersedia: ${models.map((m) => m.model_id).join(', ')}. Isi ELEVENLABS_MODEL di .env.`);
  }
  return hit.model_id;
}

// Suara "Jessica" (label: playful, bright, warm).
export async function resolveVoice() {
  if (process.env.ELEVENLABS_VOICE_ID) return process.env.ELEVENLABS_VOICE_ID;
  const name = (process.env.ELEVENLABS_VOICE_NAME || 'Jessica').toLowerCase();
  const { voices } = await (await call(`/v2/voices?search=${encodeURIComponent(name)}&page_size=50`)).json();
  const hit = (voices || []).find((v) => (v.name || '').toLowerCase().startsWith(name));
  if (!hit) throw new Error(`Suara "${name}" tidak ditemukan di akun ElevenLabs. Isi ELEVENLABS_VOICE_ID di .env.`);
  return hit.voice_id;
}

export const VOICE_SETTINGS = {
  stability: Number(process.env.ELEVENLABS_STABILITY ?? 0.35),
  similarity_boost: 0.75,
  style: Number(process.env.ELEVENLABS_STYLE ?? 0.35),
  use_speaker_boost: true,
  speed: Number(process.env.ELEVENLABS_SPEED ?? 1.05),
};

// Satu take utuh + alignment per karakter.
export async function ttsWithTimestamps(text, { voiceId, modelId }) {
  const res = await call(`/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    body: JSON.stringify({ text, model_id: modelId, voice_settings: VOICE_SETTINGS }),
  });
  const json = await res.json();
  const alignment = json.alignment || json.normalized_alignment;
  if (!json.audio_base64 || !alignment?.character_start_times_seconds?.length) {
    throw Object.assign(new Error('Respons ElevenLabs tanpa alignment.'), { status: 422 });
  }
  return { audio: Buffer.from(json.audio_base64, 'base64'), alignment };
}

// Cadangan: audio biasa tanpa timestamp.
export async function tts(text, { voiceId, modelId }) {
  const res = await call(`/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: 'POST',
    body: JSON.stringify({ text, model_id: modelId, voice_settings: VOICE_SETTINGS }),
  });
  return Buffer.from(await res.arrayBuffer());
}
