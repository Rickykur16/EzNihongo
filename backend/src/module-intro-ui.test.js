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

function setupRenderer(progress = {}) {
  const renderEnd = html.indexOf('function renderLessonVocab(', start);
  assert.ok(renderEnd > end, 'module intro renderer marker not found');
  const context = vm.createContext({
    visibleLessons: (module) => (module.lessons || []).filter((lesson) => !lesson.hidden),
    getProgress: () => ({ n5: progress }),
    currentState: { course: 'n5' },
    escapeHtml: (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]),
    formatDurationLong: (minutes) => `${minutes} menit`,
  });
  vm.runInContext(html.slice(start, renderEnd), context);
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

test('approved intro renders a plain syllabus without the rejected dashboard panels', () => {
  const context = setupRenderer();
  const output = context.renderModuleIntro({
    ...moduleData,
    num: '01',
    title: 'Perkenalan',
    description: 'Siapkan percakapan pertamamu.',
    candoStatements: ['Memperkenalkan diri.'],
    scenario: 'Bertemu teman baru di kelas.',
  });
  assert.match(output, /module-intro-brief/);
  assert.match(output, /Alur modul/);
  assert.match(output, /Mulai di sini/);
  assert.match(output, /module-intro-start/);
  assert.doesNotMatch(output, /module-intro-progress|module-intro-layout|pill/);
});

test('approved intro points a returning student to the first unfinished lesson', () => {
  const context = setupRenderer({ 'bab-1:a': true });
  const output = context.renderModuleIntro({ ...moduleData, num: '01', title: 'Perkenalan' });
  assert.match(output, /Lanjut di sini/);
  assert.match(output, /Lanjutkan belajar/);
  assert.match(output, /<strong class="module-intro-start-title">[^<]*<\/strong>/);
});

test('kana chapter offers a direct placement test instead of requiring character-by-character review', () => {
  const context = setupRenderer();
  const output = context.renderModuleIntro({
    ...moduleData,
    lessons: [
      { id: 'hiragana-1', type: 'kana', title: 'Hiragana 1' },
      { id: 'assignment-bab-1-hiragana', type: 'quiz', title: 'Tes Membaca Hiragana' },
    ],
  });
  assert.match(output, /Sudah bisa membaca Hiragana/);
  assert.match(output, /Tes kemampuan Hiragana/);
  assert.match(output, /tanpa mengulang karakter satu per satu/);
  assert.match(output, /selectLesson\('bab-1','assignment-bab-1-hiragana'\)/);
});

test('completed kana assessment no longer shows the placement prompt', () => {
  const context = setupRenderer({ 'bab-1:assignment-bab-1-hiragana': true });
  const output = context.renderModuleIntro({
    ...moduleData,
    lessons: [
      { id: 'hiragana-1', type: 'kana', title: 'Hiragana 1' },
      { id: 'assignment-bab-1-hiragana', type: 'quiz', title: 'Tes Membaca Hiragana' },
    ],
  });
  assert.doesNotMatch(output, /Sudah bisa membaca Hiragana/);
});
