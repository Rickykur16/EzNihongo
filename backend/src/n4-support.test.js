import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {deriveDrills} from './grammar-drills.js';
import {deriveCompounds} from './kanji-compounds.js';
import {n4KanjiSupportInventory} from '../content/n4-support/kanji-support.mjs';
import {seedN4Support} from '../test-support/n4-support-fixture.js';
import {assertChapterForm,createChapterSnapshot,publicChapterQuestions,gradeChapterAssessment,validateChapterDraft} from './chapter-assessment.js';
import {n4DialogueSelfChecks} from './n4-dialogue-support.js';
import {publicDialogScene,normalizeDialogScene} from './dialogue-scene.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const plan=read('../content/n4-support/support-plan.json');
const sql=fs.readFileSync(new URL('../migrations/187_n4_support.sql',import.meta.url),'utf8');
const vocabulary=read('../content/n4-support/vocabulary-plan.json');
const vocabSql=fs.readFileSync(new URL('../migrations/188_n4_vocabulary_support.sql',import.meta.url),'utf8');
const assessments=read('../content/n4-support/assessment-plan.json');
const assessmentSql=fs.readFileSync(new URL('../migrations/189_n4_assessments.sql',import.meta.url),'utf8');
const dialogues=read('../content/n4-support/dialogue-plan.json');
const dialogueSql=fs.readFileSync(new URL('../migrations/190_n4_dialogues.sql',import.meta.url),'utf8');

test('N4 supports all fixed grammar IDs with meaningful examples and working contextual drills',()=>{
 assert.equal(plan.chapters.length,24);assert.equal(plan.grammar.length,125);assert.equal(plan.tasks.length,125);
 assert.equal(new Set(plan.grammar.map(g=>g.id)).size,125);
 for(const g of plan.grammar){
  assert.equal(g.examples.length,3,g.id);assert.ok(g.notes?.trim(),g.id);
  for(const e of g.examples){assert.ok(e.japanese.includes(e.highlight),g.id);assert.ok(e.indonesian?.trim(),g.id);}
  for(const d of Object.values(g.drills)){assert.equal(new Set(d.options).size,d.options.length,g.id);assert.equal(d.options.filter(x=>x===d.answer).length,1,g.id);}
  const actual=deriveDrills([{id:g.id,pattern:g.expectedCore.pattern,meaning:g.expectedCore.meaning,examples:g.examples,practiceConfig:g.drills}]).get(g.id);
  assert.equal(actual.step1.rule,'curated-context',g.id);assert.equal(actual.step2.rule,'curated-context',g.id);
  assert.equal(actual.step1.options[actual.step1.correctIndex],g.drills.recognition.answer);
  assert.equal(actual.step2.options[actual.step2.correctIndex],g.drills.controlled.answer);
 }
 assert.ok(plan.tasks.every(t=>t.instruction&&!t.instruction.startsWith('Buat satu kalimat dengan pola')));
});

test('N4 kanji practice removes premature keigo and grammar placeholders and supplies full readings',()=>{
 const early=deriveCompounds('帰',[],[],{courseLevel:'N4',moduleSort:3});
 assert.ok(early.some(w=>w.japanese==='帰る'));assert.ok(!early.some(w=>w.japanese==='お帰りになる'));
 const thought=deriveCompounds('思',[],[],{courseLevel:'N4',moduleSort:2});
 assert.deepEqual(thought.map(w=>[w.japanese,w.reading]),[['思う','おもう']]);
 for(const row of n4KanjiSupportInventory){
  assert.ok(row.exampleJapanese&&row.exampleReading&&row.exampleIndonesian,row.japanese);
  assert.doesNotMatch(row.reading+row.exampleReading,/[\p{Script=Han}A-Za-z{}~]/u,row.japanese);
 }
 for(const word of ['試す','着く','通う','映画'])assert.ok(n4KanjiSupportInventory.some(r=>r.japanese===word));
});

async function connect(t){
 const url=new URL(process.env.TEST_DATABASE_URL);
 assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname));assert.match(url.pathname,/test/i);
 assert.equal(url.searchParams.has('host'),false);assert.equal(url.searchParams.has('hostaddr'),false);
 const {default:pg}=await import('pg');const client=new pg.Client({connectionString:url.href});await client.connect();
 const schema='n4_support_'+randomUUID().replaceAll('-','');
 await client.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema};`);
 t.after(async()=>{await client.query(`DROP SCHEMA ${schema} CASCADE`);await client.end();});
 return client;
}
const skip=!process.env.TEST_DATABASE_URL;
test('PostgreSQL: N4 migration preserves Canva core, old student work and teacher edits on replay',{skip},async t=>{
 const db=await connect(t);await seedN4Support(db,plan);
 const core=async()=>({grammar:(await db.query('SELECT id,module_id,lesson_id,pattern,meaning,sort_order,example_dialog,dialog_scene,protected FROM module_grammar ORDER BY id')).rows,
 lessons:(await db.query('SELECT id,module_id,slug,type,sort_order,protected FROM lessons ORDER BY id')).rows,
 tasks:(await db.query('SELECT lesson_id,grammar_id,required_count,sort_order,protected FROM lesson_grammar_task_items ORDER BY lesson_id,grammar_id')).rows,
 attempts:(await db.query('SELECT * FROM grammar_task_attempts ORDER BY id')).rows,quizAttempts:(await db.query('SELECT * FROM quiz_attempts ORDER BY id')).rows,kanji:(await db.query('SELECT * FROM kanji_items')).rows});
 const before=await core();await db.query('BEGIN');await db.query(sql);await db.query('COMMIT');
 assert.deepEqual(await core(),before);assert.equal(Number((await db.query('SELECT count(*) FROM grammar_examples')).rows[0].count),375);
 assert.equal(Number((await db.query('SELECT count(*) FROM module_grammar WHERE notes IS NOT NULL AND practice_config IS NOT NULL')).rows[0].count),125);
 await db.query('UPDATE module_grammar SET notes=$1 WHERE id=$2',['Teacher follow-up',plan.grammar[0].id]);
 await db.query(sql);assert.equal((await db.query('SELECT notes FROM module_grammar WHERE id=$1',[plan.grammar[0].id])).rows[0].notes,'Teacher follow-up');
 assert.equal(Number((await db.query('SELECT count(*) FROM grammar_examples')).rows[0].count),375);
});
test('PostgreSQL: core drift stops the N4 migration before any support write',{skip},async t=>{
 const db=await connect(t);await seedN4Support(db,plan);
 await db.query('UPDATE module_grammar SET pattern=$1 WHERE id=$2',['Teacher changed core',plan.grammar[0].id]);
 await db.query('BEGIN');await assert.rejects(db.query(sql),/core\/support changed/);await db.query('ROLLBACK');
 assert.equal(Number((await db.query('SELECT count(*) FROM grammar_examples')).rows[0].count),0);
 assert.equal((await db.query('SELECT pattern FROM module_grammar WHERE id=$1',[plan.grammar[0].id])).rows[0].pattern,'Teacher changed core');
});

test('PostgreSQL: vocabulary examples preserve all 771 core rows and deck memberships',{skip},async t=>{
 const db=await connect(t);await seedN4Support(db,plan,vocabulary);
 const core=async()=>({v:(await db.query('SELECT id,module_id,lesson_id,japanese,reading,romaji,indonesian,category,sort_order,protected FROM module_vocabulary ORDER BY id')).rows,d:(await db.query('SELECT * FROM lesson_deck_items ORDER BY lesson_id,vocabulary_id')).rows});
 const before=await core();await db.query(vocabSql);assert.deepEqual(await core(),before);
 const count=vocabulary.items.reduce((n,v)=>n+v.examples.length,0);
 assert.equal(Number((await db.query('SELECT count(*) FROM vocabulary_examples')).rows[0].count),count);
 const id=vocabulary.items[0].id;await db.query('UPDATE module_vocabulary SET note=$1 WHERE id=$2',['Teacher note',id]);
 await db.query(vocabSql);assert.equal((await db.query('SELECT note FROM module_vocabulary WHERE id=$1',[id])).rows[0].note,'Teacher note');
 assert.equal(Number((await db.query('SELECT count(*) FROM vocabulary_examples')).rows[0].count),count);
});

test('PostgreSQL: changed vocabulary or an extra deck consumer prevents all example writes',{skip},async t=>{
 const db=await connect(t);await seedN4Support(db,plan,vocabulary);const item=vocabulary.items[0];
 const other=vocabulary.decks.find(d=>!item.deckIds.includes(d.id));
 await db.query('INSERT INTO lesson_deck_items(lesson_id,vocabulary_id,sort_order) VALUES($1,$2,999)',[other.id,item.id]);
 await db.query('BEGIN');await assert.rejects(db.query(vocabSql),/deck membership changed/);await db.query('ROLLBACK');
 assert.equal(Number((await db.query('SELECT count(*) FROM vocabulary_examples')).rows[0].count),0);
 await db.query('DELETE FROM lesson_deck_items WHERE lesson_id=$1 AND vocabulary_id=$2',[other.id,item.id]);
 await db.query('UPDATE module_vocabulary SET reading=$1 WHERE id=$2',['teacher reading',item.id]);
 await db.query('BEGIN');await assert.rejects(db.query(vocabSql),/core\/note changed/);await db.query('ROLLBACK');
 assert.equal(Number((await db.query('SELECT count(*) FROM vocabulary_examples')).rows[0].count),0);
});

test('all 24 N4 banks grade correctly, retain draft answers, and hide keys and listening transcripts',()=>{
 assert.equal(assessments.banks.length,24);assert.equal(new Set(assessments.banks.flatMap(b=>b.rows.map(q=>q.id))).size,576);
 for(const b of assessments.banks){
  assertChapterForm(b.policy,b.rows);const snapshot=createChapterSnapshot(b.policy,b.rows);
  const publicRows=publicChapterQuestions(snapshot);assert.equal(publicRows.length,24);
  assert.doesNotMatch(JSON.stringify(publicRows),/is_correct|audio_script|explanation|assessment_meta/);
  const drafts=b.rows.map(q=>({questionId:q.id,optionId:q.options.find(o=>o.is_correct).id}));
  assert.ok(validateChapterDraft(snapshot,drafts));assert.ok(!validateChapterDraft(snapshot,[drafts[0],drafts[0]]));
  const correct=new Map(b.rows.map(q=>[q.id,{correct:true}]));assert.equal(gradeChapterAssessment(snapshot,correct).passed,true);
  for(const q of b.rows.filter(q=>q.question_category==='listening'))correct.set(q.id,{correct:false});
  const weak=gradeChapterAssessment(snapshot,correct);assert.equal(weak.score,20);assert.equal(weak.passed,false,'high total cannot hide an unlearned listening category');
  const covered=new Set(b.rows.filter(q=>q.grammar_id).map(q=>q.grammar_id));
  assert.ok(plan.grammar.filter(g=>g.chapter===b.chapter).every(g=>covered.has(g.id)));
 }
});

test('47 inline conversations use six existing characters, aligned expressions and non-stale self checks',()=>{
 assert.equal(dialogues.items.length,47);assert.equal(new Set(dialogues.items.map(i=>i.lessonId)).size,47);
 assert.equal(new Set(dialogues.items.flatMap(i=>i.replacement.dialog_scene.participants.map(p=>p.characterKey))).size,6);
 for(const item of dialogues.items){
  const scene=normalizeDialogScene(item.replacement.dialog_scene),turns=item.replacement.example_dialog.split('\n');
  assert.ok(turns.length>=4&&turns.length<=6);assert.equal(turns.length,item.replacement.example_dialog_id.split('\n').length);
  for(const [i,e] of scene.expressions.entries())if(e)assert.equal(turns[i],e.speaker+': '+e.text);
  assert.equal(n4DialogueSelfChecks({id:item.grammarId,...item.replacement}).length,2);
  assert.deepEqual(n4DialogueSelfChecks({id:item.grammarId,...item.replacement,example_dialog:'Teacher revision'}),[]);
 }
});

async function seedAdditional(db){
 for(const b of assessments.banks){await db.query('UPDATE modules SET quiz_spec=$1 WHERE id=$2',[JSON.stringify(b.expectedQuizSpec),b.moduleId]);await db.query('UPDATE lessons SET content=$1 WHERE id=$2',[b.expectedContent,b.lessonId]);}
 await db.query(`ALTER TABLE module_grammar ADD COLUMN example_dialog_id text,ADD COLUMN communication_goal text,ADD COLUMN dialog_furigana jsonb;
 CREATE TABLE grammar_dialog_questions(id uuid,grammar_id uuid);
 CREATE TABLE dialogue_speakers(character_key text PRIMARY KEY,voice_id text,voice_name text,profile_version int);
 CREATE TABLE dialogue_character_art(character_key text,expression_key text);`);
 const chars=new Set(dialogues.items.flatMap(i=>i.replacement.dialog_scene.participants.map(p=>p.characterKey)));
 for(const key of chars){await db.query('INSERT INTO dialogue_speakers VALUES($1,$2,$3,2)',[key,'configured-'+key,'Current voice']);for(const expression of ['senang','berpikir','bingung','kaget'])await db.query('INSERT INTO dialogue_character_art VALUES($1,$2)',[key,expression]);}
 for(const i of dialogues.items)await db.query('UPDATE module_grammar SET example_dialog=$1,example_dialog_id=$2,communication_goal=$3,dialog_scene=$4,dialog_furigana=$5 WHERE id=$6',[i.expectedDialogue.example_dialog,i.expectedDialogue.example_dialog_id,i.expectedDialogue.communication_goal,i.expectedDialogue.dialog_scene,i.expectedDialogue.dialog_furigana,i.grammarId]);
}

test('PostgreSQL: complete N4 rollout preserves curriculum identities and student history, resolves configured voices, and replays safely',{skip},async t=>{
 const db=await connect(t);await seedN4Support(db,plan,vocabulary);await seedAdditional(db);
 const core=async()=>({g:(await db.query('SELECT id,module_id,lesson_id,pattern,meaning,sort_order,protected FROM module_grammar ORDER BY id')).rows,
  v:(await db.query('SELECT id,module_id,lesson_id,japanese,reading,romaji,indonesian,category,sort_order FROM module_vocabulary ORDER BY id')).rows,
  l:(await db.query('SELECT id,module_id,slug,type,sort_order FROM lessons ORDER BY id')).rows,
  t:(await db.query('SELECT * FROM grammar_task_attempts ORDER BY id')).rows,q:(await db.query('SELECT * FROM quiz_attempts ORDER BY id')).rows});
 const before=await core();for(const migration of [sql,vocabSql,assessmentSql,dialogueSql])await db.query(migration);
 assert.deepEqual(await core(),before);
 const quiz=(await db.query('SELECT q.*,(SELECT jsonb_agg(to_jsonb(o) ORDER BY sort_order) FROM quiz_options o WHERE o.question_id=q.id) options FROM quiz_questions q')).rows;
 for(const b of assessments.banks)assertChapterForm(b.policy,quiz.filter(q=>q.lesson_id===b.lessonId));
 const g=(await db.query('SELECT * FROM module_grammar WHERE id=$1',[dialogues.items[0].grammarId])).rows[0];
 assert.ok(g.dialog_scene.participants.every(p=>p.voiceId==='configured-'+p.characterKey&&p.profileVersion===2));
 assert.doesNotMatch(JSON.stringify(publicDialogScene(g.dialog_scene)),/voiceId|voiceName/);
 await db.query('UPDATE module_grammar SET example_dialog=$1 WHERE id=$2',['Teacher conversation',g.id]);
 await db.query('UPDATE quiz_questions SET explanation=$1 WHERE id=$2',['Teacher explanation',quiz[0].id]);
 for(const migration of [sql,vocabSql,assessmentSql,dialogueSql])await db.query(migration);
 assert.equal((await db.query('SELECT example_dialog FROM module_grammar WHERE id=$1',[g.id])).rows[0].example_dialog,'Teacher conversation');
 assert.equal((await db.query('SELECT explanation FROM quiz_questions WHERE id=$1',[quiz[0].id])).rows[0].explanation,'Teacher explanation');
 assert.equal(Number((await db.query('SELECT count(*) FROM quiz_questions')).rows[0].count),576);
});

test('PostgreSQL: new teacher content blocks assignment or dialogue replacement atomically',{skip},async t=>{
 const db=await connect(t);await seedN4Support(db,plan);await seedAdditional(db);
 await db.query('INSERT INTO quiz_questions(id,lesson_id,question) VALUES($1,$2,$3)',[randomUUID(),assessments.banks[0].lessonId,'Teacher question']);
 await db.query('BEGIN');await assert.rejects(db.query(assessmentSql),/no longer empty/);await db.query('ROLLBACK');
 assert.equal(Number((await db.query('SELECT count(*) FROM quiz_questions')).rows[0].count),1);
 const id=dialogues.items[0].grammarId;await db.query('UPDATE module_grammar SET example_dialog=$1 WHERE id=$2',['Teacher dialogue',id]);
 await db.query('BEGIN');await assert.rejects(db.query(dialogueSql),/dialogue\/core changed/);await db.query('ROLLBACK');
 assert.equal((await db.query('SELECT example_dialog FROM module_grammar WHERE id=$1',[id])).rows[0].example_dialog,'Teacher dialogue');
});
