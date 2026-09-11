import test, { after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import express from 'express';
import { SignJWT } from 'jose';
import { describeLegacyStaffAccess, STAFF_TAB_CAPABILITIES } from './staff-capabilities.js';

process.env.JWT_ACCESS_SECRET = 'staff-local-test-access';
process.env.JWT_REFRESH_SECRET = 'staff-local-test-refresh';
process.env.ADMIN_EMAILS = 'admin@example.invalid';
process.env.ANTHROPIC_API_KEY = '';
process.env.ELEVENLABS_API_KEY = '';
const { db } = await import('./db.js');
const { signAccessToken, signRefreshToken, invalidateAdminEmailCache } = await import('./auth.js');
const { signKanjiAccessToken } = await import('./kanji-auth.js');
const { default: staffRouter } = await import('./routes/staff.js');
const { default: adminRouter } = await import('./routes/admin.js');

const adminId = '11111111-1111-4111-8111-111111111111';
const studentId = '22222222-2222-4222-8222-222222222222';
const dbAdminId = '33333333-3333-4333-8333-333333333333';
const users = new Map([[adminId, 'admin@example.invalid'], [studentId, 'student@example.invalid'], [dbAdminId, 'db-admin@example.invalid']]);
let dbAdmins = ['db-admin@example.invalid'];
let failLookup = false;
const queries = [];
mock.method(db, 'query', async (sql, params = []) => {
  queries.push({ sql, params });
  assert.match(sql.trim(), /^SELECT /, 'Staff discovery must never write data');
  if (sql === 'SELECT id, email FROM users WHERE id = $1') {
    if (failLookup) throw new Error('private database details');
    return { rows: users.has(params[0]) ? [{ id: params[0], email: users.get(params[0]) }] : [] };
  }
  if (sql === 'SELECT email FROM admin_emails') return { rows: dbAdmins.map(email => ({ email })) };
  if (sql.includes('FROM courses')) return { rows: [] };
  throw new Error('Unexpected test query: ' + sql);
});
const app = express();
app.set('trust proxy', 1);
app.use('/api/staff', staffRouter);
app.use('/api/admin', adminRouter);
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => res.status(500).json({ error: 'Internal server error' }));
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
after(async () => {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  mock.restoreAll();
  await db.end();
});
const request = (token, route = '/api/staff/capabilities', method = 'GET') => fetch(base + route, {
  method, headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(5000),
});
const token = await signAccessToken(adminId, users.get(adminId));

test('capability catalogue preserves all twelve existing tabs and five divisions', () => {
  const access = describeLegacyStaffAccess(true);
  assert.equal(access.authorizationMode, 'legacy-admin-only');
  assert.equal(access.tabs.length, 12);
  assert.equal(access.divisions.length, 5);
  assert.deepEqual(access.tabs, Object.keys(STAFF_TAB_CAPABILITIES));
  assert.ok(access.capabilities.includes('admins.manage'));
  access.divisions[0].name = 'mutated';
  assert.equal(describeLegacyStaffAccess(true).divisions[0].name, 'Product & Technology');
  assert.deepEqual(describeLegacyStaffAccess('true'), describeLegacyStaffAccess(false));
});

test('missing and invalid tokens fail before any DB access, with no-store responses', async () => {
  const count = queries.length;
  for (const candidate of [null, 'not-a-jwt']) {
    const res = await request(candidate);
    assert.equal(res.status, 401);
    assert.match(res.headers.get('cache-control'), /no-store/);
  }
  assert.equal(queries.length, count);
});

test('existing env and DB admins retain identical discovery and existing admin-route access', async () => {
  invalidateAdminEmailCache();
  for (const id of [adminId, dbAdminId]) {
    const jwt = await signAccessToken(id, users.get(id));
    const res = await request(jwt);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('vary'), /Authorization/);
    assert.match(res.headers.get('cache-control'), /private, no-store/);
    assert.deepEqual(await res.json(), describeLegacyStaffAccess(true));
    const legacy = await request(jwt, '/api/admin/courses');
    assert.equal(legacy.status, 200);
    assert.deepEqual(await legacy.json(), { courses: [] });
  }
});

test('ordinary students receive no staff capabilities and cannot use the existing admin route', async () => {
  const jwt = await signAccessToken(studentId, users.get(studentId));
  const res = await request(jwt);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), describeLegacyStaffAccess(false));
  assert.equal((await request(jwt, '/api/admin/courses')).status, 403);
});

test('Kanji token with even the same admin ID/email is rejected before any DB query', async () => {
  const count = queries.length;
  assert.equal((await request(await signKanjiAccessToken(adminId, users.get(adminId)))).status, 401);
  assert.equal(queries.length, count);
});

test('refresh, expired, unknown-scope and invalid-subject tokens never become staff principals', async () => {
  const count = queries.length;
  const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
  const custom = async (claims, expired = false) => new SignJWT(claims).setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expired ? Math.floor(Date.now() / 1000) - 60 : '15m').sign(secret);
  const invalid = [
    await signRefreshToken(adminId, 'test-session'),
    await custom({ sub: adminId, email: users.get(adminId) }, true),
    await custom({ sub: adminId, email: users.get(adminId), scope: 'other' }),
    await custom({ sub: adminId, email: users.get(adminId), sid: 'session' }),
    await custom({ sub: 'not-a-uuid', email: users.get(adminId) }),
    await custom({ sub: adminId }),
  ];
  for (const jwt of invalid) assert.equal((await request(jwt)).status, 401);
  assert.equal(queries.length, count);
});

test('deleted or renamed principal cannot reuse a still-signed admin email', async () => {
  try {
    users.delete(adminId);
    assert.equal((await request(token)).status, 401);
    users.set(adminId, `dihapus-${adminId}@dihapus.invalid`);
    assert.equal((await request(token)).status, 401);
  } finally { users.set(adminId, 'admin@example.invalid'); }
});

test('identity lookup failure does not fall back to env-admin rights or leak database errors', async () => {
  failLookup = true;
  try {
    const res = await request(token);
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { error: 'Internal server error' });
    assert.match(res.headers.get('cache-control'), /no-store/);
  } finally { failLookup = false; }
});

test('DB admin removal follows existing cache invalidation, without persisted client grants', async () => {
  const jwt = await signAccessToken(dbAdminId, users.get(dbAdminId));
  dbAdmins = [];
  invalidateAdminEmailCache();
  try {
    assert.deepEqual(await (await request(jwt)).json(), describeLegacyStaffAccess(false));
    assert.equal((await request(jwt, '/api/admin/courses')).status, 403);
  } finally { dbAdmins = ['db-admin@example.invalid']; invalidateAdminEmailCache(); }
});

test('discovery exposes no write endpoint and does not capture unrelated paths', async () => {
  const count = queries.length;
  for (const method of ['POST', 'PUT', 'DELETE']) assert.equal((await request(token, '/api/staff/capabilities', method)).status, 404);
  assert.equal((await request(null, '/api/staff/unknown')).status, 404);
  assert.equal(queries.length, count);
});

test('staff router is mounted before catch-all authenticated routers', async () => {
  const source = await readFile(new URL('./server.js', import.meta.url), 'utf8');
  const staffMount = source.indexOf("app.use('/api/staff', staffRouter)");
  assert.ok(staffMount > 0 && staffMount < source.indexOf("app.use('/api', progressRouter)"));
});
