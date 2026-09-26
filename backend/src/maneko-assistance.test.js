import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pgDriver from 'pg';
import { assistanceFor, recordExposure, independentEvidenceSql, reviewHelp } from './maneko-assistance.js';
import { recordPracticeAttemptWithState } from './practice-service.js';
import { loadMastery } from './grammar-mastery.js';
import { db } from './db.js';
import reviewRouter from './routes/smart-review.js';
import { weeklyActivity } from './dashboard-service.js';

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
  await t.test('wrong first answer survives later help and corrected retry', async () => {
    const session = await makeSession();
    const first = await invoke('answers',session,{questionIndex:0,optionIndex:1});
    assert.equal(first.body.passed,false); assert.equal(first.body.assisted,false);
    const before = (await pg.query('SELECT * FROM user_practice_state')).rows;
    const help = await invoke('help',session,{questionIndex:0,level:3});
    assert.equal(help.body.firstResult.passed,false); assert.match(help.body.text,/a/);
    const retry = await invoke('answers',session,{questionIndex:0,optionIndex:0});
    assert.equal(retry.body.passed,false);
    assert.deepEqual((await pg.query('SELECT * FROM user_practice_state')).rows,before);
    assert.equal((await pg.query('SELECT * FROM practice_attempts')).rows.length,1);
  });
  await t.test('help before answer and another session on related lesson never update FSRS', async () => {
    const session = await makeSession();
    const help = await invoke('help',session,{questionIndex:0,level:1});
    assert.equal(help.statusCode,200);
    assert.ok(await assistanceFor(pg,{userId:id(1),lessonId:id(5),itemType:'kana',itemId:id(99)}));
    const before = (await pg.query('SELECT * FROM user_practice_state')).rows;
    const answered = await invoke('answers',session,{questionIndex:0,optionIndex:0,assisted:false});
    assert.equal(answered.body.assisted,true);assert.equal(answered.body.evidenceEligible,false);
    const otherSession = await makeSession();
    assert.equal((await invoke('answers',otherSession,{questionIndex:0,optionIndex:0})).body.assisted,true);
    assert.deepEqual((await pg.query('SELECT * FROM user_practice_state')).rows,before);
  });
  await t.test('assisted lesson drill remains activity but cannot alter independent state or accuracy', async () => {
    const before=(await pg.query('SELECT * FROM user_practice_state')).rows;
    const result=await recordPracticeAttemptWithState(pg,{userId:id(1),courseId:id(3),lessonId:id(5),itemType:'kana',itemId:id(10),skill:'k2r',isCorrect:true,source:'lesson_drill'});
    assert.equal(result.assisted,true);
    assert.deepEqual((await pg.query('SELECT * FROM user_practice_state')).rows,before);
    const eligible=await pg.query(`SELECT * FROM practice_attempts pa WHERE ${independentEvidenceSql({item:'pa.item_id',type:'pa.item_type'},'pa')}`);
    assert.equal(eligible.rows.length,1);assert.equal(eligible.rows[0].is_correct,false);
  });
  await t.test('unrelated content stays independent; free chat applies across all tabs', async () => {
    assert.equal(await assistanceFor(pg,{userId:id(1),lessonId:id(6),itemType:'vocabulary',itemId:id(90)}),null);
    await recordExposure(pg,{userId:id(1),type:'tutor_chat'});
    assert.ok(await assistanceFor(pg,{userId:id(1),lessonId:id(6),itemType:'vocabulary',itemId:id(90)}));
    assert.equal(await assistanceFor(pg,{userId:id(2),lessonId:id(6),itemType:'vocabulary',itemId:id(90)}),null);
  });
  await t.test('grammar answer with help cannot enter mastery; historical attempts are filtered', async () => {
    const session=await makeSession('grammar',id(5),{step:1,options:['a','i'],correctIndex:0});
    assert.equal((await invoke('answers',session,{questionIndex:0,optionIndex:0})).body.assisted,true);
    assert.equal((await pg.query('SELECT * FROM grammar_attempts')).rows.length,0);
    await pg.query("INSERT INTO grammar_attempts(user_id,grammar_id,lesson_id,source,passed) VALUES ($1,$2,$3,'recognition',TRUE)",[id(1),id(10),id(5)]);
    await pg.query('INSERT INTO quiz_question_results(user_id,lesson_id,grammar_id,is_correct) VALUES ($1,$2,$3,TRUE)',[id(1),id(5),id(10)]);
    assert.equal((await loadMastery(id(1),[id(10)])).get(id(10)).attempts,0);
  });
  await t.test('owner, expiry and malformed inputs are rejected without exposing answers', async () => {
    const session=await makeSession();
    assert.equal((await invoke('help',session,{questionIndex:0,level:3},id(2))).statusCode,404);
    assert.equal((await invoke('help',session,{questionIndex:0,level:4})).statusCode,400);
    assert.equal((await invoke('answers',session,{questionIndex:0,optionIndex:null})).statusCode,400);
    await pg.query("UPDATE smart_review_sessions SET expires_at=NOW()-INTERVAL '1 minute' WHERE id=$1",[session]);
    assert.equal((await invoke('help',session,{questionIndex:0,level:3})).statusCode,410);
  });
  await t.test('dashboard retains assisted activity but excludes it from independent accuracy', async () => {
    const activity = await weeklyActivity(id(1),id(3));
    assert.equal(activity.activeDays,1);
    assert.equal(activity.attempts,1);
    assert.equal(activity.accuracy,0);
    assert.equal(activity.reviewQuestions,1);
  });
  await t.test('assistance failure rolls back and never reveals content', async () => {
    const session=await makeSession();
    const connect=db.connect;
    db.connect=async()=>({release(){},query(sql,args){if(sql.startsWith('INSERT INTO maneko_exposures'))throw Error('storage unavailable');return pg.query(sql,args);}});
    await assert.rejects(()=>invoke('help',session,{questionIndex:0,level:3}),/storage unavailable/);
    db.connect=connect;
    assert.equal((await pg.query('SELECT * FROM maneko_exposures WHERE session_id=$1',[session])).rows.length,0);
  });
  await t.test('expired exposure allows a later independent attempt without rewriting assisted history', async () => {
    const oldSession=await makeSession();
    await invoke('help',oldSession,{questionIndex:0,level:1});
    await pg.query("UPDATE maneko_exposures SET expires_at=clock_timestamp()-INTERVAL '1 millisecond'");
    assert.equal((await invoke('answers',oldSession,{questionIndex:0,optionIndex:0})).body.assisted,true);
    const session=await makeSession('grammar',id(5),{step:1,options:['a','i'],correctIndex:0});
    assert.equal((await invoke('answers',session,{questionIndex:0,optionIndex:0})).body.assisted,false);
    assert.equal((await loadMastery(id(1),[id(10)])).get(id(10)).attempts,1);
  });
});

test('progressive hints do not reveal the answer until the final step',()=>{
  const question={options:['secret-answer','other'],correctIndex:0};
  assert.ok(!reviewHelp(question,1).includes('secret-answer'));
  assert.ok(!reviewHelp(question,2).includes('secret-answer'));
  assert.match(reviewHelp(question,3),/secret-answer/);
});
