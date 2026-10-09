import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import EzFinalExam from '../../final-exam.js';
const html=await readFile(new URL('../../welcome.html',import.meta.url),'utf8');

test('level final exams show their own label, count, raw-score rules and delivery mode',()=>{
  const ctx=vm.createContext({EzFinalExam,escapeHtml:x=>x,escapeAttr:x=>x,kanaPlacementMeta:()=>null,COURSE_CONTENT:{}});
  const start=html.indexOf('function renderQuizLandingCard(');
  vm.runInContext(html.slice(start,html.indexOf('function escapeAttr',start)),ctx);
  for(const [level,count,version] of [['n5',80,'v1'],['n4',90,'v1'],['n5',67,'v2'],['n4',85,'v2']]){
    const container={innerHTML:''};
    ctx.renderQuizLandingCard(container,`${level}:final:exam`,`Final Exam ${level.toUpperCase()}`,{
      assessmentVersion:`jlpt-final-${level}-${version}`,questionsPerAttempt:count,poolSize:version==='v2'?count*2:count,
      passingScorePct:70,cooldownHours:12,canAttempt:true,objectives:[],
    });
    const visible=container.innerHTML.replace(/<[^>]*>/g,'');
    assert.match(visible,/Ujian akhir level/);assert.match(visible,/Mulai final exam/);
    assert.match(visible,new RegExp(`${count} soal orisinal`));assert.match(visible,/tiap kategori minimal 50%/);
    assert.match(visible,/tanpa batas waktu otomatis/);assert.match(visible,/audio boleh diulang/);
    assert.doesNotMatch(visible,/Assessment bab|soal acak dari pool/);
    if(version==='v2')assert.match(visible,/Dua paket A\/B bergantian/);
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

test('chapter listening keeps each completed audio selected until replay or manual navigation',async()=>{
  const requests=[], timers=new Map(), controls=new Map();
  let now=0, timerId=0, blobId=0;
  for(const selector of ['.qlp-play','.qlp-current-num','.qlp-prev','.qlp-next','.qlp-jeda']){
    controls.set(selector,{textContent:'',disabled:false});
  }
  const tracks=[0,1,2,3].map(qi=>({qi,questionId:`question-${qi}`}));
  const el={dataset:{sectionKey:'s4',tracks:JSON.stringify(tracks)},
    querySelector:selector=>controls.get(selector)||null,querySelectorAll:()=>[]};
  class Audio {
    constructor(){this.events={};this.paused=true;this.currentTime=0;this.duration=10;this.plays=[];}
    set src(value){this._src=value;this.currentTime=0;}
    get src(){return this._src;}
    getAttribute(name){return name==='src'?this._src:null;}
    removeAttribute(name){if(name==='src')this._src='';}
    addEventListener(name,fn){this.events[name]=fn;}
    play(){this.paused=false;this.plays.push(this.src);this.events.play?.();return Promise.resolve();}
    pause(){this.paused=true;this.events.pause?.();}
    end(){this.currentTime=this.duration;this.paused=true;this.events.ended?.();}
  }
  const ctx=vm.createContext({window:{EzFinalExam,ezApi:async path=>{
    requests.push(path);return {ok:true,blob:async()=>({})};
  }},quizState:{assessmentVersion:'n4-assessment-v1',lessonApiId:'chapter',attemptToken:'attempt'},Audio,
    document:{querySelectorAll:selector=>selector==='.quiz-listening-player'?[el]:[],querySelector:()=>null},
    URL:{createObjectURL:()=>`blob:audio-${++blobId}`,revokeObjectURL:()=>{}},
    localStorage:{getItem:()=>null},
    setTimeout:(fn,delay)=>{timers.set(++timerId,{fn,due:now+delay});return timerId;},
    clearTimeout:id=>timers.delete(id)});
  const start=html.indexOf('function renderListeningPlayer(');
  vm.runInContext(html.slice(start,html.indexOf('function renderQuizPaperItem(',start)),ctx);
  const settle=()=>new Promise(resolve=>setImmediate(resolve));
  const advance=ms=>{
    const target=now+ms;
    for(;;){
      const next=[...timers.entries()].filter(([,timer])=>timer.due<=target).sort((a,b)=>a[1].due-b[1].due)[0];
      if(!next)break;
      timers.delete(next[0]);now=next[1].due;next[1].fn();
    }
    now=target;
  };
  ctx.initListeningPlayers();
  const player=ctx.window.__listeningPlayers.s4, audio=player.audio;
  assert.equal(requests.length,0,'opening the assignment must not request audio');
  ctx.window.listeningTogglePlay('s4');await settle();
  for(let index=0;index<tracks.length;index++){
    assert.equal(player.currentIdx,index);
    assert.match(requests[index],new RegExp(`/quiz/audio/question-${index}\\?attemptToken=attempt$`));
    const source=audio.src, plays=audio.plays.length;
    audio.end();advance(10000);await settle();
    assert.equal(player.currentIdx,index,'finishing audio must keep the same question selected');
    assert.equal(audio.src,source);assert.equal(audio.paused,true);
    assert.equal(audio.plays.length,plays,'time passing must not start another audio');
    assert.equal(requests.length,index+1,'time passing must not fetch the next question');
    assert.equal(controls.get('.qlp-play').textContent,'▶');
    assert.equal(controls.get('.qlp-current-num').textContent,index+1);
    assert.equal(controls.get('.qlp-jeda').textContent,'');
    if(index===0){
      ctx.window.listeningTogglePlay('s4');await settle();
      assert.equal(audio.plays.at(-1),source,'replay must use the same selected audio');
      assert.equal(requests.length,1);audio.end();
    }
    if(index<tracks.length-1){ctx.window.listeningJump('s4',1,true);await settle();}
  }
  assert.equal(controls.get('.qlp-next').disabled,true,'the final track has no next track');
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
