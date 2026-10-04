import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPracticeAttempt } from './learning-foundations.js';
import { availableReviewCandidates, selectReviewCandidates, summarizeCandidates } from './smart-review-service.js';
import { deriveGrammarReviewAt } from './smart-review-grammar-schedule.js';

const at = new Date('2026-10-05T00:00:00Z');
const after = new Date('2026-10-05T00:00:30Z');
const stateAfter = (current, isCorrect) => {
  const state = applyPracticeAttempt(current, { isCorrect, now: at });
  return { ...state, fsrsState: state.fsrs.state };
};

test('twenty correct vocabulary answers remove twenty subjects from both refreshed summary and next session', () => {
  const rows = Array.from({ length: 25 }, (_, index) => ['audio2id', 'id2jp', 'jp2id'].map(skill => ({
    category: 'vocabulary', itemId: `v-${index}`, skill, state: {},
    item: { japanese: `語${index}`, reading: `ご${index}`, indonesian: `kata ${index}` },
  }))).flat();
  const before = availableReviewCandidates(rows, { now: at });
  assert.equal(summarizeCandidates(before).total, 25);
  const session = selectReviewCandidates(before, { category: 'vocabulary', limit: 20 });
  assert.equal(session.length, 20);
  const answeredIds = new Set(session.map(candidate => candidate.itemId));
  for (const answered of session) {
    rows.find(row => row.itemId === answered.itemId && row.skill === answered.skill).state = stateAfter(null, true);
  }
  const reloaded = availableReviewCandidates(rows, { now: after });
  assert.equal(summarizeCandidates(reloaded).total, 5);
  assert.equal(summarizeCandidates(reloaded).byCategory.vocabulary, 5);
  const next = selectReviewCandidates(reloaded, { category: 'vocabulary', limit: 20 });
  assert.equal(next.length, 5);
  assert.ok(next.every(candidate => !answeredIds.has(candidate.itemId)));
  assert.equal(rows.filter(row => row.state.attempts > 0).length, 20, 'unanswered directions receive no fabricated attempts');

  const deadline = new Date(rows.find(row => row.state.attempts).state.nextReviewAt);
  assert.equal(summarizeCandidates(availableReviewCandidates(rows, { now: deadline })).total, 25);
});

test('a correct answer does not immediately return through another content row or category', () => {
  const item = { japanese: '花', reading: 'はな', indonesian: 'bunga' };
  const rows = [
    { category: 'vocabulary', itemId: 'v1', skill: 'audio2id', item, state: stateAfter(null, true) },
    { category: 'vocabulary', itemId: 'v2', skill: 'jp2id', item, state: {} },
    { category: 'kanji', itemId: 'k1', skill: 'char2meaning', item: { character: '花', meaning_id: 'bunga' }, state: {} },
    { category: 'kanji', itemId: 'k1', skill: 'word:word2meaning:flower', item: { character: '花', meaning_id: 'bunga' }, word: item, state: {} },
  ];
  const ready = availableReviewCandidates(rows, { now: after });
  assert.equal(summarizeCandidates(ready).total, 0);
  assert.deepEqual(selectReviewCandidates(ready, { category: 'kanji' }), []);
});

test('a wrong answer still returns at its real short review deadline', () => {
  const failed = {
    category: 'kana', itemId: 'hira-a', skill: 'k2r',
    item: { kind: 'hiragana', character: 'あ', romaji: 'a' }, state: stateAfter(null, false),
  };
  const rows = [failed, { ...failed, skill: 'r2k', state: {} }];
  assert.equal(availableReviewCandidates(rows, { now: after }).length, 0);
  const due = availableReviewCandidates(rows, { now: new Date(failed.state.nextReviewAt) });
  assert.equal(due.length, 1);
  assert.equal(due[0].skill, 'k2r');
});

test('a newer attempt on a non-selected compound owner still postpones the stable owner', () => {
  const word = { japanese: '学生', reading: 'がくせい', indonesian: 'pelajar' };
  const owner = {
    category: 'kanji', itemId: 'a-owner', skill: 'word:word2meaning:student', word,
    item: { character: '学', meaning_id: 'belajar' },
    state: { attempts: 1, fsrsState: 'review', lastSeenAt: '2020-01-01', nextReviewAt: '2020-01-02' },
  };
  const alias = { ...owner, itemId: 'b-alias', item: { character: '生', meaning_id: 'hidup' }, state: stateAfter(null, true) };
  assert.equal(availableReviewCandidates([owner], { now: after }).length, 1);
  assert.deepEqual(availableReviewCandidates([owner], { now: after, scheduleEvidence: [alias] }), []);
  const later = availableReviewCandidates([owner], { now: new Date(alias.state.nextReviewAt), scheduleEvidence: [alias] });
  assert.equal(later.length, 1);
  assert.equal(later[0].itemId, 'a-owner', 'extra evidence must not change which owner records the next answer');
});

test('the first correct grammar attempt leaves summary and session until tomorrow without changing mastery', () => {
  const mastery = { attempts: 1, state: 'LEARNING', lastAttemptAt: at.toISOString(), lastAttemptPassed: true };
  const row = {
    category: 'grammar', itemId: 'identity', skill: 'controlled', item: {},
    state: { attempts: 1, lastSeenAt: mastery.lastAttemptAt, nextReviewAt: deriveGrammarReviewAt(mastery) },
  };
  assert.equal(summarizeCandidates(availableReviewCandidates([row], { now: after })).total, 0);
  assert.equal(selectReviewCandidates(availableReviewCandidates([row], { now: after })).length, 0);
  assert.equal(availableReviewCandidates([row], { now: new Date('2026-10-06T00:00:00Z') }).length, 1);
  assert.equal(mastery.state, 'LEARNING');
});

test('a homograph still in learning does not lock a separate unpractised reading and meaning', () => {
  const learning = {
    category: 'vocabulary', itemId: 'life', skill: 'jp2id',
    item: { japanese: '生', reading: 'せい', indonesian: 'hidup' },
    state: stateAfter(null, false),
  };
  const unpractised = {
    category: 'vocabulary', itemId: 'raw', skill: 'jp2id',
    item: { japanese: '生', reading: 'なま', indonesian: 'mentah' }, state: {},
  };
  const available = availableReviewCandidates([learning, unpractised], {
    now: new Date(learning.state.nextReviewAt),
  });
  assert.deepEqual(new Set(available.map(row => row.itemId)), new Set(['life', 'raw']));
  assert.deepEqual(unpractised.state, {}, 'availability must not invent mastery for the separate sense');
});
