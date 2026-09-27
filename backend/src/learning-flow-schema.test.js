import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const migration = await readFile(new URL('../migrations/165_learning_flow_boundary_foundation.sql', import.meta.url), 'utf8');

test('learning flow migration is additive and keeps every rollout default disabled', () => {
  assert.doesNotMatch(migration, /\b(?:DROP|TRUNCATE)\b/i);
  assert.doesNotMatch(migration, /\b(?:UPDATE|DELETE\s+FROM)\s+(?:module_vocabulary|module_grammar|kanji_items|lessons|grammar_attempts)\b/i);
  assert.match(migration, /curriculum_boundary_mode\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'off'/i);
  assert.match(migration, /flow_version\s+SMALLINT\s+NOT\s+NULL\s+DEFAULT\s+1/i);
  assert.match(migration, /learning_flow_communication_v1[\s\S]*?"enabled":false/i);
  assert.match(migration, /request_id\s+UUID\s+NOT\s+NULL/i);
  assert.match(migration, /UNIQUE\s*\(user_id,\s*request_id\)/i);
});

test('learning flow migration preserves legacy rows and starts disabled on PostgreSQL', {
  skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL to an isolated local test database',
  timeout: 90000,
}, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.equal(url.searchParams.has('host'), false, 'Connection URL must not override the verified host');
  assert.equal(url.searchParams.has('hostaddr'), false, 'Connection URL must not override the verified host address');
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  assert.match(url.pathname, /test/i);
  const schema = 'flow_schema_test_' + randomUUID().replaceAll('-', '');
  const q = `"${schema}"`;
  const client = new pg.Client({ connectionString: url.href, statement_timeout: 10000 });
  await client.connect();
  t.after(async () => {
    await client.query('ROLLBACK');
    await client.query(`DROP SCHEMA IF EXISTS ${q} CASCADE`);
    await client.end();
  });
  await client.query(`CREATE SCHEMA ${q}; SET search_path TO ${q}`);
  await client.query(`
    CREATE TABLE users(id UUID PRIMARY KEY);
    CREATE TABLE courses(id UUID PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL);
    CREATE TABLE modules(id UUID PRIMARY KEY, course_id UUID REFERENCES courses(id), sort_order INT);
    CREATE TABLE lessons(id UUID PRIMARY KEY, module_id UUID REFERENCES modules(id), title TEXT);
    CREATE TABLE module_grammar(id UUID PRIMARY KEY, module_id UUID REFERENCES modules(id), lesson_id UUID REFERENCES lessons(id), example_dialog TEXT);
    CREATE TABLE grammar_task_sessions(id UUID PRIMARY KEY, user_id UUID REFERENCES users(id), version INT NOT NULL DEFAULT 1);
    CREATE TABLE app_settings(key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE schema_migrations(name TEXT PRIMARY KEY);
  `);
  const ids = Array.from({ length: 7 }, () => randomUUID());
  const [user, n5, n4, module, lesson, grammar, session] = ids;
  await client.query('INSERT INTO users VALUES ($1)', [user]);
  await client.query("INSERT INTO courses VALUES ($1,'n5','N5'),($2,'n4','N4')", [n5, n4]);
  await client.query('INSERT INTO modules VALUES ($1,$2,1)', [module, n5]);
  await client.query("INSERT INTO lessons VALUES ($1,$2,'old lesson')", [lesson, module]);
  await client.query("INSERT INTO module_grammar VALUES ($1,$2,$3,'昔の会話')", [grammar, module, lesson]);
  await client.query('INSERT INTO grammar_task_sessions VALUES ($1,$2,7)', [session, user]);
  const legacy = {};
  for (const table of ['courses', 'modules', 'lessons', 'module_grammar', 'grammar_task_sessions']) {
    legacy[table] = (await client.query(`SELECT row_to_json(t)::text AS data FROM ${table} t ORDER BY id`)).rows.map(r => JSON.parse(r.data));
  }
  // Same per-file ledger behavior as migrations/run.js: a second run skips the file.
  for (let run = 0; run < 2; run++) {
    if (!(await client.query('SELECT 1 FROM schema_migrations WHERE name=$1', ['165_learning_flow_boundary_foundation.sql'])).rowCount) {
      await client.query('BEGIN');
      await client.query(migration);
      await client.query("INSERT INTO schema_migrations VALUES ('165_learning_flow_boundary_foundation.sql')");
      await client.query('COMMIT');
    }
  }
  const after = {
    courses: (await client.query('SELECT id,slug,title FROM courses ORDER BY id')).rows,
    modules: (await client.query('SELECT * FROM modules ORDER BY id')).rows,
    lessons: (await client.query('SELECT * FROM lessons ORDER BY id')).rows,
    module_grammar: (await client.query('SELECT id,module_id,lesson_id,example_dialog FROM module_grammar ORDER BY id')).rows,
    grammar_task_sessions: (await client.query('SELECT id,user_id,version FROM grammar_task_sessions ORDER BY id')).rows,
  };
  for (const [table, rows] of Object.entries(after)) {
    assert.deepEqual(rows, legacy[table], `${table} old columns are unchanged`);
  }
  assert.deepEqual((await client.query('SELECT curriculum_boundary_mode FROM courses')).rows.map(r => r.curriculum_boundary_mode), ['off', 'off']);
  assert.equal((await client.query('SELECT flow_version FROM grammar_task_sessions')).rows[0].flow_version, 1);
  assert.equal((await client.query('SELECT count(*)::int AS n FROM course_prerequisites')).rows[0].n, 1);
  assert.equal(JSON.parse((await client.query("SELECT value FROM app_settings WHERE key='learning_flow_communication_v1'")).rows[0].value).enabled, false);

  for (const invalid of [
    'null', '42', '"text"', '{}', '[]', '["A","B"]',
    '["A","B","C","D","E"]', '["A",null,"C"]', '["A",2,"C"]',
    '["A"," ","C"]', '["A","\\t","C"]', '["A","\\n","C"]',
    '["A","　","C"]', '["A"," a ","C"]', '["A","A\\t","C"]',
  ]) {
    assert.equal((await client.query('SELECT grammar_dialog_options_valid($1::jsonb) AS valid', [invalid])).rows[0].valid,
      false, `invalid options: ${invalid}`);
  }
  assert.equal((await client.query('SELECT grammar_dialog_options_valid($1::jsonb) AS valid',
    ['["A","B","C"]'])).rows[0].valid, true);

  const question = randomUUID();
  const base = [question, grammar, lesson, 'Apa nama?', JSON.stringify(['A', 'B', 'C']), randomUUID()];
  await assert.rejects(client.query(`INSERT INTO grammar_dialog_questions
    (id,grammar_id,source_lesson_id,kind,prompt,options,correct_index,explanation,sort_order,question_version,question_fingerprint,dialogue_fingerprint,evidence,state)
    VALUES ($1,$2,$3,'comprehension',$4,$5,0,'Penjelasan',0,$6,'qhash','dhash','{}','active')`,
    [question, grammar, lesson, ' ', JSON.stringify(['A', 'B', 'C']), base[5]]), error => error.code === '23514');
  await assert.rejects(client.query(`INSERT INTO grammar_dialog_questions
    (grammar_id,source_lesson_id,kind,prompt,options,correct_index,explanation,sort_order,question_fingerprint,dialogue_fingerprint,evidence,state)
    VALUES ($1,$2,'comprehension','Valid',$3,3,'Penjelasan',0,'qhash','dhash','{}','active')`,
    [grammar, lesson, JSON.stringify(['A', 'B', 'C'])]), error => error.code === '23514');
  await client.query(`INSERT INTO grammar_dialog_questions
    (id,grammar_id,source_lesson_id,kind,prompt,options,correct_index,explanation,sort_order,question_version,question_fingerprint,dialogue_fingerprint,evidence,state)
    VALUES ($1,$2,$3,'comprehension',$4,$5,0,'Penjelasan',0,$6,'qhash','dhash','{}','active')`, base);
  await assert.rejects(client.query('UPDATE grammar_dialog_questions SET prompt=$1 WHERE id=$2', ['Pertanyaan baru?', question]), error => error.code === '23514');
  await client.query('UPDATE grammar_dialog_questions SET prompt=$1, question_version=$2 WHERE id=$3',
    ['Pertanyaan baru?', randomUUID(), question]);
  await assert.rejects(client.query('UPDATE grammar_dialog_questions SET grammar_id=$1 WHERE id=$2', [randomUUID(), question]), error => error.code === '23514');
  await assert.rejects(client.query('UPDATE grammar_dialog_questions SET options=$1, question_version=$2 WHERE id=$3',
    [JSON.stringify(['A', ' a ', 'C']), randomUUID(), question]), error => error.code === '23514');
  const request = randomUUID();
  const attempt = [user, question, grammar, lesson, request,
    (await client.query('SELECT question_version FROM grammar_dialog_questions WHERE id=$1', [question])).rows[0].question_version];
  const insertAttempt = `INSERT INTO dialogue_question_attempts
    (user_id,question_id,grammar_id,lesson_id,request_id,request_payload_hash,
     question_version,question_fingerprint,dialogue_fingerprint,question_snapshot,
     selected_index,is_correct,response_snapshot)
    VALUES ($1,$2,$3,$4,$5,'payload-hash',$6,'qhash','dhash','{}',0,true,'{}')`;
  await client.query(insertAttempt, attempt);
  await assert.rejects(client.query(insertAttempt, attempt), error => error.code === '23505');
  assert.deepEqual((await client.query('SELECT activity_type,placement,evidence_policy FROM dialogue_question_attempts')).rows[0], {
    activity_type: 'dialogue_comprehension', placement: 'inline_lesson', evidence_policy: 'formative_only',
  });
});
