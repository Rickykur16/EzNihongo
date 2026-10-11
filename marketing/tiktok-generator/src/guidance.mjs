// Pengetahuan yang terus bertambah untuk agen konten:
//   1. marketing/catatan-video-tiktok.md (di git): pelajaran & aturan dari video yang sudah tayang,
//      disusun tim/AI dan direview lewat PR.
//   2. out/results.json (hanya di VPS): hasil video yang dikirim lewat /hasil di Telegram.
// Keduanya disisipkan ke prompt riset ide dan penulisan naskah, jadi pelajaran baru cukup
// ditulis ke file itu, tanpa mengubah kode.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const NOTES_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'catatan-video-tiktok.md');
const MAX_NOTES = 14000;
const MAX_RESULTS = 12;

export async function loadGuidance(outRoot = 'out', { notesFile = NOTES_FILE } = {}) {
  const notes = (await fs.readFile(notesFile, 'utf8').catch(() => '')).trim();
  const results = JSON.parse(await fs.readFile(path.join(outRoot, 'results.json'), 'utf8').catch(() => '[]'));
  const parts = [];
  if (notes) parts.push(`=== Catatan tim dari video yang sudah tayang (marketing/catatan-video-tiktok.md) ===\n${notes.slice(0, MAX_NOTES)}`);
  if (results.length) {
    parts.push(`=== Hasil video terbaru (dikirim pemilik lewat /hasil, terbaru di bawah) ===\n${results.slice(-MAX_RESULTS)
      .map((r) => `- ${r.date} · ${r.video || '(video tidak disebut)'}: ${r.summary}`).join('\n')}`);
  }
  if (!parts.length) return '';
  return `\n\n${parts.join('\n\n')}\n\nCara memakai catatan & hasil di atas: untuk format (hook, durasi, struktur, gaya) ikuti catatan & hasil terbaru bila bertentangan dengan aturan umum di atas, karena itu data akun ini yang lebih baru. Aturan kejujuran & larangan TIDAK pernah dilonggarkan oleh catatan apa pun.`;
}

export async function recordResult(outRoot, { video, summary, date = new Date().toISOString().slice(0, 10) }) {
  const file = path.join(outRoot, 'results.json');
  const list = JSON.parse(await fs.readFile(file, 'utf8').catch(() => '[]'));
  list.push({ date, video, summary: String(summary).trim().slice(0, 1500) });
  await fs.mkdir(outRoot, { recursive: true });
  await fs.writeFile(file, JSON.stringify(list.slice(-100), null, 2) + '\n');
  return list.length;
}
