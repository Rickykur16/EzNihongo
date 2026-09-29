import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const welcome = await readFile(new URL('../../welcome.html', import.meta.url), 'utf8');

test('linked Tugas Bunpou stays in the learner sidebar and navigation', () => {
  const start = welcome.indexOf('function gtIsPopupTask(l) {');
  const end = welcome.indexOf('// Cari lesson (lintas semua modul course ini)', start);
  assert.ok(start > 0 && end > start);

  const context = vm.createContext({});
  vm.runInContext(welcome.slice(start, end), context);
  const lessons = [
    { id: 'grammar', type: 'video' },
    { id: 'task', type: 'grammar_task', popupAfterLessonId: 'grammar-api-id' },
    { id: 'quiz', type: 'quiz' },
  ];

  assert.equal(context.gtIsPopupTask(lessons[1]), true);
  assert.deepEqual(
    Array.from(context.visibleLessons({ lessons }), lesson => lesson.id),
    ['grammar', 'task', 'quiz'],
  );
});

test('finishing grammar opens its Percakapan lesson before the pending task and never auto-opens a popup', async () => {
  const start = welcome.indexOf('window.markCompleteAndNext = async (triggerButton) => {');
  const end = welcome.indexOf('function renderCourseTabs(activeSlug) {', start);
  const sequence = welcome.indexOf('// ── Learning sequence');
  const sequenceEnd = welcome.indexOf('// ── End learning sequence', sequence);
  const progress = { n5: {} };
  const source = { id: 'source', apiId: 'source-api', type: 'video',
    grammar: [{ example_dialog: 'A: こんにちは。' }] };
  const task = { id: 'task', apiId: 'task-api', type: 'grammar_task', popupAfterLessonId: 'source-api' };
  const conversation = { id: 'conv', apiId: 'conv-api', type: 'conversation',
    conversationSourceLessonId: 'source-api' };
  const module = { id: 'bab3', title: 'Bab 3', lessons: [source, task, conversation] };
  const course = { name: 'N5', modules: [module] };
  let completions = 0, writes = 0, xp = 0;
  const context = vm.createContext({
    window: { scrollTo() {} }, COURSE_CONTENT: { n5: course },
    currentState: { course: 'n5', moduleId: 'bab3', lessonId: 'source', view: 'lesson' },
    getProgress: () => progress, setProgress() {}, addXP: () => xp++,
    findLesson: () => source,
    syncLessonCompletionToServer: async value => { assert.equal(value, source); writes++; },
    visibleLessons: item => item.lessons,
    openGrammarTaskPopup: () => assert.fail('must navigate to conversation before task'),
    showCompletion: () => completions++, renderSidebar() {}, renderLesson() {},
  });
  vm.runInContext(welcome.slice(sequence, sequenceEnd), context);
  const milestone = welcome.indexOf('function finishLearningMilestone(course, module, newlyCompleted, onContinue) {');
  const milestoneEnd = welcome.indexOf('window.gtOpenTaskPopup', milestone);
  vm.runInContext(welcome.slice(milestone, milestoneEnd), context);
  vm.runInContext(welcome.slice(start, end), context);
  await context.window.markCompleteAndNext({ disabled: false, setAttribute() {} });
  assert.equal(completions, 0, 'pending real task keeps course incomplete');
  assert.equal(writes, 1); assert.equal(xp, 1);
  assert.equal(progress.n5['bab3:source'], true);
  assert.equal(progress.n5['bab3:task'], undefined);
  assert.equal(context.currentState.lessonId, 'conv', 'the Percakapan comes right after its source');
  assert.equal(context.currentState.view, 'lesson');
});
test('finishing a previously postponed popup from its banner completes the module', () => {
  const start = welcome.indexOf('function finishLearningMilestone(course, module, newlyCompleted, onContinue) {');
  const end = welcome.indexOf('function gtUpdateComplete() {', start);
  assert.ok(start > 0 && end > start);

  const progress = { n5: { 'bab3:source': true } };
  const completions = [];
  let popupDone;
  const source = { id: 'source', apiId: 'source-api', type: 'video' };
  const task = { id: 'task', apiId: 'task-api', type: 'grammar_task', popupAfterLessonId: 'source-api' };
  const module = { id: 'bab3', title: 'Bab 3', lessons: [source, task] };
  const course = { name: 'N5', modules: [module] };
  const context = vm.createContext({
    window: {},
    COURSE_CONTENT: { n5: course },
    currentState: { course: 'n5' },
    getProgress: () => progress,
    visibleLessons: (item) => item.lessons,
    openGrammarTaskPopup: (_course, _module, _task, onDone) => { popupDone = onDone; },
    showCompletion: (value) => completions.push(value),
    addXP() {},
    renderLesson() {},
  });
  vm.runInContext(welcome.slice(start, end), context);

  context.window.gtOpenTaskPopup('bab3', 'task');
  progress.n5['bab3:task'] = true;
  popupDone({ completed: true, wasAlreadyDone: false });

  assert.equal(completions.length, 1);
  assert.match(completions[0].title, /Kelas Selesai/);
});
