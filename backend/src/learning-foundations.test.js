import test from 'node:test';
import assert from 'node:assert/strict';
import { completeLessonWithStats, reconcileLegacyProgress } from './progress-service.js';
import { recordPracticeAttemptWithState } from './practice-service.js';
import {
  applyPracticeAttempt,
  hasPracticeScopeAccess,
  mergeBestQuizScores,
  mergeCanonicalLessonProgress,
  mergeCurrentLessonProgress,
  mergeCompletionProgress,
  mergeImportedPracticeState,
  normalizeLegacyPracticeStat,
  normalizeLegacyProgress,
} from './learning-foundations.js';

function completionClient({ completed = false } = {}) {
  const progress = { completed };
  const stats = { xp: 0, lessons: 0, minutes: 0 };
  return {
    progress,
    stats,
    async query(sql, params) {
      if (sql.includes('SELECT id, duration_minutes FROM lessons')) {
        return { rows: [{ id: params[0], duration_minutes: 15 }], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO user_progress')) {
        if (progress.completed) return { rows: [], rowCount: 0 };
        progress.completed = true;
        return { rows: [{ lesson_id: params[1] }], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO user_stats')) {
        stats.xp += params[1];
        stats.lessons += 1;
        stats.minutes += params[2];
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${sql.slice(0, 60)}`);
    },
  };
}

test('first completion transitions a pre-existing incomplete progress row and awards stats once', async () => {
  const client = completionClient({ completed: false });
  const first = await completeLessonWithStats(client, { userId: 'user', lessonId: 'lesson' });
  assert.deepEqual(first, { found: true, firstComplete: true });
  assert.deepEqual(client.stats, { xp: 25, lessons: 1, minutes: 15 });

  const duplicate = await completeLessonWithStats(client, { userId: 'user', lessonId: 'lesson' });
  assert.deepEqual(duplicate, { found: true, firstComplete: false });
  assert.deepEqual(client.stats, { xp: 25, lessons: 1, minutes: 15 });
});

test('legacy completion reconciliation is idempotent and never grants historical XP', async () => {
  const completed = new Set(['lesson-already-complete']);
  const client = {
    async query(sql) {
      assert.match(sql, /WITH legacy_lessons/);
      const legacy = ['lesson-already-complete', 'lesson-needs-reconcile'];
      const reconciled = legacy.filter((id) => !completed.has(id));
      reconciled.forEach((id) => completed.add(id));
      return { rows: [{ candidates: legacy.length, reconciled: reconciled.length }], rowCount: 1 };
    },
  };
  assert.deepEqual(await reconcileLegacyProgress(client, 'user'), { candidates: 2, reconciled: 1 });
  assert.deepEqual(await reconcileLegacyProgress(client, 'user'), { candidates: 2, reconciled: 0 });
  assert.deepEqual([...completed].sort(), ['lesson-already-complete', 'lesson-needs-reconcile']);
});

test('legacy progress parser accepts only true completion flags', () => {
  assert.deepEqual(normalizeLegacyProgress({
    n5: { 'bab-1:intro': true, 'bab-1:reading': false, malformed: true },
    n4: null,
  }), [{ courseSlug: 'n5', moduleSlug: 'bab-1', lessonSlug: 'intro' }]);
});

test('canonical lesson progress is overlaid into the lesson-page cache without losing local completions', () => {
  const legacy = {
    n5: { 'bab-1:intro': true, 'bab-1:local-only': true },
    malformed: null,
  };
  const merged = mergeCanonicalLessonProgress(legacy, [
    { course_slug: 'n5', module_slug: 'bab-1', lesson_slug: 'server-complete' },
    { course_slug: 'n4', module_slug: 'bab-2', lesson_slug: 'reading' },
    { course_slug: '', module_slug: 'ignored', lesson_slug: 'ignored' },
  ]);
  assert.deepEqual(merged, {
    n5: {
      'bab-1:intro': true,
      'bab-1:local-only': true,
      'bab-1:server-complete': true,
    },
    malformed: {},
    n4: { 'bab-2:reading': true },
  });
  assert.notEqual(merged.n5, legacy.n5);
});

test('current lesson catalog removes stale keys while preserving valid and canonical completions', () => {
  const merged = mergeCurrentLessonProgress({
    n5: {
      'bab-1:intro': true,
      'bab-lama:dihapus': true,
      'bab-2:belum': false,
    },
    removed_course: { 'bab-1:intro': true },
  }, [
    { course_slug: 'n5', module_slug: 'bab-1', lesson_slug: 'intro', completed: false },
    { course_slug: 'n5', module_slug: 'bab-2', lesson_slug: 'belum', completed: false },
    { course_slug: 'n5', module_slug: 'bab-2', lesson_slug: 'server', completed: true },
  ]);
  assert.deepEqual(merged, {
    n5: {
      'bab-1:intro': true,
      'bab-2:belum': false,
      'bab-2:server': true,
    },
  });
});

test('server learning-state merge is monotonic across devices', () => {
  assert.deepEqual(mergeCompletionProgress(
    { n5: { 'bab-1:intro': true, 'bab-1:server-only': true } },
    { n5: { 'bab-1:intro': false, 'bab-1:phone-only': true }, n4: { 'bab-2:kana': true } },
  ), {
    n5: { 'bab-1:intro': true, 'bab-1:server-only': true, 'bab-1:phone-only': true },
    n4: { 'bab-2:kana': true },
  });
  assert.deepEqual(mergeBestQuizScores({ quizA: 80, quizB: 75 }, { quizA: 60, quizC: 90 }), {
    quizA: 80, quizB: 75, quizC: 90,
  });
});

test('recording a practice attempt updates counters, streak, and due time once', () => {
  const first = applyPracticeAttempt(null, { isCorrect: true, now: new Date('2026-01-01T00:00:00Z') });
  assert.equal(first.attempts, 1);
  assert.equal(first.correct, 1);
  assert.equal(first.streak, 1);
  // FSRS S0(Good): a first correct answer buys 3 days, not the old ladder's 1.
  assert.equal(first.nextReviewAt, '2026-01-04T00:00:00.000Z');
  assert.equal(first.fsrs.state, 'review');
  assert.ok(first.fsrs.stability > 0 && first.fsrs.difficulty > 0);

  const retry = applyPracticeAttempt(first, { isCorrect: false, now: new Date('2026-01-04T00:00:00Z') });
  assert.deepEqual({ attempts: retry.attempts, correct: retry.correct, streak: retry.streak },
    { attempts: 2, correct: 1, streak: 0 });
  // A lapse drops into relearning a minute out — deliberately NOT "due right
  // now" like the old ladder's delay of 0.
  assert.equal(retry.fsrs.state, 'relearning');
  assert.equal(retry.fsrs.lapses, 1);
  assert.equal(retry.nextReviewAt, '2026-01-04T00:01:00.000Z');
});

test('practice-state upsert records each immutable attempt exactly once', async () => {
  const state = new Map();
  const attemptRows = [];
  const client = {
    async query(sql, params) {
      const key = `${params[0]}:${params[1]}:${params[2]}:${params[3]}`;
      if (sql.includes('SELECT attempts, correct, streak')) {
        return { rows: state.has(key) ? [state.get(key)] : [], rowCount: state.has(key) ? 1 : 0 };
      }
      if (sql.includes('INSERT INTO practice_attempts')) {
        attemptRows.push(params);
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO user_practice_state')) {
        const saved = {
          item_type: params[1], item_id: params[2], skill: params[3],
          attempts: params[4], correct: params[5], streak: params[6],
          last_seen_at: params[7], last_reviewed_at: params[8],
          next_review_at: params[9], mastery_state: params[10],
        };
        state.set(key, saved);
        return { rows: [saved], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${sql.slice(0, 60)}`);
    },
  };
  const base = {
    userId: 'u', courseId: 'c', lessonId: 'l', itemType: 'kana',
    itemId: 'i', skill: 'k2r', source: 'lesson_drill',
  };
  const first = await recordPracticeAttemptWithState(client, { ...base, isCorrect: true });
  const second = await recordPracticeAttemptWithState(client, { ...base, isCorrect: false });
  assert.deepEqual({ attempts: first.attempts, correct: first.correct, streak: first.streak },
    { attempts: 1, correct: 1, streak: 1 });
  assert.deepEqual({ attempts: second.attempts, correct: second.correct, streak: second.streak },
    { attempts: 2, correct: 1, streak: 0 });
  assert.equal(attemptRows.length, 2);
  assert.deepEqual(attemptRows.map((row) => row[6]), [true, false]);
});

test('legacy mastery import merges aggregate snapshots rather than double-counting retries', () => {
  const imported = normalizeLegacyPracticeStat({ attempts: 8, correct: 6, streak: 2, lastSeen: Date.UTC(2026, 0, 2) });
  const first = mergeImportedPracticeState(null, imported);
  const duplicate = mergeImportedPracticeState(first, imported);
  assert.deepEqual(duplicate, first);
  assert.equal(duplicate.attempts, 8);
  assert.equal(duplicate.correct, 6);
});

test('practice scope requires both active entitlement and item membership', () => {
  assert.equal(hasPracticeScopeAccess({ entitled: true, itemBelongsToScope: true }), true);
  assert.equal(hasPracticeScopeAccess({ entitled: false, itemBelongsToScope: true }), false);
  assert.equal(hasPracticeScopeAccess({ entitled: true, itemBelongsToScope: false }), false);
});
