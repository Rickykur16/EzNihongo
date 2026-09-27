import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createDialogueQuestionRouter } from './routes/dialogue-questions.js';

const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

async function withApi(services, run) {
  const app = express();
  app.use(express.json());
  app.use('/api', createDialogueQuestionRouter({
    auth: (req, res, next) => {
      if (!req.headers.authorization) return res.status(401).json({ error: 'Missing token' });
      req.user = { id: id(1), email: 'student@example.test' }; next();
    },
    answerLimiter: (req, res, next) => next(), ...services,
  }));
  app.get('/api/public-after-dialogue-router', (req, res) => res.json({ ok: true }));
  app.use((error, req, res, next) => res.status(error.status || 500).json({ error: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { return await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('HTTP routes require auth, use no-store, and keep private data off batch response', async () => {
  const seen = [];
  await withApi({
    list: async (lessonId, user) => { seen.push([lessonId, user.id]); return {
      lessonId, placement: { mode: 'inline', flowVersion: 2 },
      grammars: [{ grammarId: id(3), questions: [{ id: id(4), version: id(5),
        kind: 'comprehension', prompt: 'Apa?', options: ['A', 'B', 'C'], sortOrder: 0 }] }],
    }; },
    answer: async () => { throw Object.assign(new Error('question_version_conflict'), { status: 409 }); },
    latest: async (questionId, user, questionVersion) => {
      if (typeof questionVersion !== 'string') {
        throw Object.assign(new Error('invalid_question_version'), { status: 400 });
      }
      return null;
    },
  }, async base => {
    const path = `/api/lessons/${id(2)}/dialogue-questions`;
    const anonymous = await fetch(base + path);
    assert.equal(anonymous.status, 401);
    const batch = await fetch(base + path, { headers: { Authorization: 'Bearer test' } });
    assert.equal(batch.status, 200);
    assert.equal(batch.headers.get('cache-control'), 'private, no-store');
    const json = await batch.json();
    assert.equal(JSON.stringify(json).includes('correctIndex'), false);
    assert.deepEqual(seen, [[id(2), id(1)]]);
    const answer = await fetch(`${base}/api/dialogue-questions/${id(4)}/answer`, {
      method: 'POST', headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionVersion: id(5), optionIndex: 0, requestId: id(6) }),
    });
    assert.equal(answer.status, 409);
    assert.deepEqual(await answer.json(), { error: 'question_version_conflict' });
    const latest = await fetch(`${base}/api/dialogue-questions/${id(4)}/attempts/latest?questionVersion=${id(5)}`,
      { headers: { Authorization: 'Bearer test' } });
    assert.equal(latest.status, 204);
    assert.equal(latest.headers.get('cache-control'), 'private, no-store');
    const repeatedVersion = await fetch(`${base}/api/dialogue-questions/${id(4)}/attempts/latest?questionVersion=${id(5)}&questionVersion=${id(5)}`,
      { headers: { Authorization: 'Bearer test' } });
    assert.equal(repeatedVersion.status, 400);
    assert.deepEqual(await repeatedVersion.json(), { error: 'invalid_question_version' });
    const unrelated = await fetch(`${base}/api/public-after-dialogue-router`);
    assert.equal(unrelated.status, 200);
    assert.equal(unrelated.headers.get('cache-control'), null);
  });
});
