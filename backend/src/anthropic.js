// Helper tipis untuk Anthropic Messages API. Pola fetch ini sebelumnya
// di-copy di tutor.js / grammar-task.js / admin.js (generate soal). Helper
// baru ini dipakai fitur belajar adaptif (catatan coaching). Call-site lama
// dibiarkan dulu — migrasi ke helper ini bisa jadi follow-up terpisah.
//
// ANTHROPIC_API_KEY opsional (bukan REQUIRED_ENV): kalau kosong ATAU upstream
// gagal, callClaude() mengembalikan null supaya pemanggil bisa degradasi anggun
// (mis. rekomendasi tetap jalan dengan catatan berbasis-aturan).

export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

export function anthropicEnabled() {
  return !!ANTHROPIC_API_KEY;
}

// Mengembalikan teks balasan asisten (string), atau null kalau nonaktif/gagal.
// `system` di-kirim dengan cache_control ephemeral (cacheable prompt prefix).
export async function callClaude({ system, userContent, messages, maxTokens = 512 }) {
  if (!ANTHROPIC_API_KEY) return null;
  const msgs = Array.isArray(messages) && messages.length
    ? messages
    : [{ role: 'user', content: String(userContent || '') }];
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
        max_tokens: maxTokens,
        ...(system ? { system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }] } : {}),
        messages: msgs,
      }),
    });
    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      console.error('Anthropic call:', upstream.status, detail.slice(0, 200));
      return null;
    }
    const data = await upstream.json();
    return Array.isArray(data.content)
      ? data.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
      : '';
  } catch (err) {
    console.error('Anthropic call error:', err.message);
    return null;
  }
}
