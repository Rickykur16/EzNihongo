const { open, settle, BASE } = require('./lib.cjs');
const fs = require('fs');
(async () => {
  const { browser, page } = await open();
  await page.goto(BASE + '/welcome.html?course=n5&module=komunikasi-pelayanan&lesson=pelajaran-2-kosakata', { waitUntil: 'networkidle' });
  await settle(page, 800);
  // chrome = fixed/sticky header + bottom nav + mascot, captured from a normal viewport shot
  const fixed = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('body *').forEach(el => { const cs = getComputedStyle(el); if ((cs.position === 'fixed' || cs.position === 'sticky') && el.offsetHeight > 20) { const r = el.getBoundingClientRect(); out.push({ tag: el.tagName, cls: String(el.className).slice(0, 60), y: r.y, h: r.height, pos: cs.position }); el.dataset.promoFixed = '1'; } });
    return out;
  });
  console.log(JSON.stringify(fixed));
  await page.addStyleTag({ content: '[data-promo-fixed]{visibility:hidden!important}' });
  await settle(page, 300);
  await page.screenshot({ path: require('path').resolve(__dirname, '../composition/img/deck_full_raw.png'), fullPage: true });
  const y = await page.evaluate(() => { const el = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim() === '店員'); let c = el; while (c && !(c.getBoundingClientRect().height > 120)) c = c.parentElement; const r = c.getBoundingClientRect(); const h = [...document.querySelectorAll('h1,h2')].find(e => /Kosakata/.test(e.textContent)).getBoundingClientRect(); return { card: r.top + scrollY, cardX: r.x, cardW: r.width, cardH: r.height, title: h.top + scrollY }; });
  fs.writeFileSync(require('path').resolve(__dirname, '../composition/img/deck_scroll.json'), JSON.stringify(y));
  console.log(y);
  await browser.close();
})();
