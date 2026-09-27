import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../../welcome.html',import.meta.url),'utf8');

test('opening an assignment always shows its preview, including cached and old pending sessions',async()=>{
  for(const cached of [true,false])for(const update of [null,{version:'n5-assessment-v3',questionsPerAttempt:24}]){
    const status={inProgress:true,inProgressAttemptToken:'saved-token',assessmentUpdate:update};
    let shown;
    const ctx=vm.createContext({window:{startQuizAttempt:()=>{throw Error('must not auto-start');}},
      quizState:{key:'n5:b4:assignment',submitted:false},getQuizKey:(...s)=>s.join(':'),
      findLesson:()=>({apiId:'lesson',title:'Assignment'}),QUIZ_STATUS_TTL:60000,
      _quizStatusCache:new Map(cached?[['lesson',{ts:Date.now(),data:status}]]:[]),
      fetchQuizStatus:async()=>status,escapeHtml:x=>x,kanaPlacementMeta:()=>null,
      renderQuizLandingCard:(_container,_key,_title,s)=>{shown=s;}});
    ctx.window.__requiredAssignment={key:'n5:b4:assignment'};
    const start=html.indexOf('async function renderQuizLesson(');
    vm.runInContext(html.slice(start,html.indexOf('function fmtCooldown',start)),ctx);
    await ctx.renderQuizLesson({innerHTML:''},'n5','b4','assignment');
    assert.equal(shown,status);
  }
});

test('old-version preview offers an explicit upgrade or resume with the expected token',()=>{
  const ctx=vm.createContext({escapeHtml:x=>x,escapeAttr:x=>x});
  const start=html.indexOf('function renderQuizLandingCard(');
  vm.runInContext(html.slice(start,html.indexOf('function escapeAttr',start)),ctx);
  const container={innerHTML:''};
  ctx.renderQuizLandingCard(container,'n5:b4:assignment','Assignment Bab 4',{
    questionsPerAttempt:50,inProgressAttemptToken:'old-token',
    assessmentUpdate:{version:'n5-assessment-v3',questionsPerAttempt:24}});
  assert.match(container.innerHTML,/50 soal/);assert.match(container.innerHTML,/24 soal/);
  assert.match(container.innerHTML,/Mulai versi terbaru/);assert.match(container.innerHTML,/Lanjutkan sesi lama/);
  assert.match(container.innerHTML,/upgradeFrom:'old-token'/);assert.match(container.innerHTML,/resumeOnly:true/);
});

test('spoken-choice numbers retain audio order while ordinary options can shuffle',()=>{
  const ctx=vm.createContext({normalizeQuizCategory:x=>x,Math:{random:()=>0,floor:Math.floor}});
  const start=html.indexOf('function transformQuestionFromApi(');
  vm.runInContext(html.slice(start,html.indexOf('async function hydrateEnrolledCourses',start)),ctx);
  const options=[1,2,3].map(n=>({id:String(n),option_text:`${n}ばん`,sort_order:n}));
  const fixed=ctx.transformQuestionFromApi({options:[...options].reverse(),preserve_option_order:true,image_url:'/assets/assessments/b4.svg'});
  assert.deepEqual(Array.from(fixed.options),['1ばん','2ばん','3ばん']);
  assert.deepEqual(Array.from(fixed.optionIds),['1','2','3']);
  assert.equal(fixed.imageUrl,'/assets/assessments/b4.svg');
  assert.notDeepEqual(Array.from(ctx.transformQuestionFromApi({options}).optionIds),['1','2','3']);
});

test('the listening player advances through all four dialogues without skipping the third',()=>{
  const events={}, jumps=[];
  const el={dataset:{sectionKey:'s4',tracks:JSON.stringify([{qi:0},{qi:1},{qi:2},{qi:3}])},querySelector:()=>({textContent:''})};
  class Audio { addEventListener(name,fn){events[name]=fn;} }
  const ctx=vm.createContext({window:{__listeningPlayers:{}},document:{querySelectorAll:()=>[el]},Audio,
    destroyAllListeningPlayers:()=>{},updateListeningUI:()=>{},loadListeningTrack:()=>{},
    clearTimeout:()=>{},setTimeout:fn=>{fn();return 1;}});
  ctx.window.listeningJump=(key,index,relative)=>{
    const s=ctx.window.__listeningPlayers[key];s.currentIdx=relative?s.currentIdx+index:index;jumps.push(s.currentIdx);
  };
  const start=html.indexOf('function initListeningPlayers()');
  vm.runInContext(html.slice(start,html.indexOf('async function loadListeningTrack',start)),ctx);
  ctx.initListeningPlayers();
  events.ended();events.ended();events.ended();events.ended();
  assert.deepEqual(jumps,[1,2,3]);
});

test('a stale start response cannot replace a lesson opened while it was loading',async()=>{
  const main={innerHTML:''};let release;
  const ctx=vm.createContext({window:{ezApi:()=>new Promise(resolve=>{release=resolve;})},
    findLesson:()=>({apiId:'lesson'}),document:{getElementById:()=>main},invalidateQuizStatus:()=>{}});
  const start=html.indexOf('window.startQuizAttempt =');
  vm.runInContext(html.slice(start,html.indexOf('function firstQuizCategoryWithQuestions',start)),ctx);
  const pending=ctx.window.startQuizAttempt('n5:bab3:assignment');
  ctx.window.__quizNavigationEpoch++;
  main.innerHTML='Other lesson';release({ok:true,json:()=>{throw new Error('must not read stale payload');}});
  await pending;assert.equal(main.innerHTML,'Other lesson');
});
