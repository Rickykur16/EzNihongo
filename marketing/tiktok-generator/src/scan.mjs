// Pemindaian harian yang DIAM: hanya mengirim pesan bila ada berita besar.
// Hari biasa tidak menghasilkan notifikasi apa pun.
import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ask, textOf } from './plan.mjs';

export const SCAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      description: 'Hanya berita yang lolos kriteria "besar". Kosong bila tidak ada.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['headline', 'why_big', 'url', 'published'],
        properties: {
          headline: { type: 'string', description: 'Ringkasan berita dalam 1 kalimat bahasa Indonesia.' },
          why_big: { type: 'string', description: 'Kenapa ini penting bagi orang Indonesia yang ingin kerja di Jepang.' },
          url: { type: 'string' },
          published: { type: 'string', description: 'Tanggal terbit (YYYY-MM-DD).' },
        },
      },
    },
  },
};

const SCAN_SYSTEM = `Kamu pemantau berita untuk EzNihongo (belajar bahasa Jepang untuk orang Indonesia yang ingin kerja di Jepang).
Cari berita yang terbit dalam 48 jam terakhir dan laporkan HANYA yang benar-benar besar. Kriteria "besar" (minimal satu):
- Perubahan aturan resmi: visa kerja, SSW/Tokutei Ginou, Ikusei Shūrō, magang, kuota sektor, syarat bahasa.
- Program/tur rekrutmen konkret yang menyasar pekerja Indonesia (seperti tur wawancara Bank Kagawa di Jakarta & Solo).
- Jadwal/tenggat atau perubahan ujian: JLPT, JFT-Basic, tes keterampilan SSW di Indonesia.
- Kesepakatan pemerintah Indonesia–Jepang soal tenaga kerja.
BUKAN berita besar: opini, artikel tips umum, berita lama yang diterbitkan ulang, lowongan satu perusahaan kecil, rumor tanpa sumber resmi.
Lebih baik melaporkan nol berita daripada berita yang lemah. Jangan laporkan yang ada di daftar "sudah dilaporkan".`;

export async function scan({ outRoot = 'out' } = {}) {
  const client = new Anthropic();
  const seenFile = path.join(outRoot, 'scan-seen.json');
  const seen = JSON.parse(await fs.readFile(seenFile, 'utf8').catch(() => '[]'));
  const today = new Date().toISOString().slice(0, 10);

  const research = await ask(client, {
    role: 'research',
    system: SCAN_SYSTEM,
    output_config: { effort: 'medium' },
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }],
    messages: [{ role: 'user', content: `Tanggal hari ini: ${today}\nSudah dilaporkan:\n${seen.map((s) => `- ${s.headline} (${s.url})`).join('\n') || '- (belum ada)'}` }],
  });
  const out = await ask(client, {
    role: 'research',
    system: SCAN_SYSTEM,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCAN_SCHEMA } },
    messages: [{ role: 'user', content: `Tanggal hari ini: ${today}\n\nHasil pemantauan:\n${textOf(research)}\n\nKembalikan hanya berita yang lolos kriteria "besar".` }],
  });
  const fresh = filterNew(JSON.parse(textOf(out)).items, seen);
  if (fresh.length) {
    await fs.mkdir(outRoot, { recursive: true });
    await fs.writeFile(seenFile, JSON.stringify([...seen, ...fresh.map((f) => ({ ...f, seen: today }))].slice(-200), null, 2) + '\n');
  }
  return fresh;
}

// Pengaman kedua selain prompt: buang yang URL/judulnya sudah pernah dilaporkan.
export function filterNew(items, seen) {
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const urls = new Set(seen.map((s) => s.url));
  const heads = new Set(seen.map((s) => norm(s.headline)));
  return (items || []).filter((it) => it.url && !urls.has(it.url) && !heads.has(norm(it.headline)));
}

export function scanMessage(items) {
  const L = ['🚨 Berita besar hari ini', ''];
  items.forEach((it, i) => L.push(`${i + 1}. ${it.headline}`, `   Kenapa penting: ${it.why_big}`, `   ${it.url}`, ''));
  L.push('Balas /ide untuk riset ide konten dari berita ini.');
  return L.join('\n').slice(0, 4000);
}
