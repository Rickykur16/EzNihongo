import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { buildLearningScopeWarnings, grammarExampleLearningScopeWarnings } from './learning-scope-warnings.js';

const scope = { course_id: 'n5', module_sort: 4, module_title: 'Benda di Sekitar' };
const kanjiRows = [
  { character: '本', module_sort: 4, module_title: 'Benda di Sekitar' },
  { character: '駅', module_sort: 9, module_title: 'Bepergian' },
];
const vocabularyRows = [
  { japanese: 'ほん', reading: 'ほん', module_sort: 4, module_title: 'Benda di Sekitar' },
  { japanese: '電車', reading: 'でんしゃ', module_sort: 9, module_title: 'Bepergian' },
];

test('learning scope accepts material introduced in the current chapter', () => {
  assert.deepEqual(buildLearningScopeWarnings({
    scope, fields: ['これは 本です。ほんです。'], kanjiRows, vocabularyRows,
  }), []);
});

test('learning scope warns about future and unregistered kanji', () => {
  const warnings = buildLearningScopeWarnings({
    scope, fields: ['駅で新聞を読みます。'], kanjiRows, vocabularyRows,
  });
  assert.deepEqual(warnings.map((warning) => warning.code), ['future_kanji', 'unregistered_kanji']);
  assert.match(warnings[0].message, /駅.*Bab 9/);
  assert.match(warnings[1].message, /新.*聞.*読/);
});

test('learning scope checks future vocabulary in Japanese and kana readings', () => {
  const warnings = buildLearningScopeWarnings({
    scope, fields: ['でんしゃは どこですか。'], kanjiRows, vocabularyRows,
  });
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].code, 'future_vocabulary');
  assert.match(warnings[0].message, /電車.*Bab 9/);
});

test('N5 Bab 1 and 2 decoding assessments may use unfamiliar carrier words', () => {
  const warnings = buildLearningScopeWarnings({
    scope: {
      ...scope,
      course_slug: 'n5',
      lesson_slug: 'assignment-bab-1-hiragana',
      module_sort: 1,
    },
    fields: ['でんしゃを よみます。'],
    kanjiRows,
    vocabularyRows,
  });
  assert.deepEqual(warnings, []);
});

test('learning scope warns when linked grammar belongs to a later chapter', () => {
  const warnings = buildLearningScopeWarnings({
    scope, fields: ['これは ほんです。'], kanjiRows, vocabularyRows,
    linkedGrammar: { course_id: 'n5', module_sort: 8, module_title: 'Lokasi' },
  });
  assert.equal(warnings.at(-1).code, 'future_grammar');
  assert.match(warnings.at(-1).message, /Bab 8/);
});

test('post-save warning adapter uses the shared PostgreSQL boundary and preserves source rows', {
  skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL to an isolated local test database',
  timeout: 60000,
}, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  assert.match(decodeURIComponent(url.pathname), /test/i);
  assert.ok(!url.searchParams.has('host') && !url.searchParams.has('hostaddr'));
  const schemaName = 'warning_adapter_test_' + randomUUID().replaceAll('-', '');
  const schema = `"${schemaName}"`;
  const client = new pg.Client({ connectionString: url.href, statement_timeout: 30000 });
  await client.connect();
  t.after(async () => {
    assert.match(schemaName, /^warning_adapter_test_[a-f0-9]{32}$/);
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.end();
  });
  await client.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
  await client.query(await readFile(new URL('../schema.sql', import.meta.url), 'utf8'));
  await client.query('CREATE TABLE grammar_task_sessions(id UUID PRIMARY KEY)');
  await client.query(await readFile(new URL('../migrations/165_learning_flow_boundary_foundation.sql', import.meta.url), 'utf8'));
  const ids = Array.from({ length: 10 }, () => randomUUID());
  const [courseId, m1, m2, l1, l2, grammarId, exampleId, vocabId, k1, k2] = ids;
  await client.query("INSERT INTO courses(id,slug,title,level) VALUES ($1,'n5','N5','N5')", [courseId]);
  await client.query("INSERT INTO modules(id,course_id,slug,title,sort_order) VALUES ($1,$3,'bab-1','Bab 1',1),($2,$3,'bab-2','Bab 2',2)", [m1, m2, courseId]);
  await client.query("INSERT INTO lessons(id,module_id,slug,title,type,sort_order) VALUES ($1,$3,'lesson-1','Lesson 1','text',1),($2,$4,'lesson-2','Lesson 2','text',1)", [l1, l2, m1, m2]);
  await client.query("INSERT INTO module_grammar(id,module_id,lesson_id,pattern) VALUES ($1,$2,$3,'〜です')", [grammarId, m1, l1]);
  await client.query("INSERT INTO grammar_examples(id,grammar_id,japanese) VALUES ($1,$2,'学校です')", [exampleId, grammarId]);
  await client.query("INSERT INTO module_vocabulary(id,module_id,lesson_id,japanese,reading,indonesian) VALUES ($1,$2,$3,'学校','がっこう','sekolah')", [vocabId, m2, l2]);
  await client.query("INSERT INTO lesson_deck_items(lesson_id,vocabulary_id) VALUES ($1,$2)", [l2, vocabId]);
  await client.query("INSERT INTO kanji_items(id,lesson_id,character,jlpt_level,sort_order) VALUES ($1,$3,'学','N5',1),($2,$3,'校','N5',2)", [k1, k2, l2]);
  const before = (await client.query('SELECT row_to_json(e)::text AS row FROM grammar_examples e WHERE id=$1', [exampleId])).rows[0].row;
  let pending = Promise.resolve();
  const serialQuery = (sql, params) => {
    const result = pending.then(() => client.query(sql, params));
    pending = result.then(() => undefined, () => undefined);
    return result;
  };
  const warnings = await grammarExampleLearningScopeWarnings(exampleId, serialQuery);
  assert.deepEqual(warnings.map(item => item.code), ['future_kanji', 'future_vocabulary']);
  assert.equal((await client.query('SELECT row_to_json(e)::text AS row FROM grammar_examples e WHERE id=$1', [exampleId])).rows[0].row, before);
});
