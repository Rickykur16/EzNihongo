import test from 'node:test';
import assert from 'node:assert/strict';
import { assertGenerationSourceUnchanged, deckReadingSourceFingerprint,
  distractorSourceFingerprint } from './curriculum-generation-source.js';

test('deck reading source fingerprint rejects a changed sentence or filled reading', () => {
  const before = { id: 'e1', vocabulary_id: 'v1', japanese: '学校です。', reading: null };
  const captured = deckReadingSourceFingerprint(before);
  assert.equal(captured, deckReadingSourceFingerprint({ ...before }));
  for (const changed of [{ ...before, japanese: '大学です。' },
    { ...before, reading: 'がっこうです。' }, { ...before, vocabulary_id: 'v2' }]) {
    assert.throws(() => assertGenerationSourceUnchanged(captured, deckReadingSourceFingerprint(changed)),
      error => error.status === 409 && error.message === 'source_changed_since_generation');
  }
});

test('distractor fingerprint covers model prompt, examples, siblings and output slots', () => {
  const item = { id: 'g1', module_id: 'm1', pattern: '〜です', meaning: 'adalah',
    recognition_distractors: null, controlled_distractors: null,
    examples: [{ japanese: '学校です。', highlight: 'です', indonesian: 'Sekolah.' }] };
  const siblings = [{ id: 'g2', pattern: '〜ます', meaning: 'bentuk sopan' }];
  const before = distractorSourceFingerprint(item, siblings);
  assert.equal(before, distractorSourceFingerprint({ ...item, examples: [...item.examples] }, [...siblings]));
  for (const current of [
    distractorSourceFingerprint({ ...item, meaning: 'ialah' }, siblings),
    distractorSourceFingerprint({ ...item, examples: [{ ...item.examples[0], japanese: '家です。' }] }, siblings),
    distractorSourceFingerprint(item, [{ ...siblings[0], meaning: 'bentuk negatif' }]),
    distractorSourceFingerprint({ ...item, controlled_distractors: 'sudah diedit' }, siblings),
  ]) assert.throws(() => assertGenerationSourceUnchanged(before, current), { status: 409 });
});
