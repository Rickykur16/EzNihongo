import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const controllerSource = await readFile(new URL('../../src/dialogue-questions.js', import.meta.url), 'utf8');
const welcome = await readFile(new URL('../../welcome.html', import.meta.url), 'utf8');
const contentRoute = await readFile(new URL('./routes/content.js', import.meta.url), 'utf8');
const learningSequence = welcome.slice(welcome.indexOf('// ── Learning sequence'),
  welcome.indexOf('// ── End learning sequence'));
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
function controller(api, onReload = () => {}, crypto = null) {
  let sequence = 0;
  const window = { ezApi: api, location: { reload: onReload }, crypto: crypto || { randomUUID: () =>
    `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}` } };
  vm.runInNewContext(controllerSource, { window, AbortController, Uint8Array });
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

test('actual conversation renderer supplies hidden slots around dialogue and escapes IDs', () => {
  const start = welcome.indexOf('function renderLessonGrammar(lesson) {');
  const end = welcome.indexOf('// ── Dialog player', start);
  assert.ok(start > 0 && end > start);
  const root = { innerHTML: '' };
  let mounted;
  const context = vm.createContext({ escapeHtml, AUDIO_SVG: '', visibleLessons: value => value.lessons,
    document: { getElementById: () => root },
    window: { EzDialogueQuestions: { mount: value => { mounted = value; } } },
    learningStepAction: () => '',
    grammarKaraokeHtml: () => '<div class="karaoke">dialog</div>' });
  vm.runInContext(welcome.slice(start, end), context);
  vm.runInContext(learningSequence, context);
  const row = { apiId: 'source-id', type: 'video', title: 'Pola', grammar: [{ id: 'g&1', pattern: 'X',
    example: 'がくせいです。', example_dialog: 'A: hi' }] };
  const conversation = { id: 'conv', apiId: 'conv-id', type: 'conversation', title: 'Percakapan: Pola',
    conversationSourceLessonId: 'source-id' };
  const module = { num: '03', title: 'Bab 3', lessons: [row, conversation] };
  const grammar = context.renderLessonGrammar(row);
  assert.match(grammar, /がくせいです。/);
  assert.doesNotMatch(grammar, /karaoke|data-dq-|A: hi/);
  context.renderConversationLesson({ name: 'N5' }, module, conversation, {});
  const html = root.innerHTML;
  assert.ok(html.indexOf('data-dq-goal-for="g&amp;1"') < html.indexOf('class="karaoke"'));
  assert.ok(html.indexOf('class="karaoke"') < html.indexOf('data-dq-questions-for="g&amp;1"'));
  assert.match(html, /class="dq-legacy-session-slot" hidden/);
  assert.equal(mounted.lesson, row, 'question API keeps the original source lesson');
  assert.match(html, /markCompleteAndNext/, 'the Percakapan lesson completes itself, never its source');
  assert.match(welcome, /EzDialogueQuestions\?\.unmount\(\)/);
  assert.match(welcome, /EzDialogueQuestions\?\.mount\(\{ root, lesson/);
  assert.match(welcome, /src\/dialogue-questions\.js\?v=/);
  assert.match(contentRoute, /SELECT id, module_id, lesson_id, pattern, meaning, example, notes, example_dialog, example_dialog_id, communication_goal, dialog_scene/);
});

test('Percakapan lesson mounts its dialogue scenes instead of leaving an empty stage', () => {
  const start = welcome.indexOf('function renderConversationLesson(');
  const end = welcome.indexOf('// ── Dialog player', start);
  const root = { innerHTML: '' };
  let enhanced = null;
  const context = vm.createContext({ escapeHtml, document: { getElementById: () => root },
    window: { EzDialogueQuestions: { mount() {} }, EzDialogue: { enhance: value => { enhanced = value; } } },
    learningStepAction: () => '', visibleLessons: value => value.lessons,
    grammarKaraokeHtml: () => '<div class="grammar-karaoke"></div>' });
  vm.runInContext(welcome.slice(start, end), context);
  vm.runInContext(learningSequence, context);
  const source = { apiId: 's', type: 'video', grammar: [{ id: 'g1', example_dialog: 'A: hi' }] };
  const conversation = { id: 'c', apiId: 'c', type: 'conversation', title: 'Percakapan', conversationSourceLessonId: 's' };
  context.renderConversationLesson({ name: 'N5' }, { num: '03', title: 'Bab 3', lessons: [source, conversation] },
    conversation, {});
  // The old grammar page mounted scenes when its collapsible opened; this view
  // has no such block, so without this call images never load before playback.
  assert.equal(enhanced, root);
});

test('grammar page keeps examples and sends next navigation to its conversation without a task shortcut', () => {
  const start = welcome.indexOf('function renderLesson() {');
  const end = welcome.indexOf('function renderLessonMaterials', start);
  const main = { innerHTML: '' };
  const lessonRow = { id: 'l', apiId: 'source-1', type: 'video', title: 'Lesson',
    body: 'Body', duration: '5 min', jp: '', grammar: [] };
  const module = { id: 'm', num: '01', title: 'Module', lessons: [lessonRow] };
  let mounts = 0;
  const context = vm.createContext({ window: { EzDialogueQuestions: {
    unmount() {}, mount() { mounts++; } } }, document: { getElementById: () => main },
    currentState: { course: 'c', moduleId: 'm', lessonId: 'l', view: 'lesson' },
    COURSE_CONTENT: { c: { name: 'Course', modules: [module] } },
    gkStopAll() {}, destroyYoutubeSegmentPlayer() {}, updateTutorVisibility() {}, syncLearningUrl() {},
    getProgress: () => ({}), visibleLessons: value => value.lessons,
    courseLearningSteps: () => [{ kind: 'lesson', module, lesson: lessonRow },
      { kind: 'conversation', module, lesson: lessonRow }], learningStepAction: () => '',
    renderVideoLessonPlayer: () => '<div id="video">VIDEO</div>',
    renderLessonExtras: () => '<div id="grammar">GRAMMAR</div>',
    renderLessonMaterials: () => '', loadBunpouAnalysis() {}, escapeHtml });
  vm.runInContext(welcome.slice(start, end), context);
  for (const bunpouFlow of [undefined, { objective: 'Goal' }]) {
    lessonRow.bunpouFlow = bunpouFlow;
    context.renderLesson();
    assert.match(main.innerHTML, /id="grammar"/);
    assert.doesNotMatch(main.innerHTML, /data-dq-task-banner|gtOpenTaskPopup|data-dq-questions-for/);
  }
  assert.equal(mounts, 0, 'question controller only mounts in conversation');
});
test('inline batch renders escaped goal and questions without initial answer leak; legacy modes suppress them', async () => {
  const calls = [];
  const placements = [];
  let mode = 'inline';
  const flow = controller(async (path, options) => { calls.push(path); return response(batch(mode)); });
  const root = rootFor();
  await flow.mount({ root, lesson: lesson('lesson-1', '<b>Belanja</b>'),
    onPlacement: value => placements.push(value.mode) });
  assert.equal(calls.length, 1);
  assert.deepEqual(placements, ['inline']);
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
  await flow.mount({ root: old, lesson: lesson(),
    onPlacement: value => placements.push(value.mode) });
  assert.equal(old.goal.hidden, true); assert.equal(old.questions.hidden, true);
  assert.deepEqual(placements, ['inline', 'legacy']);
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

test('standalone conversation shows goal and check while preserving a legacy task session', async () => {
  for (const mode of ['legacy', 'legacy_session']) {
    const flow = controller(async () => response({ ...batch(mode), standalone: true }));
    const root = rootFor();
    await flow.mount({ root, lesson: lesson('lesson-1', 'Mengenali barang.'), openLegacyTask() {} });
    assert.equal(root.goal.hidden, false);
    assert.match(root.goal.innerHTML, /Mengenali barang/);
    assert.equal(root.questions.hidden, false);
    assert.match(root.questions.innerHTML, /Periksa jawaban/);
    assert.equal(root.notice.hidden, mode !== 'legacy_session');
  }
});

test('authored goals remain visible without question availability', async () => {
  for (const api of [async () => ({ ok: false }), async () => { throw Error('offline'); },
    async () => response(batch('legacy'))]) {
    const flow = controller(api);
    const root = rootFor();
    await flow.mount({ root, lesson: lesson('lesson-1', '<b>Tujuan</b>') });
    assert.equal(root.goal.hidden, false);
    assert.match(root.goal.innerHTML, /&lt;b&gt;Tujuan&lt;\/b&gt;/);
    assert.equal(root.questions.hidden, true);
  }
});

test('N4 shows its goal before the dialogue and keeps ungraded checks after the quiz', async () => {
  const start = welcome.indexOf('function renderLessonGrammar(lesson) {');
  const end = welcome.indexOf('// ── Dialog player', start);
  const main = { innerHTML: '' };
  const context = vm.createContext({ escapeHtml, AUDIO_SVG: '',
    document: { getElementById: () => main }, visibleLessons: value => value.lessons,
    window: { EzDialogueQuestions: { mount() {} } }, learningStepAction: () => '',
    grammarKaraokeHtml: () => '<div class="karaoke">dialog</div>' });
  vm.runInContext(welcome.slice(start, end), context);
  vm.runInContext(learningSequence, context);
  const source = { apiId: 'source-id', type: 'video', title: 'Grammar', hasConversation: true, grammar: [{
    id: 'g1', pattern: 'Pola', example_dialog: 'A: hi', communication_goal: 'Saling menyapa',
    dialogueSelfChecks: [
      { prompt: 'Siapa?', answer: 'Anna', explanation: 'Anna menyapa.' },
      { prompt: 'Kapan?', answer: 'Pagi', explanation: 'Pagi hari.' },
    ],
  }] };
  const conversation = { id: 'c', type: 'conversation', title: 'Percakapan',
    conversationSourceLessonId: 'source-id' };
  assert.doesNotMatch(context.renderLessonGrammar(source), /karaoke|Siapa\?/);
  context.renderConversationLesson({ name: 'N4' }, { num: '01', title: 'Bab 1',
    lessons: [source, conversation] }, conversation, {});
  const html = main.innerHTML;
  assert.ok(html.indexOf('Tujuan komunikasi') < html.indexOf('class="karaoke"'));
  assert.ok(html.indexOf('class="karaoke"') < html.indexOf('data-dq-questions-for="g1"'));
  assert.ok(html.indexOf('data-dq-questions-for="g1"') < html.indexOf('Tes pemahaman percakapan'));

  const root = rootFor();
  const heading = { textContent: 'Tes pemahaman percakapan' };
  const checks = [{ hidden: false }, { hidden: false }];
  const self = { hidden: false, getAttribute: () => 'grammar-1',
    querySelectorAll: selector => selector === '.dq-self-check' ? checks : [],
    querySelector: selector => selector === 'h3' ? heading : null };
  const original = root.querySelectorAll;
  root.querySelectorAll = selector => selector === '[data-dq-self-checks-for]' ? [self] : original(selector);
  const flow = controller(async () => response({ ...batch('legacy'), standalone: true }));
  await flow.mount({ root, lesson: lesson('lesson-1', 'Tujuan N4') });
  assert.equal(root.questions.hidden, false);
  assert.match(root.questions.innerHTML, /Tes pemahaman percakapan/);
  assert.equal(checks[0].hidden, true);
  assert.equal(checks[1].hidden, false);
  assert.equal(heading.textContent, 'Latihan tambahan');
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

test('without crypto.randomUUID (insecure context, Safari < 15.4) the request ID is still a server-valid UUID', async () => {
  const writes = [];
  const { getRandomValues } = await import('node:crypto');
  const flow = controller(async (path, options) => {
    if (!options?.method) return response(batch());
    writes.push(JSON.parse(options.body));
    return response({ questionId: 'question-1', questionVersion: 'version-1', correct: false });
  }, () => {}, { getRandomValues: array => getRandomValues(array) });
  const root = rootFor();
  await flow.mount({ root, lesson: lesson() });
  const ui = form();
  root.fire('change', { target: ui.select(0) });
  await root.fire('submit', ui.submitEvent());
  root.fire('change', { target: ui.select(1) });
  await root.fire('submit', ui.submitEvent());
  assert.equal(writes.length, 2);
  // Same pattern the answer endpoint enforces (dialogue-question-learner.js).
  const serverUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
  for (const write of writes) assert.match(write.requestId, serverUuid);
  assert.notEqual(writes[0].requestId, writes[1].requestId);
  assert.doesNotMatch(ui.feedback.innerHTML, /belum terkirim/i);
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
