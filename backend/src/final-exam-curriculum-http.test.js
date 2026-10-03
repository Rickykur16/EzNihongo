import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import express from 'express';
import pg from 'pg';
import {namedBanks} from '../content/final-exams/names.mjs';
import {curriculumBanks} from '../content/final-exams/curriculum.mjs';
test('curriculum migration: atomic bank replacement, stale draft rejection, fresh grading and immutable history',{skip:!process.env.TEST_DATABASE_URL,timeout:60000},async t=>{
 const url=new URL(process.env.TEST_DATABASE_URL);assert.ok(['localhost','127.0.0.1'].includes(url.hostname)&&url.pathname.includes('test'));
 const schema='final_scope_test_'+randomUUID().replaceAll('-',''),control=new pg.Client({connectionString:url.href});await control.connect();await control.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
 url.searchParams.set('options',`-c search_path=${schema} -c statement_timeout=15000`);process.env.DATABASE_URL=url.href;process.env.JWT_ACCESS_SECRET='final-scope-test-only';process.env.ADMIN_EMAILS='';process.env.ELEVENLABS_API_KEY='';
 const {db}=await import('./db.js');let server;
 t.after(async()=>{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await db.end();await control.query(`DROP SCHEMA ${schema} CASCADE`);await control.end();});
 const sql=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
 await control.query(sql('schema.sql'));await control.query(sql('migrations/148_dialogue_speakers.sql'));
 const user=randomUUID();await control.query("INSERT INTO users(id,google_id,email,full_name) VALUES($1,'scope','scope@example.invalid','Scope Test')",[user]);
 for(const level of ['n5','n4']){const course=randomUUID();await control.query('INSERT INTO courses(id,slug,title,is_published) VALUES($1,$2,$2,true)',[course,level]);await control.query("INSERT INTO user_enrollments(user_id,course_id,status) VALUES($1,$2,'active')",[user,course]);}
 for(const file of ['194_jlpt_final_exams.sql','195_final_exam_rotation.sql','196_final_exam_jlpt_scoring.sql','197_final_exam_natural_names.sql'])await control.query(sql('migrations/'+file));
 await control.query('UPDATE lessons SET cooldown_hours=0');
 const {signAccessToken}=await import('./auth.js'),{default:progress}=await import('./routes/progress.js');
 const app=express();app.use(express.json(),progress);app.use((err,req,res,next)=>res.status(500).json({error:err.message}));server=app.listen(0,'127.0.0.1');await once(server,'listening');
 const token=await signAccessToken(user,'scope@example.invalid'),base=`http://127.0.0.1:${server.address().port}`;
 const call=async(b,route,body={},method='POST',status=200)=>{const r=await fetch(`${base}/progress/lesson/${b.lessonId}/${route}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)}),data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;};
 const snap=async state=>(await control.query('SELECT assessment_snapshot FROM quiz_attempts WHERE attempt_token=$1',[state.attemptToken])).rows[0].assessment_snapshot;
 const finish=async(b,s)=>{const snapshot=await snap(s);return call(b,'quiz-attempt',{attemptToken:s.attemptToken,draftRevision:0,answers:snapshot.questions.map(q=>({questionId:q.id,optionId:q.options.find(o=>o.is_correct).id}))});};
 await finish(namedBanks[0],await call(namedBanks[0],'quiz/start'));
 const completed=(await control.query('SELECT * FROM quiz_attempts WHERE completed_at IS NOT NULL ORDER BY id')).rows;
 const pending=await Promise.all(namedBanks.map(b=>call(b,'quiz/start')));
 const before=(await control.query('SELECT * FROM quiz_attempts ORDER BY id')).rows;
 const scopeSql=sql('migrations/199_final_exam_curriculum_scope.sql'),target=namedBanks[1].rows.find(q=>q.assessment_meta.key==='n4-a-008');
 await control.query('UPDATE quiz_questions SET explanation=$2 WHERE id=$1',[target.id,'Teacher conflict']);
 await assert.rejects(control.query(scopeSql),/199 question edited/);
 assert.equal((await control.query("SELECT count(*)::int n FROM quiz_questions WHERE assessment_meta->>'scopeRevision'='curriculum-scope-v1'")).rows[0].n,0);
 assert.deepEqual((await control.query('SELECT * FROM quiz_attempts ORDER BY id')).rows,before);
 await control.query('UPDATE quiz_questions SET explanation=$2 WHERE id=$1',[target.id,target.explanation]);await control.query(scopeSql);
 assert.deepEqual((await control.query('SELECT * FROM quiz_attempts WHERE completed_at IS NOT NULL ORDER BY id')).rows,completed);
 for(const [i,b]of curriculumBanks.entries()){
  assert.ok((await control.query('SELECT superseded_at FROM quiz_attempts WHERE attempt_token=$1',[pending[i].attemptToken])).rows[0].superseded_at);
  await call(b,'quiz/draft',{attemptToken:pending[i].attemptToken,answers:[],revision:0},'PUT',409);
  const fresh=await call(b,'quiz/start');assert.notEqual(fresh.attemptToken,pending[i].attemptToken);assert.deepEqual(fresh.draftAnswers,[]);
  for(const q of (await snap(fresh)).questions){const expected=b.rows.find(r=>r.id===q.id);for(const field of ['question','passage','audio_script','assessment_meta'])assert.deepEqual(q[field],expected[field]);}
  await control.query(scopeSql);assert.equal((await call(b,'quiz/start')).attemptToken,fresh.attemptToken);
  const result=await finish(b,fresh);assert.equal(result.scoreReport.score,180);assert.equal(result.passed,true);
 }
});
