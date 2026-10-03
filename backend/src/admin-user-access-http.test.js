import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';

test('admin access revocation through real HTTP and PostgreSQL', {
  skip: !process.env.TEST_DATABASE_URL, timeout: 60000,
}, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  assert.match(url.pathname, /test/i);
  assert.ok(!url.searchParams.has('host'));
  const { default: pg } = await import('pg');
  const { default: express } = await import('express');
  const schema = 'admin_access_http_' + randomUUID().replaceAll('-', '');
  const control = new pg.Client({ connectionString: url.href });
  await control.connect();
  let server, pool;
  t.after(async () => {
    try {
      if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    } finally {
      try { await pool?.end(); }
      finally {
        try { await control.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); }
        finally { await control.end(); }
      }
    }
  });
  await control.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
  url.searchParams.set('options', `-c search_path=${schema} -c statement_timeout=10000`);
  process.env.DATABASE_URL = url.href;
  process.env.JWT_ACCESS_SECRET = 'admin-access-http-test-access';
  process.env.JWT_REFRESH_SECRET = 'admin-access-http-test-refresh';
  process.env.ADMIN_EMAILS = 'owner@example.invalid';
  process.env.COMPANY_WORKSPACE_ENABLED = 'true';
  process.env.COMPANY_STAFF_ENABLED = 'true';
  process.env.TELEGRAM_BOT_TOKEN = '';
  process.env.TELEGRAM_ADMIN_CHAT_ID = '';
  process.env.ANTHROPIC_API_KEY = '';
  process.env.ELEVENLABS_API_KEY = '';
  process.env.OPENAI_API_KEY = '';

  await control.query(`
    CREATE TABLE users(id UUID PRIMARY KEY,email TEXT UNIQUE,full_name TEXT,created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE admin_emails(email TEXT PRIMARY KEY);
    CREATE TABLE courses(id UUID PRIMARY KEY,slug TEXT UNIQUE,title TEXT,description TEXT,level TEXT,thumbnail_url TEXT,
      is_published BOOLEAN DEFAULT TRUE,is_available BOOLEAN DEFAULT TRUE,sort_order INTEGER DEFAULT 0,created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE modules(id UUID PRIMARY KEY,course_id UUID REFERENCES courses(id));
    CREATE TABLE lessons(id UUID PRIMARY KEY,module_id UUID REFERENCES modules(id));
    CREATE TABLE user_enrollments(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID REFERENCES users(id),
      course_id UUID REFERENCES courses(id),enrolled_at TIMESTAMPTZ DEFAULT NOW(),UNIQUE(user_id,course_id));
    CREATE TABLE user_progress(user_id UUID REFERENCES users(id),lesson_id UUID REFERENCES lessons(id),
      completed BOOLEAN,completed_at TIMESTAMPTZ,note TEXT,updated_at TIMESTAMPTZ DEFAULT NOW(),PRIMARY KEY(user_id,lesson_id));
  `);
  for (const file of ['120_course_entitlements.sql', '121_course_orders.sql']) {
    await control.query(await readFile(new URL('../migrations/' + file, import.meta.url), 'utf8'));
  }
  await control.query(await readFile(new URL('../contracts/staff-schema-v1.sql', import.meta.url), 'utf8'));
  const ids = Object.fromEntries(['owner', 'student', 'other'].map(key => [key, randomUUID()]));
  for (const [key, id] of Object.entries(ids)) {
    await control.query('INSERT INTO users(id,email,full_name) VALUES($1,$2,$3)', [id, key + '@example.invalid', key]);
  }
  const courses = Object.fromEntries(['target', 'unrelated', 'notEnrolled'].map(key => [key, {
    id: randomUUID(), moduleId: randomUUID(), lessonId: randomUUID(), slug: 'fixture-' + key.toLowerCase(),
  }]));
  for (const course of Object.values(courses)) {
    await control.query('INSERT INTO courses(id,slug,title,is_free) VALUES($1,$2,$2,TRUE)', [course.id, course.slug]);
    await control.query('INSERT INTO modules VALUES($1,$2)', [course.moduleId, course.id]);
    await control.query('INSERT INTO lessons VALUES($1,$2)', [course.lessonId, course.moduleId]);
  }
  for (const [who, key] of [['student', 'target'], ['student', 'unrelated'], ['other', 'target'], ['owner', 'target']]) {
    await control.query("INSERT INTO user_enrollments(user_id,course_id,source) VALUES($1,$2,'admin_grant')", [ids[who], courses[key].id]);
    await control.query("INSERT INTO user_progress(user_id,lesson_id,completed,completed_at,note) VALUES($1,$2,TRUE,NOW(),'Progress must survive revocation')", [ids[who], courses[key].lessonId]);
  }

  const { db } = await import('./db.js'); pool = db;
  const { signAccessToken } = await import('./auth.js');
  const { default: admin } = await import('./routes/admin.js');
  const { default: progress } = await import('./routes/progress.js');
  const tokens = Object.fromEntries(await Promise.all(Object.entries(ids).map(async ([who, id]) => [who, await signAccessToken(id, who + '@example.invalid')])));
  const app = express();
  app.use(express.json()); app.use('/api/admin', admin); app.use('/api', progress);
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message, code: err.code }));
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}/api`;
  async function request(who, path, body) {
    const response = await fetch(origin + path, {
      method: body === undefined ? 'GET' : 'POST', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', ...(who ? { Authorization: 'Bearer ' + tokens[who] } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, data: await response.json() };
  }
  const revoke = (email, courseId, who = 'owner') => request(who, '/admin/user-access/revoke', { email, courseId });
  const enrollments = async () => (await control.query('SELECT * FROM user_enrollments ORDER BY id')).rows;
  const learning = async () => (await control.query('SELECT * FROM user_progress ORDER BY user_id,lesson_id')).rows;
  const gated = (who, course = courses.target) => request(who, '/progress/lesson/' + course.lessonId);
  const studentEmail = 'student@example.invalid';

  await t.test('authorization and invalid requests leave all enrollment and learning rows untouched', async () => {
    const before = await enrollments(), progressBefore = await learning();
    const unauthenticated = await revoke(studentEmail, courses.target.id, null);
    assert.equal(unauthenticated.status, 401);
    const student = await revoke(studentEmail, courses.target.id, 'student');
    assert.equal(student.status, 403); assert.equal(student.data.error, 'staff_permission_required');
    for (const [body, status, error] of [
      [{ courseId: courses.target.id }, 400, 'email_required'],
      [{ email: studentEmail }, 400, 'course_required'],
      [{ email: 'missing@example.invalid', courseId: courses.target.id }, 404, 'user_not_found'],
      [{ email: studentEmail, courseId: courses.notEnrolled.id }, 404, 'enrollment_not_found'],
    ]) {
      const result = await request('owner', '/admin/user-access/revoke', body);
      assert.equal(result.status, status); assert.equal(result.data.error, error);
    }
    assert.deepEqual(await enrollments(), before); assert.deepEqual(await learning(), progressBefore);
  });

  await t.test('revoking one course immediately removes student access without deleting history or another entitlement', async () => {
    const before = await enrollments(), progressBefore = await learning();
    const original = before.find(row => row.user_id === ids.student && row.course_id === courses.target.id);
    const listedBefore = await request('student', '/enrollments/me');
    assert.equal(listedBefore.status, 200);
    assert.deepEqual(listedBefore.data.enrollments.map(row => row.id).sort(), [courses.target.id, courses.unrelated.id].sort());
    assert.equal((await gated('student')).status, 200);
    const result = await revoke('  STUDENT@EXAMPLE.INVALID  ', courses.target.id);
    assert.equal(result.status, 200); assert.deepEqual(result.data, { ok: true });
    const after = await enrollments(), revoked = after.find(row => row.id === original.id);
    assert.equal(revoked.status, 'revoked'); assert.ok(revoked.revoked_at instanceof Date);
    assert.deepEqual({ ...revoked, status: original.status, revoked_at: original.revoked_at }, original);
    assert.deepEqual(after.filter(row => row.id !== original.id), before.filter(row => row.id !== original.id));
    assert.deepEqual(await learning(), progressBefore);
    const listedAfter = await request('student', '/enrollments/me');
    assert.equal(listedAfter.status, 200);
    assert.deepEqual(listedAfter.data.enrollments.map(row => row.id), [courses.unrelated.id]);
    const denied = await gated('student');
    assert.equal(denied.status, 403); assert.equal(denied.data.error, 'not_enrolled');
    assert.equal((await gated('student', courses.unrelated)).status, 200);
    assert.equal((await gated('other')).status, 200);
    const selfEnroll = await request('student', '/enrollments', { courseSlug: courses.target.slug });
    assert.equal(selfEnroll.status, 403); assert.equal(selfEnroll.data.error, 'access_revoked');
    assert.deepEqual(await enrollments(), after); assert.deepEqual(await learning(), progressBefore);
    const adminView = await request('owner', '/admin/user-access?email=' + encodeURIComponent(studentEmail));
    assert.equal(adminView.status, 200);
    assert.equal(adminView.data.enrollments.find(row => row.course_id === courses.target.id).status, 'revoked');
    const again = await revoke(studentEmail, courses.target.id);
    assert.equal(again.status, 404); assert.equal(again.data.error, 'enrollment_not_found');
    assert.deepEqual(await enrollments(), after);
  });

  await t.test('an administrator retains the deliberate preview access independently of their revoked enrollment', async () => {
    assert.equal((await revoke('owner@example.invalid', courses.target.id)).status, 200);
    const row = (await control.query('SELECT status FROM user_enrollments WHERE user_id=$1 AND course_id=$2', [ids.owner, courses.target.id])).rows[0];
    assert.equal(row.status, 'revoked');
    const listed = await request('owner', '/enrollments/me');
    assert.equal(listed.status, 200);
    assert.ok(listed.data.enrollments.some(course => course.id === courses.target.id));
    assert.equal((await gated('owner')).status, 200);
  });
});
