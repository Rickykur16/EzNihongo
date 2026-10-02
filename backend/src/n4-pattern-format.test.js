import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {makePatternFormatPlan, patternFormatSql} from '../scripts/build-n4-pattern-format.mjs';
import {seedN4Support} from '../test-support/n4-support-fixture.js';
import {deriveDrills} from './grammar-drills.js';

const source = JSON.parse(fs.readFileSync(new URL('../content/n4-support/support-plan.json', import.meta.url), 'utf8'));
const plan = makePatternFormatPlan();
const sql = fs.readFileSync(new URL('../migrations/193_n4_pattern_format.sql', import.meta.url), 'utf8');
const skip = !process.env.TEST_DATABASE_URL;

test('all 125 N4 cards retain their contextual exercise answers after reformatting', () => {
  assert.equal(plan.rows.length, 125);
  assert.equal(new Set(plan.rows.map(r => r.chapter)).size, 24);
  assert.equal(sql, patternFormatSql());
  for (const row of plan.rows) {
    const original = source.grammar.find(g => g.id === row.id);
    assert.ok(row.after.pattern.length < 65, row.id);
    assert.ok(row.after.meaning.length < 115, row.id);
    assert.doesNotMatch(row.after.pattern, /→|G[12]|stem|hap(us)?|contoh|jika sesuai/, row.id);
    const item = {id: row.id, ...row.after, examples: original.examples, practiceConfig: original.drills};
    const drills = deriveDrills([item], [item]).get(row.id);
    assert.equal(drills.step1.rule, 'curated-context', row.id);
    assert.equal(drills.step2.rule, 'curated-context', row.id);
    assert.equal(drills.step1.options[drills.step1.correctIndex], original.drills.recognition.answer, row.id);
    assert.equal(drills.step2.options[drills.step2.correctIndex], original.drills.controlled.answer, row.id);
  }
});

async function connect(t) {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  assert.match(url.pathname, /test/i);
  assert.equal(url.searchParams.has('host'), false);
  assert.equal(url.searchParams.has('hostaddr'), false);
  const {default: pg} = await import('pg');
  const db = new pg.Client({connectionString: url.href});
  await db.connect();
  const schema = 'n4_format_' + randomUUID().replaceAll('-', '');
  await db.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
  t.after(async () => {
    await db.query('ROLLBACK');
    await db.query(`DROP SCHEMA ${schema} CASCADE`);
    await db.end();
  });
  await seedN4Support(db, source);
  await db.query(fs.readFileSync(new URL('../migrations/187_n4_support.sql', import.meta.url), 'utf8'));
  // An N5 card must remain outside the migration's scope.
  const courseId = randomUUID(), moduleId = randomUUID();
  await db.query('INSERT INTO courses(id,slug) VALUES($1,$2)', [courseId,'n5']);
  await db.query('INSERT INTO modules(id,course_id,slug) VALUES($1,$2,$3)', [moduleId,courseId,'n5-b3']);
  await db.query('INSERT INTO module_grammar(id,module_id,pattern,meaning,notes) VALUES($1,$2,$3,$4,$5)', [randomUUID(),moduleId,'〜は〜です','identitas','N5 teacher note']);
  return db;
}

async function protectedState(db) {
  const result = {};
  result.grammar = (await db.query(`SELECT to_jsonb(g)-'pattern'-'meaning'-'updated_at' AS row FROM module_grammar g ORDER BY id`)).rows;
  for (const table of ['courses','modules','lessons','grammar_examples','lesson_grammar_task_items','grammar_task_attempts','quiz_attempts','kanji_items']) {
    result[table] = (await db.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;
  }
  result.n5 = (await db.query(`SELECT to_jsonb(g) AS row FROM module_grammar g JOIN modules m ON m.id=g.module_id JOIN courses c ON c.id=m.course_id WHERE c.slug='n5'`)).rows;
  return result;
}

test('PostgreSQL: format all cards while preserving notes, examples, dialogue, tasks, progress and N5; replay keeps teacher edits', {skip}, async t => {
  const db = await connect(t);
  const before = await protectedState(db);
  await db.query('BEGIN'); await db.query(sql); await db.query('COMMIT');
  assert.deepEqual(await protectedState(db), before);
  for (const row of plan.rows) {
    assert.deepEqual((await db.query('SELECT pattern,meaning FROM module_grammar WHERE id=$1',[row.id])).rows[0],row.after);
  }
  assert.equal(Number((await db.query('SELECT count(*) FROM n4_pattern_format_backup_193')).rows[0].count),125);
  const backup = (await db.query('SELECT before_fields,after_fields FROM n4_pattern_format_backup_193 WHERE grammar_id=$1',[plan.rows[0].id])).rows[0];
  assert.deepEqual(backup.before_fields,plan.rows[0].before);
  assert.deepEqual(backup.after_fields,plan.rows[0].after);
  await db.query('UPDATE module_grammar SET pattern=$1,meaning=$2,notes=$3 WHERE id=$4',['Teacher pattern','Teacher meaning','Teacher note',plan.rows[0].id]);
  const edited = (await db.query('SELECT * FROM module_grammar ORDER BY id')).rows;
  await db.query(sql);
  assert.deepEqual((await db.query('SELECT * FROM module_grammar ORDER BY id')).rows,edited);
});

for (const drift of ['teacher edit','missing card','lesson moved']) {
  test(`PostgreSQL: ${drift} aborts the whole format update`, {skip}, async t => {
    const db = await connect(t);
    const row = plan.rows.at(-1);
    if (drift === 'teacher edit') await db.query('UPDATE module_grammar SET meaning=$1 WHERE id=$2',['Teacher correction',row.id]);
    // Simulate an absent identity without deleting student-linked content.
    if (drift === 'missing card') await db.query('UPDATE module_grammar SET module_id=$1 WHERE id=$2',[plan.rows[0].moduleId,row.id]);
    if (drift === 'lesson moved') await db.query('UPDATE module_grammar SET lesson_id=$1 WHERE id=$2',[plan.rows[0].lessonId,row.id]);
    const before = (await db.query('SELECT * FROM module_grammar ORDER BY id')).rows;
    await db.query('BEGIN');
    await assert.rejects(db.query(sql), /193 N4 card changed or missing/);
    await db.query('ROLLBACK');
    assert.deepEqual((await db.query('SELECT * FROM module_grammar ORDER BY id')).rows,before);
    assert.equal((await db.query("SELECT to_regclass('n4_pattern_format_backup_193') AS name")).rows[0].name,null);
  });
}

test('PostgreSQL: accepts a card already formatted in the editor without replacing its teacher note', {skip}, async t => {
  const db = await connect(t), row = plan.rows[0];
  await db.query('UPDATE module_grammar SET pattern=$1,meaning=$2,notes=$3 WHERE id=$4',[row.after.pattern,row.after.meaning,'Teacher note kept',row.id]);
  await db.query(sql);
  assert.equal((await db.query('SELECT notes FROM module_grammar WHERE id=$1',[row.id])).rows[0].notes,'Teacher note kept');
  assert.equal(Number((await db.query('SELECT count(*) FROM n4_pattern_format_backup_193')).rows[0].count),125);
});
