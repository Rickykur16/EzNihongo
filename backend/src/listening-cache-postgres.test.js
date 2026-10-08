import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import express from 'express';
import pg from 'pg';

test('admin cache cleanup preserves all active audio profiles and clears only the requested listening takes', {
  skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL for PostgreSQL tests', timeout: 30000,
}, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  const schema = 'listening_cache_' + randomUUID().replaceAll('-', '');
  const control = new pg.Client({ connectionString: url.href });
  await control.connect();
  await control.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
  url.searchParams.set('options', `-c search_path=${schema} -c statement_timeout=10000`);
  process.env.DATABASE_URL = url.href;
  process.env.JWT_ACCESS_SECRET = 'listening-cache-test';
  process.env.ADMIN_EMAILS = 'cache-admin@example.invalid';
  process.env.COMPANY_STAFF_ENABLED = 'false';
  process.env.ELEVENLABS_API_KEY = '';
  process.env.ELEVENLABS_LISTENING_MODEL = 'eleven_v4';
  process.env.ELEVENLABS_DIALOGUE_MODEL = 'eleven_v4';
  process.env.ELEVENLABS_VOICE_ID = 'single-voice';
  process.env.ELEVENLABS_VOICE_NARRATOR = 'narrator-voice';
  const { db } = await import('./db.js');
  const { signAccessToken } = await import('./auth.js');
  const { default: admin } = await import('./routes/admin.js');
  const { TTS_SETTINGS_VERSION, TTS_LISTENING_SETTINGS_VERSION, TTS_DIALOGUE_SETTINGS_VERSION,
    listeningTurnKey, dialogTurnKey } = await import('./routes/tts.js');
  let server;
  t.after(async () => {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await db.end();
    await control.query(`DROP SCHEMA ${schema} CASCADE`);
    await control.end();
  });
  await control.query(`CREATE TABLE tts_cache (
    text_hash TEXT PRIMARY KEY, text TEXT, byte_size INT, settings_version TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await control.query(`INSERT INTO tts_cache (text_hash,byte_size,settings_version)
    VALUES ('generic',10,$1),('listening',20,$2),('dialogue',50,$3),
    ('old',30,'listening-v4-pcm-v1'),('unknown',40,NULL)`,
  [TTS_SETTINGS_VERSION, TTS_LISTENING_SETTINGS_VERSION, TTS_DIALOGUE_SETTINGS_VERSION]);
  await control.query('CREATE TABLE dialogue_speakers (name TEXT, voice_id TEXT)');
  await control.query("INSERT INTO dialogue_speakers VALUES ('アンナ','anna-registry-voice')");
  const app = express(); app.use(express.json()); app.use('/api/admin', admin);
  app.use((err, req, res, next) => res.status(500).json({ error: err.message }));
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/admin`;
  const token = await signAccessToken(randomUUID(), 'cache-admin@example.invalid');
  const call = async (path, method = 'GET', body) => {
    const response = await fetch(base + path, { method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body && { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  };
  assert.equal((await fetch(base + '/tts/cache/orphans', { method: 'DELETE' })).status, 401);
  const stats = await call('/tts/cache/stats');
  assert.equal(stats.status, 200);
  assert.equal(stats.body.listening_model, 'eleven_v4');
  assert.equal(stats.body.dialogue_model, 'eleven_v4');
  assert.deepEqual(stats.body.current_versions, [TTS_SETTINGS_VERSION, TTS_LISTENING_SETTINGS_VERSION, TTS_DIALOGUE_SETTINGS_VERSION]);
  assert.equal(stats.body.current_count, 3);
  assert.equal(Number(stats.body.current_bytes), 80);
  assert.equal(stats.body.orphan_count, 2);
  const preview = await call('/tts/cache/orphans');
  assert.equal(preview.body.count, 2);
  assert.equal(Number(preview.body.bytes), 70);
  const cleanup = await call('/tts/cache/orphans', 'DELETE');
  assert.equal(cleanup.body.deleted, 2);
  assert.deepEqual((await control.query('SELECT text_hash FROM tts_cache ORDER BY text_hash')).rows,
    [{ text_hash: 'dialogue' }, { text_hash: 'generic' }, { text_hash: 'listening' }]);
  assert.equal((await call('/tts/cache/orphans')).body.count, 0);
  const invalid = await call('/tts/preview', 'POST', { text: 'こんにちは。', listening: 'true' });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error, 'listening must be a boolean');

  const narrator = { voiceId: 'narrator-voice', role: 'narrator' };
  const anna = { voiceId: 'anna-registry-voice', role: 'dialogue' };
  const narratorText = 'ふたりが はなしています。';
  const annaText = 'こんにちは。';
  const keys = [listeningTurnKey(narratorText, narrator), listeningTurnKey(annaText, anna),
    dialogTurnKey(annaText, anna), listeningTurnKey(annaText, { ...anna, voiceId: 'other-voice' })];
  for (const key of keys) await control.query('INSERT INTO tts_cache (text_hash) VALUES ($1)', [key]);
  const script = `N: ${narratorText}\nアンナ: <break time="1s"/> ${annaText}`;
  assert.equal((await call('/tts/cache', 'DELETE', { text: script, listening: 'true' })).status, 400);
  const cleared = await call('/tts/cache', 'DELETE', { text: script, listening: true });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.deleted, 2, 'clears canonical turn keys, not the full script text');
  const remaining = (await control.query('SELECT text_hash FROM tts_cache WHERE text_hash = ANY($1::text[])', [keys])).rows;
  assert.deepEqual(remaining.map(row => row.text_hash).sort(), keys.slice(2).sort(), 'other voices and grammar takes survive');

  const singleKey = listeningTurnKey('はい。', { voiceId: 'single-voice', role: 'single' });
  await control.query('INSERT INTO tts_cache (text_hash) VALUES ($1)', [singleKey]);
  assert.equal((await call('/tts/cache', 'DELETE', { text: 'はい。', listening: true })).body.deleted, 1);

  const sceneVoice = { voiceId: 'scene-anna-voice', role: 'dialogue' };
  const sceneKey = listeningTurnKey(annaText, sceneVoice);
  await control.query('INSERT INTO tts_cache (text_hash) VALUES ($1)', [sceneKey]);
  const dialogScene = { schemaVersion: 1, enabled: true, backgroundKey: 'classroom', participants: [
    { characterKey: 'anna-wijaya', position: 'left', speaker: 'アンナ', displayName: 'Anna',
      voiceId: sceneVoice.voiceId, voiceName: 'Anna', profileVersion: 1, custom: false },
    { characterKey: 'hadi-pratama', position: 'right', speaker: 'B', displayName: 'Hadi',
      voiceId: 'hadi-voice', voiceName: 'Hadi', profileVersion: 1, custom: false },
  ] };
  assert.equal((await call('/tts/cache', 'DELETE', { text: `アンナ: ${annaText}`, listening: true, dialogScene })).body.deleted, 1);
  await control.query("INSERT INTO tts_cache (text_hash,text) VALUES ('generic-text','おはよう。')");
  assert.equal((await call('/tts/cache', 'DELETE', { text: 'おはよう。' })).body.deleted, 1, 'generic clearing keeps exact text behavior');
});
