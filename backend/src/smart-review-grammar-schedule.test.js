import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveGrammarReviewAt } from './smart-review-grammar-schedule.js';

const AT = '2026-10-05T12:00:00.000Z';
const mastery = (overrides = {}) => ({
  attempts: 1, state: 'LEARNING', lastAttemptAt: AT, lastAttemptPassed: true,
  ...overrides,
});

test('a concept without usable attempts remains immediately reviewable', () => {
  const due = '1970-01-01T00:00:00.000Z';
  assert.equal(deriveGrammarReviewAt(null), due);
  assert.equal(deriveGrammarReviewAt(mastery({ attempts: 0, state: 'UNSEEN', lastAttemptAt: null, lastAttemptPassed: null })), due);
});

test('the first and second correct answers leave the immediate queue while still learning', () => {
  for (const attempts of [1, 2]) {
    assert.equal(deriveGrammarReviewAt(mastery({ attempts })), '2026-10-06T12:00:00.000Z');
  }
});

test('a recent success gets a day even when older failures leave mastery needing practice', () => {
  assert.equal(deriveGrammarReviewAt(mastery({ attempts: 8, state: 'NEEDS_PRACTICE' })), '2026-10-06T12:00:00.000Z');
});

test('the latest failure schedules a short retry regardless of aggregate mastery', () => {
  for (const state of ['LEARNING', 'NEEDS_PRACTICE', 'PROGRESSING', 'MASTERED']) {
    assert.equal(deriveGrammarReviewAt(mastery({ attempts: 8, state, lastAttemptPassed: false })), '2026-10-05T12:01:00.000Z');
  }
});

test('successful established concepts retain the existing 21 day interval', () => {
  for (const state of ['PROGRESSING', 'MASTERED']) {
    assert.equal(deriveGrammarReviewAt(mastery({ attempts: 8, state })), '2026-10-26T12:00:00.000Z');
  }
});

test('a repeated summary read cannot postpone an already overdue concept', () => {
  const historical = mastery({ lastAttemptAt: '2020-01-01T12:00:00.000Z' });
  assert.equal(deriveGrammarReviewAt(historical), '2020-01-02T12:00:00.000Z');
  assert.equal(deriveGrammarReviewAt(historical), '2020-01-02T12:00:00.000Z');
});

test('missing or malformed historical evidence does not hide a concept', () => {
  assert.equal(deriveGrammarReviewAt(mastery({ lastAttemptAt: 'invalid' })), '1970-01-01T00:00:00.000Z');
  assert.equal(deriveGrammarReviewAt(mastery({ lastAttemptPassed: undefined })), '1970-01-01T00:00:00.000Z');
});

test('scheduling does not change attempts, mastery, or evidence', () => {
  const input = Object.freeze(mastery({ score: null, passedCount: 1 }));
  const before = { ...input };
  deriveGrammarReviewAt(input);
  assert.deepEqual(input, before);
});
