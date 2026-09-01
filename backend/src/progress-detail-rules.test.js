import test from 'node:test';
import assert from 'node:assert/strict';
import { masteryDisplayFromPercentage, structuralProgressAndNext } from './dashboard-rules.js';
import { chapterStructuralProgress, chaptersBySection } from './progress-detail-rules.js';

test('per-Bab structural progress has the same completion semantics as Dashboard', () => {
  const dashboard = structuralProgressAndNext([{ completed: true }, { completed: true }, { completed: false }]);
  assert.deepEqual(chapterStructuralProgress({ completed_lessons: 2, total_lessons: 3 }), {
    completedLessons: dashboard.completedLessons, totalLessons: dashboard.totalLessons, percentage: dashboard.percentage,
  });
});

test('Progress mastery reuses evidence thresholds instead of inventing a percentage', () => {
  assert.deepEqual(masteryDisplayFromPercentage({ attempts: 2, percentage: 100 }), { label: 'Belum cukup data', percentage: null, attempts: 2 });
  assert.equal(masteryDisplayFromPercentage({ attempts: 4, percentage: 55 }).label, 'Perlu latihan');
  assert.equal(masteryDisplayFromPercentage({ attempts: 4, percentage: 85 }).label, 'Kuat');
});

test('Bab stay grouped by their existing Section without changing their order', () => {
  const groups = chaptersBySection([{ id: 'a', section: 'Section 1' }, { id: 'b', section: 'Section 1' }, { id: 'c', section: 'Section 2' }]);
  assert.deepEqual([...groups.entries()].map(([section, rows]) => [section, rows.map((row) => row.id)]), [['Section 1', ['a', 'b']], ['Section 2', ['c']]]);
});
