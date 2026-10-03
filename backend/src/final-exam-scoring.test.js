import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {scoredBanks} from '../content/final-exams/scoring.mjs';
import {rotationBanks} from '../content/final-exams/rotation.mjs';
import {createChapterSnapshot,gradeChapterAssessment} from './chapter-assessment.js';
import {gradeJlptEstimate,finalExamRules} from './final-exam-policy.js';
import {buildScoringSql} from '../scripts/build-final-exam-scoring.mjs';
import EzFinalExam from '../../final-exam.js';

for(const bank of scoredBanks) {
 test(`${bank.level}: every possible section total follows the declared rounding and all three pass thresholds`,()=>{
  const s=createChapterSnapshot(bank.policy,bank.rows,null,()=>0),threshold=bank.level==='n5'?80:90;
  const language=s.questions.filter(q=>q.question_category!=='listening'),listening=s.questions.filter(q=>q.question_category==='listening');
  const seen={atTotal:false,belowTotal:false,atLanguage:false,atListening:false};
  for(let l=0;l<=language.length;l++)for(let a=0;a<=listening.length;a++) {
   const correct=Object.fromEntries([...language.slice(0,l),...listening.slice(0,a)].map(q=>[q.id,true]));
   const r=gradeJlptEstimate(s.policy,s.questions,correct);
   const expectedL=Math.floor(l*120/language.length+0.5),expectedA=Math.floor(a*60/listening.length+0.5);
   assert.deepEqual(r.sections.map(x=>x.score),[expectedL,expectedA]);
   assert.equal(r.score,expectedL+expectedA);assert.equal(r.total,180);
   assert.equal(r.passed,expectedL>=38&&expectedA>=19&&r.score>=threshold);
   if(r.score===threshold&&expectedL>=38&&expectedA>=19){assert.equal(r.passed,true);seen.atTotal=true;}
   if(r.score===threshold-1&&expectedL>=38&&expectedA>=19){assert.equal(r.passed,false);seen.belowTotal=true;}
   if(expectedL===38&&r.score>=threshold){assert.equal(r.passed,expectedA>=19);seen.atLanguage=true;}
   if(expectedA===19&&r.score>=threshold){assert.equal(r.passed,expectedL>=38);seen.atListening=true;}
  }
  assert.ok(seen.atTotal&&seen.belowTotal);
  if(bank.level==='n4')assert.ok(seen.atLanguage&&seen.atListening);
 });
 test(`${bank.level}: low raw percentage and a C reading band can pass; strong total cannot compensate for listening`,()=>{
  const s=createChapterSnapshot(bank.policy,bank.rows,'B'),quota={language:bank.level==='n5'?23:30,listening:bank.level==='n5'?9:13};
  const answers=new Map(s.questions.map(q=>{
   const key=q.question_category==='listening'?'listening':'language';return [q.id,{correct:quota[key]-->0}];
  }));
  const grade=gradeChapterAssessment(s,answers);
  assert.equal(grade.passed,true);assert.ok(grade.score/grade.total<.7);assert.equal(grade.sectionResults.length,2);assert.deepEqual(grade.objectiveResults,[]);
  assert.equal(grade.scoreReport.referenceResults.find(r=>r.category==='reading').band,'C');
  assert.equal(grade.scoreReport.referenceResults.find(r=>r.category==='reading').correct,0);
  const lowListening=gradeChapterAssessment(s,new Map(s.questions.map(q=>[q.id,{correct:q.question_category!=='listening'}])));
  assert.equal(lowListening.scoreReport.score,120);assert.equal(lowListening.passed,false);
  const old=rotationBanks.find(b=>b.level===bank.level),oldSnapshot=createChapterSnapshot(old.policy,old.rows,'B');
  const oldGrade=gradeChapterAssessment(oldSnapshot,answers);
  assert.equal(oldGrade.passed,false);assert.equal(oldGrade.scoreReport,undefined);
 });
 test(`${bank.level}: landing and review show simulation points without old percentage requirements`,()=>{
  const html=fs.readFileSync(new URL('../../welcome.html',import.meta.url),'utf8'),start=html.indexOf('function renderQuizLandingCard(');
  const ctx=vm.createContext({EzFinalExam,window:{EzFinalExam},escapeHtml:x=>x,escapeAttr:x=>x,kanaPlacementMeta:()=>null,COURSE_CONTENT:{}});
  vm.runInContext(html.slice(start,html.indexOf('function escapeAttr',start)),ctx);
  const snapshot=createChapterSnapshot(bank.policy,bank.rows,'B'),report=gradeChapterAssessment(snapshot,new Map(snapshot.questions.map(q=>[q.id,{correct:true}]))).scoreReport;
  const container={innerHTML:''};
  ctx.renderQuizLandingCard(container,`${bank.level}:final:exam`,bank.title,{assessmentVersion:bank.version,assessmentRules:finalExamRules(bank.policy),
   questionsPerAttempt:bank.policy.questionsPerForm,poolSize:bank.rows.length,passingScorePct:bank.policy.passingScorePct,cooldownHours:12,canAttempt:true,
   lastAttempt:{score:67,totalQuestions:67,scoreReport:report,passed:true,assessmentVersion:bank.version},objectives:[]});
  assert.match(container.innerHTML,new RegExp(`${bank.policy.passingScore}/180`));assert.match(container.innerHTML,/38\/120/);assert.match(container.innerHTML,/19\/60/);
  assert.match(container.innerHTML,/180 \/ 180/);assert.match(container.innerHTML,/Skor simulasi JLPT/);
  assert.doesNotMatch(container.innerHTML,/70%|50%|\(100%\)/);
  const result=EzFinalExam.renderScoreReport(report);assert.match(result,/minimum 38/);assert.match(result,/minimum 19/);assert.match(result,/bukan skor resmi/);
 });
}
test('reference A/B/C bands use unrounded raw proportions and never change the pass rule',()=>{
 const policy=scoredBanks[0].policy;
 const qs=['vocabulary','grammar','reading','listening'].flatMap(category=>Array.from({length:100},(_,i)=>({id:category+i,question_category:category})));
 for(const [n,band] of [[33,'C'],[34,'B'],[66,'B'],[67,'A']]) {
  const correct=Object.fromEntries(qs.filter(q=>Number(q.id.replace(/\D/g,''))<n).map(q=>[q.id,true]));
  assert.ok(gradeJlptEstimate(policy,qs,correct).referenceResults.every(r=>r.band===band));
 }
});
test('scoring migration is reproducible and rejects unsupported score policies',()=>{
 assert.equal(fs.readFileSync(new URL('../migrations/196_final_exam_jlpt_scoring.sql',import.meta.url),'utf8').replaceAll('\r\n','\n'),buildScoringSql());
 assert.throws(()=>finalExamRules({...scoredBanks[0].policy,scoringVersion:'unsupported'}),/assessment_bank_invalid/);
});
