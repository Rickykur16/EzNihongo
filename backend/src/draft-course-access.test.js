import test, { after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';

process.env.JWT_ACCESS_SECRET = 'draft-course-local-test-secret';
process.env.ADMIN_EMAILS = 'admin@example.invalid';
const { db } = await import('./db.js');
const { signAccessToken, invalidateAdminEmailCache } = await import('./auth.js');
const { default: content } = await import('./routes/content.js');
const courseId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const lessonId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let published = false;
let enrolled = false;
let databaseAdmin = false;
let exists = true;
mock.method(db, 'query', async (sql, params = []) => {
  if (sql.includes('FROM admin_emails')) return { rows: databaseAdmin ? [{ email: 'student@example.invalid' }] : [] };
  if (sql.includes('FROM user_enrollments')) return { rows: enrolled ? [{ allowed: 1 }] : [] };
  if (sql.includes('FROM courses') && sql.includes('WHERE slug = $1')) {
    assert.match(sql, /is_published = TRUE OR \$2::boolean/);
    assert.equal(typeof params[1], 'boolean');
    return { rows: exists && (published || params[1]) ? [{ id: courseId, slug: 'n4', title: 'Kelas N4' }] : [] };
  }
  if (sql.includes('FROM lessons l') && sql.includes('WHERE l.id = $1')) {
    assert.match(sql, /c.is_published = TRUE OR \$2::boolean/);
    assert.equal(typeof params[1], 'boolean');
    return { rows: exists && (published || params[1]) ? [{ id: lessonId, course_id: courseId, type: 'text', content: 'Draft lesson' }] : [] };
  }
  if (sql.includes('FROM courses')) {
    assert.match(sql, /WHERE is_published = TRUE/);
    return { rows: published ? [{ id: courseId }] : [] };
  }
  if (sql.includes('FROM modules') || sql.includes('FROM app_settings')) return { rows: [] };
  throw new Error('Unexpected query: ' + sql);
});
const app = express();
app.use('/api', content);
app.use((err, req, res, next) => res.status(500).json({ error: err.message }));
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const admin = await signAccessToken(userId, 'admin@example.invalid');
const student = await signAccessToken(userId, 'student@example.invalid');
const request = (path, token) => fetch(base + path, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(5000) });
beforeEach(() => {
  published = enrolled = databaseAdmin = false;
  exists = true;
  invalidateAdminEmailCache();
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  await db.end();
});

for (const path of ['/api/courses/n4', `/api/lessons/${lessonId}`]) {
  test(`admin can preview draft ${path}`, async () => {
    const response = await request(path, admin);
    assert.equal(response.status, 200, JSON.stringify(await response.json()));
  });
  test(`database-listed admin can preview draft ${path}`, async () => {
    databaseAdmin = true;
    assert.equal((await request(path, student)).status, 200);
  });
  test(`draft ${path} stays hidden even from an enrolled student`, async () => {
    enrolled = true;
    assert.equal((await request(path + '?preview=true&admin=true', student)).status, 404);
  });
  test(`published ${path} still requires enrollment`, async () => {
    published = true;
    assert.equal((await request(path, student)).status, 403);
    enrolled = true;
    assert.equal((await request(path, student)).status, 200);
  });
  test(`missing ${path} remains 404 for admin`, async () => {
    exists = false;
    assert.equal((await request(path, admin)).status, 404);
  });
  test(`anonymous ${path} requires authentication`, async () => {
    assert.equal((await request(path)).status, 401);
  });
}
test('public catalog excludes draft courses, including for admins', async () => {
  for (const token of [undefined, admin]) {
    const response = await request('/api/courses', token);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).courses, []);
  }
});
