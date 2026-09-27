import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { db, query, withTransaction, withAdvisoryLock } from './db.js';
import { createLearnerFlowTelemetry } from './learning-flow-telemetry.js';
import { runWithRequestQueryCount } from './request-query-count.js';

test('exported query and transaction clients count BEGIN, COMMIT, ROLLBACK and advisory SQL', async t => {
  const sql = [];
  t.mock.method(db, 'query', async text => { sql.push(text); return { rows: [] }; });
  t.mock.method(db, 'connect', async () => ({
    async query(text) { sql.push(text); return { rows: [] }; }, release() {},
  }));
  await runWithRequestQueryCount(async state => {
    await query('SELECT exported');
    await withTransaction(async client => { await client.query('SELECT transactional'); });
    assert.equal(state.queryCount, 4);
    await withAdvisoryLock('fixture', async client => { await client.query('SELECT locked'); });
    assert.equal(state.queryCount, 8);
    await assert.rejects(withAdvisoryLock('fixture', async client => {
      await client.query('SELECT locked before failure');
      throw new Error('advisory fixture failure');
    }), /advisory fixture failure/);
    assert.equal(state.queryCount, 12);
    await assert.rejects(withTransaction(async client => {
      await client.query('SELECT before failure');
      throw new Error('fixture failure');
    }), /fixture failure/);
    assert.equal(state.queryCount, 15);
  });
  assert.deepEqual(sql, ['SELECT exported', 'BEGIN', 'SELECT transactional', 'COMMIT',
    'BEGIN', 'SELECT pg_advisory_xact_lock(hashtext($1))', 'SELECT locked', 'COMMIT',
    'BEGIN', 'SELECT pg_advisory_xact_lock(hashtext($1))', 'SELECT locked before failure', 'ROLLBACK',
    'BEGIN', 'SELECT before failure', 'ROLLBACK']);
  await query('SELECT outside request');
  assert.equal(sql.length, 16);
});

test('parallel HTTP requests have isolated counts and logger failure leaves bytes unchanged', async t => {
  t.mock.method(db, 'query', async () => {
    await new Promise(resolve => setTimeout(resolve, 2));
    return { rows: [] };
  });
  const events = [];
  const app = express();
  app.use('/api', createLearnerFlowTelemetry({ logger: event => events.push(event) }));
  app.get('/api/lessons/:id/dialogue-questions', async (req, res) => {
    for (let index = 0; index < Number(req.query.count); index++) await query('SELECT secret', ['private']);
    res.json({ placement: { mode: 'legacy' }, public: 'unchanged' });
  });
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/lessons/fixture/dialogue-questions`;
  const responses = await Promise.all([1, 3].map(count => fetch(`${base}?count=${count}`)));
  const bodies = await Promise.all(responses.map(response => response.text()));
  assert.equal(bodies[0], bodies[1]);
  assert.deepEqual(events.map(event => event.queryCount).sort((a, b) => a - b), [1, 3]);
  assert.doesNotMatch(JSON.stringify(events), /secret|private|fixture|count=/);
  const failedLogger = express();
  failedLogger.use('/api', createLearnerFlowTelemetry({ logger: () => { throw Error('down'); } }));
  failedLogger.get('/api/lessons/:id/dialogue-questions', async (_req, res) => {
    await query('SELECT secret');
    res.json({ placement: { mode: 'legacy' }, public: 'unchanged' });
  });
  const second = await new Promise(resolve => {
    const instance = failedLogger.listen(0, '127.0.0.1', () => resolve(instance));
  });
  t.after(() => new Promise(resolve => second.close(resolve)));
  const reply = await fetch(`http://127.0.0.1:${second.address().port}/api/lessons/fixture/dialogue-questions`);
  assert.equal(reply.status, 200);
  assert.equal(await reply.text(), bodies[0]);
});
