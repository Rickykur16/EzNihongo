import test from 'node:test';
import assert from 'node:assert/strict';
import {
  completeKanaPlacementLessons,
  excludePlacedKana,
  gradeKanaPlacement,
  isKanaReadingCorrect,
  kanaAssessmentKind,
  normalizeKanaReading,
  passedKanaKinds,
  sampleKanaPlacementQuestions,
} from './kana-placement.js';

test('only the two N5 kana assignments act as placement assessments', () => {
  assert.equal(kanaAssessmentKind('assignment-bab-1-hiragana'), 'hiragana');
  assert.equal(kanaAssessmentKind('assignment-bab-2-katakana'), 'katakana');
  assert.equal(kanaAssessmentKind('assignment-bab-3-perkenalan'), null);
});

test('passing a kana placement completes matching lessons without touching stats', async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('JOIN lesson_kana_items')) {
        return { rows: [
          { lesson_id: '11111111-1111-4111-8111-111111111111', module_slug: 'bab-1', lesson_slug: 'hiragana-1' },
          { lesson_id: '22222222-2222-4222-8222-222222222222', module_slug: 'bab-1', lesson_slug: 'hiragana-2' },
        ] };
      }
      if (sql.includes('INSERT INTO user_progress')) return { rows: [], rowCount: 2 };
      throw new Error('Unexpected query');
    },
  };

  const completed = await completeKanaPlacementLessons(client, {
    userId: 'user',
    assessmentLessonId: 'assessment',
    assessmentSlug: 'assignment-bab-1-hiragana',
  });

  assert.deepEqual(completed.map((row) => row.lessonSlug), ['hiragana-1', 'hiragana-2']);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].params[1], 'hiragana');
  assert.match(calls[1].sql, /INSERT INTO user_progress/);
  assert.doesNotMatch(calls[1].sql, /user_stats/);
});

test('ordinary quizzes do not query or complete kana lessons', async () => {
  const client = { query: async () => { throw new Error('must not query'); } };
  assert.deepEqual(await completeKanaPlacementLessons(client, {
    userId: 'user', assessmentLessonId: 'lesson', assessmentSlug: 'assignment-bab-3-perkenalan',
  }), []);
});

test('kana placement samples exactly three typed and one choice question per section', () => {
  const rows = [];
  for (let section = 1; section <= 7; section += 1) {
    for (let question = 1; question <= 8; question += 1) {
      rows.push({
        id: `${section}-${question}`,
        section_number: section,
        question_type: question % 4 === 1 ? 'multiple_choice' : 'fill_blank',
      });
    }
  }
  const sampled = sampleKanaPlacementQuestions(rows, 28, () => 0.42);
  const counts = new Map();
  for (const row of sampled) {
    counts.set(row.section_number, (counts.get(row.section_number) || 0) + 1);
  }
  assert.equal(sampled.length, 28);
  assert.deepEqual([...counts.keys()].sort(), [1, 2, 3, 4, 5, 6, 7]);
  assert.ok(Math.max(...counts.values()) - Math.min(...counts.values()) <= 1);
  assert.equal(new Set(sampled.map((row) => row.id)).size, sampled.length);
  for (const section of counts.keys()) {
    const sectionRows = sampled.filter((row) => row.section_number === section);
    assert.equal(sectionRows.filter((row) => row.question_type === 'fill_blank').length, 3);
    assert.equal(sectionRows.filter((row) => row.question_type === 'multiple_choice').length, 1);
  }
});

test('romaji grading accepts common equivalents but preserves long-vowel distinctions', () => {
  assert.equal(normalizeKanaReading(' Shi-TSU '), 'situ');
  assert.equal(isKanaReadingCorrect('syasin', 'shashin'), true);
  assert.equal(isKanaReadingCorrect('s i', 'shi'), true);
  assert.equal(isKanaReadingCorrect('ti', 'chi'), true);
  assert.equal(isKanaReadingCorrect('kōhī', 'koohii'), false);
  assert.equal(isKanaReadingCorrect('kouri', 'koori'), false);
});

test('kana placement requires 85 percent overall and at least three of four in every section', () => {
  const questions = [];
  const answers = new Map();
  for (let section = 1; section <= 7; section += 1) {
    for (let n = 1; n <= 4; n += 1) {
      const id = `${section}-${n}`;
      questions.push({ question_id: id, section_number: section, section_label: `Bagian ${section}` });
      answers.set(id, { correct: !(section === 7 && n > 2) });
    }
  }
  const failedSection = gradeKanaPlacement(questions, answers, 85);
  assert.equal(failedSection.score, 26);
  assert.equal(failedSection.passed, false);
  assert.equal(failedSection.sectionResults.at(-1).passed, false);

  answers.set('7-3', { correct: true });
  const passed = gradeKanaPlacement(questions, answers, 85);
  assert.equal(passed.score, 27);
  assert.equal(passed.passed, true);
  assert.ok(passed.sectionResults.every((section) => section.minimumCorrect === 3));
});

test('passed kana assessments remove only that script from Smart Review', () => {
  const rows = [
    { id: 'h-a', kind: 'hiragana' },
    { id: 'h-ka', kind: 'hiragana' },
    { id: 'k-a', kind: 'katakana' },
  ];
  const hiraganaPassed = passedKanaKinds(['assignment-bab-1-hiragana']);
  assert.deepEqual(excludePlacedKana(rows, hiraganaPassed).map((row) => row.id), ['k-a']);

  const bothPassed = passedKanaKinds([
    'assignment-bab-1-hiragana',
    'assignment-bab-2-katakana',
    'assignment-bab-3-perkenalan',
  ]);
  assert.deepEqual(excludePlacedKana(rows, bothPassed), []);
});
