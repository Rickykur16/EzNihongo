import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {rotationBanks,validateRotationBank} from '../content/final-exams/rotation.mjs';
import {banks} from '../content/final-exams/index.mjs';
import {buildRotationSql} from '../scripts/build-final-exam-rotation.mjs';
import {createChapterSnapshot,publicChapterQuestions,gradeChapterAssessment,validateChapterDraft} from './chapter-assessment.js';
import exam from '../../final-exam.js';

const expected={n5:{vocabulary:21,grammar:17,reading:5,listening:24},n4:{vocabulary:28,grammar:21,reading:8,listening:28}};
for(const bank of rotationBanks) {
 test(`${bank.level}: balanced A/B packages alternate with distinct content and complete passages`,()=>{
  validateRotationBank(bank);
  const a=createChapterSnapshot(bank.policy,bank.rows,null,()=>0), b=createChapterSnapshot(bank.policy,bank.rows,a.form,()=>0);
  assert.equal(a.form,'A');assert.equal(b.form,'B');
  assert.equal(createChapterSnapshot(bank.policy,bank.rows,'B',()=>1).form,'A');
  assert.equal(createChapterSnapshot(bank.policy,bank.rows,null,()=>1).form,'B');
  for(const snapshot of [a,b]) {
   assert.equal(snapshot.questions.length,bank.level==='n5'?67:85);
   for(const [category,n] of Object.entries(expected[bank.level]))assert.equal(snapshot.questions.filter(q=>q.question_category===category).length,n);
   assert.equal(snapshot.policy.questionsPerForm,snapshot.questions.length);
   assert.equal(gradeChapterAssessment(snapshot,new Map(snapshot.questions.map(q=>[q.id,{correct:true}]))).passed,true);
   assert.doesNotMatch(JSON.stringify(publicChapterQuestions(snapshot)),/is_correct|correct_answer|assessment_meta|audio_script|explanation|spokenChoices|ordered|distractorReasons/);
   const state={questions:publicChapterQuestions(snapshot).map(q=>({questionId:q.id,category:q.question_category,sectionNumber:q.section_number,sectionLabel:q.section_label,passage:q.passage})),answeredByIndex:{}};
   for(const part of exam.summary(state).categories) {
    const rendered=exam.questionGroups(part.items,{question:()=>'<question>',passage:()=>'<passage>',audio:()=>''});
    assert.equal((rendered.match(/<question>/g)||[]).length,expected[bank.level][part.id]);
    assert.equal((rendered.match(/<passage>/g)||[]).length,new Set(part.items.map(x=>x.q.passage).filter(Boolean)).size);
   }
  }
  const signature=q=>JSON.stringify([q.question,q.passage,q.audio_script]);
  for(const category of Object.keys(expected[bank.level])) {
   const original=new Set(a.questions.filter(q=>q.question_category===category).map(signature));
   const fresh=b.questions.filter(q=>q.question_category===category&&!original.has(signature(q)));
   assert.ok(fresh.length>= (['reading','listening'].includes(category)?expected[bank.level][category]:3));
  }
  const oldIds=new Set(banks.flatMap(b=>b.rows.flatMap(q=>[q.id,...q.options.map(o=>o.id)])));
  const ids=bank.rows.flatMap(q=>[q.id,...q.options.map(o=>o.id)]);
  assert.equal(new Set(ids).size,ids.length);assert.ok(ids.every(id=>!oldIds.has(id)));
  assert.equal(validateChapterDraft(a,[{questionId:b.questions[0].id,optionId:b.questions[0].options[0].id}]),false);
 });
 test(`${bank.level}: malformed unselected package and same-size wrong composition fail closed`,()=>{
  let broken=structuredClone(bank.rows);broken.find(q=>q.assessment_meta.form==='B').assessment_meta.itemType='usage';
  assert.throws(()=>createChapterSnapshot(bank.policy,broken,null,()=>0),/assessment_bank_invalid/);
  broken=structuredClone(bank.rows);broken.pop();assert.throws(()=>createChapterSnapshot(bank.policy,broken,'B'));
  broken=structuredClone(bank.rows);broken.at(-1).assessment_meta.form='C';assert.throws(()=>createChapterSnapshot(bank.policy,broken));
 });
}
test('v2 UI identifies both levels, preserves old versions, and shows package identity',()=>{
 const html=fs.readFileSync(new URL('../../welcome.html',import.meta.url),'utf8');
 for(const bank of [...banks,...rotationBanks])assert.equal(exam.isFinal(bank.version),true);
 assert.equal(exam.isFinal('n5-assessment-v4'),false);
 assert.match(html,/assessmentForm: data.assessmentForm/);
 const script=fs.readFileSync(new URL('../../final-exam.js',import.meta.url),'utf8');
 for(const bank of rotationBanks) {
  const result=vm.runInNewContext(`const state=${JSON.stringify({assessmentVersion:bank.version,assessmentForm:'B'})};${script.match(/const level =[^\n]+\n\s*const packageLabel =[^\n]+/)[0]}({level,packageLabel})`);
  assert.equal(result.level,bank.level.toUpperCase());assert.equal(result.packageLabel,' · Paket B');
 }
});
test('rotation migration is reproducible and v1 stays unchanged',()=>{
 assert.equal(fs.readFileSync(new URL('../migrations/195_final_exam_rotation.sql',import.meta.url),'utf8').replaceAll('\r\n','\n'),buildRotationSql());
 assert.equal(banks[0].rows.length,80);assert.equal(banks[1].rows.length,90);
});
