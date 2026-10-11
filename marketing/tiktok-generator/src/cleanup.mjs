// Bersih-bersih folder hasil supaya disk VPS tidak terus terisi.
//
// Yang dihapus hanya file BERAT (suara, foto, video, sisa render). Teks kecil
// (script.json, review.md, research.md, caption.txt, credits.md) tetap disimpan
// sebagai arsip naskah & sumber fakta.
import fs from 'node:fs/promises';
import path from 'node:path';

const JOB_DIR = /^(\d{4}-\d{2}-\d{2})-[a-z0-9-]+$/;
const HEAVY_FILE = /^(vo(-\d+)?\.mp3|gap\.mp3|vo-list\.txt|.*\.mp4|cover\.png|render-job\.tgz)$/;
const HEAVY_DIR = new Set(['photos', 'render', 'render-job']);

// Sisa kerja yang tidak dibutuhkan lagi begitu video sampai ke Telegram.
export async function cleanAfterDelivery(dir) {
  for (const name of ['render-job.tgz', 'render-job', 'render']) {
    await fs.rm(path.join(dir, name), { recursive: true, force: true });
  }
}

// Folder video yang lebih tua dari `days` hari (dari tanggal di namanya) dibuang
// file beratnya. /render ulang folder lama berarti suara dibuat ulang (berbayar).
export async function pruneOld(outRoot, { days = Number(process.env.OUT_KEEP_DAYS) || 14, now = Date.now() } = {}) {
  const cutoff = now - days * 86400000;
  const freed = [];
  for (const entry of await fs.readdir(outRoot, { withFileTypes: true }).catch(() => [])) {
    const m = entry.isDirectory() && JOB_DIR.exec(entry.name);
    if (!m || Date.parse(`${m[1]}T00:00:00Z`) >= cutoff) continue;
    const dir = path.join(outRoot, entry.name);
    for (const f of await fs.readdir(dir, { withFileTypes: true })) {
      const heavy = f.isDirectory() ? HEAVY_DIR.has(f.name) : HEAVY_FILE.test(f.name);
      if (!heavy) continue;
      await fs.rm(path.join(dir, f.name), { recursive: true, force: true });
      freed.push(path.join(entry.name, f.name));
    }
  }
  return freed;
}
