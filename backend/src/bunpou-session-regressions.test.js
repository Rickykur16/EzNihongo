// Execute the shipped handlers and renderers, including production and IME,
// against a small DOM fixture. No copied application logic or backend writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../../welcome.html', import.meta.url), 'utf8');
function slice(start, end) {
  const from = html.indexOf(start), to = html.indexOf(end, from);
  assert.ok(from > 0 && to > from, `Missing slice: ${start}`);
  return html.slice(from, to);
}
const source = [
  slice('const GT_OPT_KEYS', 'window.gtPlayExample ='),
  slice('function _gtGetSentence', 'window.gtStartRecord ='),
  slice('const GT_ERROR_LABEL', '// Kanji lesson'),
].join('\n');
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[ch]);
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
const plain = (value) => JSON.parse(JSON.stringify(value));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function element(classes = []) {
  const tokens = new Set(classes);
  return {
    innerHTML: '', textContent: '', value: '', hidden: false, disabled: false,
    dataset: {}, style: {}, className: '', focus() { this.focused = true; },
    classList: {
      add: (...names) => names.forEach((name) => tokens.add(name)),
      remove: (...names) => names.forEach((name) => tokens.delete(name)),
      contains: (name) => tokens.has(name),
      toggle: (name, on) => on ? tokens.add(name) : tokens.delete(name),
    },
    querySelector: () => null,
  };
}

function setup({ speech = false, pilot = true } = {}) {
  const nodes = new Map();
  const add = (selector, el = element()) => { nodes.set(selector, el); return el; };
  const options = {}, chips = [element(), element()];
  for (const step of [1, 2, 3, 4, 5]) {
    const section = add(`#gt-step${step}-0`, element(step === 1 ? [] : ['gt-step--locked']));
    const body = add(`#gt-step${step}-0 .gt-step__body`);
    section.querySelector = (selector) => selector === '.gt-step__body' ? body : null;
    add(`#gt-verdict-${step}-0`);
    add(`#gt-hint-${step}-0`);
    options[step] = [0, 1].map((oi) => add(`#gt-opt-${step}-0-${oi}`));
  }
  for (const selector of ['#gt-session-notice', '#gt-meaning-0', '#gt-step2-title-0', '#gt-arr-slot-0', '#gt-arr-go-0', '#gt-complete-btn', '#gt-progress-hint']) add(selector);
  for (let si = 0; si < 2; si++) {
    const input = add(`#gt-input-0-${si}`);
    input.hidden = speech;
    add(`#gt-result-0-${si}`).hidden = true;
    add(`#gt-status-0-${si}`);
    if (speech) add(`#gt-said-0-${si}`);
  }
  const document = {
    querySelector: (selector) => nodes.get(selector) || null,
    querySelectorAll: (selector) => {
      const match = selector.match(/^\[id\^="gt-opt-(\d)-0-"\]$/);
      if (match) return options[match[1]];
      if (selector === '#gt-arr-bank-0 button, #gt-arr-slot-0 button') return chips;
      return [];
    },
  };
  let id = 0, api = async () => { throw new Error('Unstubbed API'); };
  const calls = [], refreshes = [];
  const ctx = vm.createContext({
    window: {}, document, escapeHtml, console, AUDIO_SVG: '',
    crypto: { randomUUID: () => `request-${++id}` },
    _gtScope: () => document,
    _gtSttSupported: () => speech,
    scheduleBunpouAnalysisRefresh: () => refreshes.push(true),
  });
  ctx.window.ezApi = async (path, opts) => {
    const call = { path, ...opts, body: opts?.body ? JSON.parse(opts.body) : undefined };
    calls.push(call);
    return api(call);
  };
  vm.runInContext(source, ctx);
  const w = ctx.window;
  w.__gtData = [{ id: 'g1', requiredCount: 2 }];
  w.__gtLessonId = 'task-1';
  w.__gtSourceLesson = pilot ? { apiId: 'source-1', bunpouFlow: {} } : null;
  w.__gtSessionId = pilot ? 'session-1' : null;
  w.__gtItemIds = { 'g1-1': 'item-1', 'g1-2': 'item-2', 'g1-4': 'item-4', 'g1-5': 'item-5' };
  w.__gtState = { passed: {}, total: 2, evalDisabled: false };
  return { ctx, w, calls, nodes, options, chips, refreshes, get: (s) => nodes.get(s), setApi: (fn) => { api = fn; } };
}

const item = (step, extra = {}) => ({
  grammarId: 'g1', itemId: `item-${step}`, step, prompt: 'Choose', options: ['a', 'b'],
  wrongCount: 0, passed: false, revealed: false, completed: false, ...extra,
});

test('answer deduplicates in-flight submissions and retains its ID until a valid successful result', async () => {
  const f = setup(), request = deferred();
  f.setApi(() => request.promise);
  const a = f.ctx.gtSubmitAnswer({ id: 'g1' }, 1, { optionIndex: 0 });
  const b = f.ctx.gtSubmitAnswer({ id: 'g1' }, 1, { optionIndex: 0 });
  assert.equal(f.calls.length, 1);
  request.reject(new Error('connection lost after save'));
  assert.equal(await a, null);
  assert.equal(await b, null);
  f.setApi(() => response(item(1, { wrongCount: 1 })));
  await f.ctx.gtSubmitAnswer({ id: 'g1' }, 1, { optionIndex: 0 });
  await f.ctx.gtSubmitAnswer({ id: 'g1' }, 1, { optionIndex: 0 });
  assert.equal(f.calls[0].body.requestId, f.calls[1].body.requestId);
  assert.notEqual(f.calls[1].body.requestId, f.calls[2].body.requestId);
});

test('unreadable success keeps the answer request ID; changed payload and session get new IDs', async () => {
  const f = setup();
  f.setApi(() => ({ ok: true, status: 200, json: async () => { throw new Error('truncated JSON'); } }));
  await f.ctx.gtSubmitAnswer({ id: 'g1' }, 2, { order: [0, 1] });
  await f.ctx.gtSubmitAnswer({ id: 'g1' }, 2, { order: [0, 1] });
  await f.ctx.gtSubmitAnswer({ id: 'g1' }, 2, { order: [1, 0] });
  f.w.__gtSessionId = 'session-2';
  await f.ctx.gtSubmitAnswer({ id: 'g1' }, 2, { order: [0, 1] });
  const ids = f.calls.map((call) => call.body.requestId);
  assert.equal(ids[0], ids[1]);
  assert.equal(new Set(ids).size, 3);
});

test('rapid answer clicks produce one counted result; transport and pending responses are never wrong', async () => {
  const f = setup(), request = deferred();
  f.setApi(() => request.promise);
  const a = f.w.gtAnswerDrill(0, 1, 0);
  await f.w.gtAnswerDrill(0, 1, 0);
  assert.equal(f.calls.length, 1);
  request.resolve(response(item(1, { wrongCount: 1 })));
  await a;
  assert.equal(f.w.__gtWrong['0-1'], 1);
  for (const status of [409, 500, 503]) {
    f.setApi(() => response({ error: 'evaluation_pending' }, status));
    await f.w.gtAnswerDrill(0, 1, 0);
    assert.equal(f.w.__gtWrong['0-1'], 1);
    assert.ok(f.options[1].every((b) => !b.disabled));
  }
});

test('correct choice and arrange answers render escaped reviewed explanations', async () => {
  for (const arrange of [false, true]) {
    const f = setup(), step = arrange ? 2 : 1;
    const drill = item(step, arrange ? { variant: 'arrange', tokens: ['a', 'b'] } : {});
    f.ctx._gtApplyDrills({ g1: { [arrange ? 'step2' : 'step1']: drill } });
    if (arrange) f.w.__gtArr[0] = [0, 1];
    f.setApi(() => response({ ...drill, passed: true, completed: true, explanation: '<img src=x onerror=alert(1)> & reason' }));
    await (arrange ? f.w.gtArrSubmit(0) : f.w.gtAnswerDrill(0, step, 0));
    const verdict = f.get(`#gt-verdict-${step}-0`).innerHTML;
    assert.match(verdict, /&lt;img.*&gt; &amp; reason/);
    assert.doesNotMatch(verdict, /<img/);
    assert.equal(f.w.__gtDone[`0-${step}`], true);
  }
});

test('alreadyCompleted normalization is opt-in and restores the actual cross-tab choice key', async () => {
  const f = setup();
  f.ctx._gtApplyDrills({ g1: { step1: item(1), step2: item(2) } });
  f.setApi(() => response(item(1, {
    alreadyCompleted: true, passed: true, completed: true, correctIndex: 1, explanation: 'Saved in another tab',
  })));
  await f.w.gtAnswerDrill(0, 1, 0);
  assert.equal(f.options[1][0].classList.contains('gt-opt--correct'), false);
  assert.equal(f.options[1][0].classList.contains('gt-opt--wrong'), false);
  assert.equal(f.options[1][1].classList.contains('gt-opt--correct'), true);
  assert.equal(f.w.__gtWrong['0-1'], 0);
  assert.equal(f.get('#gt-step2-0').classList.contains('gt-step--locked'), false);
  assert.equal(f.get('#gt-meaning-0').hidden, false);
  assert.equal(f.refreshes.length, 0);
  assert.equal((await f.ctx.gtSubmitAnswer({ id: 'g1' }, 1, { optionIndex: 0 })).alreadyCompleted, true);
  f.setApi(() => response(item(1, { alreadyCompleted: false })));
  assert.equal(Object.hasOwn(await f.ctx.gtSubmitAnswer({ id: 'g1' }, 1, { optionIndex: 0 }), 'alreadyCompleted'), false);
});

test('cross-tab completed arrange restores server order without grading the newly submitted order', async () => {
  for (const passed of [true, false]) {
    const f = setup();
    const drill = item(2, { variant: 'arrange', tokens: ['b', 'a'] });
    f.ctx._gtApplyDrills({ g1: { step2: drill } });
    f.w.__gtArr[0] = [0, 1];
    f.setApi(() => response({ ...drill, alreadyCompleted: true, passed, completed: true,
      revealed: !passed, wrongCount: passed ? 0 : 2, correctOrder: ['a', 'b'], explanation: 'Saved order',
    }));
    await f.w.gtArrSubmit(0);
    assert.equal(f.get('#gt-arr-slot-0').textContent, 'a b');
    assert.equal(f.get('#gt-arr-slot-0').classList.contains('gt-arr--ok'), false);
    assert.equal(f.get('#gt-arr-slot-0').classList.contains('gt-arr--no'), false);
    assert.equal(f.get('#gt-arr-go-0').disabled, true);
    assert.equal(f.get('#gt-step3-0').classList.contains('gt-step--locked'), false);
    assert.equal(f.w.__gtWrong['0-2'], passed ? 0 : 2);
    assert.equal(f.calls.length, 1, 'no extra reveal request for an already completed item');
    assert.equal(f.refreshes.length, 0);
  }
});

test('hint button calls the item hint endpoint, escapes text, and retries failures without counting answers', async () => {
  const f = setup();
  f.ctx._gtApplyDrills({ g1: { step1: item(1, { hintAvailable: true }) } });
  assert.match(f.get('#gt-step1-0 .gt-step__body').innerHTML, /gtShowHint\(0, 1, this\)/);
  const button = element();
  f.setApi(() => response({}, 500));
  await f.w.gtShowHint(0, 1, button);
  assert.equal(button.disabled, false);
  f.setApi(() => response({ available: true, hint: '<b>hint</b>' }));
  await f.w.gtShowHint(0, 1, button);
  assert.equal(f.calls[1].path, '/grammar-task/sessions/session-1/items/item-1/hint');
  assert.equal(f.get('#gt-hint-1-0').innerHTML, '&lt;b&gt;hint&lt;/b&gt;');
  assert.equal(f.w.__gtWrong['0-1'], 0);
  assert.equal(f.w.__gtDrills.g1.step1.hintAvailable, false);
  await f.w.gtShowHint(0, 1, button);
  assert.equal(f.calls.length, 2);
});

test('resume restores wrong counts, hints, revealed arrange, and passed stages 4/5 without losing unlocked stages', async () => {
  const f = setup();
  const items = [
    item(1, { wrongCount: 1, answered: true, hint: '<hint>' }),
    item(2, { variant: 'arrange', tokens: ['b', 'a'], wrongCount: 2, revealed: true, completed: true, japanese: '<right>', explanation: '<why>' }),
    item(4, { passed: true, completed: true, correctIndex: 1 }),
    item(5, { passed: true, completed: true, correctIndex: 0 }),
  ];
  f.setApi(() => response({ sessionId: 'session-1', items, productions: [] }));
  await f.ctx.gtLoadDrillsSession('task-1');
  assert.equal(f.w.__gtWrong['0-1'], 1);
  assert.equal(f.w.__gtWrong['0-2'], 2);
  assert.match(f.get('#gt-step1-0 .gt-step__body').innerHTML, /&lt;hint&gt;/);
  assert.match(f.get('#gt-verdict-2-0').innerHTML, /&lt;right&gt;.*&lt;why&gt;/s);
  assert.equal(f.get('#gt-step2-0').classList.contains('gt-step--passed'), false);
  assert.ok(f.get('#gt-arr-go-0').disabled);
  assert.ok(f.get('#gt-arr-go-0').hidden);
  assert.ok(f.chips.every((b) => b.disabled));
  for (const step of [3, 4, 5]) assert.equal(f.get(`#gt-step${step}-0`).classList.contains('gt-step--locked'), false);
  for (const step of [4, 5]) {
    assert.ok(f.get(`#gt-step${step}-0`).classList.contains('gt-step--passed'));
    assert.ok(f.options[step].every((b) => b.disabled));
  }
  f.w.gtArrTake(0, 0);
  f.w.gtArrReturn(0, 0);
  f.w.gtArrRetry(0);
  await f.w.gtArrSubmit(0);
  await f.w.gtAnswerDrill(0, 4, 0);
  assert.equal(f.calls.length, 1, 'done items cannot submit again');
});

test('one wrong answer after resume reveals; failed reveal retries separately and never unlocks early', async () => {
  const f = setup();
  f.ctx._gtApplyDrills({ g1: { step1: item(1, { wrongCount: 1, answered: true }), step2: item(2) } });
  f.setApi(({ path }) => path.endsWith('/answer')
    ? response(item(1, { wrongCount: 2, revealEligible: true })) : response({}, 500));
  await f.w.gtAnswerDrill(0, 1, 0);
  assert.equal(f.w.__gtWrong['0-1'], 2);
  assert.equal(f.get('#gt-step2-0').classList.contains('gt-step--locked'), true);
  assert.match(f.get('#gt-verdict-1-0').innerHTML, /gtRetryReveal/);
  f.setApi(() => response(item(1, { revealed: true, completed: true, correctIndex: 1, explanation: '<review>' })));
  await f.w.gtRetryReveal(0, 1);
  assert.match(f.get('#gt-verdict-1-0').innerHTML, /&lt;review&gt;/);
  assert.equal(f.get('#gt-step2-0').classList.contains('gt-step--locked'), false);
  assert.equal(f.calls.filter((call) => call.path.endsWith('/answer')).length, 1);
});

test('resume uses server wrong count when replaying an answer saved before connection loss', async () => {
  const f = setup();
  f.setApi(() => { throw new Error('response lost'); });
  await f.w.gtAnswerDrill(0, 1, 0);
  f.ctx._gtApplyDrills({ g1: { step1: item(1, { answered: true, wrongCount: 1 }) } });
  f.setApi(() => response(item(1, { answered: true, wrongCount: 1 })));
  await f.w.gtAnswerDrill(0, 1, 0);
  assert.equal(f.w.__gtWrong['0-1'], 1);
  assert.equal(f.calls[0].body.requestId, f.calls[1].body.requestId);
});

test('resuming a completed choice reveals the meaning and removes unavailable hint buttons', async () => {
  const f = setup();
  f.ctx._gtApplyDrills({ g1: { step1: item(1, { hintAvailable: true }) } });
  assert.equal(f.get('#gt-meaning-0').hidden, true);
  f.get('#gt-hint-1-0').innerHTML = '<button>Petunjuk</button>';
  f.setApi(() => response(item(1, { passed: true, completed: true, hintAvailable: false })));
  await f.w.gtAnswerDrill(0, 1, 0);
  assert.equal(f.get('#gt-hint-1-0').innerHTML, '');
  f.get('#gt-meaning-0').hidden = true;
  f.ctx._gtApplyDrills({ g1: { step1: item(1, { passed: true, completed: true }) } });
  assert.equal(f.get('#gt-meaning-0').hidden, false);
});

test('session resume restores production slots, feedback, assistance context, and completion', async () => {
  for (const speech of [false, true]) {
    const f = setup({ speech });
    const productions = [0, 1].map((slot) => ({
      grammarId: 'g1', slot, sentence: `sentence <${slot}>`, requestId: `saved-${slot}`,
      passed: slot === 0, assistanceState: 'correction_served',
      result: { correct: slot === 0, usesPattern: true, feedback: '<feedback>' },
    }));
    f.setApi(() => response({ sessionId: 'session-1', items: [], productions }));
    await f.ctx.gtLoadDrillsSession('task-1');
    assert.deepEqual(plain(f.w.__gtState.passed), { '0-0': true, '0-1': false });
    assert.equal(f.get('#gt-input-0-1').value, 'sentence <1>');
    if (speech) assert.equal(f.get('#gt-said-0-1').dataset.text, 'sentence <1>');
    assert.match(f.get('#gt-result-0-1').innerHTML, /Perbaiki kalimat/);
    assert.match(f.get('#gt-result-0-1').innerHTML, /&lt;feedback&gt;/);
    assert.equal(f.w.__gtProductions['0-1'].requestId, 'saved-1');
    assert.equal(f.w.__gtProductions['0-1'].assistanceState, 'correction_served');
    assert.equal(f.get('#gt-progress-hint').textContent, '1 / 2 kalimat selesai');
    assert.equal(f.get('#gt-complete-btn').disabled, true);
    f.w.gtRetryProduction(0, 1);
    assert.equal(f.get('#gt-input-0-1').value, 'sentence <1>');
    assert.equal(f.get('#gt-input-0-1').hidden, false);
    assert.ok(f.get('#gt-input-0-1').focused);
    productions[1].passed = true;
    productions[1].result.correct = true;
    f.ctx.gtRestoreProductions(productions);
    assert.equal(f.get('#gt-complete-btn').disabled, false);
  }
});

test('pilot production uses session endpoint with stable retries and a new ID after final evaluation', async () => {
  const f = setup(), request = deferred();
  f.get('#gt-input-0-0').value = ' original sentence ';
  f.setApi(() => request.promise);
  const a = f.ctx.gtRunEval(0, 0), b = f.ctx.gtRunEval(0, 0);
  assert.equal(f.calls.length, 1);
  request.reject(new Error('offline'));
  await Promise.all([a, b]);
  assert.deepEqual(plain(f.w.__gtState.passed), {});
  f.setApi(() => response({ error: 'evaluation_pending' }, 409));
  await f.ctx.gtRunEval(0, 0);
  assert.match(f.get('#gt-result-0-0').innerHTML, /masih diproses/);
  assert.doesNotMatch(f.get('#gt-result-0-0').innerHTML, /Grammar belum tepat/);
  assert.deepEqual(plain(f.w.__gtState.passed), {});
  f.setApi(() => response({ correct: false, usesPattern: true, saved: true, assistanceState: 'correction_served' }));
  await f.ctx.gtRunEval(0, 0);
  assert.equal(f.w.__gtState.passed['0-0'], false);
  assert.equal(f.w.__gtProductions['0-0'].assistanceState, 'correction_served');
  f.w.gtRetryProduction(0, 0);
  assert.equal(f.get('#gt-input-0-0').value, 'original sentence');
  await f.ctx.gtRunEval(0, 0);
  assert.equal(f.calls[0].path, '/grammar-task/sessions/session-1/production');
  assert.deepEqual(f.calls[0].body, { grammarId: 'g1', slot: 0, sentence: 'original sentence', inputMode: 'text', requestId: 'request-1' });
  assert.equal(f.calls[0].body.requestId, f.calls[1].body.requestId);
  assert.equal(f.calls[1].body.requestId, f.calls[2].body.requestId);
  assert.notEqual(f.calls[2].body.requestId, f.calls[3].body.requestId);
});

test('production infrastructure failures preserve progress and do not enable the legacy completion bypass', async () => {
  const f = setup();
  f.get('#gt-input-0-0').value = 'sentence';
  f.w.__gtState.passed['0-0'] = true;
  for (const res of [response({}, 503), response({}, 500), response({ correct: false, usesPattern: false }), response({ error: 'request_id_conflict' }, 409)]) {
    f.setApi(() => res);
    await f.ctx.gtRunEval(0, 0);
    assert.equal(f.w.__gtState.passed['0-0'], true);
    assert.equal(f.w.__gtState.evalDisabled, false);
    assert.doesNotMatch(f.get('#gt-result-0-0').innerHTML, /Grammar belum tepat|masih diproses/);
  }
  assert.equal(f.refreshes.length, 0);
  assert.equal(new Set(f.calls.map((call) => call.body.requestId)).size, 1);
});

test('production_completed keeps the submitted sentence and offers a session reload without fabricating a grade', async () => {
  const f = setup();
  f.get('#gt-input-0-0').value = 'My different sentence';
  f.setApi(() => response({ error: 'production_completed' }, 409));
  await f.ctx.gtRunEval(0, 0);
  assert.equal(f.get('#gt-input-0-0').value, 'My different sentence');
  assert.deepEqual(plain(f.w.__gtState.passed), {});
  assert.equal(f.refreshes.length, 0);
  assert.equal(f.w.__gtProductions, undefined);
  const result = f.get('#gt-result-0-0').innerHTML;
  assert.match(result, /Kalimat pada bagian ini sudah tersimpan dari sesi lain\. Muat ulang sesi\./);
  assert.match(result, /onclick="gtLoadDrills\(window\.__gtLessonId\)"/);
  assert.doesNotMatch(result, /Bagus|Grammar belum tepat|masih diproses/);
  f.setApi(() => response({ sessionId: 'session-1', items: [], productions: [{
    grammarId: 'g1', slot: 0, sentence: 'Saved elsewhere', requestId: 'other-request',
    passed: true, assistanceState: 'none_observed', result: { correct: true, usesPattern: true },
  }] }));
  await f.ctx.gtLoadDrills('task-1');
  assert.equal(f.get('#gt-input-0-0').value, 'Saved elsewhere');
  assert.equal(f.w.__gtState.passed['0-0'], true);
  assert.match(f.get('#gt-result-0-0').innerHTML, /Bagus/);
});

test('speech production and edited retries send the correct input mode; stale results are ignored', async () => {
  const f = setup({ speech: true }), request = deferred();
  f.ctx._gtSetSaid('0-0', 'spoken sentence');
  f.setApi(() => response({ correct: false, usesPattern: true, saved: true }));
  await f.ctx.gtRunEval(0, 0, { fromSpeech: true });
  assert.equal(f.calls[0].body.inputMode, 'speech');
  f.w.gtRetryProduction(0, 0);
  f.get('#gt-input-0-0').value += ' edited';
  f.setApi(() => request.promise);
  const pending = f.ctx.gtRunEval(0, 0);
  assert.equal(f.calls[1].body.inputMode, 'text');
  f.w.__gtSessionId = 'another-session';
  f.w.__gtState = { passed: {}, total: 2 };
  request.resolve(response({ correct: true, usesPattern: true, saved: true }));
  await pending;
  assert.deepEqual(plain(f.w.__gtState.passed), {});
});

test('IME composition, keyCode 229, and Shift+Enter never evaluate; ordinary Enter evaluates once', async () => {
  const f = setup();
  const ta = f.get('#gt-input-0-0');
  ta.value = 'sentence';
  let prevented = 0;
  const event = (extra) => ({ key: 'Enter', target: ta, preventDefault: () => prevented++, ...extra });
  for (const extra of [{ isComposing: true }, { keyCode: 229 }, { shiftKey: true }]) await f.w.gtInputKey(0, 0, event(extra));
  assert.equal(prevented, 0);
  assert.equal(f.calls.length, 0);
  f.setApi(() => response({ correct: true, usesPattern: true, saved: true }));
  await f.w.gtInputKey(0, 0, event({}));
  assert.equal(prevented, 1);
  assert.equal(f.calls.length, 1);
  assert.equal(ta.disabled, false);
});

test('legacy production keeps its original endpoint, payload, retry clearing, and 503 fallback', async () => {
  const f = setup({ pilot: false });
  f.get('#gt-input-0-0').value = 'sentence';
  f.setApi(() => response({ correct: false, usesPattern: true }));
  await f.ctx.gtRunEval(0, 0);
  assert.equal(f.calls[0].path, '/grammar-task/evaluate');
  assert.deepEqual(f.calls[0].body, { lessonId: 'task-1', grammarId: 'g1', sentence: 'sentence', inputMode: 'text' });
  assert.doesNotMatch(f.get('#gt-result-0-0').innerHTML, /Perbaiki kalimat/);
  f.w.gtRetryProduction(0, 0);
  assert.equal(f.get('#gt-input-0-0').value, '');
  f.get('#gt-input-0-0').value = 'sentence';
  f.setApi(() => response({}, 503));
  await f.ctx.gtRunEval(0, 0);
  assert.equal(f.w.__gtState.evalDisabled, true);
});

test('pilot never falls back to legacy evaluation while its session is unavailable', async () => {
  const f = setup();
  f.w.__gtSessionId = null;
  f.get('#gt-input-0-0').value = 'sentence';
  await f.ctx.gtRunEval(0, 0);
  assert.equal(f.calls.length, 0);
  assert.match(f.get('#gt-result-0-0').innerHTML, /Sesi latihan belum siap/);
});

test('companion_needs_review clearly preserves material availability without recording a wrong answer', async () => {
  const f = setup();
  f.w.__gtSessionId = null;
  f.setApi(() => response({ error: 'companion_needs_review' }, 409));
  await f.ctx.gtLoadDrillsSession('task-1');
  assert.match(f.get('#gt-session-notice').textContent, /Pendamping sedang ditinjau\. Materi tetap tersedia/);
  assert.match(f.get('#gt-step1-0 .gt-step__body').innerHTML, /Pendamping sedang ditinjau/);
  assert.equal(f.w.__gtWrong, undefined);
  assert.deepEqual(plain(f.w.__gtState.passed), {});
  assert.equal(f.calls.length, 1);
});

test('review conflict can resume a known active snapshot through GET with a source-change notice', async () => {
  const f = setup();
  f.setApi(({ path }) => path === '/grammar-task/sessions'
    ? response({ error: 'companion_needs_review' }, 409)
    : response({ sessionId: 'session-1', contentChanged: true, items: [item(1, { passed: true, completed: true })], productions: [] }));
  await f.ctx.gtLoadDrillsSession('task-1');
  assert.equal(f.calls[1].path, '/grammar-task/sessions/session-1');
  assert.equal(f.calls[1].method, undefined);
  assert.match(f.get('#gt-session-notice').textContent, /Pendamping sedang ditinjau.*Sesi aktif tetap memakai materi yang tersimpan/);
  assert.ok(f.get('#gt-step1-0').classList.contains('gt-step--passed'));
  assert.equal(f.get('#gt-step3-0').classList.contains('gt-step--locked'), false);
});

test('contentChanged announces a new session and resets old completion while status-less mocks succeed', async () => {
  const f = setup();
  f.w.__gtState.passed['0-0'] = true;
  f.get('#gt-result-0-0').hidden = false;
  f.get('#gt-input-0-0').value = 'old sentence';
  f.setApi(() => ({ ok: true, json: async () => ({ sessionId: 'new-session', contentChanged: true, items: [item(1), item(2)], productions: [] }) }));
  await f.ctx.gtLoadDrillsSession('task-1');
  assert.match(f.get('#gt-session-notice').textContent, /Materi sumber berubah\. Sesi latihan baru dimulai/);
  assert.deepEqual(plain(f.w.__gtState.passed), {});
  assert.equal(f.get('#gt-result-0-0').hidden, true);
  assert.equal(f.get('#gt-input-0-0').value, '');
  assert.equal(f.get('#gt-step3-0').classList.contains('gt-step--locked'), true);
  f.setApi(() => ({ ok: true, json: async () => item(1, { passed: true }) }));
  assert.equal((await f.ctx.gtSubmitAnswer({ id: 'g1' }, 1, { optionIndex: 0 })).passed, true);
  f.get('#gt-input-0-0').value = 'new sentence';
  f.setApi(() => ({ ok: true, json: async () => ({ saved: true, correct: true, usesPattern: true }) }));
  await f.ctx.gtRunEval(0, 0);
  assert.equal(f.w.__gtState.passed['0-0'], true);
});

test('late session errors do not overwrite a different lesson', async () => {
  const f = setup(), request = deferred();
  f.setApi(() => request.promise);
  const pending = f.ctx.gtLoadDrillsSession('task-1');
  f.w.__gtLessonId = 'task-2';
  request.reject(new Error('offline'));
  await pending;
  assert.equal(f.get('#gt-session-notice').textContent, '');
  assert.equal(f.get('#gt-step1-0 .gt-step__body').innerHTML, '');
});

test('all inline welcome scripts remain syntactically valid', () => {
  for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
    if (match[1].trim()) new vm.Script(match[1]);
  }
});
