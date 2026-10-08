import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';

test('learning focus trigger stays in the header on narrow screens and preserves panel, chat and assessment guards', {
  skip: !process.env.PLAYWRIGHT_MODULE, timeout: 60000,
}, async t => {
  const playwright = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
  const chromium = playwright.chromium || playwright.default?.chromium;
  const source = await readFile(new URL('../../welcome.html', import.meta.url), 'utf8');
  const styles = [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n');
  const header = source.match(/<header class="student-nav lesson-student-nav">[\s\S]*?<\/header>/)[0];
  const guards = source.slice(source.indexOf('window.__tutorHidden = false;'), source.indexOf('// ── YouTube segment playback'));
  const start = source.indexOf('const S = (window.AISenpai = {');
  const mascot = source.slice(start, source.indexOf('// INIT', start));
  const app = express();
  app.use(express.static(fileURLToPath(new URL('../..', import.meta.url))));
  app.get('/focus-trigger-fixture', (_req, res) => res.type('html').send(`<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="stylesheet" href="/styles/tokens.css"><link rel="stylesheet" href="/styles/student-nav.css"><link rel="stylesheet" href="/maneko.css">
    <style>${styles}</style>${header}<main id="fixture-material" style="height:1800px;padding:20px">Materi belajar tetap terlihat.</main>
    <script>window.ezApi=async()=>({ok:true,json:async()=>({total:0,weakGrammar:[]})});
    window.currentState={course:'n5',moduleId:'module',lessonId:'lesson'};
    window.COURSE_CONTENT={n5:{modules:[{id:'module',lessons:[{id:'lesson',type:'deck'}]}]}};
    window.getProgress=()=>({});window.toggleSidebar=()=>{};window.logout=()=>{};
    window.escapeHtml=value=>String(value);</script><script src="/maneko.js"></script>
    <script>${guards}\n${mascot}\nAISenpai.init();updateTutorVisibility();document.getElementById('sidebar-toggle').classList.add('visible');</script></html>`));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  let browser;
  t.after(async () => { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  browser = await chromium.launch({ headless: true,
    ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE }
      : process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
  });
  const page = await browser.newPage({ viewport: { width: 320, height: 800 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(4000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  for (const width of [320, 390, 768, 860]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(origin + '/focus-trigger-fixture');
    const trigger = page.locator('#lesson-focus');
    assert.equal(await trigger.isVisible(), true);
    assert.equal(await page.locator('.senpai-orb-wrap').isVisible(), false);
    assert.equal(await page.locator('.maneko-panel').isVisible(), false);
    const box = await trigger.boundingBox(), nav = await page.locator('.lesson-student-nav').boundingBox();
    assert.ok(box.width >= 44 && box.height >= 44 && box.x >= 0 && box.x + box.width <= width, `accessible trigger fits ${width}px`);
    assert.ok(box.y >= nav.y && box.y + box.height <= nav.y + nav.height, 'trigger is in header flow');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `no horizontal overflow at ${width}px`);
    if (width === 390 && process.env.MANEKO_SCREENSHOT) await page.screenshot({ path: process.env.MANEKO_SCREENSHOT });
    await trigger.click();
    assert.equal(await page.locator('.maneko-panel').isVisible(), true, 'outside-click listener accepts the header trigger');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.maneko-panel').isVisible(), false);
    assert.equal(await trigger.evaluate(node => document.activeElement === node), true, 'focus returns to visible header control');
    await trigger.click();
    await page.locator('#fixture-material').click({ position: { x: 30, y: 30 } });
    assert.equal(await page.locator('.maneko-panel').isVisible(), false, 'outside click closes the explicit panel');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
    await trigger.click();
    await page.getByRole('button', { name: 'Tanya materi kepada Maneko' }).click();
    assert.equal(await page.locator('#senpai-input').isVisible(), true, 'explicit chat still opens');
    await page.getByRole('button', { name: 'Tutup chat AI Senpai' }).click();
    for (const type of ['quiz', 'grammar_task']) {
      await page.evaluate(type => { COURSE_CONTENT.n5.modules[0].lessons[0].type = type; updateTutorVisibility(); }, type);
      assert.equal(await trigger.isVisible(), false);
      assert.equal(await trigger.isDisabled(), true);
    }
    await page.evaluate(() => { COURSE_CONTENT.n5.modules[0].lessons[0].type = 'deck'; updateTutorVisibility(); });
    assert.equal(await trigger.isVisible(), true);
    await page.evaluate(() => {
      AISenpai.reminders = [{ id: 'fixture', group: 'continue', title: 'Pengingat', sub: 'Belajar', icon: '▶' }];
      AISenpai.mode = 'peek'; AISenpai.render();
    });
    assert.equal(await page.locator('#ai-senpai').isVisible(), false, 'automatic peek does not cover material');
    await page.evaluate(() => { AISenpai.mode = 'toast'; AISenpai.render(); });
    assert.equal(await page.locator('#ai-senpai').isVisible(), false, 'automatic toast does not cover material');
  }
  await page.setViewportSize({ width: 861, height: 900 });
  await page.goto(origin + '/focus-trigger-fixture');
  assert.equal(await page.locator('#lesson-focus').isVisible(), false);
  assert.equal(await page.locator('.senpai-orb-btn').isVisible(), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal overflow just above the breakpoint');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(origin + '/focus-trigger-fixture');
  assert.equal(await page.locator('#lesson-focus').isVisible(), false);
  const desktop = page.locator('.senpai-orb-btn');
  await desktop.click();
  assert.equal(await page.locator('.maneko-panel').isVisible(), true);
  assert.equal(await page.locator('.senpai-orb-btn').getAttribute('aria-expanded'), 'true');
  // The old orb is recreated by AISenpai.render(); return focus must find the
  // currently visible trigger, not the hidden header control or detached orb.
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.senpai-orb-btn').evaluate(node => document.activeElement === node), true);
  assert.deepEqual(errors, []);
  if (process.env.MANEKO_RESULT) await writeFile(process.env.MANEKO_RESULT, JSON.stringify({
    passed: true, widths: [320, 390, 768, 860, 861, 1280], pageErrors: errors,
    checks: ['header bounds', 'no overflow', 'mobile overlay absent', 'explicit panel and chat', 'ARIA', 'Escape and outside click', 'visible return focus', 'assessment guards', 'desktop trigger'],
  }, null, 2));
});
