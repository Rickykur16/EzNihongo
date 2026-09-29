import test, { after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';

process.env.JWT_ACCESS_SECRET = 'grounded-admin-test-secret';
process.env.JWT_REFRESH_SECRET = 'grounded-admin-test-refresh';
process.env.ADMIN_EMAILS = 'grounded-admin@example.invalid';
process.env.COMPANY_STAFF_ENABLED = 'false';
process.env.ANTHROPIC_API_KEY = 'test-not-a-real-key';
const { db } = await import('./db.js');
const { signAccessToken } = await import('./auth.js');
const { dialogueFingerprint } = await import('./dialogue-question-service.js');
const { questionsRevision } = await import('./dialogue-question-service.js');
const { default: admin } = await import('./routes/admin.js');

const id = name => `${name.padEnd(8, '0')}-1111-4111-8111-111111111111`;
const courseId = id('course'), moduleId = id('module'), futureId = id('future');
const lessonId = id('lesson'), vocabId = id('vocab'), futureVocabId = id('fvocab'), grammarId = id('grammar');
const moduleRows = [{ id: moduleId, course_id: courseId, sort_order: 1, title: 'Bab 1' },
  { id: futureId, course_id: courseId, sort_order: 2, title: 'Bab 2' }];
const lesson = { id: lessonId, module_id: moduleId, slug: 'lesson', type: 'quiz' };
const vocab = { id: vocabId, module_id: moduleId, lesson_id: lessonId,
  japanese: 'ねこ', reading: 'ねこ', indonesian: 'kucing', updated_at: '2026-09-27T00:00:00.000Z' };
const grammar = { id: grammarId, module_id: moduleId, lesson_id: lessonId,
  pattern: '〜です', meaning: 'adalah', communication_goal: 'Memperkenalkan kucing',
  example_dialog: 'N: ねこです。\nA: ねこです。', recognition_distractors: null,
  controlled_distractors: 'pilihan lama', updated_at: '2026-09-27T00:00:00.000Z' };
const deckExample = { id: id('example'), vocabulary_id: vocabId, module_id: moduleId,
  lesson_id: lessonId, japanese: 'ねこは日です。', reading: null,
  highlight: 'ねこ', indonesian: 'Kucing.', updated_at: '2026-09-27T00:00:00.000Z' };
let grammarExamples = [];
let modelOutput = '{}', modelCalls = 0, writes = 0, mutateDuringModel = null,
  mutateBeforeTransaction = null,
  providerUnavailable = false, hasNormalizedQuestion = false;
const fakeQuery = async (sql, params = []) => {
  if (/^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql)) { writes++; throw Error('draft endpoint attempted a write'); }
  if (sql.includes('boundary:courses')) return { rows: [{ id: courseId, slug: 'n5', level: 'N5', curriculum_boundary_mode: 'enforce' }] };
  if (sql.includes('SELECT g.*,m.course_id,c.curriculum_boundary_mode')) {
    return { rows: params[0] === grammarId ? [{ ...grammar, course_id: courseId,
      boundary_mode: 'enforce' }] : [] };
  }
  if (sql.includes('boundary:edges')) return { rows: [] };
  if (sql.includes('boundary:scope-lesson')) return { rows: [lesson] };
  if (sql.includes('boundary:scope-grammar')) return { rows: [{ id: grammarId, module_id: moduleId, lesson_id: lessonId }] };
  if (sql.includes('boundary:scope-module')) return { rows: [moduleRows[0]] };
  if (sql.includes('boundary:modules')) return { rows: moduleRows };
  if (sql.includes('boundary:lessons')) return { rows: [lesson] };
  if (sql.includes('boundary:vocabulary')) return { rows: [vocab,
    { id: futureVocabId, module_id: futureId, lesson_id: null,
      japanese: 'みらい', reading: 'みらい', indonesian: 'masa depan' }] };
  if (sql.includes('boundary:grammar')) return { rows: [grammar] };
  if (sql.includes('boundary:kanji')) return { rows: [{ id: id('kanji'), lesson_id: lessonId,
    character: '日', meaning_id: 'hari', on_reading: 'ニチ', kun_reading: 'ひ' }] };
  if (sql.includes('boundary:decks')) return { rows: [] };
  if (sql.includes('curriculum_boundary_auxiliary_terms')) return { rows: [] };
  if (sql.includes('FROM admin_emails')) return { rows: [] };
  if (sql.includes('JOIN modules m ON m.id = g.module_id WHERE g.id =')) {
    return { rows: [{ course_id: courseId }] };
  }
  if (sql.includes('SELECT COUNT(*)::int AS n FROM (')) return { rows: [{ n:
    grammar.recognition_distractors && grammar.controlled_distractors ? 0 : 1 }] };
  if (sql.includes('ORDER BY m.sort_order ASC, g.sort_order ASC')) {
    return { rows: !grammar.recognition_distractors || !grammar.controlled_distractors ? [{ id: grammarId, module_id: moduleId,
      pattern: grammar.pattern, meaning: grammar.meaning }] : [] };
  }
  if (sql.includes('SELECT COUNT(*)::int AS n FROM module_grammar')) return { rows: [{ n: 0 }] };
  if (sql.includes('FROM vocabulary_examples e') && sql.includes('lesson_deck_items')) {
    return { rows: [{ ...deckExample }] };
  }
  if (sql.includes('FROM app_settings')) return { rows: [] };
  // The dialogue-question editor also reads the source lesson's old companion
  // questions for "Salin dari soal lama"; this fixture has none.
  if (sql.includes('SELECT bunpou_flow_published, bunpou_flow_draft FROM lessons')) return { rows: [{}] };
  if (sql.includes('FROM grammar_examples')) return { rows: grammarExamples.map(row => ({ ...row })) };
  if (sql.includes('SELECT g.example, g.example_dialog, g.module_id')) return { rows: [] };
  if (sql.includes('FROM module_grammar') && sql.includes('pattern IS NOT NULL')) return { rows: [grammar] };
  if (sql.includes('FROM module_grammar') && sql.includes('module_id =')) return { rows: [] };
  if (sql.includes('FROM lessons l JOIN modules m ON m.id=l.module_id')) {
    return { rows: params[0] === lessonId ? [{ ...lesson, level: 'N5' }] : [] };
  }
  if (sql.includes('FROM module_vocabulary') && sql.includes('module_id =')) return { rows: [vocab] };
  if (sql.includes('FROM module_vocabulary v') && sql.includes('lesson_deck_items')) return { rows: [vocab] };
  if (sql.includes('FROM module_vocabulary WHERE id=')) return { rows: params[0] === vocabId ? [vocab] : [] };
  if (/FROM module_grammar WHERE id\s*=/.test(sql)) return { rows: params[0] === grammarId ? [grammar] : [] };
  if (sql.includes('FROM lessons WHERE id=')) return { rows: params[0] === lessonId ? [lesson] : [] };
  if (sql.includes('FROM quiz_questions WHERE id=')) return { rows: [] };
  if (sql.includes('FROM quiz_questions')) return { rows: [] };
  throw Error(`Unexpected SQL in draft generation: ${sql}`);
};
mock.method(db, 'query', fakeQuery);
mock.method(db, 'connect', async () => {
  if (mutateBeforeTransaction) { const mutate = mutateBeforeTransaction;
    mutateBeforeTransaction = null; mutate(); }
  return ({
  release() {},
  async query(sql, params = []) {
    if (/^(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)/.test(sql)) return { rows: [] };
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
    if (sql.includes('WITH RECURSIVE required')) return { rows: [{ id: courseId }] };
    if (sql.includes('FROM modules m JOIN courses c ON c.id=m.course_id')) {
      return { rows: [{ id: courseId, mode: 'enforce', module_id: moduleId }] };
    }
    if (sql.includes('SELECT m.course_id FROM module_grammar g')) {
      return { rows: [{ course_id: courseId }] };
    }
    if (sql.includes('SELECT 1 FROM grammar_dialog_questions')) {
      return { rows: hasNormalizedQuestion ? [{ one: 1 }] : [] };
    }
    if (sql.includes('FROM grammar_dialog_questions')) return { rows: [] };
    if (sql.includes('UPDATE grammar_dialog_questions SET state=')) return { rows: [] };
    if (sql.includes('INSERT INTO curriculum_boundary_reports')) return { rows: [] };
    if (sql.includes('SELECT e.*,v.module_id,v.lesson_id FROM vocabulary_examples e')) {
      return { rows: params[0] === deckExample.id ? [{ ...deckExample }] : [] };
    }
    if (sql.includes('SELECT lesson_id FROM lesson_deck_items')) {
      return { rows: [{ lesson_id: lessonId }] };
    }
    if (sql.includes('UPDATE module_grammar SET') && sql.includes('recognition_distractors=')) {
      writes++; grammar.recognition_distractors = params[1];
      grammar.controlled_distractors = params[2];
      return { rows: [{ id: grammarId }] };
    }
    if (sql.includes('UPDATE module_grammar SET')) {
      writes++; return { rows: [{ ...grammar }] };
    }
    if (sql.includes('UPDATE vocabulary_examples SET')) {
      writes++; deckExample.reading = params[1];
      return { rows: [{ id: deckExample.id }] };
    }
    return fakeQuery(sql, params);
  },
  });
});
const realFetch = globalThis.fetch;
mock.method(globalThis, 'fetch', async (url, options) => {
  if (String(url).startsWith('https://api.anthropic.com/')) {
    modelCalls++;
    if (mutateDuringModel) { const mutate = mutateDuringModel; mutateDuringModel = null; mutate(); }
    if (providerUnavailable) return new Response('unavailable', { status: 503 });
    return new Response(JSON.stringify({ content: [{ type: 'text', text: modelOutput }] }),
      { headers: { 'Content-Type': 'application/json' } });
  }
  return realFetch(url, options);
});
const token = await signAccessToken(id('admin'), 'grounded-admin@example.invalid');
const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use('/api/admin', admin);
app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
let requestCount = 1;
async function post(route, body) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/${route}`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
      'X-Forwarded-For': `192.0.2.${requestCount++}` }, body: JSON.stringify(body) });
  return { status: response.status, cacheControl: response.headers.get('cache-control'),
    body: await response.json() };
}
async function dialogueRequest(route, method, body = null) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/${route}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
      'X-Forwarded-For': `192.0.2.${requestCount++}` },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, cacheControl: response.headers.get('cache-control'),
    body: await response.json() };
}
after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  mock.restoreAll(); await db.end(); });

test('all grounded draft routes reject unscoped calls before provider and never write', async () => {
  modelCalls = 0; writes = 0;
  for (const [route, body] of [
    ['generate-vocab-examples', {}], ['generate-grammar-examples', { pattern: '〜です' }],
    ['generate-grammar-dialog', { pattern: '〜です' }],
    ['generate-dialog-translation', { dialog: 'A: ねこです。' }],
    ['generate-question-options', { question: 'これは何ですか。' }],
  ]) assert.equal((await post(route, body)).status, 400, route);
  assert.equal((await post('generate-grammar-example', { pattern: '〜です' })).status, 410);
  assert.equal((await post(`lessons/${lessonId}/generate-quiz`, {})).status, 410);
  assert.equal(modelCalls, 0); assert.equal(writes, 0);
});

test('dialogue question generator requires verified source and returns review-only evidence', async () => {
  modelCalls = 0; writes = 0;
  let response = await post(`grammar/${grammarId}/generate-dialog-questions`,
    { kind: 'comprehension', count: 1 });
  assert.equal(response.status, 400);
  assert.equal(response.cacheControl, 'private, no-store');
  response = await post(`grammar/${grammarId}/generate-dialog-questions`,
    { sourceLessonId: id('other'), kind: 'comprehension', count: 1,
      expectedDialogueFingerprint: dialogueFingerprint(grammar) });
  assert.equal(response.status, 409);
  assert.equal(response.cacheControl, 'private, no-store');
  assert.equal(modelCalls, 0);
  modelOutput = JSON.stringify({ questions: [{ prompt: 'Apa yang disebutkan?',
    options: ['Kucing', 'Anjing', 'Burung'], correctIndex: 0,
    explanation: 'Pembicara menyebut kucing.', evidence: [{ turnIndex: 0, quote: 'ねこです' }] }] });
  response = await post(`grammar/${grammarId}/generate-dialog-questions`,
    { sourceLessonId: lessonId, kind: 'comprehension', count: 1,
      expectedDialogueFingerprint: dialogueFingerprint(grammar) });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.status, 'ready', JSON.stringify(response.body.report));
  assert.equal(response.body.questions[0].evidence[0].quote, 'ねこです');
  assert.equal(response.body.dialogueFingerprint, dialogueFingerprint(grammar));
  assert.equal(response.cacheControl, 'private, no-store');
  assert.equal(modelCalls, 1); assert.equal(writes, 0);
});

test('actual admin generation boundary logs one private-safe terminal event and tolerates logger failure', async t => {
  modelOutput = JSON.stringify({ questions: [{ prompt: 'Apa yang disebutkan?',
    options: ['Kucing', 'Anjing', 'Burung'], correctIndex: 0,
    explanation: 'Pembicara menyebut kucing.', evidence: [{ turnIndex: 0, quote: 'ねこです' }] }] });
  const lines = [];
  const logger = t.mock.method(console, 'info', line => lines.push(line));
  const route = `grammar/${grammarId}/generate-dialog-questions`;
  const body = { sourceLessonId: lessonId, kind: 'comprehension', count: 1,
    expectedDialogueFingerprint: dialogueFingerprint(grammar) };
  const first = await post(route, body);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(lines.length, 1);
  const event = JSON.parse(lines[0]);
  assert.equal(event.event, 'grounded_generation');
  assert.equal(event.contentType, 'dialogue_comprehension');
  assert.equal(event.mode, 'enforce');
  assert.equal(event.outcome, 'ready');
  assert.equal(event.providerCallCount, 1);
  assert.doesNotMatch(lines[0], /Kucing|ねこ|grammarId|lessonId|fingerprint|correctIndex|prompt/i);
  logger.mock.mockImplementation(() => { throw new Error('logger failed'); });
  const second = await post(route, body);
  assert.equal(second.status, 200);
  assert.deepEqual(second.body, first.body);
});

test('dialogue question admin GET/PUT expose revision and reject stale set atomically', async () => {
  writes = 0;
  const route = `grammar/${grammarId}/dialogue-questions`;
  const listed = await dialogueRequest(route, 'GET');
  assert.equal(listed.status, 200, JSON.stringify(listed.body));
  assert.equal(listed.cacheControl, 'private, no-store');
  assert.deepEqual(listed.body.questions, []);
  assert.equal(listed.body.dialogueFingerprint, dialogueFingerprint(grammar));
  assert.equal(listed.body.questionsRevision, questionsRevision([]));
  assert.equal(listed.body.legacyCheck, null);
  let response = await dialogueRequest(route, 'PUT', { sourceLessonId: lessonId,
    expectedDialogueFingerprint: listed.body.dialogueFingerprint,
    expectedQuestionsRevision: 'sha256:stale', questions: [] });
  assert.equal(response.status, 409);
  assert.equal(response.cacheControl, 'private, no-store');
  assert.equal(writes, 0);
  response = await dialogueRequest(route, 'PUT', { sourceLessonId: lessonId,
    expectedDialogueFingerprint: listed.body.dialogueFingerprint,
    expectedQuestionsRevision: listed.body.questionsRevision, questions: [] });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.cacheControl, 'private, no-store');
  assert.equal(response.body.questionsRevision, listed.body.questionsRevision);
});

test('grammar lesson reassignment is blocked by archived normalized questions', async () => {
  hasNormalizedQuestion = true; writes = 0;
  const route = `module-grammar/${grammarId}`;
  let response = await dialogueRequest(route, 'PUT', { lessonId: id('other') });
  assert.equal(response.status, 409, JSON.stringify(response.body));
  assert.equal(response.body.error, 'grammar_dialog_questions_restrict_move');
  assert.equal(writes, 0);
  response = await dialogueRequest(route, 'PUT', { lessonId: null });
  assert.equal(response.status, 409);
  assert.equal(writes, 0);
  response = await dialogueRequest(route, 'PUT', { lessonId });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  hasNormalizedQuestion = false;
});

test('empty transfer generation has the same review envelope and never calls provider', async () => {
  modelCalls = 0; writes = 0;
  const response = await post(`grammar/${grammarId}/generate-dialog-questions`,
    { sourceLessonId: lessonId, kind: 'transfer', count: 0,
      expectedDialogueFingerprint: dialogueFingerprint(grammar) });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.cacheControl, 'private, no-store');
  assert.equal(response.body.status, 'ready');
  assert.deepEqual(response.body.candidate, { questions: [] });
  assert.deepEqual(response.body.questions, []);
  assert.equal(response.body.report.status, 'not_run');
  assert.equal(response.body.generation.sourceFingerprint, response.body.sourceFingerprint);
  assert.match(response.body.sourceFingerprint, /^sha256:/u);
  assert.equal(modelCalls, 0); assert.equal(writes, 0);
});

test('dialogue question generation repairs fabricated evidence and nested future text without save', async () => {
  modelCalls = 0; writes = 0;
  modelOutput = JSON.stringify({ questions: [{ prompt: 'Apa yang disebutkan?',
    options: ['Kucing', 'Anjing', 'Burung'], correctIndex: 0,
    explanation: 'Pembicara menyebut kucing.', evidence: [{ turnIndex: 0, quote: 'みらい' }] }] });
  const body = { sourceLessonId: lessonId, kind: 'comprehension', count: 1,
    expectedDialogueFingerprint: dialogueFingerprint(grammar) };
  let response = await post(`grammar/${grammarId}/generate-dialog-questions`, body);
  assert.equal(response.body.status, 'rejected');
  assert.equal(response.body.attempts.length, 3);
  assert.equal(writes, 0);
  modelCalls = 0;
  modelOutput = JSON.stringify({ questions: [{ prompt: 'みらい は です。',
    options: ['Kucing', 'Anjing', 'Burung'], correctIndex: 0,
    explanation: 'Pembicara menyebut kucing.', evidence: [{ turnIndex: 0, quote: 'ねこです' }] }] });
  response = await post(`grammar/${grammarId}/generate-dialog-questions`, body);
  assert.equal(response.body.status, 'rejected');
  assert.ok(response.body.report.violations.some(item => item.code === 'future_vocabulary'));
  assert.equal(modelCalls, 3); assert.equal(writes, 0);
});

test('dialogue question generation detects source edits during the model call', async () => {
  modelCalls = 0; writes = 0;
  modelOutput = JSON.stringify({ questions: [{ prompt: 'Apa yang disebutkan?',
    options: ['Kucing', 'Anjing', 'Burung'], correctIndex: 0,
    explanation: 'Pembicara menyebut kucing.', evidence: [{ turnIndex: 0, quote: 'ねこです' }] }] });
  const expectedDialogueFingerprint = dialogueFingerprint(grammar);
  mutateDuringModel = () => { grammar.example_dialog_id = 'Terjemahan berubah'; };
  const response = await post(`grammar/${grammarId}/generate-dialog-questions`,
    { sourceLessonId: lessonId, kind: 'comprehension', count: 1,
      expectedDialogueFingerprint });
  delete grammar.example_dialog_id;
  assert.equal(response.status, 409);
  assert.equal(response.body.status, 'stale');
  assert.equal(modelCalls, 1); assert.equal(writes, 0);
});

test('bulk distractor rejects malformed output per item without any write', async () => {
  modelCalls = 0; writes = 0; modelOutput = JSON.stringify({ irrelevant: 'hello' });
  const response = await post('module-grammar/generate-distractors-bulk', { fromGrammarId: grammarId, limit: 1 });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.processed, 1);
  assert.equal(response.body.saved, 0);
  assert.equal(response.body.failedItems[0].status, 422);
  assert.equal(response.body.failedItems[0].generation.attempts.length, 3);
  assert.equal(modelCalls, 3); assert.equal(writes, 0);
});

test('deck readings reject malformed batch output without any item write', async () => {
  modelCalls = 0; writes = 0; modelOutput = JSON.stringify({ examples: [null] });
  const response = await post(`lessons/${lessonId}/generate-deck-readings`, {});
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.updated, 0);
  assert.equal(response.body.failed, 1);
  assert.equal(response.body.failedItems[0].status, 422);
  assert.equal(response.body.failedItems[0].generation.attempts.length, 3);
  assert.equal(modelCalls, 3); assert.equal(writes, 0);
});

test('bulk distractor writes a grounded item once and reports its validation', async () => {
  modelCalls = 0; writes = 0;
  grammar.recognition_distractors = null;
  modelOutput = JSON.stringify({ recognitionDistractors: [
    'Menunjukkan waktu lampau.', 'Menunjukkan tempat tujuan.', 'Menunjukkan larangan.' ] });
  const response = await post('module-grammar/generate-distractors-bulk', { fromGrammarId: grammarId, limit: 1 });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.saved, 1, JSON.stringify(response.body));
  assert.equal(response.body.savedItems[0].generation.status, 'ready');
  assert.equal(writes, 1); assert.equal(modelCalls, 1);
});

test('bulk distractor generates only the missing controlled field', async () => {
  grammar.recognition_distractors = 'Pilihan kurasi lama.';
  grammar.controlled_distractors = null;
  grammarExamples = [{ japanese: 'ねこです。', highlight: 'です', indonesian: 'Ini kucing.' }];
  writes = 0; modelCalls = 0;
  modelOutput = JSON.stringify({ controlledDistractors: ['ます', 'でした', 'では'] });
  const response = await post('module-grammar/generate-distractors-bulk', { fromGrammarId: grammarId, limit: 1 });
  assert.equal(response.body.saved, 1, JSON.stringify(response.body));
  assert.equal(grammar.recognition_distractors, 'Pilihan kurasi lama.');
  assert.equal(grammar.controlled_distractors, 'ます\nでした\nでは');
  assert.equal(modelCalls, 1); assert.equal(writes, 1);
  grammar.recognition_distractors = null;
  grammar.controlled_distractors = 'pilihan lama';
  grammarExamples = [];
});

test('bulk distractor stale and unavailable outcomes cannot write an item', async () => {
  grammar.recognition_distractors = null; writes = 0; modelCalls = 0;
  modelOutput = JSON.stringify({ recognitionDistractors: [
    'Menunjukkan waktu lampau.', 'Menunjukkan tempat tujuan.', 'Menunjukkan larangan.' ] });
  mutateDuringModel = () => { grammar.meaning = 'berubah'; };
  let response = await post('module-grammar/generate-distractors-bulk', { fromGrammarId: grammarId, limit: 1 });
  assert.equal(response.body.saved, 0);
  assert.equal(response.body.failedItems[0].generation.status, 'stale');
  assert.equal(writes, 0);
  grammar.meaning = 'adalah';
  providerUnavailable = true; modelCalls = 0;
  response = await post('module-grammar/generate-distractors-bulk', { fromGrammarId: grammarId, limit: 1 });
  providerUnavailable = false;
  assert.equal(response.body.saved, 0);
  assert.equal(response.body.failedItems[0].generation.status, 'unavailable');
  assert.equal(response.body.failedItems[0].generation.attempts.length, 3);
  assert.equal(writes, 0);
});

test('deck reading success and stale source are isolated per item', async () => {
  deckExample.reading = null; writes = 0; modelCalls = 0;
  modelOutput = JSON.stringify({ examples: [{ japanese: deckExample.japanese,
    reading: 'ねこはひです。' }] });
  let response = await post(`lessons/${lessonId}/generate-deck-readings`, {});
  assert.equal(response.body.updated, 1, JSON.stringify(response.body));
  assert.equal(response.body.updatedItems[0].generation.status, 'ready');
  assert.equal(deckExample.reading, 'ねこはひです。');
  assert.equal(writes, 1);
  deckExample.reading = null; writes = 0;
  mutateDuringModel = () => { deckExample.japanese = 'ねこは月です。'; };
  response = await post(`lessons/${lessonId}/generate-deck-readings`, {});
  assert.equal(response.body.updated, 0, JSON.stringify(response.body));
  assert.equal(response.body.failedItems[0].generation.status, 'stale');
  assert.equal(writes, 0);
  deckExample.japanese = 'ねこは日です。';
});

test('locked source recheck rejects results changed after grounded generation', async () => {
  grammar.recognition_distractors = null; writes = 0;
  modelOutput = JSON.stringify({ recognitionDistractors: [
    'Menunjukkan waktu lampau.', 'Menunjukkan tempat tujuan.', 'Menunjukkan larangan.' ] });
  mutateBeforeTransaction = () => { grammar.meaning = 'berubah sesudah AI'; };
  let response = await post('module-grammar/generate-distractors-bulk', { fromGrammarId: grammarId, limit: 1 });
  assert.equal(response.body.saved, 0);
  assert.equal(response.body.failedItems[0].status, 409);
  assert.equal(writes, 0);
  grammar.meaning = 'adalah';

  deckExample.reading = null; writes = 0;
  modelOutput = JSON.stringify({ examples: [{ japanese: deckExample.japanese,
    reading: 'ねこはひです。' }] });
  mutateBeforeTransaction = () => { deckExample.japanese = 'ねこは月です。'; };
  response = await post(`lessons/${lessonId}/generate-deck-readings`, {});
  assert.equal(response.body.updated, 0);
  assert.equal(response.body.failedItems[0].status, 409);
  assert.equal(writes, 0);
  deckExample.japanese = 'ねこは日です。';
  mutateBeforeTransaction = () => { deckExample.indonesian = 'Arti baru.'; };
  response = await post(`lessons/${lessonId}/generate-deck-readings`, {});
  assert.equal(response.body.updated, 0);
  assert.equal(response.body.failedItems[0].status, 409);
  assert.equal(writes, 0);
  deckExample.indonesian = 'Kucing.';
});

test('deck reading future text and provider outage reject without writes', async () => {
  deckExample.reading = null; writes = 0; modelCalls = 0;
  modelOutput = JSON.stringify({ examples: [{ japanese: deckExample.japanese,
    reading: 'みらいです。' }] });
  let response = await post(`lessons/${lessonId}/generate-deck-readings`, {});
  assert.equal(response.body.updated, 0);
  assert.equal(response.body.failedItems[0].generation.status, 'rejected');
  assert.equal(writes, 0);
  providerUnavailable = true; modelCalls = 0;
  response = await post(`lessons/${lessonId}/generate-deck-readings`, {});
  providerUnavailable = false;
  assert.equal(response.body.updated, 0);
  assert.equal(response.body.failedItems[0].generation.status, 'unavailable');
  assert.equal(modelCalls, 3); assert.equal(writes, 0);
});

test('vocabulary batch returns compatible examples and generation report without save', async () => {
  modelCalls = 0; writes = 0;
  modelOutput = JSON.stringify({ examples: [
    { japanese: 'ねこです。', highlight: 'ねこ', reading: 'ねこです。', indonesian: 'Ini kucing.' },
    { japanese: 'ねこがいます。', highlight: 'ねこ', reading: 'ねこがいます。', indonesian: 'Ada kucing.' },
  ] });
  const response = await post('generate-vocab-examples', { vocabularyId: vocabId, count: 2 });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.status, 'ready', JSON.stringify(response.body.report));
  assert.equal(response.body.examples.length, 2);
  assert.equal(response.body.generation.report.status, 'evaluated');
  assert.ok(response.body.boundaryFingerprint?.startsWith('sha256:'));
  assert.ok(response.body.sourceFingerprint?.startsWith('sha256:'));
  assert.equal(modelCalls, 1); assert.equal(writes, 0);
});

test('future and malformed grammar drafts stop after three model calls with report', async () => {
  modelCalls = 0; writes = 0;
  modelOutput = JSON.stringify({ examples: [{ japanese: 'みらい は です。', highlight: 'です', indonesian: 'Masa depan.' }] });
  let response = await post('generate-grammar-examples', { grammarId, count: 1 });
  assert.equal(response.body.status, 'rejected');
  assert.equal(response.body.examples.length, 0);
  assert.ok(response.body.report.violations.some(item => item.code === 'future_vocabulary'));
  assert.equal(response.body.attempts.length, 3);
  assert.equal(modelCalls, 3);
  modelCalls = 0; modelOutput = JSON.stringify({ examples: [null] });
  response = await post('generate-grammar-examples', { grammarId, count: 1 });
  assert.equal(response.body.status, 'rejected');
  assert.equal(response.body.report.status, 'schema_invalid');
  assert.equal(modelCalls, 3); assert.equal(writes, 0);
});

test('question options use lesson scope and return normalized options with report', async () => {
  modelCalls = 0; writes = 0;
  modelOutput = JSON.stringify({ options: [
    { text: 'ねこ', isCorrect: true }, { text: 'いぬ', isCorrect: false },
    { text: 'とり', isCorrect: false }, { text: 'さかな', isCorrect: false }], explanation: 'Kucing.' });
  const response = await post('generate-question-options', { lessonId,
    question: 'これは何ですか。', questionCategory: 'vocabulary' });
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ready');
  assert.equal(response.body.options.length, 4);
  assert.equal(response.body.options.filter(item => item.isCorrect).length, 1);
  assert.equal(modelCalls, 1); assert.equal(writes, 0);
});

test('grammar dialog and unsaved scoped translation return reviewed drafts without writes', async () => {
  modelCalls = 0; writes = 0;
  modelOutput = JSON.stringify({ dialogue: 'N: ねこです。\nA: ねこです。' });
  let response = await post('generate-grammar-dialog', { grammarId });
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ready');
  assert.equal(response.body.dialog, 'N: ねこです。\nA: ねこです。');
  assert.equal(response.body.generation.attempts.length, 1);
  modelOutput = JSON.stringify({ dialog_id: 'N: Ini kucing.\nA: Ini kucing.' });
  response = await post('generate-dialog-translation', { grammarId,
    dialog: 'N: ねこです。\nA: ねこです。' });
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ready');
  assert.equal(response.body.dialog_id, 'N: Ini kucing.\nA: Ini kucing.');
  assert.ok(response.body.sourceFingerprint?.startsWith('sha256:'));
  assert.equal(modelCalls, 2); assert.equal(writes, 0);
});

test('source mismatches are rejected before model invocation', async () => {
  modelCalls = 0; writes = 0;
  assert.equal((await post('generate-grammar-examples', { grammarId,
    pattern: '〜ます' })).status, 409);
  assert.equal((await post('generate-grammar-dialog', { grammarId,
    lessonId: id('other') })).status, 409);
  assert.equal((await post('generate-question-options', { lessonId, questionId: id('missing'),
    question: 'これは何ですか。' })).status, 404);
  assert.equal(modelCalls, 0); assert.equal(writes, 0);
});

test('batch count mismatch repairs at most twice and returns no accepted examples', async () => {
  modelCalls = 0; writes = 0;
  modelOutput = JSON.stringify({ examples: [{ japanese: 'ねこです。', highlight: 'ねこ' }] });
  const response = await post('generate-vocab-examples', { vocabularyId: vocabId, count: 2 });
  assert.equal(response.body.status, 'rejected');
  assert.equal(response.body.report.status, 'schema_invalid');
  assert.ok(response.body.report.violations.some(item => item.code === 'example_count_mismatch'));
  assert.deepEqual(response.body.examples, []);
  assert.equal(modelCalls, 3); assert.equal(writes, 0);
});

test('future draft dialogue cannot be laundered through translation', async () => {
  modelCalls = 0; writes = 0;
  const response = await post('generate-dialog-translation', { grammarId,
    dialog: 'N: みらい は です。' });
  assert.equal(response.status, 422);
  assert.equal(response.body.status, 'rejected');
  assert.ok(response.body.report.violations.some(item => item.code === 'future_vocabulary'));
  assert.equal(modelCalls, 0); assert.equal(writes, 0);
});

test('stale boundary fingerprint prevents generation before provider call', async () => {
  modelCalls = 0; writes = 0;
  const response = await post('generate-vocab-examples', { vocabularyId: vocabId,
    boundaryFingerprint: 'sha256:stale' });
  assert.equal(response.status, 409);
  assert.equal(response.body.status, 'stale');
  assert.equal(response.body.report.status, 'version_conflict');
  assert.equal(modelCalls, 0); assert.equal(writes, 0);
});

test('grammar distractor draft uses one scoped candidate and does not write', async () => {
  modelCalls = 0; writes = 0;
  modelOutput = JSON.stringify({ recognitionDistractors: [
    'Menunjukkan waktu lampau.', 'Menunjukkan tempat tujuan.', 'Menunjukkan larangan.' ] });
  let response = await post(`module-grammar/${grammarId}/generate-distractors`, {});
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.status, 'ready');
  assert.equal(response.body.distractors.length, 3);
  assert.deepEqual(response.body.controlled, []);
  assert.equal(response.body.slot, null);
  assert.ok(response.body.report);
  assert.equal(modelCalls, 1); assert.equal(writes, 0);
  modelCalls = 0;
  response = await post(`module-grammar/${grammarId}/generate-distractors`, { lessonId: id('other') });
  assert.equal(response.status, 409);
  assert.equal(modelCalls, 0);
});

test('listening batch checks nested audio and caps repairs without saves', async () => {
  modelCalls = 0; writes = 0;
  const options = [
    { text: 'ねこ', isCorrect: true }, { text: 'いぬ', isCorrect: false },
    { text: 'とり', isCorrect: false }];
  modelOutput = JSON.stringify({ questions: [{ question: '何といいますか。',
    audioScript: 'A: みらい は です。', options, explanation: 'Kucing.' }] });
  let response = await post(`lessons/${lessonId}/generate-listening`, { taskType: 'sokuji', count: 1, level: 'N5' });
  assert.equal(response.body.status, 'rejected');
  assert.ok(response.body.report.violations.some(item => item.code === 'future_vocabulary' &&
    item.field === 'questions[0].audioScript'));
  assert.equal(response.body.attempts.length, 3);
  assert.equal(modelCalls, 3); assert.equal(writes, 0);
  modelCalls = 0;
  modelOutput = JSON.stringify({ questions: [{ question: '何といいますか。',
    audioScript: 'A: ねこです。', options, explanation: 'Kucing.' }] });
  response = await post(`lessons/${lessonId}/generate-listening`, { taskType: 'sokuji', count: 1 });
  assert.equal(response.body.status, 'ready', JSON.stringify(response.body.report));
  assert.equal(response.body.questions[0].audioScript, 'A: ねこです。');
  assert.equal(response.body.questions[0].options.length, 3);
  assert.equal(modelCalls, 1); assert.equal(writes, 0);
});

test('JLPT batch checks options, malformed shape, and stale fingerprint', async () => {
  modelCalls = 0; writes = 0;
  const question = 'ねこは（　）です。';
  const options = [
    { text: 'すき', isCorrect: true }, { text: 'きらい', isCorrect: false },
    { text: 'ふつう', isCorrect: false }, { text: 'みらい は', isCorrect: false }];
  modelOutput = JSON.stringify({ questions: [{ question, options, explanation: 'Pilihan pertama.' }] });
  let response = await post(`lessons/${lessonId}/generate-jlpt`, { taskType: 'goi_bunmyaku', count: 1 });
  assert.equal(response.body.status, 'rejected');
  assert.ok(response.body.report.violations.some(item => item.code === 'future_vocabulary' &&
    item.field === 'questions[0].options[3]'));
  assert.equal(modelCalls, 3);
  modelCalls = 0; modelOutput = JSON.stringify({ questions: [null] });
  response = await post(`lessons/${lessonId}/generate-jlpt`, { taskType: 'goi_bunmyaku', count: 1 });
  assert.equal(response.body.report.status, 'schema_invalid');
  assert.equal(modelCalls, 3);
  modelCalls = 0;
  response = await post(`lessons/${lessonId}/generate-jlpt`, { taskType: 'goi_bunmyaku',
    boundaryFingerprint: 'sha256:stale', count: 1 });
  assert.equal(response.status, 409);
  assert.equal(response.body.status, 'stale');
  assert.equal(modelCalls, 0); assert.equal(writes, 0);
});

test('batch generators reject unknown lesson or mismatched course level before provider', async () => {
  modelCalls = 0; writes = 0;
  assert.equal((await post(`lessons/${id('other')}/generate-listening`,
    { taskType: 'sokuji' })).status, 404);
  assert.equal((await post(`lessons/${lessonId}/generate-jlpt`,
    { taskType: 'goi_bunmyaku', level: 'N4' })).status, 409);
  assert.equal(modelCalls, 0); assert.equal(writes, 0);
});

test('passage and recognition distractor text are included in boundary checks', async () => {
  modelCalls = 0; writes = 0;
  modelOutput = JSON.stringify({ passages: [{ passage: 'みらい は です。', questions: [{
    question: 'ねこは何ですか。', options: [
      { text: 'ねこ', isCorrect: true }, { text: 'いぬ', isCorrect: false },
      { text: 'とり', isCorrect: false }, { text: 'さかな', isCorrect: false }],
    explanation: 'Kucing.' }] }] });
  let response = await post(`lessons/${lessonId}/generate-jlpt`, { taskType: 'dokkai_tanbun', count: 1 });
  assert.equal(response.body.status, 'rejected');
  assert.ok(response.body.report.violations.some(item => item.code === 'future_vocabulary' &&
    item.field === 'questions[0].passage'));
  assert.equal(modelCalls, 3);
  modelCalls = 0;
  modelOutput = JSON.stringify({ recognitionDistractors: [
    'みらい は です。', 'Menunjukkan tempat tujuan.', 'Menunjukkan larangan.' ] });
  response = await post(`module-grammar/${grammarId}/generate-distractors`, {});
  assert.equal(response.body.status, 'rejected');
  assert.ok(response.body.report.violations.some(item => item.code === 'future_vocabulary' &&
    item.field === 'recognitionDistractors[0]'));
  assert.equal(modelCalls, 3); assert.equal(writes, 0);
});

test('valid JLPT passage keeps legacy question aliases and generation report', async () => {
  modelCalls = 0; writes = 0;
  modelOutput = JSON.stringify({ passages: [{ passage: 'ねこです。', questions: [{
    question: 'ねこは何ですか。', options: [
      { text: 'ねこ', isCorrect: true }, { text: 'いぬ', isCorrect: false },
      { text: 'とり', isCorrect: false }, { text: 'さかな', isCorrect: false }],
    explanation: 'Kucing.' }] }] });
  const response = await post(`lessons/${lessonId}/generate-jlpt`, { taskType: 'dokkai_tanbun', count: 1 });
  assert.equal(response.status, 200, JSON.stringify(response.body.report));
  assert.equal(response.body.status, 'ready');
  assert.equal(response.body.questions.length, 1);
  assert.equal(response.body.questions[0].passage, 'ねこです。');
  assert.equal(response.body.questions[0].options.filter(option => option.isCorrect).length, 1);
  assert.equal(response.body.category, 'reading');
  assert.equal(response.body.generation.report.status, 'evaluated');
  assert.equal(modelCalls, 1); assert.equal(writes, 0);
});

test('dialog turn audio never touches a turn the editor did not point at', async () => {
  modelCalls = 0; writes = 0;
  const dialog = 'A: はじめまして。\nB: ハディです。';
  for (const [body, status] of [
    [{ text: '' }, 400],
    [{ text: 'ただのぶんです。', turnIndex: 0 }, 400],
    [{ text: dialog, turnIndex: 5, expect: { speaker: 'A', text: 'はじめまして。' } }, 400],
    [{ text: dialog, turnIndex: 1, expect: { speaker: 'A', text: 'はじめまして。' } }, 409],
    [{ text: dialog, turnIndex: 0, expect: { speaker: 'A', text: 'ちがいます。' }, regenerate: true }, 409],
  ]) assert.equal((await post('tts/dialog-turn', body)).status, status, JSON.stringify(body));
  assert.equal(modelCalls, 0); assert.equal(writes, 0);
});
