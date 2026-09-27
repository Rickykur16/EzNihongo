const { chromium } = (() => { try { return require('playwright'); } catch { return require('/opt/node22/lib/node_modules/playwright'); } })();
const fs = require('fs'), crypto = require('crypto');
fs.mkdirSync(__dirname + '/netcache', { recursive: true });
const BASE = 'http://127.0.0.1:8080';
async function open(opts = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'id-ID', timezoneId: 'Asia/Jakarta', ...opts });
  await ctx.route(u => !u.href.startsWith(BASE), async (route) => {
    const url = route.request().url();
    if (!/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(url)) return route.abort();
    const key = crypto.createHash('sha1').update(url).digest('hex'); const f = __dirname + '/netcache/' + key;
    if (!fs.existsSync(f)) {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36' } });
      fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); fs.writeFileSync(f + '.type', r.headers.get('content-type') || '');
    }
    return route.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': fs.readFileSync(f + '.type', 'utf8'), 'access-control-allow-origin': '*' } });
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERR', e.message));
  await page.goto(BASE + '/login.html');
  await page.evaluate(async () => { const x = await fetch('/api/auth/login', {method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({email:'rina.contoh@example.test', password:'rahasia-contoh-123'})}); const j = await x.json(); localStorage.setItem('ez_user', JSON.stringify(j.user)); });
  return { browser, ctx, page };
}
async function settle(page, ms = 800) { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(ms); }
module.exports = { open, settle, BASE };
