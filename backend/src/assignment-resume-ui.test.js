import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = (await readFile(new URL('../../welcome.html', import.meta.url), 'utf8')).replaceAll('\r\n','\n');
function source(from, to) {
  const start = html.indexOf(from), end = html.indexOf(to, start);
  assert.ok(start > 0 && end > start, `Source slice ${from}`);
  return html.slice(start, end);
}
const helpers = source('window.__requiredAssignment = null;', '// Async — fetch quiz-status');
const renderer = source('async function renderQuizLesson(', 'function fmtCooldown(');
const starter = source('window.startQuizAttempt =', 'function quizQuestionsByCategory(');
const draftFlow = source('function setQuizAnswerPayload(', 'window.pickQuizAnswer = async');
const transform = source('function transformQuestionFromApi(', 'async function hydrateEnrolledCourses(');
const plain = value => JSON.parse(JSON.stringify(value));
const answer = (questionId = 'q1', optionId = 'q1-a') => ({ questionId, optionId });

function setup() {
  const storage = new Map(), timers = new Map(), effects = { starts:[], landings:[], renders:0, drafts:0, toasts:[], invalidated:[], cacheCleared:0 };
  const main = { innerHTML:'', textContent:'', appendChild:()=>{} };
  let timerId = 0;
  const ctx = vm.createContext({
    quizState:null, session:{id:'learner-a'}, QUIZ_DATA:{},
    window:{ ezApi:async()=>{throw new Error('Unexpected request');}, ezClearUnfinishedAssignmentCache:()=>effects.cacheCleared++, scrollTo:()=>{} },
    localStorage:{getItem:key=>storage.get(key) ?? null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
    document:{getElementById:()=>main,querySelectorAll:()=>[],createElement:()=>({})},
    setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),
    showToast:message=>effects.toasts.push(message),
    findLesson:()=>({apiId:'lesson-api',title:'Bab 3'}),
    invalidateQuizStatus:id=>{ctx._quizStatusCache.delete(id);effects.invalidated.push(id);},
    _quizStatusCache:new Map(), QUIZ_STATUS_TTL:15000,
    fetchQuizStatus:async()=>({inProgress:false}),
    renderQuizLandingCard:(...args)=>effects.landings.push(args),
    renderQuizQuestion:()=>effects.renders++,updateQuizPaperProgress:()=>{},
    _sectionOfModule:()=> 'Lainnya', _expandedSections:new Set(), _expandedModules:new Set(),
    renderSidebar:()=>{}, renderLesson:()=>{}, closeSidebar:()=>{},
    getEnrolledCourses:()=>['n5','n4'], renderCourseTabs:()=>{}, renderLearning:()=>{},
    history:{replaceState:()=>{}},
    QUIZ_CAT_ORDER:['vocabulary','grammar','reading','listening'],
    normalizeQuizCategory:category=>category || 'vocabulary',
    kanaPlacementMeta:()=>null,escapeHtml:value=>String(value),console,
  });
  vm.runInContext(helpers + transform + renderer + starter + draftFlow, ctx);
  return {ctx,storage,timers,effects,main};
}

function state(overrides = {}) {
  return {
    key:'n5:bab3:assignment',attemptToken:'attempt-1',lessonApiId:'lesson-api',draftRevision:3,
    questions:[
      {questionId:'q1',questionType:'multiple_choice',category:'vocabulary',optionIds:['q1-a','q1-b']},
      {questionId:'q2',questionType:'multiple_choice',category:'grammar',optionIds:['q2-a','q2-b']},
    ], answers:[answer()], ...overrides,
  };
}

test('all inline welcome scripts compile, including pendingAssignment boot scope', () => {
  let scripts = 0;
  for (const [,attributes,body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/.test(attributes) || !body.trim() || /application\/(?:ld\+)?json/.test(attributes)) continue;
    assert.doesNotThrow(()=>new vm.Script(body, {filename:`welcome-inline-${++scripts}.js`}));
  }
  assert.ok(scripts > 0);
});

for (const cached of [true,false]) test(`${cached?'cached':'fresh'} unfinished status resumes its token without a new-attempt request`, async () => {
  const {ctx,effects,main} = setup();
  const status = {inProgress:true,inProgressAttemptToken:'existing-token'};
  let fetches=0;
  ctx.fetchQuizStatus=async()=>{fetches++;return status;};
  if(cached) ctx._quizStatusCache.set('lesson-api',{ts:Date.now(),data:status});
  ctx.window.startQuizAttempt=async(...args)=>effects.starts.push(args);
  await ctx.renderQuizLesson(main,'n5','bab3','assignment');
  assert.deepEqual(plain(effects.starts),[['n5:bab3:assignment',{resumeOnly:true,attemptToken:'existing-token'}]]);
  assert.equal(fetches,cached?0:1);
  assert.equal(effects.landings.length,0);
});

test('reopening the active assignment reuses its dirty in-memory answers',async()=>{
  const {ctx,effects,main}=setup();
  const active=state({draftDirty:true});ctx.quizState=active;
  ctx.window.setRequiredAssignment(active.key,active.attemptToken);
  ctx.fetchQuizStatus=async()=>{throw new Error('Must not replace active state');};
  await ctx.renderQuizLesson(main,'n5','bab3','assignment');
  assert.equal(ctx.quizState,active);assert.equal(effects.renders,1);
});

test('a completed-in-another-tab resume race returns to status without starting a replacement attempt',async()=>{
  const {ctx,effects,main}=setup();const calls=[];
  ctx.window.setRequiredAssignment('n5:bab3:assignment','old-token');
  ctx.window.ezApi=async(path,options)=>{calls.push({path,...options});return {ok:false,status:409,json:async()=>({error:'attempt_not_pending'})};};
  ctx.fetchQuizStatus=async()=>({inProgress:false,canAttempt:true});
  await ctx.window.startQuizAttempt('n5:bab3:assignment',{resumeOnly:true,attemptToken:'old-token'});
  assert.equal(calls.length,1);
  assert.deepEqual(JSON.parse(calls[0].body),{resumeOnly:true,attemptToken:'old-token'});
  assert.equal(ctx.window.__requiredAssignment,null);
  assert.equal(effects.landings.length,1);assert.equal(effects.cacheCleared,1);
  assert.equal(ctx.quizState,null);assert.doesNotMatch(main.innerHTML,/Network error/);
});

test('resume hydrates saved choices by option ID and opens the first unanswered category',async()=>{
  const {ctx,effects}=setup();
  const questions=state().questions.map(q=>({id:q.questionId,question:'Prompt',question_type:q.questionType,question_category:q.category,
    options:q.optionIds.map((id,i)=>({id,option_text:id,sort_order:i+1}))}));
  ctx.window.ezApi=async()=>({ok:true,json:async()=>({resumed:true,attemptToken:'attempt-1',questions,draftEnabled:true,draftRevision:3,draftAnswers:[answer()]})});
  await ctx.window.startQuizAttempt('n5:bab3:assignment',{resumeOnly:true,attemptToken:'attempt-1'});
  assert.deepEqual(plain(ctx.quizState.answers),[answer()]);
  assert.equal(ctx.quizState.activeCategory,'grammar');
  assert.equal(ctx.quizState.questions[0].optionIds[ctx.quizState.selectedByIndex[0]],'q1-a');
  assert.equal(ctx.quizState.draftEnabled,true);assert.equal(ctx.quizState.deferFeedback,true);
  assert.equal(ctx.window.__requiredAssignment,null);assert.equal(effects.renders,1);
});

test('same-revision local last edit is recovered and marked dirty for server save',()=>{
  const {ctx}=setup();const original=state({answers:[answer('q1','q1-b')]});
  ctx.storeQuizLocalDraft(original);
  const resumed=state();const recovered=ctx.recoverQuizLocalDraft(resumed,[answer()]);
  assert.deepEqual(plain(recovered),[answer('q1','q1-b')]);assert.equal(resumed.draftDirty,true);
});

test('just-committed in-flight request does not discard a newer local edit',()=>{
  const {ctx}=setup();
  ctx.storeQuizLocalDraft(state({answers:[answer('q1','q1-b')],inFlightAnswers:[answer()]}));
  const resumed=state({draftRevision:4});
  assert.deepEqual(plain(ctx.recoverQuizLocalDraft(resumed,[answer()])),[answer('q1','q1-b')]);
  assert.equal(resumed.draftDirty,true);
});

test('a different newer server revision wins over stale local work',()=>{
  const {ctx}=setup();ctx.storeQuizLocalDraft(state({answers:[answer('q1','q1-b')],inFlightAnswers:[answer()]}));
  const resumed=state({draftRevision:4}),server=[answer('q2','q2-b')];
  assert.equal(ctx.recoverQuizLocalDraft(resumed,server),server);assert.equal(resumed.draftDirty,undefined);
});

test('local drafts are isolated by authenticated account and attempt token',()=>{
  const {ctx}=setup();const original=state({answers:[answer('q1','q1-b')]});ctx.storeQuizLocalDraft(original);
  const ownKey=ctx.quizLocalDraftKey(original);const server=[answer()];
  ctx.session={id:'learner-b'};
  assert.notEqual(ctx.quizLocalDraftKey(original),ownKey);assert.equal(ctx.recoverQuizLocalDraft(state(),server),server);
  ctx.session={id:'learner-a'};
  assert.equal(ctx.recoverQuizLocalDraft(state({attemptToken:'another-attempt'}),server),server);
  assert.deepEqual(plain(ctx.recoverQuizLocalDraft(state(),server)),original.answers);
});

test('malformed, duplicate and foreign local choices never replace authoritative answers',()=>{
  const {ctx,storage}=setup();const server=[answer()];
  for(const answers of [[answer(),answer()],[answer('unknown','q1-a')],[answer('q1','foreign-option')]]) {
    storage.set(ctx.quizLocalDraftKey(state()),JSON.stringify({revision:3,answers}));
    assert.equal(ctx.recoverQuizLocalDraft(state(),server),server);
  }
  storage.set(ctx.quizLocalDraftKey(state()),'{broken');
  assert.equal(ctx.recoverQuizLocalDraft(state(),server),server);
});

test('legacy kana fill_blank answers recover through the same draft path',()=>{
  const {ctx}=setup();const kana=state({questions:[{questionId:'kana',questionType:'fill_blank',optionIds:[]}],answers:[{questionId:'kana',textAnswer:'shi'}]});
  ctx.storeQuizLocalDraft(kana);
  assert.deepEqual(plain(ctx.recoverQuizLocalDraft({...kana,answers:[]},[])),kana.answers);
});

test('draft scheduling writes the local last edit immediately before its delayed network save',()=>{
  const {ctx,storage,timers}=setup();const active=state();ctx.quizState=active;
  ctx.scheduleChapterDraft(active);
  assert.deepEqual(JSON.parse(storage.get(ctx.quizLocalDraftKey(active))).answers,[answer()]);
  assert.equal(timers.size,1);assert.equal(active.draftDirty,true);
});

test('a later edit during an in-flight save is stored and sent with the next revision',async()=>{
  const {ctx,storage}=setup();const active=state({draftDirty:true});ctx.quizState=active;
  const calls=[];let resolveFirst;
  ctx.window.ezApi=async(_path,options)=>{
    calls.push(JSON.parse(options.body));
    if(calls.length===1) await new Promise(resolve=>{resolveFirst=resolve;});
    return {ok:true,json:async()=>({revision:calls.length===1?4:5})};
  };
  const saving=ctx.saveChapterDraft(active);
  active.answers=[answer('q1','q1-b')];ctx.scheduleChapterDraft(active);
  const persisted=JSON.parse(storage.get(ctx.quizLocalDraftKey(active)));
  assert.deepEqual(persisted.answers,[answer('q1','q1-b')]);assert.deepEqual(persisted.inFlightAnswers,[answer()]);
  resolveFirst();await saving;
  assert.deepEqual(calls.map(c=>c.revision),[3,4]);
  assert.deepEqual(calls[1].answers,[answer('q1','q1-b')]);
  assert.equal(active.draftRevision,5);assert.equal(storage.has(ctx.quizLocalDraftKey(active)),false);
});

test('lesson, module-intro and other-course navigation remain available while an assignment is pending',async()=>{
  const {ctx,effects}=setup();
  ctx.currentState={course:'n5',moduleId:'bab3',lessonId:'assignment'};
  let navigationSideEffects=0;ctx.prepareMobileSidebarContentFocus=()=>{navigationSideEffects++;return ()=>{};};
  vm.runInContext(source('window.selectLesson =','const SIDEBAR_KEY'),ctx);
  vm.runInContext(source('window.switchCourse =','// AI SENPAI (Maneki)'),ctx);
  ctx.window.setRequiredAssignment('n5:bab3:assignment','attempt-1');
  ctx.window.selectLesson('bab4','other');ctx.window.selectModuleIntro('bab3');await ctx.window.switchCourse('n4');
  assert.equal(navigationSideEffects,3);assert.equal(effects.toasts.length,0);
  assert.equal(ctx.currentState.lessonId,null);
  assert.equal(ctx.window.blockAssignmentNavigation('n5:bab3:assignment'),false);
  ctx.window.__requiredAssignment=null;
  assert.equal(ctx.window.blockAssignmentNavigation('n4:bab1:other'),false);
});

async function runBoot(pendingAssignment,enrolled=['n5','n4']) {
  const {ctx,effects}=setup();const events=[];
  const location={search:'?course=n4&module=bab4&lesson=other&focusLesson=other-api'};
  Object.assign(ctx,{
    URLSearchParams,params:new URLSearchParams(location.search),
    COURSE_CONTENT:{n5:{modules:[{id:'bab3',lessons:[{id:'assignment',apiId:'lesson-api',type:'quiz'}]}]},n4:{modules:[{id:'bab4',lessons:[{id:'other',apiId:'other-api'}]}]}},
    currentState:{course:null,moduleId:null,lessonId:null},
    syncEnrollmentsFromServer:async()=>{},hydrateEnrolledCourses:async()=>{},syncLearningStateFromServer:async()=>{},
    _pruneProgressToHydratedCourses:()=>{},renderBootError:error=>{throw error;},handleNewEnrollment:async()=>{},
    getEnrolledCourses:()=>enrolled,renderPaywall:()=>events.push(['paywall']),
    renderCourseTabs:slug=>events.push(['tabs',slug]),
    renderLearning:slug=>{ctx.currentState.course=slug;events.push(['learning',slug,ctx.currentState.moduleId,ctx.currentState.lessonId]);},
    selectLesson:(module,lesson)=>events.push(['select',module,lesson]),AISenpai:{init:()=>{}},
    history:{replaceState:(_state,_title,url)=>events.push(['url',url])},
  });
  ctx.window.location=location;ctx.window.ezGetUnfinishedAssignment=async()=>pendingAssignment;
  const body=source('  const params = new URLSearchParams(window.location.search);', '  // ── Lazy / background');
  await vm.runInContext(`(async()=>{${body}})()`,ctx);
  return {ctx,effects,events};
}

test('boot keeps the learner-selected deep link even when unfinished work exists',()=>{
  assert.equal(html.includes('window.ezGetUnfinishedAssignment().then'),false);
  assert.equal(html.includes('window.setRequiredAssignment(getQuizKey(selected'),false);
});

test('boot does not impose a stale or unenrolled recovery target',()=>{
  assert.doesNotMatch(html,/resumePending|pendingAssignment/);
});
