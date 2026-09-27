import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { loadLearningFlowConfig, saveLearningFlowSettings } from './learning-flow-config.js';

test('missing settings row uses an atomic revision CAS on PostgreSQL', {
  skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL to an isolated local test database',
  timeout: 30000,
}, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.equal(url.searchParams.has('host'), false);
  assert.equal(url.searchParams.has('hostaddr'), false);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  assert.match(url.pathname, /test/i);

  const schema = `flow_config_test_${randomUUID().replaceAll('-', '')}`;
  const quoted = `"${schema}"`;
  const pool = new pg.Pool({ connectionString: url.href, max: 3, statement_timeout: 10000 });
  const setup = await pool.connect();
  t.after(async () => {
    try { await setup.query(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`); }
    finally { setup.release(); await pool.end(); }
  });
  await setup.query(`CREATE SCHEMA ${quoted}; CREATE TABLE ${quoted}.app_settings(
    key TEXT PRIMARY KEY,value TEXT,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);

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
  const dependencies = { transaction,
    resolveScope: async () => ({ issues: [], courseIds: [], lessons: [] }),
    checkReadiness: async () => ({ ready: false,
      issues: [{ code: 'flow_scope_empty' }], lessons: [] }) };
  const initial = await transaction(client => loadLearningFlowConfig(client));
  const body = { expectedConfigRevision: initial.configRevision,
    config: { enabled: false, courseIds: [], moduleIds: [], lessonIds: [] } };
  const results = await Promise.allSettled([
    saveLearningFlowSettings(body, dependencies),
    saveLearningFlowSettings(body, dependencies),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const rejected = results.find(result => result.status === 'rejected');
  assert.equal(rejected.reason.status, 409);
  assert.equal(rejected.reason.message, 'flow_config_revision_conflict');
  assert.equal((await setup.query(`SELECT count(*)::int AS n FROM ${quoted}.app_settings`)).rows[0].n, 1);
});
