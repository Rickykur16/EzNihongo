// Langkah 1: riset + naskah. Hasilnya script.json + review.md untuk dicek manusia.
import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs/promises';
import path from 'node:path';
import { SCRIPT_SCHEMA } from './schema.mjs';

// role 'script' = menulis naskah (CONTENT_MODEL). role 'research' = riset ide/berita
// (RESEARCH_MODEL, jatuh ke CONTENT_MODEL bila kosong) supaya riset bisa memakai model lebih murah.
export function modelConfig(role = 'script') {
  const model = (role === 'research' && process.env.RESEARCH_MODEL) || process.env.CONTENT_MODEL;
  if (!model) throw new Error('CONTENT_MODEL belum diisi di .env (lihat README).');
  const fallbacks = (process.env.CONTENT_FALLBACKS || 'default') !== 'off';
  return { model, fallbacks };
}

// Satu panggilan streaming; mengulang otomatis bila server tool berhenti di pause_turn.
export async function ask(client, params) {
  const { model, fallbacks } = modelConfig(params.role);
  const messages = [...params.messages];
  for (let round = 0; round < 6; round++) {
    const req = {
      model,
      max_tokens: 64000,
      output_config: params.output_config ?? { effort: 'high' },
      system: params.system,
      tools: params.tools,
      messages,
    };
    if (fallbacks) {
      req.betas = ['server-side-fallback-2026-07-01'];
      req.fallbacks = 'default';
    }
    const msg = await client.beta.messages.stream(req).finalMessage();
    if (msg.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: msg.content });
      continue;
    }
    if (msg.stop_reason === 'refusal') throw new Error(`Permintaan ditolak model (${msg.stop_details?.category ?? 'tanpa kategori'}).`);
    if (msg.stop_reason === 'max_tokens') throw new Error('Jawaban terpotong (max_tokens).');
    return msg;
  }
  throw new Error('Riset tidak selesai setelah beberapa kali lanjut (pause_turn).');
}

export const textOf = (msg) => msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();

const RESEARCH_SYSTEM = `Kamu peneliti konten untuk EzNihongo, platform belajar bahasa Jepang untuk orang Indonesia (kelas N5 dan N4).
Audiens: orang Indonesia yang ingin kerja di Jepang (SSW/Tokutei Ginou, Ikusei Shūrō, magang).
Tugas: cari berita/aturan terbaru tentang topik yang diberikan dan tulis catatan riset berbahasa Indonesia.
Aturan:
- Utamakan sumber primer/resmi (pemerintah Jepang, Kemnaker/BP2MI, siaran pers) dan media besar (NHK, Nikkei, Kompas, media lokal Jepang).
- Setiap fakta ditulis sebagai poin dengan URL sumber dan tanggal terbit.
- Tandai fakta yang hanya dari satu sumber lemah atau saling bertentangan.
- Jangan menyimpulkan hal yang tidak tertulis di sumber (gaji, kuota, jaminan lolos, cara daftar).`;

const SCRIPT_SYSTEM = `Kamu penulis naskah TikTok untuk EzNihongo (belajar bahasa Jepang, kelas N5/N4). Tulis naskah video vertikal ~25-35 detik dari catatan riset.

Pelajaran dari analitik akun ini (wajib diikuti):
- Separuh penonton pergi dalam 3-4 detik pertama. Adegan pertama WAJIB tipe "hook": kalimat paling mengejutkan/penting diucapkan di kalimat pertama (≤1,5 detik), dan teks layarnya langsung memuat inti itu.
- Hook boleh berbentuk kaget/pertanyaan ("Magang ke Jepang… dihapus?!") tapi HARUS benar. Kalau berupa pertanyaan, adegan berikutnya langsung menjawabnya.
- Video informatif yang disimpan & dibagikan bekerja baik. Nada: santai, natural, seperti ngobrol ("kamu", "nggak", "jujur…"), kalimat pendek.
- Total 6-8 adegan; tiap vo 1-2 kalimat pendek.

Kejujuran (tidak bisa ditawar):
- Hanya fakta yang ada di catatan riset. Semua klaim masuk "facts" dengan source_url; yang tidak pasti diberi confidence "perlu_dicek".
- Jangan menjanjikan gaji, kelulusan, keberangkatan, atau kuota. Jangan menyiratkan EzNihongo adalah agen penyalur/LPK. Jangan menyuruh "daftar" ke pihak lain.
- Jangan menyebut nama orang biasa; foto tidak boleh memuat logo perusahaan/merek.

Penjualan: soft selling saja. Kelas N5 EzNihongo hanya boleh muncul di adegan terakhir bila relevan (mis. syarat bahasa), dengan ajakan "komen 'N5'" — tanpa harga, tanpa janji, tanpa "link di bio".

Teknis:
- "vo" ditulis sesuai cara baca agar TTS tidak salah ucap: N5 → "en lima", N4 → "en empat", SSW → "es es we", tahun → kata ("dua ribu dua puluh tujuh"), istilah Jepang dalam romaji sederhana ("Ikusei Shuuro"). Teks layar (headline/highlight/badge/items) memakai ejaan normal (N5, SSW, 2027, Ikusei Shūrō).
- Teks layar pendek: headline ≤ 28 karakter per baris, highlight ≤ 16 karakter.
- "cues": frasa yang PERSIS ada di vo adegan itu, untuk memunculkan elemen tepat saat kata itu diucapkan.
- Tipe adegan: hook (kicker + highlight + photo + stamp), statement (kicker/headline/highlight, tanpa foto), photo (headline/highlight + foto + badge), compare (foto + 2 items: lama→baru), list (headline + 2-3 items dengan photo_query), timeline (foto + 2 items: awal→tujuan), level (kicker + highlight + badge level + items[0].sub), cta (headline + highlight + badge berisi ajakan komentar).
- photo_query dalam bahasa Inggris, spesifik dan mudah ditemukan di situs foto stok (Pixabay/Pexels).`;

export async function plan(topic, { outRoot = 'out', idea = null } = {}) {
  const client = new Anthropic();
  console.log('▶ Riset…');
  const research = await ask(client, {
    role: 'research',
    system: RESEARCH_SYSTEM,
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 8 }],
    messages: [{ role: 'user', content: `Topik video: ${topic}\nTanggal hari ini: ${new Date().toISOString().slice(0, 10)}${idea ? `\n\nIde yang sudah disetujui (verifikasi ulang faktanya, jangan percaya begitu saja):\n${JSON.stringify(idea, null, 2)}` : ''}` }],
  });
  const notes = textOf(research);

  console.log('▶ Menulis naskah…');
  const scriptMsg = await ask(client, {
    system: SCRIPT_SYSTEM,
    output_config: { effort: 'high', format: { type: 'json_schema', schema: SCRIPT_SCHEMA } },
    messages: [{ role: 'user', content: `Topik: ${topic}${idea ? `\nHook yang disetujui: ${idea.hook}\nSudut pandang: ${idea.angle}` : ''}\n\nCatatan riset:\n${notes}` }],
  });
  let script;
  try {
    script = JSON.parse(textOf(scriptMsg));
  } catch {
    throw new Error('Naskah dari model bukan JSON yang valid.');
  }
  const problems = validateScript(script);

  const slug = (script.slug || 'video').replace(/[^a-z0-9-]/g, '-').slice(0, 60) || 'video';
  const dir = path.join(outRoot, `${new Date().toISOString().slice(0, 10)}-${slug}`);
  await fs.mkdir(path.join(dir, 'photos'), { recursive: true });
  await fs.writeFile(path.join(dir, 'research.md'), notes + '\n');
  await fs.writeFile(path.join(dir, 'script.json'), JSON.stringify(script, null, 2) + '\n');
  await fs.writeFile(path.join(dir, 'review.md'), reviewMarkdown(script, problems, dir));
  await fs.writeFile(path.join(outRoot, 'latest-plan.txt'), dir + '\n');
  console.log(`✔ Draf siap: ${dir}/review.md`);
  if (problems.length) console.log(`⚠ ${problems.length} hal perlu diperbaiki sebelum build (lihat review.md).`);
  return dir;
}

export function validateScript(s) {
  const p = [];
  if (!s.scenes?.length) return ['Naskah tidak punya adegan.'];
  if (s.scenes[0].type !== 'hook') p.push('Adegan pertama bukan tipe "hook".');
  s.scenes.forEach((sc, i) => {
    for (const c of sc.cues || []) {
      if (!sc.vo.toLowerCase().includes(String(c.phrase).toLowerCase())) p.push(`Adegan ${i + 1}: cue "${c.phrase}" tidak ada di vo.`);
    }
    if (sc.type === 'compare' && sc.items.length !== 2) p.push(`Adegan ${i + 1} (compare) harus punya 2 item.`);
    if (sc.type === 'timeline' && sc.items.length !== 2) p.push(`Adegan ${i + 1} (timeline) harus punya 2 item.`);
    if (/\b(N[1-5]|SSW|20\d\d)\b/.test(sc.vo)) p.push(`Adegan ${i + 1}: vo masih memuat singkatan/angka (${sc.vo.match(/\b(N[1-5]|SSW|20\d\d)\b/)[0]}) — tulis sesuai cara baca.`);
  });
  const unverified = (s.facts || []).filter((f) => f.confidence !== 'terkonfirmasi');
  if (unverified.length) p.push(`${unverified.length} klaim berstatus "perlu_dicek".`);
  return p;
}

function reviewMarkdown(s, problems, dir) {
  const L = [];
  L.push(`# Review: ${s.title}`, '');
  L.push('> Video BELUM dibuat. Cek naskah dan fakta di bawah, edit `script.json` bila perlu, lalu jalankan:', '>', `> \`npm run build -- ${dir}\``, '');
  if (problems.length) L.push('## ⚠ Perlu diperbaiki', ...problems.map((x) => `- ${x}`), '');
  L.push('## Adegan', '', '| # | Tipe | Suara (vo) | Teks layar | Foto |', '|---|---|---|---|---|');
  s.scenes.forEach((sc, i) => {
    const screen = [sc.kicker, sc.headline, sc.highlight && `**${sc.highlight}**`, sc.badge && `[${sc.badge}]`, ...sc.items.map((it) => `• ${it.label}`)].filter(Boolean).join('<br>');
    L.push(`| ${i + 1} | ${sc.type} | ${sc.vo} | ${screen} | ${sc.photo_query || '—'} |`);
  });
  L.push('', '## Fakta & sumber', '', '| Klaim | Status | Sumber |', '|---|---|---|');
  for (const f of s.facts) L.push(`| ${f.claim} | ${f.confidence === 'terkonfirmasi' ? '✅' : '⚠ perlu dicek'} | ${f.source_url} |`);
  L.push('', '## Caption', '', s.caption, '', '## Komentar sematan', '', s.pinned_comment, '');
  L.push('## Foto sendiri (opsional)', '', 'Taruh file `photos/<nomor-adegan>.jpg` (mis. `photos/1.jpg`) untuk mengganti foto stok adegan itu. Untuk thumbnail list: `photos/<adegan>-<item>.jpg`.', '');
  return L.join('\n');
}
