import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { answerDialogueQuestion, latestDialogueQuestionAttempt, listLearnerDialogueQuestions } from './dialogue-question-learner.js';
import { dialogueFingerprint, questionFingerprint } from './dialogue-question-service.js';

const migration = await readFile(new URL('../migrations/165_learning_flow_boundary_foundation.sql',
  import.meta.url), 'utf8');

test('dialogue answers are concurrent-idempotent and retain access/stale guarantees on PostgreSQL', {
  skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL to an isolated local test database',
  timeout: 90000,
}, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.equal(url.searchParams.has('host'), false);
  assert.equal(url.searchParams.has('hostaddr'), false);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  assert.match(url.pathname, /test/i);

  const schema = 'dialogue_answer_test_' + randomUUID().replaceAll('-', '');
  const quotedSchema = `"${schema}"`;
  const pool = new pg.Pool({ connectionString: url.href, max: 4, statement_timeout: 10000 });
  const setup = await pool.connect();
  t.after(async () => {
    try { await setup.query(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`); }
    finally { setup.release(); await pool.end(); }
  });
  await setup.query(`CREATE SCHEMA ${quotedSchema}; SET search_path TO ${quotedSchema}`);
  await setup.query(`
    CREATE TABLE users(id UUID PRIMARY KEY, email TEXT);
    CREATE TABLE courses(id UUID PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL,
      is_published BOOLEAN NOT NULL DEFAULT TRUE);
    CREATE TABLE modules(id UUID PRIMARY KEY, course_id UUID REFERENCES courses(id), sort_order INT);
    CREATE TABLE lessons(id UUID PRIMARY KEY, module_id UUID REFERENCES modules(id), title TEXT);
    CREATE TABLE module_grammar(id UUID PRIMARY KEY, module_id UUID REFERENCES modules(id),
      lesson_id UUID REFERENCES lessons(id), example_dialog TEXT, example_dialog_id TEXT,
      dialog_scene JSONB, dialog_furigana JSONB);
    CREATE TABLE grammar_task_sessions(id UUID PRIMARY KEY, user_id UUID REFERENCES users(id),
      version INT NOT NULL DEFAULT 1);
    CREATE TABLE user_enrollments(user_id UUID REFERENCES users(id), course_id UUID REFERENCES courses(id),
      status TEXT, expires_at TIMESTAMPTZ, PRIMARY KEY(user_id,course_id));
    CREATE TABLE app_settings(key TEXT PRIMARY KEY, value TEXT);
  `);
  await setup.query(migration);

  const ids = Array.from({ length: 8 }, () => randomUUID());
  const [userId, courseId, moduleId, lessonId, grammarId, questionId, questionVersion, requestId] = ids;
  await setup.query("INSERT INTO users VALUES ($1,'student@example.test')", [userId]);
  await setup.query("INSERT INTO courses VALUES ($1,'course-test','Course',TRUE)", [courseId]);
  await setup.query('INSERT INTO modules VALUES ($1,$2,1)', [moduleId, courseId]);
  await setup.query("INSERT INTO lessons VALUES ($1,$2,'Lesson')", [lessonId, moduleId]);
  await setup.query(`INSERT INTO module_grammar
    (id,module_id,lesson_id,example_dialog,example_dialog_id,dialog_scene,dialog_furigana,communication_goal)
    VALUES ($1,$2,$3,'A: ねこです。','A: Kucing.',NULL,NULL,'Nama hewan')`,
  [grammarId, moduleId, lessonId]);
  await setup.query("INSERT INTO user_enrollments VALUES ($1,$2,'active',NULL)", [userId, courseId]);
  const grammar = { id: grammarId, module_id: moduleId, lesson_id: lessonId,
    example_dialog: 'A: ねこです。', example_dialog_id: 'A: Kucing.', dialog_scene: null,
    communication_goal: 'Nama hewan' };
  const authored = { kind: 'comprehension', prompt: 'Hewan apa?',
    options: ['Kucing', 'Anjing', 'Burung'], correctIndex: 0,
    explanation: 'Disebutkan kucing.', evidence: [{ turnIndex: 0, quote: 'ねこです' }] };
  await setup.query(`INSERT INTO grammar_dialog_questions
    (id,grammar_id,source_lesson_id,kind,prompt,options,correct_index,explanation,sort_order,
     question_version,question_fingerprint,dialogue_fingerprint,evidence,state)
    VALUES ($1,$2,$3,'comprehension',$4,$5::jsonb,$6,$7,0,$8,$9,$10,$11::jsonb,'active')`,
  [questionId, grammarId, lessonId, authored.prompt, JSON.stringify(authored.options),
    authored.correctIndex, authored.explanation, questionVersion, questionFingerprint(authored),
    dialogueFingerprint(grammar), JSON.stringify(authored.evidence)]);

  const transaction = async fn => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL search_path TO ${quotedSchema}`);
      const value = await fn(client);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  };
  const dependencies = { transaction, adminCheck: async () => false,
    resolvePlacement: async () => ({ mode: 'inline', flowVersion: 2, reason: 'test_ready' }) };
  const user = { id: userId, email: 'student@example.test' };
  const body = { questionVersion, optionIndex: 0, requestId };

  const [first, duplicate] = await Promise.all([
    answerDialogueQuestion(questionId, user, body, dependencies),
    answerDialogueQuestion(questionId, user, body, dependencies),
  ]);
  assert.deepEqual(duplicate, first);
  assert.equal(first.correct, true);
  assert.equal((await setup.query('SELECT count(*)::int AS n FROM dialogue_question_attempts')).rows[0].n, 1);
  await assert.rejects(answerDialogueQuestion(questionId, user,
    { ...body, optionIndex: 1 }, dependencies), error => error.status === 409 &&
    error.message === 'request_id_conflict');

  await setup.query("UPDATE user_enrollments SET status='revoked' WHERE user_id=$1", [userId]);
  await assert.rejects(answerDialogueQuestion(questionId, user, body, dependencies),
    error => error.status === 403 && error.message === 'not_enrolled');
  await setup.query("UPDATE user_enrollments SET status='active' WHERE user_id=$1", [userId]);

  await setup.query("UPDATE grammar_dialog_questions SET state='archived' WHERE id=$1", [questionId]);
  assert.deepEqual(await answerDialogueQuestion(questionId, user, body, dependencies), first,
    'a committed request replays from its immutable response after archive');
  assert.deepEqual(await latestDialogueQuestionAttempt(questionId, user, questionVersion,
    { transaction, adminCheck: async () => false }), first);

  await setup.query("UPDATE grammar_dialog_questions SET state='active' WHERE id=$1", [questionId]);
  await setup.query("UPDATE module_grammar SET example_dialog='A: いぬです。' WHERE id=$1", [grammarId]);
  await assert.rejects(answerDialogueQuestion(questionId, user,
    { ...body, requestId: randomUUID() }, dependencies), error => error.status === 409 &&
    error.message === 'question_version_conflict');
  assert.equal((await setup.query('SELECT count(*)::int AS n FROM dialogue_question_attempts')).rows[0].n, 1);
});

test('standalone comprehension requires a same-module conversation and retains access checks', {
  skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL to an isolated local test database',
}, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  assert.equal(url.searchParams.has('host'), false);
  assert.equal(url.searchParams.has('hostaddr'), false);
  assert.match(url.pathname, /test/i);
  const schema = 'dialogue_standalone_test_' + randomUUID().replaceAll('-', '');
  const pool = new pg.Pool({ connectionString: url.href, max: 1 });
  t.after(async () => { try { await pool.query(`DROP SCHEMA "${schema}" CASCADE`); } finally { await pool.end(); } });
  await pool.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}";
    CREATE TABLE users(id UUID PRIMARY KEY,email TEXT);
    CREATE TABLE courses(id UUID PRIMARY KEY,is_published BOOLEAN);
    CREATE TABLE modules(id UUID PRIMARY KEY,course_id UUID);
    CREATE TABLE lessons(id UUID PRIMARY KEY,module_id UUID,type TEXT,conversation_source_lesson_id UUID);
    CREATE TABLE user_enrollments(user_id UUID,course_id UUID,status TEXT,expires_at TIMESTAMPTZ);
    CREATE TABLE module_grammar(id UUID PRIMARY KEY,module_id UUID,lesson_id UUID,example_dialog TEXT,
      example_dialog_id TEXT,communication_goal TEXT,dialog_scene JSONB);
    CREATE TABLE grammar_dialog_questions(id UUID,grammar_id UUID,source_lesson_id UUID,question_version UUID,
      prompt TEXT,options JSONB,sort_order INT,dialogue_fingerprint TEXT,state TEXT,kind TEXT);`);
  const [userId, courseId, moduleId, sourceId, conversationId, grammarId] = Array.from({length:6}, () => randomUUID());
  await pool.query("INSERT INTO users VALUES ($1,'test@example.test')", [userId]);
  await pool.query('INSERT INTO courses VALUES ($1,true)', [courseId]);
  await pool.query('INSERT INTO modules VALUES ($1,$2)', [moduleId, courseId]);
  await pool.query("INSERT INTO lessons VALUES ($1,$2,'video',NULL),($3,$4,'conversation',$1)", [sourceId,moduleId,conversationId,randomUUID()]);
  await pool.query("INSERT INTO user_enrollments VALUES ($1,$2,'active',NULL)", [userId,courseId]);
  const grammar = { example_dialog:'A: ねこです。',example_dialog_id:'A: Kucing.',communication_goal:'Nama hewan',dialog_scene:null };
  await pool.query('INSERT INTO module_grammar VALUES ($1,$2,$3,$4,$5,$6,NULL)', [grammarId,moduleId,sourceId,grammar.example_dialog,grammar.example_dialog_id,grammar.communication_goal]);
  await pool.query("INSERT INTO grammar_dialog_questions VALUES ($1,$2,$3,$4,'Apa?',$5,0,$6,'active','comprehension')", [randomUUID(),grammarId,sourceId,randomUUID(),JSON.stringify(['Kucing','Anjing','Burung']),dialogueFingerprint(grammar)]);
  const options = { transaction: fn => fn(pool),adminCheck:async()=>false,resolvePlacement:async()=>({mode:'legacy'}) };
  const user = {id:userId,email:'test@example.test'};
  assert.equal((await listLearnerDialogueQuestions(sourceId,user,options)).grammars.length,0);
  await pool.query('UPDATE lessons SET module_id=$1 WHERE id=$2', [moduleId,conversationId]);
  const result = await listLearnerDialogueQuestions(sourceId,user,options);
  assert.equal(result.standalone,true);
  assert.equal(result.placement.mode,'legacy');
  assert.equal(result.grammars.length,1);
  await pool.query("UPDATE module_grammar SET example_dialog='A: いぬです。'");
  assert.equal((await listLearnerDialogueQuestions(sourceId,user,options)).grammars.length,0);
  await pool.query("UPDATE user_enrollments SET status='revoked'");
  await assert.rejects(listLearnerDialogueQuestions(sourceId,user,options), e=>e.status===403);
});
