import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import exam from '../../final-exam.js';
import {banks} from '../content/final-exams/index.mjs';
const html=fs.readFileSync(new URL('../../welcome.html',import.meta.url),'utf8');
function source(start,end){const i=html.indexOf(start);assert.ok(i>=0);return html.slice(i,html.indexOf(end,i));}
function questions(bank){return bank.rows.map(q=>({questionId:q.id,category:q.question_category,sectionNumber:q.section_number,sectionLabel:q.section_label,sectionInstruction:q.section_instruction,passage:q.passage}));}

test('final module stays after all sections in course transform without rearranging material',()=>{
 const input=[{slug:'b1',section_name:'A'},{slug:'n5-final-exam',section_name:'A'},
   {slug:'b2',section_name:'B'},{slug:'extra',section_name:'Extra'}];
 const ctx=vm.createContext({EzFinalExam:exam,splitJpFromContent:()=>({})});
 vm.runInContext(source('function transformCourseFromApi(', 'const QUIZ_CATEGORY_META'),ctx);
 const result=ctx.transformCourseFromApi({slug:'n5',modules:input});
 assert.deepEqual(Array.from(result.modules,m=>m.id),['b1','b2','extra','n5-final-exam']);
 assert.equal(result.modules.at(-1).sectionName,'Final Exam');
 assert.equal(result.modules.at(-1).num,'04');
 assert.equal(input[1].slug,'n5-final-exam');
 const other=[{id:'renamed',quizSpec:{version:'jlpt-final-n4-v1'}},{id:'new-lesson'}];
 assert.equal(exam.orderModules(other).at(-1).id,'renamed');
});
test('each part contains all its questions and shared passages are rendered once per group',()=>{
 for(const bank of banks){
  const state={questions:questions(bank),answeredByIndex:{},finalFlags:{}};
  for(const category of exam.summary(state).categories){
   const seen=[],passages=[];
   const rendered=exam.questionGroups(category.items,{question:(_q,i)=>{seen.push(i);return `ITEM_${i}`;},passage:p=>{passages.push(p);return 'PASSAGE';},audio:()=>''});
   assert.equal(seen.length,category.items.length);assert.ok(seen.length>1);
   assert.deepEqual(seen,category.items.map(i=>i.index));
   assert.equal(passages.length,new Set(category.items.map(i=>i.q.passage).filter(Boolean)).size);
   assert.equal((rendered.match(/class="exam-question-group"/g)||[]).length,seen.length);
   assert.doesNotMatch(rendered,/is_correct|correct_answer|spokenChoices/);
  }
 }
});
test('progress ignores stray indices and separates unanswered from flagged answers',()=>{
 const q=questions(banks[0]),s={questions:q,answeredByIndex:{0:true,1:true,999:true},finalFlags:{[q[0].questionId]:true,[q[3].questionId]:true}};
 const info=exam.summary(s);assert.equal(info.answered,2);assert.equal(info.missing.length,78);
 assert.equal(info.flagged.length,2);assert.equal(info.categories[0].answered,2);
});
test('incomplete final exam cannot submit through the generic finish action',async()=>{
 let reviewed=0;
 const state={assessmentVersion:'jlpt-final-n5-v1',questions:questions(banks[0]),answeredByIndex:{}};
 const ctx=vm.createContext({quizState:state,window:{EzFinalExam:exam},document:{getElementById:()=>({})},renderQuizQuestion:()=>reviewed++});
 vm.runInContext(source('async function finishQuiz() {','window.retryQuiz ='),ctx);
 await ctx.finishQuiz();assert.equal(reviewed,1);assert.equal(state.finalReview,true);assert.equal(state.submitting,undefined);
});
test('starting another listening section pauses prior playback and cancels a pending fetch',()=>{
 let paused=0;
 const previous={request:3,loading:true,isPlaying:true,audio:{pause:()=>paused++},el:{querySelector:()=>({textContent:'loading'})}};
 const active={audio:{pause:()=>assert.fail('active audio must not pause')}};
 const ctx=vm.createContext({window:{EzFinalExam:exam,__listeningPlayers:{s1:previous,s2:active}},quizState:{assessmentVersion:'jlpt-final-n5-v1'},updateListeningUI:()=>{}});
 vm.runInContext(source('function stopOtherFinalListeningPlayers(', 'window.listeningTogglePlay'),ctx);
 ctx.stopOtherFinalListeningPlayers('s2');assert.equal(paused,1);assert.equal(previous.loading,false);assert.equal(previous.request,4);assert.equal(previous.isPlaying,false);
});
test('listening in a final exam stops at the end until the learner chooses the next audio',()=>{
 const events={},el={dataset:{sectionKey:'s1',tracks:JSON.stringify([{qi:0},{qi:1}])}};
 const ctx=vm.createContext({window:{EzFinalExam:exam,__listeningPlayers:{}},quizState:{assessmentVersion:'jlpt-final-n4-v1'},
  document:{querySelectorAll:()=>[el]},Audio:class{addEventListener(n,f){events[n]=f;}},destroyAllListeningPlayers:()=>{},updateListeningUI:()=>{},loadListeningTrack:()=>{},setTimeout:()=>assert.fail('No automatic advance')});
 vm.runInContext(source('function initListeningPlayers()', 'async function loadListeningTrack'),ctx);
 ctx.initListeningPlayers();events.ended();assert.equal(ctx.window.__listeningPlayers.s1.currentIdx,0);
});
