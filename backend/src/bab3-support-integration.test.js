import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveCompounds } from './kanji-compounds.js';
import { deriveDrills, publicDrill } from './grammar-drills.js';
import { contentRevisionId } from './bunpou-flow-service.js';

test('all nine Bab 3 kanji have introductory usages and sentence readings', () => {
  const words = new Set();
  for (const character of '先何語校国生学名人') {
    const result = deriveCompounds(character, [], [], { courseLevel: 'N5', moduleSort: 3 });
    assert.ok(result.length > 0 && result.length <= 3);
    for (const word of result) {
      assert.ok(word.japanese.includes(character));
      assert.ok(word.exampleJapanese.includes(word.japanese));
      assert.ok(word.exampleReading && word.exampleIndonesian);
      assert.doesNotMatch(word.exampleReading, /\p{Unified_Ideograph}/u);
      assert.doesNotMatch(word.japanese, /先月|先週|何時|何分|何時間|外来語|入学|人気|一人前/);
      words.add(word.japanese);
    }
  }
  assert.equal(words.size, 14);
  assert.deepEqual(deriveCompounds('何', [], [], { courseLevel: 'N5', moduleSort: 4 }), []);
});

test('Bab 3 authored contextual drills are deterministic, target the right particles and hide answers', () => {
  const content = JSON.parse(readFileSync(new URL('../content/bab3/grammar-support.json', import.meta.url)));
  const items = content.items.map(row => ({ id: row.key, ...row, practiceConfig: row.drills }));
  const first = deriveDrills(items);
  assert.deepEqual(first, deriveDrills(items));
  for (const item of items) {
    for (const [name, config] of [['step1', item.drills.recognition], ['step2', item.drills.controlled]]) {
      const drill = first.get(item.id)[name];
      assert.equal(drill.rule, 'curated-context');
      assert.equal(drill.options[drill.correctIndex], config.answer);
      assert.equal(drill.options.length, config.options.length);
      const safe = publicDrill(drill);
      for (const key of ['correctIndex', 'answer', 'practiceConfig', 'practice_config']) assert.ok(!(key in safe));
    }
  }
  assert.equal(first.get('addition').step2.options[first.get('addition').step2.correctIndex], 'も');
  const changed = structuredClone(items);
  changed[0].practiceConfig.controlled.prompt += ' Konteks baru.';
  assert.notEqual(contentRevisionId(items, items), contentRevisionId(changed, changed));
});

test('invalid contextual questions preserve the existing automatic fallback', () => {
  const base = { id: 'example', pattern: '〜です', meaning: 'Menyatakan identitas.',
    examples: [{ japanese: 'わたしは がくせいです。', highlight: 'です', indonesian: 'Saya pelajar.' }] };
  const invalid = { ...base, practiceConfig: { controlled: {
    prompt: 'Lengkapi.', sentence: 'わたしは がくせい＿＿＿。', indonesian: 'Saya pelajar.',
    options: ['です', 'です', 'ですか'], answer: 'です',
  } } };
  assert.deepEqual(deriveDrills([invalid]).get(base.id), deriveDrills([base]).get(base.id));
});
