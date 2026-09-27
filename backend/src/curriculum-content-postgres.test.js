import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import pg from 'pg';
import { validateAndWriteContent, BoundaryWriteError, lockCurriculumCourse,
  lockCurriculumCourses, lockCurriculumGraph } from './curriculum-content-service.js';
import { BoundaryUnavailableError } from './curriculum-boundary.js';

test('PostgreSQL manual example: enforce rolls back, warn stores exact text and report', {
  skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL to an isolated local test database',
  timeout: 60000,
}, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  assert.match(decodeURIComponent(url.pathname), /test/i);
  assert.ok(!url.searchParams.has('host') && !url.searchParams.has('hostaddr'));
  const schemaName = 'boundary_write_test_' + randomUUID().replaceAll('-', '');
  const schema = `"${schemaName}"`;
  const client = new pg.Client({ connectionString: url.href, statement_timeout: 30000 });
  await client.connect();
  t.after(async () => {
    assert.match(schemaName, /^boundary_write_test_[a-f0-9]{32}$/);
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.end();
  });
  await client.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
  await client.query(await readFile(new URL('../schema.sql', import.meta.url), 'utf8'));
  await client.query('ALTER TABLE lessons ADD COLUMN bunpou_flow_published JSONB');
  await client.query('CREATE TABLE grammar_task_sessions(id UUID PRIMARY KEY)');
  await client.query(await readFile(new URL('../migrations/165_learning_flow_boundary_foundation.sql', import.meta.url), 'utf8'));
  const [courseId, module1, module2, lesson1, lesson2, vocabularyId, futureKanji] =
    Array.from({ length: 7 }, () => randomUUID());
  await client.query("INSERT INTO courses(id,slug,title,level,curriculum_boundary_mode) VALUES ($1,'n5','N5','N5','enforce')", [courseId]);
  await client.query(`INSERT INTO modules(id,course_id,slug,title,sort_order) VALUES
    ($1,$3,'bab-1','Bab 1',1),($2,$3,'bab-2','Bab 2',2)`, [module1, module2, courseId]);
  await client.query(`INSERT INTO lessons(id,module_id,slug,title,type) VALUES
    ($1,$3,'lesson-1','Lesson 1','text'),($2,$4,'lesson-2','Lesson 2','kanji')`,
  [lesson1, lesson2, module1, module2]);
  await client.query("INSERT INTO module_vocabulary(id,module_id,lesson_id,japanese,indonesian) VALUES ($1,$2,$3,'あいさつ','salam')",
    [vocabularyId, module1, lesson1]);
  await client.query("INSERT INTO kanji_items(id,lesson_id,character,jlpt_level) VALUES ($1,$2,'学','N5')", [futureKanji, lesson2]);

  const transaction = async work => {
    await client.query('BEGIN');
    try { const value = await work(client); await client.query('COMMIT'); return value; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
  };
  const japanese = '  <ruby>学<rt>がく</rt></ruby>  ';
  const options = {
    transaction, rejectedReportTransaction: transaction,
    prepare: async () => ({ scope: { moduleId: module1, lessonId: lesson1 },
      contentType: 'vocabulary_example', operation: 'live_write',
      fields: [{ path: 'japanese', text: japanese }] }),
    write: async db => (await db.query(
      'INSERT INTO vocabulary_examples(vocabulary_id,japanese,sort_order) VALUES ($1,$2,0) RETURNING *',
      [vocabularyId, japanese])).rows[0],
  };
  await assert.rejects(validateAndWriteContent(options), error =>
    error instanceof BoundaryWriteError && error.statusCode === 422 &&
    error.report.violations.some(item => item.code === 'future_kanji'));
  assert.equal((await client.query('SELECT count(*)::int AS n FROM vocabulary_examples')).rows[0].n, 0);
  assert.equal((await client.query("SELECT count(*)::int AS n FROM curriculum_boundary_reports WHERE decision='blocked'")).rows[0].n, 1);

  await client.query("UPDATE courses SET curriculum_boundary_mode='warn' WHERE id=$1", [courseId]);
  const written = await validateAndWriteContent(options);
  assert.equal(written.decision.decision, 'allowed_with_warning');
  assert.equal(written.value.japanese, japanese);
  const saved = await client.query('SELECT japanese FROM vocabulary_examples WHERE id=$1', [written.value.id]);
  assert.equal(saved.rows[0].japanese, japanese);
  const report = await client.query('SELECT validation_status,decision,violations FROM curriculum_boundary_reports WHERE content_id=$1', [written.value.id]);
  assert.equal(report.rows[0].validation_status, 'evaluated');
  assert.equal(report.rows[0].decision, 'allowed_with_warning');
  assert.ok(report.rows[0].violations.some(item => item.code === 'future_kanji'));

  // A failed SQL statement poisons a PostgreSQL transaction until a
  // savepoint rollback. Warn must still write and report in that transaction.
  const recovered = await validateAndWriteContent({ ...options,
    resolveBoundary: async (_scope, { dbQuery }) => {
      try { await dbQuery('SELECT * FROM definitely_missing_boundary_relation'); }
      catch (error) { throw new BoundaryUnavailableError(error); }
    },
  });
  assert.equal(recovered.report.status, 'unavailable');
  assert.equal(recovered.value.japanese, japanese);
  assert.equal((await client.query("SELECT count(*)::int AS n FROM curriculum_boundary_reports WHERE decision='unavailable'")).rows[0].n, 1);

  // Removing an existing violation is remediation, so enforce must not block
  // the delete. A historical validation report can remain after content removal.
  await client.query("UPDATE courses SET curriculum_boundary_mode='enforce' WHERE id=$1", [courseId]);
  await client.query('BEGIN');
  await lockCurriculumCourses(client, [courseId]);
  await client.query('DELETE FROM vocabulary_examples WHERE id=$1', [written.value.id]);
  await client.query('COMMIT');
  assert.equal((await client.query('SELECT count(*)::int AS n FROM vocabulary_examples WHERE id=$1',
    [written.value.id])).rows[0].n, 0);

  const [dependentId, independentId] = [randomUUID(), randomUUID()];
  await client.query(`INSERT INTO courses(id,slug,title,level) VALUES
    ($1,'n4','N4','N4'),($2,'n3','N3','N3')`, [dependentId, independentId]);
  await client.query('INSERT INTO course_prerequisites(course_id,prerequisite_course_id) VALUES ($1,$2)',
    [dependentId, courseId]);
  const second = new pg.Client({ connectionString: url.href, statement_timeout: 30000 });
  await second.connect();
  t.after(async () => second.end());
  await second.query(`SET search_path TO ${schema}`);
  // Both sessions request the same multi-course union in opposite order.
  // Stable union sorting must let both commit rather than deadlock.
  const oppositeOrder = async (db, ids) => {
    await db.query('BEGIN');
    try { await lockCurriculumCourses(db, ids); await db.query('COMMIT'); }
    catch (error) { await db.query('ROLLBACK'); throw error; }
  };
  await Promise.all([
    oppositeOrder(client, [dependentId, independentId]),
    oppositeOrder(second, [independentId, dependentId]),
  ]);
  await client.query('BEGIN');
  await lockCurriculumCourse(client, courseId);
  await second.query('BEGIN');
  await second.query("SET LOCAL lock_timeout='150ms'");
  await assert.rejects(lockCurriculumCourse(second, dependentId), error => error.code === '55P03');
  await second.query('ROLLBACK');
  await client.query('COMMIT');

  await client.query('BEGIN');
  await second.query('BEGIN');
  await lockCurriculumCourse(client, courseId);
  await lockCurriculumCourse(second, independentId);
  await second.query('COMMIT');
  await client.query('COMMIT');

  await client.query('BEGIN');
  await lockCurriculumGraph(client, { exclusive: true });
  await second.query('BEGIN');
  await second.query("SET LOCAL lock_timeout='150ms'");
  await assert.rejects(lockCurriculumCourse(second, independentId), error => error.code === '55P03');
  await second.query('ROLLBACK');
  await client.query('COMMIT');
});
