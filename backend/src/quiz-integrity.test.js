import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import express from 'express';
import pg from 'pg';

test('quiz integrity with real HTTP and PostgreSQL', {
  skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL for PostgreSQL tests', timeout: 30000,
}, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  const schema = 'quiz_test_' + randomUUID().replaceAll('-', '');
  const control = new pg.Client({ connectionString: url.href });
  await control.connect();
  await control.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
  url.searchParams.set('options', `-c search_path=${schema} -c statement_timeout=5000`);
  process.env.DATABASE_URL = url.href;
  process.env.JWT_ACCESS_SECRET = 'local-quiz-test-only';
  process.env.ADMIN_EMAILS = '';
  const { db } = await import('./db.js');
  let server;
  t.after(async () => {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await db.end();
    await control.query(`DROP SCHEMA ${schema} CASCADE`);
    await control.end();
  });
  await control.query(`
    CREATE TABLE users(id uuid PRIMARY KEY);
    CREATE TABLE courses(id uuid PRIMARY KEY, slug text);
    CREATE TABLE modules(id uuid PRIMARY KEY, course_id uuid, slug text);
    CREATE TABLE module_grammar(id uuid PRIMARY KEY);
    CREATE TABLE lessons(id uuid PRIMARY KEY, module_id uuid, slug text, type text,
      duration_minutes int DEFAULT 5, passing_score_pct int DEFAULT 70,
      cooldown_hours int DEFAULT 0, questions_per_attempt int);
    CREATE TABLE user_enrollments(user_id uuid, course_id uuid, status text DEFAULT 'active', expires_at timestamptz);
    CREATE TABLE admin_emails(email text);
  `);
  const sql = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');
  for (const table of ['quiz_questions', 'quiz_options', 'quiz_attempts', 'quiz_question_results', 'user_progress', 'user_stats', 'user_learning_state']) {
    const block = sql.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\n\\);`));
    assert.ok(block, table);
    await control.query(block[0]);
  }
  const migration = await readFile(new URL('../migrations/140_quiz_result_integrity.sql', import.meta.url), 'utf8');
  // Verify upgrade from the old table and rerun safety.
  await control.query('ALTER TABLE quiz_attempts DROP COLUMN grading_result, DROP COLUMN submitted_answers');
  await control.query(migration);
  await control.query(migration);
  const user = randomUUID(), course = randomUUID(), module = randomUUID();
  await control.query('INSERT INTO users VALUES ($1)', [user]);
  await control.query("INSERT INTO courses VALUES ($1, 'n5')", [course]);
  await control.query("INSERT INTO modules VALUES ($1, $2, 'bab1')", [module, course]);
  await control.query('INSERT INTO user_enrollments(user_id, course_id) VALUES ($1,$2)', [user, course]);
  const { signAccessToken } = await import('./auth.js');
  const { default: router } = await import('./routes/progress.js');
  const app = express();
  app.use(express.json(), router);
  app.use((err, req, res, next) => res.status(500).json({ error: 'test_failure' }));
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = await signAccessToken(user, 'student@example.invalid');
  async function call(path, body, method = 'POST', auth = token) {
    const r = await fetch(base + path, { method,
      headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
      ...(method !== 'GET' && { body: JSON.stringify(body || {}) }), signal: AbortSignal.timeout(10000) });
    return { status: r.status, body: await r.json() };
  }
  const route = (f, suffix) => `/progress/lesson/${f.lesson}/${suffix}`;
  async function fixture() {
    const lesson = randomUUID(), q1 = randomUUID(), q2 = randomUUID();
    const right1 = randomUUID(), wrong1 = randomUUID(), right2 = randomUUID(), wrong2 = randomUUID();
    await control.query("INSERT INTO lessons(id,module_id,slug,type) VALUES ($1,$2,$3,'quiz')", [lesson, module, lesson]);
    await control.query("INSERT INTO quiz_questions(id,lesson_id,question) VALUES ($1,$3,'Q1'),($2,$3,'Q2')", [q1,q2,lesson]);
    await control.query(`INSERT INTO quiz_options(id,question_id,option_text,is_correct) VALUES
      ($1,$5,'yes',true),($2,$5,'no',false),($3,$6,'yes',true),($4,$6,'no',false)`, [right1,wrong1,right2,wrong2,q1,q2]);
    const f = { lesson, q1,q2,right1,wrong1,right2,wrong2 };
    const start = await call(route(f, 'quiz/start'));
    assert.equal(start.status, 200);
    f.attemptToken = start.body.attemptToken;
    f.answers = [{ questionId:q1, optionId:right1 }, { questionId:q2, optionId:right2 }];
    return f;
  }
  const submit = (f, answers = f.answers) => call(route(f, 'quiz-attempt'), { attemptToken: f.attemptToken, answers });
  async function stored(f) {
    const attempt = (await control.query('SELECT * FROM quiz_attempts WHERE attempt_token=$1', [f.attemptToken])).rows[0];
    const results = (await control.query('SELECT * FROM quiz_question_results WHERE attempt_id=$1', [attempt.id])).rows;
    const progress = (await control.query('SELECT * FROM user_progress WHERE user_id=$1 AND lesson_id=$2', [user,f.lesson])).rows;
    return { attempt, results, progress };
  }
  await t.test('rejects duplicate, missing, foreign and malformed choices without persisting grades', async () => {
    const f = await fixture();
    for (const answers of [null, [], [f.answers[0]], [f.answers[0],f.answers[0]],
      [...f.answers, { questionId:f.q1,optionId:f.wrong1 }],
      [{questionId:f.q1,optionId:f.right2}, f.answers[1]],
      [{questionId:randomUUID(),optionId:f.right1},f.answers[1]],
      [{questionId:f.q1,optionId:'bad-id'},f.answers[1]]]) {
      assert.equal((await submit(f, answers)).status, 400);
    }
    const s = await stored(f);
    assert.equal(s.attempt.completed_at, null);
    assert.equal(s.results.length, 0);
    assert.equal(s.progress.length, 0);
  });
  await t.test('concurrent submit and lost-response retry return one immutable grade and one XP award', async () => {
    const f = await fixture();
    const before = (await control.query('SELECT xp FROM user_stats WHERE user_id=$1',[user])).rows[0]?.xp || 0;
    const results = await Promise.all([submit(f), submit(f)]);
    assert.deepEqual(results[0], results[1]);
    assert.equal(results[0].status, 200);
    assert.equal(results[0].body.passed, true);
    assert.equal(results[0].body.completionSaved, true);
    await control.query('UPDATE lessons SET passing_score_pct=101 WHERE id=$1', [f.lesson]);
    assert.deepEqual(await submit(f, []), results[0]);
    const s = await stored(f);
    assert.equal(s.results.length, 2);
    assert.equal(s.attempt.submitted_answers.length, 2);
    assert.equal(s.progress[0].completed, true);
    assert.equal((await call(route(f,'complete'))).status, 200);
    const after = (await control.query('SELECT xp FROM user_stats WHERE user_id=$1',[user])).rows[0].xp;
    assert.equal(after - before, 15);
  });
  await t.test('failed quiz and client completion flags cannot unlock a quiz; ordinary lessons still complete', async () => {
    const f = await fixture();
    assert.equal((await call(route(f,'complete'))).status, 409);
    const failed = await submit(f,[{questionId:f.q1,optionId:f.wrong1},{questionId:f.q2,optionId:f.wrong2}]);
    assert.equal(failed.body.passed, false);
    assert.equal((await call(route(f,'complete'))).status, 409);
    await control.query('INSERT INTO user_learning_state(user_id,progress) VALUES ($1,$2) ON CONFLICT(user_id) DO UPDATE SET progress=EXCLUDED.progress',
      [user,JSON.stringify({n5:{['bab1:'+f.lesson]:true}})]);
    assert.equal((await call('/progress/reconcile')).status, 200);
    assert.equal((await stored(f)).progress.length, 0);
    await control.query("UPDATE lessons SET type='video' WHERE id=$1", [f.lesson]);
    assert.equal((await call(route(f,'complete'))).status, 200);
  });
  await t.test('active attempt resumes after an older completed attempt and start calls share the token', async () => {
    const f = await fixture();
    await submit(f);
    const [a,b] = await Promise.all([call(route(f,'quiz/start')),call(route(f,'quiz/start'))]);
    assert.equal(a.body.attemptToken,b.body.attemptToken);
    assert.notEqual(a.body.attemptToken,f.attemptToken);
    const resume = await call(route(f,'quiz/start'));
    assert.equal(resume.body.attemptToken,a.body.attemptToken);
    assert.equal(resume.body.resumed,true);
  });
  await t.test('deleted questions never produce a smaller denominator or 0/0 pass', async () => {
    const f = await fixture();
    await control.query('DELETE FROM quiz_questions WHERE id=$1',[f.q1]);
    assert.equal((await submit(f)).status,409);
    assert.equal((await stored(f)).attempt.completed_at,null);
  });
  await t.test('failure writing details or XP rolls back score and completion, then retry succeeds', async () => {
    for (const table of ['quiz_question_results','user_stats']) {
      const f = await fixture();
      await control.query(`CREATE OR REPLACE FUNCTION test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$;
        CREATE TRIGGER test_failure BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION test_fail()`);
      try { assert.equal((await submit(f)).status,500); }
      finally { await control.query(`DROP TRIGGER test_failure ON ${table}`); }
      const s=await stored(f);
      assert.equal(s.attempt.completed_at,null);
      assert.equal(s.attempt.grading_result,null);
      assert.equal(s.results.length,0);
      assert.equal(s.progress.length,0);
      assert.equal((await submit(f)).status,200);
    }
  });
  await t.test('tokens remain scoped to the owner and lesson; cooldown still blocks new attempts', async () => {
    const f = await fixture(), other = await fixture();
    assert.equal((await call(route(other,'quiz-attempt'),{attemptToken:f.attemptToken,answers:f.answers})).status,404);
    assert.equal((await call(route(f,'quiz-attempt'),{attemptToken:'invalid',answers:f.answers})).status,400);
    const outsider = await signAccessToken(randomUUID(),'outsider@example.invalid');
    assert.equal((await call(route(f,'quiz-attempt'),{attemptToken:f.attemptToken,answers:f.answers},'POST',outsider)).status,403);
    await control.query('UPDATE lessons SET cooldown_hours=12 WHERE id=$1',[f.lesson]);
    await submit(f);
    assert.equal((await call(route(f,'quiz/start'))).status,429);
  });
});
