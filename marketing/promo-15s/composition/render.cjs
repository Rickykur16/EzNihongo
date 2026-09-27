// Render the composition frame by frame.
//   node render.cjs frames <fps> <subframes>   -> frames/f%05d.png (sub-frames for motion blur)
//   node render.cjs stills t1,t2,...           -> stills/t_<t>.png
const { chromium } = (() => { try { return require('playwright'); } catch { return require('/opt/node22/lib/node_modules/playwright'); } })();
const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname;
const REPO = path.resolve(__dirname, '../../..');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  // /assets/* is served from the repo's own assets folder (photos reused from the landing page)
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const base = rel.startsWith('/assets/') ? REPO : root;
  const f = path.join(base, rel);
  if (!f.startsWith(base) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end(); }
  res.setHeader('Content-Type', types[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/${process.env.PAGE || 'index.html'}`;
  const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('PAGEERR', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await page.goto(base); await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  const stage = await page.$('#stage');
  const mode = process.argv[2];
  const shot = async (t, file) => {
    await page.evaluate((t) => new Promise(r => { window.render(t); requestAnimationFrame(() => requestAnimationFrame(r)); }), t);
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
  };
  if (mode === 'stills') {
    fs.mkdirSync(root + '/stills', { recursive: true });
    const tag = (process.env.PAGE || 'index.html').replace('.html', '');
    for (const t of process.argv[3].split(',').map(Number)) await shot(t, `${root}/stills/${tag}_t_${t.toFixed(3)}.png`);
  } else {
    const fps = Number(process.argv[3] || 30), sub = Number(process.argv[4] || 1), shutter = 0.5;
    const from = Number(process.argv[5] || 0), to = Number(process.argv[6] || fps * 15);
    fs.mkdirSync(root + '/frames', { recursive: true });
    const t0 = Date.now();
    for (let n = from; n < to; n++) for (let k = 0; k < sub; k++) {
      const t = (n + (sub > 1 ? (k / sub) * shutter - shutter / 2 + shutter / (2 * sub) : 0)) / fps;
      await shot(Math.max(0, Math.min(14.999, t)), `${root}/frames/f${String(n).padStart(4, '0')}_${k}.png`);
      if (n % 30 === 0 && k === 0) console.log('frame', n, ((Date.now() - t0) / 1000).toFixed(1) + 's');
    }
  }
  await browser.close(); server.close();
})();
