// Render frame demi frame lewat Chromium (Playwright) lalu encode dengan ffmpeg.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'template');

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`${cmd} keluar dengan kode ${c}`))));
  });
}

// Subset font Noto Sans JP hanya untuk karakter yang dipakai (unduhan kecil).
async function writeFonts(dir, spec) {
  const chars = new Set(JSON.stringify(spec) + '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ?!…–—·.,:"\'()');
  const text = [...chars].filter((c) => c.codePointAt(0) < 0x1f000 && c.trim()).join('');
  const url = `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@500;600;700;800;900&display=block&text=${encodeURIComponent(text)}`;
  try {
    let css = await (await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 Chrome/120' } })).text();
    const urls = [...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]);
    for (const [i, u] of urls.entries()) {
      await fs.writeFile(path.join(dir, `f${i}.woff2`), Buffer.from(await (await fetch(u)).arrayBuffer()));
      css = css.replace(u, `f${i}.woff2`);
    }
    await fs.writeFile(path.join(dir, 'fonts.css'), css);
  } catch {
    console.warn('⚠ Gagal mengunduh font Google, memakai font sistem.');
    await fs.writeFile(path.join(dir, 'fonts.css'), '');
  }
}

export async function renderVideo({ spec, workDir, audioPath, outPath, fps = 30 }) {
  const dir = path.join(workDir, 'render');
  await fs.mkdir(dir, { recursive: true });
  for (const f of ['index.html', 'logo_t.png', 'maneko.svg']) await fs.copyFile(path.join(TEMPLATE, f), path.join(dir, f));
  await writeFonts(dir, spec);

  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.addInitScript((s) => { window.__SPEC = s; }, spec);
  await page.goto('file://' + path.resolve(dir, 'index.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
  await page.evaluate(() => window.layout());
  await page.waitForTimeout(300);
  const total = await page.evaluate(() => window.TOTAL);

  const silent = path.join(dir, 'silent.mp4');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '18', silent], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((r, j) => ff.on('close', (c) => (c === 0 ? r() : j(new Error('ffmpeg gagal')))));
  const n = Math.round(total * fps);
  for (let i = 0; i < n; i++) {
    await page.evaluate((t) => window.render(t), i / fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 150 === 0) process.stdout.write(`\r  render ${Math.round((i / n) * 100)}%`);
  }
  ff.stdin.end();
  await done;
  // frame pertama untuk cover/thumbnail
  await page.evaluate(() => window.render(0));
  await page.screenshot({ path: path.join(workDir, 'cover.png') });
  await browser.close();
  process.stdout.write('\r  render 100%\n');

  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', audioPath, '-map', '0:v', '-map', '1:a',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-af', 'apad', '-t', total.toFixed(3), '-movflags', '+faststart', outPath]);
  return { total };
}
