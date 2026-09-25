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
    assert.doesNotMatch(main.innerHTML,/Lulus!|ke-unlock/);
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
  assert.match(main.innerHTML,/Lulus!/);
});
test('server failure grade overrides optimistic client score and category feedback',async()=>{
  const {ctx,main,effects,result}=setup();
  Object.assign(result,{score:0,passed:false,completionSaved:false,correctByQuestion:{q1:false,q2:false}});
  await ctx.finishQuiz();
  assert.match(main.innerHTML,/Belum Lulus/);
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
