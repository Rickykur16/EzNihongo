import { applyPracticeAttempt } from './learning-foundations.js';

// Runs inside the route's per-(user,item,skill) advisory-lock transaction.
// Keeping the immutable attempt and aggregate state in the same transaction
// prevents an attempt log without its scheduling state (or vice versa).
export async function recordPracticeAttemptWithState(client, {
  userId, courseId, lessonId, itemType, itemId, skill, isCorrect, source,
}) {
  const currentResult = await client.query(
    `SELECT attempts, correct, streak, last_reviewed_at,
            fsrs_stability, fsrs_difficulty, fsrs_state, fsrs_reps, fsrs_lapses
       FROM user_practice_state
      WHERE user_id = $1 AND item_type = $2 AND item_id = $3 AND skill = $4
      FOR UPDATE`,
    [userId, itemType, itemId, skill]
  );
  const next = applyPracticeAttempt(currentResult.rows[0], { isCorrect });
  await client.query(
    `INSERT INTO practice_attempts
       (user_id, course_id, lesson_id, item_type, item_id, skill, is_correct, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [userId, courseId, lessonId || null, itemType, itemId, skill, isCorrect, source]
  );
  const saved = await client.query(
    `INSERT INTO user_practice_state
       (user_id, item_type, item_id, skill, attempts, correct, streak,
        last_seen_at, last_reviewed_at, next_review_at, mastery_state,
        fsrs_stability, fsrs_difficulty, fsrs_state, fsrs_reps, fsrs_lapses)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (user_id, item_type, item_id, skill) DO UPDATE
       SET attempts = EXCLUDED.attempts,
           correct = EXCLUDED.correct,
           streak = EXCLUDED.streak,
           last_seen_at = EXCLUDED.last_seen_at,
           last_reviewed_at = EXCLUDED.last_reviewed_at,
           next_review_at = EXCLUDED.next_review_at,
           mastery_state = EXCLUDED.mastery_state,
           fsrs_stability = EXCLUDED.fsrs_stability,
           fsrs_difficulty = EXCLUDED.fsrs_difficulty,
           fsrs_state = EXCLUDED.fsrs_state,
           fsrs_reps = EXCLUDED.fsrs_reps,
           fsrs_lapses = EXCLUDED.fsrs_lapses,
           updated_at = NOW()
     RETURNING item_type, item_id, skill, attempts, correct, streak,
               last_seen_at, last_reviewed_at, next_review_at, mastery_state,
               fsrs_stability, fsrs_difficulty, fsrs_state, fsrs_reps, fsrs_lapses`,
    [
      userId, itemType, itemId, skill, next.attempts, next.correct,
      next.streak, next.lastSeenAt, next.lastReviewedAt, next.nextReviewAt,
      next.masteryState,
      next.fsrs.stability, next.fsrs.difficulty, next.fsrs.state,
      next.fsrs.reps, next.fsrs.lapses,
    ]
  );
  return saved.rows[0];
}
