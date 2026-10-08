import test, { after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';

process.env.JWT_ACCESS_SECRET = 'smart-review-course-test-only';
process.env.ADMIN_EMAILS = '';
const { db } = await import('./db.js');
const { signAccessToken } = await import('./auth.js');
const { default: router, buildReviewCandidates } = await import('./routes/smart-review.js');
const { invalidateKanjiCatalogCache } = await import('./kanji-compounds.js');
const courseIds = Object.fromEntries(['n5', 'n4', 'expired', 'unowned'].map((slug) => [slug, randomUUID()]));
const enrolled = new Set([courseIds.n5, courseIds.n4]);
const lessons = Object.fromEntries(['n5', 'n4'].map((slug) => [slug, randomUUID()]));
const vocabulary = [
  ['n5', 'いぬ', 'anjing'], ['n5', 'ねこ', 'kucing'],
  ['n4', 'よてい', 'rencana'], ['n4', 'やくそく', 'janji'],
].map(([course, japanese, indonesian]) => ({ id: randomUUID(), japanese, reading: japanese, indonesian,
  course_id: courseIds[course], lesson_id: lessons[course] }));
let vocabularyRows = vocabulary;
let kanjiRows = [];
let stateRows = [];
const writes = [];
const execute = async (sql, params = []) => {
  if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql) || sql.includes('pg_advisory_xact_lock')) return { rows: [] };
  if (sql === 'SELECT email FROM admin_emails') return { rows: [] };
  if (sql === 'SELECT id FROM courses WHERE slug = $1') return { rows: courseIds[params[0]] ? [{ id: courseIds[params[0]] }] : [] };
  if (sql.includes('SELECT 1 FROM user_enrollments')) return { rows: enrolled.has(params[1]) ? [{}] : [] };
  if (sql.startsWith('SELECT course_id FROM user_enrollments')) return { rows: [...enrolled].map((course_id) => ({ course_id })) };
  if (sql.startsWith('SELECT p.lesson_id FROM user_progress')) return { rows: Object.values(lessons).map((lesson_id) => ({ lesson_id })) };
  if (sql.includes('FROM quiz_attempts')) return { rows: [] };
  if (sql.includes('FROM kana_items')) return { rows: [] };
  if (sql.includes('FROM module_vocabulary') && sql.includes('lesson_deck_items')) return { rows: vocabularyRows };
  if (sql.includes('FROM module_vocabulary')) return { rows: [] };
  if (sql.includes('FROM kanji_items')) return { rows: kanjiRows };
  if (sql.includes('FROM user_practice_state')) return { rows: stateRows };
  if (sql.includes('FROM lesson_grammar_task_items')) return { rows: [] };
  if (sql.startsWith('INSERT INTO smart_review_sessions')) return { rows: [{ id: randomUUID(), expires_at: new Date(Date.now() + 60000) }] };
  if (sql.startsWith('INSERT INTO smart_review_session_items')) { writes.push(params); return { rows: [] }; }
  throw new Error('Unexpected review test query: ' + sql);
};
mock.method(db, 'query', execute);
mock.method(db, 'connect', async () => ({ query: execute, release() {} }));
const app = express();
app.use(express.json());
app.use('/review', router);
app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const token = await signAccessToken(randomUUID(), 'student@example.invalid');
const request = async (path, body, authenticated = true) => {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(authenticated ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(5000),
  });
  return { status: response.status, body: await response.json() };
};
after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  mock.restoreAll();
  await db.end();
});

test('selected-course summary and session contain the same enrolled course; direct entry stays global', async () => {
  for (const slug of ['n4', 'n5']) {
    const summary = await request(`/review/summary?course=${slug}`);
    assert.equal(summary.status, 200, JSON.stringify(summary));
    assert.equal(summary.body.total, 2);
    const session = await request('/review/sessions', { course: slug, category: 'vocabulary' });
    assert.equal(session.status, 201, JSON.stringify(session));
    assert.equal(session.body.summary.total, summary.body.total);
    assert.equal(session.body.questions.length, 2);
    assert.ok(session.body.questions.every((row) => row.lessonId === lessons[slug]));
    const allowed = vocabulary.filter((row) => row.course_id === courseIds[slug]);
    assert.ok(session.body.questions.every((row) => allowed.some((item) => item.id === row.itemId)));
    assert.ok(session.body.questions.every((row) => row.question.options.every((option) => allowed.some((item) => item.indonesian === option))));
  }
  assert.equal((await request('/review/summary')).body.total, 4);
  const global = await request('/review/sessions', { category: 'mixed' });
  assert.equal(global.status, 201);
  assert.deepEqual(new Set(global.body.questions.map((row) => row.lessonId)), new Set(Object.values(lessons)));
});

test('invalid, expired, and unowned course filters fail before session writes', async () => {
  const before = writes.length;
  for (const [value, expected] of [['expired', 403], ['unowned', 403], ['missing', 404], ['n4/../n5', 400]]) {
    assert.equal((await request(`/review/summary?course=${encodeURIComponent(value)}`)).status, expected);
    assert.equal((await request('/review/sessions', { course: value })).status, expected);
  }
  assert.equal((await request('/review/summary?course=n4&course=n5')).status, 400);
  assert.equal((await request('/review/sessions', { course: ['n4'] })).status, 400);
  assert.equal((await request('/review/summary?course=n4', undefined, false)).status, 401);
  assert.equal(writes.length, before);
});

test('an unseen word shared by two courses remains eligible in either course while shared schedules stay effective', async () => {
  const copies = ['n5', 'n4'].map((slug) => ({ id: randomUUID(), japanese: '学生', reading: 'がくせい', indonesian: 'siswa',
    course_id: courseIds[slug], lesson_id: lessons[slug] }));
  vocabularyRows = [...vocabulary, ...copies];
  try {
    for (const slug of ['n5', 'n4']) {
      const summary = await request(`/review/summary?course=${slug}`);
      assert.equal(summary.body.total, 3);
      const session = await request('/review/sessions', { course: slug, category: 'vocabulary' });
      assert.equal(session.body.questions.length, 3);
      assert.ok(session.body.questions.some((row) => row.itemId === copies.find((item) => item.course_id === courseIds[slug]).id));
    }
    stateRows = [{ item_type: 'vocabulary', item_id: copies[0].id, skill: 'jp2id', attempts: 1, correct: 1,
      streak: 1, fsrs_state: 'review', last_seen_at: new Date(), next_review_at: new Date(Date.now() + 86400000) }];
    assert.equal((await request('/review/summary?course=n4')).body.total, 2, 'newer N5 evidence postpones the equivalent N4 word');
  } finally { vocabularyRows = vocabulary; stateRows = []; }
});

test('a shared compound gets an owner inside the selected course and honors the other owner schedule', async () => {
  const word = { japanese: '日光', reading: 'にっこう', indonesian: 'sinar matahari' };
  kanjiRows = ['n5', 'n4'].flatMap((slug, courseIndex) => ['日', '光'].map((character, index) => ({
    id: `${courseIndex ? 'eeeeeeee' : '11111111'}-0000-4000-8000-00000000000${index}`,
    character, meaning_id: character === '日' ? 'matahari' : 'cahaya', lesson_id: lessons[slug], course_id: courseIds[slug],
    course_level: slug.toUpperCase(), introduced_level: 'N5', module_id: randomUUID(), module_sort: 0,
    compounds: character === '日' ? [word] : [{ japanese: '光る', reading: 'ひかる', indonesian: 'bersinar' }],
  })));
  invalidateKanjiCatalogCache();
  try {
    const user = { id: 'fixture-user', email: 'student@example.invalid' };
    for (const slug of ['n5', 'n4']) {
      const result = await buildReviewCandidates(user, courseIds[slug]);
      const compound = result.candidates.filter((candidate) => candidate.word?.japanese === word.japanese);
      assert.equal(compound.length, 1, `${slug} must unlock one direction for its own compound`);
      assert.equal(compound[0].courseId, courseIds[slug]);
      assert.equal(compound[0].itemId, kanjiRows.find((row) => row.course_id === courseIds[slug] && row.character === '日').id);
    }
    stateRows = [{ item_type: 'kanji', item_id: kanjiRows[0].id,
      skill: `word:word2reading:${Buffer.from(`${word.japanese}::${word.reading}`).toString('base64url')}`,
      attempts: 1, correct: 1, streak: 1, fsrs_state: 'review', last_seen_at: new Date(), next_review_at: new Date(Date.now() + 86400000) }];
    const result = await buildReviewCandidates(user, courseIds.n4);
    assert.ok(!result.candidates.some((candidate) => candidate.word?.japanese === word.japanese));
  } finally { kanjiRows = []; stateRows = []; invalidateKanjiCatalogCache(); }
});
