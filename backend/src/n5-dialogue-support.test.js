import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {buildMigration,manifestHash,planUrl,migrationUrl,sceneStructure,coreFields} from '../scripts/build-n5-dialogue-support.mjs';
import {finalizeN5DialogueSupport} from './n5-dialogue-support-finalization.js';
import {dialogueFingerprint,questionFingerprint,saveDialogueQuestions} from './dialogue-question-service.js';
import {getCurriculumBoundary} from './curriculum-boundary.js';
import {normalizeDialogScene,sceneTurnVoices} from './dialogue-scene.js';
import {CURRICULUM_VALIDATOR_VERSION} from './curriculum-boundary-validator.js';

const plan=JSON.parse(await readFile(planUrl,'utf8'));
const sql=await readFile(migrationUrl,'utf8');
const pick=(row,fields)=>Object.fromEntries(fields.map(k=>[k,row[k]??null]));
const sourceFields=['example_dialog','example_dialog_id','communication_goal','dialog_scene','dialog_furigana'];
const questionFields=['id','grammar_id','source_lesson_id','kind','prompt','options','correct_index','explanation','sort_order','question_version','question_fingerprint','dialogue_fingerprint','evidence','source_kind','source_key','source_fingerprint','state','created_at'];

test('97 reviewed dialogues retain fixed grammar identity and six Bab 3 scripts/fingerprints',()=>{
  assert.equal(plan.items.length,97);
  assert.equal(new Set(plan.items.map(i=>i.grammarId)).size,97);
  assert.equal(plan.items.filter(i=>i.keepQuestions).length,6);
  assert.equal(plan.items.flatMap(i=>i.questions).length,182);
  assert.equal(new Set(plan.items.flatMap(i=>i.replacement.dialog_scene.participants.map(p=>p.characterKey))).size,6);
  assert.equal(sql.replaceAll('\r\n','\n'),buildMigration(plan));
  for(const i of plan.items){
    assert.equal(i.expectedCore.id,i.grammarId);
    const scene=normalizeDialogScene(i.replacement.dialog_scene);
    const turns=i.replacement.example_dialog.split('\n');
    assert.ok(turns.length>=4&&turns.length<=6,i.grammarId);
    assert.equal(turns.length,i.replacement.example_dialog_id.split('\n').length);
    assert.equal(dialogueFingerprint(i.replacement),i.dialogueFingerprint);
    for(const [n,e] of (scene.expressions||[]).entries())if(e)assert.equal(turns[n],e.speaker+': '+e.text);
    for(const p of scene.participants)assert.equal(p.voiceId,null,'voices are resolved from current profiles, never invented');
    if(i.keepQuestions){
      assert.equal(i.chapter,3);assert.equal(i.replacement.example_dialog,i.expectedSource.example_dialog);
      assert.equal(i.replacement.example_dialog_id,i.expectedSource.example_dialog_id);
      assert.equal(i.replacement.communication_goal,i.expectedSource.communication_goal);
      assert.equal(dialogueFingerprint(i.expectedSource),i.dialogueFingerprint);
    }else{
      assert.deepEqual(i.questions.map(q=>q.kind).sort(),['comprehension','transfer']);
      for(const q of i.questions){assert.equal(q.options.length,3);assert.ok(q.correctIndex>=0&&q.correctIndex<3);
        for(const e of q.evidence||[])assert.ok(turns[e.turnIndex].includes(e.quote));}
    }
  }
});

const options={skip:!process.env.TEST_DATABASE_URL&&'Set a disposable local TEST_DATABASE_URL',timeout:90000};
async function fixture(t){
  const url=new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['postgres:','postgresql:'].includes(url.protocol));assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname));
  assert.match(decodeURIComponent(url.pathname),/test/i);assert.ok(!url.searchParams.has('host')&&!url.searchParams.has('hostaddr'));
  const client=new pg.Client({connectionString:url.href,statement_timeout:30000});await client.connect();
  const schema='n5_dialogue_test_'+randomUUID().replaceAll('-','');
  t.after(async()=>{try{await client.query('ROLLBACK');await client.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');}finally{await client.end();}});
  await client.query('CREATE SCHEMA '+schema+'; SET search_path TO '+schema);
  await client.query(await readFile(new URL('../schema.sql',import.meta.url),'utf8'));
  for(const migration of ['147_bunpou_flow_pilot.sql','148_dialogue_speakers.sql','153_dialogue_scenes.sql','154_dialogue_furigana.sql','165_learning_flow_boundary_foundation.sql','177_dialogue_character_art.sql','178_conversation_lessons.sql'])
    await client.query(await readFile(new URL('../migrations/'+migration,import.meta.url),'utf8'));
  await client.query("INSERT INTO courses(id,slug,title,level,curriculum_boundary_mode) VALUES($1,'n5','N5','N5','off')",[plan.courseId]);
  for(const m of plan.chapters)await client.query('INSERT INTO modules(id,course_id,slug,title,sort_order) VALUES($1,$2,$3,$3,$4)',[m.id,plan.courseId,m.slug,m.sortOrder]);
  for(const l of [...plan.lessons].sort((a,b)=>Number(a.type==='conversation')-Number(b.type==='conversation')))
    await client.query('INSERT INTO lessons(id,module_id,slug,title,type,conversation_source_lesson_id) VALUES($1,$2,$3,$3,$4,$5)',[l.id,l.module_id,l.slug,l.type,l.conversation_source_lesson_id]);
  const taskLessons=new Map();for(const i of plan.items)for(const id of i.expectedTaskLessonIds)taskLessons.set(id,i.moduleId);
  for(const [id,module] of taskLessons)await client.query("INSERT INTO lessons(id,module_id,slug,title,type) VALUES($1,$2,$3,'Original task','grammar_task')",[id,module,'task-'+id]);
  for(const i of plan.items){
    const g={...i.expectedCore,...i.expectedSource};
    await client.query(`INSERT INTO module_grammar(id,module_id,lesson_id,pattern,meaning,example,notes,sort_order,
      example_dialog,example_dialog_id,communication_goal,dialog_scene,dialog_furigana)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb)`,[g.id,g.module_id,g.lesson_id,g.pattern,g.meaning,g.example,g.notes,g.sort_order,g.example_dialog,g.example_dialog_id,g.communication_goal,JSON.stringify(g.dialog_scene),JSON.stringify(g.dialog_furigana)]);
    for(const id of i.expectedTaskLessonIds)await client.query("INSERT INTO lesson_grammar_task_items(lesson_id,grammar_id,instruction,required_count) VALUES($1,$2,'Unchanged task',1)",[id,i.grammarId]);
  }
  for(const [n,key] of ['anna-wijaya','hadi-pratama','aoi-takahashi','ren-mori','claire-bennett','daniel-foster'].entries())
    await client.query('UPDATE dialogue_speakers SET voice_id=$2,voice_name=$3,profile_version=$4 WHERE character_key=$1',[key,'fixture-voice-'+n,'Fixture voice '+n,n+7]);
  const pairs=[...new Set(plan.items.flatMap(i=>(i.replacement.dialog_scene.expressions||[]).filter(Boolean).map(e=>i.replacement.dialog_scene.participants.find(p=>p.speaker===e.speaker).characterKey+'|'+e.expression)))];
  for(const pair of pairs){const [character,expression]=pair.split('|');await client.query("INSERT INTO dialogue_character_art(character_key,expression_key,label,image,mime,width,height) VALUES($1,$2,$2,$3,'image/png',1,1)",[character,expression,Buffer.from('fixture art')]);}
  for(const i of plan.items){
    const text=i.expectedSource.example_dialog.split('\n')[0].replace(/^[^:：]+[:：]\s*/u,'');
    const questions=i.keepQuestions?[
      {kind:'comprehension',prompt:'Pertanyaan lama yang dipertahankan?',options:['Satu','Dua','Tiga'],correctIndex:0,explanation:'Penjelasan lama.',sortOrder:0,evidence:[{turnIndex:0,quote:text}]},
      {kind:'transfer',prompt:'Penerapan lama yang dipertahankan?',options:['Satu','Dua','Tiga'],correctIndex:1,explanation:'Penjelasan lama.',sortOrder:0,evidence:null},
    ]:(i.expectedQuestions?.questions||[]);
    for(const q of questions)await client.query(`INSERT INTO grammar_dialog_questions(grammar_id,source_lesson_id,kind,prompt,options,
      correct_index,explanation,sort_order,question_fingerprint,dialogue_fingerprint,evidence,source_kind,state,boundary_fingerprint,validator_version)
      VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11::jsonb,'manual','active','old-boundary','old-validator')`,
    [i.grammarId,i.sourceLessonId,q.kind,q.prompt,JSON.stringify(q.options),q.correctIndex,q.explanation,q.sortOrder??0,questionFingerprint(q),dialogueFingerprint(i.expectedSource),q.evidence ? JSON.stringify(q.evidence) : null]);
    await client.query(`INSERT INTO grammar_dialog_questions(grammar_id,source_lesson_id,kind,prompt,options,correct_index,explanation,sort_order,
      question_fingerprint,dialogue_fingerprint,source_kind,state) VALUES($1,$2,'transfer','Archived historical question','["a","b","c"]',0,'Old explanation',9,'old-q','old-dialog','manual','archived')`,[i.grammarId,i.sourceLessonId]);
  }
  const user=randomUUID();await client.query("INSERT INTO users(id,google_id,email,full_name) VALUES($1::uuid,$1::text,'dialogue-test@example.invalid','Test')",[user]);
  await client.query(`INSERT INTO dialogue_question_attempts(user_id,question_id,grammar_id,lesson_id,request_id,request_payload_hash,
    question_version,question_fingerprint,dialogue_fingerprint,question_snapshot,selected_index,is_correct,response_snapshot)
    SELECT $1,id,grammar_id,source_lesson_id,gen_random_uuid(),'old-request',question_version,question_fingerprint,dialogue_fingerprint,
      jsonb_build_object('prompt',prompt),0,true,'{"correct":true}'::jsonb FROM grammar_dialog_questions`,[user]);
  await client.query("UPDATE lessons SET bunpou_flow_published='{\"sourceFingerprint\":\"preserved-bab3\",\"objective\":\"Original\"}'::jsonb WHERE id=ANY($1::uuid[])",[plan.items.filter(i=>i.keepQuestions).map(i=>i.sourceLessonId)]);
  const unrelated=randomUUID();await client.query("INSERT INTO module_grammar(id,module_id,pattern,example_dialog) VALUES($1,$2,'unrelated','Untouched bank dialogue')",[unrelated,plan.chapters[0].id]);
  await client.query(sql);
  const snapshot=async table=>(await client.query('SELECT to_jsonb(t) AS row FROM '+table+' t ORDER BY to_jsonb(t)::text')).rows.map(r=>r.row);
  const transaction=async fn=>{await client.query('BEGIN');try{const result=await fn(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}};
  const run=extras=>finalizeN5DialogueSupport({transaction,plan,...extras});
  return {client,run,snapshot,unrelated};
}

test('186 finalizer uses real version service, preserves Bab3 versions/history and resolves every final boundary',options,async t=>{
  const f=await fixture(t);const protectedTables=['courses','modules','lessons','lesson_grammar_task_items','dialogue_speakers','dialogue_character_art','dialogue_question_attempts'];
  const before={};for(const table of [...protectedTables,'module_grammar','grammar_dialog_questions'])before[table]=await f.snapshot(table);
  const report=await f.run();assert.equal(report.newQuestions,182);assert.equal(report.preservedQuestions,12);
  for(const table of protectedTables)assert.deepEqual(await f.snapshot(table),before[table],table);
  const after=await f.snapshot('module_grammar'),questions=await f.snapshot('grammar_dialog_questions');
  for(const i of plan.items){
    const g=after.find(g=>g.id===i.grammarId);assert.deepEqual(pick(g,coreFields),i.expectedCore);
    assert.equal(dialogueFingerprint(g),i.dialogueFingerprint);
    const voices=sceneTurnVoices(g.example_dialog.split('\n').map(line=>({speaker:line[0]})),g.dialog_scene,()=>{throw Error('no fallback');});
    assert.ok(voices.every(v=>v.voiceId.startsWith('fixture-voice-')));
    const boundary=await getCurriculumBoundary({grammarId:g.id,lessonId:g.lesson_id},{dbQuery:f.client.query.bind(f.client)});
    const active=questions.filter(q=>q.grammar_id===g.id&&q.state==='active');assert.equal(active.length,2);
    for(const q of active){assert.equal(q.dialogue_fingerprint,dialogueFingerprint(g));assert.equal(q.boundary_fingerprint,boundary.boundaryFingerprint);assert.equal(q.validator_version,CURRICULUM_VALIDATOR_VERSION);}
    if(i.keepQuestions)for(const old of before.grammar_dialog_questions.filter(q=>q.grammar_id===g.id&&q.state==='active'))assert.deepEqual(pick(questions.find(q=>q.id===old.id),questionFields),pick(old,questionFields));
  }
  for(const old of before.grammar_dialog_questions.filter(q=>q.state==='archived'))assert.deepEqual(questions.find(q=>q.id===old.id),old);
  assert.deepEqual(after.find(g=>g.id===f.unrelated),before.module_grammar.find(g=>g.id===f.unrelated));
  const backup=(await f.snapshot('n5_dialogue_backup_186'))[0];assert.equal(backup.manifest_hash,manifestHash(plan));
  assert.equal(backup.before_grammar.length,97);assert.equal(backup.before_questions.length,before.grammar_dialog_questions.length);
  assert.deepEqual(backup.before_questions.slice().sort((a,b)=>a.id.localeCompare(b.id)),before.grammar_dialog_questions.slice().sort((a,b)=>a.id.localeCompare(b.id)));
  await f.client.query("UPDATE module_grammar SET communication_goal='Teacher revision after deployment' WHERE id=$1",[plan.items[7].grammarId]);
  const edited=await f.snapshot('module_grammar');assert.equal((await f.run()).status,'already_finalized');assert.deepEqual(await f.snapshot('module_grammar'),edited);
  await f.client.query("UPDATE n5_dialogue_backup_186 SET report='{\"status\":\"applying\"}'::jsonb");
  await assert.rejects(f.run(),/incomplete_backup/);assert.deepEqual(await f.snapshot('module_grammar'),edited);
});

test('186 rolls all sources, versions and reports back if question writing fails midway',options,async t=>{
  const f=await fixture(t),tables=['module_grammar','grammar_dialog_questions','dialogue_question_attempts','curriculum_boundary_reports'];
  const before={};for(const table of tables)before[table]=await f.snapshot(table);
  let calls=0;await assert.rejects(f.run({saveQuestions:async(...args)=>{if(++calls===10)throw Error('injected question failure');return saveDialogueQuestions(...args);}}),/injected question failure/);
  for(const table of tables)assert.deepEqual(await f.snapshot(table),before[table],table);assert.equal((await f.snapshot('n5_dialogue_backup_186')).length,0);
});

for(const [name,mutate,code] of [
  ['core drift',f=>f.client.query("UPDATE module_grammar SET pattern='changed' WHERE id=$1",[plan.items[0].grammarId]),/core_changed/],
  ['dialogue edit',f=>f.client.query("UPDATE module_grammar SET example_dialog='teacher text' WHERE id=$1",[plan.items[7].grammarId]),/source_changed/],
  ['new active question',f=>f.client.query(`UPDATE grammar_dialog_questions SET state='active' WHERE grammar_id=$1 AND state='archived'`,[plan.items[7].grammarId]),/questions_changed/],
  ['unconfigured character voice',f=>f.client.query("UPDATE dialogue_speakers SET voice_id='' WHERE character_key='claire-bennett'"),/voice_profile_unconfigured/],
  ['missing uploaded expression',f=>f.client.query('DELETE FROM dialogue_character_art'),/expression_not_uploaded/],
  ['unexpected task consumer',f=>f.client.query('INSERT INTO lesson_grammar_task_items(lesson_id,grammar_id) VALUES($1,$2)',[plan.items[0].expectedTaskLessonIds[0],plan.items[7].grammarId]),/task_membership_changed/],
  ['published later companion',f=>f.client.query("UPDATE lessons SET bunpou_flow_published='{}'::jsonb WHERE id=$1",[plan.items[7].sourceLessonId]),/published_companion_requires_review/],
  ['active legacy-bank question outside scope',f=>f.client.query(`INSERT INTO grammar_dialog_questions(grammar_id,source_lesson_id,kind,prompt,options,correct_index,
    explanation,sort_order,question_fingerprint,dialogue_fingerprint,source_kind,state)
    VALUES($1,$2,'transfer','Unreviewed active bank question','["a","b","c"]',0,'Outside review',0,'q','d','manual','active')`,[f.unrelated,plan.items[0].sourceLessonId]),/active_questions_outside_scope/],
])test('186 refuses '+name+' before content mutation',options,async t=>{
  const f=await fixture(t);await mutate(f);const before=await f.snapshot('module_grammar');await assert.rejects(f.run(),code);
  assert.deepEqual(await f.snapshot('module_grammar'),before);assert.equal((await f.snapshot('n5_dialogue_backup_186')).length,0);
});

test('186 refuses active questions in a downstream course whose boundary includes N5',options,async t=>{
  const f=await fixture(t),course=randomUUID(),module=randomUUID(),lesson=randomUUID(),grammar=randomUUID();
  await f.client.query("INSERT INTO courses(id,slug,title,level) VALUES($1,'n4','N4','N4')",[course]);
  await f.client.query('INSERT INTO course_prerequisites(course_id,prerequisite_course_id) VALUES($1,$2)',[course,plan.courseId]);
  await f.client.query("INSERT INTO modules(id,course_id,slug,title,sort_order) VALUES($1,$2,'n4-b1','N4 Bab 1',1)",[module,course]);
  await f.client.query("INSERT INTO lessons(id,module_id,slug,title,type) VALUES($1,$2,'n4-source','N4 source','text')",[lesson,module]);
  await f.client.query("INSERT INTO module_grammar(id,module_id,lesson_id,pattern) VALUES($1,$2,$3,'N4 fixed core')",[grammar,module,lesson]);
  await f.client.query(`INSERT INTO grammar_dialog_questions(grammar_id,source_lesson_id,kind,prompt,options,correct_index,explanation,sort_order,
    question_fingerprint,dialogue_fingerprint,source_kind,state) VALUES($1,$2,'transfer','N4 question','["a","b","c"]',0,'N4 explanation',0,'q','d','manual','active')`,[grammar,lesson]);
  const before=await f.snapshot('module_grammar');await assert.rejects(f.run(),/active_questions_outside_scope/);
  assert.deepEqual(await f.snapshot('module_grammar'),before);assert.equal((await f.snapshot('n5_dialogue_backup_186')).length,0);
});
