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
import { adminChat, getUpdates, sendFile, sendText, telegramEnabled } from './telegram.mjs';

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
    return sendText(busy ? `⏳ Sedang: ${busy}` : '✅ Siap. Perintah: /ide, /buat <n>, /render');
  },
};
COMMANDS.start = COMMANDS.bantuan = COMMANDS.help = COMMANDS.status;

export async function handle(msg) {
  if (String(msg.chat?.id) !== adminChat()) return; // abaikan orang lain
  const m = /^\/(\w+)(?:@\w+)?\s*(.*)$/s.exec(msg.text || '');
  if (!m || !COMMANDS[m[1]]) return sendText('Perintah: /ide, /buat <n>, /render, /status');
  const [, cmd, arg] = m;
  if (cmd !== 'status' && cmd !== 'start' && busy) return sendText(`⏳ Masih mengerjakan: ${busy}. Tunggu dulu ya.`);
  if (cmd === 'status' || cmd === 'start' || cmd === 'bantuan' || cmd === 'help') return COMMANDS[cmd](arg);
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
