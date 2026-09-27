import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createDialogueQuestionRouter } from './routes/dialogue-questions.js';
import { createLearnerFlowTelemetry, learnerFlowEvent,
  learnerFlowOperation } from './learning-flow-telemetry.js';

const ID = '00000000-0000-4000-8000-000000000001';
const tick = () => new Promise(resolve => setImmediate(resolve));

test('operation mapping is exact and never uses an identifier as a metric label', () => {
  assert.equal(learnerFlowOperation('GET', `/api/lessons/${ID}/dialogue-questions`), 'inline_fetch');
  assert.equal(learnerFlowOperation('POST', `/grammar-task/sessions/${ID}/items/${ID}/answer`), 'session_answer');
  assert.equal(learnerFlowOperation('POST', `/grammar-task/sessions/${ID}/production`), 'session_production');
  assert.equal(learnerFlowOperation('GET', `/grammar-task/sessions/${ID}`), 'session_get');
  assert.equal(learnerFlowOperation('GET', `/api/lessons/${ID}/dialogue-questions/extra`), null);
  assert.equal(learnerFlowOperation('POST', `/api/lessons/${ID}/dialogue-questions`), null);
});

test('event schema keeps only bounded dimensions, including v2 transfer and conflict codes', () => {
  const privateBody = { sessionId: ID, flowVersion: 2,
    sourceFingerprint: 'private-fingerprint', userId: ID,
    items: [{ step: 5, prompt: '秘密の質問', correctIndex: 1, options: ['secret'] }] };
  const event = learnerFlowEvent({ operation: 'session_get', status: 200,
    body: privateBody, timestamp: '2026-09-27T00:00:00.000Z', durationMs: 7 });
  assert.deepEqual(event, { event: 'learning_flow_request', schemaVersion: 1,
    timestamp: '2026-09-27T00:00:00.000Z', operation: 'session_get', status: 200,
    outcome: 'success', durationMs: 7, flowVersion: 2, transferAvailable: true });
  assert.doesNotMatch(JSON.stringify(event), /秘密|secret|fingerprint|00000000/);
  const conflict = learnerFlowEvent({ operation: 'dialogue_answer', status: 409,
    body: { error: 'question_version_conflict', requestId: ID, prompt: 'secret' },
    timestamp: '2026-09-27T00:00:00.000Z', durationMs: 1 });
  assert.equal(conflict.outcome, 'conflict');
  assert.equal(conflict.errorCode, 'question_version_conflict');
  assert.equal(learnerFlowEvent({ operation: 'dialogue_answer', status: 500,
    body: { error: 'email_person@example.com' }, timestamp: '', durationMs: 1 }).errorCode, undefined);
  assert.equal(learnerFlowEvent({ operation: 'session_answer', status: 200,
    body: { passed: true, alreadyCompleted: true }, timestamp: '', durationMs: 1 }).outcome, 'already_completed');
});

test('actual dialogue router emits private-safe fetch, answer, error, and empty-latest events', async () => {
  const events = [];
  const app = express();
  app.use(express.json());
  app.use('/api', createLearnerFlowTelemetry({ logger: event => events.push(event) }));
  const auth = (req, _res, next) => { req.user = { id: ID, email: 'private@example.com' }; next(); };
  app.use('/api', createDialogueQuestionRouter({ auth,
    answerLimiter: (_req, _res, next) => next(),
    list: async () => ({ lessonId: ID, placement: { mode: 'inline', flowVersion: 2 },
      grammars: [{ grammarId: ID, questions: [{ prompt: '秘密の質問', options: ['秘密の答え'] }] }] }),
    answer: async (_id, _user, body) => {
      if (body.optionIndex === 2) {
        const error = new Error('question_version_conflict'); error.status = 409; throw error;
      }
      return { attemptId: ID, correct: false, correctIndex: 1,
        explanation: '秘密の説明', requestId: body.requestId };
    },
    latest: async () => null,
  }));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.message }));
  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const batch = await fetch(`${base}/lessons/${ID}/dialogue-questions`);
    assert.equal(batch.status, 200);
    const answer = await fetch(`${base}/dialogue-questions/${ID}/answer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionIndex: 0, requestId: ID }),
    });
    assert.equal(answer.status, 200);
    const stale = await fetch(`${base}/dialogue-questions/${ID}/answer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionIndex: 2, requestId: ID }),
    });
    assert.equal(stale.status, 409);
    const latest = await fetch(`${base}/dialogue-questions/${ID}/attempts/latest?questionVersion=${ID}`);
    assert.equal(latest.status, 204);
    await tick();
    assert.deepEqual(events.map(event => [event.operation, event.status, event.outcome]), [
      ['inline_fetch', 200, 'success'], ['dialogue_answer', 200, 'success'],
      ['dialogue_answer', 409, 'conflict'], ['dialogue_latest', 204, 'empty'],
    ]);
    assert.equal(events[0].placement, 'inline');
    assert.equal(events[0].flowVersion, 2);
    assert.equal(events[1].grade, 'incorrect');
    assert.equal(events[2].errorCode, 'question_version_conflict');
    const logged = JSON.stringify(events);
    assert.doesNotMatch(logged, /private@example|秘密|requestId|correctIndex|00000000/);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('telemetry logger failure never changes learner response', async () => {
  const app = express();
  app.use('/api', createLearnerFlowTelemetry({ logger: () => { throw new Error('telemetry down'); } }));
  app.get('/api/lessons/:id/dialogue-questions', (_req, res) => res.json({ placement: { mode: 'legacy' } }));
  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/lessons/${ID}/dialogue-questions`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).placement.mode, 'legacy');
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
