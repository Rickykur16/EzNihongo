import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {plans} from '../content/assessments/expanded/index.mjs';
import {buildExpandedMigration} from '../scripts/build-expanded-n5-assessments.mjs';
import {EXPANDED_CHAPTER_BLUEPRINT,createChapterSnapshot,publicChapterRules,publicChapterQuestions,gradeChapterAssessment,validateChapterDraft,assertChapterForm} from './chapter-assessment.js';

test('36-item N5 packets follow the official approximate item ratio, retain bounded goals and protect answers',()=>{
 assert.deepEqual(EXPANDED_CHAPTER_BLUEPRINT,{vocabulary:11,grammar:9,reading:3,listening:13});
 assert.equal(plans.length,18);
 assert.equal(plans.reduce((n,p)=>n+p.additions.length,0),266);
 const ids=plans.flatMap(p=>p.rows.map(q=>q.id));
 assert.equal(new Set(ids).size,684);
 const optionIds=plans.flatMap(p=>p.rows.flatMap(q=>q.options.map(o=>o.id)));
 assert.equal(new Set(optionIds).size,optionIds.length);
 for(const plan of plans){
  const snapshot=createChapterSnapshot(plan.policy,plan.rows,'B');
  assert.equal(snapshot.questions.length,36);
  assert.equal(snapshot.policy.questionsPerForm,36);
  assert.equal(publicChapterRules(plan.policy).questionsPerForm,36);
  assert.equal(snapshot.form,plan.chapter===3?'A':'ALL');
  assert.deepEqual(snapshot.questions.map(q=>q.question_category),Object.entries(EXPANDED_CHAPTER_BLUEPRINT).flatMap(([category,count])=>Array(count).fill(category)));
  if(plan.chapter===3)assert.equal(createChapterSnapshot(plan.policy,plan.rows,'A').form,'B');
  for(const [category,count] of Object.entries(EXPANDED_CHAPTER_BLUEPRINT))assert.equal(snapshot.questions.filter(q=>q.question_category===category).length,count);
  assert.equal(gradeChapterAssessment(snapshot,new Map(snapshot.questions.map(q=>[q.id,{correct:true}]))).score,36);
  const missingAudio=gradeChapterAssessment(snapshot,new Map(snapshot.questions.map(q=>[q.id,{correct:q.question_category!=='listening'}])));
  assert.equal(missingAudio.passed,false);
  const publicRows=publicChapterQuestions(snapshot);
  assert.doesNotMatch(JSON.stringify(publicRows),/is_correct|audio_script|assessment_meta|spokenChoices|ordered|distractorReasons|explanation/);
  assert.equal(publicRows.filter(q=>q.has_audio).length,13);
  assert.equal(validateChapterDraft(snapshot,publicRows.map(q=>({questionId:q.id,optionId:q.options[0].id}))),true);
  assert.throws(()=>assertChapterForm(plan.policy,snapshot.questions.slice(0,24)),/assessment_bank_invalid/);
  const oldPolicy={...plan.policy,version:plan.expectedVersion,questionsPerForm:24};
  const old=createChapterSnapshot(oldPolicy,plan.sourceRows,'B');
  assert.equal(old.questions.length,24);
  assert.equal(gradeChapterAssessment(old,new Map(old.questions.map(q=>[q.id,{correct:true}]))).score,24);
  for(const q of plan.additions){
   assert.equal(q.assessment_meta.distractorReasons.length,q.options.length);
   if(q.image_url)assert.equal(q.image_url,'/assets/assessments/speakers-ab.svg');
   if(q.assessment_meta.spokenChoices){
    for(const [j,choice] of q.assessment_meta.spokenChoices.entries())assert.ok(q.audio_script.includes(`${['いちばん','にばん','さんばん'][j]}。\n${q.image_url?'A':'B'}: ${choice}`));
    assert.deepEqual(q.options.map(o=>o.option_text),['1ばん','2ばん','3ばん']);
   }
  }
 }
});

test('v5 snapshot retains owner thresholds while the version fixes packet size',()=>{
 for(const plan of plans.slice(0,2)){
  const policy={...plan.policy,passingScorePct:90,categoryMinimumPct:75,minimumObjectiveCorrect:2,questionsPerForm:24};
  const snapshot=createChapterSnapshot(policy,plan.rows,'B');
  assert.equal(snapshot.policy.passingScorePct,90);assert.equal(snapshot.policy.categoryMinimumPct,75);
  assert.equal(snapshot.policy.minimumObjectiveCorrect,2);assert.equal(snapshot.policy.questionsPerForm,36);
  assert.deepEqual(publicChapterRules(policy),publicChapterRules(snapshot.policy));
 }
});

async function fixture(t){
 let db;
 if(process.env.TEST_DATABASE_URL){
  const url=new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname));assert.match(url.pathname,/test/i);
  assert.ok(!url.searchParams.has('host')&&!url.searchParams.has('hostaddr'));
  const {default:pg}=await import('pg'),client=new pg.Client({connectionString:url.href});await client.connect();
  const schema='expanded_n5_test_'+randomUUID().replaceAll('-','');
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
  const policy={...p.policy,version:p.expectedVersion,questionsPerForm:24,ownerSetting:'preserved',transferTask:{prompt:'Owner transfer task'},...(p.chapter===4?{passingScorePct:90,categoryMinimumPct:75,minimumObjectiveCorrect:2}:{})};
  await db.query("INSERT INTO lessons(id,module_id,slug,type,assessment_policy,content,questions_per_attempt) VALUES($1,$2,$3,'quiz',$4,'24 soal. Owner note.',24)",[lesson,module,`assignment-bab-${p.chapter}-fixture`,policy]);
  for(const {options:opts,...q} of p.sourceRows){
   questions.push({...q,lesson_id:lesson,audio_scene:q.audio_script&&q.sort_order%2?{ownerVoice:'keep-me'}:null,grammar_id:randomUUID()});
   options.push(...opts.map(o=>({...o,question_id:q.id,image_url:'/owner-option.svg'})));
  }
  const snapshot=createChapterSnapshot(policy,p.sourceRows,'B');
  for(const completed of [false,true])await db.query('INSERT INTO quiz_attempts VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),lesson,snapshot,[{questionId:snapshot.questions[0].id,optionId:snapshot.questions[0].options[0].id}],completed,completed?{score:19,total:24}:null]);
 }
 await db.query('INSERT INTO quiz_questions SELECT * FROM jsonb_populate_recordset(null::quiz_questions,$1)',[JSON.stringify(questions)]);
 await db.query('INSERT INTO quiz_options SELECT * FROM jsonb_populate_recordset(null::quiz_options,$1)',[JSON.stringify(options)]);
 await db.query("UPDATE quiz_questions SET question='Owner-edited question',explanation='Owner explanation' WHERE id=$1",[plans[1].sourceRows[0].id]);
 const module=randomUUID(),lesson=randomUUID();
 await db.query("INSERT INTO modules VALUES($1,$2,'n5-b3')",[module,other]);
 await db.query("INSERT INTO lessons(id,module_id,slug,type,assessment_policy,content,questions_per_attempt) VALUES($1,$2,'assignment-bab-3-fixture','quiz','{\"version\":\"untouched\"}','N4 stays',24)",[lesson,module]);
 return {db,targets};
}
const all=async(db,table)=>(await db.query(`SELECT * FROM ${table} ORDER BY id`)).rows;

test('additive migration preserves owner edits, voices, historic attempts, unrelated courses and reruns',{timeout:90000},async t=>{
 const f=await fixture(t);if(!f)return;
 const {db,targets}=f,before={};
 for(const table of ['lessons','quiz_questions','quiz_options','quiz_attempts'])before[table]=await all(db,table);
 const sql=buildExpandedMigration();
 assert.equal((await readFile(new URL('../migrations/216_expand_n5_assignments.sql',import.meta.url),'utf8')).replaceAll('\r\n','\n'),sql);
 await db.exec(`BEGIN; ${sql} COMMIT;`);
 assert.deepEqual(await all(db,'quiz_attempts'),before.quiz_attempts);
 const afterQ=await all(db,'quiz_questions'),afterO=await all(db,'quiz_options');
 for(const q of before.quiz_questions)assert.deepEqual(afterQ.find(row=>row.id===q.id),q);
 for(const o of before.quiz_options)assert.deepEqual(afterO.find(row=>row.id===o.id),o);
 assert.equal(afterQ.filter(q=>q.assessment_meta.version==='n5-assessment-v5').length,684);
 for(const lesson of await all(db,'lessons')){
  const original=before.lessons.find(l=>l.id===lesson.id),chapter=[...targets].find(([,id])=>id===lesson.id)?.[0];
  if(!chapter){assert.deepEqual(lesson,original);continue;}
  assert.deepEqual(lesson.assessment_policy,{...original.assessment_policy,version:'n5-assessment-v5',questionsPerForm:36});
  assert.equal(lesson.questions_per_attempt,36);assert.equal(lesson.content,'36 soal. Owner note.');
  const plan=plans.find(p=>p.chapter===chapter),rows=afterQ.filter(q=>q.lesson_id===lesson.id&&q.assessment_meta.version==='n5-assessment-v5').map(q=>({...q,options:afterO.filter(o=>o.question_id===q.id).sort((a,b)=>a.sort_order-b.sort_order)}));
  const snap=createChapterSnapshot(lesson.assessment_policy,rows,'B');assert.equal(snap.questions.length,36);
  assert.equal(snap.policy.passingScorePct,original.assessment_policy.passingScorePct);
  for(const clone of plan.clones){
   const old=before.quiz_questions.find(q=>q.id===clone.sourceId),now=rows.find(q=>q.id===clone.id);
   assert.deepEqual(now.audio_scene,old.audio_scene);assert.equal(now.grammar_id,old.grammar_id);
   assert.equal(now.question,old.question);assert.equal(now.explanation,old.explanation);
   assert.deepEqual(now.options.map(o=>o.id),clone.options.map(o=>o.id));
   assert.deepEqual(now.options.map(({id,question_id,...o})=>o),before.quiz_options.filter(o=>o.question_id===old.id).sort((a,b)=>a.sort_order-b.sort_order).map(({id,question_id,...o})=>o));
  }
 }
 assert.equal((await db.query('SELECT count(*)::int n FROM n5_assessment_backup_216')).rows[0].n,18);
 await db.query("UPDATE quiz_questions SET explanation='Later owner edit' WHERE id=$1",[plans[0].additions[0].id]);
 const beforeRerunQ=await all(db,'quiz_questions'),beforeRerunL=await all(db,'lessons');
 await db.exec(sql);
 assert.deepEqual(await all(db,'quiz_questions'),beforeRerunQ);assert.deepEqual(await all(db,'lessons'),beforeRerunL);
});

test('an unexpected late-chapter source identity rolls back every chapter',{timeout:90000},async t=>{
 const f=await fixture(t);if(!f)return;
 const {db}=f;
 await db.query('UPDATE quiz_questions SET id=$1 WHERE id=$2',[randomUUID(),plans.at(-1).sourceRows[0].id]);
 const before=await all(db,'lessons');
 await db.exec('BEGIN');
 await assert.rejects(db.exec(buildExpandedMigration()),/source identity changed Bab 20/);
 await db.exec('ROLLBACK');
 assert.deepEqual(await all(db,'lessons'),before);
 assert.equal((await db.query("SELECT count(*)::int n FROM quiz_questions WHERE assessment_meta->>'version'='n5-assessment-v5'")).rows[0].n,0);
});

test('a changed objective in the last chapter rolls back earlier writes too',{timeout:90000},async t=>{
 const f=await fixture(t);if(!f)return;
 const {db}=f;
 await db.query("UPDATE quiz_questions SET assessment_meta=jsonb_set(assessment_meta,'{objective}','\"owner-unknown-goal\"'::jsonb) WHERE id=$1",[plans.at(-1).clones[0].sourceId]);
 const before=await all(db,'lessons'),beforeQuestions=await all(db,'quiz_questions');
 await db.exec('BEGIN');
 await assert.rejects(db.exec(buildExpandedMigration()),/objective coverage changed Bab 20/);
 await db.exec('ROLLBACK');
 assert.deepEqual(await all(db,'lessons'),before);assert.deepEqual(await all(db,'quiz_questions'),beforeQuestions);
 assert.equal((await db.query("SELECT count(*)::int n FROM quiz_questions WHERE assessment_meta->>'version'='n5-assessment-v5'")).rows[0].n,0);
});
