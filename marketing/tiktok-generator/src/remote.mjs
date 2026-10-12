// Render di GitHub Actions supaya VPS (yang juga melayani eznihongo.com) tidak ikut berat.
//
//   VPS (bot)                        GitHub Actions (.github/workflows/tiktok-render.yml)
//   /render → suara + foto           ← scp out/<job>/render-job.tgz
//           → render-job.tgz         render frame + ffmpeg
//           → dispatch workflow      → scp video.mp4 + cover.png ke out/<job>/
//                                    → ssh: node src/cli.mjs deliver out/<job>  (kirim ke Telegram)
//
// Workflow mengambil & mengembalikan file lewat SSH (VPS_SSH_KEY yang sudah ada),
// jadi token Telegram/ElevenLabs tidak pernah keluar dari VPS. Yang dibutuhkan bot
// hanyalah token GitHub untuk memicu workflow (GITHUB_RENDER_TOKEN).
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const WORKFLOW = 'tiktok-render.yml';
// Nama folder hasil `plan`: out/<YYYY-MM-DD>-<slug>. Dikirim sebagai input workflow,
// jadi dibatasi ketat (tanpa garis miring, titik, spasi) sebelum dipakai di perintah SSH.
const JOB_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9-]{1,60}$/;

export const remoteRenderEnabled = () => Boolean(process.env.GITHUB_RENDER_TOKEN && process.env.GITHUB_RENDER_REPO);

export function jobName(dir) {
  const name = path.basename(path.resolve(dir));
  if (!JOB_RE.test(name)) throw new Error(`Nama folder "${name}" tidak bisa dipakai sebagai job render (harus YYYY-MM-DD-slug).`);
  return name;
}

// Path foto di spec dibuat relatif terhadap folder job supaya bisa dipindah ke mesin lain.
const mapPhotos = (scenes, fn) => scenes.map((sc) => ({
  ...sc,
  photo: sc.photo ? fn(sc.photo) : '',
  items: (sc.items || []).map((it) => ({ ...it, photo: it.photo ? fn(it.photo) : '' })),
}));

export async function writeJob(dir, { scenes, audioPath, meta = {} }) {
  const job = path.join(dir, 'render-job');
  await fs.rm(job, { recursive: true, force: true });
  await fs.mkdir(path.join(job, 'photos'), { recursive: true });
  const copied = new Map();
  const rel = mapPhotos(scenes, (abs) => {
    if (!copied.has(abs)) copied.set(abs, `photos/${copied.size}${path.extname(abs) || '.jpg'}`);
    return copied.get(abs);
  });
  for (const [abs, name] of copied) await fs.copyFile(abs, path.join(job, name));
  await fs.copyFile(audioPath, path.join(job, 'vo.mp3'));
  await fs.writeFile(path.join(job, 'spec.json'), JSON.stringify({ ...meta, scenes: rel }));
  const tgz = path.join(dir, 'render-job.tgz');
  execFileSync('tar', ['-czf', tgz, '-C', job, '.']);
  await fs.rm(job, { recursive: true, force: true });
  return tgz;
}

export async function readJob(jobDir) {
  const spec = JSON.parse(await fs.readFile(path.join(jobDir, 'spec.json'), 'utf8'));
  const root = path.resolve(jobDir);
  const scenes = mapPhotos(spec.scenes, (rel) => {
    const abs = path.resolve(root, rel);
    if (!abs.startsWith(root + path.sep)) throw new Error(`Path foto di luar folder job: ${rel}`);
    return abs;
  });
  return { spec: { ...spec, scenes }, audioPath: path.join(root, 'vo.mp3') };
}

export async function dispatchRender(job) {
  if (!JOB_RE.test(job)) throw new Error(`Nama job tidak valid: ${job}`);
  const repo = process.env.GITHUB_RENDER_REPO;
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.GITHUB_RENDER_TOKEN}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ ref: process.env.GITHUB_RENDER_REF || 'main', inputs: { job } }),
  });
  if (res.status !== 204) {
    const detail = await res.text().catch(() => '');
    throw new Error(`GitHub menolak memicu render (${res.status}): ${detail.slice(0, 200)}`);
  }
  return `https://github.com/${repo}/actions/workflows/${WORKFLOW}`;
}
