// Langkah 0: Claude meriset sendiri dan mengusulkan ide konten.
// Tidak ada yang dibuat sebelum manusia memilih salah satu ide.
import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ask, textOf } from './plan.mjs';

export const IDEAS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ideas'],
  properties: {
    ideas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'hook', 'angle', 'why_now', 'n5_link', 'sources', 'risk'],
        properties: {
          title: { type: 'string', description: 'Judul ide, singkat.' },
          hook: { type: 'string', description: 'Kalimat pembuka video (≤ 10 kata), mengejutkan TAPI benar.' },
          angle: { type: 'string', description: 'Sudut pandang/isi utama video dalam 1-2 kalimat.' },
          why_now: { type: 'string', description: 'Kenapa relevan minggu ini (berita/tanggal/tenggat).' },
          n5_link: { type: 'string', description: 'Hubungan alami dengan belajar bahasa Jepang/kelas N5, atau "tidak ada" bila murni informasi.' },
          sources: { type: 'array', items: { type: 'string' }, description: 'URL sumber.' },
          risk: { type: 'string', description: 'Apa yang paling rawan salah/menyesatkan dan perlu dicek.' },
        },
      },
    },
  },
};

const IDEAS_SYSTEM = `Kamu ahli strategi konten TikTok untuk EzNihongo, platform belajar bahasa Jepang (kelas N5 & N4) untuk orang Indonesia.
Audiens: orang Indonesia 18-35 tahun yang ingin kerja/kuliah di Jepang (SSW/Tokutei Ginou, Ikusei Shūrō, magang, JLPT/JFT).

Tugas: riset dengan web search lalu usulkan 5 ide video pendek (25-35 detik) untuk minggu ini.

Yang terbukti bekerja di akun ini:
- Video berita "Bank Kagawa (Jepang) wawancara pekerja di Jakarta & Solo" masuk FYP: 8,5 ribu tayangan, 76 disimpan, 51 dibagikan → berita konkret + relevan langsung bagi pencari kerja ke Jepang.
- Penonton paling banyak pergi di 3-4 detik pertama → hook harus langsung ke inti yang mengejutkan.

Cari:
1. Berita 14 hari terakhir: kebijakan visa/tenaga kerja asing Jepang, program rekrutmen ke/dari Indonesia, perubahan ujian (JLPT, JFT-Basic, tes keterampilan SSW), jadwal & tenggat pendaftaran.
2. Bila berita sedikit: topik evergreen yang sering ditanyakan (beda SSW vs magang, syarat bahasa per sektor, kesalahan umum pemula belajar bahasa Jepang).

Aturan:
- Variasikan: maksimal 3 ide berita, minimal 1 ide edukasi bahasa.
- Hook harus benar; jangan clickbait palsu. Jangan ide yang menjanjikan gaji/lolos/berangkat atau membuat EzNihongo terlihat seperti agen penyalur.
- Hindari ide yang mirip daftar "sudah pernah dibuat".
- Urutkan dari yang paling berpotensi (relevan + segar + mudah dipahami).`;

export async function ideas({ outRoot = 'out' } = {}) {
  const client = new Anthropic();
  const historyFile = path.join(outRoot, 'history.json');
  const history = JSON.parse(await fs.readFile(historyFile, 'utf8').catch(() => '[]'));
  const today = new Date().toISOString().slice(0, 10);

  console.log('▶ Riset ide…');
  const research = await ask(client, {
    system: IDEAS_SYSTEM,
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 12 }],
    messages: [{ role: 'user', content: `Tanggal hari ini: ${today}\nSudah pernah dibuat:\n${history.map((h) => `- ${h.title}`).join('\n') || '- (belum ada)'}\n\nRiset dulu, lalu tulis catatan singkat kandidat ide beserta sumbernya.` }],
  });
  const notes = textOf(research);

  const out = await ask(client, {
    system: IDEAS_SYSTEM,
    output_config: { effort: 'high', format: { type: 'json_schema', schema: IDEAS_SCHEMA } },
    messages: [{ role: 'user', content: `Tanggal hari ini: ${today}\n\nCatatan riset:\n${notes}\n\nPilih 5 ide terbaik.` }],
  });
  const { ideas: list } = JSON.parse(textOf(out));

  const dir = path.join(outRoot, 'ideas', today);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'ideas.json'), JSON.stringify(list, null, 2) + '\n');
  await fs.writeFile(path.join(dir, 'research.md'), notes + '\n');
  await fs.writeFile(path.join(dir, 'ideas.md'), ideasMarkdown(list, today));
  await fs.writeFile(path.join(outRoot, 'latest-ideas.txt'), dir + '\n');
  console.log(`✔ ${list.length} ide: ${dir}/ideas.md`);
  return { dir, list };
}

export function ideasMarkdown(list, date) {
  const L = [`# Ide konten — ${date}`, '', 'Pilih satu: `npm run plan -- --idea <nomor>` (atau balas `/buat <nomor>` di Telegram).', ''];
  list.forEach((it, i) => {
    L.push(`## ${i + 1}. ${it.title}`, '', `**Hook:** "${it.hook}"`, '', `- **Isi:** ${it.angle}`, `- **Kenapa sekarang:** ${it.why_now}`,
      `- **Hubungan ke N5:** ${it.n5_link}`, `- **Rawan salah:** ${it.risk}`, `- **Sumber:** ${it.sources.join(' · ')}`, '');
  });
  return L.join('\n');
}

// Ringkasan pendek untuk Telegram (batas 4096 karakter).
export function ideasMessage(list) {
  const lines = ['💡 Ide konten minggu ini', ''];
  list.forEach((it, i) => lines.push(`${i + 1}. ${it.title}`, `   🎣 "${it.hook}"`, `   📌 ${it.why_now}`, ''));
  lines.push('Balas /buat <nomor> untuk mulai, atau /ide untuk riset ulang.');
  return lines.join('\n').slice(0, 4000);
}

export async function loadIdea(outRoot, n) {
  const dir = (await fs.readFile(path.join(outRoot, 'latest-ideas.txt'), 'utf8')).trim();
  const list = JSON.parse(await fs.readFile(path.join(dir, 'ideas.json'), 'utf8'));
  const idea = list[n - 1];
  if (!idea) throw new Error(`Ide nomor ${n} tidak ada (tersedia 1-${list.length}).`);
  return idea;
}

export async function remember(outRoot, title) {
  const file = path.join(outRoot, 'history.json');
  const history = JSON.parse(await fs.readFile(file, 'utf8').catch(() => '[]'));
  history.push({ date: new Date().toISOString().slice(0, 10), title });
  await fs.writeFile(file, JSON.stringify(history.slice(-60), null, 2) + '\n');
}
