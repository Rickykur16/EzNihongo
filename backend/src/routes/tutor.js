import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler, requireAuth } from '../middleware.js';

const router = Router();

// ---- AI Senpai chat tutor (Anthropic) ----
// Chat tutor bahasa Jepang untuk siswa login. Multi-turn: frontend kirim seluruh
// riwayat pesan (cap 20 terakhir) + konteks pelajaran aktif; server menambah
// system prompt persona "Senpai" lalu memanggil Claude. Tidak ada cache DB
// (multi-turn → cache tak berguna) dan tidak ada riwayat tersimpan di server
// (frontend simpan di sessionStorage). ANTHROPIC_API_KEY opsional (bukan
// REQUIRED_ENV): kosong → 503, frontend fallback ke pesan "AI nonaktif".
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';
const MAX_MESSAGES = 20;
const MAX_CONTENT_LEN = 2000;

// System statis (cacheable) — persona inti yang tak berubah antar percakapan.
const TUTOR_SYSTEM = `Kamu adalah "Maneko-chan", maskot kucing tutor bahasa Jepang yang ramah dan sabar di aplikasi belajar EzNihongo. Muridmu orang Indonesia, kebanyakan level pemula (JLPT N5/N4).

Aturan:
- Jawab dalam Bahasa Indonesia yang hangat dan ringkas. Jangan bertele-tele.
- Kalau menulis bahasa Jepang, sertakan cara baca (kana/romaji) dan arti singkat.
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
  if (!ANTHROPIC_API_KEY) return res.status(503).json({ error: 'tutor_disabled' });

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

  let reply;
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
        max_tokens: 700,
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages,
      }),
    });
    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      console.error('Anthropic tutor:', upstream.status, detail.slice(0, 200));
      return res.status(502).json({ error: 'tutor_upstream' });
    }
    const data = await upstream.json();
    reply = Array.isArray(data.content)
      ? data.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
      : '';
  } catch (err) {
    console.error('Anthropic tutor error:', err.message);
    return res.status(502).json({ error: 'tutor_upstream' });
  }

  if (!reply) return res.status(502).json({ error: 'tutor_empty' });
  return res.json({ reply });
}));

export default router;
