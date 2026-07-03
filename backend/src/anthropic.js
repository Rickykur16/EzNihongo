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
// Model khusus GENERATOR soal (generate-jlpt / generate-listening): tugas
// komposisi ketat (組み立て: pecah kalimat jadi 4 potongan + lacak posisi ★)
// terbukti gagal terus di haiku — semua draft ditolak validasi permutasi.
// Default sonnet; admin-only & volume rendah jadi biayanya kecil. Fitur
// siswa (tutor, grammar eval, coaching) tetap ANTHROPIC_MODEL (haiku).
export const ANTHROPIC_GEN_MODEL = process.env.ANTHROPIC_GEN_MODEL || 'claude-sonnet-4-6';
// Model khusus TUTOR chat (Maneko-chan): haiku terbukti halusinasi di
// penjelasan linguistik (contoh youon/sokuon ngaco, arti kata dikarang).
// Default sonnet — kualitas jawaban > biaya; bisa di-override via .env.
export const ANTHROPIC_TUTOR_MODEL = process.env.ANTHROPIC_TUTOR_MODEL || 'claude-sonnet-4-6';

export function anthropicEnabled() {
  return !!ANTHROPIC_API_KEY;
}

// Mengembalikan teks balasan asisten (string), atau null kalau nonaktif/gagal.
// `system` di-kirim dengan cache_control ephemeral (cacheable prompt prefix).
// `model` opsional — default ANTHROPIC_MODEL; generator soal pakai
// ANTHROPIC_GEN_MODEL.
// Varian streaming: sama seperti callClaude tapi `stream: true` — tiap potongan
// teks dari Claude diteruskan ke onText(chunk) begitu tiba (dipakai tutor chat
// biar balasan muncul mengalir seperti orang ngetik). Return: teks lengkap
// (string, bisa '' kalau model balas kosong) atau null kalau nonaktif/gagal
// sebelum selesai. Gagal DI TENGAH stream tetap return null — pemanggil yang
// sudah terlanjur nulis sebagian ke klien tinggal menutup respons.
export async function callClaudeStream({ system, userContent, messages, maxTokens = 512, model, onText }) {
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
        model: model || ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        stream: true,
        ...(system ? { system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }] } : {}),
        messages: msgs,
      }),
    });
    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => '');
      console.error('Anthropic stream:', upstream.status, detail.slice(0, 200));
      return null;
    }
    // Parse SSE per-baris: cuma event content_block_delta/text_delta yang
    // membawa teks; event lain (message_start, ping, dsb) dilewati.
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let full = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        let ev;
        try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }
        const text = ev && ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta'
          ? ev.delta.text : '';
        if (!text) continue;
        full += text;
        if (onText) onText(text);
      }
    }
    return full.trim();
  } catch (err) {
    console.error('Anthropic stream error:', err.message);
    return null;
  }
}

export async function callClaude({ system, userContent, messages, maxTokens = 512, model }) {
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
        model: model || ANTHROPIC_MODEL,
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
