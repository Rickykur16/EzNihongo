// Parallel frame renderer with temporal super-sampling (motion blur).
// Each output frame = average of SUB renders spread over a 180-degree shutter.
// Workers stream PNGs into ffmpeg (tmix + select) -> lossless FFV1 segments.
//   [PAGE=ssw.html] [SEG=seg_ssw] node render_par.cjs [workers=4] [fps=30] [sub=4]
// Duration comes from window.DURATION in the page (default 15 s).
const { chromium } = (() => { try { return require('playwright'); } catch { return require('/opt/node22/lib/node_modules/playwright'); } })();
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const root = __dirname;
const REPO = path.resolve(__dirname, '../../..');
const WORKERS = Number(process.argv[2] || 4), FPS = Number(process.argv[3] || 30), SUB = Number(process.argv[4] || 4);
const PAGE = process.env.PAGE || 'index.html', SEG = process.env.SEG || 'seg';
let TOTAL = 0, DUR = 15;
const SHUTTER = 0.5;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  // /assets/* is served from the repo's own assets folder (photos reused from the landing page)
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const base = rel.startsWith('/assets/') ? REPO : root;
  const f = path.join(base, rel);
  if (!f.startsWith(base) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end(); }
  res.setHeader('Content-Type', types[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res);
});
async function worker(w, from, to, base, browser) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('PAGEERR', w, e.message));
  await page.goto(base); await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  const cdp = await page.context().newCDPSession(page);
  const out = `${root}/${SEG}/seg_${String(w).padStart(2, '0')}.mkv`;
  const sel = SUB > 1 ? `tmix=frames=${SUB}:weights='${Array(SUB).fill(1).join(' ')}',select='eq(mod(n\\,${SUB})\\,${SUB - 1})',` : '';
  const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS * SUB), '-c:v', 'png', '-i', '-',
    '-vf', `${sel}setpts=N/(${FPS}*TB)`, '-r', String(FPS), '-c:v', 'ffv1', '-level', '3', '-pix_fmt', 'bgr0', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let n = from; n < to; n++) {
    for (let k = 0; k < SUB; k++) {
      const off = SUB > 1 ? (k / SUB) * SHUTTER - SHUTTER / 2 + SHUTTER / (2 * SUB) : 0;
      const t = Math.max(0, Math.min(DUR - 1e-4, (n + off) / FPS));
      await page.evaluate((t) => new Promise(r => { window.render(t); requestAnimationFrame(() => requestAnimationFrame(r)); }), t);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, clip: { x: 0, y: 0, width: 1080, height: 1920, scale: 1 } });
      if (!ff.stdin.write(Buffer.from(data, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
    }
    if ((n - from) % 15 === 0) console.log(`w${w} frame ${n}/${to} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await page.close();
  return out;
}
(async () => {
  fs.rmSync(`${root}/${SEG}`, { recursive: true, force: true }); fs.mkdirSync(`${root}/${SEG}`);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/${PAGE}`;
  {
    const b = await chromium.launch(); const pg = await b.newPage(); await pg.goto(base);
    await pg.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
    DUR = await pg.evaluate(() => window.DURATION || 15); TOTAL = Math.round(DUR * FPS); await b.close();
    console.log(PAGE, 'duration', DUR, 's,', TOTAL, 'frames');
  }
  const browsers = await Promise.all(Array.from({ length: WORKERS }, () => chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb'] })));
  const per = Math.ceil(TOTAL / WORKERS);
  const segs = await Promise.all(browsers.map((b, w) => worker(w, w * per, Math.min(TOTAL, (w + 1) * per), base, b)));
  fs.writeFileSync(`${root}/${SEG}/list.txt`, segs.map(s => `file '${s}'`).join('\n'));
  await Promise.all(browsers.map(b => b.close())); server.close();
  console.log('done', segs.length, 'segments');
})();
