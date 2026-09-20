import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../../welcome.html', import.meta.url), 'utf8');
const start = html.indexOf('function getModuleIntroPlan(');
const end = html.indexOf('function renderModuleIntro(', start);
assert.ok(start > 0 && end > start, 'module intro plan helper markers not found');

function setup() {
  const context = vm.createContext({
    visibleLessons: (module) => (module.lessons || []).filter((lesson) => !lesson.hidden),
  });
  vm.runInContext(html.slice(start, end), context);
  return context;
}

const moduleData = {
  id: 'bab-1',
  totalMinutes: null,
  lessons: [
    { id: 'a', durationMinutes: 10 },
    { id: 'popup', durationMinutes: 50, hidden: true },
    { id: 'b', durationMinutes: 15 },
  ],
};

test('module intro starts at the first visible lesson without inventing progress', () => {
  const plan = setup().getModuleIntroPlan(moduleData, {});
  assert.equal(plan.lessons.length, 2);
  assert.equal(plan.completed, 0);
  assert.equal(plan.percent, 0);
  assert.equal(plan.totalMinutes, 25);
  assert.equal(plan.nextLesson.id, 'a');
  assert.equal(plan.actionLabel, 'Mulai modul');
});

test('module intro resumes at the first incomplete lesson', () => {
  const plan = setup().getModuleIntroPlan(moduleData, { 'bab-1:a': true });
  assert.equal(plan.completed, 1);
  assert.equal(plan.percent, 50);
  assert.equal(plan.nextLesson.id, 'b');
  assert.equal(plan.actionLabel, 'Lanjutkan belajar');
});

test('completed module offers review while keeping real lesson totals', () => {
  const plan = setup().getModuleIntroPlan(moduleData, {
    'bab-1:a': true,
    'bab-1:b': true,
    'bab-1:popup': true,
  });
  assert.equal(plan.completed, 2);
  assert.equal(plan.percent, 100);
  assert.equal(plan.nextLesson.id, 'a');
  assert.equal(plan.actionLabel, 'Tinjau ulang modul');
});
