import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKanjiCatalog,
  deriveCompounds,
  deriveKanjiUsages,
  extractKanjiCharacters,
  kanjiUsageKind,
  normalizeKanjiCompounds,
  vocabularyKanjiLevel,
} from './kanji-compounds.js';

test('extracts unique Han characters without kana or punctuation', () => {
  assert.deepEqual(extractKanjiCharacters('日記を日本で書く。'), ['日', '記', '本', '書']);
  assert.deepEqual(extractKanjiCharacters('時々・二〇二四年'), ['時', '二', '四', '年']);
});

test('keeps single, compound, and okurigana forms distinct', () => {
  assert.equal(kanjiUsageKind('食', '食'), 'single');
  assert.equal(kanjiUsageKind('食事', '食'), 'compound');
  assert.equal(kanjiUsageKind('食べる', '食'), 'kanji_kana');
});

test('normalizes complete manual words, validates target, and deduplicates', () => {
  assert.deepEqual(normalizeKanjiCompounds([
    { japanese: ' 食べる ', reading: ' たべる ', indonesian: ' makan ' },
    { japanese: '食べる', reading: 'たべる', indonesian: 'makan' },
    { japanese: '飲む', reading: 'のむ', indonesian: 'minum' },
    { japanese: '食事', reading: '', indonesian: 'makanan' },
  ], '食'), [
    { japanese: '食べる', reading: 'たべる', indonesian: 'makan' },
  ]);
});

test('manual words stay first while same-level vocabulary can come from another Bab', () => {
  const kanjiCatalog = buildKanjiCatalog([
    { id: 'day', character: '日', introduced_level: 'N5' },
    { id: 'book', character: '本', introduced_level: 'N5' },
    { id: 'language', character: '語', introduced_level: 'N4' },
  ]);
  const vocab = [
    { vocabulary_id: 'v1', module_id: 'm1', course_level: 'N4', module_title: 'Bab 1', module_sort: 1, vocab_sort: 1, japanese: '日本', reading: 'にほん', indonesian: 'Jepang' },
    { vocabulary_id: 'v2', module_id: 'm2', course_level: 'N4', module_title: 'Bab 2', module_sort: 2, vocab_sort: 1, japanese: '日本語', reading: 'にほんご', indonesian: 'bahasa Jepang', example_japanese: '日本語を話します。' },
    { vocabulary_id: 'v3', module_id: 'm2', course_level: 'N4', module_title: 'Bab 2', module_sort: 2, vocab_sort: 2, japanese: '日本語', reading: 'にほんご', indonesian: 'duplikat' },
  ];
  const result = deriveCompounds('日', [
    { japanese: '日本語', reading: 'にほんご', indonesian: 'bahasa Jepang' },
  ], vocab, { moduleId: 'm2', moduleSort: 2, courseLevel: 'N4', kanjiCatalog });
  assert.equal(result.length, 2);
  assert.equal(result[0].japanese, '日本語');
  assert.equal(result[0].source, 'manual');
  assert.equal(result[0].scope, 'current');
  assert.equal(result[0].usageLevel, 'N4');
  assert.equal(vocabularyKanjiLevel('日本', kanjiCatalog), 'N5');
  assert.equal(result[0].exampleJapanese, '日本語を話します。');
  assert.equal(result[1].japanese, '日本');
});

test('returns every same-level word without a cap and excludes later JLPT levels', () => {
  const kanjiCatalog = buildKanjiCatalog([
    { id: 'day', character: '日', introduced_level: 'N5' },
    { id: 'book', character: '本', introduced_level: 'N5' },
  ]);
  const vocab = Array.from({ length: 10 }, (_, index) => ({
    vocabulary_id: `v${index + 1}`,
    module_id: 'm5',
    course_level: 'N5',
    module_title: 'Bab 5',
    module_sort: 5,
    vocab_sort: index + 1,
    japanese: `日本${index + 1}`,
    reading: `にほん${index + 1}`,
    indonesian: `kata ${index + 1}`,
  }));
  vocab.push({
    vocabulary_id: 'outside',
    module_id: 'm6',
    course_level: 'N4',
    module_title: 'Bab 6',
    module_sort: 6,
    vocab_sort: 1,
    japanese: '休日',
    reading: 'きゅうじつ',
    indonesian: 'hari libur',
  });

  const result = deriveCompounds('日', [], vocab, {
    moduleId: 'm5',
    moduleSort: 5,
    courseLevel: 'N5',
    kanjiCatalog,
  });

  assert.equal(result.length, 10);
  assert.ok(result.every((item) => item.usageLevel === 'N5'));
  assert.ok(result.every((item) => item.japanese !== '休日'));
});

test('rejects words containing a higher-level or unregistered Kanji even inside an N5 course', () => {
  const kanjiCatalog = buildKanjiCatalog([
    { id: 'language', character: '語', introduced_level: 'N5' },
    { id: 'outside', character: '外', introduced_level: 'N5' },
    { id: 'come', character: '来', introduced_level: 'N5' },
    { id: 'english', character: '英', introduced_level: 'N4' },
  ]);
  const vocab = [
    { vocabulary_id: 'polite', module_id: 'm3', course_level: 'N5', module_title: 'Bab 3', module_sort: 3, vocab_sort: 1, japanese: '丁寧語', reading: 'ていねいご', indonesian: 'bahasa sopan' },
    { vocabulary_id: 'english', module_id: 'm17', course_level: 'N5', module_title: 'Bab 17', module_sort: 17, vocab_sort: 1, japanese: '英語', reading: 'えいご', indonesian: 'Inggris' },
    { vocabulary_id: 'loanword', module_id: 'm3', course_level: 'N5', module_title: 'Bab 3', module_sort: 3, vocab_sort: 2, japanese: '外来語', reading: 'がいらいご', indonesian: 'kata serapan' },
  ];

  const result = deriveCompounds('語', [
    { japanese: '謙譲語', reading: 'けんじょうご', indonesian: 'bahasa merendah' },
  ], vocab, { moduleId: 'm3', moduleSort: 3, courseLevel: 'N5', kanjiCatalog });

  assert.deepEqual(result.map((item) => item.japanese), ['外来語']);
  assert.equal(result[0].usageLevel, 'N5');
});

test('catalog keeps earliest introduction and classifies later-level usage as known', () => {
  const catalog = buildKanjiCatalog([
    { id: 'n4-day', character: '日', introduced_level: 'N4', module_sort: 1 },
    { id: 'n5-day', character: '日', introduced_level: 'N5', module_sort: 3, meaning_id: 'hari' },
    { id: 'n4-diary', character: '記', introduced_level: 'N4', module_sort: 4, meaning_id: 'catat' },
  ]);
  assert.equal(catalog.get('日').id, 'n5-day');
  const usages = deriveKanjiUsages('日記', catalog, { currentLevel: 'N4', currentModuleSort: 2 });
  assert.deepEqual(usages.map((item) => [item.character, item.status]), [
    ['日', 'known'],
    ['記', 'upcoming'],
  ]);
});

test('unregistered Han characters are flagged instead of silently dropped', () => {
  assert.deepEqual(deriveKanjiUsages('猫', new Map(), { currentLevel: 'N5' }), [
    { character: '猫', status: 'unregistered', introducedLevel: '' },
  ]);
});
