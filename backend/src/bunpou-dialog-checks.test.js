import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveDialogChecks } from './bunpou-dialog-checks.js';
import { sanitizeCompanionEnvelope } from './bunpou-flow-service.js';

const legacy = {
  g1: {
    comprehension: { prompt: 'Siapa yang bicara?', options: ['A', 'B', 'C'], correctIndex: 0 },
    comparison: { prompt: 'Pilih kalimat', options: ['x', 'y', 'z'], correctIndex: 1 },
  },
  g2: {
    comprehension: { prompt: 'Lama 2', options: ['A', 'B', 'C'], correctIndex: 2 },
    comparison: { prompt: 'Lama 2b', options: ['x', 'y', 'z'], correctIndex: 0 },
  },
};
const fromSet = {
  comprehension: { prompt: 'Baru', options: ['1', '2', '3'], correctIndex: 1, explanation: 'e' },
  comparison: { prompt: 'Transfer baru', options: ['4', '5', '6'], correctIndex: 2, explanation: 'f' },
};

test('without any question set the legacy checks are used unchanged', () => {
  const result = effectiveDialogChecks(['g1', 'g2', 'g3'], new Map(), legacy);
  assert.deepEqual(result.checks, { g1: legacy.g1, g2: legacy.g2 });
  assert.deepEqual(result.sources, { g1: 'legacy', g2: 'legacy', g3: 'none' });
  assert.equal(result.usesQuestionSet, false);
});

test('a complete question set replaces the legacy checks for that pattern only', () => {
  const sets = new Map([['g1', { activeCount: 2, currentCount: 2, ...fromSet }]]);
  const result = effectiveDialogChecks(['g1', 'g2'], sets, legacy);
  assert.deepEqual(result.checks.g1, fromSet);
  assert.equal(result.checks.g2, legacy.g2);
  assert.deepEqual(result.sources, { g1: 'dialog', g2: 'legacy' });
  assert.equal(result.usesQuestionSet, true);
});

test('an incomplete or stale question set never falls back to the legacy checks', () => {
  for (const set of [
    { activeCount: 1, currentCount: 1, comprehension: fromSet.comprehension },
    { activeCount: 1, currentCount: 1, comparison: fromSet.comparison },
    { activeCount: 2, currentCount: 0 },
  ]) {
    const result = effectiveDialogChecks(['g1'], new Map([['g1', set]]), legacy);
    assert.deepEqual(result.checks, {}, 'old questions may not match the current dialogue');
    assert.deepEqual(result.sources, { g1: 'dialog_incomplete' });
    assert.equal(result.usesQuestionSet, true);
  }
});

test('patterns outside the task scope are ignored and missing legacy data is tolerated', () => {
  assert.deepEqual(effectiveDialogChecks(['g9'], new Map(), null).sources, { g9: 'none' });
  assert.deepEqual(effectiveDialogChecks([], new Map(), legacy).checks, {});
});

test('saving a companion keeps valid dialogue evidence instead of silently dropping it', () => {
  const evidence = [{ turnIndex: 2, quote: 'ハディです' }];
  const out = sanitizeCompanionEnvelope({ dialogChecks: { g1: {
    comprehension: { ...legacy.g1.comprehension, explanation: 'Karena ...', evidence },
    comparison: { ...legacy.g1.comparison, evidence: [{ turnIndex: -1, quote: 'x' }] },
  } } });
  assert.deepEqual(out.dialogChecks.g1.comprehension.evidence, evidence);
  assert.equal(out.dialogChecks.g1.comprehension.explanation, 'Karena ...');
  assert.equal('evidence' in out.dialogChecks.g1.comparison, false, 'malformed evidence is dropped, not the question');
  assert.equal(out.dialogChecks.g1.comparison.prompt, legacy.g1.comparison.prompt);
  for (const bad of [[], [{ turnIndex: 0, quote: '' }], [{ turnIndex: 1.5, quote: 'x' }], 'x',
    Array.from({ length: 7 }, () => ({ turnIndex: 0, quote: 'x' }))]) {
    const cleaned = sanitizeCompanionEnvelope({ dialogChecks: { g1: {
      comprehension: { ...legacy.g1.comprehension, evidence: bad } } } });
    assert.equal('evidence' in cleaned.dialogChecks.g1.comprehension, false);
  }
});
