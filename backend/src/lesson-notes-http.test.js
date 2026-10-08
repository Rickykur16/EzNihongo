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
const moduleId = '33333333-3333-4333-8333-333333333333';
const courseId = '44444444-4444-4444-8444-444444444444';
const futureModuleId = '55555555-5555-4555-8555-555555555555';
const futureLessonId = '66666666-6666-4666-8666-666666666666';
const lesson = {
  id: lessonId,
  module_id: moduleId,
  slug: 'materi',
  title: 'Materi',
  type: 'text',
  content: '<p>先</p>',
  video_url: 'https://old.invalid/embed',
  video_source_id: null,
  video_start_seconds: null,
  video_end_seconds: null,
  updated_at: '2026-09-27T00:00:00.000Z',
};
const updates = [];

mock.method(db, 'connect', async () => ({
  async query(sql, params = []) {
    if (/^(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)/.test(sql)) return { rows: [] };
    if (sql.includes('SELECT * FROM lessons WHERE id=')) return { rows: [{ ...lesson }] };
    if (sql.includes('SELECT c.id,c.curriculum_boundary_mode')) {
      return { rows: [{ id: courseId, mode: 'enforce', module_id: moduleId }] };
    }
    if (sql.includes('WITH RECURSIVE required(id)')) return { rows: [{ id: courseId }] };
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
    if (sql.includes('boundary:courses')) return { rows: [{
      id: courseId, slug: 'n5', level: 'N5', curriculum_boundary_mode: 'enforce',
    }] };
    if (sql.includes('boundary:edges')) return { rows: [] };
    if (sql.includes('boundary:scope-lesson')) return { rows: [{ ...lesson }] };
    if (sql.includes('boundary:scope-module')) {
      return { rows: [{ id: moduleId, course_id: courseId, sort_order: 1, title: 'Bab 1' }] };
    }
    if (sql.includes('boundary:modules')) return { rows: [
      { id: moduleId, course_id: courseId, sort_order: 1, title: 'Bab 1' },
      { id: futureModuleId, course_id: courseId, sort_order: 2, title: 'Bab 2' },
    ] };
    if (sql.includes('boundary:lessons')) return { rows: [{ ...lesson }, {
      id: futureLessonId, module_id: futureModuleId, slug: 'future', type: 'text',
    }] };
    if (sql.includes('boundary:kanji')) return { rows: [{
      id: '77777777-7777-4777-8777-777777777777', lesson_id: futureLessonId,
      character: '先', meaning_id: 'depan', on_reading: 'セン', kun_reading: 'さき',
    }] };
    if (sql.includes('boundary:vocabulary') || sql.includes('boundary:grammar') ||
        sql.includes('boundary:decks') ||
        sql.includes('curriculum_boundary_auxiliary_terms')) return { rows: [] };
    if (sql.includes('INSERT INTO curriculum_boundary_reports')) return { rows: [], rowCount: 1 };
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
      if (params[22]) lesson.video_url = params[5];
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

  const cleared = await update({ title: 'Materi bersih', content: null });
  assert.equal(cleared.status, 200, JSON.stringify(cleared.body));
  assert.equal(cleared.body.lesson.title, 'Materi bersih');
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

  const clearedVideo = await update({ videoUrl: null });
  assert.equal(clearedVideo.status, 200);
  assert.equal(clearedVideo.body.lesson.video_url, null);
  assert.match(updates[2].sql, /video_url = CASE WHEN \$23::boolean THEN \$6 ELSE video_url END/);
  assert.equal(updates[2].params[22], true);
  lesson.video_url = 'https://retained.invalid/embed';
  assert.equal((await update({ title: 'Keep video' })).body.lesson.video_url, 'https://retained.invalid/embed');
  assert.equal(updates[3].params[22], false);
});
