import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { legacyDraft, suggestReadings } from '../../src/grammar-dialogue-core.mjs';

test('dialogue publication, previews, concurrent edits, reports and rollback on PostgreSQL', {
  skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL to run isolated PostgreSQL integration tests',
  timeout: 60000,
}, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Only a disposable local database is allowed');
  const { default: pg } = await import('pg');
  const { default: express } = await import('express');
  const control = new pg.Client({ connectionString: url.href });
  await control.connect();
  const schema = 'dialogue_test_' + randomUUID().replaceAll('-', '');
  await control.query('CREATE SCHEMA ' + schema);
  await control.query('SET search_path TO ' + schema);
  url.searchParams.set('options', '-c search_path=' + schema);
  process.env.DATABASE_URL = url.href;
  process.env.JWT_ACCESS_SECRET = 'dialogue-test-access';
  process.env.JWT_REFRESH_SECRET = 'dialogue-test-refresh';
  process.env.ADMIN_EMAILS = 'admin@example.invalid';
  process.env.ELEVENLABS_API_KEY = 'local-test-only';
  const voices = { N: 'NarratorVoice12345678', A: 'FemaleVoice123456789', B: 'MaleVoice12345678901' };
  process.env.ELEVENLABS_VOICE_NARRATOR = voices.N;
  process.env.ELEVENLABS_VOICE_FEMALE = voices.A;
  process.env.ELEVENLABS_VOICE_MALE = voices.B;
  const { db } = await import('./db.js');
  const { signAccessToken } = await import('./auth.js');
  const { requireAuth, requireAdmin } = await import('./middleware.js');
  const { grammarDialogueAdminRouter, grammarDialoguePublicRouter } = await import('./routes/grammar-dialogue.js');
  let server, providerCalls = 0, providerFails = false;
  const originalFetch = globalThis.fetch;
  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await db.end(); await control.query('DROP SCHEMA ' + schema + ' CASCADE'); await control.end();
  });
  await control.query('CREATE TABLE users(id UUID PRIMARY KEY,email TEXT); CREATE TABLE admin_emails(email TEXT); CREATE TABLE module_grammar(id UUID PRIMARY KEY,pattern TEXT,example_dialog TEXT,example_dialog_id TEXT,updated_at TIMESTAMPTZ);');
  await control.query(await readFile(new URL('../migrations/142_grammar_dialogue_audio.sql', import.meta.url), 'utf8'));
  const user = randomUUID(), student = randomUUID(), id = randomUUID();
  await control.query('INSERT INTO users VALUES($1,$2),($3,$4)', [user, 'admin@example.invalid', student, 'student@example.invalid']);
  await control.query('INSERT INTO module_grammar(id,pattern,example_dialog,example_dialog_id) VALUES($1,$2,$3,$4)',
    [id, '名詞', 'A: 学校。\nB: 学校。', 'A: Sekolah.\nB: Sekolah.']);
  const adminToken = await signAccessToken(user, 'admin@example.invalid');
  const studentToken = await signAccessToken(student, 'student@example.invalid');
  globalThis.fetch = async (target, options) => {
    if (!String(target).startsWith('https://api.elevenlabs.io/')) return originalFetch(target, options);
    providerCalls++;
    assert.ok(JSON.parse(options.body).inputs.every(input => !/\p{Script=Han}/u.test(input.text)));
    if (providerFails) return new Response(JSON.stringify({ detail: { status: 'missing_permissions', message: 'missing text_to_speech' } }), { status: 401 });
    return new Response(JSON.stringify({ audio_base64: Buffer.from('FAKEAUDIO').toString('base64'), voice_segments: [
      { dialogue_input_index: 0, start_time_seconds: 0, end_time_seconds: 1 },
      { dialogue_input_index: 1, start_time_seconds: 1, end_time_seconds: 2 },
    ] }));
  };
  const app = express();
  app.use(express.json());
  app.use('/admin', requireAuth, requireAdmin, grammarDialogueAdminRouter);
  app.use('/public', grammarDialoguePublicRouter);
  app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  async function request(path, method = 'GET', body, token = adminToken) {
    return fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
  }
  const root = '/admin/' + id, publicRoot = '/public/' + id;
  assert.equal((await request(root, 'GET', null, null)).status, 401);
  assert.equal((await request(root, 'GET', null, studentToken)).status, 403);
  assert.equal((await (await request(publicRoot)).json()).audio, null);
  let draft = suggestReadings(legacyDraft({ pattern: '名詞', example_dialog: 'A: 学校。\nB: 学校。',
    example_dialog_id: 'A: Sekolah.\nB: Sekolah.' }, voices), [{ text: '学校', reading: 'がっこう' }]);
  draft.turns.forEach(turn => { turn.reviewed = true; });
  assert.equal((await request(root + '/draft', 'PUT', { draft, revision: 0 })).status, 200);
  const take = { revision: 1, engine: 'dialogue-v3', takeId: randomUUID() };
  const first = (await (await request(root + '/generate', 'POST', take)).json()).version;
  assert.equal(first.status, 'ready');
  const repeated = (await (await request(root + '/generate', 'POST', take)).json()).version;
  assert.equal(repeated.id, first.id); assert.equal(providerCalls, 1);
  assert.equal((await request(publicRoot + '/audio/' + first.id)).status, 404);
  assert.equal((await request(root + '/audio/' + first.id)).status, 200);
  assert.equal((await request(root + '/publish', 'POST', { versionId: first.id, revision: 1 })).status, 400);
  assert.equal((await request(root + '/publish', 'POST', { versionId: first.id, revision: 1, reviewedAudio: true })).status, 200);
  assert.equal((await (await request(publicRoot)).json()).versionId, first.id);
  const range = await fetch(base + publicRoot + '/audio/' + first.id, { headers: { Range: 'bytes=0-3' } });
  assert.equal(range.status, 206); assert.equal(await range.text(), 'FAKE');
  draft.scene = 'Draft baru yang belum dipublikasikan';
  const saves = await Promise.all([request(root + '/draft', 'PUT', { draft, revision: 1 }), request(root + '/draft', 'PUT', { draft, revision: 1 })]);
  assert.deepEqual(saves.map(r => r.status).sort(), [200, 409]);
  assert.equal((await (await request(publicRoot)).json()).draft.scene, '');
  assert.equal((await request(root + '/publish', 'POST', { versionId: first.id, revision: 2, reviewedAudio: true })).status, 409);
  const second = (await (await request(root + '/generate', 'POST', { ...take, revision: 2, takeId: randomUUID() })).json()).version;
  assert.equal((await request(root + '/restore', 'POST', { versionId: second.id })).status, 400);
  assert.equal((await request(root + '/publish', 'POST', { versionId: second.id, revision: 2, reviewedAudio: true })).status, 200);
  assert.equal((await request(root + '/restore', 'POST', { versionId: first.id })).status, 200);
  assert.equal((await (await request(publicRoot)).json()).draft.scene, '');
  assert.equal((await request(publicRoot + '/reports', 'POST', { versionId: first.id, turnId: 'missing', reason: 'pronunciation' }, null)).status, 400);
  assert.equal((await request(publicRoot + '/reports', 'POST', { versionId: first.id, turnId: draft.turns[0].id, reason: 'pronunciation', note: 'Nama salah' }, null)).status, 201);
  const reports = (await (await request(root)).json()).reports;
  assert.equal(reports.length, 1);
  assert.equal((await request(root + '/reports/' + reports[0].id + '/resolve', 'POST')).status, 200);
  assert.equal((await (await request(root)).json()).reports.length, 0);
  providerFails = true;
  assert.equal((await request(root + '/generate', 'POST', { ...take, revision: 2, takeId: randomUUID() })).status, 502);
  assert.equal((await (await request(publicRoot)).json()).versionId, first.id);
});
