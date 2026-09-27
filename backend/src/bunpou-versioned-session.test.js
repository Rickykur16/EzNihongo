import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionRevisionId, questionFingerprint as legacyItemFingerprint,
  publicSessionItem, deriveAssistanceState, independentEligible } from './bunpou-flow-service.js';
import { questionFingerprint as normalizedFingerprint } from './dialogue-question-service.js';
import { chooseSessionFlowVersion, currentSessionRevisionBestEffort, loadCurrentTransferRows,
  planV2SessionItems, versionedItemFingerprint,
  versionedSessionRevision } from './bunpou-versioned-session.js';

const sourceLessonId = 'source-lesson';
const grammarId = 'grammar-1';
const transfer = (overrides = {}) => {
  const row = { id: 'normalized-1', grammar_id: grammarId,
    source_lesson_id: sourceLessonId, kind: 'transfer', state: 'active',
    sort_order: 1, question_version: 'revision-1', prompt: '何を選びますか。',
    options: ['駅へ行く', '家へ行く'], correct_index: 0,
    explanation: '会話では駅に行きます。', evidence: null,
    dialogue_fingerprint: 'dialogue-1', boundary_fingerprint: 'boundary-1',
    source_kind: 'manual', source_key: null, source_fingerprint: null,
    validator_version: 'validator-1', ...overrides };
  row.question_fingerprint = normalizedFingerprint({ kind: row.kind,
    prompt: row.prompt, options: row.options, correctIndex: row.correct_index,
    explanation: row.explanation, evidence: row.evidence });
  return row;
};

test('version selection cannot upgrade an active v1 or enable v2 without server capability', () => {
  const placement = { mode: 'inline', flowVersion: 2 };
  assert.equal(chooseSessionFlowVersion({ existing: { flow_version: 1 },
    placement, runtimeAvailable: true }), 1);
  assert.equal(chooseSessionFlowVersion({ existing: null,
    placement, runtimeAvailable: false }), 1);
  assert.equal(chooseSessionFlowVersion({ existing: null,
    placement: { mode: 'legacy', flowVersion: 2 }, runtimeAvailable: true }), 1);
  assert.equal(chooseSessionFlowVersion({ existing: null,
    placement, runtimeAvailable: true }), 2);
});

test('v1 revision and item fingerprint preserve historical bytes', () => {
  const published = { objective: 'Learn', overlays: {} };
  const expected = '8f014f8efb4ad19f1f690ada010a252794e37387ddf6d49eb9e3272fd51a1dc0';
  assert.equal(sessionRevisionId('source-1', published), expected);
  assert.equal(sessionRevisionId('source-1', published, 1, [transfer()]), expected);
  const drill = { variant: 'choice', prompt: 'Which?', options: ['A', 'B'], correctIndex: 0 };
  assert.equal(versionedItemFingerprint(grammarId, 1, drill, 1),
    legacyItemFingerprint(grammarId, 1, drill));
});

test('unchanged v2 step 1/2 retain v1 exposure ledger identity', () => {
  for (const step of [1, 2]) {
    const drill = { variant: 'choice', prompt: 'Choose', options: ['A', 'B'],
      correctIndex: 0 };
    const historic = versionedItemFingerprint(grammarId, step, drill, 1);
    const current = versionedItemFingerprint(grammarId, step, drill, 2);
    assert.equal(current, historic, `step ${step} must match the historic taint query key`);
    const priorRows = [{ question_fingerprint: historic, revealed_at: new Date(), passed: false }];
    const matchingExposure = priorRows.some(row => row.question_fingerprint === current &&
      (row.revealed_at || row.passed));
    const assistance = deriveAssistanceState({ hintServedAt: null, revealedAt: null,
      tainted: matchingExposure });
    assert.equal(assistance, 'answer_served');
    assert.equal(independentEligible(assistance), false);
  }
});

test('v2 revision pins question and source provenance, independent of row order', () => {
  const first = transfer();
  const base = versionedSessionRevision('source-1', {}, 2, [first]);
  assert.notEqual(base, sessionRevisionId('source-1', {}));
  for (const patch of [{ question_version: 'revision-2' },
    { dialogue_fingerprint: 'dialogue-2' }, { boundary_fingerprint: 'boundary-2' },
    { source_kind: 'legacy_bunpou' }, { source_key: 'old-slot' },
    { source_fingerprint: 'source-2' }, { validator_version: 'validator-2' },
    { sort_order: 2 }, { kind: 'comprehension' }]) {
    assert.notEqual(versionedSessionRevision('source-1', {}, 2, [{ ...first, ...patch }]),
      base, JSON.stringify(patch));
  }
  const second = transfer({ id: 'normalized-2', grammar_id: 'grammar-2' });
  assert.equal(versionedSessionRevision('source-1', {}, 2, [first, second]),
    versionedSessionRevision('source-1', {}, 2, [second, first]));
  assert.throws(() => sessionRevisionId('source-1', {}, 3), /invalid_flow_version/);
});

test('v2 plans only internal steps 1, 2 and normalized transfer 5; public view strips private key and provenance', () => {
  const row = transfer();
  const drills = new Map([[grammarId, { step1: { variant: 'choice', prompt: 'A', options: ['x','y'], correctIndex: 0 },
    step2: { variant: 'choice', prompt: 'B', options: ['x','y'], correctIndex: 1 },
    step4: { variant: 'choice', prompt: 'Old', options: ['x','y'], correctIndex: 0 } }]]);
  const planned = planV2SessionItems([{ id: grammarId }], drills, [row]);
  assert.deepEqual(planned.map(item => item.step), [1, 2, 5]);
  const snapshot = planned[2].drill;
  assert.equal(snapshot.correctIndex, 0);
  assert.equal(snapshot.normalizedQuestion.id, row.id);
  assert.equal(snapshot.normalizedQuestion.sourceKind, 'manual');
  assert.equal(snapshot.normalizedQuestion.validatorVersion, 'validator-1');
  const publicItem = publicSessionItem({ item_id: 'item-5', grammar_id: grammarId,
    step: 5, snapshot, wrong_count: 0, passed: false });
  const publicJson = JSON.stringify(publicItem);
  assert.equal(publicItem.correctIndex, undefined);
  for (const secret of [row.id, row.question_version, row.question_fingerprint,
    row.dialogue_fingerprint, row.boundary_fingerprint, row.explanation,
    row.source_kind, row.validator_version]) assert.equal(publicJson.includes(secret), false, secret);
  assert.equal(versionedItemFingerprint(grammarId, 5, snapshot, 2),
    legacyItemFingerprint(grammarId, 5, snapshot));
});

test('copied legacy comparison remains tainted as normalized v2 transfer', () => {
  const normalized = planV2SessionItems([{ id: grammarId }], new Map(), [transfer()])[0].drill;
  const legacy = { variant: 'choice', step: 5, prompt: normalized.prompt,
    options: [...normalized.options], correctIndex: normalized.correctIndex,
    checkKind: 'comparison' };
  const oldKey = versionedItemFingerprint(grammarId, 5, legacy, 1);
  const newKey = versionedItemFingerprint(grammarId, 5, normalized, 2);
  assert.equal(newKey, oldKey);
  for (const prior of [{ revealed_at: new Date(), passed: false },
    { revealed_at: null, passed: true }]) {
    const tainted = [{ ...prior, question_fingerprint: oldKey }]
      .some(row => row.question_fingerprint === newKey && (row.revealed_at || row.passed));
    assert.equal(independentEligible(deriveAssistanceState({ hintServedAt: null,
      revealedAt: null, tainted })), false);
  }
});

test('transfer loader rejects wrong source, stale fingerprint, missing and duplicate active rows', async () => {
  let rows = [transfer()];
  const client = { query: async () => ({ rows }) };
  assert.equal((await loadCurrentTransferRows(client, sourceLessonId, [grammarId]))[0].id,
    'normalized-1');
  rows = [transfer({ source_lesson_id: 'other-lesson' })];
  await assert.rejects(loadCurrentTransferRows(client, sourceLessonId, [grammarId]),
    /normalized_transfer_not_current/);
  rows = [{ ...transfer(), question_fingerprint: 'stale' }];
  await assert.rejects(loadCurrentTransferRows(client, sourceLessonId, [grammarId]),
    /normalized_transfer_not_current/);
  rows = [];
  await assert.rejects(loadCurrentTransferRows(client, sourceLessonId, [grammarId]),
    /normalized_transfer_missing/);
  rows = [transfer(), transfer({ id: 'normalized-2' })];
  await assert.rejects(loadCurrentTransferRows(client, sourceLessonId, [grammarId]),
    /normalized_transfer_ambiguous/);
});

test('frozen-session revision diagnostic rolls back failing current reads and resumes from saved snapshot', async () => {
  const sql = [];
  const client = { query: async text => { sql.push(text); return { rows: [] }; } };
  const unavailable = await currentSessionRevisionBestEffort(client, sourceLessonId, 2,
    { loadContext: async () => { throw new Error('relation missing'); } });
  assert.equal(unavailable, null);
  assert.deepEqual(sql, ['SAVEPOINT bunpou_current_revision',
    'ROLLBACK TO SAVEPOINT bunpou_current_revision',
    'RELEASE SAVEPOINT bunpou_current_revision']);
  sql.length = 0;
  const changed = await currentSessionRevisionBestEffort(client, sourceLessonId, 2,
    { loadContext: async () => ({ current: true, fingerprint: 'new-source',
      published: {}, items: [{ id: grammarId }] }),
    loadTransfers: async () => { throw new Error('normalized_transfer_missing'); } });
  assert.equal(changed, null);
  assert.equal(sql[1], 'ROLLBACK TO SAVEPOINT bunpou_current_revision');
  sql.length = 0;
  const current = await currentSessionRevisionBestEffort(client, sourceLessonId, 2,
    { loadContext: async () => ({ current: true, fingerprint: 'source-1',
      published: {}, items: [{ id: grammarId }] }),
    loadTransfers: async () => [transfer()] });
  assert.equal(current, versionedSessionRevision('source-1', {}, 2, [transfer()]));
  assert.equal(sql[1], 'RELEASE SAVEPOINT bunpou_current_revision');
});
