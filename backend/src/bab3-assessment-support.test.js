import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  bankRows, historicalBab3Bank, readBanks,
} from '../scripts/build-chapter-assessments.mjs';
import { CHAPTER_POLICY, createChapterSnapshot } from './chapter-assessment.js';

const bank = (await readBanks())[0];
const sql = await readFile(new URL('../migrations/181_bab3_assessment_support.sql', import.meta.url), 'utf8');

async function fixture(t) {
  let db;
  if (process.env.TEST_DATABASE_URL) {
    const url = new URL(process.env.TEST_DATABASE_URL);
    assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
    assert.match(decodeURIComponent(url.pathname), /test/i);
    assert.ok(!url.searchParams.has('host') && !url.searchParams.has('hostaddr'));
    const { default: pg } = await import('pg');
    const client = new pg.Client({ connectionString: url.href });
    await client.connect();
    const schema = 'bab3_support_test_' + randomUUID().replaceAll('-', '');
    await client.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
    db = { query: (text, params) => client.query(text, params), exec: text => client.query(text) };
    t.after(async () => {
      try { await client.query(`ROLLBACK; DROP SCHEMA ${schema} CASCADE`); }
      finally { await client.end(); }
    });
  } else {
    let PGlite;
    const modulePath = process.env.TEST_PGLITE_URL || process.env.PGLITE_TEST_MODULE;
    try { ({ PGlite } = await import(modulePath || '@electric-sql/pglite')); }
    catch (error) {
      if (modulePath || error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
      t.skip('Set a local TEST_DATABASE_URL or TEST_PGLITE_URL for migration execution');
      return null;
    }
    db = new PGlite();
    t.after(() => db.close());
  }
  await db.exec(`
    CREATE TABLE courses(id uuid PRIMARY KEY, slug text);
    CREATE TABLE modules(id uuid PRIMARY KEY, course_id uuid, slug text);
    CREATE TABLE lessons(id uuid PRIMARY KEY, module_id uuid, slug text, type text,
      assessment_policy jsonb, updated_at timestamptz DEFAULT now());
    CREATE TABLE quiz_questions(id uuid PRIMARY KEY, lesson_id uuid, question text,
      question_type text, question_category text, section_number int,
      section_label text, section_instruction text, passage text, audio_script text,
      correct_answer text, explanation text, sort_order int, assessment_meta jsonb);
    CREATE TABLE quiz_options(id uuid PRIMARY KEY, question_id uuid, option_text text,
      is_correct boolean, sort_order int);
    CREATE TABLE quiz_attempts(id uuid PRIMARY KEY, lesson_id uuid,
      assessment_snapshot jsonb, completed boolean, result jsonb);
  `);
  const target = randomUUID(), unrelated = randomUUID();
  for (const [slug, lesson] of [['n5', target], ['n4', unrelated]]) {
    const course = randomUUID(), module = randomUUID();
    await db.query('INSERT INTO courses VALUES($1,$2)', [course, slug]);
    await db.query("INSERT INTO modules VALUES($1,$2,'n5-b3')", [module, course]);
    const policy = { ...historicalBab3Bank(bank), ...CHAPTER_POLICY };
    delete policy.forms;
    await db.query("INSERT INTO lessons(id,module_id,slug,type,assessment_policy) VALUES($1,$2,'assignment-bab-3-perkenalan','quiz',$3)", [lesson, module, JSON.stringify(policy)]);
  }
  const rows = bankRows(historicalBab3Bank(bank));
  for (const { options, ...q } of rows) {
    const keys = Object.keys(q), params = keys.map(k => k === 'assessment_meta' ? JSON.stringify(q[k]) : q[k]);
    await db.query(`INSERT INTO quiz_questions(lesson_id,${keys.join(',')}) VALUES($1,${keys.map((_, i) => '$' + (i + 2)).join(',')})`, [target, ...params]);
    for (const o of options) await db.query('INSERT INTO quiz_options VALUES($1,$2,$3,$4,$5)', [o.id, q.id, o.option_text, o.is_correct, o.sort_order]);
  }
  const oldSnapshot = createChapterSnapshot(historicalBab3Bank(bank), rows, 'B');
  for (const complete of [false, true]) await db.query('INSERT INTO quiz_attempts VALUES($1,$2,$3,$4,$5)', [randomUUID(), target, JSON.stringify(oldSnapshot), complete, complete ? '{"score":19,"total":24}' : null]);
  return { db, target, unrelated, rows };
}

test('support migration backs up source, preserves IDs/choices/history, scopes Bab 3 and reruns safely', { timeout: 30000 }, async t => {
  const f = await fixture(t);
  if (!f) return;
  const { db, target, unrelated } = f;
  const questions = async () => (await db.query('SELECT * FROM quiz_questions ORDER BY id')).rows;
  const options = async () => (await db.query('SELECT * FROM quiz_options ORDER BY id')).rows;
  const attempts = async () => (await db.query('SELECT * FROM quiz_attempts ORDER BY id')).rows;
  const unrelatedRow = async () => (await db.query('SELECT * FROM lessons WHERE id=$1', [unrelated])).rows[0];
  const beforeQ = await questions(), beforeO = await options(), beforeA = await attempts(), beforeOther = await unrelatedRow();
  await db.exec(`BEGIN; ${sql} COMMIT;`);
  const backup = (await db.query('SELECT * FROM n5_assessment_support_backup_181')).rows;
  assert.equal(backup.length, 1);
  assert.equal(backup[0].lesson_id, target);
  assert.equal(backup[0].before_questions.length, 2);
  assert.ok(backup[0].before_questions.every(q => q.options.length === 4));
  assert.deepEqual(backup[0].before_lesson.assessment_policy.transferTask, historicalBab3Bank(bank).transferTask);
  const afterQ = await questions();
  assert.deepEqual(afterQ.map(({ question, ...q }) => q), beforeQ.map(({ question, ...q }) => q));
  assert.equal(afterQ.filter((q, i) => q.question !== beforeQ[i].question).length, 2);
  for (const q of afterQ) assert.equal(q.question, bankRows(bank).find(row => row.id === q.id).question);
  assert.deepEqual(await options(), beforeO);
  assert.deepEqual(await attempts(), beforeA);
  assert.deepEqual(await unrelatedRow(), beforeOther);
  const policy = (await db.query('SELECT assessment_policy FROM lessons WHERE id=$1', [target])).rows[0].assessment_policy;
  assert.deepEqual(policy.transferTask, bank.transferTask);
  // New attempts use the revised source; already started and completed attempts
  // keep their original questions and transfer activity inside their snapshots.
  const currentRows = afterQ.map(q => ({ ...q, options: beforeO.filter(o => o.question_id === q.id) }));
  const fresh = createChapterSnapshot(policy, currentRows, 'B');
  assert.match(fresh.questions.find(q => q.assessment_meta.key === 'b03-a-v04').question, /perawat/);
  assert.doesNotMatch(beforeA[0].assessment_snapshot.questions.find(q => q.assessment_meta.key === 'b03-a-v04').question, /perawat/);
  const editedId = backup[0].before_questions[0].id;
  await db.query("UPDATE quiz_questions SET question='Teacher edit after migration' WHERE id=$1", [editedId]);
  await db.exec(sql);
  assert.equal((await db.query('SELECT question FROM quiz_questions WHERE id=$1', [editedId])).rows[0].question, 'Teacher edit after migration');
  assert.deepEqual((await db.query('SELECT * FROM n5_assessment_support_backup_181')).rows, backup);
  assert.deepEqual(await attempts(), beforeA);
});

test('a missing targeted source question rolls the entire migration back', { timeout: 30000 }, async t => {
  const f = await fixture(t);
  if (!f) return;
  const { db, target } = f;
  const beforePolicy = (await db.query('SELECT assessment_policy FROM lessons WHERE id=$1', [target])).rows[0].assessment_policy;
  await db.query("UPDATE quiz_questions SET assessment_meta=assessment_meta || '{\"key\":\"unexpected\"}'::jsonb WHERE assessment_meta->>'key'='b03-b-v04'");
  const beforeQuestions = (await db.query('SELECT * FROM quiz_questions ORDER BY id')).rows;
  await db.exec('BEGIN;');
  await assert.rejects(db.exec(sql), /missing or changed source question/);
  await db.exec('ROLLBACK;');
  assert.deepEqual((await db.query('SELECT assessment_policy FROM lessons WHERE id=$1', [target])).rows[0].assessment_policy, beforePolicy);
  assert.deepEqual((await db.query('SELECT * FROM quiz_questions ORDER BY id')).rows, beforeQuestions);
});
