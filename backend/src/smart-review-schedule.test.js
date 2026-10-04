import test from 'node:test';
import assert from 'node:assert/strict';
import { filterScheduledReviewSubjects } from './smart-review-schedule.js';

const now = new Date('2026-10-05T00:00:00Z');
const previous = '2026-10-04T00:00:00Z';
const future = '2026-10-08T00:00:00Z';
const good = { attempts: 1, lastSeenAt: now.toISOString(), nextReviewAt: future };
const word = (itemId, extra = {}) => ({
  category: 'vocabulary', itemId, skill: 'jp2id',
  item: { japanese: '花', reading: 'はな', indonesian: 'bunga' }, state: {}, ...extra,
});
const kanji = (itemId, extra = {}) => ({
  category: 'kanji', itemId, skill: 'char2meaning',
  item: { character: '花', meaning_id: 'bunga' }, state: {}, ...extra,
});
const compound = (itemId, extra = {}) => kanji(itemId, {
  skill: 'word:word2meaning:flower',
  word: { japanese: '花', reading: 'はな', indonesian: 'bunga' }, ...extra,
});
const filter = (rows, at = now) => filterScheduledReviewSubjects(rows, { now: at });

test('a successful direction postpones unseen and previously due directions', () => {
  assert.deepEqual(filter([
    word('v1', { state: good }),
    word('v1', { skill: 'id2jp' }),
    word('v1', { skill: 'audio2id', state: { attempts: 2, lastSeenAt: previous, nextReviewAt: previous } }),
  ]), []);
});

test('equivalent vocabulary IDs, compounds and single kanji share one cooldown', () => {
  assert.deepEqual(filter([
    word('v1', { state: good }), word('v2'), compound('k1'), kanji('k1'), kanji('k2'),
  ]), []);
});

test('a newer failure replaces an older successful schedule and returns exactly when due', () => {
  const rows = [
    word('v1', { state: { ...good, lastSeenAt: previous } }),
    word('v2', { state: { attempts: 1, lastSeenAt: now.toISOString(), nextReviewAt: '2026-10-05T00:01:00Z' } }),
    compound('k1'),
  ];
  assert.deepEqual(filter(rows), []);
  assert.deepEqual(filter(rows, new Date('2026-10-05T00:01:00Z')), rows);
});

test('a cooldown expires and does not consume evidence or permanently hide sibling directions', () => {
  const rows = [word('v1', { state: good }), word('v2'), compound('k1')];
  const before = structuredClone(rows);
  assert.deepEqual(filter(rows), []);
  assert.deepEqual(filter(rows, new Date(future)), rows);
  assert.deepEqual(rows, before);
});

test('equal attempt timestamps choose the earliest due regardless of row order', () => {
  const rows = [word('v1', { state: good }), word('v2', { state: { ...good, nextReviewAt: now.toISOString() } })];
  assert.deepEqual(filter(rows), rows);
  assert.deepEqual(filter([...rows].reverse()), [...rows].reverse());
});

test('a missing reading bridges copies only when the known reading is unambiguous', () => {
  const missing = word('missing', { item: { japanese: '花', indonesian: 'bunga' } });
  assert.deepEqual(filter([word('v1', { state: good }), missing, compound('k1')]), []);
  const noReadingEvidence = { ...missing, state: good };
  assert.deepEqual(filter([noReadingEvidence, word('v1'), kanji('k1')]), []);
});

test('homographs with different readings do not share evidence or an ambiguous missing-reading row', () => {
  const make = (id, reading, state = {}) => word(id, { item: { japanese: '生', reading, indonesian: 'hidup' }, state });
  const other = make('other', 'せい');
  const ambiguous = make('unknown', null);
  const character = kanji('life', { item: { character: '生', meaning_id: 'hidup' } });
  assert.deepEqual(filter([make('reviewed', 'しょう', good), other, ambiguous, character]), [other, ambiguous, character]);
});

test('different meanings or Japanese forms stay independent even when their readings or translations match', () => {
  const differentMeaning = word('raw', { item: { japanese: '花', reading: 'はな', indonesian: 'hiasan' } });
  const differentWord = word('nose', { item: { japanese: '鼻', reading: 'はな', indonesian: 'bunga' } });
  const differentCoreMeaning = kanji('other', { item: { character: '花', meaning_id: 'hiasan' } });
  assert.deepEqual(filter([word('v1', { state: good }), differentMeaning, differentWord, differentCoreMeaning]), [differentMeaning, differentWord, differentCoreMeaning]);
});

test('kana aliases share a cooldown within a script while Hiragana and Katakana remain separate', () => {
  const kana = (itemId, kind, character, state = {}) => ({ category: 'kana', itemId, skill: 'k2r', item: { kind, character }, state });
  const katakana = kana('kata', 'katakana', 'ア');
  assert.deepEqual(filter([
    kana('hira1', 'hiragana', 'あ', good),
    { ...kana('hira2', 'hiragana', 'あ'), skill: 'r2k' }, katakana,
  ]), [katakana]);
});

test('normalization handles width, whitespace and case without merging glosses by loose synonym matching', () => {
  const reviewed = word('v1', { state: good, item: { japanese: ' 花 ', reading: ' はな ', indonesian: ' ＢＵＮＧＡ ' } });
  const synonym = word('v3', { item: { japanese: '花', reading: 'はな', indonesian: 'bunga; kembang' } });
  assert.deepEqual(filter([reviewed, word('v2'), synonym]), [synonym]);
});

test('missing and invalid evidence cannot establish a cooldown', () => {
  for (const state of [
    {}, { ...good, attempts: 0 }, { ...good, lastSeenAt: null },
    { ...good, lastSeenAt: 'invalid' }, { ...good, nextReviewAt: null }, { ...good, nextReviewAt: 'invalid' },
  ]) {
    const rows = [word('v1', { state }), compound('k1')];
    assert.deepEqual(filter(rows), rows);
  }
});

test('newer evidence with no valid schedule does not inherit an older future schedule', () => {
  const rows = [
    word('v1', { state: { ...good, lastSeenAt: previous } }),
    word('v2', { state: { attempts: 1, lastSeenAt: now.toISOString() } }),
    compound('k1'),
  ];
  assert.deepEqual(filter(rows), rows);
});

test('incomplete content falls back to the item identity without combining unrelated records', () => {
  const incomplete = (id, state = {}) => word(id, { item: { japanese: '花' }, state });
  const unrelated = incomplete('v2');
  assert.deepEqual(filter([incomplete('v1', good), incomplete('v1'), unrelated]), [unrelated]);
  const unknown = { category: 'vocabulary', item: {} };
  assert.deepEqual(filter([{ ...unknown, state: good }, unknown]), [unknown]);
});

test('database timestamp field names are supported and invalid now leaves existing eligibility unchanged', () => {
  const rows = [word('v1', { state: { attempts: 1, last_seen_at: now.toISOString(), next_review_at: future } }), word('v2')];
  assert.deepEqual(filter(rows), []);
  assert.deepEqual(filter(rows, new Date('invalid')), rows);
});
