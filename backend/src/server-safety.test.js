import test, { after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import express from 'express';

// Real HTTP/Express/Multer/JWT; fake database and disabled external providers.
// Nothing in this suite connects to production or spends provider credits.
const tempRoot = path.join(tmpdir(), 'eznihongo-upload-test-');
const uploadDir = await mkdtemp(tempRoot);
process.env.UPLOAD_DIR = uploadDir;
process.env.JWT_ACCESS_SECRET = 'local-test-secret-not-a-production-credential';
process.env.JWT_REFRESH_SECRET = 'local-test-refresh-not-a-production-credential';
process.env.ADMIN_EMAILS = 'admin@example.invalid';
process.env.ANTHROPIC_API_KEY = '';
process.env.ELEVENLABS_API_KEY = '';
process.env.TELEGRAM_BOT_TOKEN = '';
process.env.TELEGRAM_ADMIN_CHAT_ID = '';

const { db } = await import('./db.js');
const { signAccessToken } = await import('./auth.js');
const { requireAuth } = await import('./middleware.js');
const { requireLessonCourseAccess } = await import('./entitlements.js');
const { default: uploadsRouter } = await import('./routes/uploads.js');
const { default: ordersRouter } = await import('./routes/orders.js');
const { default: grammarRouter } = await import('./routes/grammar-task.js');
const lessonId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const courseId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const orderId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
let dbMode = 'allowed';
let queryCount = 0;
let paymentFields;
const order = {
  id: orderId, user_id: userId, course_id: courseId,
  status: 'pending_payment', expires_at: new Date(Date.now() + 86400000),
  amount_idr: 100, order_number: 'TEST-ORDER', course_title_snapshot: 'Test course',
};
mock.method(db, 'query', async (sql) => {
  queryCount++;
  if (sql.includes('FROM lessons l')) {
    if (dbMode === 'lookup-error') throw new Error('simulated database outage');
    return { rows: dbMode === 'missing' ? [] : [{ course_id: courseId }] };
  }
  if (sql.includes('FROM user_enrollments')) {
    if (dbMode === 'access-error') throw new Error('simulated authorization query failure');
    return { rows: dbMode === 'denied' ? [] : [{ '?column?': 1 }] };
  }
  if (sql.includes('admin_emails')) return { rows: [] };
  if (sql.includes('FROM orders o JOIN courses')) return { rows: [order] };
  throw new Error('Unexpected test query: ' + sql);
});
mock.method(db, 'connect', async () => ({
  async query(sql, params) {
    if (sql.includes('INSERT INTO order_payments')) {
      paymentFields = params;
      return { rows: [{ id: 'test-payment', status: 'pending', proof_mime: params[2] }] };
    }
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql) || sql.includes('UPDATE order')) return { rows: [] };
    throw new Error('Unexpected transaction query: ' + sql);
  },
  release() {},
}));

const app = express();
app.set('trust proxy', 1);
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/protected/:lessonId', requireAuth, requireLessonCourseAccess(), (req, res) => res.json({ courseId: req.courseId }));
app.get('/named/:id', requireAuth, requireLessonCourseAccess('id'), (req, res) => res.json({ courseId: req.courseId }));
app.use('/uploads', uploadsRouter);
app.use('/api', grammarRouter);
app.use('/api', ordersRouter);
app.use((err, req, res, next) => res.status(500).json({ error: 'Internal server error' }));
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const studentToken = await signAccessToken(userId, 'student@example.invalid');
const adminToken = await signAccessToken(userId, 'admin@example.invalid');
let requestIndex = 0;
function request(url, options = {}, token = studentToken) {
  // Separate fixture clients so these tests exercise parsing, not burst limits.
  const clientIp = `192.0.2.${++requestIndex}`;
  return fetch(base + url, {
    ...options,
    signal: AbortSignal.timeout(5000),
    headers: { Authorization: `Bearer ${token}`, 'X-Forwarded-For': clientIp, ...options.headers },
  });
}
function fileForm(field, size = 8, type = 'image/png') {
  const form = new FormData();
  form.append(field, new Blob([new Uint8Array(size)], { type }), 'test.bin');
  return form;
}
async function alive() {
  assert.equal((await request('/health')).status, 200);
}
after(async () => {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  mock.restoreAll();
  await db.end();
  if (!uploadDir.startsWith(tempRoot)) throw new Error('Refusing cleanup outside test directory');
  await rm(uploadDir, { recursive: true, force: true });
});

test('lesson access rejects invalid IDs before DB and keeps the HTTP server alive after query errors', async () => {
  const initialQueries = queryCount;
  const invalid = await request('/protected/not-a-uuid');
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error, 'invalid_lesson_id');
  assert.equal(queryCount, initialQueries);
  for (const mode of ['lookup-error', 'access-error']) {
    dbMode = mode;
    const failed = await request('/protected/' + lessonId);
    assert.equal(failed.status, 500);
    assert.deepEqual(await failed.json(), { error: 'Internal server error' });
    await alive();
    dbMode = 'allowed';
    assert.equal((await request('/protected/' + lessonId)).status, 200);
  }
});

test('lesson access still returns 404/403 and permits enrolled users with either parameter name', async () => {
  dbMode = 'missing';
  assert.equal((await request('/protected/' + lessonId)).status, 404);
  dbMode = 'denied';
  assert.equal((await request('/protected/' + lessonId)).status, 403);
  dbMode = 'allowed';
  assert.deepEqual(await (await request('/named/' + lessonId)).json(), { courseId });
});

test('real upload routes accept image, payment proof with all four flat fields, and audio parsing', async () => {
  const image = await request('/uploads', { method: 'POST', body: fileForm('file') }, adminToken);
  assert.equal(image.status, 201);
  const saved = await image.json();
  assert.equal((await readFile(path.join(uploadDir, path.basename(saved.url)))).length, 8);

  const proof = fileForm('file', 8, 'application/pdf');
  proof.append('claimedBankName', 'Test bank');
  proof.append('claimedSenderName', 'Test sender');
  proof.append('claimedAmountIdr', '100');
  proof.append('claimedTransferredAt', '2026-09-08T00:00:00Z');
  assert.equal((await request(`/api/orders/${orderId}/payment-proof`, { method: 'POST', body: proof })).status, 201);
  assert.equal(paymentFields[4], 'Test bank');
  assert.equal(paymentFields[5], 'Test sender');
  assert.equal(paymentFields[6], 100);

  const audio = await request('/api/grammar-task/transcribe', { method: 'POST', body: fileForm('audio', 8, 'audio/webm') });
  assert.equal(audio.status, 503);
  assert.equal((await audio.json()).error, 'stt_disabled'); // parser accepted; no provider call
});

const uploadCases = [
  { url: '/uploads', field: 'file', limit: 5 * 1024 * 1024, token: adminToken },
  { url: `/api/orders/${orderId}/payment-proof`, field: 'file', limit: 5 * 1024 * 1024 },
  { url: '/api/grammar-task/transcribe', field: 'audio', limit: 2 * 1024 * 1024 },
];
test('every upload route rejects oversized and extra files without stopping the API', async () => {
  for (const route of uploadCases) {
    const tooLarge = await request(route.url, { method: 'POST', body: fileForm(route.field, route.limit + 1) }, route.token);
    assert.equal(tooLarge.status, 400);
    assert.equal((await tooLarge.json()).code, 'LIMIT_FILE_SIZE');
    const extra = fileForm(route.field);
    extra.append(route.field, new Blob(['extra'], { type: 'image/png' }), 'extra.png');
    assert.equal((await request(route.url, { method: 'POST', body: extra }, route.token)).status, 400);
    await alive();
  }
});

test('payment parser rejects nested fields, large array indexes, excessive field values and counts', async () => {
  for (const field of ['claimedBankName[nested][again]', 'claimedBankName[4294967294]']) {
    const form = fileForm('file');
    form.append(field, 'test');
    const rejected = await request(uploadCases[1].url, { method: 'POST', body: form });
    assert.equal(rejected.status, 400);
    assert.equal((await rejected.json()).code, 'LIMIT_FIELD_NESTING');
    await alive();
  }
  const longValue = fileForm('file');
  longValue.append('claimedBankName', 'x'.repeat(1025));
  const longResponse = await request(uploadCases[1].url, { method: 'POST', body: longValue });
  assert.equal((await longResponse.json()).code, 'LIMIT_FIELD_VALUE');
  const manyFields = fileForm('file');
  for (let i = 0; i < 5; i++) manyFields.append('field' + i, 'test');
  assert.equal((await request(uploadCases[1].url, { method: 'POST', body: manyFields })).status, 400);
});

test('malformed and truncated multipart return 400 on all upload routes; following requests still work', async () => {
  for (const route of uploadCases) {
    for (const payload of [
      { headers: { 'Content-Type': 'multipart/form-data' }, body: 'no-boundary' },
      { headers: { 'Content-Type': 'multipart/form-data; boundary=test' }, body: '--test\r\nContent-Disposition: form-data; name="' + route.field + '"; filename="a.png"\r\nContent-Type: image/png\r\n\r\ntruncated' },
    ]) {
      const rejected = await request(route.url, { method: 'POST', ...payload }, route.token);
      assert.equal(rejected.status, 400);
      assert.equal((await rejected.json()).code, 'INVALID_MULTIPART');
      await alive();
    }
  }
});

test('aborted multipart request does not crash the API', async () => {
  await new Promise((resolve, reject) => {
    const req = http.request(base + '/uploads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'multipart/form-data; boundary=abort-test', 'Content-Length': 100000 },
    });
    req.on('error', err => err.code === 'ECONNRESET' ? resolve() : reject(err));
    req.on('close', resolve);
    req.write('--abort-test\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\nContent-Type: image/png\r\n\r\npartial');
    setTimeout(() => req.destroy(), 30);
  });
  await alive();
});
