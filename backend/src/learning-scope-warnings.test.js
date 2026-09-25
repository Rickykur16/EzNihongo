import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLearningScopeWarnings } from './learning-scope-warnings.js';

const scope = { course_id: 'n5', module_sort: 4, module_title: 'Benda di Sekitar' };
const kanjiRows = [
  { character: '本', module_sort: 4, module_title: 'Benda di Sekitar' },
  { character: '駅', module_sort: 9, module_title: 'Bepergian' },
];
const vocabularyRows = [
  { japanese: 'ほん', reading: 'ほん', module_sort: 4, module_title: 'Benda di Sekitar' },
  { japanese: '電車', reading: 'でんしゃ', module_sort: 9, module_title: 'Bepergian' },
];

test('learning scope accepts material introduced in the current chapter', () => {
  assert.deepEqual(buildLearningScopeWarnings({
    scope, fields: ['これは 本です。ほんです。'], kanjiRows, vocabularyRows,
  }), []);
});

test('learning scope warns about future and unregistered kanji', () => {
  const warnings = buildLearningScopeWarnings({
    scope, fields: ['駅で新聞を読みます。'], kanjiRows, vocabularyRows,
  });
  assert.deepEqual(warnings.map((warning) => warning.code), ['future_kanji', 'unregistered_kanji']);
  assert.match(warnings[0].message, /駅.*Bab 9/);
  assert.match(warnings[1].message, /新.*聞.*読/);
});

test('learning scope checks future vocabulary in Japanese and kana readings', () => {
  const warnings = buildLearningScopeWarnings({
    scope, fields: ['でんしゃは どこですか。'], kanjiRows, vocabularyRows,
  });
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].code, 'future_vocabulary');
  assert.match(warnings[0].message, /電車.*Bab 9/);
});

test('N5 Bab 1 and 2 decoding assessments may use unfamiliar carrier words', () => {
  const warnings = buildLearningScopeWarnings({
    scope: {
      ...scope,
      course_slug: 'n5',
      lesson_slug: 'assignment-bab-1-hiragana',
      module_sort: 1,
    },
    fields: ['でんしゃを よみます。'],
    kanjiRows,
    vocabularyRows,
  });
  assert.deepEqual(warnings, []);
});

test('learning scope warns when linked grammar belongs to a later chapter', () => {
  const warnings = buildLearningScopeWarnings({
    scope, fields: ['これは ほんです。'], kanjiRows, vocabularyRows,
    linkedGrammar: { course_id: 'n5', module_sort: 8, module_title: 'Lokasi' },
  });
  assert.equal(warnings.at(-1).code, 'future_grammar');
  assert.match(warnings.at(-1).message, /Bab 8/);
});
