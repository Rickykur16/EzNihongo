import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler, requireAuth } from '../middleware.js';
import { anthropicEnabled, callClaude, callClaudeStream, ANTHROPIC_TUTOR_MODEL } from '../anthropic.js';

const router = Router();

// ---- AI Senpai chat tutor (Anthropic) ----
// Chat tutor bahasa Jepang untuk siswa login. Multi-turn: frontend kirim seluruh
// riwayat pesan (cap 20 terakhir) + konteks pelajaran aktif; server menambah
// system prompt persona "Senpai" lalu memanggil Claude via callClaude()
// (model ANTHROPIC_TUTOR_MODEL, default sonnet — haiku halusinasi di
// penjelasan linguistik). Tidak ada cache DB (multi-turn → cache tak berguna)
// dan tidak ada riwayat tersimpan di server (frontend simpan di
// sessionStorage). ANTHROPIC_API_KEY opsional (bukan REQUIRED_ENV):
// kosong → 503, frontend fallback ke pesan "AI nonaktif".
const MAX_MESSAGES = 20;
const MAX_CONTENT_LEN = 2000;
// Pagar keras panjang jawaban — bubble chat kecil, jawaban panjang malah
// susah dibaca (plus meredam biaya output sonnet).
const MAX_REPLY_TOKENS = 500;

// System statis (cacheable) — persona inti yang tak berubah antar percakapan.
const TUTOR_SYSTEM = `Kamu adalah "Maneko-chan", maskot kucing tutor bahasa Jepang yang ramah dan sabar di aplikasi belajar EzNihongo. Muridmu orang Indonesia, kebanyakan level pemula (JLPT N5/N4).

Aturan:
- Jawab dalam Bahasa Indonesia yang hangat dan ringkas. Jangan bertele-tele.
- Jawab SINGKAT — maksimal sekitar 6 kalimat atau 5 poin. Pakai bahasa sehari-hari yang mudah dipahami pemula; hindari istilah linguistik teknis tanpa penjelasan singkat. Cukup 1-2 contoh terbaik, jangan borong semua contoh. Kalau topiknya luas, jawab intinya dulu lalu tawarkan lanjutan (misal "mau kujelasin lebih dalam?").
- Gaya chat: pecah jawabanmu jadi 1-3 pesan pendek yang dipisah SATU BARIS KOSONG — tiap bagian tampil sebagai bubble chat terpisah (seperti WhatsApp). Jangan kirim satu blok teks panjang. Baris-baris daftar (-) tetap dalam satu bagian yang sama.
- Jangan pakai format markdown (asterisk **, heading #, dsb) — tampilan chat tidak mendukungnya. Tulis teks polos; untuk daftar pakai tanda hubung (-).
- Kalau menulis bahasa Jepang, sertakan cara baca (kana/romaji) dan arti singkat.
- Pastikan setiap contoh kata/kalimat Jepang benar-benar mengandung konsep yang sedang dijelaskan dan artinya akurat. Kalau tidak yakin, jangan beri contoh itu.
- Beri contoh kalimat yang relevan dengan level pemula bila membantu.
- Fokus pada belajar bahasa Jepang (grammar, kosakata, kanji, budaya, tips belajar). Kalau ditanya hal di luar topik itu, arahkan kembali dengan sopan.
- Dorong murid dengan nada positif, seperti senpai yang suportif.`;

const tutorLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down' },
});

// Bersihkan + batasi pesan dari klien: hanya role user/assistant, content string.
function sanitizeMessages(raw) {
  if (!Array.isArray(raw)) return null;
  const cleaned = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue;
    const role = m.role === 'assistant' ? 'assistant' : m.role === 'user' ? 'user' : null;
    const content = String(m.content || '').trim();
    if (!role || !content) continue;
    cleaned.push({ role, content: content.slice(0, MAX_CONTENT_LEN) });
  }
  // Ambil hanya N pesan terakhir, dan pastikan diakhiri oleh pesan user.
  const tail = cleaned.slice(-MAX_MESSAGES);
  while (tail.length && tail[tail.length - 1].role !== 'user') tail.pop();
  return tail;
}

// POST /api/tutor/chat  body: { messages: [{role, content}], context?: { level, lesson } }
router.post('/tutor/chat', requireAuth, tutorLimiter, asyncHandler(async (req, res) => {
  if (!anthropicEnabled()) return res.status(503).json({ error: 'tutor_disabled' });

  const messages = sanitizeMessages((req.body || {}).messages);
  if (!messages || messages.length === 0) {
    return res.status(400).json({ error: 'messages required' });
  }

  const ctx = (req.body || {}).context || {};
  const level = String(ctx.level || '').slice(0, 20).trim();
  const lesson = String(ctx.lesson || '').slice(0, 200).trim();
  const system = TUTOR_SYSTEM + (lesson
    ? `\n\nKonteks: murid sedang membuka pelajaran ${level ? level + ' — ' : ''}"${lesson}". Kaitkan jawaban dengan konteks ini bila relevan.`
    : '');

  // Streaming (body.stream === true): balasan dikirim sebagai chunked text
  // begitu tiba dari Claude, biar di frontend muncul mengalir seperti orang
  // ngetik. Frontend lama yang tidak kirim flag ini tetap dapat JSON biasa.
  if ((req.body || {}).stream === true) {
    let started = false;
    const startStream = () => {
      if (started) return;
      started = true;
      res.status(200);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      // Tanpa ini nginx menahan (buffer) respons proxy sampai selesai —
      // streaming-nya jadi percuma.
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
    };
    const full = await callClaudeStream({
      system,
      messages,
      maxTokens: MAX_REPLY_TOKENS,
      model: ANTHROPIC_TUTOR_MODEL,
      onText: (t) => { startStream(); res.write(t); },
    });
    // Belum ada byte terkirim → masih bisa balas error JSON seperti biasa.
    if (!started) {
      return res.status(502).json({ error: full === null ? 'tutor_upstream' : 'tutor_empty' });
    }
    return res.end();
  }

  const reply = await callClaude({
    system,
    messages,
    maxTokens: MAX_REPLY_TOKENS,
    model: ANTHROPIC_TUTOR_MODEL,
  });
  // callClaude balikin null saat upstream gagal (error sudah di-log di helper).
  if (reply === null) return res.status(502).json({ error: 'tutor_upstream' });
  if (!reply) return res.status(502).json({ error: 'tutor_empty' });
  return res.json({ reply });
}));

export default router;
