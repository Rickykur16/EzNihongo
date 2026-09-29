import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

process.env.JWT_ACCESS_SECRET = 'learning-flow-admin-test-secret';
process.env.JWT_REFRESH_SECRET = 'learning-flow-admin-test-refresh';
process.env.ADMIN_EMAILS = 'owner@example.invalid';
process.env.COMPANY_STAFF_ENABLED = 'false';
const { db } = await import('./db.js');
const { signAccessToken } = await import('./auth.js');
const { default: admin } = await import('./routes/admin.js');

let value = JSON.stringify({ enabled: false, courseIds: [], moduleIds: [], lessonIds: [] });
let version = 9, writes = 0;
const client = { release() {}, async query(sql, params = []) {
  if (/^(BEGIN|COMMIT|ROLLBACK)/u.test(sql) || sql.includes('pg_advisory_xact_lock')) return { rows: [] };
  if (sql.includes('FROM app_settings')) return { rows: [{ value, row_revision: String(version) }] };
  if (sql.includes('FROM courses WHERE') || sql.includes('FROM modules WHERE') ||
      sql.includes('FROM lessons l') || sql.includes('SELECT l.id,l.module_id')) return { rows: [] };
  if (sql.includes('INSERT INTO app_settings')) {
    writes++; value = params[1]; version++;
    return { rows: [{ row_revision: String(version) }] };
  }
  throw Error(`unexpected SQL ${sql}`);
} };
mock.method(db, 'connect', async () => client);
const titleQueries = [];
mock.method(db, 'query', async (sql, params = []) => {
  if (sql.includes('FROM admin_emails')) return { rows: [] };
  if (sql.includes('LEFT JOIN lessons cv')) {
    titleQueries.push(params[0]);
    return { rows: params[0].map(id => ({ id, title: 'Tata Bahasa: です', module_title: 'Bab 3',
      course_title: 'N5', conversation_title: 'Percakapan: です' })) };
  }
  throw Error(`unexpected global SQL ${sql}`);
});

const app = express();
app.use(express.json());
app.use('/api/admin', admin);
app.use((error, req, res, next) => res.status(error.status || 500).json({ error: error.message }));
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const owner = await signAccessToken('10000000-0000-4000-8000-000000000001', 'owner@example.invalid');
const student = await signAccessToken('10000000-0000-4000-8000-000000000002', 'student@example.invalid');
test.after(async () => { await new Promise(resolve => server.close(resolve)); });

test('owner-only settings HTTP contract: GET revision, stale 409, invalid 400, disabled PUT 200', async () => {
  const path = `${base}/api/admin/settings/learning-flow-communication`;
  assert.equal((await fetch(path)).status, 401);
  assert.equal((await fetch(path, { headers: { Authorization: `Bearer ${student}` } })).status, 403);
  const get = await fetch(path, { headers: { Authorization: `Bearer ${owner}` } });
  assert.equal(get.status, 200);
  assert.equal(get.headers.get('cache-control'), 'private, no-store');
  const initial = await get.json();
  assert.equal(initial.config.enabled, false);
  assert.equal(initial.readiness.ready, false);
  const send = body => fetch(path, { method: 'PUT', headers: { Authorization: `Bearer ${owner}`,
    'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await send({ expectedConfigRevision: 'stale', config: initial.config })).status, 409);
  assert.equal((await send({ expectedConfigRevision: initial.configRevision,
    config: { enabled: 'false', courseIds: [], moduleIds: [], lessonIds: [] } })).status, 400);
  assert.equal(writes, 0);
  const updated = await send({ expectedConfigRevision: initial.configRevision,
    config: initial.config });
  assert.equal(updated.status, 200);
  assert.notEqual((await updated.json()).configRevision, initial.configRevision);
  assert.equal(writes, 1);
});

test('readiness preview is owner-only, validates the id, reports the lesson, and never writes', async () => {
  const path = `${base}/api/admin/settings/learning-flow-communication/readiness`;
  const lessonId = '20000000-0000-4000-8000-000000000003';
  const before = writes;
  assert.equal((await fetch(`${path}?lessonId=${lessonId}`)).status, 401);
  assert.equal((await fetch(`${path}?lessonId=${lessonId}`,
    { headers: { Authorization: `Bearer ${student}` } })).status, 403);
  const bad = await fetch(`${path}?lessonId=nope`, { headers: { Authorization: `Bearer ${owner}` } });
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error, 'invalid_lesson_id');
  const res = await fetch(`${path}?lessonId=${lessonId}`, { headers: { Authorization: `Bearer ${owner}` } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  const body = await res.json();
  assert.equal(body.readiness.ready, false);
  assert.ok(body.readiness.issues.some(entry => entry.code === 'flow_scope_id_missing' &&
    entry.kind === 'lesson' && entry.id === lessonId));
  assert.deepEqual(body.titles.lessons[lessonId], { title: 'Tata Bahasa: です', moduleTitle: 'Bab 3',
    courseTitle: 'N5', conversationTitle: 'Percakapan: です' });
  assert.deepEqual(titleQueries.at(-1), [lessonId]);
  assert.equal(writes, before);
});
