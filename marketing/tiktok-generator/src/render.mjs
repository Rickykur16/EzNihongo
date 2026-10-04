// Render frame demi frame lewat Chromium (Playwright) lalu encode dengan ffmpeg.
import { chromium } from 'playwright';
import { execFileSync, spawn } from 'node:child_process';
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

// Foto HP/stok bisa ribuan piksel; Chromium men-decode & men-zoom-nya tiap frame.
// Kecilkan dulu (sisi terpanjang ≤ 1280) supaya render tidak berat di VPS kecil.
function shrinkPhotos(spec, dir) {
  const cache = new Map();
  const shrink = (src) => {
    if (!src) return src;
    if (cache.has(src)) return cache.get(src);
    const out = path.join(dir, `ph${cache.size}.jpg`);
    let res = src;
    try {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vf',
        "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))'", '-q:v', '3', out]);
      res = path.resolve(out);
    } catch { console.warn(`  ⚠ gagal mengecilkan ${path.basename(src)}, memakai aslinya.`); }
    cache.set(src, res);
    return res;
  };
  return { ...spec, scenes: spec.scenes.map((sc) => ({ ...sc, photo: shrink(sc.photo), items: sc.items.map((it) => ({ ...it, photo: shrink(it.photo) })) })) };
}

async function shot(page, opts) {
  // VPS yang sibuk kadang butuh > 30 dtk untuk satu frame; beri waktu lebih + satu kali ulang.
  try { return await page.screenshot({ ...opts, timeout: 120000 }); }
  catch { return page.screenshot({ ...opts, timeout: 120000 }); }
}

export async function renderVideo({ spec, workDir, audioPath, outPath, fps = 30 }) {
  const dir = path.join(workDir, 'render');
  const frames = path.join(dir, 'frames');
  await fs.rm(frames, { recursive: true, force: true });
  await fs.mkdir(frames, { recursive: true });
  for (const f of ['index.html', 'logo_t.png', 'maneko.svg']) await fs.copyFile(path.join(TEMPLATE, f), path.join(dir, f));
  await writeFonts(dir, spec);
  spec = shrinkPhotos(spec, dir);

  const browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ['--disable-dev-shm-usage', '--disable-gpu'],
  });
  let total;
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    await page.addInitScript((s) => { window.__SPEC = s; }, spec);
    await page.goto('file://' + path.resolve(dir, 'index.html'));
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
    await page.evaluate(() => window.layout());
    await page.waitForTimeout(300);
    total = await page.evaluate(() => window.TOTAL);

    // Tahap 1: semua frame ke disk. Encoder baru jalan setelah browser ditutup,
    // supaya Chromium dan x264 tidak berebut CPU/RAM di VPS kecil.
    const n = Math.round(total * fps);
    for (let i = 0; i < n; i++) {
      await page.evaluate((t) => window.render(t), i / fps);
      await shot(page, { type: 'jpeg', quality: 92, path: path.join(frames, `${String(i).padStart(5, '0')}.jpg`) });
      if (i % 150 === 0) process.stdout.write(`\r  render ${Math.round((i / n) * 100)}%`);
    }
    // frame pertama untuk cover/thumbnail
    await page.evaluate(() => window.render(0));
    await shot(page, { path: path.join(workDir, 'cover.png') });
  } finally {
    await browser.close();
  }
  process.stdout.write('\r  render 100%\n');

  // Tahap 2: encode + gabung suara.
  const silent = path.join(dir, 'silent.mp4');
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(frames, '%05d.jpg'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '18', silent]);
  await fs.rm(frames, { recursive: true, force: true });
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', audioPath, '-map', '0:v', '-map', '1:a',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-af', 'apad', '-t', total.toFixed(3), '-movflags', '+faststart', outPath]);
  return { total };
}
