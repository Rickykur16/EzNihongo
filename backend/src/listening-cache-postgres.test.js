import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import express from 'express';
import pg from 'pg';

test('admin cache cleanup preserves both active audio profiles and reports the listening model', {
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
  const { db } = await import('./db.js');
  const { signAccessToken } = await import('./auth.js');
  const { default: admin } = await import('./routes/admin.js');
  const { TTS_SETTINGS_VERSION, TTS_LISTENING_SETTINGS_VERSION } = await import('./routes/tts.js');
  let server;
  t.after(async () => {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await db.end();
    await control.query(`DROP SCHEMA ${schema} CASCADE`);
    await control.end();
  });
  await control.query(`CREATE TABLE tts_cache (
    text_hash TEXT PRIMARY KEY, byte_size INT, settings_version TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await control.query(`INSERT INTO tts_cache (text_hash,byte_size,settings_version)
    VALUES ('generic',10,$1),('listening',20,$2),('old',30,'obsolete-profile'),('unknown',40,NULL)`,
  [TTS_SETTINGS_VERSION, TTS_LISTENING_SETTINGS_VERSION]);
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
  assert.deepEqual(stats.body.current_versions, [TTS_SETTINGS_VERSION, TTS_LISTENING_SETTINGS_VERSION]);
  assert.equal(stats.body.current_count, 2);
  assert.equal(Number(stats.body.current_bytes), 30);
  assert.equal(stats.body.orphan_count, 2);
  const preview = await call('/tts/cache/orphans');
  assert.equal(preview.body.count, 2);
  assert.equal(Number(preview.body.bytes), 70);
  const cleanup = await call('/tts/cache/orphans', 'DELETE');
  assert.equal(cleanup.body.deleted, 2);
  assert.deepEqual((await control.query('SELECT text_hash FROM tts_cache ORDER BY text_hash')).rows,
    [{ text_hash: 'generic' }, { text_hash: 'listening' }]);
  assert.equal((await call('/tts/cache/orphans')).body.count, 0);
  const invalid = await call('/tts/preview', 'POST', { text: 'こんにちは。', listening: 'true' });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error, 'listening must be a boolean');
});
