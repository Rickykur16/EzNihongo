import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGAIN, EASY, GOOD, DEFAULT_WEIGHTS,
  emptyCard, initialDifficulty, nextDifficulty, reviewCard,
  stabilityAfterForgetting,
} from './fsrs.js';
import { nextReviewDelayMs } from './learning-foundations.js';

const DAY = 86_400_000;

// Pinned vector. Regenerating these numbers is the point: if a formula drifts
// (or someone "helpfully" copies app/fsrs.js back in) this fails loudly.
test('always-Good, answered on time, produces the canonical FSRS-5 ladder', () => {
  let card = emptyCard();
  let now = new Date('2026-01-01T00:00:00Z');
  const intervals = [];
  for (let i = 0; i < 8; i += 1) {
    card = reviewCard(card, GOOD, { now });
    intervals.push(card.intervalDays);
    now = new Date(card.dueAt);
  }
  assert.deepEqual(intervals, [3, 11, 35, 101, 269, 669, 1563, 3454]);
});

// The complaint that started this: "yg sudah hafal tapi di tagih tiap 2 minggu".
test('the old 14-day ceiling is gone', () => {
  assert.equal(nextReviewDelayMs({ correct: true, streak: 6 }) / DAY, 14);
  assert.equal(nextReviewDelayMs({ correct: true, streak: 60 }) / DAY, 14);

  let card = emptyCard();
  let now = new Date('2026-01-01T00:00:00Z');
  for (let i = 0; i < 6; i += 1) { card = reviewCard(card, GOOD, { now }); now = new Date(card.dueAt); }
  assert.ok(card.intervalDays > 14 * 10, `expected far beyond the ceiling, got ${card.intervalDays}`);
});

// app/fsrs.js freezes difficulty near 5.31 because it swaps w6/w7, drops the
// linear damping and reverts toward D0(3). Difficulty must actually move, or
// FSRS is just a stability curve with no per-item adaptation.
test('difficulty rises after failures and falls after easy answers', () => {
  let hard = initialDifficulty(GOOD, DEFAULT_WEIGHTS);
  const start = hard;
  for (let i = 0; i < 3; i += 1) hard = nextDifficulty(hard, AGAIN, DEFAULT_WEIGHTS);
  assert.ok(hard > start + 2, `failures should harden the card, got ${start} -> ${hard}`);

  let easy = initialDifficulty(GOOD, DEFAULT_WEIGHTS);
  for (let i = 0; i < 3; i += 1) easy = nextDifficulty(easy, EASY, DEFAULT_WEIGHTS);
  assert.ok(easy < start - 2, `easy answers should soften the card, got ${start} -> ${easy}`);
});

test('forgetting shrinks stability instead of resetting it', () => {
  const after = stabilityAfterForgetting(192, 10, 0.9, DEFAULT_WEIGHTS);
  assert.ok(after > 1 && after < 192, `expected a partial drop, got ${after}`);
});

test('a wrong answer sends a mature card to relearning, not straight back to new', () => {
  let card = emptyCard();
  let now = new Date('2026-01-01T00:00:00Z');
  for (let i = 0; i < 4; i += 1) { card = reviewCard(card, GOOD, { now }); now = new Date(card.dueAt); }
  const lapsed = reviewCard(card, AGAIN, { now });
  assert.equal(lapsed.state, 'relearning');
  assert.equal(lapsed.lapses, 1);
  assert.ok(lapsed.stability < card.stability);
});
