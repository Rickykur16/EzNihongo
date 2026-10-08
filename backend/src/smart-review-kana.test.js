import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeReviewQuestion } from './smart-review-service.js';
import { normalizeKanaReading } from './kana-placement.js';

const seed = readFileSync(new URL('../migrations/037_kana.sql', import.meta.url), 'utf8');
const catalog = [...seed.matchAll(/^\('([^']+)','(hiragana|katakana)','([^']+)','([^']+)'/gm)]
  .map((row) => ({ character: row[1], kind: row[2], romaji: row[3] }));
const byKind = (value) => Object.fromEntries(['hiragana', 'katakana'].map((kind) => [kind,
  catalog.filter((item) => item.kind === kind).map(value)]));
const pools = {
  kanaCharactersByKind: byKind((item) => item.character),
  kanaRomajiByKind: byKind((item) => item.romaji),
  kanaReadingsByKind: Object.fromEntries(Object.entries(byKind((item) => [item.character, item.romaji]))
    .map(([kind, entries]) => [kind, Object.fromEntries(entries)])),
};

test('seeded kana reverse reviews have exactly one valid answer across scripts and homophones', () => {
  for (const character of ['じ', 'ぢ', 'ず', 'づ', 'ジ', 'ヂ', 'ズ', 'ヅ']) {
    const item = catalog.find((row) => row.character === character);
    assert.ok(item, character);
    for (let suffix = 0; suffix < 40; suffix += 1) {
      const question = makeReviewQuestion({ category: 'kana', itemId: `fixture-${suffix}`, skill: 'r2k', item }, pools);
      assert.equal(question.options[question.correctIndex], character);
      assert.ok(question.options.length >= 2);
      assert.ok(question.options.every((option) => Object.hasOwn(pools.kanaReadingsByKind[item.kind], option)));
      const correctReadings = question.options.filter((option) => normalizeKanaReading(pools.kanaReadingsByKind[item.kind][option]) === normalizeKanaReading(item.romaji));
      assert.deepEqual(correctReadings, [character], `${character}: ${question.options}`);
    }
  }
});

test('kana distractors use the catalog mapping even if character and reading pool orders differ', () => {
  const question = makeReviewQuestion({ category: 'kana', itemId: 'ji', skill: 'r2k',
    item: { character: 'じ', romaji: 'ji', kind: 'hiragana' } }, {
    kanaCharactersByKind: { hiragana: ['ぢ', 'か', 'じ'] },
    kanaRomajiByKind: { hiragana: ['ka', 'ji'] },
    kanaReadingsByKind: { hiragana: { 'ぢ': 'zi', 'か': 'ka', 'じ': 'ji' } },
  });
  assert.deepEqual(new Set(question.options), new Set(['じ', 'か']));
});

test('an equivalent-only pool stays below the session minimum instead of inventing a wrong answer', () => {
  const question = makeReviewQuestion({ category: 'kana', itemId: 'ji', skill: 'r2k',
    item: { character: 'じ', romaji: 'ji', kind: 'hiragana' } }, {
    kanaCharactersByKind: { hiragana: ['ぢ', 'じ'] },
    kanaReadingsByKind: { hiragana: { 'ぢ': 'ji', 'じ': 'ji' } },
  });
  assert.deepEqual(question.options, ['じ']);
  assert.equal(question.correctIndex, 0);
});

test('kana forward choices omit equivalent romanizations such as shi and si', () => {
  const question = makeReviewQuestion({ category: 'kana', itemId: 'shi', skill: 'k2r',
    item: { character: 'し', romaji: 'shi', kind: 'hiragana' } }, {
    kanaRomajiByKind: { hiragana: ['shi', 'si', 'ka'] },
  });
  assert.deepEqual(new Set(question.options), new Set(['shi', 'ka']));
});
