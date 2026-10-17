import test, { after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';

process.env.JWT_ACCESS_SECRET = 'enrollment-mode-local-test';
process.env.ADMIN_EMAILS = '';
process.env.TELEGRAM_BOT_TOKEN = '';
process.env.COMPANY_WORKSPACE_ENABLED = 'false';
const { db } = await import('./db.js');
const { signAccessToken } = await import('./auth.js');
const { default: orders } = await import('./routes/orders.js');
const { default: progress } = await import('./routes/progress.js');
const { default: live } = await import('./routes/live-classes.js');
const student = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const courseId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let course, openOrder, enrolledMode, inserted;
async function query(sql, params = []) {
  if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql) || sql.includes('pg_advisory')) return { rows: [] };
  if (sql.includes('FROM courses')) return { rows: [course] };
  if (sql.includes('FROM admin_emails')) return { rows: [] };
  if (sql.includes('FROM user_enrollments')) {
    const liveAllowed = !sql.includes("learning_mode = 'bootcamp'") || enrolledMode === 'bootcamp';
    return { rows: enrolledMode && liveAllowed ? [{ id: 'existing', status: 'active' }] : [] };
  }
  if (sql.includes('FROM orders')) return { rows: openOrder ? [openOrder] : [] };
  if (sql.includes('FROM users')) return { rows: [{ id: student, email: 'student@example.invalid' }] };
  if (sql.includes('FROM user_marketing_profile')) return { rows: [{ strategy_version: 2, japanese_level: 'n5' }] };
  if (sql.includes('FROM app_settings')) return { rows: [] };
  if (sql.includes('INSERT INTO orders')) {
    inserted = params;
    return { rows: [{ id: 'order-1', order_number: params[0], course_id: courseId,
      course_title_snapshot: params[3], amount_idr: params[4], learning_mode: params[5], payment_provider: params[6],
      status: 'pending_payment', expires_at: new Date(Date.now() + 86400000) }] };
  }
  if (sql.includes('FROM live_classes')) return { rows: [] };
  throw Error('Unexpected test query: ' + sql);
}
mock.method(db, 'query', query);
mock.method(db, 'connect', async () => ({ query, release() {} }));
const app = express(); app.use(express.json()); app.use('/api', orders); app.use('/api', progress); app.use('/api/live-classes', live);
app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
const token = await signAccessToken(student, 'student@example.invalid');
async function request(path, body) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
    method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json() };
}
beforeEach(() => {
  course = { id: courseId, slug: 'n5', title: 'N5', is_published: true, is_available: true,
    is_free: false, price_idr: 799000, self_learning_enabled: true, self_learning_price_idr: 249000, bootcamp_enabled: true };
  openOrder = enrolledMode = inserted = null;
});
after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await db.end(); });

test('checkout ignores client prices and snapshots the chosen program', async () => {
  const result = await request('/orders', { courseSlug: 'n5', learningMode: 'self_learning', amountIdr: 1, priceIdr: 1 });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  assert.equal(result.data.order.amountIdr, 249000);
  assert.equal(result.data.order.learningMode, 'self_learning');
  assert.equal(result.data.order.paymentProvider, 'midtrans');
  assert.match(result.data.order.courseTitle, /Self Learning/);
  assert.equal(inserted[5], 'self_learning');
  const bootcamp = await request('/orders', { courseSlug: 'n5', learningMode: 'bootcamp' });
  assert.equal(bootcamp.data.order.amountIdr, 799000);
  assert.equal(bootcamp.data.order.paymentProvider, 'manual_transfer');
});
test('paid Self Learning cannot bypass payment through the free enrollment endpoint', async () => {
  course.is_free = true;
  const result = await request('/enrollments', { courseSlug: 'n5', learningMode: 'self_learning' });
  assert.equal(result.status, 403); assert.equal(result.data.error, 'payment_required');
});
test('closed modes and malformed modes cannot create an order', async () => {
  course.self_learning_enabled = false;
  assert.equal((await request('/orders', { courseSlug: 'n5', learningMode: 'self_learning' })).data.error, 'learning_mode_unavailable');
  assert.equal((await request('/orders', { courseSlug: 'n5', learningMode: 'other' })).data.error, 'invalid_learning_mode');
  assert.equal(inserted, null);
});
test('an open order for a different mode is not silently reused', async () => {
  openOrder = { learning_mode: 'bootcamp' };
  const result = await request('/orders', { courseSlug: 'n5', learningMode: 'self_learning' });
  assert.equal(result.status, 409); assert.equal(result.data.error, 'order_mode_conflict');
});
test('only Bootcamp entitlements expose live classes; both modes retain course access', async () => {
  enrolledMode = 'self_learning';
  assert.equal((await request('/live-classes?course=n5')).status, 403);
  const { userCanAccessCourse } = await import('./entitlements.js');
  assert.equal(await userCanAccessCourse({ id: student, email: 'student@example.invalid' }, courseId), true);
  enrolledMode = 'bootcamp';
  assert.equal((await request('/live-classes?course=n5')).status, 200);
});
