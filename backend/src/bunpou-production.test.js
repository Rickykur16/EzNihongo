import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const previousKey = process.env.ANTHROPIC_API_KEY;
process.env.ANTHROPIC_API_KEY = 'unused-test-key';
const { createProductionSubmitter, PRODUCTION_LEASE_MS } = await import('./bunpou-production.js');
const { evaluateGrammarSentence, GRAMMAR_EVAL_TIMEOUT_MS, loadTaskConcepts } = await import('./routes/grammar-task.js');
const { db } = await import('./db.js');
if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
else process.env.ANTHROPIC_API_KEY = previousKey;

const user = { id: 'user-1' };
const session = {
  id: 'session-1', task_lesson_id: 'lesson-1', content_revision_id: 'revision-1',
  production_snapshot: [{ grammarId: 'grammar-1', pattern: 'snapshot pattern', meaning: 'meaning',
    example: 'example', instruction: 'snapshot instruction', requiredCount: 2, fingerprint: 'fingerprint-1' }],
};
const body = { grammarId: 'grammar-1', slot: 0, requestId: 'request-1', sentence: 'sentence', inputMode: 'text' };
const result = { correct: true, usesPattern: true, correction: '', feedback: 'ok', grammarScore: 95,
  primaryError: null, errorTypes: [], severity: 'none', conceptSignal: 'solid' };
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

// Transactional test double: writes are restored on rollback, and the same
// user's transactions serialize while the evaluator remains outside the lock.
function harness(evaluator = async () => ({ result, evalSource: 'ai', model: 'test-model' })) {
  let state = { requests: {}, attempts: [], slots: {}, versions: 0 };
  let tail = Promise.resolve();
  let inside = false;
  let now = 0;
  let calls = 0;
  let failAt = null;
  const statements = [];
  const client = { async query(sql, p = []) {
    assert.equal(inside, true);
    sql = sql.replace(/\s+/g, ' ').trim();
    statements.push({ sql, p });
    if (failAt && sql.includes(failAt)) throw new Error('injected write failure');
    const key = `${p[0]}:${p[1]}`;
    const row = state.requests[key];
    if (sql.startsWith('SELECT *, reserved_until')) {
      return { rows: row ? [{ ...row, lease_active: row.until > now }] : [] };
    }
    if (sql.startsWith('SELECT 1 FROM grammar_attempts WHERE user_id = $1 AND request_id')) {
      return { rows: state.attempts.filter(a => a.user_id === p[0] && a.request_id === p[1]) };
    }
    if (sql.startsWith('SELECT result, assistance_state, sentence, input_mode FROM grammar_task_productions')) {
      const saved = state.slots[`${p[0]}:${p[1]}:${p[2]}`];
      return { rows: saved?.[8] ? [{ result: JSON.parse(saved[5]), assistance_state: saved[7], sentence: saved[3], input_mode: saved[4] }] : [] };
    }
    if (sql.startsWith('SELECT 1 FROM grammar_task_requests')) {
      return { rows: Object.values(state.requests).filter(r => r.user_id === p[0] && r.session_id === p[1]
        && r.grammar_id === p[2] && r.production_slot === p[3] && r.operation === 'production'
        && r.response === null && r.until > now && r.request_id !== p[4]) };
    }
    if (sql.startsWith('INSERT INTO grammar_task_requests')) {
      assert.equal(row, undefined);
      state.requests[key] = { user_id: p[0], request_id: p[1], session_id: p[2], payload_hash: p[3],
        operation: 'production', reservation_token: p[4], until: now + p[5],
        grammar_id: p[6], production_slot: p[7], response: p[8] ? JSON.parse(p[8]) : null };
    } else if (sql.startsWith('UPDATE grammar_task_requests SET reservation_token')) {
      row.reservation_token = p[2]; row.until = now + p[3];
      row.grammar_id = p[4]; row.production_slot = p[5]; row.response = p[6] ? JSON.parse(p[6]) : null;
    } else if (sql.startsWith('UPDATE grammar_task_requests SET reserved_until')) {
      if (row && row.reservation_token === p[2] && row.response === null) row.until = now;
    } else if (sql.startsWith('UPDATE grammar_task_requests SET response')) {
      if (!row || row.reservation_token !== p[2] || row.response !== null || row.until <= now) return { rows: [] };
      row.response = JSON.parse(p[3]);
      return { rows: [{ request_id: p[1] }] };
    } else if (sql.startsWith('SELECT 1 FROM grammar_attempts')) {
      return { rows: state.attempts.filter(a => a.user_id === p[0] && a.grammar_id === p[1]
        && a.source === 'production' && a.correction?.trim()) };
    } else if (sql.startsWith('SELECT COUNT(*)')) {
      return { rows: [{ n: 1 + state.attempts.filter(a => a.user_id === p[0]
        && a.practice_session_id === p[1] && a.grammar_id === p[2] && a.source === 'production').length }] };
    } else if (sql.startsWith('INSERT INTO grammar_attempts')) {
      state.attempts.push({ user_id: p[0], grammar_id: p[1], source: 'production', correction: p[14],
        practice_session_id: p[17], request_id: p[20], params: p });
    } else if (sql.startsWith('INSERT INTO grammar_task_productions')) {
      state.slots[`${p[0]}:${p[1]}:${p[2]}`] = p;
    } else if (sql.startsWith('UPDATE grammar_task_sessions')) {
      state.versions++;
    } else throw new Error(`Unexpected SQL: ${sql}`);
    return { rows: [] };
  } };
  const submit = createProductionSubmitter({
    withLock: async (key, fn) => {
      assert.equal(key, 'bunpou:' + user.id);
      const previous = tail;
      const next = defer(); tail = next.promise;
      await previous;
      const before = structuredClone(state);
      inside = true;
      try { return await fn(client); }
      catch (err) { state = before; throw err; }
      finally { inside = false; next.resolve(); }
    },
    evaluate: async args => { assert.equal(inside, false); calls++; return evaluator(args); },
  });
  return { submit: overrides => submit({ session, user, body, assertAccess: async () => true, ...overrides }),
    state: () => state, calls: () => calls, statements, advance: ms => { now += ms; },
    fail: sql => { failAt = sql; } };
}

test('production saves snapshot evidence atomically and replays without AI or extra attempts', async () => {
  const h = harness(async args => {
    assert.deepEqual(args.grammar, session.production_snapshot[0]);
    assert.equal(args.instruction, 'snapshot instruction');
    return { result, evalSource: 'cache', model: 'test-model' };
  });
  const saved = await h.submit();
  assert.deepEqual(saved, { status: 200, body: { ...result, saved: true, passed: true, assistanceState: 'none_observed' } });
  assert.deepEqual(await h.submit(), saved);
  assert.equal(h.calls(), 1);
  assert.equal(h.state().attempts.length, 1);
  assert.equal(h.state().versions, 1);
  const p = h.state().attempts[0].params;
  assert.equal(p[15], 'cache');
  assert.deepEqual(p.slice(17, 21), ['session-1', 'revision-1', 'fingerprint-1', 'request-1']);
  assert.match(p[21], /^[0-9a-f]{64}$/);
  assert.deepEqual(p.slice(22), [1, 'none_observed', true]);
  assert.match(h.statements.find(s => s.sql.startsWith('INSERT INTO grammar_attempts')).sql, /\$18,NULL.*'ai',1/);
  assert.equal(Object.keys(h.state().slots).length, 1);
});

test('same request ID conflicts across payload, session, operations and legacy evidence', async () => {
  const h = harness(); await h.submit();
  for (const change of [{ sentence: 'different' }, { slot: 1 }, { inputMode: 'speech' }]) {
    assert.equal((await h.submit({ body: { ...body, ...change } })).body.error, 'request_id_conflict');
  }
  assert.equal((await h.submit({ session: { ...session, id: 'other-session' } })).status, 409);
  const old = harness();
  old.state().attempts.push({ user_id: user.id, request_id: body.requestId });
  assert.equal((await old.submit()).body.error, 'request_id_conflict');
  assert.equal(old.calls(), 0);
  assert.deepEqual(old.state().requests, {});
  const answer = harness();
  answer.state().requests['user-1:request-1'] = { operation: 'answer', response: { passed: true } };
  assert.equal((await answer.submit()).body.error, 'request_id_conflict');
  assert.equal(answer.calls(), 0);
});

test('pending duplicates do not evaluate; expired leases can be reclaimed and stale tokens cannot write', async () => {
  const entered = defer(), finish = defer();
  let count = 0;
  const h = harness(async () => {
    if (++count === 1) { entered.resolve(); await finish.promise; }
    return { result, evalSource: 'ai', model: 'test-model' };
  });
  const first = h.submit(); await entered.promise;
  assert.equal((await h.submit()).body.error, 'evaluation_pending');
  assert.equal(h.calls(), 1);
  h.advance(PRODUCTION_LEASE_MS + 1);
  const second = await h.submit();
  finish.resolve();
  assert.deepEqual(await first, second);
  assert.equal(h.state().attempts.length, 1);
  assert.equal(h.state().versions, 1);
});

test('finalization rejects replay after a retrier completes and access is revoked', async () => {
  const entered = defer(), finish = defer();
  let evaluations = 0, accessChecks = 0, allowed = true;
  const h = harness(async () => {
    if (++evaluations === 1) { entered.resolve(); await finish.promise; }
    return { result, evalSource: 'ai', model: 'test-model' };
  });
  const assertAccess = async () => { accessChecks++; return allowed; };
  const first = h.submit({ assertAccess });
  await entered.promise;
  h.advance(PRODUCTION_LEASE_MS + 1);
  assert.equal((await h.submit({ assertAccess })).status, 200);
  const saved = structuredClone(h.state());
  const beforeFinalization = h.statements.length;
  allowed = false;
  finish.resolve();
  assert.deepEqual(await first, { status: 403, body: { error: 'access_denied' } });
  assert.equal(accessChecks, 4);
  assert.deepEqual(h.state(), saved, 'denial must not alter the retrier response, token, or evidence');
  assert.ok(h.statements.slice(beforeFinalization).every(({ sql }) => !sql.startsWith('SELECT *, reserved_until')),
    'denied finalization must not read the request for replay');
  assert.equal(h.state().attempts.length, 1);
});

test('stale evaluator cannot finalize a reclaimed reservation still being evaluated', async () => {
  const entered = [defer(), defer()], finishes = [defer(), defer()]; let n = 0;
  const h = harness(async () => {
    const i = n++; entered[i].resolve(); await finishes[i].promise;
    return { result, evalSource: 'ai', model: 'test-model' };
  });
  const first = h.submit(); await entered[0].promise;
  h.advance(PRODUCTION_LEASE_MS + 1);
  const second = h.submit(); await entered[1].promise;
  finishes[0].resolve();
  assert.equal((await first).body.error, 'evaluation_pending');
  assert.equal(h.state().attempts.length, 0);
  finishes[1].resolve(); assert.equal((await second).status, 200);
  assert.equal(h.state().attempts.length, 1);
});

test('different request IDs cannot concurrently evaluate the same slot; other slots can proceed', async () => {
  const entered = defer(), finish = defer(); let n = 0;
  const h = harness(async () => {
    if (++n === 1) { entered.resolve(); await finish.promise; }
    return { result, evalSource: 'ai', model: 'test-model' };
  });
  const first = h.submit(); await entered.promise;
  assert.equal((await h.submit({ body: { ...body, requestId: 'other-request' } })).body.error, 'evaluation_pending');
  assert.equal(h.calls(), 1);
  assert.equal(h.state().requests['user-1:other-request'], undefined);
  assert.equal((await h.submit({ body: { ...body, requestId: 'other-slot', slot: 1 } })).status, 200);
  finish.resolve(); assert.equal((await first).status, 200);
  assert.equal(h.state().attempts.length, 2);
});

test('a late expired evaluation cannot overwrite a newer request result in the same slot', async () => {
  const entered = defer(), finish = defer(); let n = 0;
  const h = harness(async () => {
    if (++n === 1) {
      entered.resolve(); await finish.promise;
      return { result: { ...result, feedback: 'old', correct: false }, evalSource: 'ai', model: 'test-model' };
    }
    return { result: { ...result, feedback: 'new' }, evalSource: 'ai', model: 'test-model' };
  });
  const first = h.submit(); await entered.promise;
  h.advance(PRODUCTION_LEASE_MS + 1);
  assert.equal((await h.submit({ body: { ...body, requestId: 'new-request' } })).body.feedback, 'new');
  finish.resolve(); assert.equal((await first).body.error, 'evaluation_pending');
  assert.equal(h.state().attempts.length, 1);
  assert.equal(JSON.parse(h.state().slots['session-1:grammar-1:0'][5]).feedback, 'new');
  assert.equal((await h.submit()).body.feedback, 'new');
  assert.equal(h.calls(), 2);
});

test('passed slots are terminal across new request IDs and keep replay identity without new attempts', async () => {
  const h = harness(); const first = await h.submit();
  const nextBody = { ...body, requestId: 'new-request' };
  assert.deepEqual(await h.submit({ body: nextBody }), first);
  assert.deepEqual(await h.submit({ body: nextBody }), first);
  assert.equal(h.calls(), 1); assert.equal(h.state().attempts.length, 1);
  assert.equal(h.state().versions, 1);
  assert.equal((await h.submit({ body: { ...nextBody, sentence: 'changed again' } })).status, 409);
});

test('a completed slot rejects a different sentence or input mode without pretending to grade it', async () => {
  const h = harness(); await h.submit();
  for (const change of [{ sentence: 'different sentence' }, { inputMode: 'speech' }]) {
    assert.deepEqual(await h.submit({ body: { ...body, requestId: 'different-request', ...change } }),
      { status: 409, body: { error: 'production_completed' } });
  }
  assert.equal(h.calls(), 1); assert.equal(h.state().attempts.length, 1);
  assert.equal(h.state().requests['user-1:different-request'], undefined);
  assert.equal(h.state().slots['session-1:grammar-1:0'][3], body.sentence);
});

test('finalization also rejects a terminal slot for a different sentence or input mode', async () => {
  for (const change of [{ sentence: 'other saved sentence' }, { inputMode: 'speech' }]) {
    const h = harness();
    let accessChecks = 0;
    const response = await h.submit({ assertAccess: async () => {
      if (++accessChecks === 1) return true;
      h.state().slots['session-1:grammar-1:0'] = [session.id, body.grammarId, 0,
        change.sentence || body.sentence, change.inputMode || body.inputMode,
        JSON.stringify(result), 'other-request', 'none_observed', true];
      return true;
    } });
    assert.deepEqual(response, { status: 409, body: { error: 'production_completed' } });
    assert.equal(h.state().attempts.length, 0);
    assert.equal(h.state().requests['user-1:request-1'].response, null);
    assert.equal(h.state().requests['user-1:request-1'].until, 0);
  }
});

test('failed slots can be corrected under a new request ID with consecutive ordinals', async () => {
  let n = 0;
  const h = harness(async () => ({ result: { ...result, correct: ++n > 1 }, evalSource: 'ai', model: 'test-model' }));
  assert.equal((await h.submit()).body.passed, false);
  assert.equal((await h.submit({ body: { ...body, requestId: 'retry', sentence: 'fixed' } })).body.passed, true);
  assert.equal(h.state().attempts.length, 2);
  assert.deepEqual(h.state().attempts.map(a => a.params[22]), [1, 2]);
  assert.equal(h.state().slots['session-1:grammar-1:0'][3], 'fixed');
});

test('current and historic production corrections taint evidence across sessions', async () => {
  const h = harness(async () => ({ result: { ...result, correction: 'corrected sentence' }, evalSource: 'ai', model: 'test-model' }));
  assert.equal((await h.submit()).body.assistanceState, 'correction_served');
  assert.equal(h.state().attempts[0].params[24], false);
  const older = harness();
  older.state().attempts.push({ user_id: user.id, grammar_id: body.grammarId, source: 'production',
    correction: 'previous correction', practice_session_id: 'expired-session' });
  assert.equal((await older.submit()).body.assistanceState, 'correction_served');
  assert.equal(older.state().attempts[1].params[22], 1);
  assert.equal(older.state().attempts[1].params[24], false);
  await older.submit({ body: { ...body, requestId: 'request-2', slot: 1 } });
  assert.equal(older.state().attempts[2].params[22], 2);
  assert.equal(Object.keys(older.state().slots).length, 2);
});

test('corrections for other grammars, users or sources do not taint the production', async () => {
  const h = harness();
  for (const change of [{ user_id: 'other' }, { grammar_id: 'other' }, { source: 'controlled' }, { correction: '  ' }]) {
    h.state().attempts.push({ user_id: user.id, grammar_id: body.grammarId, source: 'production', correction: 'correction', ...change });
  }
  assert.equal((await h.submit()).body.assistanceState, 'none_observed');
});

test('validates membership, slot, count and body before AI or persistence', async () => {
  const h = harness();
  for (const change of [{ grammarId: 'other' }, { slot: -1 }, { slot: 2 }, { slot: '0' },
    { sentence: '' }, { sentence: 'a'.repeat(201) }, { inputMode: 'other' }, { requestId: ' ' }]) {
    assert.ok((await h.submit({ body: { ...body, ...change } })).status >= 400);
  }
  assert.equal((await h.submit({ session: { ...session, production_snapshot: [] } })).status, 404);
  assert.equal((await h.submit({ session: { ...session, production_snapshot: [{ ...session.production_snapshot[0], fingerprint: null }] } })).status, 409);
  assert.equal(h.calls(), 0); assert.deepEqual(h.state().requests, {});
});

test('revocation after AI writes no evidence and releases the reservation for retry', async () => {
  const h = harness();
  let accessChecks = 0;
  assert.equal((await h.submit({ assertAccess: async () => ++accessChecks === 1 })).status, 403);
  assert.equal(accessChecks, 2);
  assert.equal(h.state().attempts.length, 0); assert.deepEqual(h.state().slots, {});
  assert.equal(h.state().requests['user-1:request-1'].response, null);
  assert.equal((await h.submit()).status, 200);
});

test('reservation rechecks access before writes, AI or replay', async () => {
  const h = harness();
  assert.equal((await h.submit({ assertAccess: async () => false })).status, 403);
  assert.deepEqual(h.state().requests, {});
  assert.equal(h.calls(), 0);
  await h.submit();
  const saved = structuredClone(h.state());
  assert.equal((await h.submit({ assertAccess: async () => false })).status, 403);
  assert.deepEqual(h.state(), saved);
  assert.equal(h.calls(), 1);
});

test('evaluation errors release the lease, preserve payload identity, and allow retry', async () => {
  let fail = true;
  const h = harness(async () => {
    if (fail) throw Object.assign(new Error('eval_timeout'), { status: 504 });
    return { result, evalSource: 'ai', model: 'test-model' };
  });
  assert.equal((await h.submit()).status, 504);
  assert.equal(h.state().attempts.length, 0);
  assert.equal((await h.submit({ body: { ...body, sentence: 'changed' } })).status, 409);
  fail = false;
  assert.equal((await h.submit()).status, 200);
});

test('failed slot, ledger or session writes roll back all evidence and permit a clean retry', async () => {
  for (const sql of ['INSERT INTO grammar_task_productions', 'UPDATE grammar_task_requests SET response', 'UPDATE grammar_task_sessions']) {
    const h = harness(); h.fail(sql);
    await assert.rejects(h.submit(), /injected write failure/);
    assert.equal(h.state().attempts.length, 0); assert.deepEqual(h.state().slots, {});
    assert.equal(h.state().requests['user-1:request-1'].response, null);
    h.fail(null);
    assert.equal((await h.submit()).status, 200);
    assert.equal(h.state().attempts.length, 1);
  }
});

test('lease expiry during finalization rolls back evidence', async () => {
  const h = harness();
  const response = await h.submit({ assertAccess: async () => { h.advance(PRODUCTION_LEASE_MS + 1); return true; } });
  assert.equal(response.body.error, 'evaluation_pending');
  assert.equal(h.state().attempts.length, 0); assert.deepEqual(h.state().slots, {});
});

test('shared evaluator applies input mode to cache results without recording attempts', async t => {
  const queries = [];
  t.mock.method(db, 'query', async sql => {
    queries.push(sql);
    return { rows: sql.startsWith('SELECT result') ? [{ result: { ...result, correct: false,
      errorTypes: ['transcription_issue'], primaryError: 'transcription_issue' } }] : [] };
  });
  const args = { grammar: session.production_snapshot[0], grammarId: body.grammarId, sentence: body.sentence };
  assert.equal((await evaluateGrammarSentence(args)).result.primaryError, 'other');
  assert.equal((await evaluateGrammarSentence({ ...args, inputMode: 'speech' })).result.primaryError, 'transcription_issue');
  assert.ok(queries.every(sql => !sql.includes('grammar_attempts')));
});

test('shared evaluator evaluates snapshot content, caches and returns normalized AI output', async t => {
  const queries = [];
  t.mock.method(db, 'query', async (sql, params) => { queries.push({ sql, params }); return { rows: [] }; });
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const request = JSON.parse(options.body);
    assert.ok(request.messages[0].content.includes('snapshot pattern'));
    assert.ok(request.messages[0].content.includes('snapshot instruction'));
    return { ok: true, json: async () => ({ content: [{ type: 'text', text: JSON.stringify(result) }] }) };
  });
  const evaluated = await evaluateGrammarSentence({ grammar: session.production_snapshot[0], grammarId: body.grammarId,
    instruction: 'snapshot instruction', sentence: body.sentence });
  assert.deepEqual(evaluated.result, result); assert.equal(evaluated.evalSource, 'ai');
  assert.equal(queries.filter(q => q.sql.startsWith('INSERT INTO grammar_eval_cache')).length, 1);
  assert.ok(queries.every(q => !q.sql.includes('grammar_attempts')));
});

test('snapshot evaluation cache separates content revisions and legacy evaluation', async t => {
  const keys = [];
  t.mock.method(db, 'query', async (sql, params) => {
    if (sql.startsWith('SELECT result')) { keys.push(params[0]); return { rows: [{ result }] }; }
    return { rows: [] };
  });
  const grammar = session.production_snapshot[0];
  const args = { grammarId: body.grammarId, sentence: body.sentence };
  for (const value of [grammar, { ...grammar, meaning: 'changed meaning' },
    { ...grammar, fingerprint: 'new fingerprint' }, { ...grammar, fingerprint: undefined }]) {
    await evaluateGrammarSentence({ ...args, grammar: value });
  }
  assert.equal(new Set(keys).size, 4);
});

test('shared evaluator bounds callClaude and rejects disabled evaluation with status', async t => {
  assert.ok(PRODUCTION_LEASE_MS > GRAMMAR_EVAL_TIMEOUT_MS);
  t.mock.method(db, 'query', async () => ({ rows: [] }));
  const started = defer();
  t.mock.method(globalThis, 'fetch', () => { started.resolve(); return new Promise(() => {}); });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const evaluating = evaluateGrammarSentence({ grammar: session.production_snapshot[0], grammarId: body.grammarId, sentence: body.sentence });
  const rejected = assert.rejects(evaluating, err => err.status === 504 && err.message === 'eval_timeout');
  await started.promise;
  t.mock.timers.tick(GRAMMAR_EVAL_TIMEOUT_MS);
  await rejected;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', `
    import { db } from './src/db.js';
    import { evaluateGrammarSentence } from './src/routes/grammar-task.js';
    db.query = async () => ({ rows: [] });
    try { await evaluateGrammarSentence({ grammar: {}, grammarId: 'g', sentence: 's' }); }
    catch (err) { console.log(err.status + ':' + err.message); }
  `], { cwd: new URL('../', import.meta.url), env: { ...process.env, ANTHROPIC_API_KEY: '' }, encoding: 'utf8' });
  assert.equal(output.trim(), '503:eval_disabled');
});

test('task concepts include production snapshot fields with case-preserved requiredCount', async t => {
  t.mock.method(db, 'query', async sql => {
    for (const field of ['g.example', 'g.example_dialog', 'g.example_dialog_id', 'gi.instruction', 'gi.required_count AS "requiredCount"']) {
      assert.ok(sql.includes(field));
    }
    return { rows: [] };
  });
  assert.deepEqual(await loadTaskConcepts('lesson-1'), []);
});
