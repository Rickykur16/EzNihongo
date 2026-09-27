import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { getCurriculumBoundaryMode, saveCurriculumBoundaryMode } from './curriculum-boundary-mode.js';

test('two PostgreSQL clients serialize a boundary-mode CAS behind curriculum locks', {
  skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL to an isolated local test database',
  timeout: 30000,
}, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.equal(url.searchParams.has('host'), false);
  assert.equal(url.searchParams.has('hostaddr'), false);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  assert.match(url.pathname, /test/i);
  const schema = `boundary_mode_test_${randomUUID().replaceAll('-', '')}`;
  const quoted = `"${schema}"`;
  const pool = new pg.Pool({ connectionString: url.href, max: 3, statement_timeout: 10000 });
  const setup = await pool.connect();
  t.after(async () => {
    try { await setup.query(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`); }
    finally { setup.release(); await pool.end(); }
  });
  const id = randomUUID();
  await setup.query(`CREATE SCHEMA ${quoted};
    CREATE TABLE ${quoted}.courses (
      id UUID PRIMARY KEY, slug TEXT NOT NULL, title TEXT NOT NULL,
      curriculum_boundary_mode TEXT NOT NULL DEFAULT 'off');
    CREATE TABLE ${quoted}.course_prerequisites (
      course_id UUID NOT NULL, prerequisite_course_id UUID NOT NULL);`);
  await setup.query(`INSERT INTO ${quoted}.courses(id,slug,title) VALUES ($1,'n4','N4')`, [id]);
  const transaction = async fn => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL search_path TO ${quoted}`);
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  };
  const initial = await transaction(client => getCurriculumBoundaryMode(id,
    { dbQuery: client.query.bind(client) }));
  const deps = { transaction, logger: () => {} };
  const results = await Promise.allSettled([
    saveCurriculumBoundaryMode(id, { mode: 'audit', expectedRevision: initial.modeRevision }, deps),
    saveCurriculumBoundaryMode(id, { mode: 'warn', expectedRevision: initial.modeRevision }, deps),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const rejected = results.find(result => result.status === 'rejected');
  assert.equal(rejected.reason.status, 409);
  assert.equal(rejected.reason.code, 'boundary_mode_revision_conflict');
  const current = await transaction(client => getCurriculumBoundaryMode(id,
    { dbQuery: client.query.bind(client) }));
  assert.ok(['audit', 'warn'].includes(current.course.mode));
  assert.notEqual(current.modeRevision, initial.modeRevision);
  await assert.rejects(saveCurriculumBoundaryMode(id,
    { mode: 'enforce', expectedRevision: current.modeRevision }, deps),
  error => error.status === 422 && error.code === 'enforce_readiness_evidence_unavailable');
  assert.equal((await setup.query(`SELECT curriculum_boundary_mode FROM ${quoted}.courses WHERE id=$1`,
    [id])).rows[0].curriculum_boundary_mode, current.course.mode);
});
