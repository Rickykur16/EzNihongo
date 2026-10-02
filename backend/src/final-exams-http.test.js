import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import express from 'express';
import pg from 'pg';
import {banks} from '../content/final-exams/index.mjs';

test('final exams: atomic migration, real HTTP lifecycle, grading, privacy and safe replay',{
 skip:!process.env.TEST_DATABASE_URL,timeout:60000,
},async t=>{
 const url=new URL(process.env.TEST_DATABASE_URL);
 assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
 const schema='final_exam_test_'+randomUUID().replaceAll('-','');
 const control=new pg.Client({connectionString:url.href});await control.connect();
 await control.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
 url.searchParams.set('options',`-c search_path=${schema} -c statement_timeout=15000`);
 process.env.DATABASE_URL=url.href;process.env.JWT_ACCESS_SECRET='final-exam-test-only';process.env.ADMIN_EMAILS='';process.env.ELEVENLABS_API_KEY='';
 const {db}=await import('./db.js');let server;
 t.after(async()=>{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await db.end();await control.query(`DROP SCHEMA ${schema} CASCADE`);await control.end();});
 await control.query(fs.readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
 await control.query(fs.readFileSync(new URL('../migrations/148_dialogue_speakers.sql',import.meta.url),'utf8'));
 const sql=fs.readFileSync(new URL('../migrations/194_jlpt_final_exams.sql',import.meta.url),'utf8');
 const user=randomUUID(),other=randomUUID(),n5=randomUUID(),n4=randomUUID();
 await control.query(`INSERT INTO users(id,google_id,email,full_name) VALUES($1,'final1','final1@example.invalid','Final Test'),($2,'final2','final2@example.invalid','Other')`,[user,other]);
 await control.query(`INSERT INTO courses(id,slug,title,is_published) VALUES($1,'n5','N5',true)`,[n5]);
 await t.test('missing course aborts without half-installed exams',async()=>{
  await assert.rejects(control.query(sql),/missing\/ambiguous course/);
  assert.equal((await control.query('SELECT count(*)::int n FROM modules')).rows[0].n,0);
 });
 await control.query(`INSERT INTO courses(id,slug,title,is_published) VALUES($1,'n4','N4',true)`,[n4]);
 const legacyModule=randomUUID(),legacyLesson=randomUUID(),legacyQuestion=randomUUID(),legacyAttempt=randomUUID();
 await control.query(`INSERT INTO modules(id,course_id,slug,title,sort_order) VALUES($1,$2,'existing','Existing chapter',20)`,[legacyModule,n5]);
 await control.query(`INSERT INTO lessons(id,module_id,slug,title,type,content) VALUES($1,$2,'existing-quiz','Existing quiz','quiz','KEEP')`,[legacyLesson,legacyModule]);
 await control.query(`INSERT INTO quiz_questions(id,lesson_id,question) VALUES($1,$2,'KEEP question')`,[legacyQuestion,legacyLesson]);
 await control.query(`INSERT INTO quiz_attempts(id,user_id,lesson_id,started_at) VALUES($1,$2,$3,now())`,[legacyAttempt,user,legacyLesson]);
 const capture=async()=>({
  module:(await control.query('SELECT * FROM modules WHERE id=$1',[legacyModule])).rows[0],
  lesson:(await control.query('SELECT * FROM lessons WHERE id=$1',[legacyLesson])).rows[0],
  question:(await control.query('SELECT * FROM quiz_questions WHERE id=$1',[legacyQuestion])).rows[0],
  attempt:(await control.query('SELECT * FROM quiz_attempts WHERE id=$1',[legacyAttempt])).rows[0],
 });const before=await capture();
 await control.query(sql);
 await t.test('new exams sit after course material and leave existing records unchanged',async()=>{
  assert.deepEqual(await capture(),before);
  assert.equal((await control.query('SELECT sort_order FROM modules WHERE id=$1',[banks[0].moduleId])).rows[0].sort_order,21);
  assert.equal((await control.query(`SELECT count(*)::int n FROM quiz_questions WHERE assessment_meta->>'source'='eznihongo-original'`)).rows[0].n,170);
  await control.query('UPDATE quiz_questions SET explanation=$2 WHERE id=$1',[banks[0].rows[0].id,'Teacher editorial update']);
  await control.query(sql);
  assert.equal((await control.query('SELECT explanation FROM quiz_questions WHERE id=$1',[banks[0].rows[0].id])).rows[0].explanation,'Teacher editorial update');
  assert.deepEqual(await capture(),before);
 });
 await control.query(`INSERT INTO user_enrollments(user_id,course_id,status) VALUES($1,$3,'active'),($1,$4,'active'),($2,$3,'active')`,[user,other,n5,n4]);
 const {signAccessToken}=await import('./auth.js');
 const {default:progress}=await import('./routes/progress.js');const {default:content}=await import('./routes/content.js');const {default:tts}=await import('./routes/tts.js');
 const app=express();app.use(express.json(),tts,progress,content);app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:err.message});});
 server=app.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}`;
 const token=await signAccessToken(user,'final1@example.invalid'),otherToken=await signAccessToken(other,'final2@example.invalid');
 const path=(b,s)=>`/progress/lesson/${b.lessonId}/${s}`;
 const call=async(p,body,method='POST',auth=token)=>{const r=await fetch(base+p,{method,headers:{Authorization:`Bearer ${auth}`,'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body||{})})});return{status:r.status,body:await r.json()};};
 for(const bank of banks){
  await t.test(`${bank.level}: start all items; protect evidence; save/resume; score immutable snapshot`,async()=>{
   const started=await call(path(bank,'quiz/start'));assert.equal(started.status,200,JSON.stringify(started.body));
   const state=started.body;assert.equal(state.questions.length,bank.rows.length);assert.equal(state.poolSize,bank.rows.length);assert.equal(state.assessmentRules.questionsPerForm,bank.rows.length);
   assert.doesNotMatch(JSON.stringify(state),/is_correct|correct_answer|assessment_meta|audio_script|explanation|spokenChoices|ordered|distractorReasons/);
   const snap=(await control.query('SELECT assessment_snapshot FROM quiz_attempts WHERE attempt_token=$1',[state.attemptToken])).rows[0].assessment_snapshot;
   const answers=snap.questions.map(q=>({questionId:q.id,optionId:q.options.find(o=>o.is_correct).id}));
   assert.equal((await call(`/lessons/${bank.lessonId}/quiz/check`,answers[0])).status,409);
   assert.equal((await call(path(bank,`quiz/review?attemptToken=${state.attemptToken}`),null,'GET')).status,404);
   assert.equal((await call(path(bank,'quiz/draft'),{attemptToken:state.attemptToken,answers:answers.slice(0,3),revision:0},'PUT')).body.revision,1);
   assert.equal((await call(path(bank,'quiz/draft'),{attemptToken:state.attemptToken,answers:[],revision:0},'PUT')).status,409);
   const resumed=await call(path(bank,'quiz/start'));assert.equal(resumed.body.attemptToken,state.attemptToken);assert.deepEqual(resumed.body.questions,state.questions);assert.equal(resumed.body.draftAnswers.length,3);
   const audio=snap.questions.find(q=>q.audio_script);const audioPath=path(bank,`quiz/audio/${audio.id}?attemptToken=${state.attemptToken}`);
   assert.equal((await call(audioPath,null,'GET',otherToken)).status,bank.level==='n5'?404:403);
   const disabled=await call(audioPath,null,'GET');assert.equal(disabled.status,503);assert.equal(disabled.body.error,'tts_disabled');
   const publicAudio=await fetch(`${base}/tts/dialog?text=${encodeURIComponent(audio.audio_script)}`);assert.equal(publicAudio.status,403);
   await control.query('UPDATE quiz_options SET is_correct=false WHERE question_id=$1',[snap.questions[0].id]);
   const submitted=await call(path(bank,'quiz-attempt'),{attemptToken:state.attemptToken,answers,draftRevision:1});
   assert.equal(submitted.status,200,JSON.stringify(submitted.body));assert.equal(submitted.body.score,bank.rows.length);assert.equal(submitted.body.passed,true);assert.equal(submitted.body.review.length,bank.rows.length);
   const replay=await call(path(bank,'quiz-attempt'),{attemptToken:state.attemptToken,answers,draftRevision:1});assert.deepEqual(replay.body,submitted.body);
   const review=await call(path(bank,`quiz/review?attemptToken=${state.attemptToken}`),null,'GET');assert.equal(review.status,200);assert.ok(review.body.review.some(q=>q.audioScript));
   assert.equal((await call(path(bank,`quiz/review?attemptToken=${state.attemptToken}`),null,'GET',otherToken)).status,bank.level==='n5'?404:403);
  });
 }
});
