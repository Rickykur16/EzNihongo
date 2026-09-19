import test from 'node:test';
import assert from 'node:assert/strict';
import { contentRevisionId, companionIsCurrent, sessionRevisionId, publicSessionItem } from './bunpou-flow-service.js';

const source = { id: 'g', pattern: 'p', meaning: 'm', example: 'e', example_dialog: 'dialog',
  example_dialog_id: 'translation', instruction: 'instruction', requiredCount: 2,
  examples: [{ japanese: 'example', highlight: 'part', indonesian: 'meaning' }] };

test('all reviewed question, dialogue and production sources invalidate the publication', () => {
  const old = contentRevisionId([source], []);
  for (const field of ['pattern','meaning','example','example_dialog','example_dialog_id','instruction','requiredCount']) {
    const changed = contentRevisionId([{ ...source, [field]: 'changed' }], []);
    assert.notEqual(changed, old, field);
    assert.equal(companionIsCurrent({ sourceFingerprint: old }, changed), false);
  }
  assert.equal(companionIsCurrent({}, old), false, 'old unversioned publications require review');
  assert.equal(companionIsCurrent({ sourceFingerprint: old }, old), true);
});

test('publication-only changes start a different session revision', () => {
  const sourceRevision = contentRevisionId([source], []);
  const before = { sourceFingerprint: sourceRevision, overlays: { g: { step1: { hint: 'old' } } } };
  const after = { ...before, overlays: { g: { step1: { hint: 'new' } } } };
  assert.notEqual(sessionRevisionId(sourceRevision, before), sessionRevisionId(sourceRevision, after));
});

test('public state restores revealed completion without disclosing keys before eligibility', () => {
  const row = { item_id: 'i', grammar_id: 'g', step: 1, wrong_count: 1,
    snapshot: { correctIndex: 1, options: ['a','b'], overlayHint: '<hint>', overlayExplanation: '<explanation>' } };
  const hidden = publicSessionItem(row);
  assert.equal(hidden.completed, false);
  assert.equal(hidden.hintAvailable, true);
  assert.equal('correctIndex' in hidden, false);
  assert.equal('explanation' in hidden, false);
  const revealed = publicSessionItem({ ...row, revealed_at: new Date(), wrong_count: 2 });
  assert.equal(revealed.completed, true);
  assert.equal(revealed.revealed, true);
  assert.equal(revealed.passed, false);
  assert.equal(revealed.correctIndex, 1);
  assert.equal(revealed.hintAvailable, false);
});
