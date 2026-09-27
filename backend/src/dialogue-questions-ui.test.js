import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const controllerSource = await readFile(new URL('../../src/dialogue-questions.js', import.meta.url), 'utf8');
const welcome = await readFile(new URL('../../welcome.html', import.meta.url), 'utf8');
const contentRoute = await readFile(new URL('./routes/content.js', import.meta.url), 'utf8');
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function lesson(id = 'lesson-1', goal = '') {
  return { apiId: id, grammar: [{ id: 'grammar-1', example_dialog: 'A: こんにちは',
    communication_goal: goal }] };
}
function rootFor(grammarId = 'grammar-1') {
  const listeners = new Map();
  const goal = { hidden: true, innerHTML: '', getAttribute: () => grammarId };
  const questions = { hidden: true, innerHTML: '', getAttribute: () => grammarId };
  const notice = { hidden: true, innerHTML: '' };
  return { goal, questions, notice, staticMaterial: 'Materi dan tombol selesai tetap ada',
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
    querySelectorAll: selector => selector === '[data-dq-goal-for]' ? [goal] :
      selector === '[data-dq-questions-for]' ? [questions] : [],
    querySelector: selector => selector === '.dq-legacy-session-slot' ? notice : null,
    fire: (name, event) => listeners.get(name)?.(event),
  };
}
function controller(api, onReload = () => {}) {
  let sequence = 0;
  const window = { ezApi: api, location: { reload: onReload }, crypto: { randomUUID: () =>
    `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}` } };
  vm.runInNewContext(controllerSource, { window, AbortController });
  return window.EzDialogueQuestions;
}
const batch = (mode = 'inline') => ({ lessonId: 'lesson-1', placement: { mode },
  grammars: [{ grammarId: 'grammar-1', questions: [{ id: 'question-1', version: 'version-1',
    prompt: '<b>何ですか?</b>', options: ['<駅>', '家', '店'] }] }] });
const response = data => ({ ok: true, json: async () => data });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => {
  resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function form() {
  const feedback = { innerHTML: '' }, button = { disabled: false, textContent: '' };
  const fieldset = { disabled: false };
  let selected = null;
  const node = { dataset: { dqQuestionId: 'question-1' },
    querySelector: selector => selector === '.dq-feedback' ? feedback :
      selector === '.dq-submit' ? button : selector === 'fieldset' ? fieldset :
        selector === 'input[type="radio"]:checked' ? selected : null };
  return { node, feedback, button, fieldset,
    select: value => { selected = { value: String(value), closest: () => node }; return selected; },
    submitEvent: () => ({ target: { closest: () => node }, preventDefault() {} }) };
}

test('actual welcome grammar renderer supplies hidden slots around dialogue and escapes IDs', () => {
  const start = welcome.indexOf('function renderLessonGrammar(lesson) {');
  const end = welcome.indexOf('// ── Dialog player', start);
  assert.ok(start > 0 && end > start);
  const context = vm.createContext({ escapeHtml, AUDIO_SVG: '', grammarKaraokeHtml: () => '<div class="karaoke">dialog</div>' });
  vm.runInContext(welcome.slice(start, end), context);
  const html = context.renderLessonGrammar({ grammar: [{ id: 'g&1', pattern: 'X',
    example_dialog: 'A: hi' }] });
  assert.ok(html.indexOf('data-dq-goal-for="g&amp;1"') < html.indexOf('class="karaoke"'));
  assert.ok(html.indexOf('class="karaoke"') < html.indexOf('data-dq-questions-for="g&amp;1"'));
  assert.match(html, /class="dq-legacy-session-slot" hidden/);
  assert.match(welcome, /EzDialogueQuestions\?\.unmount\(\)/);
  assert.match(welcome, /EzDialogueQuestions\?\.mount\(\{ root:/);
  assert.match(welcome, /src\/dialogue-questions\.js\?v=/);
  assert.match(contentRoute, /SELECT id, module_id, lesson_id, pattern, meaning, example, notes, example_dialog, example_dialog_id, communication_goal, dialog_scene/);
});

test('inline batch renders escaped goal and questions without initial answer leak; legacy modes suppress them', async () => {
  const calls = [];
  let mode = 'inline';
  const flow = controller(async (path, options) => { calls.push(path); return response(batch(mode)); });
  const root = rootFor();
  await flow.mount({ root, lesson: lesson('lesson-1', '<b>Belanja</b>') });
  assert.equal(calls.length, 1);
  assert.equal(root.goal.hidden, false);
  assert.match(root.goal.innerHTML, /&lt;b&gt;Belanja&lt;\/b&gt;/);
  assert.equal(root.questions.hidden, false);
  assert.match(root.questions.innerHTML, /&lt;b&gt;何ですか\?&lt;\/b&gt;/);
  assert.match(root.questions.innerHTML, /&lt;駅&gt;/);
  assert.doesNotMatch(root.questions.innerHTML, /correctIndex|explanation|evidence|questionFingerprint/);
  const fallback = rootFor();
  await flow.mount({ root: fallback, lesson: lesson() });
  assert.match(fallback.goal.innerHTML, /Percakapan/);
  mode = 'legacy';
  const old = rootFor();
  await flow.mount({ root: old, lesson: lesson() });
  assert.equal(old.goal.hidden, true); assert.equal(old.questions.hidden, true);
  mode = 'legacy_session';
  let opened = 0;
  const resumed = rootFor();
  await flow.mount({ root: resumed, lesson: lesson(), openLegacyTask: () => opened++ });
  assert.equal(resumed.questions.hidden, true);
  assert.equal(resumed.notice.hidden, false);
  assert.equal((resumed.notice.innerHTML.match(/data-dq-open-task/g) || []).length, 1);
  resumed.fire('click', { target: { closest: selector =>
    selector === '[data-dq-open-task]' ? {} : null } });
  assert.equal(opened, 1);
});

test('double click makes one POST; network retry keeps ID, changed answer and later attempt get new IDs', async () => {
  const first = deferred();
  const writes = [];
  let outcome = first.promise;
  const flow = controller(async (path, options) => {
    if (!options?.method) return response(batch());
    writes.push(JSON.parse(options.body));
    return outcome;
  });
  const root = rootFor();
  await flow.mount({ root, lesson: lesson() });
  const ui = form();
  root.fire('change', { target: ui.select(0) });
  const pending = root.fire('submit', ui.submitEvent());
  root.fire('submit', ui.submitEvent());
  assert.equal(writes.length, 1);
  first.reject(new Error('network'));
  await pending;
  assert.match(ui.feedback.innerHTML, /belum terkirim/i);
  outcome = { ok: false, status: 503, json: async () => ({ error: 'server_unavailable' }) };
  await root.fire('submit', ui.submitEvent());
  assert.equal(writes[1].requestId, writes[0].requestId);
  root.fire('change', { target: ui.select(1) });
  outcome = response({ questionId: 'question-1', questionVersion: 'version-1',
    correct: false, correctIndex: 2, explanation: 'private until correct' });
  await root.fire('submit', ui.submitEvent());
  assert.notEqual(writes[2].requestId, writes[1].requestId);
  assert.doesNotMatch(ui.feedback.innerHTML, /private until correct|correctIndex/);
  await root.fire('submit', ui.submitEvent());
  assert.notEqual(writes[3].requestId, writes[2].requestId);
  outcome = response({ questionId: 'question-1', questionVersion: 'version-1',
    correct: true, correctIndex: 1, explanation: 'Jawaban dari server' });
  await root.fire('submit', ui.submitEvent());
  assert.match(ui.feedback.innerHTML, /Jawaban dari server/);
  assert.equal(ui.button.disabled, true);
  const remounted = rootFor();
  await flow.mount({ root: remounted, lesson: lesson() });
  assert.match(remounted.questions.innerHTML, /Jawaban dari server/);
  assert.doesNotMatch(remounted.questions.innerHTML, /correctIndex|evidence/);
});

test('stale 409 disables the old question, clears retry path, and offers page reload', async () => {
  const writes = [];
  let reloads = 0;
  const flow = controller(async (path, options) => {
    if (!options?.method) return response(batch());
    writes.push(JSON.parse(options.body));
    return { ok: false, status: 409,
      json: async () => ({ error: 'question_version_conflict' }) };
  }, () => { reloads++; });
  const root = rootFor();
  await flow.mount({ root, lesson: lesson() });
  const ui = form();
  root.fire('change', { target: ui.select(0) });
  await root.fire('submit', ui.submitEvent());
  assert.equal(writes.length, 1);
  assert.equal(ui.fieldset.disabled, true);
  assert.equal(ui.button.disabled, true);
  assert.match(ui.feedback.innerHTML, /Muat ulang soal/);
  assert.match(ui.feedback.innerHTML, /data-dq-reload/);
  await root.fire('submit', ui.submitEvent());
  assert.equal(writes.length, 1, 'stale request must not retry with its old ID');
  root.fire('click', { target: { closest: selector =>
    selector === '[data-dq-reload]' ? {} : null } });
  assert.equal(reloads, 1);
});

test('late response after navigation is ignored and API failure leaves static material untouched', async () => {
  const waiting = deferred();
  let requests = 0;
  const flow = controller(async () => { requests++; return requests === 1 ? waiting.promise :
    { ok: false }; });
  const previous = rootFor(), next = rootFor();
  const oldMount = flow.mount({ root: previous, lesson: lesson() });
  await flow.mount({ root: next, lesson: lesson('lesson-2') });
  waiting.resolve(response(batch()));
  await oldMount;
  assert.equal(previous.goal.hidden, true);
  assert.equal(previous.questions.hidden, true);
  assert.equal(next.staticMaterial, 'Materi dan tombol selesai tetap ada');
  assert.equal(next.questions.hidden, true);
});
