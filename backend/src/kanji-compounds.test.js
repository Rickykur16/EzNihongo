import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKanjiCatalog,
  deriveCompounds,
  deriveKanjiUsages,
  extractKanjiCharacters,
  kanjiUsageKind,
  normalizeKanjiCompounds,
} from './kanji-compounds.js';

test('extracts unique Han characters without kana or punctuation', () => {
  assert.deepEqual(extractKanjiCharacters('日記を日本で書く。'), ['日', '記', '本', '書']);
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
  const vocab = [
    { vocabulary_id: 'v1', module_id: 'm1', course_level: 'N4', module_title: 'Bab 1', module_sort: 1, vocab_sort: 1, japanese: '日本', reading: 'にほん', indonesian: 'Jepang' },
    { vocabulary_id: 'v2', module_id: 'm2', course_level: 'N4', module_title: 'Bab 2', module_sort: 2, vocab_sort: 1, japanese: '日本語', reading: 'にほんご', indonesian: 'bahasa Jepang', example_japanese: '日本語を話します。' },
    { vocabulary_id: 'v3', module_id: 'm2', course_level: 'N4', module_title: 'Bab 2', module_sort: 2, vocab_sort: 2, japanese: '日本語', reading: 'にほんご', indonesian: 'duplikat' },
  ];
  const result = deriveCompounds('日', [
    { japanese: '日本語', reading: 'にほんご', indonesian: 'bahasa Jepang' },
  ], vocab, { moduleId: 'm2', moduleSort: 2, courseLevel: 'N4' });
  assert.equal(result.length, 2);
  assert.equal(result[0].japanese, '日本語');
  assert.equal(result[0].source, 'manual');
  assert.equal(result[0].scope, 'current');
  assert.equal(result[0].usageLevel, 'N4');
  assert.equal(result[0].exampleJapanese, '日本語を話します。');
  assert.equal(result[1].japanese, '日本');
});

test('returns every same-level word without a cap and excludes later JLPT levels', () => {
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
  });

  assert.equal(result.length, 10);
  assert.ok(result.every((item) => item.usageLevel === 'N5'));
  assert.ok(result.every((item) => item.japanese !== '休日'));
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
