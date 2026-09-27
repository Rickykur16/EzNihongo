import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import pg from 'pg';

test('admin listing and section mutations isolate the active bank and retain legacy quizzes', {
  skip: !process.env.TEST_DATABASE_URL && !process.env.TEST_PGLITE_URL,
}, async () => {
  const source = await readFile(new URL('./routes/admin.js', import.meta.url), 'utf8');
  const routeSql = (marker, prefix) => {
    const route = source.slice(source.indexOf(marker)).split('\n}));')[0];
    return [...route.matchAll(/`([^`]+)`/g)].map(m => m[1]).find(sql => sql.startsWith(prefix));
  };
  const list = routeSql("router.get('/lessons/:lessonId/quiz'", 'SELECT *,xmin::text AS revision FROM quiz_questions');
  const update = routeSql("router.put('/lessons/:lessonId/quiz/sections/", 'UPDATE quiz_questions q');
  const remove = routeSql("router.delete('/lessons/:lessonId/quiz/sections/", 'DELETE FROM quiz_questions q');
  assert.ok(list && update && remove);
  let db;
  if (process.env.TEST_PGLITE_URL) {
    const {PGlite} = await import(process.env.TEST_PGLITE_URL); db = new PGlite();
  } else { db = new pg.Client({connectionString: process.env.TEST_DATABASE_URL}); await db.connect(); }
  const schema = 'admin_bank_' + randomUUID().replaceAll('-', '');
  try {
    await db.query(`CREATE SCHEMA ${schema}`);
    await db.query(`SET search_path TO ${schema}`);
    await db.query('CREATE TABLE lessons(id int PRIMARY KEY, assessment_policy jsonb)');
    await db.query(`CREATE TABLE quiz_questions(id int PRIMARY KEY, lesson_id int, assessment_meta jsonb,
      question_category text DEFAULT 'grammar', section_number int DEFAULT 1, sort_order int DEFAULT 1,
      section_label text DEFAULT 'Original', section_instruction text, passage text)`);
    await db.query(`INSERT INTO lessons VALUES(1,'{"version":"n5-assessment-v2"}'),(2,NULL)`);
    await db.query(`INSERT INTO quiz_questions(id,lesson_id,assessment_meta) VALUES
      (1,1,NULL),(2,1,'{"version":"n5-assessment-v2"}'),(3,1,'{"version":"older"}'),(4,2,NULL)`);
    assert.deepEqual((await db.query(list, [1,'n5-assessment-v2'])).rows.map(q => q.id), [2]);
    assert.deepEqual((await db.query(list, [2,null])).rows.map(q => q.id), [4]);
    assert.equal((await db.query(update,[1,'grammar','Edited',null,true,false,1,false,null])).rowCount,1);
    assert.deepEqual((await db.query('SELECT section_label FROM quiz_questions ORDER BY id')).rows.map(q=>q.section_label),
      ['Original','Edited','Original','Original']);
    assert.equal((await db.query(remove,[1,'grammar',1])).rowCount,1);
    assert.deepEqual((await db.query('SELECT id FROM quiz_questions ORDER BY id')).rows.map(q=>q.id),[1,3,4]);
    assert.equal((await db.query(update,[2,'grammar','Legacy edited',null,true,false,1,false,null])).rowCount,1);
    assert.equal((await db.query(remove,[2,'grammar',1])).rowCount,1);
  } finally {
    await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await (db.end ? db.end() : db.close());
  }
});
