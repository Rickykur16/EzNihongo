// Bot Telegram: alur persetujuan dua langkah.
//   /ide        → riset & usulkan 5 ide
//   /buat <n>   → riset ide n lebih dalam + tulis naskah → kirim untuk direview
//   /render     → buat video dari naskah terakhir → kirim videonya
// Hanya pesan dari TELEGRAM_ADMIN_CHAT_ID yang dilayani.
import fs from 'node:fs/promises';
import path from 'node:path';
import { ideas, ideasMessage, loadIdea, remember } from './ideas.mjs';
import { plan, validateScript } from './plan.mjs';
import { build } from './build.mjs';
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

async function latest(name) {
  return (await fs.readFile(path.join(OUT, name), 'utf8')).trim();
}

const COMMANDS = {
  async ide() {
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
    await sendText(`🎬 Membuat video dari ${path.basename(dir)} (suara, foto, render)…`);
    const video = await build(dir);
    const script = JSON.parse(await fs.readFile(path.join(dir, 'script.json'), 'utf8'));
    await sendFile(video, { kind: 'video', caption: script.caption });
    await sendFile(path.join(dir, 'cover.png'), { kind: 'photo', caption: 'Cover (frame pertama)' });
    await sendText(`📌 Komentar sematan:\n${script.pinned_comment}\n\nCek video sebelum posting, terutama fakta bertanda ⚠.`);
    await remember(OUT, script.title);
  },
  async status() {
    return sendText(busy ? `⏳ Sedang: ${busy}` : '✅ Siap. Perintah: /ide, /buat <n>, /topik <teks>, /foto, /render — kirim foto ke sini untuk naskah terakhir');
  },
};
COMMANDS.start = COMMANDS.bantuan = COMMANDS.help = COMMANDS.status;

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
    if (busy) return sendText(`⏳ Masih mengerjakan: ${busy}. Kirim fotonya setelah selesai ya.`);
    return savePhoto(msg).catch((e) => sendText(`✖ Gagal menyimpan foto: ${e.message}`));
  }
  const m = /^\/(\w+)(?:@\w+)?\s*(.*)$/s.exec(msg.text || '');
  if (!m || !COMMANDS[m[1]]) return sendText('Perintah: /ide, /buat <n>, /topik <teks>, /foto, /render, /status — atau kirim foto untuk naskah terakhir');
  const [, cmd, arg] = m;
  if (!['status', 'start', 'foto'].includes(cmd) && busy) return sendText(`⏳ Masih mengerjakan: ${busy}. Tunggu dulu ya.`);
  if (['status', 'start', 'bantuan', 'help', 'foto'].includes(cmd)) return COMMANDS[cmd](arg).catch((e) => sendText(`✖ ${e.message}`));
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
