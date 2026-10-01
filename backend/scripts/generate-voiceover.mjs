// Voice-over video brand (marketing/brand-video-src) lewat ElevenLabs.
//
// Dijalankan DI VPS oleh workflow "Marketing voice-over" — key ElevenLabs dibaca dari
// backend/.env server dan tidak pernah dicetak / keluar dari server. Keluaran ditulis
// ke --out lalu diambil workflow lewat scp.
//
//   node scripts/generate-voiceover.mjs --mode list
//   node scripts/generate-voiceover.mjs --mode sample   --voices id1,id2 --out /tmp/x
//   node scripts/generate-voiceover.mjs --mode generate --voices id1     --out /tmp/x
//
// list     : cetak suara di akun (id, nama, label) + voice ID yang terpasang di .env
// sample   : baris 1 & 4 untuk tiap suara → sample-<voiceId>-NN.mp3
// generate : 10 baris naskah → vo-NN.mp3 + vo-NN.json (timestamp per karakter)
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

// Naskah lisan (lihat marketing/brand-video-src/voiceover-naskah.md). "EzNihongo" ditulis
// sesuai cara bacanya supaya ElevenLabs tidak salah ucap; caption tetap "EzNihongo".
const LINES = [
  'Ga ada yang bakal ngasih tau kalian hal ini…',
  'Kerja ke Jepang… ga perlu menghabiskan puluhan juta.',
  'Yang paling nentuin itu bahasanya. Dan itu bisa dikejar.',
  'Bootcamp live bareng sensei, dua kali seminggu, selama tiga bulan.',
  'Kelewat kelas? Tenang, ada rekamannya.',
  'Buka dashboard, langsung tau hari ini belajar apa.',
  'Lihat kanjinya, terus dengar cara bacanya.',
  'Yang udah hafal jarang muncul. Yang sering salah, muncul lagi sebelum kamu lupa.',
  'Progresnya kelihatan, di laptop maupun HP.',
  'Kerja ke Jepang? Mulai dari bahasanya. Izi Nihongo.',
];
const MAX_CHARS = 2000; // pagar biaya: satu run tidak boleh lebih dari ini

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']);
  return acc;
}, []));
const mode = args.mode || 'list';
const voices = String(args.voices || '').split(',').map((v) => v.trim()).filter(Boolean);
const out = args.out;
const KEY = process.env.ELEVENLABS_API_KEY;
const MODEL = process.env.ELEVENLABS_VOICEOVER_MODEL || 'eleven_multilingual_v2';
const API = 'https://api.elevenlabs.io/v1';

function fail(msg) { console.error('FATAL:', msg); process.exit(1); }
if (!KEY) fail('ELEVENLABS_API_KEY kosong di backend/.env');
if (!['list', 'sample', 'generate'].includes(mode)) fail(`mode tidak dikenal: ${mode}`);
if (voices.some((v) => !/^[A-Za-z0-9]{10,40}$/.test(v))) fail('format voice ID tidak valid');

async function api(pathname, init = {}) {
  const res = await fetch(API + pathname, { ...init, headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  if (!res.ok) fail(`${init.method || 'GET'} ${pathname} → ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function tts(voiceId, index, file) {
  const body = {
    text: LINES[index],
    model_id: MODEL,
    previous_text: LINES[index - 1] || undefined,
    next_text: LINES[index + 1] || undefined,
    voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true },
  };
  const data = await api(`/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`, { method: 'POST', body: JSON.stringify(body) });
  fs.writeFileSync(file + '.mp3', Buffer.from(data.audio_base64, 'base64'));
  fs.writeFileSync(file + '.json', JSON.stringify({ voiceId, model: MODEL, text: LINES[index], alignment: data.alignment }, null, 1));
  console.log(`ok ${path.basename(file)} (${LINES[index].length} karakter)`);
}

if (mode === 'list') {
  const { voices: list } = await api('/voices');
  const configured = Object.fromEntries(['NARRATOR', 'FEMALE', 'MALE', 'ID'].map((k) => [process.env[`ELEVENLABS_VOICE_${k}`] || '', k]));
  for (const v of list) {
    const labels = Object.entries(v.labels || {}).map(([k, x]) => `${k}=${x}`).join(' ');
    const langs = (v.verified_languages || []).map((l) => `${l.language}${l.accent ? '/' + l.accent : ''}`).join(',');
    const tag = configured[v.voice_id] ? ` [.env: ${configured[v.voice_id]}]` : '';
    console.log(`${v.voice_id} | ${v.name} | ${v.category || ''} | ${labels}${langs ? ' | bahasa: ' + langs : ''}${tag}`);
    if (v.description) console.log(`    ${String(v.description).replace(/\s+/g, ' ').slice(0, 200)}`);
  }
  process.exit(0);
}

if (!out || !/^\/tmp\/ezvo-[0-9a-z-]+$/.test(out)) fail('--out wajib, berbentuk /tmp/ezvo-<id>');
if (!voices.length) fail('--voices wajib untuk mode ini');
fs.mkdirSync(out, { recursive: true });

const jobs = mode === 'sample'
  ? voices.flatMap((v) => [0, 3].map((i) => [v, i, path.join(out, `sample-${v}-${String(i + 1).padStart(2, '0')}`)]))
  : (voices.length === 1 ? LINES.map((_, i) => [voices[0], i, path.join(out, `vo-${String(i + 1).padStart(2, '0')}`)]) : fail('mode generate butuh tepat satu voice ID'));
const chars = jobs.reduce((n, [, i]) => n + LINES[i].length, 0);
if (chars > MAX_CHARS) fail(`total ${chars} karakter melebihi pagar ${MAX_CHARS}`);
console.log(`mode=${mode} model=${MODEL} klip=${jobs.length} total=${chars} karakter`);
for (const [v, i, file] of jobs) await tts(v, i, file);
