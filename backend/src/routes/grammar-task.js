import { Router } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { asyncHandler, requireAuth } from '../middleware.js';
import { userCanAccessCourse } from '../entitlements.js';
import { callClaude, ANTHROPIC_MODEL, anthropicEnabled } from '../anthropic.js';

const router = Router();

// ---- AI evaluation (Anthropic) ----
// Menilai kalimat bebas buatan siswa (pakai pola grammar tertentu). Tidak ada
// satu "jawaban benar" tetap → AI yang menilai gramatikal + pemakaian pola.
// ANTHROPIC_API_KEY opsional (bukan REQUIRED_ENV): kosong → 503, frontend
// fallback ke pesan "penilaian nonaktif". Prompt template editable admin
// (app_settings.grammar_eval_prompt), placeholder diisi per evaluasi. Hasil
// di-cache (kalimat identik per grammar tidak panggil AI lagi).
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
beri versi koreksi kalimatnya dalam bahasa Jepang.`;

// Kontrak output — SENGAJA di luar template yang bisa di-edit admin.
//
// Kalau bentuk JSON ikut ditaruh di app_settings.grammar_eval_prompt, admin
// yang menyimpan prompt versi lama akan diam-diam mematikan seluruh klasifikasi
// error (model cuma balas 4 field lama) — persis "jebakan prompt membeku" yang
// sudah pernah kena di generator soal (lihat migration 033 / CLAUDE.md). Jadi:
// pedagogi & nada tetap milik admin, bentuk datanya milik server.
//
// Taksonomi sengaja PENDEK dan bertingkat keyakinan: model diminta memilih
// "other" saat ragu daripada menebak tipe yang spesifik. Klasifikasi ini hanya
// dipakai untuk satu kalimat saran; model mastery digerakkan `passed`, jadi
// taksonomi yang berisik tidak merusak analisisnya.
const GRAMMAR_ERROR_TYPES = [
  'wrong_particle',
  'wrong_conjugation',
  'wrong_word_order',
  'missing_element',
  'extra_element',
  'wrong_grammar_pattern',
  'meaning_mismatch',
  'unnatural_but_grammatical',
  'vocabulary_issue',
  'transcription_issue',
  'other',
];
const ERROR_TYPE_SET = new Set(GRAMMAR_ERROR_TYPES);
const SEVERITIES = new Set(['none', 'minor', 'major']);
const CONCEPT_SIGNALS = new Set(['solid', 'shaky', 'not_used']);

const OUTPUT_CONTRACT = `

--- FORMAT JAWABAN (WAJIB, abaikan format lain yang disebut di atas) ---
Balas HANYA satu objek JSON valid, tanpa teks lain, dengan kunci persis ini:
{
  "correct": boolean,
  "usesPattern": boolean,
  "feedback": "string Bahasa Indonesia, maksimal 2 kalimat",
  "correction": "string Jepang; kosongkan kalau kalimat siswa sudah benar",
  "grammarScore": bilangan bulat 0-100,
  "errorTypes": ["..."],
  "primaryError": "..." atau null,
  "severity": "none" | "minor" | "major",
  "conceptSignal": "solid" | "shaky" | "not_used"
}

Tipe kesalahan yang boleh dipakai (JANGAN mengarang tipe lain):
${GRAMMAR_ERROR_TYPES.join(', ')}

Aturan klasifikasi:
- Kalau kamu tidak yakin tipe kesalahannya, pakai "other". Menebak tipe yang
  spesifik lebih buruk daripada mengaku tidak yakin.
- Kesalahan tata bahasa (partikel, konjugasi, urutan kata, pemilihan pola)
  TIDAK BOLEH diberi tipe "vocabulary_issue". "vocabulary_issue" hanya untuk
  kata yang salah arti atau tidak ada dalam bahasa Jepang — bukan untuk bentuk
  kata yang salah.
- "transcription_issue" hanya kalau teksnya jelas hasil salah dengar mesin,
  bukan kesalahan siswa.
- conceptSignal: "solid" kalau pola target dipakai dengan benar, "shaky" kalau
  dipakai tapi ada kesalahan, "not_used" kalau pola targetnya tidak dipakai.
- Kalau tidak ada kesalahan: errorTypes [], primaryError null, severity "none".

Kalibrasi level: siswa ini pemula JLPT N5/N4. Nilai HANYA pola target dan
kebenaran dasar kalimat. Kalimat sederhana yang benar dan memakai pola target
adalah jawaban yang BENAR — jangan menuntut nuansa lanjutan, kesopanan tingkat
tinggi, kosakata di luar level, atau gaya yang lebih rumit dari contoh guru.`;

// Normalisasi hasil model → bentuk yang aman disimpan & dikirim ke frontend.
// Empat field pertama = kontrak lama yang sudah dipakai welcome.html; sisanya
// tambahan yang boleh null kalau model tidak mengisinya (mis. admin memakai
// template lama yang tidak pernah menyebut field baru).
function normalizeEval(parsed) {
  const p = parsed || {};
  const correct = !!p.correct;
  const usesPattern = !!p.usesPattern;

  let errorTypes = Array.isArray(p.errorTypes) ? p.errorTypes : [];
  errorTypes = [...new Set(
    errorTypes.map((e) => String(e || '').trim().toLowerCase())
      .map((e) => (ERROR_TYPE_SET.has(e) ? e : (e ? 'other' : null)))
      .filter(Boolean)
  )].slice(0, 4);

  let primaryError = String(p.primaryError || '').trim().toLowerCase() || null;
  if (primaryError && !ERROR_TYPE_SET.has(primaryError)) primaryError = 'other';
  if (!primaryError && errorTypes.length > 0) primaryError = errorTypes[0];
  // Lulus = tidak ada kesalahan yang perlu dicatat. Model kadang tetap mengisi
  // primaryError pada kalimat yang ia sendiri nilai benar.
  if (correct && usesPattern) { primaryError = null; }

  let grammarScore = Number.isFinite(Number(p.grammarScore)) ? Math.round(Number(p.grammarScore)) : null;
  if (grammarScore != null) grammarScore = Math.max(0, Math.min(100, grammarScore));

  const severityRaw = String(p.severity || '').trim().toLowerCase();
  const severity = SEVERITIES.has(severityRaw) ? severityRaw : null;
  const signalRaw = String(p.conceptSignal || '').trim().toLowerCase();
  const conceptSignal = CONCEPT_SIGNALS.has(signalRaw) ? signalRaw : null;

  return {
    correct,
    usesPattern,
    feedback: String(p.feedback || '').slice(0, 1000),
    correction: String(p.correction || '').slice(0, 500),
    grammarScore,
    errorTypes,
    primaryError,
    severity,
    conceptSignal,
  };
}

// transcription_issue tidak masuk akal untuk kalimat yang DIKETIK siswa —
// turunkan ke 'other' supaya tidak ada percobaan ketik yang lolos dari
// agregasi mastery (loadMastery membuang percobaan bertipe itu).
// Dipisah dari normalizeEval supaya isi cache tetap bebas-mode: satu kalimat
// identik cukup satu entri cache, apa pun cara siswa memasukkannya.
function applyInputMode(result, inputMode) {
  if (inputMode === 'speech') return result;
  const out = { ...result };
  out.errorTypes = (out.errorTypes || []).map((e) => (e === 'transcription_issue' ? 'other' : e));
  out.errorTypes = [...new Set(out.errorTypes)];
  if (out.primaryError === 'transcription_issue') out.primaryError = 'other';
  return out;
}

// Catat percobaan siswa. Best-effort — pola sama dengan quiz_question_results
// di progress.js: kegagalan menulis riwayat tidak boleh menggagalkan penilaian
// yang sudah selesai di depan siswa.
async function recordAttempt({
  userId, grammarId, lessonId, inputMode, sentence, result, evalSource, model,
}) {
  try {
    await query(
      `INSERT INTO grammar_attempts (
         user_id, grammar_id, lesson_id, source, input_mode, sentence,
         correct, uses_pattern, passed,
         grammar_score, primary_error, error_types, severity, concept_signal,
         feedback, correction, eval_source, model
       ) VALUES ($1,$2,$3,'production',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        userId, grammarId, lessonId || null, inputMode, sentence,
        result.correct, result.usesPattern, result.correct && result.usesPattern,
        result.grammarScore, result.primaryError, result.errorTypes || [],
        result.severity, result.conceptSignal,
        result.feedback || null, result.correction || null, evalSource, model,
      ]
    );
  } catch (err) {
    console.error('grammar_attempts insert failed:', err.message);
  }
}

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

// POST /api/grammar-task/evaluate
// body: { grammarId, lessonId?, sentence, inputMode? }
// Response = superset dari kontrak lama {correct, usesPattern, feedback,
// correction} — frontend yang belum di-deploy ulang tetap jalan apa adanya.
router.post('/grammar-task/evaluate', requireAuth, evalLimiter, asyncHandler(async (req, res) => {
  const { grammarId, lessonId } = req.body || {};
  const sentence = String((req.body || {}).sentence || '').trim();
  const inputMode = (req.body || {}).inputMode === 'speech' ? 'speech' : 'text';
  if (!grammarId) return res.status(400).json({ error: 'grammarId required' });
  if (!sentence) return res.status(400).json({ error: 'sentence required' });
  if (sentence.length > MAX_SENTENCE_LEN) return res.status(400).json({ error: 'sentence too long' });

  // Grounding + anti-abuse: hanya evaluasi terhadap grammar item nyata.
  const g = await query(
    `SELECT g.id, g.pattern, g.meaning, g.example, m.course_id
       FROM module_grammar g
       JOIN modules m ON m.id = g.module_id
      WHERE g.id = $1`,
    [grammarId]
  );
  if (g.rows.length === 0) return res.status(404).json({ error: 'grammar not found' });
  const grammar = g.rows[0];
  // Course access gate (resolved via the grammar item's module, not the
  // client-supplied lessonId, so it can't be bypassed by omitting it) —
  // this is Learning Platform content like any lesson.
  if (!(await userCanAccessCourse(req.user, grammar.course_id))) {
    return res.status(403).json({ error: 'not_enrolled' });
  }

  // Instruksi tugas dari admin (per lesson+grammar), kalau ada — dipakai AI.
  // Sekaligus memastikan lessonId yang disimpan di riwayat memang pelajaran
  // yang benar-benar memuat pola ini (client tidak bisa mengarang atribusi).
  let instruction = '';
  let attemptLessonId = null;
  if (lessonId) {
    const ti = await query(
      `SELECT instruction FROM lesson_grammar_task_items WHERE lesson_id = $1 AND grammar_id = $2`,
      [lessonId, grammarId]
    );
    if (ti.rows.length > 0) {
      instruction = (ti.rows[0].instruction || '').trim();
      attemptLessonId = lessonId;
    }
  }

  // Namespace v2: entri cache lama hanya memuat 4 field kontrak lama. Kalau
  // key-nya tidak dibedakan, kalimat yang pernah dinilai sebelum rilis ini
  // akan selamanya disajikan tanpa klasifikasi error. Biayanya satu panggilan
  // AI sekali per kalimat lama; entri lama jadi dorman, bukan salah.
  const key = crypto.createHash('sha256')
    .update(`grammar-eval-v2|${ANTHROPIC_MODEL}|${grammarId}|${instruction}|${sentence}`)
    .digest('hex');

  let result = null;
  let evalSource = 'cache';
  const cached = await query(`SELECT result FROM grammar_eval_cache WHERE eval_hash = $1`, [key]);
  if (cached.rows.length > 0) {
    query(`UPDATE grammar_eval_cache SET last_used_at = NOW() WHERE eval_hash = $1`, [key]).catch(() => {});
    result = normalizeEval(cached.rows[0].result);
  }

  if (!result) {
    if (!anthropicEnabled()) return res.status(503).json({ error: 'eval_disabled' });

    const tpl = await loadEvalPrompt();
    const userContent = fillTemplate(tpl, {
      pattern: grammar.pattern || '',
      meaning: grammar.meaning || '',
      example: grammar.example || '',
      instruction: instruction || '(bebas — buat kalimat apa saja yang memakai pola ini)',
      sentence,
    }) + OUTPUT_CONTRACT;

    const text = await callClaude({ system: EVAL_SYSTEM, userContent, maxTokens: 700 });
    if (text == null) return res.status(502).json({ error: 'eval_upstream' });
    const parsed = extractJson(text);
    if (!parsed) return res.status(502).json({ error: 'eval_parse' });

    result = normalizeEval(parsed);
    evalSource = 'ai';
    // Cache menyimpan hasil BEBAS-MODE (lihat applyInputMode) supaya satu
    // kalimat identik cukup satu entri, diketik maupun diucapkan.
    await query(
      `INSERT INTO grammar_eval_cache (eval_hash, grammar_id, sentence, result, model)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (eval_hash) DO NOTHING`,
      [key, grammarId, sentence, JSON.stringify(result), ANTHROPIC_MODEL]
    );
  }

  const finalResult = applyInputMode(result, inputMode);

  // DI LUAR cabang cache — kalau pencatatan ikut di dalamnya, kalimat yang
  // kebetulan sama dengan kalimat siswa lain akan hilang total dari analisis.
  await recordAttempt({
    userId: req.user.id,
    grammarId,
    lessonId: attemptLessonId,
    inputMode,
    sentence,
    result: finalResult,
    evalSource,
    model: ANTHROPIC_MODEL,
  });

  return res.json(finalResult);
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
