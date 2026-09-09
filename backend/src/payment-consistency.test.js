import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import express from 'express';
import pg from 'pg';

// Opt in with a disposable LOCAL database. Never fall back to DATABASE_URL.
// Each run owns a unique schema; production tables/credentials are not used.
test('payment HTTP transactions on PostgreSQL', {
  skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL to run PostgreSQL integration tests',
  timeout: 60000,
}, async (t) => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Test DB must be local');
  const schema = 'payment_test_' + randomUUID().replaceAll('-', '');
  const control = new pg.Client({ connectionString: url.href });
  await control.connect();
  await control.query(`CREATE SCHEMA ${schema}`);
  await control.query(`SET search_path TO ${schema}`);
  url.searchParams.set('options', `-c search_path=${schema} -c statement_timeout=10000`);
  url.searchParams.set('application_name', schema);
  process.env.DATABASE_URL = url.href;
  process.env.JWT_ACCESS_SECRET = 'local-payment-test-access';
  process.env.JWT_REFRESH_SECRET = 'local-payment-test-refresh';
  process.env.ADMIN_EMAILS = 'admin@example.invalid';
  process.env.TELEGRAM_BOT_TOKEN = '';
  process.env.TELEGRAM_ADMIN_CHAT_ID = '';
  process.env.ANTHROPIC_API_KEY = '';
  process.env.ELEVENLABS_API_KEY = '';
  const { db } = await import('./db.js');
  let server;
  t.after(async () => {
    await control.query('SELECT pg_advisory_unlock_all()');
    if (server) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
    await db.end();
    await control.query(`DROP SCHEMA ${schema} CASCADE`);
    await control.end();
  });
  await control.query(`
    CREATE TABLE users (id uuid PRIMARY KEY, email text, full_name text);
    CREATE TABLE courses (id uuid PRIMARY KEY, slug text);
    CREATE TABLE user_enrollments (
      user_id uuid REFERENCES users(id), course_id uuid REFERENCES courses(id),
      PRIMARY KEY(user_id, course_id)
    );
    CREATE TABLE admin_emails (email text);
  `);
  for (const migration of ['120_course_entitlements.sql', '121_course_orders.sql']) {
    await control.query(await readFile(new URL('../migrations/' + migration, import.meta.url), 'utf8'));
  }
  // A test-only trigger pauses a winning writer AFTER it acquires the order
  // row. The other request must wait on that row before either can proceed.
  await control.query(`
    CREATE TABLE test_gate (pause_status text, fail_enrollment boolean, fail_proof boolean);
    INSERT INTO test_gate VALUES ('', false, false);
    CREATE FUNCTION pause_order() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.status = (SELECT pause_status FROM test_gate) THEN
        PERFORM pg_advisory_xact_lock(hashtext('${schema}'));
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER pause_order BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION pause_order();
    CREATE FUNCTION fail_test_write() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF (TG_TABLE_NAME = 'user_enrollments' AND (SELECT fail_enrollment FROM test_gate))
         OR (TG_TABLE_NAME = 'order_payments' AND (SELECT fail_proof FROM test_gate)) THEN
        RAISE EXCEPTION 'forced test write failure';
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER fail_enrollment BEFORE INSERT ON user_enrollments FOR EACH ROW EXECUTE FUNCTION fail_test_write();
    CREATE TRIGGER fail_proof BEFORE INSERT ON order_payments FOR EACH ROW EXECUTE FUNCTION fail_test_write();
  `);
  const student = randomUUID(), admin = randomUUID(), stranger = randomUUID(), course = randomUUID();
  await control.query('INSERT INTO users VALUES ($1, $2, $2), ($3, $4, $4), ($5, $6, $6)',
    [student, 'student@example.invalid', admin, 'admin@example.invalid', stranger, 'stranger@example.invalid']);
  await control.query('INSERT INTO courses VALUES ($1, $2)', [course, 'n5']);
  const { signAccessToken } = await import('./auth.js');
  const { default: orders } = await import('./routes/orders.js');
  const { default: adminOrders } = await import('./routes/admin.js');
  const tokens = {
    student: await signAccessToken(student, 'student@example.invalid'),
    admin: await signAccessToken(admin, 'admin@example.invalid'),
    stranger: await signAccessToken(stranger, 'stranger@example.invalid'),
  };
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use('/api/admin', adminOrders);
  app.use('/api', orders);
  app.use((err, req, res, next) => res.status(500).json({ error: 'test_internal_error' }));
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let requestIndex = 0;
  async function request(path, body, who = 'admin') {
    const multipart = body instanceof FormData;
    const res = await fetch(base + path, {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${tokens[who]}`, 'X-Forwarded-For': `192.0.2.${++requestIndex}`,
        ...(!multipart && { 'Content-Type': 'application/json' }) },
      body: multipart ? body : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  }
  function upload(order, who = 'student') {
    const body = new FormData();
    body.append('file', new Blob(['test-proof'], { type: 'image/png' }), 'proof.png');
    return request(`/orders/${order}/payment-proof`, body, who);
  }
  const approve = (o, p) => request(`/admin/orders/${o}/approve`, { paymentId: p });
  const reject = (o, p) => request(`/admin/orders/${o}/reject`, { paymentId: p, reason: 'Nominal tidak sesuai' });
  const cancel = o => request(`/orders/${o}/cancel`, {}, 'student');
  async function fixture(status = 'awaiting_review') {
    await control.query("UPDATE test_gate SET pause_status = '', fail_enrollment = false, fail_proof = false");
    await control.query('DELETE FROM user_enrollments');
    const order = randomUUID(), payment = randomUUID();
    await control.query(`INSERT INTO orders (id, order_number, user_id, course_id, course_title_snapshot, amount_idr, status, expires_at)
      VALUES ($1::uuid, $1::text, $2, $3, 'Test N5', 349000, $4, clock_timestamp() + interval '1 day')`, [order, student, course, status]);
    await control.query(`INSERT INTO order_payments (id, order_id, submitted_by, proof_mime) VALUES ($1, $2, $3, 'image/png')`, [payment, order, student]);
    return { order, payment };
  }
  async function state(order) {
    const o = (await control.query('SELECT status, approved_at FROM orders WHERE id = $1', [order])).rows[0];
    const payments = (await control.query('SELECT id, status, reviewed_by, rejection_reason FROM order_payments WHERE order_id = $1', [order])).rows;
    const grants = (await control.query('SELECT * FROM user_enrollments WHERE order_id = $1', [order])).rows;
    return { ...o, payments, grants };
  }
  async function waitForBlocked(count) {
    for (let i = 0; i < 250; i++) {
      const r = await control.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name = $1 AND wait_event_type = 'Lock'", [schema]);
      if (r.rows[0].n >= count) return;
      await delay(20);
    }
    assert.fail(`Expected ${count} blocked payment writers`);
  }
  async function race(firstStatus, first, second) {
    await control.query('UPDATE test_gate SET pause_status = $1', [firstStatus]);
    await control.query('SELECT pg_advisory_lock(hashtext($1))', [schema]);
    const requests = [];
    try {
      requests.push(first());
      await waitForBlocked(1);
      requests.push(second());
      await waitForBlocked(2);
    } finally {
      await control.query('SELECT pg_advisory_unlock_all()');
      await Promise.allSettled(requests);
      await control.query("UPDATE test_gate SET pause_status = ''");
    }
    return Promise.all(requests);
  }

  await t.test('requires an explicit valid payment ID and preserves authorization', async () => {
    const { order, payment } = await fixture();
    for (const action of ['approve', 'reject']) {
      for (const paymentId of [undefined, 'bad-id', [payment]]) {
        assert.equal((await request(`/admin/orders/${order}/${action}`, { paymentId, reason: 'test' })).status, 400);
      }
      assert.equal((await request(`/admin/orders/${order}/${action}`, { paymentId: payment, reason: 'test' }, 'student')).status, 403);
    }
    assert.equal((await upload(order, 'stranger')).status, 403);
    assert.equal((await request(`/orders/${order}/cancel`, {}, 'stranger')).status, 403);
    assert.equal((await state(order)).status, 'awaiting_review');
  });
  await t.test('stale/foreign proof cannot be reviewed; current approval and retry are consistent', async () => {
    const { order, payment } = await fixture();
    const fresh = await upload(order);
    assert.equal(fresh.status, 201);
    for (const proof of [payment, randomUUID()]) {
      assert.equal((await approve(order, proof)).status, 409);
      assert.equal((await reject(order, proof)).status, 409);
    }
    const other = await fixture();
    assert.equal((await approve(order, other.payment)).status, 409);
    assert.equal((await state(order)).status, 'awaiting_review');
    assert.equal((await approve(order, fresh.body.payment.id)).status, 200);
    assert.equal((await approve(order, fresh.body.payment.id)).status, 409);
    const s = await state(order);
    assert.equal(s.status, 'approved');
    assert.equal(s.grants.length, 1);
    assert.equal(s.grants[0].source, 'purchase');
    assert.equal(s.payments.find(p => p.id === fresh.body.payment.id).reviewed_by, admin);
  });
  for (const [label, firstStatus, first, second, expected, finalStatus, pending, grants] of [
    ['approve then upload', 'approved', approve, upload, [200, 409], 'approved', 0, 1],
    ['upload then stale approve', 'awaiting_review', upload, approve, [201, 409], 'awaiting_review', 1, 0],
    ['two uploads', 'awaiting_review', upload, upload, [201, 201], 'awaiting_review', 1, 0],
    ['cancel then upload', 'cancelled', cancel, upload, [200, 409], 'cancelled', 1, 0],
    ['upload then cancel', 'awaiting_review', upload, cancel, [201, 200], 'cancelled', 1, 0],
    ['two approvals', 'approved', approve, approve, [200, 409], 'approved', 0, 1],
    ['approve then reject', 'approved', approve, reject, [200, 409], 'approved', 0, 1],
    ['reject then approve', 'rejected', reject, approve, [200, 409], 'rejected', 0, 0],
    ['reject then upload', 'rejected', reject, upload, [200, 201], 'awaiting_review', 1, 0],
    ['upload then stale reject', 'awaiting_review', upload, reject, [201, 409], 'awaiting_review', 1, 0],
  ]) {
    await t.test(`concurrent ${label}`, async () => {
      const { order, payment } = await fixture();
      // Upload's optional argument is an identity, so pass only the order.
      const invoke = fn => fn === upload || fn === cancel ? fn(order) : fn(order, payment);
      const results = await race(firstStatus, () => invoke(first), () => invoke(second));
      assert.deepEqual(results.map(r => r.status), expected, JSON.stringify(results));
      const s = await state(order);
      assert.equal(s.status, finalStatus);
      assert.equal(s.payments.filter(p => p.status === 'pending').length, pending);
      assert.equal(s.grants.length, grants);
      assert.equal(s.payments.filter(p => p.status === 'approved').length, grants);
    });
  }
  await t.test('failed enrollment/proof writes roll back the entire transition', async () => {
    const { order, payment } = await fixture();
    await control.query('UPDATE test_gate SET fail_enrollment = true');
    assert.equal((await approve(order, payment)).status, 500);
    let s = await state(order);
    assert.equal(s.status, 'awaiting_review');
    assert.equal(s.approved_at, null);
    assert.equal(s.payments[0].status, 'pending');
    assert.equal(s.payments[0].reviewed_by, null);
    assert.equal(s.grants.length, 0);
    await control.query('UPDATE test_gate SET fail_enrollment = false, fail_proof = true');
    assert.equal((await upload(order)).status, 500);
    s = await state(order);
    assert.equal(s.payments.length, 1);
    assert.equal(s.payments[0].status, 'pending');
    await control.query('UPDATE test_gate SET fail_proof = false');
    assert.equal((await approve(order, payment)).status, 200);
  });
  await t.test('expired and terminal orders do not reopen or grant access', async () => {
    for (const status of ['expired', 'approved', 'cancelled']) {
      const { order, payment } = await fixture(status === 'expired' ? 'awaiting_review' : status);
      if (status === 'expired') await control.query("UPDATE orders SET expires_at = clock_timestamp() - interval '1 second' WHERE id = $1", [order]);
      assert.equal((await upload(order)).status, 409);
      assert.equal((await approve(order, payment)).status, 409);
      assert.equal((await cancel(order)).status, 409);
      assert.equal((await state(order)).grants.length, 0);
    }
  });
});
