import test, { after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';

process.env.JWT_ACCESS_SECRET = 'local-discussion-test-access';
process.env.JWT_REFRESH_SECRET = 'local-discussion-test-refresh';
process.env.ADMIN_EMAILS = 'admin@example.invalid';

const { db } = await import('./db.js');
const { signAccessToken } = await import('./auth.js');
const { default: discussionsRouter } = await import('./routes/discussions.js');

const studentId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const adminId = '33333333-3333-4333-8333-333333333333';
const spammerId = '44444444-4444-4444-8444-444444444444';
const lessonId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherLessonId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const courseId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const discussionId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const parentId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
let accessMode = 'allowed';
let parentValid = true;
let existingOwner = studentId;
let queryCount = 0;

mock.method(db, 'query', async (sql, params = []) => {
  queryCount++;
  if (sql.includes('FROM lessons l')) {
    if (accessMode === 'db-error') throw new Error('simulated lookup failure');
    if (params[0] === otherLessonId || accessMode === 'missing') return { rows: [] };
    return { rows: [{ course_id: courseId }] };
  }
  if (sql.includes('FROM user_enrollments')) {
    const enrolled = accessMode === 'allowed' && params[0] !== otherId;
    return { rows: enrolled ? [{ '?column?': 1 }] : [] };
  }
  if (sql.includes('SELECT email FROM admin_emails')) return { rows: [] };
  if (sql.includes('FROM discussions d') && sql.includes('JOIN users')) {
    assert.match(sql, /\(d\.user_id = \$2\) AS is_own/);
    return { rows: [
      { id: discussionId, parent_id: null, content: 'Milik saya', is_admin_reply: false,
        created_at: new Date(), updated_at: new Date(), is_own: params[1] === studentId,
        full_name: 'Siswa', avatar_url: null },
      { id: parentId, parent_id: null, content: 'Komentar lain', is_admin_reply: false,
        created_at: new Date(), updated_at: new Date(), is_own: false,
        full_name: 'Siswa lain', avatar_url: null },
    ] };
  }
  if (sql.includes('SELECT id FROM discussions')) {
    assert.match(sql, /lesson_id = \$2 AND is_deleted = FALSE/);
    return { rows: parentValid && params[0] === parentId && params[1] === lessonId ? [{ id: parentId }] : [] };
  }
  if (sql.includes('INSERT INTO discussions')) {
    return { rows: [{ id: discussionId, lesson_id: params[0], parent_id: params[2],
      content: params[3], is_admin_reply: params[4], created_at: new Date(), is_own: true }] };
  }
  if (sql.includes('SELECT user_id FROM discussions')) return { rows: [{ user_id: existingOwner }] };
  if (sql.includes('UPDATE discussions')) return { rows: [], rowCount: 1 };
  throw new Error('Unexpected query: ' + sql);
});

const tokens = {
  student: await signAccessToken(studentId, 'student@example.invalid'),
  other: await signAccessToken(otherId, 'other@example.invalid'),
  admin: await signAccessToken(adminId, 'admin@example.invalid'),
  spammer: await signAccessToken(spammerId, 'spammer@example.invalid'),
};
const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/discussions', discussionsRouter);
app.use((err, req, res, next) => res.status(500).json({ error: 'test_internal_error' }));
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
let requestIndex = 0;
async function request(path, { method = 'GET', body, who } = {}) {
  const response = await fetch(base + path, {
    method, signal: AbortSignal.timeout(5000),
    headers: {
      ...(who ? { Authorization: `Bearer ${tokens[who]}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      'X-Forwarded-For': `192.0.2.${++requestIndex}`,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}
after(async () => {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  mock.restoreAll();
  await db.end();
});

test('discussion read and write require authentication before database access', async () => {
  const before = queryCount;
  assert.equal((await request(`/api/discussions/lesson/${lessonId}`)).status, 401);
  assert.equal((await request('/api/discussions', { method: 'POST', body: { lessonId, content: 'test' } })).status, 401);
  assert.equal(queryCount, before);
});

test('invalid/missing lessons and database errors are handled without exposing a thread', async () => {
  const before = queryCount;
  assert.equal((await request('/api/discussions/lesson/not-a-uuid', { who: 'student' })).status, 400);
  assert.equal(queryCount, before);
  accessMode = 'missing';
  assert.equal((await request(`/api/discussions/lesson/${lessonId}`, { who: 'student' })).status, 404);
  accessMode = 'db-error';
  assert.equal((await request(`/api/discussions/lesson/${lessonId}`, { who: 'student' })).status, 500);
  assert.equal((await request('/health')).status, 200);
  accessMode = 'allowed';
});

test('unenrolled, expired or revoked users cannot read or post; admins retain course QA access', async () => {
  accessMode = 'denied';
  assert.equal((await request(`/api/discussions/lesson/${lessonId}`, { who: 'student' })).status, 403);
  assert.equal((await request('/api/discussions', { method: 'POST', who: 'student', body: { lessonId, content: 'test' } })).status, 403);
  assert.equal((await request(`/api/discussions/lesson/${lessonId}`, { who: 'admin' })).status, 200);
  assert.equal((await request('/api/discussions', { method: 'POST', who: 'admin', body: { lessonId, content: 'Jawaban admin' } })).status, 201);
  accessMode = 'allowed';
});

test('student thread omits internal user IDs and marks only the caller own comments', async () => {
  const response = await request(`/api/discussions/lesson/${lessonId}`, { who: 'student' });
  assert.equal(response.status, 200);
  assert.equal(response.body.discussions[0].is_own, true);
  assert.equal(response.body.discussions[1].is_own, false);
  assert.ok(response.body.discussions.every(row => !Object.hasOwn(row, 'user_id')));
});

test('posting validates content and live parent in the same lesson, returning no user ID', async () => {
  for (const content of ['', '   ', 42, {}, null]) {
    assert.equal((await request('/api/discussions', { method: 'POST', who: 'student', body: { lessonId, content } })).status, 400);
  }
  parentValid = false;
  assert.equal((await request('/api/discussions', { method: 'POST', who: 'student',
    body: { lessonId, parentId, content: 'Balasan' } })).status, 400);
  parentValid = true;
  const posted = await request('/api/discussions', { method: 'POST', who: 'student',
    body: { lessonId, parentId, content: '  Balasan aman  ' } });
  assert.equal(posted.status, 201);
  assert.equal(posted.body.discussion.content, 'Balasan aman');
  assert.equal(posted.body.discussion.is_own, true);
  assert.equal(Object.hasOwn(posted.body.discussion, 'user_id'), false);
});

test('per-account write limiter blocks the eleventh post in one minute', async () => {
  for (let i = 0; i < 10; i++) {
    assert.equal((await request('/api/discussions', { method: 'POST', who: 'spammer',
      body: { lessonId, content: `Pesan ${i}` } })).status, 201);
  }
  const limited = await request('/api/discussions', { method: 'POST', who: 'spammer',
    body: { lessonId, content: 'Pesan 11' } });
  assert.equal(limited.status, 429);
  assert.equal(limited.body.error, 'too_many_discussion_posts');
});

test('delete keeps owner/admin behavior and rejects malformed IDs before database access', async () => {
  const before = queryCount;
  assert.equal((await request('/api/discussions/bad-id', { method: 'DELETE', who: 'student' })).status, 400);
  assert.equal(queryCount, before);
  existingOwner = studentId;
  assert.equal((await request(`/api/discussions/${discussionId}`, { method: 'DELETE', who: 'student' })).status, 200);
  assert.equal((await request(`/api/discussions/${discussionId}`, { method: 'DELETE', who: 'other' })).status, 403);
  assert.equal((await request(`/api/discussions/${discussionId}`, { method: 'DELETE', who: 'admin' })).status, 200);
});
