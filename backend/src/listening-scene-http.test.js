import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import express from 'express';
import pg from 'pg';

const sceneFixture = () => ({ schemaVersion: 1, enabled: false, backgroundKey: 'classroom', participants: [
  { characterKey: 'anna-wijaya', position: 'left', speaker: 'A', displayName: 'Dewi', voiceId: 'dewi-voice', voiceName: 'Dewi', profileVersion: 1, custom: true },
  { characterKey: 'hadi-pratama', position: 'right', speaker: 'B', displayName: 'Sari', voiceId: 'sari-voice', voiceName: 'Sari', profileVersion: 1, custom: true },
] });

test('listening scenes: admin round trip, private snapshots, legacy authorization and exact voice rendering', {
  skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL for PostgreSQL tests', timeout: 60000,
}, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  const schema = 'listening_scene_' + randomUUID().replaceAll('-', '');
  const control = new pg.Client({ connectionString: url.href });
  await control.connect();
  await control.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
  url.searchParams.set('options', `-c search_path=${schema} -c statement_timeout=10000`);
  process.env.DATABASE_URL = url.href;
  process.env.JWT_ACCESS_SECRET = 'listening-test-secret';
  process.env.JWT_REFRESH_SECRET = 'listening-test-refresh';
  process.env.ADMIN_EMAILS = 'listening-admin@example.invalid';
  process.env.COMPANY_STAFF_ENABLED = 'false';
  process.env.ELEVENLABS_API_KEY = 'test-not-a-real-key';
  for (const name of ['ELEVENLABS_VOICE_ID', 'ELEVENLABS_VOICE_FEMALE', 'ELEVENLABS_VOICE_MALE', 'ELEVENLABS_VOICE_NARRATOR']) process.env[name] = '';
  const { db } = await import('./db.js');
  const { signAccessToken } = await import('./auth.js');
  const { default: admin } = await import('./routes/admin.js');
  const { default: progress } = await import('./routes/progress.js');
  const { default: tts, ttsHashKey } = await import('./routes/tts.js');
  let server;
  t.after(async () => {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await db.end();
    await control.query(`DROP SCHEMA ${schema} CASCADE`); await control.end();
  });
  await control.query(await readFile(new URL('../schema.sql', import.meta.url), 'utf8'));
  await control.query(await readFile(new URL('../migrations/148_dialogue_speakers.sql', import.meta.url), 'utf8'));
  await control.query('ALTER TABLE quiz_questions DROP COLUMN audio_scene');
  const migration = await readFile(new URL('../migrations/167_listening_dialog_scenes.sql', import.meta.url), 'utf8');
  await control.query(migration); await control.query(migration);
  const user = randomUUID(), other = randomUUID(), course = randomUUID(), module = randomUUID(), lesson = randomUUID(), otherLesson = randomUUID();
  await control.query(`INSERT INTO users(id,google_id,email,full_name) VALUES ($1,'listening-user','listening-user@example.invalid','User'),($2,'listening-other','listening-other@example.invalid','Other')`, [user, other]);
  await control.query(`INSERT INTO courses(id,slug,title) VALUES ($1,'n5','N5')`, [course]);
  await control.query(`INSERT INTO modules(id,course_id,slug,title) VALUES ($1,$2,'bab3','Bab 3')`, [module, course]);
  await control.query(`INSERT INTO lessons(id,module_id,slug,title,type,cooldown_hours) VALUES ($1,$3,'listening','Listening','quiz',0),($2,$3,'other','Other','quiz',0)`, [lesson, otherLesson, module]);
  await control.query(`INSERT INTO user_enrollments(user_id,course_id,status) VALUES ($1,$3,'active'),($2,$3,'active')`, [user, other, course]);
  const realFetch = globalThis.fetch;
  let available = ['dewi-voice', 'sari-voice'], upstream = [];
  t.mock.method(globalThis, 'fetch', async (resource, options) => {
    const u = String(resource);
    if (!u.startsWith('https://api.elevenlabs.io/')) return realFetch(resource, options);
    upstream.push({ url: u, body: options?.body && JSON.parse(options.body) });
    if (u.endsWith('/voices')) return new Response(JSON.stringify({ voices: available.map(voice_id => ({ voice_id, name: voice_id })) }));
    return new Response(Buffer.from('audio:' + u.split('/text-to-speech/')[1].split('?')[0]), { headers: { 'Content-Type': 'audio/mpeg' } });
  });
  const app = express(); app.set('trust proxy', 1); app.use(express.json()); app.use('/api/admin', admin); app.use('/api', tts, progress);
  app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: err.message }); });
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const userToken = await signAccessToken(user, 'listening-user@example.invalid');
  const adminToken = await signAccessToken(user, 'listening-admin@example.invalid');
  const otherToken = await signAccessToken(other, 'listening-other@example.invalid');
  let requestCount = 1;
  async function request(path, body, method = 'POST', token = userToken) {
    const res = await fetch(base + path, { method, headers: { ...(token && { Authorization: `Bearer ${token}` }), 'Content-Type': 'application/json', 'X-Forwarded-For': `192.0.2.${requestCount++}` }, ...(method !== 'GET' && { body: JSON.stringify(body || {}) }) });
    return { status: res.status, cacheControl: res.headers.get('Cache-Control'), body: res.headers.get('Content-Type')?.includes('application/json') ? await res.json() : await res.text() };
  }
  const script = 'A: わたしはデウィです。\nB: わたしはサリです。';
  const input = () => ({ lessonId: lesson, question: 'Siapa yang menjawab?', questionCategory: 'listening', audioScript: script, audioScene: sceneFixture(), options: [{ text: 'Sari', isCorrect: true }, { text: 'Dewi' }] });
  let questionId;
  await t.test('admin validates scene, actual voices and effective script on partial updates', async () => {
    assert.equal((await request('/api/admin/quiz-questions', input(), 'POST', userToken)).status, 403);
    const bad = input(); bad.audioScene.participants[1].voiceId = 'missing-voice';
    assert.equal((await request('/api/admin/quiz-questions', bad, 'POST', adminToken)).status, 400);
    bad.audioScene = sceneFixture(); bad.audioScript = 'C: こんにちは。';
    assert.equal((await request('/api/admin/quiz-questions', bad, 'POST', adminToken)).status, 400);
    const created = await request('/api/admin/quiz-questions', input(), 'POST', adminToken);
    assert.equal(created.status, 201); questionId = created.body.question.id;
    assert.deepEqual(created.body.question.audio_scene, sceneFixture());
    const path = '/api/admin/quiz-questions/' + questionId;
    assert.equal((await request(path, { audioScript: 'C: こんにちは。' }, 'PUT', adminToken)).status, 400);
    assert.equal((await request(path, { questionCategory: 'grammar' }, 'PUT', adminToken)).status, 400);
    const edited = await request(path, { question: 'Nama penjawab?' }, 'PUT', adminToken);
    assert.deepEqual(edited.body.question.audio_scene, sceneFixture());
    assert.equal((await request(path, { audioScene: null }, 'PUT', adminToken)).body.question.audio_scene, null);
    assert.equal((await request(path, { audioScene: sceneFixture() }, 'PUT', adminToken)).status, 200);
  });
  let attemptToken;
  const audioPath = (token = attemptToken, q = questionId, l = lesson) => `/api/progress/lesson/${l}/quiz/audio/${q}?attemptToken=${token}`;
  await t.test('legacy start exposes only an audio pointer and private endpoint checks ownership and sampled membership', async () => {
    const started = await request(`/api/progress/lesson/${lesson}/quiz/start`);
    assert.equal(started.status, 200); attemptToken = started.body.attemptToken;
    const q = started.body.questions[0]; assert.equal(q.has_audio, true); assert.equal(q.audio_script, null);
    assert.doesNotMatch(JSON.stringify(started.body), /audio_scene|voiceId|voiceName|sari-voice|dewi-voice/);
    assert.equal((await request(audioPath(), null, 'GET', null)).status, 401);
    assert.equal((await request(audioPath(), null, 'GET', otherToken)).status, 404);
    assert.equal((await request(audioPath(attemptToken, randomUUID()), null, 'GET')).status, 404);
    assert.equal((await request(audioPath(attemptToken, questionId, otherLesson), null, 'GET')).status, 404);
    for (const endpoint of ['tts', 'tts/dialog']) assert.equal((await request(`/api/${endpoint}?text=${encodeURIComponent(script)}`, null, 'GET')).status, 403);
    upstream = [];
    const played = await request(audioPath(), null, 'GET');
    assert.equal(played.status, 200); assert.equal(played.cacheControl, 'private, no-store');
    assert.equal(played.body, 'audio:dewi-voiceaudio:sari-voice');
    assert.equal(upstream.filter(u => u.url.includes('/text-to-speech/')).length, 2);
    const count = upstream.length; assert.equal((await request(audioPath(), null, 'GET')).status, 200); assert.equal(upstream.length, count);
    await control.query(`UPDATE user_enrollments SET status='revoked' WHERE user_id=$1`, [user]);
    assert.equal((await request(audioPath(), null, 'GET')).status, 403);
    await control.query(`UPDATE user_enrollments SET status='active' WHERE user_id=$1`, [user]);
  });
  await t.test('immutable assessment snapshot wins over row/profile edits, voice swap invalidates cache', async () => {
    const token = randomUUID();
    const savedQuestion = (await control.query('SELECT * FROM quiz_questions WHERE id=$1', [questionId])).rows[0];
    const snapshot = { version: 'n5-assessment-v2', policy: { version: 'n5-assessment-v2' }, questions: [savedQuestion] };
    await control.query(`INSERT INTO quiz_attempts(user_id,lesson_id,attempt_token,sampled_question_ids,assessment_snapshot) VALUES ($1,$2,$3,$4,$5)`, [user, lesson, token, JSON.stringify([questionId]), JSON.stringify(snapshot)]);
    const swapped = sceneFixture(); swapped.participants[0].voiceId = 'sari-voice'; swapped.participants[1].voiceId = 'dewi-voice';
    await control.query('UPDATE quiz_questions SET audio_scene=$2 WHERE id=$1', [questionId, JSON.stringify(swapped)]);
    await control.query(`INSERT INTO dialogue_speakers(name,voice_id,voice_name) VALUES ('B','wrong-registry-voice','Wrong')`);
    assert.equal((await request(audioPath(token), null, 'GET')).body, 'audio:dewi-voiceaudio:sari-voice');
    assert.equal((await request(audioPath(), null, 'GET')).body, 'audio:sari-voiceaudio:dewi-voice');
    const { publicChapterQuestions } = await import('./chapter-assessment.js');
    assert.doesNotMatch(JSON.stringify(publicChapterQuestions(snapshot)), /audio_scene|audio_script|voiceId|voiceName/);
    const preview = await request('/api/admin/tts/preview', { text: script, dialogScene: swapped }, 'POST', adminToken);
    assert.equal(preview.body, 'audio:sari-voiceaudio:dewi-voice');
    assert.notEqual(ttsHashKey(script, ['dewi-voice', 'sari-voice']), ttsHashKey(script, ['sari-voice', 'dewi-voice']));
  });
  await t.test('missing mappings and unavailable provider voices fail without guessed generation', async () => {
    const broken = sceneFixture(); broken.participants[1].voiceId = null;
    await control.query('UPDATE quiz_questions SET audio_scene=$2 WHERE id=$1', [questionId, JSON.stringify(broken)]);
    assert.equal((await request(audioPath(), null, 'GET')).status, 422);
    available = ['dewi-voice'];
    await control.query('UPDATE quiz_questions SET audio_scene=$2, audio_script=$3 WHERE id=$1', [questionId, JSON.stringify(sceneFixture()), script + '\nA: はい。']);
    upstream = [];
    assert.equal((await request(audioPath(), null, 'GET')).status, 502);
    assert.equal(upstream.filter(u => u.url.includes('/text-to-speech/')).length, 0);
  });
});
