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
  const module = { id: 'bab3', num: '03', title: 'Perkenalan Diri', lessons: [
    lesson('intro'), lesson('vocab', 'deck'), lesson('kanji', 'kanji'),
    grammar('grammar1'), lesson('task1', 'grammar_task', { popupAfterLessonId: 'grammar1-api' }),
    grammar('grammar2'), lesson('task2', 'grammar_task', { popupAfterLessonId: 'grammar2-api' }),
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

test('two grammar lessons each have their own conversation before their own Bunpou task', () => {
  const { module } = fixture();
  const before = JSON.stringify(module);
  const ctx = helpers();
  const steps = ctx.moduleLearningSteps(module);
  assert.deepEqual(plain(steps.map(step => [step.kind, step.lesson.id])), [
    ['lesson', 'intro'], ['lesson', 'vocab'], ['lesson', 'kanji'],
    ['lesson', 'grammar1'], ['conversation', 'grammar1'], ['lesson', 'task1'],
    ['lesson', 'grammar2'], ['conversation', 'grammar2'], ['lesson', 'task2'],
    ['lesson', 'quiz'],
  ]);
  assert.equal(JSON.stringify(module), before, 'display steps must not mutate stored lessons');
  assert.equal(module.lessons.length, 8, 'conversations must not become completion-bearing lessons');
  assert.equal(steps[4].lesson, module.lessons[3], 'same source and question ownership');
});

test('lessons without an authored dialogue have no empty conversation stage', () => {
  const ctx = helpers();
  const module = { id: 'kana', lessons: [
    { id: 'kana1', type: 'kana' },
    { id: 'empty', type: 'video', grammar: [{ example_dialog: '  ' }] },
    { id: 'task', type: 'grammar_task', grammar: [{ example_dialog: 'A: hi' }] },
    { id: 'quiz', type: 'quiz' },
  ] };
  assert.deepEqual(plain(ctx.moduleLearningSteps(module).map(step => step.kind)),
    ['lesson', 'lesson', 'lesson', 'lesson']);
});

test('conversation source is preserved when flattening multiple modules', () => {
  const { course } = fixture();
  course.modules.push({ id: 'bab4', lessons: [{ id: 'intro4', apiId: 'intro4-api', type: 'video' }] });
  const ctx = helpers();
  const steps = ctx.courseLearningSteps(course);
  assert.equal(steps.filter(step => step.kind === 'conversation').length, 2);
  assert.equal(steps.at(-1).lesson.id, 'intro4');
});

test('unique linked tasks follow their source, while ambiguous and foreign links keep configured order', () => {
  const { module } = fixture();
  const [intro, vocab, kanji, g1, t1, g2, t2, quiz] = module.lessons;
  module.lessons = [intro, vocab, kanji, g1, g2, quiz, t2, t1];
  const ctx = helpers();
  assert.deepEqual(plain(ctx.moduleLearningSteps(module).map(step => `${step.kind}:${step.lesson.id}`)), [
    'lesson:intro', 'lesson:vocab', 'lesson:kanji', 'lesson:grammar1', 'conversation:grammar1',
    'lesson:task1', 'lesson:grammar2', 'conversation:grammar2', 'lesson:task2', 'lesson:quiz',
  ]);
  t2.popupAfterLessonId = t1.popupAfterLessonId;
  assert.deepEqual(plain(ctx.moduleLearningSteps(module).filter(step => step.kind === 'lesson').map(step => step.lesson.id)),
    module.lessons.map(lesson => lesson.id));
  t1.popupAfterLessonId = 'other-module-api';
  t2.popupAfterLessonId = 'missing-api';
  assert.deepEqual(plain(ctx.moduleLearningSteps(module).filter(step => step.kind === 'lesson').map(step => step.lesson.id)),
    module.lessons.map(lesson => lesson.id));
});

test('conversation footer navigates to its own Bunpou and back to grammar without a completion write', () => {
  const { module, course } = fixture();
  const root = { innerHTML: '' };
  const mounts = [], selected = [];
  const ctx = helpers({ document: { getElementById: () => root },
    window: { EzDialogueQuestions: { mount: value => mounts.push(value) },
      selectLesson: (...args) => selected.push(args) },
    grammarKaraokeHtml: dialog => `<div class="karaoke">${esc(dialog)}</div>` });
  vm.runInContext(source('function renderLessonConversation(', '// ── Dialog player'), ctx);
  const steps = ctx.courseLearningSteps(course);
  for (const index of [4, 7]) {
    ctx.renderLessonConversation(course, module, steps[index].lesson,
      { prev: steps[index - 1], next: steps[index + 1] });
    assert.match(root.innerHTML, new RegExp(`selectLesson\\('bab3','${steps[index - 1].lesson.id}'\\)`));
    assert.match(root.innerHTML, new RegExp(`selectLesson\\('bab3','${steps[index + 1].lesson.id}'\\)`));
    assert.match(root.innerHTML, /Lanjut ke Tugas Bunpou/);
    assert.doesNotMatch(root.innerHTML, /markCompleteAndNext|gtOpenTaskPopup/);
    assert.equal(mounts.at(-1).lesson, steps[index].lesson);
    mounts.at(-1).openLegacyTask();
    assert.deepEqual(selected.at(-1), ['bab3', steps[index + 1].lesson.id]);
  }
});

test('conversation deep link uses source IDs and ordinary lesson navigation clears its view', () => {
  const urls = [];
  const history = { replaceState: (_state, _title, url) => urls.push(url) };
  const state = { course: 'n5', moduleId: 'bab3', lessonId: 'grammar1', view: 'conversation' };
  const ctx = helpers({ currentState: state, URLSearchParams, history, window: { history } });
  ctx.syncLearningUrl();
  assert.equal(urls.at(-1), 'welcome.html?course=n5&module=bab3&lesson=grammar1&view=conversation');
  state.lessonId = 'task1'; state.view = 'lesson';
  ctx.syncLearningUrl();
  assert.equal(urls.at(-1), 'welcome.html?course=n5&module=bab3&lesson=task1');
  state.view = 'intro';
  ctx.syncLearningUrl();
  assert.equal(urls.at(-1), 'welcome.html?course=n5&module=bab3&view=intro');
});

test('late completion cannot advance a reopened source view or write completion from conversation', async () => {
  const { module, course } = fixture();
  const progress = { n5: {} };
  let finishWrite, writes = 0, renders = 0;
  const state = { course: 'n5', moduleId: 'bab3', lessonId: 'grammar1', view: 'lesson' };
  const ctx = helpers({ currentState: state, COURSE_CONTENT: { n5: course },
    window: { __quizNavigationEpoch: 1, scrollTo() {} },
    getProgress: () => progress, setProgress() {}, addXP() {},
    findLesson: () => module.lessons[3],
    syncLessonCompletionToServer: () => { writes++; return new Promise(resolve => { finishWrite = resolve; }); },
    finishLearningMilestone: (_course, _module, _completed, advance) => advance(),
    renderSidebar() {}, renderLesson: () => renders++ });
  vm.runInContext(source('window.markCompleteAndNext = async (triggerButton) => {',
    'function renderCourseTabs(activeSlug) {'), ctx);
  const pending = ctx.window.markCompleteAndNext();
  // Conversation and grammar share source IDs. Navigate away and back while saving.
  ctx.window.__quizNavigationEpoch += 2;
  finishWrite(true);
  await pending;
  assert.equal(state.view, 'lesson');
  assert.equal(renders, 0);
  assert.equal(writes, 1);
  state.view = 'conversation';
  await ctx.window.markCompleteAndNext();
  assert.equal(writes, 1, 'conversation never writes another completion');
});
