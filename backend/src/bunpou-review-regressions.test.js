import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pgDriver from 'pg';

// Independent regressions for course scope, access races, erasure, publishing,
// and pilot readiness. All database fixtures are disposable and local.
const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

// CI uses TEST_DATABASE_URL, never DATABASE_URL. One connection preserves the
// deliberate ordering of the transaction/wait hooks below in either backend.
async function openTestDatabase(t) {
  if (process.env.TEST_DATABASE_URL) {
    const url = new URL(process.env.TEST_DATABASE_URL);
    assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
    assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Test database must be local');
    assert.match(decodeURIComponent(url.pathname), /test/i, 'Use an explicitly named disposable test database');
    assert.ok(!url.searchParams.has('host') && !url.searchParams.has('hostaddr'), 'Do not override the validated database host');
    const name = 'bunpou_review_test_' + randomUUID().replaceAll('-', '');
    const client = new pgDriver.Client({ connectionString: url.href,
      connectionTimeoutMillis: 5000, statement_timeout: 10000 });
    await client.connect();
    t.after(async () => {
      try {
        try { await client.query('ROLLBACK'); }
        finally {
          assert.match(name, /^bunpou_review_test_[a-f0-9]{32}$/);
          await client.query(`DROP SCHEMA IF EXISTS "${name}" CASCADE`);
        }
      } finally { await client.end(); }
    });
    await client.query(`CREATE SCHEMA "${name}"`);
    await client.query(`SET search_path TO "${name}"`);
    t.diagnostic('Database: PostgreSQL, isolated schema and one serial connection');
    return { query: (sql, params) => client.query(sql, params), exec: sql => client.query(sql) };
  }
  let PGlite;
  try {
    if (process.env.PGLITE_TEST_MODULE) {
      const url = new URL(process.env.PGLITE_TEST_MODULE);
      assert.equal(url.protocol, 'file:', 'PGLITE_TEST_MODULE must be an absolute file URL');
      ({ PGlite } = await import(url.href));
    } else {
      ({ PGlite } = await import('@electric-sql/pglite'));
    }
  } catch (err) {
    if (process.env.PGLITE_TEST_MODULE || err.code !== 'ERR_MODULE_NOT_FOUND') throw err;
    t.skip('Set TEST_DATABASE_URL, install @electric-sql/pglite, or set PGLITE_TEST_MODULE to its absolute file URL'); return null;
  }
  const pg = new PGlite();
  t.after(() => pg.close());
  t.diagnostic('Database: in-memory PGlite, one serial connection');
  return pg;
}

test('independent Bunpou backend safety review', { timeout: 90_000 }, async t => {
  const pg = await openTestDatabase(t);
  if (!pg) return;
  await pg.exec(`
    CREATE TABLE users(id uuid PRIMARY KEY, email text, google_id text, full_name text,
      google_name text, avatar_url text, updated_at timestamptz DEFAULT NOW());
    CREATE TABLE courses(id uuid PRIMARY KEY, title text DEFAULT 'Course', level text DEFAULT 'N5',
      is_published boolean DEFAULT true, is_available boolean DEFAULT true, sort_order int DEFAULT 0);
    CREATE TABLE modules(id uuid PRIMARY KEY, course_id uuid REFERENCES courses(id), title text DEFAULT 'Module', sort_order int DEFAULT 0);
    CREATE TABLE lessons(id uuid PRIMARY KEY, module_id uuid REFERENCES modules(id), title text DEFAULT 'Source',
      type text, popup_after_lesson_id uuid REFERENCES lessons(id), sort_order int DEFAULT 0,
      video_url text DEFAULT 'video', video_source_id uuid, updated_at timestamptz DEFAULT NOW());
    CREATE TABLE module_grammar(id uuid PRIMARY KEY, module_id uuid REFERENCES modules(id), lesson_id uuid REFERENCES lessons(id),
      pattern text, meaning text, example text, example_dialog text, example_dialog_id text,
      recognition_distractors text, controlled_distractors text, sort_order int DEFAULT 0, created_at timestamptz DEFAULT NOW());
    CREATE TABLE grammar_examples(grammar_id uuid REFERENCES module_grammar(id), japanese text, highlight text,
      indonesian text, sort_order int DEFAULT 0, created_at timestamptz DEFAULT NOW());
    CREATE TABLE lesson_grammar_task_items(lesson_id uuid REFERENCES lessons(id), grammar_id uuid REFERENCES module_grammar(id),
      instruction text, required_count int DEFAULT 1, sort_order int DEFAULT 0);
    CREATE TABLE grammar_attempts(id uuid DEFAULT gen_random_uuid(), user_id uuid REFERENCES users(id), grammar_id uuid REFERENCES module_grammar(id),
      lesson_id uuid REFERENCES lessons(id), source text, input_mode text, sentence text, correct boolean, uses_pattern boolean,
      passed boolean, primary_error text, error_types text[], eval_source text, created_at timestamptz DEFAULT NOW());
    CREATE TABLE app_settings(key text PRIMARY KEY, value text, updated_at timestamptz DEFAULT NOW());
    CREATE TABLE user_enrollments(user_id uuid REFERENCES users(id), course_id uuid REFERENCES courses(id), status text, expires_at timestamptz);
    CREATE TABLE admin_emails(email text);
    CREATE TABLE orders(user_id uuid REFERENCES users(id));
    CREATE TABLE order_payments(submitted_by uuid REFERENCES users(id), proof_image bytea, proof_mime text,
      proof_filename text, claimed_sender_name text, raw_payload jsonb);
    CREATE TABLE discussions(user_id uuid REFERENCES users(id), content text, is_deleted boolean, updated_at timestamptz);
  `);
  for (const name of ['147_bunpou_flow_pilot.sql', '150_bunpou_flow_dialog_checks.sql', '152_bunpou_session_integrity.sql']) {
    await pg.exec(await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
  }
  for (const name of ['sessions', 'user_marketing_profile', 'user_progress', 'user_learning_state', 'user_stats',
    'user_practice_state', 'user_practice_legacy_imports', 'practice_attempts', 'quiz_question_results', 'quiz_attempts', 'smart_review_sessions']) {
    await pg.exec(`CREATE TABLE ${name}(user_id uuid REFERENCES users(id))`);
  }
  const { db } = await import('./db.js');
  const query = async (sql, params = []) => {
    const result = await pg.query(sql, params);
    return { ...result, rowCount: result.rowCount ?? result.affectedRows ?? result.rows.length };
  };
  let beforeBegin = null, afterAdvisory = null;
  const routedQuery = async (sql, params = []) => {
    if (sql === 'BEGIN' && beforeBegin) { const hook = beforeBegin; beforeBegin = null; await hook(); }
    const result = await query(sql, params);
    if (sql.includes('pg_advisory_xact_lock') && afterAdvisory) {
      const hook = afterAdvisory; afterAdvisory = null; await hook();
    }
    return result;
  };
  t.mock.method(db, 'query', routedQuery);
  t.mock.method(db, 'connect', async () => ({ query: routedQuery, release() {} }));
  t.mock.method(globalThis, 'fetch', () => { throw new Error('External network forbidden in review tests'); });
  const { default: sessions } = await import('./routes/grammar-task-sessions.js');
  const { default: admin } = await import('./routes/admin.js');
  const { loadCompanionContext } = await import('./bunpou-flow-content.js');
  const { loadPilotLessonOptions } = await import('./bunpou-pilot-catalog.js');
  const { eraseUserAccount } = await import('./user-erasure.js');
  const { deriveDrills } = await import('./grammar-drills.js');

  // Invoke actual wrapped route handlers. Authentication is already established;
  // ownership, course, pilot, snapshot, ledger and SQL guards remain real.
  const user = { id: id(1), email: 'review@example.invalid' };
  async function invoke(router, path, method, body = {}, params = {}) {
    const layer = router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]);
    assert.ok(layer, path);
    const response = { status: 200, body: null };
    const res = { status(code) { response.status = code; return this; }, json(value) { response.body = value; return this; } };
    let failure;
    await layer.route.stack.at(-1).handle({ user, body, params }, res, err => { failure = err; });
    if (failure) throw failure;
    return response;
  }
  const create = () => invoke(sessions, '/grammar-task/sessions', 'post', { sourceLessonId: id(4) });
  async function publishSource() {
    const context = await loadCompanionContext(id(4));
    await query('UPDATE lessons SET bunpou_flow_published = $2 WHERE id = $1', [id(4), JSON.stringify({
      schemaVersion: 1, sourceFingerprint: context.fingerprint, objective: 'Reviewed',
      overlays: { [id(6)]: { step1: { hint: 'Private hint' } } },
    })]);
    return context.fingerprint;
  }
  t.beforeEach(async () => {
    beforeBegin = afterAdvisory = null;
    await pg.exec('TRUNCATE users, courses, modules, lessons, module_grammar, grammar_examples, lesson_grammar_task_items, app_settings CASCADE');
    await query('INSERT INTO users(id,email) VALUES ($1,$2)', [user.id, user.email]);
    await query('INSERT INTO courses(id) VALUES ($1),($2)', [id(2), id(20)]);
    await query('INSERT INTO modules(id,course_id) VALUES ($1,$2),($3,$4)', [id(3), id(2), id(30), id(20)]);
    await query("INSERT INTO lessons(id,module_id,type) VALUES ($1,$2,'video')", [id(4), id(3)]);
    await query("INSERT INTO lessons(id,module_id,type,popup_after_lesson_id) VALUES ($1,$2,'grammar_task',$3)", [id(5), id(3), id(4)]);
    await query(`INSERT INTO module_grammar(id,module_id,lesson_id,pattern,meaning,example,example_dialog,recognition_distractors)
      VALUES ($1,$2,$3,'pattern','meaning','example','A: dialog','other one\nother two\nother three')`, [id(6), id(3), id(4)]);
    await query("INSERT INTO grammar_examples(grammar_id,japanese,highlight,indonesian) VALUES ($1,'one two three','three','translation')", [id(6)]);
    await query("INSERT INTO lesson_grammar_task_items(lesson_id,grammar_id,instruction) VALUES ($1,$2,'instruction')", [id(5), id(6)]);
    await query("INSERT INTO user_enrollments(user_id,course_id,status) VALUES ($1,$2,'active')", [user.id, id(2)]);
    await query("INSERT INTO app_settings(key,value) VALUES ('bunpou_flow_pilot_enabled','true'),('bunpou_flow_pilot_lesson_id',$1)", [id(4)]);
    await publishSource();
  });

  await t.test('reject a paired task from an unenrolled course', async () => {
    await query('UPDATE lessons SET module_id = $2 WHERE id = $1', [id(5), id(30)]);
    assert.equal(await loadCompanionContext(id(4)), null);
    assert.equal((await create()).status, 404);
  });

  await t.test('reject task grammar from an unenrolled course', async () => {
    await query('UPDATE module_grammar SET module_id = $2 WHERE id = $1', [id(6), id(30)]);
    assert.equal(await loadCompanionContext(id(4)), null);
    assert.equal((await create()).status, 404);
  });

  await t.test('reject selected grammar whose own source lesson is in another course', async () => {
    await query("INSERT INTO lessons(id,module_id,type) VALUES ($1,$2,'video')", [id(40), id(30)]);
    await query('UPDATE module_grammar SET lesson_id = $2 WHERE id = $1', [id(6), id(40)]);
    assert.equal(await loadCompanionContext(id(4)), null);
    assert.equal((await create()).status, 404);
  });

  await t.test('reject foreign source cards even when not selected into the task', async () => {
    await query(`INSERT INTO module_grammar(id,module_id,lesson_id,pattern)
      VALUES ($1,$2,$3,'foreign source card')`, [id(60), id(30), id(4)]);
    assert.equal(await loadCompanionContext(id(4)), null);
  });

  await t.test('reject foreign lesson references in the distractor pool', async () => {
    await query("INSERT INTO lessons(id,module_id,type) VALUES ($1,$2,'video')", [id(40), id(30)]);
    await query(`INSERT INTO module_grammar(id,module_id,lesson_id,pattern)
      VALUES ($1,$2,$3,'foreign pool card')`, [id(60), id(3), id(40)]);
    assert.equal(await loadCompanionContext(id(4)), null);
  });

  await t.test('allow another module and source lesson within the same course', async () => {
    await query('INSERT INTO modules(id,course_id) VALUES ($1,$2)', [id(31), id(2)]);
    await query("INSERT INTO lessons(id,module_id,type) VALUES ($1,$2,'video')", [id(41), id(31)]);
    await query('UPDATE module_grammar SET module_id = $2, lesson_id = $3 WHERE id = $1', [id(6), id(31), id(41)]);
    await query('UPDATE lessons SET module_id = $2 WHERE id = $1', [id(5), id(31)]);
    assert.ok(await loadCompanionContext(id(4)));
    await publishSource();
    assert.equal((await create()).status, 200);
  });

  await t.test('reject ambiguous mappings instead of silently ignoring a foreign task', async () => {
    await query("INSERT INTO lessons(id,module_id,type,popup_after_lesson_id) VALUES ($1,$2,'grammar_task',$3)", [id(50), id(30), id(4)]);
    assert.equal(await loadCompanionContext(id(4)), null);
  });

  await t.test('existing sessions reject GET and answer after task or grammar moves to another course', async () => {
    const session = (await create()).body;
    const item = session.items[0]; assert.ok(item);
    const storedBefore = (await query('SELECT * FROM grammar_task_session_items WHERE session_id = $1 ORDER BY item_id', [session.sessionId])).rows;
    for (const [table, target] of [['lessons', id(5)], ['module_grammar', id(6)]]) {
      await query(`UPDATE ${table} SET module_id = $2 WHERE id = $1`, [target, id(30)]);
      const get = await invoke(sessions, '/grammar-task/sessions/:id', 'get', {}, { id: session.sessionId });
      assert.equal(get.status, 403, `${table}: GET must reject foreign scope`);
      const answer = await invoke(sessions, '/grammar-task/sessions/:id/items/:itemId/answer', 'post',
        { optionIndex: 0, requestId: `moved-${table}` }, { id: session.sessionId, itemId: item.itemId });
      assert.equal(answer.status, 403, `${table}: answer must reject foreign scope`);
      assert.deepEqual((await query('SELECT * FROM grammar_task_session_items WHERE session_id = $1 ORDER BY item_id', [session.sessionId])).rows, storedBefore);
      assert.equal((await query('SELECT * FROM grammar_attempts')).rows.length, 0);
      assert.equal((await query('SELECT * FROM grammar_task_requests')).rows.length, 0);
      await query(`UPDATE ${table} SET module_id = $2 WHERE id = $1`, [target, id(3)]);
    }
  });

  await t.test('recheck pilot after the answer waits for its advisory lock', async () => {
    const session = (await create()).body;
    const item = session.items[0]; assert.ok(item);
    afterAdvisory = () => query("UPDATE app_settings SET value = 'false' WHERE key = 'bunpou_flow_pilot_enabled'");
    const result = await invoke(sessions, '/grammar-task/sessions/:id/items/:itemId/answer', 'post',
      { optionIndex: 0, requestId: 'after-disable' }, { id: session.sessionId, itemId: item.itemId });
    assert.equal(result.status, 403, 'answer currently commits after pilot has been disabled');
  });

  await t.test('recheck expiry after the hint waits for its advisory lock', async () => {
    const session = (await create()).body;
    const item = session.items[0]; assert.ok(item);
    afterAdvisory = () => query("UPDATE grammar_task_sessions SET expires_at = clock_timestamp() - interval '1 second' WHERE id = $1", [session.sessionId]);
    const result = await invoke(sessions, '/grammar-task/sessions/:id/items/:itemId/hint', 'post', {},
      { id: session.sessionId, itemId: item.itemId });
    assert.equal(result.status, 410, 'hint currently returns 200 after expiry');
  });

  await t.test('erasure between authorization and session insertion cannot recreate student data', async () => {
    beforeBegin = async () => {
      await query('BEGIN');
      await eraseUserAccount({ query }, user.id);
      await query('COMMIT');
    };
    const response = await create();
    const erased = (await query('SELECT email FROM users WHERE id = $1', [user.id])).rows[0];
    assert.match(erased.email, /^dihapus-/);
    assert.ok(response.status >= 400, 'currently creates a new session for the erased account');
    assert.equal((await query('SELECT * FROM grammar_task_sessions WHERE user_id = $1', [user.id])).rows.length, 0);
  });

  await t.test('ordinary erasure removes the ledger and cascades production slots and session items', async () => {
    const session = (await create()).body;
    await query(`INSERT INTO grammar_task_requests(user_id,request_id,session_id,payload_hash,operation,grammar_id,production_slot,response)
      VALUES ($1,'erase-request',$2,'hash','production',$3,0,'{"feedback":"private"}')`, [user.id, session.sessionId, id(6)]);
    await query(`INSERT INTO grammar_task_productions(session_id,grammar_id,slot,sentence,input_mode,result,request_id,assistance_state,passed)
      VALUES ($1,$2,0,'private sentence','text','{"feedback":"private"}','erase-request','none_observed',true)`, [session.sessionId, id(6)]);
    await query('BEGIN');
    await eraseUserAccount({ query }, user.id);
    await query('COMMIT');
    for (const name of ['grammar_task_requests', 'grammar_task_productions', 'grammar_task_session_items', 'grammar_task_sessions']) {
      assert.equal((await query(`SELECT * FROM ${name}`)).rows.length, 0, name);
    }
  });

  await t.test('publishing rejects a replaced draft revision and accepts a freshly reviewed draft', async () => {
    const sourceFingerprint = await publishSource();
    const params = { lessonId: id(4) };
    const save = objective => invoke(admin, '/lessons/:lessonId/bunpou-flow/draft', 'put',
      { schemaVersion: 1, sourceFingerprint, objective }, params);
    const reviewed = await save('Editor A reviewed this'); assert.equal(reviewed.status, 200);
    assert.ok(reviewed.body.draftRevision);
    assert.equal((await save('Editor B replaced the draft')).status, 200);
    const response = await invoke(admin, '/lessons/:lessonId/bunpou-flow/publish', 'post',
      { confirm: true, draftRevision: reviewed.body.draftRevision }, params);
    assert.equal(response.status, 409);
    assert.equal((await query('SELECT bunpou_flow_published FROM lessons WHERE id = $1', [id(4)])).rows[0].bunpou_flow_published.objective, 'Reviewed');
    const fresh = await save('Newly reviewed draft'); assert.equal(fresh.status, 200);
    const published = await invoke(admin, '/lessons/:lessonId/bunpou-flow/publish', 'post',
      { confirm: true, draftRevision: fresh.body.draftRevision }, params);
    assert.equal(published.status, 200);
    assert.equal(published.body.published.objective, 'Newly reviewed draft');
  });

  await t.test('ready catalog entries have usable recognition and controlled drills', async () => {
    await query("UPDATE module_grammar SET meaning = '', recognition_distractors = NULL WHERE id = $1", [id(6)]);
    await query("UPDATE grammar_examples SET japanese = 'example', highlight = 'example' WHERE grammar_id = $1", [id(6)]);
    await publishSource();
    const context = await loadCompanionContext(id(4));
    const drills = deriveDrills(context.items, context.pool).get(id(6));
    assert.equal(drills.step1, null); assert.equal(drills.step2, null);
    const option = (await loadPilotLessonOptions()).find(row => row.id === id(4));
    assert.equal(option.ready, false);
    assert.match(option.reason, /Soal pengenalan atau latihan bentuk/);
  });

  await t.test('catalog requires both drills for every selected item and keeps unready entries visible', async () => {
    assert.equal((await loadPilotLessonOptions())[0].ready, true);
    await query(`INSERT INTO module_grammar(id,module_id,lesson_id,pattern,meaning,example,example_dialog,recognition_distractors,sort_order)
      SELECT $1,module_id,lesson_id,pattern,'',example,example_dialog,recognition_distractors,1
      FROM module_grammar WHERE id = $2`, [id(60), id(6)]);
    await query("INSERT INTO grammar_examples(grammar_id,japanese,highlight) VALUES ($1,'one two three','three')", [id(60)]);
    await query('INSERT INTO lesson_grammar_task_items(lesson_id,grammar_id,sort_order) VALUES ($1,$2,1)', [id(5), id(60)]);
    for (const missingStep of [1, 2]) {
      if (missingStep === 2) {
        await query("UPDATE module_grammar SET meaning = 'meaning' WHERE id = $1", [id(60)]);
        await query("UPDATE grammar_examples SET japanese = 'example', highlight = 'example' WHERE grammar_id = $1", [id(60)]);
      }
      await publishSource();
      const context = await loadCompanionContext(id(4));
      const drills = deriveDrills(context.items, context.pool);
      assert.ok(drills.get(id(6)).step1 && drills.get(id(6)).step2);
      assert.equal(drills.get(id(60))[`step${missingStep}`], null);
      assert.ok(drills.get(id(60))[`step${3 - missingStep}`]);
      const options = await loadPilotLessonOptions();
      assert.equal(options.length, 1);
      assert.equal(options[0].ready, false);
      assert.match(options[0].reason, /semua pola/);
    }
  });
});
