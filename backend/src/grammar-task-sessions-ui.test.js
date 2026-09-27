// Unit tests for the Bunpou Flow pilot's frontend session wiring in
// welcome.html (Paket 1) — same technique as admin-boot.test.js /
// quiz-result-ui.test.js: slice the real <script> source and run it in a vm
// context with a minimal document/ezApi, so the ACTUAL shipped code is under
// test, not a reimplementation of it. gtRenderStep/gtSetMeaningHidden/
// gtMarkStepPassed/gtAdvance are legacy DOM-painting functions this pilot
// does not change; they are replaced with spies AFTER the slice runs (a
// later assignment to a top-level `function` binding is visible to every
// other function in the same script, same as reassigning a global in a
// browser) so what is under test is the NEW orchestration around them:
// which drills get shown, when a step is marked passed and advanced past,
// and exactly what the session endpoints are called with.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../../welcome.html', import.meta.url), 'utf8');
const slice = (start, end) => {
  const from = html.indexOf(start), to = html.indexOf(end, from);
  assert.ok(from > 0 && to > from, `slice not found: ${JSON.stringify(start)}`);
  return html.slice(from, to);
};
const source = [
  slice('function _findLessonByApiId', 'function gtPendingTaskFor'),
  slice('function gtTotalRequired', '// Bangun HTML kartu'),
  slice('function gtCardsHtml', '// ── Step 1 & 2'),
  slice('const GT_OPT_KEYS', 'window.gtPlayExample ='),
].join('\n');
const productionSource = slice('function gtProductionReady()', '// Fallback ketik');

// Values returned from code run in the vm context are objects of a
// DIFFERENT realm — assert.deepEqual's strict prototype check fails on them
// even when every key/value matches (same technique admin-boot.test.js uses
// for its vm.runInContext results). Round-tripping through JSON brings the
// value back into this realm as a plain object before comparing.
const plain = (v) => JSON.parse(JSON.stringify(v ?? null));

function setup() {
  const calls = { renderStep: [], setMeaningHidden: [], markStepPassed: [], advance: [], ezApi: [] };
  let ezApiImpl = async () => { throw new Error('ezApi not stubbed for this test'); };
  const ctx = vm.createContext({
    window: {},
    document: { querySelector: () => null, querySelectorAll: () => [] },
    escapeHtml: (s) => String(s),
    scheduleBunpouAnalysisRefresh: () => {},
    console,
    crypto: { randomUUID: () => 'fixed-request-id' },
    // Real one-liner (welcome.html:9077); pre-declared because the slice
    // below starts after its definition and _gtScope has no logic of its
    // own worth re-slicing separately for.
    _gtScope: () => ctx.document.querySelector('.gt-popup-overlay') || ctx.document,
  });
  ctx.window.ezApi = async (...args) => { calls.ezApi.push(args); return ezApiImpl(...args); };
  vm.runInContext(source, ctx);
  // Spy out legacy DOM painting — see file header.
  ctx.gtRenderStep = (pi, step, drill) => calls.renderStep.push({ pi, step, drill });
  ctx.gtSetMeaningHidden = (pi, hidden) => calls.setMeaningHidden.push({ pi, hidden });
  ctx.gtMarkStepPassed = (pi, step) => calls.markStepPassed.push({ pi, step });
  ctx.gtAdvance = (pi, fromStep) => calls.advance.push({ pi, fromStep });
  return {
    ctx, calls,
    setEzApi: (fn) => { ezApiImpl = fn; },
  };
}

// ── _findLessonByApiId ──────────────────────────────────────────────────
test('_findLessonByApiId finds a lesson across modules by apiId, or returns null', () => {
  const { ctx } = setup();
  const course = { modules: [
    { lessons: [{ apiId: 'a', title: 'A' }] },
    { lessons: [{ apiId: 'b', title: 'B' }, { apiId: 'c', title: 'C' }] },
  ] };
  assert.equal(ctx._findLessonByApiId(course, 'c').title, 'C');
  assert.equal(ctx._findLessonByApiId(course, 'missing'), null);
  assert.equal(ctx._findLessonByApiId(course, null), null);
  assert.equal(ctx._findLessonByApiId(course, undefined), null);
});

// ── _gtApplyDrills: legacy shape must reproduce old behaviour exactly ────
test('_gtApplyDrills with legacy (no answered/passed fields) hides meaning and always advances from step 0', () => {
  const { ctx, calls } = setup();
  ctx.window.__gtData = [{ id: 'g1' }];
  const step1 = { prompt: 'Apa fungsi X?', options: ['a', 'b', 'c'] };
  const step2 = { prompt: 'Lengkapi', options: ['a', 'b'] };
  ctx._gtApplyDrills({ g1: { step1, step2 } });
  // Paket 2 menambah dua slot pemeriksaan di akhir tiap kartu. Tanpa konten
  // pemeriksaan keduanya tetap DIRENDER dengan drill undefined — itulah yang
  // membuat gtRenderStep menyembunyikan section-nya (el.style.display =
  // 'none'), bukan meninggalkan kotak kosong di layar.
  assert.deepEqual(calls.renderStep, [
    { pi: 0, step: 1, drill: step1 },
    { pi: 0, step: 2, drill: step2 },
    { pi: 0, step: 4, drill: undefined },
    { pi: 0, step: 5, drill: undefined },
  ]);
  assert.deepEqual(calls.setMeaningHidden, [{ pi: 0, hidden: true }]);
  assert.deepEqual(calls.markStepPassed, []);
  assert.deepEqual(calls.advance, [{ pi: 0, fromStep: 0 }]);
  assert.deepEqual(plain(ctx.window.__gtAvail), { 0: { 1: true, 2: true, 4: false, 5: false } });
});

test('_gtApplyDrills resume: a passed step1 marks passed and advances from step 1, not step 0', () => {
  const { ctx, calls } = setup();
  ctx.window.__gtData = [{ id: 'g1' }];
  const step1 = { prompt: 'Apa fungsi X?', options: ['a'], answered: true, passed: true, correctIndex: 0 };
  ctx._gtApplyDrills({ g1: { step1, step2: null } });
  assert.deepEqual(calls.markStepPassed, [{ pi: 0, step: 1 }]);
  assert.deepEqual(calls.advance, [{ pi: 0, fromStep: 1 }]);
  // Already answered — the card is a FRESH render (gtCardsHtml never hides
  // the meaning by default), so leaving it alone already shows it; no
  // explicit "reveal" call is needed, only the never-attempted case hides it.
  assert.deepEqual(calls.setMeaningHidden, []);
});

test('_gtApplyDrills resume: answered-but-wrong (mid-attempt) does not mark passed and still starts from step 0', () => {
  const { ctx, calls } = setup();
  ctx.window.__gtData = [{ id: 'g1' }];
  const step1 = { prompt: 'Apa fungsi X?', options: ['a'], answered: true, passed: false, wrongCount: 1 };
  ctx._gtApplyDrills({ g1: { step1, step2: null } });
  assert.deepEqual(calls.markStepPassed, []);
  assert.deepEqual(calls.advance, [{ pi: 0, fromStep: 0 }]);
});

test('_gtApplyDrills resume: BOTH steps already passed marks both passed, not just the first checked', () => {
  const { ctx, calls } = setup();
  ctx.window.__gtData = [{ id: 'g1' }];
  const step1 = { prompt: 'p1', options: ['a'], answered: true, passed: true };
  const step2 = { prompt: 'p2', variant: 'arrange', tokens: ['a'], answered: true, passed: true };
  ctx._gtApplyDrills({ g1: { step1, step2 } });
  assert.deepEqual(calls.markStepPassed, [{ pi: 0, step: 1 }, { pi: 0, step: 2 }]);
  assert.deepEqual(calls.advance, [{ pi: 0, fromStep: 2 }]);
});

test('_gtApplyDrills resume: a passed step2 (step1 unavailable) advances from step 2', () => {
  const { ctx, calls } = setup();
  ctx.window.__gtData = [{ id: 'g1' }];
  const step2 = { prompt: 'Susun', variant: 'arrange', tokens: ['a', 'b'], answered: true, passed: true };
  ctx._gtApplyDrills({ g1: { step1: null, step2 } });
  assert.deepEqual(calls.markStepPassed, [{ pi: 0, step: 2 }]);
  assert.deepEqual(calls.advance, [{ pi: 0, fromStep: 2 }]);
});

// ── gtLoadDrills: pilot branch selection ─────────────────────────────────
test('gtLoadDrills tries session for trusted source even without a companion', async () => {
  const { ctx } = setup();
  const sessionCalls = [];
  ctx.gtLoadDrillsSession = async (lessonId) => sessionCalls.push(lessonId);
  ctx.setEzApi?.();

  ctx.window.__gtSourceLesson = { apiId: 'source-1' };
  await ctx.gtLoadDrills('task-1');
  assert.deepEqual(sessionCalls, ['task-1']);

  ctx.window.__gtSourceLesson = null;
  ctx.window.ezApi = async () => ({ ok: true, json: async () => ({ drills: [] }) });
  ctx.window.__gtLessonId = 'task-2';
  ctx.window.__gtData = [];
  await ctx.gtLoadDrills('task-2');
  assert.deepEqual(sessionCalls, ['task-1']); // unchanged — legacy path taken, not session
});

// ── gtLoadDrillsSession ───────────────────────────────────────────────────
test('gtLoadDrillsSession creates/resumes a session, maps itemIds by grammarId-step, and renders', async () => {
  const { ctx, calls, setEzApi } = setup();
  ctx.window.__gtSourceLesson = { apiId: 'src-1', bunpouFlow: { objective: 'x' } };
  ctx.window.__gtLessonId = 'task-1';
  ctx.window.__gtData = [{ id: 'g1' }];
  setEzApi(async (path, opts) => {
    assert.equal(path, '/grammar-task/sessions');
    assert.deepEqual(JSON.parse(opts.body), { sourceLessonId: 'src-1' });
    return {
      ok: true, json: async () => ({
        sessionId: 'sess-1', flowVersion: 1,
        items: [
          { itemId: 'item-1', grammarId: 'g1', step: 1, prompt: 'p1', options: ['a'] },
          { itemId: 'item-2', grammarId: 'g1', step: 2, prompt: 'p2', variant: 'arrange', tokens: ['a'] },
        ],
      }),
    };
  });
  await ctx.gtLoadDrillsSession('task-1');
  assert.equal(ctx.window.__gtSessionId, 'sess-1');
  assert.deepEqual(plain(ctx.window.__gtItemIds), { 'g1-1': 'item-1', 'g1-2': 'item-2' });
  // 1, 2, dan dua slot pemeriksaan kosong (step 4/5) — lihat catatan di tes
  // _gtApplyDrills di atas.
  assert.equal(calls.renderStep.length, 4);
  assert.deepEqual(calls.renderStep.slice(2).map((c) => [c.step, c.drill]), [[4, undefined], [5, undefined]]);
});

// REGRESI Paket 2. Sebelum perbaikan ini, pemetaan slot berbunyi
// `it.step === 1 ? 'step1' : 'step2'`, sehingga item step 4 lalu step 5
// berturut-turut MENIMPA soal Step 2 pada pola yang sama — Step 2 hilang
// diam-diam dan yang tampil di slot itu justru soal pemeriksaan.
test('gtLoadDrillsSession maps dialog-check items to their own slots instead of clobbering step 2', async () => {
  const { ctx, calls, setEzApi } = setup();
  ctx.window.__gtSourceLesson = { apiId: 'src-1', bunpouFlow: {} };
  ctx.window.__gtLessonId = 'task-1';
  ctx.window.__gtData = [{ id: 'g1' }];
  const step2 = { itemId: 'item-2', grammarId: 'g1', step: 2, prompt: 'p2', options: ['a', 'b'] };
  const check1 = { itemId: 'item-4', grammarId: 'g1', step: 4, prompt: 'Apa isi dialognya?', options: ['a', 'b', 'c'] };
  const check2 = { itemId: 'item-5', grammarId: 'g1', step: 5, prompt: 'Mana yang benar?', options: ['x', 'y', 'z'] };
  setEzApi(async () => ({
    ok: true, json: async () => ({
      sessionId: 'sess-1', flowVersion: 1,
      items: [
        { itemId: 'item-1', grammarId: 'g1', step: 1, prompt: 'p1', options: ['a'] },
        step2, check1, check2,
      ],
    }),
  }));
  await ctx.gtLoadDrillsSession('task-1');
  assert.deepEqual(plain(ctx.window.__gtItemIds), {
    'g1-1': 'item-1', 'g1-2': 'item-2', 'g1-4': 'item-4', 'g1-5': 'item-5',
  });
  const byStep = Object.fromEntries(calls.renderStep.map((c) => [c.step, c.drill]));
  assert.equal(byStep[2].itemId, 'item-2', 'Step 2 tidak boleh tertimpa soal pemeriksaan');
  assert.equal(byStep[4].itemId, 'item-4');
  assert.equal(byStep[5].itemId, 'item-5');
  assert.deepEqual(plain(ctx.window.__gtAvail), { 0: { 1: true, 2: true, 4: true, 5: true } });
  const legacyHtml = ctx.gtCardsHtml([{ id: 'g1', pattern: 'A' }], false);
  assert.match(legacyHtml, /Cek pemahaman dialog/);
  assert.match(legacyHtml, /Coba di kalimat lain/);
});

test('v2 renders internal transfer 5 only at visible Step 4 and restores its state', async () => {
  const { ctx, calls, setEzApi } = setup();
  ctx.window.__gtSourceLesson = { apiId: 'src-1' }; // flag/companion absent
  ctx.window.__gtLessonId = 'task-1';
  ctx.window.__gtData = [{ id: 'g1', requiredCount: 2 }];
  const title = { textContent: '' }, hiddenStep = { style: {},
    classList: { remove() {}, toggle() {} } };
  ctx.document.querySelector = selector => selector === '#gt-step4-0 .gt-step__title'
    ? title : selector === '#gt-step5-0' ? hiddenStep : null;
  const transfer = { itemId: 'item-5', grammarId: 'g1', step: 5,
    prompt: 'Gunakan di mana?', options: ['a', 'b', 'c'],
    wrongCount: 1, answered: true, passed: true, correctIndex: 2 };
  setEzApi(async path => {
    assert.equal(path, '/grammar-task/sessions');
    return { ok: true, json: async () => ({ sessionId: 'sess-2',
      flowVersion: 2, items: [transfer], productions: [] }) };
  });
  await ctx.gtLoadDrills('task-1');
  assert.equal(ctx.window.__gtFlowVersion, 2);
  assert.deepEqual(plain(ctx.window.__gtItemIds), { 'g1-5': 'item-5' });
  assert.equal(calls.renderStep.find(row => row.step === 4).drill.itemId, 'item-5');
  assert.equal(calls.renderStep.find(row => row.step === 5).drill, undefined);
  assert.deepEqual(plain(ctx.window.__gtAvail), { 0: { 1: false, 2: false, 4: true, 5: false } });
  assert.equal(ctx.window.__gtWrong['0-4'], 1);
  assert.equal(ctx.window.__gtDone['0-4'], true);
  assert.equal(title.textContent, 'Gunakan di situasi lain');
  assert.equal(hiddenStep.style.display, 'none');
  assert.equal(ctx.gtTotalRequired([{ requiredCount: 2 }]), 2);
});

test('v2 visible Step 4 uses internal item 5 for answer, hint and reveal', async () => {
  const { ctx, setEzApi, calls } = setup();
  ctx.window.__gtSessionId = 'sess-2';
  ctx.window.__gtFlowVersion = 2;
  ctx.window.__gtData = [{ id: 'g1' }];
  ctx.window.__gtItemIds = { 'g1-5': 'item-5' };
  ctx.window.__gtDrills = { g1: { check1: { hintAvailable: true } } };
  const paths = [];
  setEzApi(async path => {
    paths.push(path);
    if (path.endsWith('/answer')) return { ok: true, status: 200,
      json: async () => ({ passed: false, wrongCount: 1 }) };
    if (path.endsWith('/hint')) return { ok: true, json: async () => ({ hint: 'Petunjuk' }) };
    return { ok: true, json: async () => ({ correctIndex: 1, explanation: 'Penjelasan' }) };
  });
  await ctx.gtSubmitAnswer({ id: 'g1' }, 4, { optionIndex: 0 });
  await ctx.window.gtShowHint(0, 4, { disabled: false });
  await ctx.gtRevealAnswer({ id: 'g1' }, 4);
  assert.deepEqual(paths, ['answer', 'hint', 'reveal'].map(op =>
    `/grammar-task/sessions/sess-2/items/item-5/${op}`));
});

test('flag-off v2 resumes, exact pilot-ineligible 403 falls back, but 500/network do not', async () => {
  const { ctx, setEzApi, calls } = setup();
  ctx.window.__gtSourceLesson = { apiId: 'src-1' };
  ctx.window.__gtLessonId = 'task-1';
  ctx.window.__gtData = [{ id: 'g1' }];
  setEzApi(async path => path === '/grammar-task/sessions'
    ? { ok: true, json: async () => ({ sessionId: 'sess-2', flowVersion: 2,
      contentChanged: true, items: [{ itemId: 'item-5', grammarId: 'g1', step: 5,
        prompt: 'transfer', options: ['a', 'b', 'c'] }] }) }
    : { ok: true, json: async () => ({ drills: [] }) });
  await ctx.gtLoadDrills('task-1');
  assert.equal(ctx.window.__gtSessionId, 'sess-2');
  assert.equal(ctx.window.__gtFlowVersion, 2);
  assert.equal(calls.ezApi.filter(([path]) => path === '/grammar-task/lesson/task-1/drills').length, 0);

  for (const failure of ['pilot', 'access', 'review', 'server', 'network']) {
    const run = setup();
    run.ctx.window.__gtSourceLesson = { apiId: 'src-1' };
    run.ctx.window.__gtLessonId = 'task-1';
    run.ctx.window.__gtData = [];
    run.setEzApi(async path => {
      if (path.endsWith('/drills')) return { ok: true, json: async () => ({ drills: [] }) };
      if (failure === 'network') throw new Error('offline');
      if (failure === 'pilot') return { ok: false, status: 403,
        json: async () => ({ error: 'pilot_not_enabled_for_lesson' }) };
      if (failure === 'access') return { ok: false, status: 403,
        json: async () => ({ error: 'not_enrolled' }) };
      if (failure === 'review') return { ok: false, status: 409,
        json: async () => ({ error: 'companion_needs_review' }) };
      return { ok: false, status: 500 };
    });
    await run.ctx.gtLoadDrills('task-1');
    const legacyCalls = run.calls.ezApi.filter(([path]) => path.endsWith('/drills'));
    assert.equal(legacyCalls.length, failure === 'pilot' ? 1 : 0, failure);
    assert.equal(run.ctx.window.__gtFlowVersion || null, null);
  }
});

test('trusted source blocks production while session resolves or fails; confirmed legacy fallback permits it', async () => {
  const run = setup();
  const { ctx, calls, setEzApi } = run;
  vm.runInContext(productionSource, ctx);
  const result = { hidden: true, className: '', innerHTML: '' };
  ctx.document.querySelector = (selector) => selector === '#gt-result-0-0' ? result : null;
  ctx._gtGetSentence = () => '日本語を勉強します。';
  ctx.gtFeedbackHtml = () => '<p>Dinilai</p>';
  let completionUpdates = 0;
  ctx.gtUpdateComplete = () => { completionUpdates++; };
  ctx.window.__gtSourceLesson = { apiId: 'src-1' }; // no bunpouFlow
  ctx.window.__gtLessonId = 'task-1';
  ctx.window.__gtData = [{ id: 'g1' }];
  ctx.window.__gtState = { passed: {}, total: 1 };
  ctx.window.__gtSessionMode = 'resolving';
  let finishSession;
  setEzApi(async path => path === '/grammar-task/sessions'
    ? new Promise(resolve => { finishSession = resolve; })
    : { ok: true, json: async () => ({ drills: [] }) });
  const pending = ctx.gtLoadDrills('task-1');
  await ctx.gtRunEval(0, 0, {});
  assert.match(result.innerHTML, /Sesi latihan belum siap/);
  assert.equal(calls.ezApi.some(([path]) => path === '/grammar-task/evaluate'), false);
  assert.equal(completionUpdates, 0);
  finishSession({ ok: false, status: 500 });
  await pending;
  assert.equal(ctx.window.__gtSessionMode, 'error');
  await ctx.gtRunEval(0, 0, {});
  assert.equal(calls.ezApi.some(([path]) => path === '/grammar-task/evaluate'), false);
  assert.equal(completionUpdates, 0);

  setEzApi(async path => {
    if (path === '/grammar-task/sessions') return {
      ok: false, status: 403, json: async () => ({ error: 'pilot_not_enabled_for_lesson' }),
    };
    if (path.endsWith('/drills')) return { ok: true, json: async () => ({ drills: [] }) };
    if (path === '/grammar-task/evaluate') return {
      ok: true, status: 200, json: async () => ({ correct: true, usesPattern: true }),
    };
    throw new Error(`unexpected path: ${path}`);
  });
  await ctx.gtLoadDrills('task-1');
  assert.equal(ctx.window.__gtSessionMode, 'legacy');
  await ctx.gtRunEval(0, 0, {});
  assert.equal(calls.ezApi.filter(([path]) => path === '/grammar-task/evaluate').length, 1);
  assert.equal(ctx.window.__gtState.passed['0-0'], true);
  assert.equal(completionUpdates, 1);
});

test('trusted source network error and failed legacy drill fallback never permit production', async () => {
  for (const failure of ['network', 'fallback-drills']) {
    const { ctx, calls, setEzApi } = setup();
    vm.runInContext(productionSource, ctx);
    const result = { hidden: true, className: '', innerHTML: '' };
    ctx.document.querySelector = selector => selector === '#gt-result-0-0' ? result : null;
    ctx._gtGetSentence = () => '日本語を勉強します。';
    ctx.window.__gtSourceLesson = { apiId: 'src-1' };
    ctx.window.__gtLessonId = 'task-1';
    ctx.window.__gtData = [{ id: 'g1' }];
    ctx.window.__gtState = { passed: {}, total: 1 };
    ctx.window.__gtSessionMode = 'resolving';
    setEzApi(async path => {
      if (path === '/grammar-task/sessions') {
        if (failure === 'network') throw new Error('offline');
        return { ok: false, status: 403, json: async () => ({ error: 'pilot_not_enabled_for_lesson' }) };
      }
      return { ok: false, status: 500 };
    });
    await ctx.gtLoadDrills('task-1');
    assert.equal(ctx.window.__gtSessionMode, 'error', failure);
    await ctx.gtRunEval(0, 0, {});
    assert.equal(calls.ezApi.some(([path]) => path === '/grammar-task/evaluate'), false, failure);
    assert.deepEqual(plain(ctx.window.__gtState.passed), {}, failure);
  }
});

test('gtLoadDrillsSession does not apply a resumed session for a lesson the student has since navigated away from', async () => {
  const { ctx, calls, setEzApi } = setup();
  ctx.window.__gtSourceLesson = { apiId: 'src-1', bunpouFlow: {} };
  ctx.window.__gtData = [{ id: 'g1' }];
  ctx.window.__gtLessonId = 'task-2'; // already moved on by the time the response arrives
  ctx.window.__gtSessionId = null;
  setEzApi(async () => ({ ok: true, json: async () => ({ sessionId: 'sess-1', flowVersion: 1, items: [] }) }));
  await ctx.gtLoadDrillsSession('task-1');
  assert.equal(ctx.window.__gtSessionId, null);
  assert.equal(calls.renderStep.length, 0);
});

test('gtLoadDrillsSession failure shows an honest retry state, never gtUnlockAllSteps', async () => {
  const { ctx, calls, setEzApi } = setup();
  const unlockCalls = [];
  ctx.gtUnlockAllSteps = () => unlockCalls.push(1);
  ctx.window.__gtSourceLesson = { apiId: 'src-1', bunpouFlow: {} };
  ctx.window.__gtLessonId = 'task-1';
  ctx.window.__gtData = [{ id: 'g1' }];
  ctx.window.__gtSessionId = null;
  setEzApi(async () => ({ ok: false }));
  await ctx.gtLoadDrillsSession('task-1');
  assert.equal(ctx.window.__gtSessionId, null);
  assert.equal(unlockCalls.length, 0);
});

// ── gtSubmitAnswer ────────────────────────────────────────────────────────
test('gtSubmitAnswer (session mode) posts to the session item endpoint and normalizes the response', async () => {
  const { ctx, setEzApi } = setup();
  ctx.window.__gtSessionId = 'sess-1';
  ctx.window.__gtItemIds = { 'g1-1': 'item-1' };
  setEzApi(async (path, opts) => {
    assert.equal(path, '/grammar-task/sessions/sess-1/items/item-1/answer');
    assert.deepEqual(JSON.parse(opts.body), { optionIndex: 2, requestId: 'fixed-request-id' });
    return { ok: true, status: 200, json: async () => ({ passed: false, wrongCount: 1, revealEligible: false }) };
  });
  const d = await ctx.gtSubmitAnswer({ id: 'g1' }, 1, { optionIndex: 2 });
  assert.deepEqual(plain(d), { passed: false, correctIndex: null, correctOrder: null, japanese: null });
});

test('gtSubmitAnswer (session mode) surfaces an expired session distinctly from other failures', async () => {
  const { ctx, setEzApi } = setup();
  ctx.window.__gtSessionId = 'sess-1';
  ctx.window.__gtItemIds = { 'g1-1': 'item-1' };
  setEzApi(async () => ({ ok: false, status: 410 }));
  assert.deepEqual(plain(await ctx.gtSubmitAnswer({ id: 'g1' }, 1, { optionIndex: 0 })), { expired: true });
});

for (const failure of ['http500', 'network', 'missingItem']) {
  test(`gtSubmitAnswer (session mode) returns null on ${failure}, never a fabricated result`, async () => {
    const { ctx, setEzApi } = setup();
    ctx.window.__gtSessionId = 'sess-1';
    ctx.window.__gtItemIds = failure === 'missingItem' ? {} : { 'g1-1': 'item-1' };
    if (failure === 'http500') setEzApi(async () => ({ ok: false, status: 500 }));
    if (failure === 'network') setEzApi(async () => { throw new Error('offline'); });
    assert.equal(await ctx.gtSubmitAnswer({ id: 'g1' }, 1, { optionIndex: 0 }), null);
  });
}

test('gtSubmitAnswer (legacy mode, no session) posts to the old endpoint unchanged', async () => {
  const { ctx, setEzApi } = setup();
  ctx.window.__gtSessionId = null;
  ctx.window.__gtLessonId = 'task-1';
  setEzApi(async (path, opts) => {
    assert.equal(path, '/grammar-task/drill-answer');
    assert.deepEqual(JSON.parse(opts.body), { lessonId: 'task-1', grammarId: 'g1', step: 2, order: [1, 0] });
    return { ok: true, json: async () => ({ passed: true, correctIndex: 3 }) };
  });
  const d = await ctx.gtSubmitAnswer({ id: 'g1' }, 2, { order: [1, 0] });
  assert.deepEqual(plain(d), { passed: true, correctIndex: 3, correctOrder: null, japanese: null });
});

// ── gtRevealAnswer ────────────────────────────────────────────────────────
test('gtRevealAnswer posts to the reveal endpoint and returns the disclosed fields only', async () => {
  const { ctx, setEzApi } = setup();
  ctx.window.__gtSessionId = 'sess-1';
  ctx.window.__gtItemIds = { 'g1-2': 'item-2' };
  setEzApi(async (path, opts) => {
    assert.equal(path, '/grammar-task/sessions/sess-1/items/item-2/reveal');
    assert.equal(opts.method, 'POST');
    return { ok: true, json: async () => ({ correctOrder: ['a', 'b'], japanese: 'ab', explanation: 'why' }) };
  });
  assert.deepEqual(plain(await ctx.gtRevealAnswer({ id: 'g1' }, 2)), { correctIndex: null, correctOrder: ['a', 'b'], japanese: 'ab' });
});

test('gtRevealAnswer returns null when the server refuses (not yet eligible) rather than throwing', async () => {
  const { ctx, setEzApi } = setup();
  ctx.window.__gtSessionId = 'sess-1';
  ctx.window.__gtItemIds = { 'g1-1': 'item-1' };
  setEzApi(async () => ({ ok: false, status: 403 }));
  assert.equal(await ctx.gtRevealAnswer({ id: 'g1' }, 1), null);
});

// ── window.gtAnswerDrill: end-to-end orchestration (mocked ezApi + DOM) ──
function stubAnswerDom(ctx, { pi, step, optionCount }) {
  const verdict = { innerHTML: '', textContent: '' };
  const buttons = Array.from({ length: optionCount }, () => ({ disabled: false, classList: { add() {} } }));
  ctx.document.querySelector = (sel) => {
    if (sel === `#gt-verdict-${step}-${pi}`) return verdict;
    return null;
  };
  ctx.document.querySelectorAll = (sel) => (sel === `[id^="gt-opt-${step}-${pi}-"]` ? buttons : []);
  return { verdict, buttons };
}

test('v2 visible Step 4 click grades internal transfer 5 without changing production progress', async () => {
  const { ctx, calls, setEzApi } = setup();
  ctx.window.__gtData = [{ id: 'g1', requiredCount: 2 }];
  ctx.window.__gtSessionId = 'sess-2';
  ctx.window.__gtFlowVersion = 2;
  ctx.window.__gtItemIds = { 'g1-5': 'item-5' };
  ctx.window.__gtDrills = { g1: { check1: { prompt: 'transfer', options: ['a', 'b', 'c'] } } };
  stubAnswerDom(ctx, { pi: 0, step: 4, optionCount: 3 });
  setEzApi(async path => {
    assert.equal(path, '/grammar-task/sessions/sess-2/items/item-5/answer');
    return { ok: true, status: 200,
      json: async () => ({ passed: true, correctIndex: 0, wrongCount: 0 }) };
  });
  await ctx.window.gtAnswerDrill(0, 4, 0);
  assert.equal(ctx.window.__gtDone['0-4'], true);
  assert.deepEqual(calls.markStepPassed, [{ pi: 0, step: 4 }]);
  assert.equal(ctx.gtTotalRequired(ctx.window.__gtData), 2);
});

test('gtAnswerDrill (session mode): two wrong answers trigger exactly one explicit reveal call, matching legacy timing', async () => {
  const { ctx, setEzApi } = setup();
  ctx.window.__gtData = [{ id: 'g1' }];
  ctx.window.__gtSessionId = 'sess-1';
  ctx.window.__gtItemIds = { 'g1-1': 'item-1' };
  const { verdict } = stubAnswerDom(ctx, { pi: 0, step: 1, optionCount: 3 });
  const revealCalls = [];
  setEzApi(async (path) => {
    if (path.endsWith('/reveal')) { revealCalls.push(path); return { ok: true, json: async () => ({ correctIndex: 1 }) }; }
    return { ok: true, status: 200, json: async () => ({ passed: false, wrongCount: revealCalls.length ? 2 : 1, revealEligible: true }) };
  });
  await ctx.window.gtAnswerDrill(0, 1, 0);
  assert.equal(revealCalls.length, 0, 'must not reveal on the first wrong answer');
  assert.doesNotMatch(verdict.innerHTML, /ditandai hijau/);
  await ctx.window.gtAnswerDrill(0, 1, 0);
  assert.equal(revealCalls.length, 1, 'reveals exactly once the client-side wrong count reaches the limit');
  assert.match(verdict.innerHTML, /ditandai hijau/);
});

test('gtAnswerDrill (session mode): an expired session offers a fresh start, never scores the click as wrong', async () => {
  const { ctx, setEzApi } = setup();
  ctx.window.__gtData = [{ id: 'g1' }];
  ctx.window.__gtSessionId = 'sess-1';
  ctx.window.__gtItemIds = { 'g1-1': 'item-1' };
  const { verdict, buttons } = stubAnswerDom(ctx, { pi: 0, step: 1, optionCount: 2 });
  setEzApi(async () => ({ ok: false, status: 410 }));
  await ctx.window.gtAnswerDrill(0, 1, 0);
  assert.match(verdict.innerHTML, /kedaluwarsa/);
  assert.ok(buttons.every((b) => b.disabled === false), 're-enables the options rather than leaving them permanently disabled');
  assert.equal((ctx.window.__gtWrong || {})['0-1'], undefined, 'an expired session is not recorded as a wrong answer');
});

test('gtAnswerDrill (legacy mode, no session) is byte-for-byte unchanged: correctIndex from the initial response, no reveal round-trip', async () => {
  const { ctx, setEzApi } = setup();
  ctx.window.__gtData = [{ id: 'g1' }];
  ctx.window.__gtSessionId = null;
  ctx.window.__gtLessonId = 'task-1';
  const { verdict } = stubAnswerDom(ctx, { pi: 0, step: 1, optionCount: 2 });
  let calls = 0;
  setEzApi(async () => { calls++; return { ok: true, json: async () => ({ passed: false, correctIndex: 1 }) }; });
  await ctx.window.gtAnswerDrill(0, 1, 0);
  await ctx.window.gtAnswerDrill(0, 1, 0);
  assert.equal(calls, 2, 'legacy path never makes an extra reveal request');
  assert.match(verdict.innerHTML, /ditandai hijau/);
});
