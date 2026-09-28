import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const userId = id(1), sourceId = id(2), taskId = id(3), courseId = id(4);
const grammarId = id(5), sessionId = id(6), itemId = id(7);
const email = 'v2-fixture@example.invalid';

test('HTTP resumes frozen v2 while rollout is off and current-source SQL fails; v1 still observes a withdrawn companion',
  { concurrency: false }, async t => {
    const oldSecret = process.env.JWT_ACCESS_SECRET;
    process.env.JWT_ACCESS_SECRET = 'synthetic-v2-session-test-secret-long-enough';
    t.after(() => { if (oldSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
      else process.env.JWT_ACCESS_SECRET = oldSecret; });
    const { db } = await import('./db.js');
    const { signAccessToken } = await import('./auth.js');
    const { createGrammarTaskSessionsRouter } = await import('./routes/grammar-task-sessions.js');
    let flowVersion = 2;
    let hasExisting = true;
    let currentReadCount = 0;
    let inserted = 0;
    let rolledBackSavepoint = 0;
    const seenSql = [];
    const session = () => ({ id: sessionId, user_id: userId,
      source_lesson_id: sourceId, task_lesson_id: taskId,
      content_revision_id: 'frozen-revision', flow_version: flowVersion,
      production_snapshot: [{ grammarId }], expires_at: new Date(Date.now() + 3600_000),
      active: true });
    const item = { item_id: itemId, session_id: sessionId, grammar_id: grammarId,
      step: 5, snapshot: { variant: 'choice', prompt: '何ですか。',
        options: ['駅', '家'], correctIndex: 0, overlayHint: '会話を確認',
        normalizedQuestion: { id: id(8), questionFingerprint: 'secret-fingerprint' } },
      wrong_count: 0, passed: false };
    const fakeQuery = async (sql, params = []) => {
      seenSql.push(sql);
      if (/^(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE SAVEPOINT)/.test(sql)) {
        if (sql.startsWith('ROLLBACK TO SAVEPOINT')) rolledBackSavepoint++;
        return { rows: [] };
      }
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
      if (sql.includes('WITH RECURSIVE required')) return { rows: [{ id: courseId }] };
      if (sql.includes('FROM grammar_task_sessions') && sql.includes('WHERE user_id=')) {
        return { rows: hasExisting ? [session()] : [] };
      }
      if (sql.includes('FROM grammar_task_sessions') && sql.includes('WHERE id =')) {
        return { rows: [session()] };
      }
      if (sql.includes('FROM grammar_task_session_items') && sql.includes('SELECT grammar_id')) {
        return { rows: [{ grammar_id: grammarId }] };
      }
      if (sql.includes('FROM grammar_task_session_items')) return { rows: [item] };
      if (sql.includes('UPDATE grammar_task_session_items SET hint_served_at')) {
        item.hint_served_at = new Date();
        return { rows: [] };
      }
      if (sql.includes('FROM grammar_task_productions')) return { rows: [] };
      if (/FROM lessons s\b/.test(sql)) {
        currentReadCount++;
        throw new Error('simulated current-source SQL failure');
      }
      if (sql.includes('SELECT sm.course_id')) return { rows: [{ course_id: courseId }] };
      if (sql.includes('unnest($1::text[])')) return { rows: [] };
      if (sql.includes('SELECT email FROM users')) return { rows: [{ email }] };
      if (sql.includes('FROM user_enrollments')) return { rows: [{ user_id: userId }] };
      // No learning-flow rollout config is stored, so new sessions stay legacy.
      if (sql.includes('FROM app_settings')) return { rows: [] };
      // The source lesson's companion has been withdrawn (no publication).
      if (sql.includes('bunpou_flow_published IS NOT NULL AS published') && !sql.includes('JOIN')) {
        return { rows: [{ published: false }] };
      }
      if (sql.includes('FROM lessons l') && sql.includes('JOIN modules m')) {
        return { rows: [{ module_id: id(9), course_id: courseId }] };
      }
      if (sql.includes('INSERT INTO grammar_task_sessions')) inserted++;
      throw new Error(`Unmocked SQL: ${sql}`);
    };
    t.mock.method(db, 'query', fakeQuery);
    t.mock.method(db, 'connect', async () => ({ query: fakeQuery, release() {} }));
    const app = express();
    app.use(express.json());
    app.use('/api', createGrammarTaskSessionsRouter({ runtimeAvailable: false }));
    app.use((error, req, res, next) => res.status(500).json({ error: error.message }));
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const token = await signAccessToken(userId, email);
    const base = `http://127.0.0.1:${server.address().port}/api/grammar-task/sessions`;
    const api = async (path, method, body) => {
      const response = await fetch(base + path, { method,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, data: await response.json() };
    };
    const resumed = await api('', 'POST', { sourceLessonId: sourceId });
    assert.equal(resumed.status, 200, `${JSON.stringify(resumed.data)}\n${seenSql.join('\n--\n')}`);
    assert.equal(resumed.data.sessionId, sessionId);
    assert.equal(resumed.data.flowVersion, 2);
    assert.equal(resumed.data.contentChanged, true);
    assert.deepEqual(resumed.data.items.map(row => row.step), [5]);
    assert.equal(JSON.stringify(resumed.data).includes('secret-fingerprint'), false);
    assert.equal(JSON.stringify(resumed.data).includes('correctIndex'), false);
    assert.equal(inserted, 0);
    const fetched = await api(`/${sessionId}`, 'GET');
    assert.equal(fetched.status, 200, JSON.stringify(fetched.data));
    assert.equal(fetched.data.contentChanged, true);
    assert.equal(fetched.data.flowVersion, 2);
    assert.equal(currentReadCount, 2);
    assert.equal(rolledBackSavepoint, 2);
    const hinted = await api(`/${sessionId}/items/${itemId}/hint`, 'POST', {});
    assert.equal(hinted.status, 200, JSON.stringify(hinted.data));
    assert.equal(hinted.data.hint, '会話を確認');
    assert.ok(item.hint_served_at, 'v2 mutation ran while the companion was withdrawn');
    flowVersion = 1;
    const revoked = await api(`/${sessionId}`, 'GET');
    assert.equal(revoked.status, 403);
    assert.equal(revoked.data.error, 'pilot_not_enabled_for_lesson');
    hasExisting = false;
    const unpiloted = await api('', 'POST', { sourceLessonId: sourceId });
    assert.equal(unpiloted.status, 403, JSON.stringify(unpiloted.data));
    assert.equal(unpiloted.data.error, 'pilot_not_enabled_for_lesson');
    assert.equal(currentReadCount, 2, 'ordinary task must decide before reading missing companion');
    assert.equal(inserted, 0);
  });
