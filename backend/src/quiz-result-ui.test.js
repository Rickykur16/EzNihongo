import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../../welcome.html', import.meta.url), 'utf8');
const start = html.indexOf('async function finishQuiz() {');
const end = html.indexOf('window.retryQuiz =', start);
assert.ok(start > 0 && end > start);
const answerStart = html.indexOf('function setQuizAnswerPayload(');
const answerEnd = html.indexOf('window.pickQuizAnswer = async', answerStart);
assert.ok(answerStart > 0 && answerEnd > answerStart);
const landingStart = html.indexOf('function renderQuizLandingCard(');
const landingEnd = html.indexOf('function escapeAttr(', landingStart);
assert.ok(landingStart > 0 && landingEnd > landingStart);
function setup() {
  const main = { innerHTML: '' }, effects = { xp:0, confetti:0, progress:0, cache:0, calls:[] };
  const state = { key:'n5:bab1:quiz', attemptToken:'token', correct:2,
    questions:[{questionId:'q1',category:'vocabulary'},{questionId:'q2',category:'vocabulary'}],
    answers:[{questionId:'q1',optionId:'o1'},{questionId:'q2',optionId:'o2'}], correctByIndex:{0:true,1:true} };
  const result = { score:2,total:2,passed:true,passingScorePct:70,completionSaved:true,
    correctByQuestion:{q1:true,q2:true},cooldownHours:0,nextAttemptAt:null };
  const ctx = vm.createContext({ quizState:state, document:{getElementById:()=>main},
    window:{ezApi:async (...args)=>{effects.calls.push(args);return {ok:true,json:async()=>result};}},
    destroyAllListeningPlayers:()=>{},findLesson:()=>({apiId:'lesson'}),invalidateQuizStatus:()=>{},
    console:{warn:()=>{}},localStorage:{getItem:()=>null,setItem:()=>effects.cache++},
    _scheduleCloudPush:()=>{}, getProgress:()=>({}),setProgress:()=>effects.progress++,
    addXP:()=>effects.xp++,fireConfetti:()=>effects.confetti++,renderSidebar:()=>{},
    QUIZ_CAT_ORDER:['vocabulary'],QUIZ_CATEGORY_META:{vocabulary:{label:'Kosakata'}},
    normalizeQuizCategory:()=> 'vocabulary',fmtNextAt:x=>x,
    kanaPlacementMeta:()=>null,escapeHtml:(value)=>value,
  });
  vm.runInContext(html.slice(start,end),ctx);
  return {ctx,main,effects,result,state};
}
for (const failure of ['http500','network','invalid-json','missing-api','invalid-success','zero-total']) {
  test(`quiz ${failure} never declares a pass, writes progress or awards XP`,async()=>{
    const {ctx,main,effects,result,state}=setup();
    if(failure==='http500')ctx.window.ezApi=async()=>({ok:false,json:async()=>({error:'server_error'})});
    if(failure==='network')ctx.window.ezApi=async()=>{throw new Error('offline');};
    if(failure==='invalid-json')ctx.window.ezApi=async()=>({ok:true,json:async()=>{throw new Error('bad JSON');}});
    if(failure==='missing-api')ctx.window.ezApi=null;
    if(failure==='invalid-success')delete result.completionSaved;
    if(failure==='zero-total')result.total=0;
    await ctx.finishQuiz();
    assert.match(main.innerHTML,/Hasil belum terkonfirmasi/);
    assert.doesNotMatch(main.innerHTML,/Siap lanjut belajar|✓ Lulus/);
    assert.equal(effects.xp+effects.confetti+effects.progress+effects.cache,0);
    assert.equal(state.submitting,false);
    assert.equal(state.answers.length,2);
  });
}
test('retry keeps the token/answers and only applies the server-confirmed result once',async()=>{
  const {ctx,main,effects,state}=setup();
  const success=ctx.window.ezApi;
  ctx.window.ezApi=async(...args)=>{effects.calls.push(args);throw new Error('lost response');};
  await ctx.finishQuiz();
  ctx.window.ezApi=success;
  await ctx.finishQuiz();
  await ctx.finishQuiz();
  assert.equal(effects.calls.length,2);
  assert.equal(effects.calls[0][1].body,effects.calls[1][1].body);
  assert.equal(effects.xp,1);
  assert.equal(effects.progress,1);
  assert.equal(effects.confetti,1);
  assert.equal(state.submitted,true);
  assert.match(main.innerHTML,/✓ Lulus/);
});
test('server failure grade overrides optimistic client score and category feedback',async()=>{
  const {ctx,main,effects,result}=setup();
  Object.assign(result,{score:0,passed:false,completionSaved:false,correctByQuestion:{q1:false,q2:false}});
  await ctx.finishQuiz();
  assert.match(main.innerHTML,/Belum lulus/);
  assert.match(main.innerHTML,/0 \/ 2/);
  assert.equal(effects.progress,0);
  assert.equal(effects.confetti,0);
});
test('double click while saving sends only one request',async()=>{
  const {ctx,effects,result}=setup();
  let release;
  ctx.window.ezApi=async()=>{effects.calls.push('request');await new Promise(r=>{release=r;});return {ok:true,json:async()=>result};};
  const first=ctx.finishQuiz();
  await ctx.finishQuiz();
  release();await first;
  assert.equal(effects.calls.length,1);
  assert.equal(effects.progress,1);
});

test('a passed kana placement marks server-confirmed prerequisite lessons complete locally',async()=>{
  const {ctx,result}=setup();
  result.proficiencyCompletions=[
    {moduleSlug:'bab1',lessonSlug:'hiragana-1'},
    {moduleSlug:'bab1',lessonSlug:'hiragana-2'},
  ];
  let saved;
  ctx.getProgress=()=>({n5:{}});
  ctx.setProgress=(progress)=>{saved=progress;};
  await ctx.finishQuiz();
  assert.equal(saved.n5['bab1:quiz'],true);
  assert.equal(saved.n5['bab1:hiragana-1'],true);
  assert.equal(saved.n5['bab1:hiragana-2'],true);
});

test('kana placement shows a 2/4 section as feedback without contradicting a passing total',async()=>{
  const {ctx,main,result,state,effects}=setup();
  ctx.kanaPlacementMeta=()=>({kind:'Hiragana'});
  state.questions=Array.from({length:32},(_,i)=>({questionId:`q${i}`,category:'vocabulary'}));
  state.answers=state.questions.map((question)=>({questionId:question.questionId,optionId:'o1'}));
  result.correctByQuestion=Object.fromEntries(state.questions.map((question,i)=>[question.questionId,i<30]));
  Object.assign(result,{
    score:30,total:32,passed:true,passingScorePct:85,
    sectionResults:[
      {sectionNumber:1,sectionLabel:'Bagian A',score:4,total:4,passed:true},
      {sectionNumber:7,sectionLabel:'Bagian G',score:2,total:4,passed:false},
    ],
  });
  ctx.escapeHtml=(value)=>value;
  await ctx.finishQuiz();
  assert.match(main.innerHTML,/✓ Lulus/);
  assert.match(main.innerHTML,/94%/);
  assert.match(main.innerHTML,/Hasil tes membaca Hiragana/);
  assert.match(main.innerHTML,/Bagian G/);
  assert.match(main.innerHTML,/2 \/ 4/);
  assert.match(main.innerHTML,/1 bagian untuk dilatih lagi/);
  assert.match(main.innerHTML,/Lanjut belajar/);
  assert.doesNotMatch(main.innerHTML,/Belum lulus|Custom|Kosakata|score-circle|trophy/);
  assert.equal(effects.confetti,0);
});

test('a failed assessment offers a return to the test, not a next-lesson action',async()=>{
  const {ctx,main,result}=setup();
  Object.assign(result,{score:1,passed:false,completionSaved:false,correctByQuestion:{q1:true,q2:false}});
  await ctx.finishQuiz();
  assert.match(main.innerHTML,/Perlu latihan lagi/);
  assert.match(main.innerHTML,/Kembali ke tes/);
  assert.match(main.innerHTML,/onclick="window.retryQuiz\(\)"/);
  assert.doesNotMatch(main.innerHTML,/Lanjut belajar/);
});

function renderKanaLanding(passed) {
  const main={innerHTML:''};
  const lesson={id:'assignment-bab-2-katakana'};
  const next={id:'lesson-next'};
  const ctx=vm.createContext({
    COURSE_CONTENT:{n5:{modules:[{id:'bab2',lessons:[lesson,next]}]}},
    visibleLessons:(module)=>module.lessons,
    kanaPlacementMeta:(item)=>item.id===lesson.id ? {kind:'Katakana'} : null,
    escapeHtml:(value)=>value,
    escapeAttr:(value)=>value,
    fmtCooldown:()=> '0 jam',
    fmtNextAt:()=>'',
    window:{},
  });
  vm.runInContext(html.slice(landingStart,landingEnd),ctx);
  ctx.renderQuizLandingCard(main,`n5:bab2:${lesson.id}`,'Assignment Bab 2: Tes Membaca Katakana',{
    lastAttempt:{score:30,totalQuestions:32,passed},
    passingScorePct:85,poolSize:60,questionsPerAttempt:32,
    cooldownHours:0,canAttempt:true,
  });
  return main.innerHTML;
}

test('passed kana landing continues learning and makes retake secondary',()=>{
  const htmlResult=renderKanaLanding(true);
  assert.match(htmlResult,/30 \/ 32/);
  assert.match(htmlResult,/Lulus/);
  assert.match(htmlResult,/Lanjut belajar/);
  assert.match(htmlResult,/Ulangi tes/);
  assert.doesNotMatch(htmlResult,/Mulai Tes Kemampuan|3\/4 benar|Pool soal/);
  assert.equal((htmlResult.match(/Lanjut belajar/g)||[]).length,1);
});

test('kana landing trusts official grading when a high score was still rejected',()=>{
  const htmlResult=renderKanaLanding(false);
  assert.match(htmlResult,/Belum lulus/);
  assert.match(htmlResult,/Mulai Tes Kemampuan/);
  assert.doesNotMatch(htmlResult,/Lanjut belajar|3\/4 benar/);
});

test('kana landing does not infer a pass when server grading is unavailable',()=>{
  const htmlResult=renderKanaLanding(null);
  assert.match(htmlResult,/Status belum tersinkron/);
  assert.match(htmlResult,/Perbarui status/);
  assert.doesNotMatch(htmlResult,/Lanjut belajar|✓ Lulus|Mulai Tes Kemampuan/);
});

test('clearing a typed kana answer makes the assessment incomplete again',()=>{
  const quizState={
    deferFeedback:true,
    questions:[{questionId:'q1'}],
    answers:[],
    answeredByIndex:{},
    selectedByIndex:{},
  };
  let updates=0;
  const ctx=vm.createContext({quizState,window:{},document:{querySelectorAll:()=>[]},updateQuizPaperProgress:()=>updates++});
  vm.runInContext(html.slice(answerStart,answerEnd),ctx);
  ctx.window.setQuizTextAnswer(0,'shi');
  assert.equal(quizState.answers.length,1);
  assert.equal(quizState.answers[0].questionId,'q1');
  assert.equal(quizState.answers[0].textAnswer,'shi');
  assert.equal(quizState.answeredByIndex[0],true);
  ctx.window.setQuizTextAnswer(0,'   ');
  assert.equal(quizState.answers.length,0);
  assert.equal(Object.hasOwn(quizState.answeredByIndex,0),false);
  assert.equal(updates,2);
});
