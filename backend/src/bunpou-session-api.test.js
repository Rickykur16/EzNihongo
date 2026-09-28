// Run: node --test src/bunpou-session-api.test.js
// CI: TEST_DATABASE_URL must point to a local database with "test" in its name.
// Optional PGLITE_TEST_MODULE=file:///absolute/path/to/@electric-sql/pglite/dist/index.js.
// PostgreSQL uses a unique schema; PGlite uses memory. DATABASE_URL is never used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import express from 'express';
import pgDriver from 'pg';
import { createLearnerFlowTelemetry } from './learning-flow-telemetry.js';

const migrations = [
  '147_bunpou_flow_pilot.sql',
  '150_bunpou_flow_dialog_checks.sql',
  '152_bunpou_session_integrity.sql',
];

async function loadPGlite() {
  if (process.env.PGLITE_TEST_MODULE) {
    const url = new URL(process.env.PGLITE_TEST_MODULE);
    assert.equal(url.protocol, 'file:', 'PGLITE_TEST_MODULE must be an absolute file URL');
    return import(url.href);
  }
  return import('@electric-sql/pglite');
}

async function openTestDatabase(t) {
  if (process.env.TEST_DATABASE_URL) {
    const url = new URL(process.env.TEST_DATABASE_URL);
    assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
    assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Test database must be local');
    assert.match(decodeURIComponent(url.pathname), /test/i, 'Use an explicitly named disposable test database');
    assert.ok(!url.searchParams.has('host') && !url.searchParams.has('hostaddr'), 'Do not override the validated database host');
    const name = 'bunpou_session_test_' + randomUUID().replaceAll('-', '');
    const options = { connectionString: url.href, connectionTimeoutMillis: 5000, statement_timeout: 10000 };
    const control = new pgDriver.Client(options);
    const transaction = new pgDriver.Client(options);
    await control.connect();
    let transactionConnected = false;
    t.after(async () => {
      try {
        if (transactionConnected) {
          try { await transaction.query('ROLLBACK'); } finally { await transaction.end(); }
        }
      } finally {
        try {
          assert.match(name, /^bunpou_session_test_[a-f0-9]{32}$/);
          await control.query(`DROP SCHEMA IF EXISTS "${name}" CASCADE`);
        } finally { await control.end(); }
      }
    });
    await control.query(`CREATE SCHEMA "${name}"; SET search_path TO "${name}"`);
    await transaction.connect();
    transactionConnected = true;
    await transaction.query(`SET search_path TO "${name}"`);
    t.diagnostic('Database: PostgreSQL, isolated schema and separate transaction connection');
    return {
      query: (sql, params) => control.query(sql, params),
      exec: sql => control.query(sql),
      connect: async () => ({ query: (sql, params) => transaction.query(sql, params), release() {} }),
    };
  }
  let PGlite;
  try {
    ({ PGlite } = await loadPGlite());
  } catch (err) {
    if (!process.env.PGLITE_TEST_MODULE && err.code === 'ERR_MODULE_NOT_FOUND') {
      t.skip('Set TEST_DATABASE_URL, install @electric-sql/pglite, or set PGLITE_TEST_MODULE to its absolute file URL');
      return null;
    }
    throw err;
  }
  const database = new PGlite();
  t.after(() => database.close());
  t.diagnostic('Database: in-memory PGlite (sequential scenarios, single connection)');
  const query = async (sql, params = []) => {
    const result = await database.query(sql, params);
    return { ...result, rowCount: result.affectedRows ?? result.rows.length };
  };
  return { query, exec: sql => database.exec(sql), connect: async () => ({ query, release() {} }) };
}

// Only the pre-147 tables used by the real router/loaders/evaluator are fixtures.
// All session, request, production and evidence-metadata DDL comes from migrations.
const schema = `
  CREATE TABLE users (id UUID PRIMARY KEY, email TEXT NOT NULL);
  CREATE TABLE courses (
    id UUID PRIMARY KEY, title TEXT, level TEXT, is_published BOOLEAN, is_available BOOLEAN, sort_order INT DEFAULT 0
  );
  CREATE TABLE modules (
    id UUID PRIMARY KEY, course_id UUID NOT NULL REFERENCES courses(id), title TEXT, sort_order INT DEFAULT 0
  );
  CREATE TABLE course_prerequisites (
    course_id UUID NOT NULL REFERENCES courses(id),
    prerequisite_course_id UUID NOT NULL REFERENCES courses(id),
    PRIMARY KEY (course_id, prerequisite_course_id)
  );
  CREATE TABLE lessons (
    id UUID PRIMARY KEY, module_id UUID NOT NULL REFERENCES modules(id),
    type TEXT NOT NULL, popup_after_lesson_id UUID REFERENCES lessons(id), sort_order INT DEFAULT 0,
    title TEXT, video_url TEXT, video_source_id UUID
  );
  CREATE TABLE module_grammar (
    id UUID PRIMARY KEY, module_id UUID NOT NULL REFERENCES modules(id),
    lesson_id UUID REFERENCES lessons(id), pattern TEXT, meaning TEXT, example TEXT,
    example_dialog TEXT, example_dialog_id TEXT, communication_goal TEXT, dialog_scene JSONB,
    recognition_distractors TEXT, controlled_distractors TEXT, sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  -- Mirror of migration 165's grammar_dialog_questions (columns read by
  -- bunpou-dialog-checks.js): the 🎭 Dialog question set is the source of
  -- the dialog checks served by v1 sessions and Smart Review.
  CREATE TABLE grammar_dialog_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), grammar_id UUID NOT NULL REFERENCES module_grammar(id),
    source_lesson_id UUID NOT NULL REFERENCES lessons(id), kind TEXT NOT NULL CHECK (kind IN ('comprehension','transfer')),
    prompt TEXT NOT NULL, options JSONB NOT NULL, correct_index INT NOT NULL, explanation TEXT NOT NULL,
    evidence JSONB, sort_order INT NOT NULL DEFAULT 0, question_fingerprint TEXT NOT NULL,
    dialogue_fingerprint TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'active'
  );
  CREATE TABLE grammar_examples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), grammar_id UUID NOT NULL REFERENCES module_grammar(id),
    japanese TEXT, highlight TEXT, indonesian TEXT, sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE lesson_grammar_task_items (
    lesson_id UUID NOT NULL REFERENCES lessons(id), grammar_id UUID NOT NULL REFERENCES module_grammar(id),
    instruction TEXT, required_count INT DEFAULT 1, sort_order INT DEFAULT 0,
    PRIMARY KEY (lesson_id, grammar_id)
  );
  CREATE TABLE grammar_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id),
    grammar_id UUID NOT NULL REFERENCES module_grammar(id), lesson_id UUID REFERENCES lessons(id),
    source TEXT NOT NULL CHECK (source IN ('production', 'controlled', 'recognition')),
    input_mode TEXT NOT NULL CHECK (input_mode IN ('speech', 'text')), sentence TEXT NOT NULL,
    correct BOOLEAN NOT NULL, uses_pattern BOOLEAN NOT NULL, passed BOOLEAN NOT NULL,
    grammar_score SMALLINT CHECK (grammar_score BETWEEN 0 AND 100), primary_error TEXT,
    error_types TEXT[] NOT NULL DEFAULT '{}', severity TEXT, concept_signal TEXT,
    feedback TEXT, correction TEXT, model TEXT,
    eval_source TEXT NOT NULL CHECK (eval_source IN ('ai', 'cache', 'smart_review')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE grammar_eval_cache (
    eval_hash TEXT PRIMARY KEY, grammar_id UUID, sentence TEXT NOT NULL, result JSONB NOT NULL,
    model TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), last_used_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TIMESTAMPTZ DEFAULT NOW());
  CREATE TABLE user_enrollments (
    user_id UUID NOT NULL REFERENCES users(id), course_id UUID NOT NULL REFERENCES courses(id),
    status TEXT NOT NULL, expires_at TIMESTAMPTZ, PRIMARY KEY (user_id, course_id)
  );
  CREATE TABLE user_progress (
    user_id UUID NOT NULL REFERENCES users(id), lesson_id UUID NOT NULL REFERENCES lessons(id),
    completed BOOLEAN DEFAULT FALSE, completed_at TIMESTAMPTZ, note TEXT, updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, lesson_id)
  );
  CREATE TABLE admin_emails (email TEXT PRIMARY KEY);
`;

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const fixture = {
  userId: id(1), courseId: id(2), moduleId: id(3), sourceId: id(4), taskId: id(5),
  grammarId: id(6), otherGrammarId: id(7), email: 'session-fixture@example.invalid',
};
const sentence = '\u79c1\u306f\u5b66\u751f\u3067\u3059\u3002';
const hint = 'Perhatikan fungsi pola pada kalimat.';
const explanation = 'Pola ini menyatakan identitas.';

function assertKeyHidden(item) {
  for (const key of ['correctIndex', 'correctOrder', 'japanese', 'explanation', 'snapshot', 'answer']) {
    assert.equal(Object.hasOwn(item, key), false, `answer key leaked through ${key}`);
  }
}

test('Bunpou session API with real PostgreSQL SQL', { timeout: 90_000, concurrency: false }, async t => {
  const database = await openTestDatabase(t);
  if (!database) return;
  await database.exec(schema);
  const migrationSql = await Promise.all(migrations.map(name => readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8')));
  for (let pass = 0; pass < 2; pass++) {
    for (const sql of migrationSql) await database.exec(sql);
  }
  // This deliberately small pre-147 fixture cannot apply the full migration
  // 165 (which also adds unrelated curriculum tables). Mirror its session
  // column so this API suite exercises the current router SQL when PG exists.
  await database.exec(`ALTER TABLE grammar_task_sessions ADD COLUMN flow_version
    SMALLINT NOT NULL DEFAULT 1 CHECK (flow_version IN (1,2))`);

  const savedEnv = Object.fromEntries(['JWT_ACCESS_SECRET', 'ANTHROPIC_API_KEY', 'ADMIN_EMAILS'].map(key => [key, process.env[key]]));
  process.env.JWT_ACCESS_SECRET = 'synthetic-session-integration-secret-at-least-32-bytes';
  process.env.ANTHROPIC_API_KEY = '';
  process.env.ADMIN_EMAILS = '';
  t.after(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });

  const { db } = await import('./db.js');
  const { query } = database;
  // Real BEGIN/COMMIT/ROLLBACK; PostgreSQL keeps transaction-local work on
  // a dedicated connection. No SQL, entitlement or evaluator is stubbed.
  t.mock.method(db, 'query', query);
  t.mock.method(db, 'connect', database.connect);
  const { default: router } = await import('./routes/grammar-task-sessions.js');
  const { signAccessToken } = await import('./auth.js');
  const { loadTaskConcepts, loadModulePool } = await import('./routes/grammar-task.js');
  const { contentRevisionId, sessionRevisionId } = await import('./bunpou-flow-service.js');
  const { ANTHROPIC_MODEL } = await import('./anthropic.js');
  const { loadCompanionLessonOptions, liveCompanionContexts } = await import('./bunpou-companion-status.js');
  const { assertUserTablesCovered } = await import('./user-erasure.js');
  const token = await signAccessToken(fixture.userId, fixture.email);
  const errors = [];
  const telemetry = [];
  const app = express();
  app.use(express.json());
  app.use('/api', createLearnerFlowTelemetry({ logger: event => telemetry.push(event) }));
  app.use('/api', router);
  app.use((err, req, res, next) => {
    errors.push(err);
    res.status(err.status || 500).json({ error: err.message });
  });
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => {
    server.close(err => err ? reject(err) : resolve());
    server.closeAllConnections();
  }));
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/grammar-task/sessions`;
  const realFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', (url, options) => {
    assert.ok(String(url).startsWith(base), 'integration tests must not contact external services');
    return realFetch(url, options);
  });

  async function api(path = '', body, expected = 200) {
    const response = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await response.json();
    assert.equal(response.status, expected, `${body === undefined ? 'GET' : 'POST'} ${path}: ${JSON.stringify(data)}`);
    return data;
  }
  const create = (expected = 200) => api('', { sourceLessonId: fixture.sourceId }, expected);
  const itemPath = (session, item, operation) => `/${session.sessionId}/items/${item.itemId}/${operation}`;
  const answer = (session, item, optionIndex, requestId, expected = 200) =>
    api(itemPath(session, item, 'answer'), { optionIndex, requestId }, expected);
  const firstItem = session => {
    const item = session.items.find(row => row.grammarId === fixture.grammarId && row.step === 1);
    assert.ok(item, 'synthetic content must produce a recognition item');
    return item;
  };
  const storedItem = async item => (await query('SELECT * FROM grammar_task_session_items WHERE item_id = $1', [item.itemId])).rows[0];
  const correctIndex = async item => (await storedItem(item)).snapshot.correctIndex;
  const wrongIndex = async item => ((await correctIndex(item)) + 1) % item.options.length;
  async function state(tables = ['grammar_task_sessions', 'grammar_task_session_items', 'grammar_task_requests', 'grammar_attempts', 'grammar_task_productions']) {
    const snapshot = {};
    for (const table of tables) {
      snapshot[table] = (await query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;
    }
    return snapshot;
  }
  const sourceAndProgress = () => state(['courses', 'modules', 'lessons', 'module_grammar',
    'grammar_examples', 'lesson_grammar_task_items', 'user_progress']);
  let published;
  let fingerprint;
  t.beforeEach(async () => {
    errors.length = 0;
    telemetry.length = 0;
    await database.exec(`TRUNCATE users, courses, modules, lessons, module_grammar, grammar_examples,
      lesson_grammar_task_items, grammar_attempts, grammar_eval_cache, app_settings,
      user_enrollments, user_progress, admin_emails CASCADE`);
    await query('INSERT INTO users (id,email) VALUES ($1,$2)', [fixture.userId, fixture.email]);
    await query("INSERT INTO courses (id,title,level,is_published,is_available) VALUES ($1,'Synthetic N5','N5',true,true)", [fixture.courseId]);
    await query("INSERT INTO modules (id,course_id,title) VALUES ($1,$2,'Synthetic module')", [fixture.moduleId, fixture.courseId]);
    await query(`INSERT INTO lessons (id,module_id,type,title,video_url)
      VALUES ($1,$2,'video','Synthetic lesson','https://example.invalid/fixture.mp4')`, [fixture.sourceId, fixture.moduleId]);
    await query("INSERT INTO lessons (id,module_id,type,popup_after_lesson_id) VALUES ($1,$2,'grammar_task',$3)",
      [fixture.taskId, fixture.moduleId, fixture.sourceId]);
    for (const [index, grammarId] of [fixture.grammarId, fixture.otherGrammarId].entries()) {
      await query(`INSERT INTO module_grammar
        (id,module_id,lesson_id,pattern,meaning,example,recognition_distractors,sort_order)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [grammarId, fixture.moduleId, fixture.sourceId,
        '\u301c\u306f\u301c\u3067\u3059', 'Menyatakan identitas seseorang.', sentence,
        ['Menjelaskan tujuan perjalanan.', 'Menandai waktu kejadian.', 'Menyatakan kepemilikan barang.'].join('\n'), index]);
      await query('INSERT INTO grammar_examples (grammar_id,japanese,highlight,indonesian) VALUES ($1,$2,$3,$4)',
        [grammarId, index === 0 ? sentence : '\u79c1\u306f \u5b66\u751f \u3067\u3059\u3002', '\u3067\u3059', 'Saya adalah pelajar.']);
      await query(`INSERT INTO lesson_grammar_task_items (lesson_id,grammar_id,instruction,required_count,sort_order)
        VALUES ($1,$2,'Buat kalimat tentang identitas.',2,$3)`, [fixture.taskId, grammarId, index]);
    }
    await query('UPDATE module_grammar SET example_dialog = $1', [`A: ${sentence}\nB: ${sentence}`]);
    await query("INSERT INTO user_enrollments (user_id,course_id,status) VALUES ($1,$2,'active')", [fixture.userId, fixture.courseId]);
    await query("INSERT INTO user_progress (user_id,lesson_id,completed,note) VALUES ($1,$2,false,'Keep original lesson progress')", [fixture.userId, fixture.sourceId]);
    fingerprint = contentRevisionId(await loadTaskConcepts(fixture.taskId), await loadModulePool(fixture.taskId));
    published = {
      schemaVersion: 1, sourceFingerprint: fingerprint, objective: 'Memperkenalkan identitas.',
      overlays: { [fixture.grammarId]: { step1: { hint, explanation } } },
      dialogChecks: { [fixture.grammarId]: {
        comprehension: { prompt: 'Siapa pelajar?', options: ['Aki', 'Rin', 'Sora'], correctIndex: 0 },
        comparison: { prompt: 'Siapa guru?', options: ['Mika', 'Ren', 'Yui'], correctIndex: 1 },
      } },
    };
    await query('UPDATE lessons SET bunpou_flow_published = $2 WHERE id = $1', [fixture.sourceId, JSON.stringify(published)]);
  });

  await t.test('migrations apply twice and create/resume uses source and publication fingerprints', async () => {
    const session = await create();
    assert.equal(session.taskLessonId, fixture.taskId);
    assert.equal(session.contentChanged, false);
    assert.deepEqual(session.productions, []);
    firstItem(session);
    assert.ok(session.items.some(item => item.step === 4), 'migration 150 permits dialog comprehension');
    assert.ok(session.items.some(item => item.step === 5), 'migration 150 permits dialog comparison');
    for (const item of session.items) assertKeyHidden(item);
    const saved = (await query('SELECT * FROM grammar_task_sessions WHERE id = $1', [session.sessionId])).rows[0];
    assert.equal(saved.content_revision_id, sessionRevisionId(fingerprint, published));
    assert.equal(saved.production_snapshot.length, 2);
    assert.deepEqual(await create(), session);
    assert.deepEqual(await api(`/${session.sessionId}`), session);
    assert.equal((await query('SELECT COUNT(*)::int AS n FROM grammar_task_sessions')).rows[0].n, 1);
  });

  await t.test('first error hides the key, hints persist, reveal needs two errors, and exposure survives expiry', async () => {
    const immutable = await sourceAndProgress();
    const session = await create();
    const item = firstItem(session);
    const wrong = await wrongIndex(item);
    const first = await answer(session, item, wrong, 'wrong-1');
    assert.equal(first.wrongCount, 1);
    assert.equal(first.revealEligible, false);
    assertKeyHidden(first);
    assert.deepEqual(await api(itemPath(session, item, 'reveal'), { wrongCount: 99 }, 403), { error: 'reveal_not_eligible' });
    assert.deepEqual(await api(itemPath(session, item, 'hint'), {}), { available: true, hint });
    const hintTime = (await storedItem(item)).hint_served_at;
    await api(itemPath(session, item, 'hint'), {});
    assert.deepEqual((await storedItem(item)).hint_served_at, hintTime);
    const resumed = firstItem(await api(`/${session.sessionId}`));
    assert.equal(resumed.hint, hint);
    assert.equal(resumed.hintAvailable, false);
    assert.equal(resumed.wrongCount, 1);
    assertKeyHidden(resumed);
    const second = await answer(session, item, wrong, 'wrong-2');
    assert.equal(second.wrongCount, 2);
    assert.equal(second.revealEligible, true);
    assert.equal(second.assistanceState, 'hint_served');
    assert.equal(second.independentEligible, false);
    assertKeyHidden(second);
    const revealed = await api(itemPath(session, item, 'reveal'), {});
    assert.equal(revealed.revealed, true);
    assert.equal(revealed.correctIndex, await correctIndex(item));
    assert.equal(revealed.explanation, explanation);
    await query("UPDATE grammar_task_sessions SET expires_at = NOW() - interval '1 minute' WHERE id = $1", [session.sessionId]);
    assert.deepEqual(await api(`/${session.sessionId}`, undefined, 410), { error: 'session_expired' });
    const fresh = await create();
    const freshItem = firstItem(fresh);
    assert.notEqual(fresh.sessionId, session.sessionId);
    assert.equal((await storedItem(freshItem)).question_fingerprint, (await storedItem(item)).question_fingerprint);
    const passed = await answer(fresh, freshItem, await correctIndex(freshItem), 'fresh-correct');
    assert.equal(passed.passed, true);
    assert.equal(passed.assistanceState, 'answer_served');
    assert.equal(passed.independentEligible, false);
    const attempt = (await query('SELECT * FROM grammar_attempts WHERE request_id = $1', ['fresh-correct'])).rows[0];
    assert.equal(attempt.passed, true);
    assert.equal(attempt.independent_eligible, false);
    assert.equal(attempt.assistance_state, 'answer_served');
    assert.equal(attempt.evaluation_kind, 'deterministic');
    assert.deepEqual(await sourceAndProgress(), immutable);
  });

  await t.test('a hint alone in an expired session still prevents independent evidence', async () => {
    const old = await create();
    await api(itemPath(old, firstItem(old), 'hint'), {});
    await query("UPDATE grammar_task_sessions SET expires_at = NOW() - interval '1 minute' WHERE id = $1", [old.sessionId]);
    const fresh = await create();
    const item = firstItem(fresh);
    const response = await answer(fresh, item, await correctIndex(item), 'after-hint');
    assert.equal(response.assistanceState, 'hint_served');
    assert.equal(response.independentEligible, false);
    assert.equal((await query('SELECT independent_eligible FROM grammar_attempts')).rows[0].independent_eligible, false);
  });

  await t.test('A wrong, B wrong, replay A returns its original response without further mutation', async () => {
    const session = await create();
    const item = firstItem(session);
    const wrong = await wrongIndex(item);
    const a = await answer(session, item, wrong, 'request-A');
    const b = await answer(session, item, wrong, 'request-B');
    assert.equal(a.wrongCount, 1);
    assert.equal(b.wrongCount, 2);
    const before = await state();
    assert.deepEqual(await answer(session, item, wrong, 'request-A'), a);
    assert.deepEqual(telemetry.filter(event => event.operation === 'session_answer')
      .map(event => event.outcome), ['success', 'success', 'idempotent_replay']);
    assert.doesNotMatch(JSON.stringify(telemetry), /request-A|request-B|student@example|answerText|correctIndex/);
    assert.deepEqual(await state(), before);
    assert.equal((await storedItem(item)).wrong_count, 2);
    assert.equal(before.grammar_attempts.length, 2);
    assert.equal(before.grammar_task_requests.length, 2);
  });

  await t.test('the same request ID with a different payload or item returns 409 without mutation', async () => {
    const session = await create();
    const item = firstItem(session);
    await answer(session, item, await wrongIndex(item), 'conflicting-request');
    const before = await state();
    assert.deepEqual(await answer(session, item, await correctIndex(item), 'conflicting-request', 409), { error: 'request_id_conflict' });
    assert.deepEqual(await state(), before);
    const other = session.items.find(row => row.step === 1 && row.itemId !== item.itemId);
    assert.ok(other);
    assert.deepEqual(await answer(session, other, await wrongIndex(other), 'conflicting-request', 409), { error: 'request_id_conflict' });
    assert.deepEqual(await state(), before);
  });

  await t.test('malformed choice and arrange answers return 400 before any evidence or progress mutation', async () => {
    const session = await create();
    const item = firstItem(session);
    const before = await state();
    const immutable = await sourceAndProgress();
    for (const optionIndex of [null, '', '0', true, 0.5, -1, item.options.length]) {
      await answer(session, item, optionIndex, 'invalid-choice', 400);
      assert.deepEqual(await state(), before);
    }
    const arrange = session.items.find(row => row.variant === 'arrange');
    assert.ok(arrange, 'synthetic fixture must derive an arrange item');
    const order = arrange.tokens.map((_, index) => index);
    for (const malformed of [[], order.slice(1), order.map(() => 0), order.map(String), [...order.slice(1), order.length]]) {
      const response = await api(itemPath(session, arrange, 'answer'), { order: malformed, requestId: 'invalid-order' }, 400);
      assert.equal(response.error, 'invalid_order');
      assert.deepEqual(await state(), before);
    }
    assert.deepEqual(await sourceAndProgress(), immutable);
  });

  for (const table of ['grammar_attempts', 'grammar_task_requests']) {
    await t.test(`a forced ${table} insert failure rolls back the answer, evidence and response together`, async () => {
      const session = await create();
      const item = firstItem(session);
      const before = await state();
      // A real PostgreSQL exception aborts the transaction, including writes
      // performed before the failing INSERT. The adapter does not fake failure.
      await database.exec(`CREATE FUNCTION reject_test_insert() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'forced integration insert failure'; END $$;
        CREATE TRIGGER reject_test_insert BEFORE INSERT ON ${table}
        FOR EACH ROW EXECUTE FUNCTION reject_test_insert()`);
      try {
        const response = await answer(session, item, await wrongIndex(item), 'retry-after-rollback', 500);
        assert.match(response.error, /forced integration insert failure/);
        assert.equal(errors.length, 1);
        assert.deepEqual(await state(), before);
      } finally {
        await database.exec(`DROP TRIGGER reject_test_insert ON ${table}; DROP FUNCTION reject_test_insert()`);
      }
      const retry = await answer(session, item, await wrongIndex(item), 'retry-after-rollback');
      assert.equal(retry.wrongCount, 1);
      const after = await state();
      assert.equal(after.grammar_attempts.length, 1);
      assert.equal(after.grammar_task_requests.length, 1);
      assert.deepEqual(after.grammar_task_requests[0].row.response, retry);
    });
  }

  await t.test('revoked enrollment blocks resume and every session mutation', async () => {
    const session = await create();
    const item = firstItem(session);
    await query("UPDATE user_enrollments SET status = 'revoked' WHERE user_id = $1", [fixture.userId]);
    const before = await state();
    const denied = { error: 'not_enrolled' };
    assert.deepEqual(await api(`/${session.sessionId}`, undefined, 403), denied);
    assert.deepEqual(await create(403), denied);
    assert.deepEqual(await answer(session, item, await correctIndex(item), 'revoked', 403), denied);
    assert.deepEqual(await api(itemPath(session, item, 'hint'), {}, 403), denied);
    assert.deepEqual(await api(itemPath(session, item, 'reveal'), {}, 403), denied);
    assert.deepEqual(await api(`/${session.sessionId}/production`, {
      grammarId: fixture.grammarId, slot: 0, sentence, requestId: 'revoked-production',
    }, 403), denied);
    assert.deepEqual(await state(), before);
  });

  await t.test('editing source content invalidates publication and rejects a new session', async () => {
    const session = await create();
    const before = await state();
    await query('UPDATE module_grammar SET meaning = $2 WHERE id = $1', [fixture.grammarId, 'Arti yang baru diedit.']);
    assert.deepEqual(await create(409), { error: 'companion_needs_review' });
    assert.equal((await api(`/${session.sessionId}`)).contentChanged, true);
    assert.deepEqual(await state(), before);
  });

  await t.test('publication-only edits create a new revision while old snapshots retain their content', async () => {
    const old = await create();
    const oldRow = (await query('SELECT * FROM grammar_task_sessions WHERE id = $1', [old.sessionId])).rows[0];
    const updated = structuredClone(published);
    updated.objective = 'Tujuan publikasi yang direvisi.';
    updated.overlays[fixture.grammarId].step1.hint = 'Petunjuk publikasi baru.';
    await query('UPDATE lessons SET bunpou_flow_published = $2 WHERE id = $1', [fixture.sourceId, JSON.stringify(updated)]);
    assert.equal(contentRevisionId(await loadTaskConcepts(fixture.taskId), await loadModulePool(fixture.taskId)), fingerprint);
    assert.equal((await api(`/${old.sessionId}`)).contentChanged, true);
    const fresh = await create();
    assert.notEqual(fresh.sessionId, old.sessionId);
    assert.equal(fresh.contentChanged, true);
    const row = (await query('SELECT * FROM grammar_task_sessions WHERE id = $1', [fresh.sessionId])).rows[0];
    assert.equal(row.content_revision_id, sessionRevisionId(fingerprint, updated));
    assert.notEqual(row.content_revision_id, oldRow.content_revision_id);
    assert.equal((await api(itemPath(fresh, firstItem(fresh), 'hint'), {})).hint, 'Petunjuk publikasi baru.');
    assert.equal((await api(itemPath(old, firstItem(old), 'hint'), {})).hint, hint);
    assert.equal((await create()).sessionId, fresh.sessionId);
  });

  await t.test('companion status marks complete published N5 video lessons live and explains unavailable or stale entries', async () => {
    assert.deepEqual(await loadCompanionLessonOptions(), [{
      id: fixture.sourceId, title: 'Synthetic lesson', moduleTitle: 'Synthetic module',
      courseTitle: 'Synthetic N5', published: true, live: true, reason: null, eligible: true,
    }]);
    await query("UPDATE courses SET level = 'N4' WHERE id = $1", [fixture.courseId]);
    let option = (await loadCompanionLessonOptions())[0];
    assert.equal(option.live, false);
    assert.equal(option.eligible, false, 'non-N5 lessons are marked so the admin picker can hide them');
    assert.match(option.reason, /N5/);
    await query("UPDATE courses SET level = 'N5', is_available = false WHERE id = $1", [fixture.courseId]);
    option = (await loadCompanionLessonOptions())[0];
    assert.equal(option.live, false);
    assert.match(option.reason, /Course belum aktif/);
    await query('UPDATE courses SET is_available = true WHERE id = $1', [fixture.courseId]);
    await query("UPDATE lessons SET video_url = '' WHERE id = $1", [fixture.sourceId]);
    option = (await loadCompanionLessonOptions())[0];
    assert.equal(option.live, false);
    assert.match(option.reason, /Video/);
    await query("UPDATE lessons SET video_url = 'https://example.invalid/fixture.mp4' WHERE id = $1", [fixture.sourceId]);
    await query("UPDATE module_grammar SET example_dialog = 'Edited source dialogue' WHERE id = $1", [fixture.grammarId]);
    option = (await loadCompanionLessonOptions())[0];
    assert.equal(option.live, false);
    assert.equal(option.published, true);
    assert.match(option.reason, /ditinjau/);
    await query('UPDATE lessons SET bunpou_flow_published = NULL WHERE id = $1', [fixture.sourceId]);
    option = (await loadCompanionLessonOptions())[0];
    assert.deepEqual([option.published, option.live], [false, false]);
    assert.match(option.reason, /belum dipublikasikan/);
  });

  await t.test('publishing is going live: no pilot setting exists or is needed', async () => {
    assert.equal((await query('SELECT count(*)::int AS n FROM app_settings')).rows[0].n, 0);
    const session = await create();
    assert.equal(session.flowVersion, 1);
    assert.ok(session.items.length > 0);
  });

  await t.test('two published lessons in one chapter are live at the same time', async () => {
    const [secondSource, secondTask, secondGrammar] = [id(40), id(41), id(42)];
    await query(`INSERT INTO lessons (id,module_id,type,title,video_url)
      VALUES ($1,$2,'video','Second lesson','https://example.invalid/second.mp4')`, [secondSource, fixture.moduleId]);
    await query("INSERT INTO lessons (id,module_id,type,popup_after_lesson_id) VALUES ($1,$2,'grammar_task',$3)",
      [secondTask, fixture.moduleId, secondSource]);
    await query(`INSERT INTO module_grammar
      (id,module_id,lesson_id,pattern,meaning,example,example_dialog,recognition_distractors,sort_order)
      SELECT $1,module_id,$2,pattern,meaning,example,example_dialog,recognition_distractors,5
      FROM module_grammar WHERE id = $3`, [secondGrammar, secondSource, fixture.grammarId]);
    await query(`INSERT INTO grammar_examples (grammar_id,japanese,highlight,indonesian)
      SELECT $1,japanese,highlight,indonesian FROM grammar_examples WHERE grammar_id = $2`, [secondGrammar, fixture.grammarId]);
    await query(`INSERT INTO lesson_grammar_task_items (lesson_id,grammar_id,instruction,required_count)
      VALUES ($1,$2,'Buat kalimat.',1)`, [secondTask, secondGrammar]);
    // The chapter's grammar is the distractor pool of every task in it, so
    // adding (or editing) a pattern anywhere in the chapter makes the first
    // lesson's reviewed questions stale too — it stops showing until it is
    // reviewed and republished, instead of serving unreviewed questions.
    assert.deepEqual([...(await liveCompanionContexts([fixture.sourceId, secondSource])).keys()], []);
    assert.match((await loadCompanionLessonOptions()).find(row => row.id === fixture.sourceId).reason, /ditinjau/);
    const republish = async (sourceId, taskId, objective) => query(
      'UPDATE lessons SET bunpou_flow_published = $2 WHERE id = $1', [sourceId, JSON.stringify({
        schemaVersion: 1, objective,
        sourceFingerprint: contentRevisionId(await loadTaskConcepts(taskId), await loadModulePool(taskId)) })]);
    await republish(fixture.sourceId, fixture.taskId, 'Tujuan pertama.');
    assert.deepEqual([...(await liveCompanionContexts([fixture.sourceId, secondSource])).keys()],
      [fixture.sourceId], 'an unpublished lesson is not live');
    // Publishing one lesson does not touch grammar content, so it never makes
    // the other lesson in the chapter stale.
    await republish(secondSource, secondTask, 'Tujuan kedua.');
    const both = await liveCompanionContexts([fixture.sourceId, secondSource]);
    assert.deepEqual([...both.keys()].sort(), [fixture.sourceId, secondSource].sort());
    assert.equal(both.get(secondSource).published.objective, 'Tujuan kedua.');
    assert.equal(both.get(secondSource).taskLessonId, secondTask);
    const options = await loadCompanionLessonOptions();
    assert.deepEqual(options.map(row => [row.title, row.live]).sort(), [['Second lesson', true], ['Synthetic lesson', true]]);
  });

  await t.test('the 🎭 Dialog question set replaces the old companion questions, one pattern at a time', async () => {
    const { dialogueFingerprint, questionFingerprint } = await import('./dialogue-question-service.js');
    const grammar = (await query('SELECT * FROM module_grammar WHERE id = $1', [fixture.grammarId])).rows[0];
    const insert = question => query(`INSERT INTO grammar_dialog_questions
        (grammar_id, source_lesson_id, kind, prompt, options, correct_index, explanation, evidence,
         sort_order, question_fingerprint, dialogue_fingerprint)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10)`, [fixture.grammarId, fixture.sourceId, question.kind,
      question.prompt, JSON.stringify(question.options), question.correctIndex, question.explanation,
      question.evidence ? JSON.stringify(question.evidence) : null, questionFingerprint(question),
      dialogueFingerprint(grammar)]);
    const checkPrompts = session => session.items.filter(item => item.step >= 4)
      .map(item => [item.grammarId, item.step, item.prompt]);
    // Before anything is moved, the old companion questions are served.
    assert.deepEqual(checkPrompts(await create()), [
      [fixture.grammarId, 4, 'Siapa pelajar?'], [fixture.grammarId, 5, 'Siapa guru?']]);
    await query('DELETE FROM grammar_task_sessions');
    // Half-moved: the old questions must not reappear next to a new set.
    await insert({ kind: 'comprehension', prompt: 'Apa yang dikatakan penutur kedua?',
      options: ['Memperkenalkan diri', 'Menolak ajakan', 'Menanyakan jalan'], correctIndex: 0,
      explanation: 'Penutur kedua menyebut identitasnya.', evidence: [{ turnIndex: 1, quote: sentence }] });
    assert.deepEqual(checkPrompts(await create()), []);
    await insert({ kind: 'transfer', prompt: 'Pilih kalimat yang memakai pola yang sama.',
      options: ['\u79c1\u306f\u533b\u8005\u3067\u3059\u3002', '\u533b\u8005\u3067\u3057\u305f\u3002', '\u533b\u8005\u306e\u672c\u3002'],
      correctIndex: 0, explanation: 'Pola A は B です.' });
    const session = await create();
    assert.equal(session.contentChanged, true, 'a changed question set starts a fresh session');
    assert.deepEqual(checkPrompts(session), [
      [fixture.grammarId, 4, 'Apa yang dikatakan penutur kedua?'],
      [fixture.grammarId, 5, 'Pilih kalimat yang memakai pola yang sama.']]);
    const stored = (await query('SELECT content_revision_id FROM grammar_task_sessions WHERE id = $1', [session.sessionId])).rows[0];
    assert.notEqual(stored.content_revision_id, sessionRevisionId(fingerprint, published));
    assert.equal((await create()).sessionId, session.sessionId, 'an unchanged set resumes the same session');
    const item = session.items.find(row => row.step === 4);
    assertKeyHidden(item);
    const answered = await answer(session, item, 0, randomUUID());
    assert.equal(answered.passed, true, 'graded against the question set answer key');
  });

  await t.test('a published companion that stops being live falls back to legacy drills for new sessions', async () => {
    await query("UPDATE lessons SET video_url = '' WHERE id = $1", [fixture.sourceId]);
    assert.equal((await create(403)).error, 'pilot_not_enabled_for_lesson');
    await query("UPDATE lessons SET video_url = 'https://example.invalid/fixture.mp4' WHERE id = $1", [fixture.sourceId]);
    await query('UPDATE lessons SET bunpou_flow_published = NULL WHERE id = $1', [fixture.sourceId]);
    assert.equal((await create(403)).error, 'pilot_not_enabled_for_lesson');
    assert.equal((await query('SELECT count(*)::int AS n FROM grammar_task_sessions')).rows[0].n, 0);
  });

  await t.test('withdrawing the publication stops an already running v1 session', async () => {
    const session = await create();
    const item = firstItem(session);
    await api(`/${session.sessionId}`);
    await query('UPDATE lessons SET bunpou_flow_published = NULL WHERE id = $1', [fixture.sourceId]);
    assert.equal((await api(`/${session.sessionId}`, undefined, 403)).error, 'pilot_not_enabled_for_lesson');
    assert.equal((await api(itemPath(session, item, 'hint'), {}, 403)).error, 'pilot_not_enabled_for_lesson');
    assert.equal((await answer(session, item, await correctIndex(item), randomUUID(), 403)).error,
      'pilot_not_enabled_for_lesson');
  });

  await t.test('a source edit after publishing keeps a running v1 session on its stored snapshot', async () => {
    const session = await create();
    await query("UPDATE module_grammar SET example_dialog = 'Edited source dialogue' WHERE id = $1", [fixture.grammarId]);
    const resumed = await api(`/${session.sessionId}`);
    assert.equal(resumed.sessionId, session.sessionId);
    assert.equal((await create(409)).error, 'companion_needs_review');
  });

  await t.test('the user-erasure coverage guard recognizes the real request-table foreign key', async () => {
    await assert.doesNotReject(() => assertUserTablesCovered({ query }));
    const references = (await query(`SELECT conname FROM pg_constraint
      WHERE conrelid = 'grammar_task_requests'::regclass AND confrelid = 'users'::regclass`)).rows;
    assert.equal(references.length, 1);
  });

  await t.test('cached productions resume and replay; session deletion cascades slots and request responses', async () => {
    const immutable = await sourceAndProgress();
    const session = await create();
    const stored = (await query('SELECT * FROM grammar_task_sessions WHERE id = $1', [session.sessionId])).rows[0];
    const grammar = stored.production_snapshot.find(row => row.grammarId === fixture.grammarId);
    const evaluated = [
      { sentence: '\u79c1\u304c\u5b66\u751f\u3067\u3059\u3002', correct: false, correction: sentence },
      { sentence, correct: true, correction: '' },
    ];
    for (const [slot, evaluation] of evaluated.entries()) {
      const result = { correct: evaluation.correct, usesPattern: true, feedback: 'Synthetic cached feedback.',
        correction: evaluation.correction, grammarScore: evaluation.correct ? 100 : 40,
        primaryError: evaluation.correct ? null : 'wrong_particle',
        errorTypes: evaluation.correct ? [] : ['wrong_particle'],
        severity: evaluation.correct ? 'none' : 'minor', conceptSignal: evaluation.correct ? 'solid' : 'shaky' };
      const identity = `grammar-eval-snapshot-v1|${JSON.stringify([ANTHROPIC_MODEL, fixture.grammarId, grammar.fingerprint,
        grammar.pattern, grammar.meaning, grammar.example, grammar.instruction, evaluation.sentence])}`;
      const hash = createHash('sha256').update(identity).digest('hex');
      await query('INSERT INTO grammar_eval_cache (eval_hash,grammar_id,sentence,result,model) VALUES ($1,$2,$3,$4,$5)',
        [hash, fixture.grammarId, evaluation.sentence, JSON.stringify(result), ANTHROPIC_MODEL]);
      const body = { grammarId: fixture.grammarId, slot, sentence: evaluation.sentence, inputMode: 'text', requestId: `production-${slot}` };
      const response = await api(`/${session.sessionId}/production`, body);
      assert.equal(response.saved, true);
      assert.equal(response.passed, evaluation.correct);
      assert.equal(response.assistanceState, 'correction_served');
      const before = await state();
      const request = before.grammar_task_requests.find(row => row.row.request_id === body.requestId).row;
      assert.equal(request.grammar_id, fixture.grammarId);
      assert.equal(request.production_slot, slot);
      assert.deepEqual(await api(`/${session.sessionId}/production`, body), response);
      assert.deepEqual(await state(), before);
      assert.deepEqual(await api(`/${session.sessionId}/production`, { ...body, sentence: 'Different payload.' }, 409), { error: 'request_id_conflict' });
      assert.deepEqual(await state(), before);
    }
    const resumed = await api(`/${session.sessionId}`);
    assert.equal(resumed.productions.length, 2);
    assert.deepEqual(resumed.productions.map(row => [row.slot, row.sentence, row.passed]),
      evaluated.map((row, slot) => [slot, row.sentence, row.correct]));
    assert.deepEqual((await create()).productions, resumed.productions);
    const attempts = (await query("SELECT * FROM grammar_attempts WHERE source = 'production' ORDER BY attempt_ordinal")).rows;
    assert.equal(attempts.length, 2);
    for (const attempt of attempts) {
      assert.equal(attempt.eval_source, 'cache');
      assert.equal(attempt.evaluation_kind, 'ai');
      assert.equal(attempt.assistance_state, 'correction_served');
      assert.equal(attempt.independent_eligible, false);
      assert.equal(attempt.content_revision_id, stored.content_revision_id);
    }
    assert.equal(errors.length, 0);
    assert.deepEqual(await sourceAndProgress(), immutable);
    assert.equal((await query('SELECT COUNT(*)::int AS n FROM grammar_task_requests')).rows[0].n, 2);
    await query('DELETE FROM grammar_task_sessions WHERE id = $1', [session.sessionId]);
    for (const table of ['grammar_task_session_items', 'grammar_task_productions', 'grammar_task_requests']) {
      assert.equal((await query(`SELECT COUNT(*)::int AS n FROM ${table}`)).rows[0].n, 0, `${table} must cascade on session deletion`);
    }
    const retained = (await query("SELECT * FROM grammar_attempts WHERE source = 'production' ORDER BY attempt_ordinal")).rows;
    assert.deepEqual(retained, attempts.map(attempt => ({ ...attempt, practice_session_id: null })));
    assert.deepEqual(await sourceAndProgress(), immutable);
  });
});
