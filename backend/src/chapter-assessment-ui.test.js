import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../../welcome.html',import.meta.url),'utf8');

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
