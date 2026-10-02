import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../../welcome.html',import.meta.url),'utf8');

test('level final exams show their own label, count, raw-score rules and delivery mode',()=>{
  const ctx=vm.createContext({escapeHtml:x=>x,escapeAttr:x=>x,kanaPlacementMeta:()=>null,COURSE_CONTENT:{}});
  const start=html.indexOf('function renderQuizLandingCard(');
  vm.runInContext(html.slice(start,html.indexOf('function escapeAttr',start)),ctx);
  for(const [level,count] of [['n5',80],['n4',90]]){
    const container={innerHTML:''};
    ctx.renderQuizLandingCard(container,`${level}:final:exam`,`Final Exam ${level.toUpperCase()}`,{
      assessmentVersion:`jlpt-final-${level}-v1`,questionsPerAttempt:count,poolSize:count,
      passingScorePct:70,cooldownHours:12,canAttempt:true,objectives:[],
    });
    const visible=container.innerHTML.replace(/<[^>]*>/g,'');
    assert.match(visible,/Ujian akhir level/);assert.match(visible,/Mulai final exam/);
    assert.match(visible,new RegExp(`${count} soal orisinal`));assert.match(visible,/tiap kategori minimal 50%/);
    assert.match(visible,/tanpa batas waktu otomatis/);assert.match(visible,/audio boleh diulang/);
    assert.doesNotMatch(visible,/Assessment bab|soal acak dari pool/);
  }
});

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

test('pending older bank shows normal preview and one start action using the active bank internally',()=>{
  let started;
  const ctx=vm.createContext({escapeHtml:x=>x,escapeAttr:x=>x,kanaPlacementMeta:()=>null,COURSE_CONTENT:{},
    window:{startQuizAttempt:(...args)=>{started=args;}}});
  const start=html.indexOf('function renderQuizLandingCard(');
  vm.runInContext(html.slice(start,html.indexOf('function escapeAttr',start)),ctx);
  const container={innerHTML:''};
  const status={questionsPerAttempt:50,poolSize:24,canAttempt:true,inProgress:true,resumingLegacy:true,
    passingScorePct:75,cooldownHours:0,inProgressAttemptToken:'old-token',
    assessmentUpdate:{version:'n5-assessment-v4',questionsPerAttempt:24,assessmentRules:{passingScorePct:70},objectives:[{canDo:'Tujuan aktif'}]}};
  ctx.renderQuizLandingCard(container,'n5:b4:assignment','Assignment Bab 4',status);
  const visible=container.innerHTML.replace(/<[^>]*>/g,'');
  assert.doesNotMatch(visible,/versi|sesi lama|50 soal|75%/i);
  assert.match(visible,/24 soal/);assert.match(visible,/70%/);assert.match(visible,/Tujuan aktif/);
  assert.match(visible,/Mulai assessment/);assert.doesNotMatch(visible,/Lanjutkan jawaban/);
  assert.equal((container.innerHTML.match(/onclick="window.startQuizAttempt/g)||[]).length,1);
  assert.equal(started,undefined,'preview must not start or archive any attempt');
  assert.equal(status.questionsPerAttempt,50,'cached status remains intact');
  const handler=container.innerHTML.match(/onclick="(window.startQuizAttempt[^\"]+)"/)[1];
  vm.runInContext(handler,ctx);
  assert.equal(started[0],'n5:b4:assignment');assert.equal(started[1].upgradeFrom,'old-token');assert.equal(started[1].assessmentVersion,'n5-assessment-v4');
  ctx.renderQuizLandingCard(container,'n5:b4:assignment','Assignment Bab 4',{
    ...status,assessmentUpdate:null,resumingLegacy:false,assessmentVersion:'n5-assessment-v4',questionsPerAttempt:24});
  assert.match(container.innerHTML,/Lanjutkan jawaban/);assert.match(container.innerHTML,/resumeOnly:true/);
  assert.doesNotMatch(container.innerHTML,/upgradeFrom/);
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
