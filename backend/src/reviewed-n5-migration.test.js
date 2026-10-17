import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {plans} from '../content/assessments/expanded/reviewed.mjs';
import {buildReviewedMigration} from '../scripts/build-reviewed-n5-assessments.mjs';
import {createChapterSnapshot,gradeChapterAssessment} from './chapter-assessment.js';

async function fixture(t){
 let db;
 if(process.env.TEST_DATABASE_URL){
  const url=new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname));assert.match(url.pathname,/test/i);
  assert.ok(!url.searchParams.has('host')&&!url.searchParams.has('hostaddr'));
  const {default:pg}=await import('pg'),client=new pg.Client({connectionString:url.href});await client.connect();
  const schema='reviewed_n5_test_'+randomUUID().replaceAll('-','');
  await client.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
  db={query:(sql,args)=>client.query(sql,args),exec:sql=>client.query(sql)};
  t.after(async()=>{try{await client.query(`ROLLBACK; DROP SCHEMA ${schema} CASCADE`);}finally{await client.end();}});
 }else{
  let PGlite;
  try{({PGlite}=await import(process.env.TEST_PGLITE_URL||'@electric-sql/pglite'));}
  catch(error){if(process.env.TEST_PGLITE_URL||error.code!=='ERR_MODULE_NOT_FOUND')throw error;t.skip('Set TEST_DATABASE_URL or TEST_PGLITE_URL');return;}
  db=new PGlite();t.after(()=>db.close());
 }
 await db.exec(`CREATE TABLE courses(id uuid PRIMARY KEY,slug text);
 CREATE TABLE modules(id uuid PRIMARY KEY,course_id uuid,slug text);
 CREATE TABLE lessons(id uuid PRIMARY KEY,module_id uuid,slug text,type text,assessment_policy jsonb,content text,questions_per_attempt int,updated_at timestamptz DEFAULT now());
 CREATE TABLE quiz_questions(id uuid PRIMARY KEY,lesson_id uuid,question text,question_type text,question_category text,grammar_id uuid,section_number int,section_label text,section_instruction text,audio_script text,audio_scene jsonb,passage text,image_url text,correct_answer text,explanation text,sort_order int,assessment_meta jsonb);
 CREATE TABLE quiz_options(id uuid PRIMARY KEY,question_id uuid,option_text text,is_correct boolean,image_url text,sort_order int);
 CREATE TABLE quiz_attempts(id uuid PRIMARY KEY,lesson_id uuid,assessment_snapshot jsonb,draft_answers jsonb,completed boolean,result jsonb);`);
 const course=randomUUID(),other=randomUUID(),targets=new Map(),questions=[],options=[];
 await db.query("INSERT INTO courses VALUES($1,'n5'),($2,'n4')",[course,other]);
 for(const p of plans){
  const module=randomUUID(),lesson=randomUUID();targets.set(p.chapter,lesson);
  await db.query('INSERT INTO modules VALUES($1,$2,$3)',[module,course,`n5-b${p.chapter}`]);
  const policy={...p.policy,version:p.expectedVersion,ownerSetting:'preserved',transferTask:{prompt:'Owner task'},...(p.chapter===4?{passingScorePct:90,categoryMinimumPct:75,minimumObjectiveCorrect:2}:{})};
  await db.query("INSERT INTO lessons(id,module_id,slug,type,assessment_policy,content,questions_per_attempt) VALUES($1,$2,$3,'quiz',$4,'36 soal. Owner note.',36)",[lesson,module,`assignment-bab-${p.chapter}-fixture`,policy]);
  for(const {options:opts,sourceId,...q} of p.sourceRows){
   questions.push({...q,lesson_id:lesson,audio_scene:q.audio_script&&q.sort_order%2?{ownerVoice:'keep-me'}:null,grammar_id:randomUUID()});
   options.push(...opts.map(o=>({...o,question_id:q.id})));
  }
  const snapshot=createChapterSnapshot(policy,p.sourceRows,'B');
  for(const completed of [false,true])await db.query('INSERT INTO quiz_attempts VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),lesson,JSON.stringify(snapshot),JSON.stringify([{questionId:snapshot.questions[0].id,optionId:snapshot.questions[0].options[0].id}]),completed,completed?JSON.stringify({score:29,total:36}):null]);
 }
 await db.query('INSERT INTO quiz_questions SELECT * FROM jsonb_populate_recordset(null::quiz_questions,$1)',[JSON.stringify(questions)]);
 await db.query('INSERT INTO quiz_options SELECT * FROM jsonb_populate_recordset(null::quiz_options,$1)',[JSON.stringify(options)]);
 // This item has no editorial field/choice changes. Its live owner edits must copy.
 const owner=plans[0].sourceRows[0];
 await db.query("UPDATE quiz_questions SET question='Owner-edited question',explanation='Owner explanation' WHERE id=$1",[owner.id]);
 await db.query("UPDATE quiz_options SET option_text='Owner choice',image_url='/owner.svg' WHERE id=$1",[owner.options[0].id]);
 const module=randomUUID(),lesson=randomUUID();
 await db.query("INSERT INTO modules VALUES($1,$2,'n5-b3')",[module,other]);
 await db.query("INSERT INTO lessons(id,module_id,slug,type,assessment_policy,content,questions_per_attempt) VALUES($1,$2,'assignment-bab-3-fixture','quiz','{\"version\":\"untouched\"}','N4 stays',24)",[lesson,module]);
 return {db,targets};
}
const all=async(db,table)=>(await db.query(`SELECT * FROM ${table} ORDER BY id`)).rows;

test('review migration copies live owner content and voices, preserves histories and safely reruns',{timeout:90000},async t=>{
 const f=await fixture(t);if(!f)return;
 const {db,targets}=f,before={};
 for(const table of ['lessons','quiz_questions','quiz_options','quiz_attempts'])before[table]=await all(db,table);
 const sql=buildReviewedMigration();
 assert.equal((await readFile(new URL('../migrations/217_review_n5_assignment_quality.sql',import.meta.url),'utf8')).replaceAll('\r\n','\n'),sql);
 await db.exec(`BEGIN; ${sql} COMMIT;`);
 assert.deepEqual(await all(db,'quiz_attempts'),before.quiz_attempts);
 const afterQ=await all(db,'quiz_questions'),afterO=await all(db,'quiz_options');
 for(const q of before.quiz_questions)assert.deepEqual(afterQ.find(row=>row.id===q.id),q);
 for(const o of before.quiz_options)assert.deepEqual(afterO.find(row=>row.id===o.id),o);
 assert.equal(afterQ.filter(q=>q.assessment_meta.version==='n5-assessment-v6').length,684);
 for(const lesson of await all(db,'lessons')){
  const original=before.lessons.find(l=>l.id===lesson.id),chapter=[...targets].find(([,id])=>id===lesson.id)?.[0];
  if(!chapter){assert.deepEqual(lesson,original);continue;}
  assert.deepEqual(lesson.assessment_policy,{...original.assessment_policy,version:'n5-assessment-v6'});
  assert.equal(lesson.content,original.content);assert.equal(lesson.questions_per_attempt,36);
  const plan=plans.find(p=>p.chapter===chapter),rows=afterQ.filter(q=>q.lesson_id===lesson.id&&q.assessment_meta.version==='n5-assessment-v6').map(q=>({...q,options:afterO.filter(o=>o.question_id===q.id).sort((a,b)=>a.sort_order-b.sort_order)}));
  const snapshot=createChapterSnapshot(lesson.assessment_policy,rows,'B');
  assert.equal(gradeChapterAssessment(snapshot,new Map(snapshot.questions.map(q=>[q.id,{correct:true}]))).passed,true);
  for(const row of plan.rows){
   const old=before.quiz_questions.find(q=>q.id===row.sourceId),now=rows.find(q=>q.id===row.id);
   assert.deepEqual(now.audio_scene,old.audio_scene);assert.equal(now.grammar_id,old.grammar_id);
   for(const field of ['question','passage','audio_script','image_url','explanation','section_number','section_label','section_instruction'])assert.deepEqual(now[field],Object.hasOwn(row.revision.fields,field)?row.revision.fields[field]:old[field]);
   assert.deepEqual(now.options.map(o=>o.id),row.options.map(o=>o.id));
   if(!row.revision.options)assert.deepEqual(now.options.map(({id,question_id,...o})=>o),before.quiz_options.filter(o=>o.question_id===old.id).sort((a,b)=>a.sort_order-b.sort_order).map(({id,question_id,...o})=>o));
  }
 }
 assert.equal((await db.query('SELECT count(*)::int n FROM n5_assessment_backup_217')).rows[0].n,18);
 await db.query("UPDATE quiz_questions SET explanation='Later owner edit' WHERE id=$1",[plans[0].rows[0].id]);
 const rerunQ=await all(db,'quiz_questions'),rerunL=await all(db,'lessons');
 await db.exec(sql);
 assert.deepEqual(await all(db,'quiz_questions'),rerunQ);assert.deepEqual(await all(db,'lessons'),rerunL);
});

test('review refuses to overwrite an edited revised item and rolls back all chapters',{timeout:90000},async t=>{
 const f=await fixture(t);if(!f)return;
 const {db}=f,row=plans.at(-1).rows.find(q=>q.revision.fields.question);
 await db.query("UPDATE quiz_questions SET question='New teacher wording' WHERE id=$1",[row.sourceId]);
 const before=await all(db,'lessons'),beforeQ=await all(db,'quiz_questions');
 await db.exec('BEGIN');
 await assert.rejects(db.exec(buildReviewedMigration()),/revised source content changed Bab 20/);
 await db.exec('ROLLBACK');
 assert.deepEqual(await all(db,'lessons'),before);assert.deepEqual(await all(db,'quiz_questions'),beforeQ);
});

test('changed source choices or goal definitions cannot silently invalidate the reviewed bank',{timeout:90000},async t=>{
 const f=await fixture(t);if(!f)return;
 const {db}=f,row=plans.at(-1).rows.find(q=>q.revision.options);
 await db.exec('BEGIN');
 await db.query("UPDATE quiz_options SET option_text='Teacher option' WHERE id=$1",[plans.at(-1).sourceRows.find(q=>q.id===row.sourceId).options[0].id]);
 await assert.rejects(db.exec(buildReviewedMigration()),/revised source choices changed Bab 20/);
 await db.exec('ROLLBACK');
 await db.exec('BEGIN');
 await db.query("UPDATE quiz_questions SET assessment_meta=jsonb_set(assessment_meta,'{distractorReasons}','[\"Teacher rationale\"]') WHERE id=$1",[row.sourceId]);
 await assert.rejects(db.exec(buildReviewedMigration()),/source identity\/objective changed Bab 20/);
 await db.exec('ROLLBACK');
 await db.exec('BEGIN');
 await db.query("UPDATE lessons SET assessment_policy=jsonb_set(assessment_policy,'{objectives}','[{\"id\":\"owner-goal\",\"canDo\":\"changed\"}]') WHERE id=$1",[f.targets.get(20)]);
 await assert.rejects(db.exec(buildReviewedMigration()),/objective evidence coverage changed Bab 20/);
 await db.exec('ROLLBACK');
 await db.exec('BEGIN');
 await db.query("UPDATE lessons SET assessment_policy=jsonb_set(assessment_policy,'{minimumObjectiveCorrect}','3') WHERE id=$1",[f.targets.get(17)]);
 await assert.rejects(db.exec(buildReviewedMigration()),/objective evidence coverage changed Bab 17/);
 await db.exec('ROLLBACK');
 assert.equal((await db.query("SELECT count(*)::int n FROM quiz_questions WHERE assessment_meta->>'version'='n5-assessment-v6'")).rows[0].n,0);
});
