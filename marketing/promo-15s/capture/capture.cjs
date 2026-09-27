// Captures real EzNihongo student screens (local backend, fictional student
// "Rina Pratiwi"). A few JSON responses are patched with sample numbers so the
// screens look like an active learner; all rendering is the real frontend.
const { open, settle, BASE } = require('./lib.cjs');
const fs = require('fs');
const OUT = require('path').resolve(__dirname, '../composition/img'); fs.mkdirSync(OUT, { recursive: true });
const rects = {};
async function rectOf(page, sel, name) {
  const r = await page.locator(sel).first().boundingBox();
  if (r) rects[name] = r; else console.log('no rect', name, sel);
}
async function shot(page, name) { await settle(page, 500); await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', name); }

const reviewSession = {
  sessionId: '00000000-0000-4000-8000-000000000015',
  questions: [{
    category: 'vocabulary', itemType: 'vocabulary', itemId: 'v-okyakusama', lessonId: 'l-bab15',
    question: { variant: 'choice', prompt: '「お客様」の意味は？', instruction: 'Pilih arti kata yang tepat.',
      options: ['pelayan toko', 'pelanggan (sangat formal)', 'resepsionis / loket', 'kembalian'] },
  }, ...Array.from({ length: 11 }, (_, i) => ({ category: 'vocabulary', itemType: 'vocabulary', itemId: 'x' + i, lessonId: 'l', question: { variant: 'choice', prompt: '…', options: ['a', 'b', 'c', 'd'] } }))],
};

(async () => {
  const { browser, ctx, page } = await open();
  await ctx.route('**/api/dashboard/me*', async (route) => {
    const res = await route.fetch(); const j = await res.json();
    if (j.course) {
      j.course.progress = { completedLessons: 23, totalLessons: 62, percentage: 37 };
      j.continueLearning = { section: 'Kurikulum', chapter: { slug: 'komunikasi-pelayanan', title: 'BAB 15 : Pelayanan, Pilihan & Perubahan' }, lesson: { slug: 'pelajaran-2-kosakata', title: 'Kosakata 語彙', type: 'deck' } };
      j.review = { total: 12, byCategory: { kana: 0, vocabulary: 7, kanji: 3, grammar: 2 } };
      j.mastery = { kana: { label: 'Sangat baik', percentage: 94, attempts: 120 }, vocabulary: { label: 'Baik', percentage: 86, attempts: 64 }, kanji: { label: 'Berkembang', percentage: 72, attempts: 30 }, grammar: { label: 'Berkembang', percentage: 75, attempts: 24 } };
      j.weeklyActivity = { activeDays: 5, lessonsCompleted: 4, reviewQuestions: 36, attempts: 58, accuracy: 86, accuracyTrend: 4, windowDays: 7 };
      j.weeklyInsight = { kind: 'due_review', message: '12 item sudah siap diulang. Prioritaskan Smart Review sebelum materi baru.', action: 'review' };
      j.focus = { category: 'review', title: 'Kanji Bab 15', detail: 'Beberapa kanji masih sering tertukar. Ulangi sebentar sebelum lanjut.', action: 'review', reviewCategory: 'kanji' };
    }
    route.fulfill({ response: res, json: j });
  });
  await ctx.route('**/api/review/summary*', r => r.fulfill({ json: { total: 12, byCategory: { kana: 0, vocabulary: 7, kanji: 3, grammar: 2 } } }));
  await ctx.route('**/api/review/sessions', r => r.fulfill({ json: reviewSession }));
  await ctx.route('**/api/review/sessions/*/answers', r => r.fulfill({ json: { passed: true, correctIndex: 1, assisted: false } }));
  await ctx.route('**/api/tts**', r => r.fulfill({ status: 404, body: '' }));

  // 1. Dashboard
  await page.goto(BASE + '/dashboard.html', { waitUntil: 'networkidle' });
  await shot(page, 'dashboard');
  await rectOf(page, '.continue-card a.primary', 'dash_continue_btn');
  await rectOf(page, '.continue-card', 'dash_continue_card');

  // 2. Kosakata deck (Bab 15)
  await page.goto(BASE + '/welcome.html?course=n5&module=komunikasi-pelayanan&lesson=pelajaran-2-kosakata', { waitUntil: 'networkidle' });
  await settle(page, 800);
  const grid = page.locator('text=店員').first();
  await page.evaluate(() => window.scrollTo(0, 0));
  const y = await page.evaluate(() => { const h = [...document.querySelectorAll('h1,h2')].find(e => /Kosakata/.test(e.textContent)); return h.getBoundingClientRect().top + scrollY - 76; });
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await shot(page, 'deck_top');
  const y2 = await page.evaluate(() => { const el = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim() === '店員'); const card = el.closest('[class*=card]') || el.parentElement; return card.getBoundingClientRect().top + scrollY - 88; });
  await page.evaluate((y) => window.scrollTo(0, y), y2);
  await shot(page, 'deck_grid');
  const cardInfo = await page.evaluate(() => { const el = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim() === '店員'); let card = el; while (card && !(card.getBoundingClientRect().height > 120)) card = card.parentElement; const r = card.getBoundingClientRect(); const b = card.querySelector('button'); const br = b?.getBoundingClientRect(); return { card: { x: r.x, y: r.y, width: r.width, height: r.height }, btn: br && { x: br.x, y: br.y, width: br.width, height: br.height }, cls: card.className }; });
  rects.deck_card = cardInfo.card; rects.deck_speaker = cardInfo.btn; console.log('card', cardInfo.cls);

  // 3. Dialog scene (Bab 15 Tata Bahasa, real grammar content)
  await page.goto(BASE + '/welcome.html?course=n5&module=komunikasi-pelayanan&lesson=tata-bahasa-bab-15-bahasa-pelayanan', { waitUntil: 'networkidle' });
  await settle(page, 800);
  const btn = page.locator('.grammar-dialog-block button').first();
  await btn.scrollIntoViewIfNeeded(); await btn.tap(); await settle(page, 1500);
  await page.waitForFunction(() => [...document.querySelectorAll('.ez-dialog-actor img')].every(i => i.complete && i.naturalWidth && getComputedStyle(i).visibility === 'visible'));
  const yd = await page.evaluate(() => { const s = document.querySelector('.ez-dialog-stage'); const r = s.getBoundingClientRect(); return r.top + scrollY - (844 - 60 - r.height - 20); });
  await page.evaluate((y) => window.scrollTo(0, y), yd);
  for (const [i, name] of [[-1, 'dialog_idle'], [0, 'dialog_a'], [1, 'dialog_b'], [2, 'dialog_c']]) {
    await page.evaluate((i) => { const root = document.querySelector('.ez-dialog-stage').closest('[data-dialog]'); EzDialogue.sync(root, i, i < 0 ? 'idle' : 'speaking'); document.querySelectorAll('.gk-line').forEach((l, k) => l.classList.toggle('gk-active', k === i)); }, i);
    await shot(page, name);
  }
  await rectOf(page, '.ez-dialog-stage', 'dialog_stage');
  await rectOf(page, '.ez-dialog-caption', 'dialog_caption');

  // 4. Smart Review
  await page.goto(BASE + '/review.html', { waitUntil: 'networkidle' });
  await shot(page, 'review_home');
  await rectOf(page, '#start-mixed', 'review_start_btn');
  await page.locator('#start-mixed').tap(); await settle(page, 800);
  await shot(page, 'review_q');
  await rectOf(page, '[data-option="1"]', 'review_correct');
  await rectOf(page, '.prompt', 'review_prompt');
  await page.locator('[data-option="1"]').tap(); await settle(page, 600);
  await shot(page, 'review_ok');

  // 5. Live Class
  await page.goto(BASE + '/live.html?course=n5', { waitUntil: 'networkidle' });
  await shot(page, 'live');
  await rectOf(page, '.upcoming-card', 'live_card');

  fs.writeFileSync(OUT + '/rects.json', JSON.stringify(rects, null, 1));
  await browser.close();
})();
