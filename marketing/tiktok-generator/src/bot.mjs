// Bot Telegram: alur persetujuan dua langkah.
//   /ide        → riset & usulkan 5 ide
//   /buat <n>   → riset ide n lebih dalam + tulis naskah → kirim untuk direview
//   /render     → buat video dari naskah terakhir → kirim videonya
// Hanya pesan dari TELEGRAM_ADMIN_CHAT_ID yang dilayani.
import fs from 'node:fs/promises';
import path from 'node:path';
import { ideas, ideasMessage, loadIdea, remember } from './ideas.mjs';
import { plan, validateScript } from './plan.mjs';
import { scan, scanMessage } from './scan.mjs';
import { build, prepare } from './build.mjs';
import { dispatchRender, jobName, remoteRenderEnabled, writeJob } from './remote.mjs';
import { cleanAfterDelivery, pruneOld } from './cleanup.mjs';
import { recordResult } from './guidance.mjs';
import { summarizeScreenshot } from './analytics.mjs';
import { adminChat, downloadFile, getUpdates, sendFile, sendText, telegramEnabled } from './telegram.mjs';
import { photoSlots, photoStatus, pickSlot } from './photoslots.mjs';

const OUT = 'out';
let busy = null;

export function reviewMessage(script, problems) {
  const L = [`📝 Naskah: ${script.title}`, ''];
  script.scenes.forEach((s, i) => L.push(`${i + 1}. [${s.type}] ${s.vo}`));
  const check = script.facts.filter((f) => f.confidence !== 'terkonfirmasi');
  if (check.length) L.push('', '⚠ Perlu dicek:', ...check.map((f) => `• ${f.claim}`));
  if (problems.length) L.push('', '❗ Masalah naskah:', ...problems.map((p) => `• ${p}`));
  L.push('', `Caption: ${script.caption}`, '', 'Balas /render kalau sudah oke. Mau ubah? Edit script.json di folder hasil, atau /buat <nomor> untuk ide lain.');
  return L.join('\n');
}

// Kirim hasil render (lokal maupun dari GitHub Actions) ke Telegram.
export async function deliver(dir) {
  const script = JSON.parse(await fs.readFile(path.join(dir, 'script.json'), 'utf8'));
  await sendFile(path.join(dir, 'video.mp4'), { kind: 'video', caption: script.caption });
  await sendFile(path.join(dir, 'cover.png'), { kind: 'photo', caption: 'Cover (frame pertama)' });
  await sendText(`📌 Komentar sematan:\n${script.pinned_comment}\n\nCek video sebelum posting, terutama fakta bertanda ⚠.`);
  await remember(OUT, script.title);
  // Video sudah tersimpan di Telegram; jangan biarkan sisa render & file lama memenuhi disk VPS.
  try {
    await cleanAfterDelivery(dir);
    const freed = await pruneOld(OUT);
    if (freed.length) console.log(`  dibersihkan: ${freed.length} file/folder berat dari video lama`);
  } catch (e) { console.warn(`  ⚠ bersih-bersih gagal: ${e.message}`); }
}

async function latest(name) {
  return (await fs.readFile(path.join(OUT, name), 'utf8')).trim();
}

const COMMANDS = {
  async ide() {
    await sendText('🔎 Riset berita & ide konten (2–5 menit). Kirim /status untuk cek.');
    const { dir, list } = await ideas({ outRoot: OUT });
    await sendText(ideasMessage(list));
    await sendFile(path.join(dir, 'ideas.md'), { caption: 'Detail ide + sumber' });
  },
  async buat(arg) {
    const n = Number(arg);
    if (!Number.isInteger(n) || n < 1) return sendText('Pakai: /buat <nomor ide>, mis. /buat 2');
    const idea = await loadIdea(OUT, n);
    await sendText(`🔎 Mengerjakan ide ${n}: ${idea.title}\nRiset ulang + tulis naskah (beberapa menit)…`);
    const dir = await plan(idea.title, { outRoot: OUT, idea });
    const script = JSON.parse(await fs.readFile(path.join(dir, 'script.json'), 'utf8'));
    await sendText(reviewMessage(script, validateScript(script)));
    await sendFile(path.join(dir, 'review.md'), { caption: 'Review lengkap (fakta + sumber)' });
    await sendText(photoStatus(photoSlots(script), dir));
  },
  async topik(arg) {
    const topic = String(arg || '').trim();
    if (topic.length < 5) return sendText('Pakai: /topik <topik bebas>, mis. /topik jadwal JLPT Desember 2026 di Indonesia');
    await sendText(`🔎 Riset + tulis naskah untuk: "${topic.slice(0, 200)}" (beberapa menit)…`);
    const dir = await plan(topic, { outRoot: OUT });
    const script = JSON.parse(await fs.readFile(path.join(dir, 'script.json'), 'utf8'));
    await sendText(reviewMessage(script, validateScript(script)));
    await sendFile(path.join(dir, 'review.md'), { caption: 'Review lengkap (fakta + sumber)' });
    await sendText(photoStatus(photoSlots(script), dir));
  },
  async foto() {
    const dir = await latest('latest-plan.txt');
    const script = JSON.parse(await fs.readFile(path.join(dir, 'script.json'), 'utf8'));
    return sendText(photoStatus(photoSlots(script), dir));
  },
  async render() {
    const dir = await latest('latest-plan.txt');
    if (remoteRenderEnabled()) {
      const job = jobName(dir); // gagal lebih awal kalau nama folder tidak aman, sebelum bayar suara
      await sendText(`🎬 Menyiapkan suara & foto untuk ${job}…`);
      await writeJob(dir, await prepare(dir));
      const runs = await dispatchRender(job);
      return sendText(`☁️ Render berjalan di GitHub Actions (±10–15 menit). Video dikirim ke sini otomatis begitu selesai.\nPantau: ${runs}`);
    }
    await sendText(`🎬 Membuat video dari ${path.basename(dir)} (suara, foto, render)…`);
    await build(dir);
    await deliver(dir);
  },
  // Hasil video yang sudah tayang → out/results.json → dibaca agen saat riset ide & menulis naskah.
  async hasil(arg) {
    const video = await lastVideoTitle();
    const n = await recordResult(OUT, { video, summary: arg });
    return sendText(`📈 Hasil dicatat untuk "${video || 'video terakhir'}" (${n} catatan). Ide & naskah berikutnya ikut memakai data ini.`);
  },
  async berita() {
    await sendText('🔎 Cek berita besar 48 jam terakhir (1–3 menit)…');
    const items = await scan({ outRoot: OUT });
    await sendText(items.length ? scanMessage(items) : '✅ Tidak ada berita besar baru dalam 48 jam terakhir.');
  },
  async status() {
    return sendText(busy ? `⏳ Sedang: ${busy}` : '✅ Siap. Perintah: /ide, /berita, /buat <n>, /topik <teks>, /foto, /render, /hasil <angka> (atau screenshot analitik ber-caption /hasil) — kirim foto ke sini untuk naskah terakhir');
  },
};
COMMANDS.start = COMMANDS.bantuan = COMMANDS.help = COMMANDS.status;

// Cek format argumen SEBELUM bot ditandai sibuk, supaya salah ketik tidak mengunci bot.
const USAGE = {
  hasil: (a) => (a.length >= 5 ? null : 'Pakai: /hasil <angka analitik>, mis. /hasil 24rb tayangan, 31% ditonton, 973 simpan, banyak keluar di detik 2\nAtau kirim screenshot analitik dengan caption /hasil'),
  buat: (a) => (/^\d+$/.test(a) && Number(a) >= 1 ? null : 'Pakai: /buat <nomor ide>, mis. /buat 2'),
  topik: (a) => (a.length >= 5 ? null : 'Pakai: /topik <topik bebas>, mis. /topik jadwal JLPT Desember 2026 di Indonesia'),
};

async function lastVideoTitle() {
  const history = JSON.parse(await fs.readFile(path.join(OUT, 'history.json'), 'utf8').catch(() => '[]'));
  return history.at(-1)?.title || '';
}

async function saveResultScreenshot(msg) {
  const fileId = msg.photo ? msg.photo[msg.photo.length - 1].file_id : msg.document.file_id;
  const { data, ext } = await downloadFile(fileId);
  await sendText('🔎 Membaca screenshot analitik…');
  const summary = await summarizeScreenshot(data, ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg');
  const video = String(msg.caption || '').replace(/^\/hasil(@\w+)?/i, '').trim() || await lastVideoTitle();
  const n = await recordResult(OUT, { video, summary });
  return sendText(`📈 Dicatat (${n}) untuk "${video || 'video terakhir'}":\n${summary}`);
}

async function savePhoto(msg) {
  const dir = await latest('latest-plan.txt').catch(() => null);
  if (!dir) return sendText('Belum ada naskah. Mulai dengan /ide lalu /buat <n>.');
  const script = JSON.parse(await fs.readFile(path.join(dir, 'script.json'), 'utf8'));
  const slots = photoSlots(script);
  const fileId = msg.photo ? msg.photo[msg.photo.length - 1].file_id : msg.document.file_id;
  let slot;
  try { slot = pickSlot(msg.caption, slots, dir); } catch (e) { return sendText(`⚠ ${e.message}`); }
  const { data, ext } = await downloadFile(fileId);
  const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
  await fs.mkdir(path.join(dir, 'photos'), { recursive: true });
  for (const e of ['jpg', 'jpeg', 'png', 'webp']) await fs.rm(path.join(dir, 'photos', `${slot.slot}.${e}`), { force: true });
  await fs.writeFile(path.join(dir, 'photos', `${slot.slot}.${safeExt}`), data);
  return sendText(`✅ Foto slot ${slot.slot} tersimpan (${slot.query}).\n\n${photoStatus(slots, dir)}`);
}

export async function handle(msg) {
  if (String(msg.chat?.id) !== adminChat()) return; // abaikan orang lain
  const isImage = msg.photo?.length || /^image\//.test(msg.document?.mime_type || '');
  if (isImage) {
    if (/^\/hasil\b/i.test(msg.caption || '')) return saveResultScreenshot(msg).catch((e) => sendText(`✖ Gagal membaca screenshot: ${e.message}`));
    if (busy) return sendText(`⏳ Masih mengerjakan: ${busy}. Kirim fotonya setelah selesai ya.`);
    return savePhoto(msg).catch((e) => sendText(`✖ Gagal menyimpan foto: ${e.message}`));
  }
  const m = /^\/(\w+)(?:@\w+)?\s*(.*)$/s.exec(msg.text || '');
  if (!m || !COMMANDS[m[1]]) return sendText('Perintah: /ide, /berita, /buat <n>, /topik <teks>, /foto, /render, /hasil <angka>, /status — atau kirim foto untuk naskah terakhir');
  const [, cmd, rawArg] = m;
  const arg = rawArg.trim();
  const wrong = USAGE[cmd]?.(arg);
  if (wrong) return sendText(wrong);
  if (!['status', 'start', 'foto', 'hasil'].includes(cmd) && busy) return sendText(`⏳ Masih mengerjakan: ${busy}. Tunggu dulu ya.`);
  if (['status', 'start', 'bantuan', 'help', 'foto', 'hasil'].includes(cmd)) return COMMANDS[cmd](arg).catch((e) => sendText(`✖ ${e.message}`));
  busy = `/${cmd} ${arg}`.trim();
  // Dijalankan di latar supaya bot tetap menjawab /status.
  COMMANDS[cmd](arg.trim())
    .catch((e) => sendText(`✖ ${busy} gagal: ${e.message}`).catch(() => {}))
    .finally(() => { busy = null; });
}

export async function runBot() {
  if (!telegramEnabled()) throw new Error('Isi TELEGRAM_BOT_TOKEN dan TELEGRAM_ADMIN_CHAT_ID di .env.');
  console.log('🤖 Bot berjalan. Ctrl+C untuk berhenti.');
  let offset = 0;
  for (;;) {
    try {
      for (const u of await getUpdates(offset)) {
        offset = u.update_id + 1;
        if (u.message) await handle(u.message);
      }
    } catch (e) {
      console.error('getUpdates:', e.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}
