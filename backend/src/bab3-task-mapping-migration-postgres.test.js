import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

test('Bab 3 popup migration links both tasks idempotently and rejects an overwrite', {
  skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL to an isolated local test database',
  timeout: 30000,
}, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.equal(url.searchParams.has('host'), false);
  assert.equal(url.searchParams.has('hostaddr'), false);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  assert.match(url.pathname, /test/i);

  const schema = `bab3_popup_test_${randomUUID().replaceAll('-', '')}`;
  const quoted = `"${schema}"`;
  const client = new pg.Client({ connectionString: url.href, statement_timeout: 10000 });
  await client.connect();
  t.after(async () => {
    try { await client.query(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`); }
    finally { await client.end(); }
  });
  await client.query(`CREATE SCHEMA ${quoted}; SET search_path TO ${quoted};
    CREATE TABLE courses(id UUID PRIMARY KEY,slug TEXT NOT NULL);
    CREATE TABLE modules(id UUID PRIMARY KEY,course_id UUID NOT NULL,slug TEXT NOT NULL);
    CREATE TABLE course_prerequisites(course_id UUID NOT NULL,prerequisite_course_id UUID NOT NULL);
    CREATE TABLE lessons(id UUID PRIMARY KEY,module_id UUID NOT NULL,slug TEXT NOT NULL,type TEXT NOT NULL,
      popup_after_lesson_id UUID REFERENCES lessons(id),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);
  const courseId = randomUUID();
  const moduleId = randomUUID();
  const source1 = randomUUID();
  const source2 = randomUUID();
  const task1 = randomUUID();
  const task2 = randomUUID();
  await client.query("INSERT INTO courses(id,slug) VALUES ($1,'n5')", [courseId]);
  await client.query("INSERT INTO modules(id,course_id,slug) VALUES ($1,$2,'n5-b3')",
    [moduleId, courseId]);
  await client.query(`INSERT INTO lessons(id,module_id,slug,type) VALUES
      ($1,$5,'bunpou-n5-b3','video'),($2,$5,'bunpou2-n5-b3','video'),
      ($3,$5,'tesbunpou1-n5-b3','grammar_task'),($4,$5,'tesbunpou2-n5-b3','grammar_task')`,
  [source1, source2, task1, task2, moduleId]);
  const migration = await readFile(new URL('../migrations/173_link_bab3_grammar_tasks.sql',
    import.meta.url), 'utf8');

  await client.query(migration);
  await client.query(migration);
  const rows = (await client.query(`SELECT id,popup_after_lesson_id FROM lessons
    WHERE id=ANY($1::uuid[]) ORDER BY slug`, [[task1, task2]])).rows;
  assert.deepEqual(rows.map(row => row.popup_after_lesson_id), [source1, source2]);

  await client.query('UPDATE lessons SET popup_after_lesson_id=$2 WHERE id=$1', [task1, source2]);
  await assert.rejects(client.query(migration), /already linked|different popup source/u);
  assert.equal((await client.query('SELECT popup_after_lesson_id FROM lessons WHERE id=$1',
    [task1])).rows[0].popup_after_lesson_id, source2);
});
