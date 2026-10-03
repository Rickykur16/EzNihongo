import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import express from 'express';
import pg from 'pg';
import {banks} from '../content/final-exams/index.mjs';
import {rotationBanks} from '../content/final-exams/rotation.mjs';

test('final rotation: transactional upgrade, historical snapshots, concurrent starts and A/B retakes',{
 skip:!process.env.TEST_DATABASE_URL,timeout:60000,
},async t=>{
 const url=new URL(process.env.TEST_DATABASE_URL);
 assert.ok(['localhost','127.0.0.1'].includes(url.hostname)&&url.pathname.includes('test'));
 const schema='final_rotation_test_'+randomUUID().replaceAll('-','');
 const control=new pg.Client({connectionString:url.href});await control.connect();
 await control.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
 url.searchParams.set('options',`-c search_path=${schema} -c statement_timeout=15000`);
 process.env.DATABASE_URL=url.href;process.env.JWT_ACCESS_SECRET='final-rotation-test-only';process.env.ADMIN_EMAILS='';process.env.ELEVENLABS_API_KEY='';
 const {db}=await import('./db.js');let server;
 t.after(async()=>{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await db.end();await control.query(`DROP SCHEMA ${schema} CASCADE`);await control.end();});
 const sql=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
 await control.query(sql('schema.sql'));await control.query(sql('migrations/148_dialogue_speakers.sql'));
 const user=randomUUID();
 await control.query(`INSERT INTO users(id,google_id,email,full_name) VALUES($1,'rotation1','rotation@example.invalid','Rotation Test')`,[user]);
 for(const level of ['n5','n4']) {
  const course=randomUUID();await control.query(`INSERT INTO courses(id,slug,title,is_published) VALUES($1,$2,$2,true)`,[course,level]);
  await control.query(`INSERT INTO user_enrollments(user_id,course_id,status) VALUES($1,$2,'active')`,[user,course]);
 }
 await control.query(sql('migrations/194_jlpt_final_exams.sql'));
 await control.query('UPDATE lessons SET cooldown_hours=0');
 const {signAccessToken}=await import('./auth.js'),{default:progress}=await import('./routes/progress.js');
 const app=express();app.use(express.json(),progress);app.use((err,req,res,next)=>res.status(500).json({error:err.message}));
 server=app.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}`,token=await signAccessToken(user,'rotation@example.invalid');
 const call=async(b,route,body,method='POST')=>{
  const r=await fetch(`${base}/progress/lesson/${b.lessonId}/${route}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body||{})})});
  const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data;
 };
 const snapshot=async state=>(await control.query('SELECT assessment_snapshot FROM quiz_attempts WHERE attempt_token=$1',[state.attemptToken])).rows[0].assessment_snapshot;
 const finish=async(b,state,revision=0)=>{
  const s=await snapshot(state),answers=s.questions.map(q=>({questionId:q.id,optionId:q.options.find(o=>o.is_correct).id}));
  const result=await call(b,'quiz-attempt',{attemptToken:state.attemptToken,answers,draftRevision:revision});
  assert.equal(result.score,state.questions.length);assert.equal(result.passed,true);assert.equal(result.review.length,state.questions.length);
  return result;
 };
 const oldStarts=await Promise.all(banks.map(b=>call(b,'quiz/start')));
 const oldQuestions=(await control.query('SELECT * FROM quiz_questions ORDER BY id')).rows;
 const oldAttempts=(await control.query('SELECT * FROM quiz_attempts ORDER BY id')).rows;
 const rotationSql=sql('migrations/195_final_exam_rotation.sql');
 await t.test('preflight failure does not partially install the other level',async()=>{
  await control.query("UPDATE lessons SET assessment_policy=assessment_policy||'{\"version\":\"unknown\"}'::jsonb WHERE id=$1",[banks[1].lessonId]);
  await assert.rejects(control.query(rotationSql),/missing\/conflicting/);
  assert.equal((await control.query('SELECT count(*)::int n FROM quiz_questions')).rows[0].n,170);
  assert.equal((await control.query('SELECT assessment_policy FROM lessons WHERE id=$1',[banks[0].lessonId])).rows[0].assessment_policy.version,banks[0].version);
  await control.query('UPDATE lessons SET assessment_policy=$2 WHERE id=$1',[banks[1].lessonId,banks[1].policy]);
 });
 await control.query(rotationSql);
 await t.test('upgrade preserves every v1 question and attempt, replay preserves edits',async()=>{
  assert.deepEqual((await control.query("SELECT * FROM quiz_questions WHERE assessment_meta->>'version' LIKE '%-v1' ORDER BY id")).rows,oldQuestions);
  assert.deepEqual((await control.query('SELECT * FROM quiz_attempts ORDER BY id')).rows,oldAttempts);
  const q=rotationBanks[0].rows[0];await control.query('UPDATE quiz_questions SET explanation=$2 WHERE id=$1',[q.id,'Teacher edit']);
  await control.query(rotationSql);
  assert.equal((await control.query('SELECT explanation FROM quiz_questions WHERE id=$1',[q.id])).rows[0].explanation,'Teacher edit');
  assert.equal((await control.query('SELECT count(*)::int n FROM quiz_questions')).rows[0].n,474);
 });
 for(const [i,bank] of rotationBanks.entries()) {
  await t.test(`${bank.level}: v1 resumes after upgrade; new attempts alternate without changing on refresh`,async()=>{
   const old=await call(bank,'quiz/start');assert.deepEqual(old.questions,oldStarts[i].questions);assert.equal(old.attemptToken,oldStarts[i].attemptToken);
   assert.equal(old.assessmentVersion,banks[i].version);
   const oldStatus=await call(bank,'quiz-status',null,'GET');assert.equal(oldStatus.assessmentUpdate.version,bank.version);assert.equal(oldStatus.questionsPerAttempt,banks[i].rows.length);
   await finish(bank,old);
   const starts=await Promise.all([call(bank,'quiz/start'),call(bank,'quiz/start')]);
   assert.equal(starts[0].attemptToken,starts[1].attemptToken);assert.deepEqual(starts[0].questions,starts[1].questions);
   const a=starts[0],n=bank.policy.questionsPerForm;
   assert.equal(a.questions.length,n);assert.equal(a.assessmentRules.questionsPerForm,n);assert.equal(a.assessmentVersion,bank.version);
   const status=await call(bank,'quiz-status',null,'GET');assert.equal(status.questionsPerAttempt,n);assert.equal(status.poolSize,2*n);
   const fresh=starts.find(s=>!s.resumed);assert.equal(fresh.poolSize,2*n);
   assert.doesNotMatch(JSON.stringify(a),/is_correct|correct_answer|assessment_meta|audio_script|explanation|spokenChoices|ordered|distractorReasons/);
   const answer={questionId:a.questions[0].id,optionId:a.questions[0].options[0].id};
   await call(bank,'quiz/draft',{attemptToken:a.attemptToken,answers:[answer],revision:0},'PUT');
   const resumed=await call(bank,'quiz/start');assert.equal(resumed.assessmentForm,a.assessmentForm);assert.equal(resumed.attemptToken,a.attemptToken);assert.deepEqual(resumed.questions,a.questions);assert.deepEqual(resumed.draftAnswers,[answer]);
   const result=await finish(bank,resumed,1);
   const b=await call(bank,'quiz/start');assert.notEqual(b.assessmentForm,a.assessmentForm);assert.equal(b.questions.length,n);
   assert.ok(b.questions.every(q=>!a.questions.some(previous=>previous.id===q.id)));
   await finish(bank,b);
   const c=await call(bank,'quiz/start');assert.equal(c.assessmentForm,a.assessmentForm);assert.deepEqual(c.questions,a.questions);
   const review=await call(bank,`quiz/review?attemptToken=${a.attemptToken}`,null,'GET');assert.deepEqual(review.review,result.review);
  });
 }
});
