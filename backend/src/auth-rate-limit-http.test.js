import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';

process.env.JWT_ACCESS_SECRET = 'auth-rate-limit-test-access';
process.env.JWT_REFRESH_SECRET = 'auth-rate-limit-test-refresh';
const { default: auth } = await import('./routes/auth.js');
const { default: kanjiAuth } = await import('./routes/kanji-auth.js');
const { db } = await import('./db.js');

test('real auth routes keep login, refresh, logout and auth realms in separate budgets', async () => {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use('/api/auth', auth);
  app.use('/api/kanji-auth', kanjiAuth);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = path => fetch(base + path, {
    method: 'POST', headers: { 'X-Forwarded-For': '192.0.2.10' },
    signal: AbortSignal.timeout(5000),
  });
  const check = async (path, expected) => {
    const res = await request(path);
    assert.equal(res.status, expected, path);
    await res.text();
    return res;
  };
  try {
    for (const realm of ['/api/auth', '/api/kanji-auth']) {
      // Missing credentials/cookies stop before Google/DB work; they still
      // pass through the real route middleware and consume their own budget.
      for (let i = 0; i < 60; i++) await check(realm + '/refresh', 401);
      const limited = await check(realm + '/refresh', 429);
      assert.ok(Number(limited.headers.get('Retry-After')) > 0);
      for (let i = 0; i < 10; i++) await check(realm + '/google', 400);
      await check(realm + '/google', 429);
      for (let i = 0; i < 30; i++) await check(realm + '/logout', 200);
      await check(realm + '/logout', 429);
    }
    // Password login keeps its existing, stricter limit.
    for (let i = 0; i < 5; i++) await check('/api/auth/login', 400);
    await check('/api/auth/login', 429);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await db.end();
  }
});
