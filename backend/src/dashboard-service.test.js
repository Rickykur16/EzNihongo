import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { continueLearningDto, isVisibleCurriculumLesson, masteryDisplay,
  projectDashboardLearningSteps, structuralProgressAndNext, weeklyInsight } from './dashboard-rules.js';

const dashboardScript = await readFile(new URL('../../dashboard.js', import.meta.url), 'utf8');
const welcomeScript = await readFile(new URL('../../welcome.html', import.meta.url), 'utf8');
function actualDashboardUrl(data) {
  const start = dashboardScript.indexOf('  function learnUrl(data) {');
  const end = dashboardScript.indexOf('  const reviewUrl', start);
  assert.ok(start >= 0 && end > start, 'exercise shipped Dashboard URL function');
  return vm.runInNewContext(`${dashboardScript.slice(start, end)}\nlearnUrl(data)`,
    { data, URLSearchParams });
}

test('dashboard mastery never turns missing evidence into 0 percent', () => {
  assert.deepEqual(masteryDisplay({ attempts: 0, correct: 0 }), { label: 'Belum cukup latihan', percentage: null, attempts: 0 });
  assert.equal(masteryDisplay({ attempts: 3, correct: 1 }).label, 'Perlu diperkuat');
  assert.equal(masteryDisplay({ attempts: 5, correct: 4 }).label, 'Baik');
  assert.equal(masteryDisplay({ attempts: 10, correct: 9 }).label, 'Sangat baik');
});

test('weekly insight prioritizes due review and uses deterministic neutral fallbacks', () => {
  assert.equal(weeklyInsight({ reviewDue: 4, activeDays: 2 }).kind, 'due_review');
  assert.equal(weeklyInsight({ reviewDue: 0, activeDays: 0 }).kind, 'low_activity');
  assert.equal(weeklyInsight({ reviewDue: 0, activeDays: 3, attempts: 8, accuracy: 90 }).kind, 'steady_progress');
});

test('Continue Learning uses structural completion order, not mastery', () => {
  const result = structuralProgressAndNext([{ id: 'one', completed: true }, { id: 'two', completed: false }, { id: 'three', completed: false }]);
  assert.equal(result.percentage, 33);
  assert.equal(result.next.id, 'two');
});

test('Dashboard curriculum count matches the visible lesson list', () => {
  const lessons = [
    { id: 'text', type: 'text', completed: true },
    { id: 'standalone-task', type: 'grammar_task', completed: true, popup_after_lesson_id: null },
    { id: 'popup-task', type: 'grammar_task', completed: false, popup_after_lesson_id: 'trigger' },
  ].filter(isVisibleCurriculumLesson);
  const result = structuralProgressAndNext(lessons);
  assert.equal(result.totalLessons, 3);
  assert.equal(result.completedLessons, 2);
  assert.equal(result.percentage, 67);
  assert.equal(result.next.id, 'popup-task', 'pending linked Bunpou must keep Continue Learning available');
});

function row(id, moduleId = 'bab3', extra = {}) {
  return { id, slug: id, title: id, type: 'video', module_id: moduleId,
    module_slug: moduleId, module_title: moduleId, completed: false, has_dialog: false,
    ...extra };
}

test('Dashboard projects each source conversation before its uniquely linked task without counting it', () => {
  const lessons = [
    row('g1', 'bab3', { completed: true, has_dialog: true }),
    row('g2', 'bab3', { has_dialog: true }),
    row('t1', 'bab3', { type: 'grammar_task', popup_after_lesson_id: 'g1' }),
    row('t2', 'bab3', { type: 'grammar_task', popup_after_lesson_id: 'g2' }),
    row('quiz', 'bab3', { type: 'quiz' }),
  ];
  assert.deepEqual(projectDashboardLearningSteps(lessons).map(step =>
    [step.view, step.row.id]), [
    ['lesson', 'g1'], ['conversation', 'g1'], ['lesson', 't1'],
    ['lesson', 'g2'], ['conversation', 'g2'], ['lesson', 't2'], ['lesson', 'quiz'],
  ]);
  const structural = structuralProgressAndNext(lessons);
  assert.equal(structural.totalLessons, 5);
  assert.equal(structural.completedLessons, 1);
  assert.equal(structural.next.id, 'g1');
  assert.equal(structural.nextView, 'conversation');
  const dto = continueLearningDto(structural);
  assert.equal(dto.sourceLessonId, 'g1');
  assert.equal(dto.lesson.slug, 'g1', 'conversation reuses its source lesson');
  assert.equal(actualDashboardUrl({ course: { slug: 'n5' }, continueLearning: dto }),
    'welcome.html?course=n5&module=bab3&lesson=g1&view=conversation');

  lessons[2].completed = true;
  assert.equal(structuralProgressAndNext(lessons).next.id, 'g2');
  lessons[1].completed = true;
  const second = continueLearningDto(structuralProgressAndNext(lessons));
  assert.equal(second.sourceLessonId, 'g2');
  assert.equal(actualDashboardUrl({ course: { slug: 'n5' }, continueLearning: second }),
    'welcome.html?course=n5&module=bab3&lesson=g2&view=conversation');
});

test('Dashboard projection matches the shipped learner sequence for linked tasks', () => {
  const start = welcomeScript.indexOf('// ── Learning sequence');
  const end = welcomeScript.indexOf('// ── End learning sequence', start);
  assert.ok(start >= 0 && end > start);
  const source = welcomeScript.slice(start, end);
  const module = { id: 'bab3', lessons: [
    { id: 'g1', apiId: 'g1', type: 'video', grammar: [{ example_dialog: 'A: はい' }] },
    { id: 'g2', apiId: 'g2', type: 'video', grammar: [{ example_dialog: 'A: いいえ' }] },
    { id: 't1', type: 'grammar_task', popupAfterLessonId: 'g1' },
    { id: 't2', type: 'grammar_task', popupAfterLessonId: 'g2' },
    { id: 'quiz', type: 'quiz' },
  ] };
  const clientSteps = vm.runInNewContext(`${source}\nmoduleLearningSteps(module).map(step => [step.kind, step.lesson.id])`,
    { module, visibleLessons: value => value.lessons, window: {} });
  const serverRows = module.lessons.map(lesson => row(lesson.id, module.id, {
    type: lesson.type, popup_after_lesson_id: lesson.popupAfterLessonId || null,
    has_dialog: !!lesson.grammar?.some(grammar => grammar.example_dialog.trim()),
  }));
  const serverSteps = projectDashboardLearningSteps(serverRows)
    .map(step => [step.view, step.row.id]);
  assert.deepEqual(JSON.parse(JSON.stringify(clientSteps)), serverSteps);
});

test('Dashboard preserves CMS order for ambiguous, dangling, cross-module and dialog-free task links', () => {
  const lessons = [
    row('source', 'a', { has_dialog: true, completed: true }),
    row('unrelated', 'a'),
    row('ambiguous1', 'a', { type: 'grammar_task', popup_after_lesson_id: 'source' }),
    row('ambiguous2', 'a', { type: 'grammar_task', popup_after_lesson_id: 'source' }),
    row('cross', 'b', { type: 'grammar_task', popup_after_lesson_id: 'source' }),
    row('blank', 'b', { has_dialog: false }),
    row('no-dialog-task', 'b', { type: 'grammar_task', popup_after_lesson_id: 'blank' }),
  ];
  assert.deepEqual(projectDashboardLearningSteps(lessons).map(step =>
    [step.view, step.row.id]), [
    ['lesson', 'source'], ['conversation', 'source'], ['lesson', 'unrelated'],
    ['lesson', 'ambiguous1'], ['lesson', 'ambiguous2'], ['lesson', 'cross'],
    ['lesson', 'blank'], ['lesson', 'no-dialog-task'],
  ]);
  lessons[1].completed = true;
  const structural = structuralProgressAndNext(lessons);
  assert.equal(structural.next.id, 'ambiguous1');
  assert.equal(structural.nextView, 'lesson');
  assert.equal(actualDashboardUrl({ course: { slug: 'n5' },
    continueLearning: continueLearningDto(structural) }),
  'welcome.html?course=n5&module=a&lesson=ambiguous1');
});

test('an adjacent unlinked task still follows its source conversation and completion stays real', () => {
  const lessons = [row('grammar', 'm', { has_dialog: true, completed: true }),
    row('task', 'm', { type: 'grammar_task' })];
  const result = structuralProgressAndNext(lessons);
  assert.equal(result.totalLessons, 2);
  assert.equal(result.next.id, 'grammar');
  assert.equal(result.nextView, 'conversation');
  lessons[1].completed = true;
  assert.equal(continueLearningDto(structuralProgressAndNext(lessons)), null);
});
