import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(process.env.EZ_QA_NODE_PACKAGE || import.meta.url);
const { chromium } = require('playwright');
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = process.env.EZ_QA_OUTPUT || path.join(repo, 'backend/.qa/learning-flow');
await fs.mkdir(output, { recursive: true });

const fixture = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Learning flow browser QA</title>
  <link rel="stylesheet" href="/styles/dialogue-questions.css">
  <style>
    * { box-sizing:border-box; }
    body { margin:0; background:#f4f1eb; color:#23211e; font:16px/1.5 system-ui,sans-serif; }
    main { width:min(860px,100%); margin:auto; padding:20px; }
    .qa-card { margin:12px 0; padding:16px; border-radius:12px; background:#fff; }
    .grammar-dialog-block { min-height:150px; padding:18px; border-radius:12px; background:#efe4d3; }
    .task-banner { display:flex; justify-content:space-between; gap:12px; align-items:center; background:#243d34; color:#fff; }
    button { font:inherit; }
    #complete { min-height:44px; padding:9px 16px; }
    @media(max-width:390px) { main { padding:10px; } .task-banner { align-items:flex-start; flex-direction:column; } }
  </style>
</head>
<body>
  <main id="main-content"></main>
  <script src="/src/dialogue-questions.js"></script>
  <script>
    const ids = {
      inline: '10000000-0000-4000-8000-000000000001',
      stale: '10000000-0000-4000-8000-000000000002',
      legacy: '10000000-0000-4000-8000-000000000003',
      legacy_session: '10000000-0000-4000-8000-000000000004',
      batch_error: '10000000-0000-4000-8000-000000000005'
    };
    const grammarId = '20000000-0000-4000-8000-000000000001';
    const questions = [{
      id: '30000000-0000-4000-8000-000000000001',
      version: '40000000-0000-4000-8000-000000000001',
      prompt: 'Di mana percakapan berlangsung?',
      options: ['Di rumah', 'Di sekolah', 'Di stasiun'], sortOrder: 1
    }, {
      id: '30000000-0000-4000-8000-000000000002',
      version: '40000000-0000-4000-8000-000000000002',
      prompt: 'Kapan mereka pergi ke perpustakaan?',
      options: ['Sekitar pukul tiga', 'Pagi sekali', 'Besok malam'], sortOrder: 2
    }];
    const response = (status, body) => ({
      ok: status >= 200 && status < 300, status,
      json: async () => body
    });
    function markup() {
      return '<h1>Pelajaran komunikasi</h1>' +
        '<div class="qa-card task-banner" data-dq-task-banner><strong>Tugas Bunpou</strong><button type="button">Mulai tugas</button></div>' +
        '<section class="qa-card" id="video"><h2>Video</h2><p>Materi utama tetap tersedia.</p></section>' +
        '<article class="qa-card" id="grammar"><h2>Grammar: ～へ行きます</h2>' +
          '<div class="dq-goal" data-dq-goal-for="' + grammarId + '" hidden></div>' +
          '<section class="grammar-dialog-block"><h3>Dialog contoh</h3><p>A: 今日、図書館へ行きますか。</p><p>B: はい、三時ごろ行きます。</p></section>' +
          '<div class="dq-questions" data-dq-questions-for="' + grammarId + '" hidden></div>' +
        '</article><div data-dq-task-after-grammar></div>' +
        '<div class="dq-legacy-session-slot" hidden></div>' +
        '<button id="complete" type="button">Tandai selesai & lanjut</button>';
    }
    function moveBanner(root, placement) {
      if (placement?.mode !== 'inline') return;
      const banner = root.querySelector('[data-dq-task-banner]');
      const anchor = root.querySelector('[data-dq-task-after-grammar]');
      if (banner && anchor) anchor.parentNode.insertBefore(banner, anchor);
    }
    window.qaMount = async scenario => {
      const root = document.getElementById('main-content');
      window.EzDialogueQuestions.unmount();
      root.innerHTML = markup();
      window.qaScenario = scenario;
      window.qaPostCount = 0;
      window.qaLegacyOpened = 0;
      window.qaInitialBatch = null;
      const lessonId = ids[scenario];
      const lesson = { apiId: lessonId, grammar: [{ id: grammarId,
        communication_goal: 'Mengajak teman pergi ke perpustakaan',
        example_dialog: 'A: 今日、図書館へ行きますか。\\nB: はい、三時ごろ行きます。' }] };
      window.ezApi = async (url, options = {}) => {
        if (url.includes('/dialogue-questions/') && url.endsWith('/answer')) {
          window.qaPostCount += 1;
          if (scenario === 'stale') return response(409, { error: 'question_version_conflict' });
          const payload = JSON.parse(options.body);
          const questionId = url.split('/')[2];
          const question = questions.find(item => item.id === questionId);
          const correctIndex = questionId === questions[0].id ? 1 : 0;
          return response(200, { attemptId: crypto.randomUUID(), questionId,
            questionVersion: question.version, selectedIndex: payload.optionIndex,
            correct: payload.optionIndex === correctIndex, correctIndex,
            explanation: questionId === questions[0].id
              ? 'Dialog berlangsung di sekolah.' : 'Mereka pergi sekitar pukul tiga.',
            formativeOnly: true });
        }
        if (scenario === 'batch_error') return response(500, { error: 'Internal server error' });
        const placement = scenario === 'legacy_session'
          ? { mode: 'legacy_session', flowVersion: 1, reason: 'active_legacy_session', activeSessionId: ids.inline }
          : scenario === 'legacy'
            ? { mode: 'legacy', flowVersion: null, reason: 'flow_disabled', activeSessionId: null }
            : { mode: 'inline', flowVersion: 2, reason: 'eligible', activeSessionId: null };
        const batch = { lessonId, placement,
          grammars: placement.mode === 'inline' ? [{ grammarId, questions }] : [] };
        window.qaInitialBatch = batch;
        return response(200, batch);
      };
      await window.EzDialogueQuestions.mount({ root, lesson,
        openLegacyTask: () => { window.qaLegacyOpened += 1; },
        onPlacement: placement => moveBanner(root, placement) });
    };
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/' || url.pathname === '/preview.html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(fixture);
      return;
    }
    const file = path.resolve(repo, `.${decodeURIComponent(url.pathname)}`);
    if (!file.startsWith(`${repo}${path.sep}`)) throw new Error('outside root');
    const type = path.extname(file) === '.css' ? 'text/css' : 'text/javascript';
    res.setHeader('Content-Type', `${type}; charset=utf-8`);
    res.end(await fs.readFile(file));
  } catch {
    res.statusCode = 404;
    res.end();
  }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true,
  ...(process.env.EZ_QA_BROWSER ? { executablePath: process.env.EZ_QA_BROWSER } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(base);
  await page.evaluate(() => qaMount('inline'));

  const root = page.locator('#main-content');
  assert.equal(await root.getByText('Mengajak teman pergi ke perpustakaan').count(), 1);
  assert.equal(await root.locator('.dq-question').count(), 2);
  assert.equal(await page.evaluate(() => JSON.stringify(qaInitialBatch).includes('correctIndex')), false);
  assert.equal(await page.evaluate(() => JSON.stringify(qaInitialBatch).includes('explanation')), false);
  assert.equal(await root.getByText('Dialog berlangsung di sekolah.').count(), 0);
  assert.equal(await page.evaluate(() => {
    const grammar = document.querySelector('#grammar');
    const banner = document.querySelector('[data-dq-task-banner]');
    const anchor = document.querySelector('[data-dq-task-after-grammar]');
    return !!(grammar.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING) &&
      !!(banner.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_FOLLOWING);
  }), true);
  assert.equal(await root.locator('.dq-options').first().evaluate(element =>
    getComputedStyle(element).gridTemplateColumns.split(' ').length), 2);

  const first = root.locator('.dq-question').first();
  await first.getByLabel('Di rumah', { exact: true }).check();
  await first.getByRole('button', { name: 'Periksa jawaban' }).click();
  await first.getByText('Belum tepat. Coba lagi.').waitFor();
  assert.equal(await first.getByText('Dialog berlangsung di sekolah.').count(), 0);
  await first.getByLabel('Di sekolah', { exact: true }).check();
  await first.getByRole('button', { name: 'Periksa jawaban' }).click();
  await first.getByText('Dialog berlangsung di sekolah.').waitFor();
  assert.equal(await page.evaluate(() => qaPostCount), 2);
  assert.equal(await first.locator('fieldset').evaluate(element => element.disabled), true);
  await page.screenshot({ path: path.join(output, 'learning-flow-inline-1280.png'), fullPage: true });

  await page.setViewportSize({ width: 360, height: 900 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(await root.locator('.dq-options').first().evaluate(element =>
    getComputedStyle(element).gridTemplateColumns.split(' ').length), 1);
  await page.screenshot({ path: path.join(output, 'learning-flow-inline-360.png'), fullPage: true });

  await page.evaluate(() => qaMount('stale'));
  const stale = root.locator('.dq-question').first();
  await stale.getByLabel('Di sekolah', { exact: true }).check();
  await stale.getByRole('button', { name: 'Periksa jawaban' }).click();
  await stale.getByRole('button', { name: 'Muat ulang soal' }).waitFor();
  assert.equal(await stale.locator('fieldset').evaluate(element => element.disabled), true);

  await page.evaluate(() => qaMount('legacy'));
  assert.equal(await root.locator('.dq-panel:visible').count(), 0);
  assert.equal(await page.evaluate(() => document.querySelector('[data-dq-task-banner]').nextElementSibling.id), 'video');
  assert.equal(await root.getByRole('button', { name: 'Tandai selesai & lanjut' }).isEnabled(), true);

  await page.evaluate(() => qaMount('legacy_session'));
  const legacyButton = root.getByRole('button', { name: 'Buka tugas Bunpou' });
  await legacyButton.click();
  assert.equal(await page.evaluate(() => qaLegacyOpened), 1);

  await page.evaluate(() => qaMount('batch_error'));
  assert.equal(await root.locator('.dq-panel:visible').count(), 0);
  assert.equal(await root.getByRole('button', { name: 'Tandai selesai & lanjut' }).isEnabled(), true);
  assert.deepEqual(pageErrors, []);
  console.log('PASS inline placement, redaction, wrong/correct grading, stale recovery, legacy and API failure');
  console.log('PASS responsive screenshots at 1280px and 360px:', output);
} finally {
  await browser.close();
  server.close();
}
