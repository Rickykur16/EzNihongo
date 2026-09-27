import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

process.env.JWT_ACCESS_SECRET = 'curriculum-mode-admin-test-secret';
process.env.JWT_REFRESH_SECRET = 'curriculum-mode-admin-test-refresh';
process.env.ADMIN_EMAILS = 'owner@example.invalid';
process.env.COMPANY_STAFF_ENABLED = 'false';

const { db } = await import('./db.js');
const { signAccessToken } = await import('./auth.js');
const { default: admin } = await import('./routes/admin.js');
const { LEGACY_ROUTES, permissionForLegacyRoute } = await import('./company-route-policy.js');
const ID = '10000000-0000-4000-8000-000000000001';
const STAFF_ID = '10000000-0000-4000-8000-000000000004';
let row = { id: ID, slug: 'n4', title: 'N4', curriculum_boundary_mode: 'off', row_revision: '10' };
let writes = 0;
const client = { release() {}, async query(sql, params = []) {
  if (/^(BEGIN|COMMIT|ROLLBACK)/u.test(sql)) return { rows: [] };
  if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
  if (sql.includes('WITH RECURSIVE required')) return { rows: [{ id: ID }] };
  if (sql === 'SELECT id FROM courses WHERE id=$1') return { rows: params[0] === ID ? [{ id: ID }] : [] };
  if (sql.includes('FROM courses WHERE id=$1')) return { rows: params[0] === ID ? [{ ...row }] : [] };
  if (sql.startsWith('UPDATE courses SET curriculum_boundary_mode=')) {
    assert.equal(params[0], ID);
    assert.equal(params[2], row.row_revision);
    writes++;
    row = { ...row, curriculum_boundary_mode: params[1],
      row_revision: String(Number(row.row_revision) + 1) };
    return { rows: [{ ...row }] };
  }
  throw new Error(`unexpected client SQL: ${sql}`);
} };
mock.method(db, 'connect', async () => client);
mock.method(db, 'query', async (sql, params = []) => {
  if (sql.includes('FROM admin_emails')) return { rows: [] };
  if (sql.includes('FROM users WHERE id = $1')) return { rows: params[0] === STAFF_ID
    ? [{ id: STAFF_ID, email: 'academic@example.invalid' }] : [] };
  if (sql.includes('FROM staff_memberships')) return { rows: [{ division_key: 'academic',
    permission_key: 'legacy.academic', scope_type: 'global', course_id: null }] };
  return client.query(sql, params);
});

const app = express();
app.use(express.json());
app.use('/api/admin', admin);
app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.message }));
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
test.after(async () => { await new Promise(resolve => server.close(resolve)); });
const base = `http://127.0.0.1:${server.address().port}/api/admin/courses`;
const owner = await signAccessToken(ID, 'owner@example.invalid');
const student = await signAccessToken('10000000-0000-4000-8000-000000000002', 'student@example.invalid');
const staff = await signAccessToken(STAFF_ID, 'academic@example.invalid');
const headers = { Authorization: `Bearer ${owner}` };
const read = (id = ID, token = headers.Authorization) => fetch(`${base}/${id}/curriculum-boundary-mode`,
  { headers: { Authorization: token } });
const put = (body, id = ID) => fetch(`${base}/${id}/curriculum-boundary-mode`, {
  method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

test('boundary mode routes are exact owner-only policy entries', () => {
  for (const method of ['GET', 'PUT']) {
    assert.equal(LEGACY_ROUTES.some(([verb, path, permission]) => verb === method &&
      path === '/courses/:id/curriculum-boundary-mode' && permission === null), true);
    assert.equal(permissionForLegacyRoute(method,
      `/courses/${ID}/curriculum-boundary-mode`), null);
  }
});

test('owner HTTP contract: private GET, CAS writes, explicit enforce block, no config mutation', async () => {
  assert.equal((await read(ID, '')).status, 401);
  assert.equal((await read(ID, `Bearer ${student}`)).status, 403);
  const missing = await read('10000000-0000-4000-8000-000000000003');
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get('cache-control'), 'private, no-store');
  const invalid = await read('bad-id');
  assert.equal(invalid.status, 400);
  const response = await read();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const initial = await response.json();
  assert.deepEqual(initial.course, { id: ID, slug: 'n4', title: 'N4', mode: 'off' });
  assert.match(initial.modeRevision, /^sha256:[0-9a-f]{64}$/);
  const stale = await put({ mode: 'audit', expectedRevision: `sha256:${'0'.repeat(64)}` });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).error, 'boundary_mode_revision_conflict');
  assert.equal((await put({ mode: 'audit', expectedRevision: initial.modeRevision,
    manifest: { ready: true } })).status, 400);
  const enforce = await put({ mode: 'enforce', expectedRevision: initial.modeRevision });
  assert.equal(enforce.status, 422);
  assert.equal((await enforce.json()).error, 'enforce_readiness_evidence_unavailable');
  assert.equal(writes, 0);
  const changed = await put({ mode: 'warn', expectedRevision: initial.modeRevision });
  assert.equal(changed.status, 200);
  assert.equal(changed.headers.get('cache-control'), 'private, no-store');
  const saved = await changed.json();
  assert.equal(saved.course.mode, 'warn');
  assert.notEqual(saved.modeRevision, initial.modeRevision);
  assert.equal(writes, 1);
  assert.equal((await put({ mode: 'off', expectedRevision: initial.modeRevision })).status, 409);
  const rollback = await put({ mode: 'off', expectedRevision: saved.modeRevision });
  assert.equal(rollback.status, 200);
  assert.equal((await rollback.json()).course.mode, 'off');
  assert.equal(writes, 2);
});

test('global legacy.academic staff cannot read or change owner-only boundary mode', async () => {
  process.env.COMPANY_WORKSPACE_ENABLED = 'true';
  process.env.COMPANY_STAFF_ENABLED = 'true';
  try {
    const token = `Bearer ${staff}`;
    const deniedGet = await read(ID, token);
    assert.equal(deniedGet.status, 403);
    const deniedPut = await fetch(`${base}/${ID}/curriculum-boundary-mode`, {
      method: 'PUT', headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'audit', expectedRevision: `sha256:${'0'.repeat(64)}` }),
    });
    assert.equal(deniedPut.status, 403);
    assert.equal(row.curriculum_boundary_mode, 'off');
    assert.equal(writes, 2);
  } finally {
    process.env.COMPANY_STAFF_ENABLED = 'false';
    process.env.COMPANY_WORKSPACE_ENABLED = 'false';
  }
});
