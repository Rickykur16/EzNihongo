import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {banks, bankRows, supportEdits} from '../content/assessments/support/n5-04-20.mjs';
import {banks as published} from '../content/assessments/jlpt/revised.mjs';
import {buildSupportMigration} from '../scripts/build-assessment-support-04-20.mjs';
import {buildRollout as historic175} from '../scripts/build-assessment-ambiguity-revision.mjs';
import {createChapterSnapshot, publicChapterQuestions, gradeChapterAssessment} from './chapter-assessment.js';

const sql = await readFile(new URL('../migrations/185_n5_assessment_support_04_20.sql', import.meta.url), 'utf8');

test('support revision leaves the published bank and historical migration intact', async () => {
  assert.equal(sql.replaceAll('\r\n', '\n'), buildSupportMigration());
  assert.equal((await readFile(new URL('../migrations/175_assessment_ambiguity_revision.sql', import.meta.url), 'utf8')).replaceAll('\r\n', '\n'), historic175());
  assert.equal(banks.length, 17);
  let changes = 0;
  for (const bank of banks) {
    const old = published.find(b => b.chapter === bank.chapter);
    const {forms, transferTask, ...core} = bank;
    const {forms: oldForms, transferTask: oldTransfer, ...oldCore} = old;
    assert.deepEqual(core, oldCore);
    assert.equal(transferTask.roleCards.length, 1);
    assert.ok(!Object.hasOwn(transferTask, 'exampleDialogue'), 'conversation models are held for the final review phase');
    assert.doesNotMatch(transferTask.prompt + transferTask.steps.join(' '), /percakapan 6 giliran/, 'new oral tasks await user directions too');
    assert.equal(transferTask.rubric.length, 4);
    assert.ok(transferTask.exampleText.split('。').filter(Boolean).length >= 4);
    assert.ok(transferTask.exampleText.split('。').filter(Boolean).length <= 5);
    for (const [index, item] of forms.A.entries()) {
      const expected = structuredClone(oldForms.A[index]);
      for (const edit of supportEdits.filter(e => e.chapter === bank.chapter && e.number === index + 1)) {
        expected[edit.field] = edit.value;
        changes++;
      }
      assert.deepEqual(item, expected);
    }
  }
  assert.equal(changes, 4);
  assert.equal(new Set(banks.map(b => b.transferTask.title)).size, 17);
});

async function fixture(t) {
  let db;
  if (process.env.TEST_DATABASE_URL) {
    const url = new URL(process.env.TEST_DATABASE_URL);
    assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
    assert.match(decodeURIComponent(url.pathname), /test/i);
    assert.ok(!url.searchParams.has('host') && !url.searchParams.has('hostaddr'));
    const {default: pg} = await import('pg');
    const client = new pg.Client({connectionString: url.href});
    await client.connect();
    const schema = 'assessment_support_test_' + randomUUID().replaceAll('-', '');
    await client.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
    db = {query: (text, params) => client.query(text, params), exec: text => client.query(text)};
    t.after(async () => {
      try {await client.query(`ROLLBACK; DROP SCHEMA ${schema} CASCADE`);} finally {await client.end();}
    });
  } else {
    let PGlite;
    const modulePath = process.env.TEST_PGLITE_URL || process.env.PGLITE_TEST_MODULE;
    try {({PGlite} = await import(modulePath || '@electric-sql/pglite'));}
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
      assessment_policy jsonb, content text, questions_per_attempt int, updated_at timestamptz DEFAULT now());
    CREATE TABLE quiz_questions(id uuid PRIMARY KEY, lesson_id uuid, question text,
      question_type text, question_category text, section_number int,
      section_label text, section_instruction text, passage text, audio_script text,
      audio_scene jsonb, image_url text, correct_answer text, explanation text,
      sort_order int, assessment_meta jsonb, grammar_id uuid);
    CREATE TABLE quiz_options(id uuid PRIMARY KEY, question_id uuid, option_text text,
      is_correct boolean, sort_order int, image_url text);
    CREATE TABLE quiz_attempts(id uuid PRIMARY KEY, lesson_id uuid,
      assessment_snapshot jsonb, completed boolean, result jsonb);
  `);
  const course = randomUUID(), otherCourse = randomUUID();
  await db.query('INSERT INTO courses VALUES($1,\'n5\'),($2,\'n4\')', [course, otherCourse]);
  const targets = new Map(), questionRows = [], optionRows = [];
  for (const bank of published) {
    const module = randomUUID(), lesson = randomUUID();
    targets.set(bank.chapter, lesson);
    await db.query('INSERT INTO modules VALUES($1,$2,$3)', [module, course, `n5-b${bank.chapter}`]);
    const {forms, ...policy} = bank;
    if (bank.chapter === 6) policy.transferTask = {...policy.transferTask, exampleDialogue: ['Existing owner conversation stays intact.']};
    await db.query('INSERT INTO lessons(id,module_id,slug,type,assessment_policy,content,questions_per_attempt) VALUES($1,$2,$3,\'quiz\',$4,\'Owner preview\',24)', [lesson, module, `assignment-bab-${bank.chapter}-fixture`, JSON.stringify(policy)]);
    const rows = bankRows(bank);
    for (const {options, ...q} of rows) {
      questionRows.push({...q, lesson_id: lesson, audio_scene: q.audio_script ? {ownerVoice: 'preserve-me'} : null, grammar_id: randomUUID()});
      optionRows.push(...options.map(o => ({...o, question_id: q.id, image_url: '/owner-option.svg'})));
    }
    const snapshot = createChapterSnapshot(policy, rows);
    for (const completed of [false, true]) await db.query('INSERT INTO quiz_attempts VALUES($1,$2,$3,$4,$5)', [randomUUID(), lesson, JSON.stringify(snapshot), completed, completed ? '{"score":19,"total":24}' : null]);
  }
  await db.query('INSERT INTO quiz_questions SELECT * FROM jsonb_populate_recordset(null::quiz_questions,$1)', [JSON.stringify(questionRows)]);
  await db.query('INSERT INTO quiz_options SELECT * FROM jsonb_populate_recordset(null::quiz_options,$1)', [JSON.stringify(optionRows)]);
  // Old archived banks coexist with v4 and must stay byte-for-byte intact.
  const historic = {...questionRows[0], id: randomUUID(), assessment_meta: {...questionRows[0].assessment_meta, version: 'n5-assessment-v3'}};
  await db.query('INSERT INTO quiz_questions SELECT * FROM jsonb_populate_record(null::quiz_questions,$1)', [JSON.stringify(historic)]);
  // Outside the scope: Bab 3, Bab 21, and a similarly named N4 module.
  for (const [chapter, courseId] of [[3, course], [21, course], [6, otherCourse]]) {
    const module = randomUUID();
    await db.query('INSERT INTO modules VALUES($1,$2,$3)', [module, courseId, `n5-b${chapter}`]);
    await db.query('INSERT INTO lessons(id,module_id,slug,type,assessment_policy,content) VALUES($1,$2,$3,\'quiz\',$4,\'Unrelated owner preview\')', [randomUUID(), module, `assignment-bab-${chapter}-fixture`, '{"version":"unrelated","transferTask":{"prompt":"Owner task"}}']);
  }
  // An unrelated admin edit in an active bank must not be reset to authoring source.
  await db.query("UPDATE quiz_questions SET explanation='Owner explanation' WHERE id=$1", [questionRows[0].id]);
  return {db, targets};
}

const all = async (db, table) => (await db.query(`SELECT * FROM ${table} ORDER BY id`)).rows;

test('migration updates only reviewed support, preserves IDs/options/history and is safe to rerun', {timeout: 60000}, async t => {
  const f = await fixture(t);
  if (!f) return;
  const {db, targets} = f;
  const before = {};
  for (const table of ['lessons', 'quiz_questions', 'quiz_options', 'quiz_attempts']) before[table] = await all(db, table);
  await db.exec(`BEGIN; ${sql} COMMIT;`);
  assert.deepEqual(await all(db, 'quiz_options'), before.quiz_options);
  assert.deepEqual(await all(db, 'quiz_attempts'), before.quiz_attempts);
  const backups = (await db.query('SELECT * FROM n5_assessment_support_backup_185 ORDER BY lesson_id')).rows;
  assert.equal(backups.length, 17);
  assert.equal(backups.flatMap(b => b.before_questions).length, 4);
  for (const backup of backups) {
    const original = before.lessons.find(l => l.id === backup.lesson_id);
    assert.deepEqual(backup.before_lesson.assessment_policy, original.assessment_policy);
    for (const q of backup.before_questions) {
      const {options, ...source} = q;
      assert.deepEqual(source, before.quiz_questions.find(row => row.id === q.id));
      assert.deepEqual(options, before.quiz_options.filter(o => o.question_id === q.id).sort((a,b) => a.sort_order-b.sort_order));
    }
  }
  const afterQuestions = await all(db, 'quiz_questions');
  for (const beforeQ of before.quiz_questions) {
    const after = afterQuestions.find(q => q.id === beforeQ.id);
    const edit = supportEdits.find(e => bankRows(banks.find(b => b.chapter === e.chapter))[e.number-1].id === beforeQ.id);
    assert.deepEqual(after, edit ? {...beforeQ, [edit.field === 'prompt' ? 'question' : 'passage']: edit.value} : beforeQ);
  }
  for (const after of await all(db, 'lessons')) {
    const original = before.lessons.find(l => l.id === after.id);
    const chapter = [...targets].find(([,id]) => id === after.id)?.[0];
    if (!chapter) {assert.deepEqual(after, original); continue;}
    const expected = banks.find(b => b.chapter === chapter);
    const expectedTask = {...original.assessment_policy.transferTask, ...expected.transferTask};
    assert.deepEqual({...after, updated_at: original.updated_at}, {...original, assessment_policy: {...original.assessment_policy, transferTask: expectedTask}});
    const rows = afterQuestions.filter(q => q.lesson_id === after.id && q.assessment_meta.version === 'n5-assessment-v4').map(q => ({...q, options: before.quiz_options.filter(o => o.question_id === q.id).sort((a,b) => a.sort_order-b.sort_order)}));
    const snapshot = createChapterSnapshot(after.assessment_policy, rows);
    assert.deepEqual(snapshot.policy.transferTask, expectedTask);
    assert.equal(publicChapterQuestions(snapshot).length, 24);
    assert.ok(publicChapterQuestions(snapshot).every(q => !('answer' in q) && !('audio_script' in q)));
    const answers = new Map(rows.map(q => [q.id, {correct: q.options.find(o => o.is_correct).id === before.quiz_options.find(o => o.question_id === q.id && o.is_correct).id}]));
    assert.equal(gradeChapterAssessment(snapshot, answers).score, 24);
  }
  const id = bankRows(banks.find(b => b.chapter === 6))[3].id;
  await db.query("UPDATE quiz_questions SET question='Later owner question' WHERE id=$1", [id]);
  await db.query("UPDATE lessons SET assessment_policy=jsonb_set(assessment_policy,'{transferTask,prompt}','\"Later owner task\"'::jsonb) WHERE id=$1", [targets.get(6)]);
  const afterAdminQ = await all(db, 'quiz_questions'), afterAdminL = await all(db, 'lessons');
  await db.exec(sql);
  assert.deepEqual(await all(db, 'quiz_questions'), afterAdminQ);
  assert.deepEqual(await all(db, 'lessons'), afterAdminL);
  assert.deepEqual((await db.query('SELECT * FROM n5_assessment_support_backup_185 ORDER BY lesson_id')).rows, backups);
});

test('a later-chapter source edit aborts atomically instead of overwriting owner work', {timeout: 60000}, async t => {
  const f = await fixture(t);
  if (!f) return;
  const {db} = f;
  const id = bankRows(banks.find(b => b.chapter === 19))[4].id;
  await db.query("UPDATE quiz_questions SET question='Owner edit needing review' WHERE id=$1", [id]);
  const beforeL = await all(db, 'lessons'), beforeQ = await all(db, 'quiz_questions'), beforeA = await all(db, 'quiz_attempts');
  await db.exec('BEGIN;');
  await assert.rejects(db.exec(sql), /missing or changed source b19-a-jlpt-r2-5/);
  await db.exec('ROLLBACK;');
  assert.deepEqual(await all(db, 'lessons'), beforeL);
  assert.deepEqual(await all(db, 'quiz_questions'), beforeQ);
  assert.deepEqual(await all(db, 'quiz_attempts'), beforeA);
});
