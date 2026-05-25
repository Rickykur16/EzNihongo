import { Router } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { asyncHandler, requireAuth } from '../middleware.js';

const router = Router();

// ---- AI evaluation (Anthropic) ----
// Menilai kalimat bebas buatan siswa (pakai pola grammar tertentu). Tidak ada
// satu "jawaban benar" tetap → AI yang menilai gramatikal + pemakaian pola.
// ANTHROPIC_API_KEY opsional (bukan REQUIRED_ENV): kosong → 503, frontend
// fallback ke pesan "penilaian nonaktif". Prompt template editable admin
// (app_settings.grammar_eval_prompt), placeholder diisi per evaluasi. Hasil
// di-cache (kalimat identik per grammar tidak panggil AI lagi).
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';
const MAX_SENTENCE_LEN = 200;

// System statis (cacheable) — instruksi inti yang tak berubah antar evaluasi.
const EVAL_SYSTEM = `You are a meticulous Japanese-language teacher grading short sentences written by Indonesian students. Always reply with a single valid JSON object and nothing else.`;

const DEFAULT_PROMPT = `Kamu adalah guru bahasa Jepang yang menilai kalimat buatan siswa.

Pola grammar target: {{pattern}}
Arti pola: {{meaning}}
Contoh: {{example}}
Instruksi tugas dari guru: {{instruction}}

Kalimat siswa: {{sentence}}

Nilai apakah kalimat siswa (1) gramatikal/benar sebagai bahasa Jepang,
(2) benar-benar memakai pola grammar target, dan (3) sesuai instruksi tugas.
Beri umpan balik singkat dalam bahasa Indonesia yang membangun, dan kalau perlu
beri versi koreksi kalimatnya dalam bahasa Jepang.

Jawab HANYA dengan JSON valid (tanpa teks lain) berbentuk:
{"correct": boolean, "usesPattern": boolean, "feedback": "string Indonesia", "correction": "string Jepang atau kosong"}`;

async function loadEvalPrompt() {
  try {
    const r = await query(`SELECT value FROM app_settings WHERE key = 'grammar_eval_prompt'`);
    const v = r.rows[0]?.value;
    return (v && v.trim()) ? v : DEFAULT_PROMPT;
  } catch {
    return DEFAULT_PROMPT;
  }
}

function fillTemplate(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_m, k) => (vars[k] != null ? String(vars[k]) : ''));
}

// Ambil objek JSON pertama dari teks model (kalau model nambahin prosa).
function extractJson(text) {
  const s = String(text || '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try { return JSON.parse(s.slice(start, end + 1)); } catch { return null; }
}

const evalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down' },
});

// POST /api/grammar-task/evaluate  body: { grammarId, sentence }
router.post('/grammar-task/evaluate', requireAuth, evalLimiter, asyncHandler(async (req, res) => {
  const { grammarId, lessonId } = req.body || {};
  const sentence = String((req.body || {}).sentence || '').trim();
  if (!grammarId) return res.status(400).json({ error: 'grammarId required' });
  if (!sentence) return res.status(400).json({ error: 'sentence required' });
  if (sentence.length > MAX_SENTENCE_LEN) return res.status(400).json({ error: 'sentence too long' });

  // Grounding + anti-abuse: hanya evaluasi terhadap grammar item nyata.
  const g = await query(
    `SELECT id, pattern, meaning, example FROM module_grammar WHERE id = $1`,
    [grammarId]
  );
  if (g.rows.length === 0) return res.status(404).json({ error: 'grammar not found' });
  const grammar = g.rows[0];

  // Instruksi tugas dari admin (per lesson+grammar), kalau ada — dipakai AI.
  let instruction = '';
  if (lessonId) {
    const ti = await query(
      `SELECT instruction FROM lesson_grammar_task_items WHERE lesson_id = $1 AND grammar_id = $2`,
      [lessonId, grammarId]
    );
    instruction = (ti.rows[0]?.instruction || '').trim();
  }

  const key = crypto.createHash('sha256')
    .update(`grammar-eval|${ANTHROPIC_MODEL}|${grammarId}|${instruction}|${sentence}`)
    .digest('hex');
  const cached = await query(`SELECT result FROM grammar_eval_cache WHERE eval_hash = $1`, [key]);
  if (cached.rows.length > 0) {
    query(`UPDATE grammar_eval_cache SET last_used_at = NOW() WHERE eval_hash = $1`, [key]).catch(() => {});
    return res.json(cached.rows[0].result);
  }

  if (!ANTHROPIC_API_KEY) return res.status(503).json({ error: 'eval_disabled' });

  const tpl = await loadEvalPrompt();
  const userContent = fillTemplate(tpl, {
    pattern: grammar.pattern || '',
    meaning: grammar.meaning || '',
    example: grammar.example || '',
    instruction: instruction || '(bebas — buat kalimat apa saja yang memakai pola ini)',
    sentence,
  });

  let parsed;
  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 512,
        system: [{ type: 'text', text: EVAL_SYSTEM, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userContent }],
      }),
    });
    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      console.error('Anthropic eval:', upstream.status, detail.slice(0, 200));
      return res.status(502).json({ error: 'eval_upstream' });
    }
    const data = await upstream.json();
    const text = Array.isArray(data.content)
      ? data.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
      : '';
    parsed = extractJson(text);
  } catch (err) {
    console.error('Anthropic eval error:', err.message);
    return res.status(502).json({ error: 'eval_upstream' });
  }
  if (!parsed) return res.status(502).json({ error: 'eval_parse' });

  const result = {
    correct: !!parsed.correct,
    usesPattern: !!parsed.usesPattern,
    feedback: String(parsed.feedback || '').slice(0, 1000),
    correction: String(parsed.correction || '').slice(0, 500),
  };

  await query(
    `INSERT INTO grammar_eval_cache (eval_hash, grammar_id, sentence, result, model)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT (eval_hash) DO NOTHING`,
    [key, grammarId, sentence, JSON.stringify(result), ANTHROPIC_MODEL]
  );
  return res.json(result);
}));

// ---- Speech-to-text (ElevenLabs Scribe) ----
// Terima rekaman dari MediaRecorder browser → transkrip teks Jepang. Pakai
// ELEVENLABS_API_KEY yang sudah ada (kosong → 503, frontend fallback ke ketik).
const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVEN_STT_MODEL = process.env.ELEVENLABS_STT_MODEL || 'scribe_v1';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

const sttLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down' },
});

// POST /api/grammar-task/transcribe  multipart: audio=<file>
router.post('/grammar-task/transcribe', requireAuth, sttLimiter, upload.single('audio'),
  asyncHandler(async (req, res) => {
    if (!req.file || !req.file.buffer?.length) return res.status(400).json({ error: 'audio required' });
    if (!ELEVEN_API_KEY) return res.status(503).json({ error: 'stt_disabled' });

    const form = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype || 'audio/webm' });
    form.append('file', blob, req.file.originalname || 'speech.webm');
    form.append('model_id', ELEVEN_STT_MODEL);
    form.append('language_code', 'jpn');

    try {
      const upstream = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST',
        headers: { 'xi-api-key': ELEVEN_API_KEY },
        body: form,
      });
      if (!upstream.ok) {
        const detail = await upstream.text().catch(() => '');
        console.error('ElevenLabs STT:', upstream.status, detail.slice(0, 200));
        // Key TTS-only / plan tanpa akses Scribe → 401/403. Perlakukan sebagai
        // STT nonaktif supaya frontend tampilkan "ketik saja", bukan error.
        if (upstream.status === 401 || upstream.status === 403) {
          return res.status(503).json({ error: 'stt_disabled' });
        }
        return res.status(502).json({ error: 'stt_upstream' });
      }
      const data = await upstream.json();
      return res.json({ text: String(data.text || '').trim() });
    } catch (err) {
      console.error('ElevenLabs STT error:', err.message);
      return res.status(502).json({ error: 'stt_upstream' });
    }
  })
);

export default router;
