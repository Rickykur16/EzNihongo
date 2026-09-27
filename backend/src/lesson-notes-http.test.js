import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';

process.env.DATABASE_URL = '';
process.env.JWT_ACCESS_SECRET = 'lesson-notes-test-access';
process.env.JWT_REFRESH_SECRET = 'lesson-notes-test-refresh';
process.env.ADMIN_EMAILS = 'lesson-notes-admin@example.invalid';
process.env.COMPANY_STAFF_ENABLED = 'false';

const { db } = await import('./db.js');
const { signAccessToken } = await import('./auth.js');
const { default: admin } = await import('./routes/admin.js');

const lessonId = '11111111-1111-4111-8111-111111111111';
const lesson = {
  id: lessonId,
  slug: 'materi',
  title: 'Materi',
  type: 'text',
  content: '<p>Catatan lama</p>',
  video_source_id: null,
  video_start_seconds: null,
  video_end_seconds: null,
};
const updates = [];

mock.method(db, 'connect', async () => ({
  async query(sql, params = []) {
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [] };
    if (sql.includes('SELECT type, video_source_id')) return { rows: [{
      type: lesson.type,
      video_source_id: lesson.video_source_id,
      video_start_seconds: lesson.video_start_seconds,
      video_end_seconds: lesson.video_end_seconds,
    }] };
    if (sql.includes('UPDATE lessons SET')) {
      updates.push({ sql, params });
      if (params[1] != null) lesson.slug = params[1];
      if (params[2] != null) lesson.title = params[2];
      if (params[3] != null) lesson.type = params[3];
      if (params[20]) lesson.content = params[4];
      return { rows: [{ ...lesson }] };
    }
    throw new Error('Unexpected transaction query: ' + sql);
  },
  release() {},
}));

test('admin can clear lesson notes while omitted content remains unchanged', async t => {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', admin);
  app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    mock.restoreAll();
    await db.end();
  });

  const base = `http://127.0.0.1:${server.address().port}`;
  const token = await signAccessToken('22222222-2222-4222-8222-222222222222', 'lesson-notes-admin@example.invalid');
  const update = async body => {
    const response = await fetch(`${base}/api/admin/lessons/${lessonId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };

  const cleared = await update({ content: null });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.lesson.content, null);
  assert.equal(lesson.content, null);
  assert.match(updates[0].sql, /content = CASE WHEN \$21::boolean THEN \$5 ELSE content END/);
  assert.equal(updates[0].params[20], true);

  lesson.content = '<p>Catatan baru</p>';
  const partial = await update({ title: 'Materi diperbarui' });
  assert.equal(partial.status, 200);
  assert.equal(partial.body.lesson.title, 'Materi diperbarui');
  assert.equal(partial.body.lesson.content, '<p>Catatan baru</p>');
  assert.equal(updates[1].params[20], false);
});
