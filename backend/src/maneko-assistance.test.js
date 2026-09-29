import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pgDriver from 'pg';
import { recordPracticeAttemptWithState } from './practice-service.js';
import { loadMastery } from './grammar-mastery.js';
import { db } from './db.js';
import reviewRouter from './routes/smart-review.js';

const id = n => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
test('Maneko preserves independent evidence across help, retries and related sessions', { timeout: 90000 }, async t => {
  let pg;
  if (process.env.TEST_DATABASE_URL) {
    const url = new URL(process.env.TEST_DATABASE_URL);
    assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
    assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname));
    assert.match(url.pathname, /test/i);
    assert.ok(!url.searchParams.has('host') && !url.searchParams.has('hostaddr'));
    const client = new pgDriver.Client({connectionString:url.href});
    await client.connect();
    const schema = 'maneko_test_' + randomUUID().replaceAll('-','');
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    pg = {query:(sql,args)=>client.query(sql,args),exec:sql=>client.query(sql),async close(){await client.query('ROLLBACK');await client.query(`DROP SCHEMA "${schema}" CASCADE`);await client.end();}};
  } else {
    let PGlite;
    try { ({ PGlite } = await import(process.env.PGLITE_TEST_MODULE || '@electric-sql/pglite')); }
    catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; t.skip('Set TEST_DATABASE_URL or PGLITE_TEST_MODULE'); return; }
    pg = new PGlite();
  }
  const originalQuery = db.query, originalConnect = db.connect;
  db.query = (sql, args) => pg.query(sql, args);
  db.connect = async () => ({ query: db.query, release() {} });
  t.after(async () => { db.query = originalQuery; db.connect = originalConnect; await pg.close(); });
  await pg.exec(`
    CREATE TABLE users (id uuid PRIMARY KEY);
    CREATE TABLE courses (id uuid PRIMARY KEY);
    CREATE TABLE modules (id uuid PRIMARY KEY, course_id uuid);
    CREATE TABLE lessons (id uuid PRIMARY KEY, module_id uuid, type text DEFAULT 'text', popup_after_lesson_id uuid);
    CREATE TABLE module_grammar (id uuid PRIMARY KEY, module_id uuid);
    CREATE TABLE user_enrollments (user_id uuid, course_id uuid, status text, expires_at timestamptz);
    CREATE TABLE user_progress (user_id uuid, lesson_id uuid, completed boolean, completed_at timestamptz);
    CREATE TABLE grammar_attempts (user_id uuid, grammar_id uuid, lesson_id uuid, source text, input_mode text, sentence text, correct boolean, uses_pattern boolean, passed boolean, primary_error text, error_types text[], eval_source text, check_family_id text, created_at timestamptz DEFAULT NOW());
    CREATE TABLE quiz_question_results (user_id uuid, lesson_id uuid, grammar_id uuid, is_correct boolean, created_at timestamptz DEFAULT NOW());
    CREATE TABLE practice_attempts (user_id uuid, course_id uuid, lesson_id uuid, item_type text, item_id uuid, skill text, is_correct boolean, source text, created_at timestamptz DEFAULT NOW());
    CREATE TABLE user_practice_state (user_id uuid,item_type text,item_id uuid,skill text,attempts int,correct int,streak int,last_seen_at timestamptz,last_reviewed_at timestamptz,next_review_at timestamptz,mastery_state text,fsrs_stability float,fsrs_difficulty float,fsrs_state text,fsrs_reps int,fsrs_lapses int,updated_at timestamptz,PRIMARY KEY(user_id,item_type,item_id,skill));
    INSERT INTO users VALUES ('${id(1)}'), ('${id(2)}');
    INSERT INTO courses VALUES ('${id(3)}');
    INSERT INTO modules VALUES ('${id(4)}','${id(3)}');
    INSERT INTO lessons(id,module_id) VALUES ('${id(5)}','${id(4)}'),('${id(6)}','${id(4)}');
    INSERT INTO module_grammar VALUES ('${id(10)}','${id(4)}');
    INSERT INTO user_enrollments VALUES ('${id(1)}','${id(3)}','active',NULL);
    INSERT INTO user_progress(user_id,lesson_id,completed) VALUES ('${id(1)}','${id(5)}',TRUE),('${id(1)}','${id(6)}',TRUE);
  `);
  await pg.exec(await readFile(new URL('../migrations/133_smart_review_sessions.sql', import.meta.url), 'utf8'));
  const migration = await readFile(new URL('../migrations/164_maneko_learning_assistance.sql', import.meta.url), 'utf8');
  await pg.exec(migration); await pg.exec(migration);
  let serial = 20;
  async function makeSession(type = 'kana', lesson = id(5), payload = { prompt: 'あ', options: ['a', 'i'], correctIndex: 0 }) {
    const sessionId = id(serial++);
    await pg.query("INSERT INTO smart_review_sessions (id,user_id,category,expires_at) VALUES ($1,$2,'mixed',NOW()+INTERVAL '1 hour')", [sessionId,id(1)]);
    await pg.query('INSERT INTO smart_review_session_items (session_id,question_index,item_type,item_id,skill,lesson_id,payload) VALUES ($1,0,$2,$3,$4,$5,$6)', [sessionId,type,id(10),type==='grammar'?'recognition':'k2r',lesson,JSON.stringify(payload)]);
    return sessionId;
  }
  async function invoke(kind, sessionId, body, user = id(1)) {
    const handler = reviewRouter.stack.find(l => l.route?.path === `/sessions/:sessionId/${kind}`).route.stack.at(-1).handle;
    const res = { statusCode:200, status(code){this.statusCode=code;return this;},json(value){this.body=value;return this;} };
    await handler({ user:{id:user,email:'test@example.test'}, params:{sessionId},body }, res, e => {throw e;});
    return res;
  }
  // Jawaban "berbantuan" dihapus dari Smart Review dan drill pelajaran: setiap
  // jawaban selalu tercatat ke state FSRS, ada atau tidaknya paparan tutor.
  // Dulu jawaban yang jatuh di dalam jendela paparan dibuang diam-diam, sehingga
  // item yang dijawab benar tetap jatuh tempo dan kembali di sesi berikutnya.
  await t.test('smart review answers always update state, even with a leftover exposure row', async () => {
    // Baris paparan lama (dari sebelum konsep ini dihapus) tidak boleh lagi berpengaruh.
    await pg.query("INSERT INTO maneko_exposures (user_id, assistance_type, expires_at) VALUES ($1,'tutor_chat',NOW()+INTERVAL '30 minutes')",[id(1)]);
    const session = await makeSession();
    const answered = await invoke('answers',session,{questionIndex:0,optionIndex:0});
    assert.equal(answered.body.passed,true);
    assert.equal(answered.body.assisted,undefined);
    const state = (await pg.query('SELECT attempts, correct FROM user_practice_state WHERE item_id=$1',[id(10)])).rows;
    assert.equal(state.length,1); assert.equal(state[0].attempts,1); assert.equal(state[0].correct,1);
    assert.equal((await pg.query('SELECT * FROM practice_attempts')).rows.length,1);
  });
  await t.test('wrong smart review answer is recorded too', async () => {
    const session = await makeSession('kana',id(5),{prompt:'い',options:['a','i'],correctIndex:1});
    const answered = await invoke('answers',session,{questionIndex:0,optionIndex:0});
    assert.equal(answered.body.passed,false);
    assert.equal((await pg.query('SELECT * FROM practice_attempts')).rows.length,2);
  });
  await t.test('lesson drill attempt updates state despite an exposure', async () => {
    const before=(await pg.query('SELECT attempts FROM user_practice_state WHERE item_id=$1 AND skill=$2',[id(11),'k2r'])).rows;
    assert.equal(before.length,0);
    const result=await recordPracticeAttemptWithState(pg,{userId:id(1),courseId:id(3),lessonId:id(5),itemType:'kana',itemId:id(11),skill:'k2r',isCorrect:true,source:'lesson_drill'});
    assert.equal(result.attempts,1);
    assert.equal((await pg.query('SELECT attempts FROM user_practice_state WHERE item_id=$1 AND skill=$2',[id(11),'k2r'])).rows[0].attempts,1);
  });
  await t.test('grammar smart review answer is stored as an attempt despite an exposure', async () => {
    const session=await makeSession('grammar',id(5),{step:1,options:['a','i'],correctIndex:0});
    assert.equal((await invoke('answers',session,{questionIndex:0,optionIndex:0})).body.passed,true);
    assert.equal((await pg.query('SELECT * FROM grammar_attempts')).rows.length,1);
  });
  await t.test('grammar mastery counts every stored attempt, even inside a leftover exposure window', async () => {
    await pg.query('INSERT INTO quiz_question_results(user_id,lesson_id,grammar_id,is_correct) VALUES ($1,$2,$3,TRUE)',[id(1),id(5),id(10)]);
    // 1 jawaban smart review grammar (subtes sebelumnya) + 1 hasil kuis
    assert.equal((await loadMastery(id(1),[id(10)])).get(id(10)).attempts,2);
  });
  await t.test('owner, expiry and malformed inputs are rejected', async () => {
    const session=await makeSession();
    assert.equal((await invoke('answers',session,{questionIndex:0,optionIndex:0},id(2))).statusCode,404);
    assert.equal((await invoke('answers',session,{questionIndex:0,optionIndex:null})).statusCode,400);
    await pg.query("UPDATE smart_review_sessions SET expires_at=NOW()-INTERVAL '1 minute' WHERE id=$1",[session]);
    assert.equal((await invoke('answers',session,{questionIndex:0,optionIndex:0})).statusCode,410);
  });
  await t.test('smart review no longer exposes a help endpoint', () => {
    assert.equal(reviewRouter.stack.some(l => l.route?.path === '/sessions/:sessionId/help'), false);
  });
});
