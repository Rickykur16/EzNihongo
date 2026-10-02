import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {banks,validateFinalBank} from '../content/final-exams/index.mjs';
import {buildFinalExamSql,sceneSvg} from '../scripts/build-final-exams.mjs';
import {createChapterSnapshot,publicChapterQuestions,gradeChapterAssessment,chapterReview,assertChapterForm,validateChapterDraft,publicChapterRules} from './chapter-assessment.js';

test('170 original final items meet their complete blueprints, unique IDs and single keys',()=>{
 const ids=new Set();
 for(const b of banks){
  const rows=validateFinalBank(b);assertChapterForm(b.policy,rows);
  for(const q of rows){
   for(const id of [q.id,...q.options.map(o=>o.id)]){assert.ok(!ids.has(id));ids.add(id);}
   assert.equal(q.assessment_meta.source,'eznihongo-original');
   assert.equal(q.options.filter(o=>o.is_correct).length,1);
  }
  assert.equal(new Set(rows.map(q=>q.assessment_meta.itemType)).size,b.level==='n5'?14:15);
 }
 assert.equal(banks.flatMap(b=>b.rows).length,170);
 assert.equal(banks.flatMap(b=>b.rows).filter(q=>q.audio_script).length,52);
});
test('final snapshots retain all items, protect keys/transcripts, and keep spoken choices numbered',()=>{
 for(const b of banks){
  const rows=structuredClone(b.rows),s=createChapterSnapshot(b.policy,rows);
  assert.equal(s.questions.length,b.rows.length);assert.equal(publicChapterRules(s.policy).questionsPerForm,b.rows.length);
  const visible=publicChapterQuestions(s);
  assert.doesNotMatch(JSON.stringify(visible),/is_correct|correct_answer|assessment_meta|audio_script|explanation|spokenChoices|ordered|distractorReasons/);
  for(const q of visible.filter(q=>q.preserve_option_order))assert.deepEqual(q.options.map(o=>o.option_text),['1ばん','2ばん','3ばん']);
  rows[0].options[0].option_text='changed';assert.notEqual(s.questions[0].options[0].option_text,'changed');
  const damaged=structuredClone(b.rows);damaged.pop();assert.throws(()=>assertChapterForm(b.policy,damaged));
  const wrongKey=structuredClone(b.rows);wrongKey[0].options.forEach(o=>o.is_correct=false);assert.throws(()=>assertChapterForm(b.policy,wrongKey));
 }
});
test('final grading requires 70% overall and 50% in every category; boundary is inclusive',()=>{
 for(const b of banks){
  const s=createChapterSnapshot(b.policy,b.rows);
  const correct=predicate=>new Map(s.questions.map(q=>[q.id,{correct:predicate(q)}]));
  const perfect=gradeChapterAssessment(s,correct(()=>true));assert.equal(perfect.passed,true);assert.equal(perfect.score,b.rows.length);
  for(const category of ['vocabulary','grammar','reading','listening'])assert.equal(gradeChapterAssessment(s,correct(q=>q.question_category!==category)).passed,false);
  const chosen=new Set();
  for(const cat of ['vocabulary','grammar','reading','listening']){
   const qs=s.questions.filter(q=>q.question_category===cat);qs.slice(0,Math.ceil(qs.length/2)).forEach(q=>chosen.add(q.id));
  }
  for(const q of s.questions){if(chosen.size>=Math.ceil(s.questions.length*.7))break;chosen.add(q.id);}
  assert.equal(gradeChapterAssessment(s,correct(q=>chosen.has(q.id))).passed,true);
  chosen.delete([...chosen].at(-1));assert.equal(gradeChapterAssessment(s,correct(q=>chosen.has(q.id))).passed,false);
  assert.equal(chapterReview(s,[],perfect.correctByQuestion).length,b.rows.length);
 }
});
test('foreign or duplicated answers cannot become final-exam drafts',()=>{
 const s=createChapterSnapshot(banks[0].policy,banks[0].rows),q=s.questions[0];
 const answer={questionId:q.id,optionId:q.options[0].id};
 assert.equal(validateChapterDraft(s,[answer]),true);
 assert.equal(validateChapterDraft(s,[answer,answer]),false);
 assert.equal(validateChapterDraft(s,[{...answer,optionId:banks[1].rows[0].options[0].id}]),false);
});
test('migration and original scene assets match reviewed source',()=>{
 assert.equal(fs.readFileSync(new URL('../migrations/194_jlpt_final_exams.sql',import.meta.url),'utf8').replaceAll('\r\n','\n'),buildFinalExamSql());
 const names=new Set(banks.flatMap(b=>b.rows).filter(q=>q.image_url).map(q=>q.image_url.split('/').at(-1)));
 for(const name of names)assert.equal(fs.readFileSync(new URL('../../assets/final-exams/'+name,import.meta.url),'utf8').replaceAll('\r\n','\n'),sceneSvg(name.replace('.svg','')));
});
