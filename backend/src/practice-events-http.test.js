import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import express from 'express';
import pg from 'pg';

test('practice events: real HTTP retries commit one attempt and preserve identity', {
  skip: !process.env.TEST_DATABASE_URL, timeout: 60000,
}, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
  const schema = 'practice_events_test_' + randomUUID().replaceAll('-', '');
  const control = new pg.Client({ connectionString: url.href });
  await control.connect();
  await control.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
  url.searchParams.set('options', `-c search_path=${schema} -c statement_timeout=15000`);
  process.env.DATABASE_URL = url.href;
  process.env.JWT_ACCESS_SECRET = 'practice-events-test-only';
  process.env.ADMIN_EMAILS = '';
  const { db } = await import('./db.js');
  let server;
  t.after(async () => {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await db.end();
    await control.query(`DROP SCHEMA ${schema} CASCADE`);
    await control.end();
  });
  await control.query(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  const migration = fs.readFileSync(new URL('../migrations/210_practice_attempt_events.sql', import.meta.url), 'utf8');
  await control.query(migration);
  await control.query(migration);
  const user = randomUUID(), other = randomUUID(), course = randomUUID();
  const module = randomUUID(), lesson = randomUUID(), item = randomUUID();
  await control.query(`INSERT INTO users(id,google_id,email,full_name)
    VALUES($1,'practice-events1','practice-events1@example.invalid','Practice Test'),
          ($2,'practice-events2','practice-events2@example.invalid','Other')`, [user, other]);
  await control.query(`INSERT INTO courses(id,slug,title,is_published) VALUES($1,'practice-test','Practice Test',true)`, [course]);
  await control.query(`INSERT INTO modules(id,course_id,slug,title,sort_order) VALUES($1,$2,'practice-test','Practice Test',1)`, [module, course]);
  await control.query(`INSERT INTO lessons(id,module_id,slug,title,type) VALUES($1,$2,'practice-test','Practice Test','kana')`, [lesson, module]);
  await control.query(`INSERT INTO kana_items(id,character,kind,romaji) VALUES($1,'あ','hiragana','a')`, [item]);
  await control.query(`INSERT INTO lesson_kana_items(lesson_id,kana_id) VALUES($1,$2)`, [lesson, item]);
  await control.query(`INSERT INTO user_enrollments(user_id,course_id,status) VALUES($1,$3,'active'),($2,$3,'active')`, [user, other, course]);
  const { signAccessToken } = await import('./auth.js');
  const { default: practice } = await import('./routes/practice.js');
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    if (req.headers['x-test-lose-ack']) {
      const json = res.json.bind(res);
      res.json = body => { if (res.statusCode === 201) { req.socket.destroy(); return res; } return json(body); };
    }
    next();
  });
  app.use('/practice', practice);
  app.use((error, req, res, next) => res.status(500).json({ error: 'test_server_error' }));
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = await signAccessToken(user, 'practice-events1@example.invalid');
  const otherToken = await signAccessToken(other, 'practice-events2@example.invalid');
  const payload = skill => ({ itemType: 'kana', itemId: item, lessonId: lesson, skill,
    isCorrect: true, source: 'lesson_drill', eventId: randomUUID(), expectedUserId: user });
  const call = async (body, { auth = token, loseAck = false } = {}) => {
    const response = await fetch(`${base}/practice/attempts`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
        ...(loseAck ? { 'X-Test-Lose-Ack': 'yes' } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const counts = async (skill, owner = user) => (await control.query(`SELECT
    (SELECT count(*)::int FROM practice_attempts WHERE user_id=$1 AND skill=$2) AS attempts,
    (SELECT count(*)::int FROM practice_attempt_events WHERE user_id=$1 AND request->>'skill'=$2) AS receipts,
    (SELECT attempts FROM user_practice_state WHERE user_id=$1 AND skill=$2) AS state_attempts`, [owner, skill])).rows[0];

  await t.test('lost successful response retries the committed receipt without new evidence', async () => {
    const body = payload('lost-ack');
    await assert.rejects(call(body, { loseAck: true }), /fetch failed/);
    assert.deepEqual(await counts(body.skill), { attempts: 1, receipts: 1, state_attempts: 1 });
    const retry = await call(body);
    assert.equal(retry.status, 201); assert.equal(retry.body.state.attempts, 1);
    assert.deepEqual(await call(body), retry);
    assert.deepEqual(await counts(body.skill), { attempts: 1, receipts: 1, state_attempts: 1 });
  });
  await t.test('concurrent tabs sharing an event append once and return the same snapshot', async () => {
    const body = payload('concurrent');
    const results = await Promise.all(Array.from({ length: 8 }, () => call(body)));
    assert.equal(results[0].status, 201);
    for (const result of results) assert.deepEqual(result, results[0]);
    assert.deepEqual(await counts(body.skill), { attempts: 1, receipts: 1, state_attempts: 1 });
    assert.equal((await call({ ...body, isCorrect: false })).status, 409);
    assert.equal((await call({ ...body, skill: 'conflicting-skill' })).status, 409);
    assert.deepEqual(await counts('conflicting-skill'), { attempts: 0, receipts: 0, state_attempts: null });
    const second = await call({ ...body, eventId: randomUUID() });
    assert.equal(second.body.state.attempts, 2);
    assert.deepEqual(await call(body), results[0], 'replay returns the original acknowledgement after later answers');
  });
  await t.test('legacy callers without event IDs retain independent attempt behavior', async () => {
    const body = payload('legacy'); delete body.eventId;
    assert.equal((await call(body)).body.state.attempts, 1);
    assert.equal((await call(body)).body.state.attempts, 2);
    assert.deepEqual(await counts(body.skill), { attempts: 2, receipts: 0, state_attempts: 2 });
  });
  await t.test('identity and entitlement are checked before writes, event IDs are user scoped', async () => {
    const body = payload('identity');
    assert.equal((await call(body, { auth: null })).status, 401);
    assert.equal((await call(body, { auth: otherToken })).status, 409);
    assert.equal((await call({ ...body, eventId: 'broken-id' })).status, 400);
    assert.deepEqual(await counts(body.skill), { attempts: 0, receipts: 0, state_attempts: null });
    assert.equal((await call(body)).status, 201);
    assert.equal((await call({ ...body, expectedUserId: other }, { auth: otherToken })).status, 201);
    assert.deepEqual(await counts(body.skill, other), { attempts: 1, receipts: 1, state_attempts: 1 });
    await control.query(`UPDATE user_enrollments SET expires_at=NOW()-INTERVAL '1 day' WHERE user_id=$1`, [other]);
    assert.equal((await call({ ...payload('forbidden'), expectedUserId: other }, { auth: otherToken })).status, 403);
    assert.deepEqual(await counts('forbidden', other), { attempts: 0, receipts: 0, state_attempts: null });
    assert.equal((await call({ ...payload('absent'), itemId: randomUUID() })).status, 404);
  });
  await t.test('receipt failure rolls back both attempt and FSRS state, then retry succeeds', async () => {
    const body = payload('rollback');
    await control.query(`CREATE FUNCTION reject_test_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.request->>'skill' = 'rollback' THEN RAISE EXCEPTION 'receipt unavailable'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_test_receipt BEFORE INSERT ON practice_attempt_events FOR EACH ROW EXECUTE FUNCTION reject_test_receipt()`);
    assert.equal((await call(body)).status, 500);
    assert.deepEqual(await counts(body.skill), { attempts: 0, receipts: 0, state_attempts: null });
    await control.query('DROP TRIGGER reject_test_receipt ON practice_attempt_events');
    assert.equal((await call(body)).status, 201);
    assert.deepEqual(await counts(body.skill), { attempts: 1, receipts: 1, state_attempts: 1 });
  });
  await t.test('delayed evidence uses server receipt time and ignores client timestamps', async () => {
    const earliest = Date.now();
    const body = { ...payload('server-time'), occurredAt: '1900-01-01T00:00:00Z',
      createdAt: '2100-01-01T00:00:00Z', assisted: false };
    const result = await call(body);
    assert.equal(result.status, 201);
    const row = (await control.query('SELECT created_at FROM practice_attempts WHERE user_id=$1 AND skill=$2', [user, body.skill])).rows[0];
    assert.ok(new Date(row.created_at).getTime() >= earliest - 1000);
    assert.ok(new Date(result.body.state.lastSeenAt).getTime() >= earliest - 1000);
    assert.ok(new Date(result.body.state.lastSeenAt).getTime() <= Date.now() + 1000);
  });
  await t.test('account erasure cascades durable receipts along with learning evidence', async () => {
    await control.query('DELETE FROM users WHERE id=$1', [other]);
    assert.equal((await control.query('SELECT count(*)::int n FROM practice_attempt_events WHERE user_id=$1', [other])).rows[0].n, 0);
    assert.ok((await control.query('SELECT count(*)::int n FROM practice_attempt_events WHERE user_id=$1', [user])).rows[0].n > 0);
  });
});
