import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const welcome = (await readFile(new URL('../../welcome.html', import.meta.url), 'utf8'))
  .replaceAll('\r\n', '\n');
const plain = value => JSON.parse(JSON.stringify(value));
const esc = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
function source(from, to) {
  const start = welcome.indexOf(from), end = welcome.indexOf(to, start);
  assert.ok(start >= 0 && end > start, `Source markers: ${from}`);
  return welcome.slice(start, end);
}
function fixture() {
  const lesson = (id, type = 'video', extra = {}) => ({ id, apiId: `${id}-api`,
    title: id, type, grammar: [], durationMinutes: 5, ...extra });
  const grammar = (id) => lesson(id, 'video', { grammar: [{ id: `${id}-grammar`,
    pattern: 'です', example: 'がくせいです。', example_dialog: 'A: はじめまして。',
    example_dialog_id: 'A: Salam kenal.', communication_goal: `Tujuan ${id}` }] });
  // Percakapan is a real lesson (migration 178) pointing at its grammar source.
  const conversation = (id, sourceId) => lesson(id, 'conversation',
    { title: `Percakapan ${sourceId}`, conversationSourceLessonId: `${sourceId}-api` });
  const module = { id: 'bab3', num: '03', title: 'Perkenalan Diri', lessons: [
    lesson('intro'), lesson('vocab', 'deck'), lesson('kanji', 'kanji'),
    grammar('grammar1'), conversation('conv1', 'grammar1'),
    lesson('task1', 'grammar_task', { popupAfterLessonId: 'grammar1-api' }),
    grammar('grammar2'), conversation('conv2', 'grammar2'),
    lesson('task2', 'grammar_task', { popupAfterLessonId: 'grammar2-api' }),
    lesson('quiz', 'quiz'),
  ] };
  return { module, course: { name: 'N5', modules: [module] } };
}
function helpers(overrides = {}) {
  const ctx = vm.createContext({ window: {}, visibleLessons: module => module.lessons || [],
    escapeHtml: esc, ...overrides });
  vm.runInContext(source('// ── Learning sequence', '// ── End learning sequence'), ctx);
  return ctx;
}
const ids = steps => plain(steps.map(step => step.lesson.id));

test('two grammar lessons each have their own Percakapan lesson before their own Bunpou task', () => {
  const { module } = fixture();
  const before = JSON.stringify(module);
  const ctx = helpers();
  const steps = ctx.moduleLearningSteps(module);
  assert.deepEqual(ids(steps), ['intro', 'vocab', 'kanji', 'grammar1', 'conv1', 'task1',
    'grammar2', 'conv2', 'task2', 'quiz']);
  assert.ok(steps.every(step => step.kind === 'lesson'), 'no virtual steps: every step is a real lesson');
  assert.equal(JSON.stringify(module), before, 'display steps must not mutate stored lessons');
  assert.equal(ctx.conversationSource(module, module.lessons[4]), module.lessons[3],
    'the Percakapan plays the dialogues (and question ownership) of its source');
  assert.equal(ctx.conversationLessonFor(module, module.lessons[6]), module.lessons[7]);
});

test('grammar with a dialogue but no Percakapan lesson gets no invented step', () => {
  const ctx = helpers();
  const module = { id: 'kana', lessons: [
    { id: 'kana1', apiId: 'k', type: 'kana' },
    { id: 'dialog', apiId: 'd', type: 'video', grammar: [{ example_dialog: 'A: hi' }] },
    { id: 'task', apiId: 't', type: 'grammar_task', popupAfterLessonId: 'd' },
    { id: 'quiz', apiId: 'q', type: 'quiz' },
  ] };
  assert.deepEqual(ids(ctx.moduleLearningSteps(module)), ['kana1', 'dialog', 'task', 'quiz']);
});

test('Percakapan source is preserved when flattening multiple modules', () => {
  const { course } = fixture();
  course.modules.push({ id: 'bab4', lessons: [{ id: 'intro4', apiId: 'intro4-api', type: 'video' }] });
  const ctx = helpers();
  const steps = ctx.courseLearningSteps(course);
  assert.equal(steps.filter(step => step.lesson.type === 'conversation').length, 2);
  assert.equal(steps.at(-1).lesson.id, 'intro4');
});

test('a unique linked task follows its Percakapan, while ambiguous and foreign links keep configured order', () => {
  const { module } = fixture();
  const [intro, vocab, kanji, g1, c1, t1, g2, c2, t2, quiz] = module.lessons;
  module.lessons = [intro, vocab, kanji, g1, t1, c1, g2, quiz, t2, c2];
  const ctx = helpers();
  assert.deepEqual(ids(ctx.moduleLearningSteps(module)), ['intro', 'vocab', 'kanji', 'grammar1', 'conv1',
    'task1', 'grammar2', 'quiz', 'conv2', 'task2']);
  t2.popupAfterLessonId = t1.popupAfterLessonId;
  assert.deepEqual(ids(ctx.moduleLearningSteps(module)), module.lessons.map(lesson => lesson.id));
  t1.popupAfterLessonId = 'other-module-api';
  t2.popupAfterLessonId = 'missing-api';
  assert.deepEqual(ids(ctx.moduleLearningSteps(module)), module.lessons.map(lesson => lesson.id));
});

test('Percakapan footer completes the lesson, leads to its own Bunpou, and mounts questions of its source', () => {
  const { module, course } = fixture();
  const root = { innerHTML: '' };
  const mounts = [], selected = [], enhanced = [];
  const ctx = helpers({ document: { getElementById: () => root },
    window: { EzDialogueQuestions: { mount: value => mounts.push(value) },
      EzDialogue: { enhance: value => enhanced.push(value) },
      selectLesson: (...args) => selected.push(args) },
    grammarKaraokeHtml: dialog => `<div class="karaoke">${esc(dialog)}</div>` });
  vm.runInContext(source('function renderConversationLesson(', '// ── Dialog player'), ctx);
  const steps = ctx.courseLearningSteps(course);
  for (const index of [4, 7]) {
    const lesson = steps[index].lesson;
    ctx.renderConversationLesson(course, module, lesson,
      { prev: steps[index - 1], next: steps[index + 1], isDone: false });
    assert.match(root.innerHTML, new RegExp(`selectLesson\\('bab3','${steps[index - 1].lesson.id}'\\)`));
    assert.match(root.innerHTML, /markCompleteAndNext\(this\)/, 'a Percakapan is completed like any lesson');
    assert.match(root.innerHTML, /Tandai Selesai &amp; Lanjut ke Tugas Bunpou|Tandai Selesai & Lanjut ke Tugas Bunpou/);
    assert.match(root.innerHTML, new RegExp(esc(lesson.title)));
    assert.match(root.innerHTML, /karaoke/);
    const sourceLesson = ctx.conversationSource(module, lesson);
    assert.equal(mounts.at(-1).lesson, sourceLesson, 'questions stay keyed to the grammar source');
    mounts.at(-1).openLegacyTask();
    assert.deepEqual(selected.at(-1), ['bab3', steps[index + 1].lesson.id]);
  }
  assert.equal(enhanced.length, 2);
  ctx.renderConversationLesson(course, module, steps[4].lesson,
    { prev: steps[3], next: steps[5], isDone: true });
  assert.match(root.innerHTML, /Lanjut ke Tugas Bunpou →/);
  assert.doesNotMatch(root.innerHTML, /Tandai Selesai/);
});

test('a Percakapan whose source has no dialogue says so instead of an empty stage', () => {
  const { module, course } = fixture();
  module.lessons[3].grammar = [];
  const root = { innerHTML: '' };
  const mounts = [];
  const ctx = helpers({ document: { getElementById: () => root },
    window: { EzDialogueQuestions: { mount: value => mounts.push(value) } },
    grammarKaraokeHtml: () => { throw new Error('no dialogue to render'); } });
  vm.runInContext(source('function renderConversationLesson(', '// ── Dialog player'), ctx);
  ctx.renderConversationLesson(course, module, module.lessons[4], { prev: null, next: null, isDone: false });
  assert.match(root.innerHTML, /belum tersedia/);
  assert.match(root.innerHTML, /markCompleteAndNext/);
  assert.equal(mounts.length, 0);
});

function dialogueControlsFixture() {
  const saved = new Map([['ez_dialog_speed', '0.75'], ['ez_dialog_arti', 'tap']]);
  const players = [0, 1].map(() => ({
    attrs: {},
    setAttribute(name, value) { this.attrs[name] = value; },
    buttons: [0.75, 1, 1.25].map(value => ({
      dataset: { v: String(value) }, attrs: {}, selected: false,
      setAttribute(name, attr) { this.attrs[name] = attr; },
      classList: { toggle(_name, selected) { this.selected = selected; } },
    })),
    querySelectorAll() { return this.buttons; },
  }));
  const artiButtons = [{ textContent: '' }, { textContent: '' }];
  const ctx = vm.createContext({ escapeHtml: esc,
    window: { __gk: { g0: { rate: 0.75, audio: { playbackRate: 0.75 } } } },
    localStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) },
    document: { querySelectorAll: selector => selector === '.grammar-karaoke' ? players : artiButtons },
  });
  vm.runInContext(source('function parseDialogLinesFE(text) {', '// Jump ke segment tertentu'), ctx);
  return { ctx, saved, players, artiButtons };
}

test('Percakapan renders keyboard-operable narrator playback and exposes the saved speed', () => {
  const { ctx } = dialogueControlsFixture();
  const html = ctx.grammarKaraokeHtml('N: 図書館です。\nアンナ: こんにちは。', 'g0',
    'N: Di perpustakaan.\nアンナ: Halo.');
  assert.match(html, /<button type="button" class="gk-scene-line" data-line-index="0"[^>]*grammarKaraokeJumpTo\('g0',0\)/,
    'narrator activation uses the existing turn handler through a native button');
  assert.match(html, /<span class="gk-line-id">Di perpustakaan\.<\/span>/);
  assert.match(html, /aria-label="Putar ucapan アンナ"/);
  assert.match(html, /role="group" aria-label="Kecepatan audio"/);
  assert.match(html, /data-v="0.75" aria-pressed="true"/);
  assert.match(html, /data-v="1" aria-pressed="false"/);
  assert.match(html, /Arti: per baris/);
});

test('Percakapan controls retain shared preferences, update active audio and describe each meaning mode', () => {
  const { ctx, saved, players, artiButtons } = dialogueControlsFixture();
  for (const [mode, label] of [['always', 'Arti: ditampilkan'], ['off', 'Arti: disembunyikan'], ['tap', 'Arti: per baris']]) {
    ctx.window.gkCycleArti('g0', artiButtons[0]);
    assert.equal(saved.get('ez_dialog_arti'), mode);
    assert.ok(players.every(player => player.attrs['data-arti'] === mode));
    assert.ok(artiButtons.every(button => button.textContent === label));
    assert.ok(ctx.grammarKaraokeHtml('A: こんにちは。', 'g2', 'A: Halo.').includes(label),
      'newly opened dialogues inherit the same preference and readable label');
  }
  ctx.window.gkSetSpeed('g0', 1.25);
  assert.equal(saved.get('ez_dialog_speed'), '1.25');
  assert.equal(ctx.window.__gk.g0.audio.playbackRate, 1.25);
  assert.equal(ctx.window.__gk.g0.rate, 1.25);
  for (const player of players) {
    assert.equal(player.attrs['data-speed'], '1.25');
    assert.deepEqual(player.buttons.map(button => button.attrs['aria-pressed']), ['false', 'false', 'true']);
    assert.deepEqual(player.buttons.map(button => button.classList.selected), [false, false, true]);
  }
  assert.match(ctx.grammarKaraokeHtml('A: こんにちは。', 'g2', ''), /data-v="1.25" aria-pressed="true"/);
});

test('keyboard focus clears its own measured toolbar without moving visible controls or stale focus', () => {
  const { ctx } = dialogueControlsFixture();
  const frames = [], scrolls = [];
  ctx.requestAnimationFrame = callback => frames.push(callback);
  ctx.window.scrollBy = options => scrolls.push(plain(options));
  let toolbarBottom = 151, top = 86, keyboard = true, inToolbar = false;
  const target = { isConnected: true, matches: () => keyboard,
    getBoundingClientRect: () => ({ top, height: 44 }) };
  const toolbar = { contains: () => inToolbar, getBoundingClientRect: () => ({ bottom: toolbarBottom }) };
  const player = { querySelector: () => toolbar };
  ctx.document.activeElement = target;
  const focus = () => ctx.window.gkKeepFocusVisible({ target, currentTarget: player });
  for (const bottom of [151, 197, 247]) {
    toolbarBottom = bottom;
    focus();
    assert.equal(frames.length, 1, 'wait for native focus scrolling before measuring');
    frames.shift()();
    assert.deepEqual(scrolls.at(-1), { top: top - bottom - 8, behavior: 'instant' });
  }
  const count = scrolls.length;
  top = 300; focus(); frames.shift()(); // Already visible.
  inToolbar = true; focus();
  assert.equal(frames.length, 0, 'toolbar controls must not scroll the transcript');
  inToolbar = false; top = 86; focus(); ctx.document.activeElement = null; frames.shift()();
  ctx.document.activeElement = target; keyboard = false; focus(); frames.shift()();
  keyboard = true; target.isConnected = false; focus(); frames.shift()();
  assert.equal(scrolls.length, count, 'visible, pointer, removed or superseded focus leaves the scroll alone');
});

test('old conversation links open the Percakapan lesson and URLs no longer carry a view', () => {
  const urls = [];
  const history = { replaceState: (_state, _title, url) => urls.push(url) };
  const state = { course: 'n5', moduleId: 'bab3', lessonId: 'conv1', view: 'lesson' };
  const { course } = fixture();
  const opened = [];
  const ctx = helpers({ currentState: state, URLSearchParams, history, window: { history },
    COURSE_CONTENT: { n5: course }, selectLearningView: (...args) => opened.push(args) });
  vm.runInContext(source('// Old callers pass the grammar lesson; its Percakapan lesson opens instead.',
    'window.selectModuleIntro ='), ctx);
  ctx.syncLearningUrl();
  assert.equal(urls.at(-1), 'welcome.html?course=n5&module=bab3&lesson=conv1');
  state.view = 'intro';
  ctx.syncLearningUrl();
  assert.equal(urls.at(-1), 'welcome.html?course=n5&module=bab3&view=intro');
  ctx.window.selectConversation('bab3', 'grammar2');
  assert.deepEqual(plain(opened.at(-1)), ['bab3', 'conv2', 'lesson']);
  ctx.window.selectConversation('bab3', 'intro');
  assert.deepEqual(plain(opened.at(-1)), ['bab3', 'intro', 'lesson'], 'no Percakapan: the lesson itself');
});

test('late completion cannot advance a reopened view, and a Percakapan writes its own completion', async () => {
  const { module, course } = fixture();
  const progress = { n5: {} };
  let finishWrite, writes = 0, renders = 0;
  const state = { course: 'n5', moduleId: 'bab3', lessonId: 'grammar1', view: 'lesson' };
  const ctx = helpers({ currentState: state, COURSE_CONTENT: { n5: course },
    window: { __quizNavigationEpoch: 1, scrollTo() {} },
    getProgress: () => progress, setProgress() {}, addXP() {},
    findLesson: () => module.lessons.find(lesson => lesson.id === state.lessonId),
    syncLessonCompletionToServer: () => { writes++; return new Promise(resolve => { finishWrite = resolve; }); },
    finishLearningMilestone: (_course, _module, _completed, advance) => advance(),
    renderSidebar() {}, renderLesson: () => renders++ });
  vm.runInContext(source('window.markCompleteAndNext = async (triggerButton) => {',
    'function renderCourseTabs(activeSlug) {'), ctx);
  const pending = ctx.window.markCompleteAndNext();
  // Navigate away and back while saving.
  ctx.window.__quizNavigationEpoch += 2;
  finishWrite(true);
  await pending;
  assert.equal(state.lessonId, 'grammar1');
  assert.equal(renders, 0);
  assert.equal(writes, 1);
  state.lessonId = 'conv1';
  const conversationWrite = ctx.window.markCompleteAndNext();
  finishWrite(true);
  await conversationWrite;
  assert.equal(writes, 2, 'the Percakapan lesson is completed on the server like any lesson');
});
