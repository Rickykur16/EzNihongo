import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const welcome=readFileSync(new URL('../../welcome.html',import.meta.url),'utf8');
const admin=readFileSync(new URL('../../admin.html',import.meta.url),'utf8');
const slice=(text,start,end)=>text.slice(text.indexOf(start),text.indexOf(end,text.indexOf(start)));

test('completion still offers continuation and celebration without points',()=>{
  const controls=new Map([['#completion-cont',{}],['#completion-sec',{}]]);
  let overlay,continued=0,secondary=0,confetti=0,removed=0;
  const ctx=vm.createContext({document:{createElement(){overlay={innerHTML:'',querySelector:key=>controls.get(key),remove:()=>removed++};return overlay;},body:{appendChild(){}}},fireConfetti:()=>confetti++});
  vm.runInContext(slice(welcome,'function showCompletion(','// PRONUNCIATION'),ctx);
  ctx.showCompletion({title:'Bab selesai',message:'Lanjutkan belajar.',xp:50,continueLabel:'Lanjut',secondaryLabel:'Tutup',onContinue:()=>continued++,onSecondary:()=>secondary++});
  assert.match(overlay.innerHTML,/Bab selesai/);assert.match(overlay.innerHTML,/Lanjutkan belajar/);
  assert.doesNotMatch(overlay.innerHTML,/XP|completion-xp|\+50/);
  controls.get('#completion-cont').onclick();assert.equal(continued,1);
  controls.get('#completion-sec').onclick();assert.equal(secondary,1);
  assert.equal(confetti,1);assert.equal(removed,2);
});

test('flashcard ratings advance the card without a point award or storage writes',()=>{
  for(const rating of ['easy','medium','hard']){
    let rendered=0;
    const ctx=vm.createContext({window:{},flashState:{idx:2,flipped:true},renderFlashcard:()=>rendered++,addXP:()=>assert.fail('XP must not be awarded'),localStorage:{setItem:()=>assert.fail('No point cache')}});
    vm.runInContext(slice(welcome,'window.rateFlashcard =','window.restartFlashcards ='),ctx);
    ctx.window.rateFlashcard(rating);assert.equal(ctx.flashState.idx,3);assert.equal(ctx.flashState.flipped,false);assert.equal(rendered,1);
  }
});

test('admin learner list keeps lesson/streak columns while hiding historical points',()=>{
  const output={innerHTML:''};
  const ctx=vm.createContext({document:{getElementById:()=>output},STATE:{users:[{full_name:'Siswa',email:'siswa@example.invalid',xp:999,streak_days:3,total_lessons_completed:7,created_at:'2026-10-01'}]},escapeHtml:v=>String(v),Date});
  vm.runInContext(slice(admin,'function renderUsersResult()','window.usersLoadMore'),ctx);
  ctx.renderUsersResult();assert.match(output.innerHTML,/Streak/);assert.match(output.innerHTML,/Lesson selesai/);assert.match(output.innerHTML,/>7<\/td>/);
  assert.doesNotMatch(output.innerHTML,/\bXP\b|>999<\/td>/);
});

test('learning source has no point helpers, daily XP target or point cache writes',()=>{
  assert.doesNotMatch(welcome,/\baddXP\b|\bbonusXP\b|\bDAILY_GOAL_XP\b|\bdailyXP\b|\bshowXPToast\b|completion-xp|xp-toast/);
  assert.doesNotMatch(welcome,/localStorage\.setItem\(['"]ez_stats/);
});
