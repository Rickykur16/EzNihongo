import test from 'node:test';
import assert from 'node:assert/strict';
import { masteryDisplay, structuralProgressAndNext, weeklyInsight } from './dashboard-rules.js';

test('dashboard mastery never turns missing evidence into 0 percent', () => {
  assert.deepEqual(masteryDisplay({ attempts: 0, correct: 0 }), { label: 'Belum cukup data', percentage: null, attempts: 0 });
  assert.equal(masteryDisplay({ attempts: 3, correct: 1 }).label, 'Perlu latihan');
  assert.equal(masteryDisplay({ attempts: 5, correct: 4 }).label, 'Kuat');
});

test('weekly insight prioritizes due review and uses deterministic neutral fallbacks', () => {
  assert.equal(weeklyInsight({ reviewDue: 4, activeDays: 2 }).kind, 'due_review');
  assert.equal(weeklyInsight({ reviewDue: 0, activeDays: 0 }).kind, 'low_activity');
  assert.equal(weeklyInsight({ reviewDue: 0, activeDays: 3, attempts: 8, accuracy: 90 }).kind, 'steady_progress');
});

test('Continue Learning uses structural completion order, not mastery', () => {
  const result = structuralProgressAndNext([{ id: 'one', completed: true }, { id: 'two', completed: false }, { id: 'three', completed: false }]);
  assert.equal(result.percentage, 33);
  assert.equal(result.next.id, 'two');
});
