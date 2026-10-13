import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../../welcome.html', import.meta.url), 'utf8');
const start = html.indexOf('function getModuleIntroPlan(');
const end = html.indexOf('function renderModuleIntro(', start);
assert.ok(start > 0 && end > start, 'module intro plan helper markers not found');
const sequenceStart = html.indexOf('function lessonDialogues(');
const sequenceEnd = html.indexOf('// ── End learning sequence', sequenceStart);
assert.ok(sequenceStart > 0 && sequenceEnd > sequenceStart, 'learning sequence helper markers not found');
const learningSequence = html.slice(sequenceStart, sequenceEnd);

function setup() {
  const context = vm.createContext({
    visibleLessons: (module) => (module.lessons || []).filter((lesson) => !lesson.hidden),
  });
  vm.runInContext(learningSequence + html.slice(start, end), context);
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
  vm.runInContext(learningSequence + html.slice(start, renderEnd), context);
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
  assert.match(output, /<h1>Perkenalan<\/h1>/);
  assert.match(output, /0 dari 2 materi selesai/);
  assert.ok(output.indexOf('module-intro-start') < output.indexOf('module-learning-path-head'));
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
  assert.match(output, /module-intro-placement/);
  assert.match(output, /class="btn-secondary" type="button" onclick="selectLesson\('bab-1','assignment-bab-1-hiragana'\)"/);
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

// ── Ringkasan modul v2 (tahap, isi bab, situasi) ─────────────────────
const chapter = {
  id: 'bab-12',
  num: '12',
  title: 'Te-form',
  scenario: 'Menjelaskan urutan aktivitas sehari-hari (bangun → sarapan → berangkat).',
  lessons: [
    { id: 'kosakata', type: 'deck', title: 'Kosakata', deck: [
      { japanese: '歌う', reading: 'うたう', indonesian: 'bernyanyi' },
      { japanese: '泳ぐ', reading: 'およぐ', indonesian: 'berenang' },
      { japanese: '泳ぐ', reading: 'およぐ', indonesian: 'berenang' },
      { japanese: '', reading: 'x', indonesian: 'rusak' },
    ] },
    { id: 'kanji', type: 'kanji', title: 'Kanji', kanji: [
      { character: '読', meaning_id: 'membaca' }, { character: '書', meaning_id: 'menulis' },
    ] },
    { id: 'tb-1', type: 'video', title: 'Tata Bahasa 1', grammar: [{ id: 'g1', pattern: '〜て、〜', meaning: 'Merangkai kegiatan. Kalimat kedua.' }] },
    { id: 'tugas-1', type: 'grammar_task', title: 'Tugas 1' },
    { id: 'tb-2', type: 'video', title: 'Tata Bahasa 2', grammar: [{ id: 'g2', pattern: '〜てから', meaning: 'Setelah melakukan.' }] },
    { id: 'tugas-2', type: 'grammar_task', title: 'Tugas 2' },
    { id: 'assignment', type: 'quiz', title: 'Assignment Bab 12' },
  ],
};

test('stages stay in learning order and merge when grammar and practice alternate', () => {
  const context = setupRenderer();
  const steps = context.moduleLearningSteps(chapter);
  const labels = JSON.parse(JSON.stringify(context.moduleIntroPhases(steps).map((phase) => phase.label)));
  assert.deepEqual(labels, ['Kenali', 'Pelajari & latih', 'Uji']);

  const tidy = { ...chapter, lessons: chapter.lessons.filter((l) => !['tb-2', 'tugas-1'].includes(l.id)) };
  const tidyPhases = context.moduleIntroPhases(context.moduleLearningSteps(tidy));
  assert.deepEqual(JSON.parse(JSON.stringify(tidyPhases.map((phase) => phase.label))), ['Kenali', 'Pahami', 'Latih', 'Uji']);
  assert.deepEqual(JSON.parse(JSON.stringify(tidyPhases.flatMap((phase) => phase.items.map(({ step }) => step.lesson.id)))),
    tidy.lessons.map((lesson) => lesson.id));
});

test('summary shows what the chapter teaches and opens the matching lesson', () => {
  const output = setupRenderer({ 'bab-12:kosakata': true }).renderModuleIntro(chapter);
  assert.match(output, /Yang kamu pelajari di bab ini/);
  assert.match(output, /module-learn-num">2<\/span>\s*<span class="module-learn-kind">Kosakata/);
  assert.match(output, /module-learn-num">2<\/span>\s*<span class="module-learn-kind">Kanji/);
  assert.match(output, /module-learn-num">2<\/span>\s*<span class="module-learn-kind">Pola/);
  assert.match(output, /onclick="selectLesson\('bab-12','kosakata'\)"[^>]*aria-label="2 kosakata/);
  assert.match(output, /onclick="selectLesson\('bab-12','tb-1'\)"[^>]*aria-label="2 pola tata bahasa/);
  assert.match(output, /〜て、〜<\/span><span class="d">Merangkai kegiatan\.<\/span>/);
  assert.doesNotMatch(output, /Kalimat kedua/);
  assert.match(output, /Pelajari &amp; latih/);
  assert.match(output, /module-path-item\s+exam/);
});

test('practice counts come from drill attempts and stay hidden without them', () => {
  const context = setupRenderer();
  let output = context.renderModuleIntro(chapter);
  assert.doesNotMatch(output, /sudah dilatih/);
  assert.match(output, /Buka kosakata →/);

  context._deckReadMastery = () => ({ items: {} });
  context._deckSummary = (item) => ({ attempts: item.japanese === '歌う' ? 2 : 0 });
  output = context.renderModuleIntro(chapter);
  assert.match(output, /<b>1<\/b>\/2 kata sudah dilatih/);
});

test('scenario steps become a flow and the ring animates once per module', () => {
  const context = setupRenderer({ 'bab-12:kosakata': true });
  const first = context.renderModuleIntro(chapter);
  assert.match(first, /<p class="scenario-box">Menjelaskan urutan aktivitas sehari-hari\.<\/p>/);
  assert.match(first, /<span>bangun<\/span><em aria-hidden="true">→<\/em><span>sarapan<\/span>/);
  assert.match(first, /<div class="module-intro ">/);
  assert.match(context.renderModuleIntro(chapter), /<div class="module-intro no-anim">/);
});

test('summary does not show lesson or module durations', () => {
  const timed = {
    ...chapter,
    totalMinutes: 109,
    lessons: chapter.lessons.map((lesson) => ({ ...lesson, durationMinutes: 15 })),
  };
  const output = setupRenderer({ 'bab-12:kosakata': true }).renderModuleIntro(timed);
  assert.doesNotMatch(output, /menit/);
  assert.match(output, /Materi 2 dari 7 · Kanji · 2 kanji</);
});

test('N5 summary hides CEFR and topic and uses the N5 grammar labels', () => {
  const context = setupRenderer({ 'bab-12:kosakata': true });
  const module = { ...chapter, cefrLevel: 'A1-A2', jfTopic: 'Interaction' };
  assert.match(context.renderModuleIntro(module), /CEFR A1-A2[\s\S]*Topik: Interaction/);

  context.EzN5Copy = {
    pattern: (value) => `N5 ${value}`,
    meaning: (value) => `Arti ${value}`,
  };
  const output = context.renderModuleIntro(module);
  assert.doesNotMatch(output, /CEFR|Topik:/);
  assert.match(output, /<span class="p" lang="ja">N5 〜て、〜<\/span><span class="d">Arti Merangkai kegiatan\.<\/span>/);
});
