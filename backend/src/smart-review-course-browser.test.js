import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';

test('browser: selected course survives Dashboard, Review retry/session, Progress, and return navigation', {
  skip: !process.env.PLAYWRIGHT_MODULE, timeout: 60000,
}, async (t) => {
  const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
  const user = { id: 'review-browser-user', email: 'review@example.invalid', fullName: 'Siswa Review' };
  const courses = ['n5', 'n4'].map((slug) => ({ id: slug, slug, title: `Kelas ${slug.toUpperCase()}`, level: slug.toUpperCase() }));
  const calls = [];
  let failSummary = true;
  const data = (slug) => ({
    courses, course: { ...courses.find((course) => course.slug === slug), progress: { percentage: 50, completedLessons: 1, totalLessons: 2 } },
    continueLearning: { section: 'Kurikulum', chapter: { slug: 'bab-1', title: 'Bab 1' }, lesson: { slug: 'kosakata', title: 'Kosakata' } },
    review: { total: 1, byCategory: { vocabulary: 1 } }, mastery: {}, weeklyActivity: {}, liveClass: {},
    focus: { title: 'Kosakata', detail: 'Latih kembali kosakata.', action: 'review', reviewCategory: 'vocabulary' },
    chapters: [{ title: 'Bab 1', section: 'Kurikulum', progress: { percentage: 50, completedLessons: 1, totalLessons: 2 }, reviewDue: 1 }],
  });
  const app = express();
  app.use(express.json());
  app.use('/api', (req, res) => {
    calls.push({ path: req.path, query: { ...req.query }, body: req.body, page: new URL(req.get('referer') || 'http://fixture/').pathname });
    if (req.path === '/auth/refresh') return res.json({ accessToken: 'fixture-token', user });
    if (req.path === '/auth/me') return res.json({ user });
    if (['/dashboard/me', '/progress/me'].includes(req.path)) return res.json(data(req.query.course || 'n5'));
    if (req.path === '/review/summary') {
      if (failSummary && req.query.course === 'n4') { failSummary = false; return res.status(503).json({ error: 'temporary_failure' }); }
      return res.json({ total: 1, byCategory: { vocabulary: 1 } });
    }
    if (req.path === '/review/sessions') return res.status(201).json({
      sessionId: 'fixture-session', questions: [{ category: 'vocabulary', itemId: 'word', skill: 'jp2id',
        question: { prompt: 'よてい', options: ['rencana', 'janji'] } }],
    });
    if (req.path.endsWith('/answers')) return res.json({ passed: false, correctIndex: 0 });
    if (req.path === '/tts/version') return res.json({ version: 'fixture' });
    if (req.path === '/orders/me') return res.json({ orders: [] });
    return res.json({});
  });
  app.use(express.static(fileURLToPath(new URL('../../', import.meta.url))));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  let browser;
  t.after(async () => {
    await browser?.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}),
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  t.after(() => { if (errors.length) t.diagnostic(JSON.stringify(errors)); });
  page.on('pageerror', (error) => errors.push(error.message));
  page.setDefaultTimeout(6000);
  const origin = `http://127.0.0.1:${server.address().port}`;
  await context.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const courseOf = (href) => new URL(href, origin).searchParams.get('course');
  await page.goto(`${origin}/dashboard.html?course=n4`);
  await page.locator('#course-select').waitFor();
  assert.equal(await page.locator('#course-select').inputValue(), 'n4');
  assert.equal(courseOf(await page.locator('.review-card a').getAttribute('href')), 'n4');
  await page.locator('.review-card a').click();
  await page.getByRole('button', { name: 'Coba lagi', exact: true }).click();
  await page.getByRole('button', { name: 'Mulai Smart Review', exact: true }).click();
  await page.getByRole('button', { name: 'janji', exact: true }).click();
  await page.getByRole('button', { name: 'Lanjut →', exact: true }).click();
  await page.getByRole('heading', { name: 'Sesi selesai.' }).waitFor();
  assert.equal(courseOf(await page.getByRole('link', { name: 'Kembali ke Dashboard', exact: true }).getAttribute('href')), 'n4');
  assert.equal(courseOf(await page.getByRole('link', { name: 'Lanjut Belajar', exact: true }).getAttribute('href')), 'n4');
  for (const href of await page.locator('.student-nav a[href]').evaluateAll((links) => links.map((link) => link.href))) {
    assert.equal(courseOf(href), 'n4');
  }
  assert.ok(calls.filter((call) => call.path === '/review/summary' && call.page === '/review.html').every((call) => call.query.course === 'n4'));
  assert.equal(calls.find((call) => call.path === '/review/sessions').body.course, 'n4');
  await page.getByRole('link', { name: 'Kembali ke Dashboard', exact: true }).click();
  await page.locator('#course-select').waitFor();
  assert.equal(courseOf(page.url()), 'n4');
  await page.goto(`${origin}/review.html?course=n4&category=vocabulary`);
  await page.getByRole('heading', { name: 'よてい' }).waitFor();
  assert.equal(calls.filter((call) => call.path === '/review/sessions').at(-1).body.category, 'vocabulary');
  assert.equal(calls.filter((call) => call.path === '/review/sessions').at(-1).body.course, 'n4');

  await page.goto(`${origin}/progress.html?course=n4`);
  await page.locator('#course').waitFor();
  const progressLinks = await page.locator('a[href^="review.html"]').evaluateAll((links) => links.map((link) => link.href));
  assert.ok(progressLinks.length >= 3);
  assert.ok(progressLinks.every((href) => courseOf(href) === 'n4'));

  await page.goto(`${origin}/review.html`);
  await page.getByRole('button', { name: 'Mulai Smart Review', exact: true }).click();
  await page.getByRole('heading', { name: 'よてい' }).waitFor();
  assert.equal(calls.filter((call) => call.path === '/review/summary').at(-1).query.course, undefined);
  assert.equal(calls.filter((call) => call.path === '/review/sessions').at(-1).body.course, undefined);

  await page.goto(`${origin}/review.html?course=n4`);
  await page.getByRole('link', { name: 'Lanjut Belajar', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  // Verify the actual navigation target; lesson hydration is covered separately.
  await page.getByRole('link', { name: 'Lanjut Belajar', exact: true }).click();
  await page.waitForURL('**/welcome.html?course=n4');
});
