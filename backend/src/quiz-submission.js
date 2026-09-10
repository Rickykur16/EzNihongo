import { completeLessonWithStats } from './progress-service.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invalid = (status, error) => ({ status, body: { error } });

// Caller holds the quiz:{user}:{lesson} advisory lock in a transaction.
// Returning success means score, detailed results, completion and stats all
// committed together. A lost response can be replayed without grading twice.
export async function submitQuizAttempt(client, { userId, lessonId, attemptToken, answers }) {
  if (typeof attemptToken !== 'string' || !uuid.test(attemptToken)) {
    return invalid(400, 'invalid_attempt_token');
  }
  const attemptRes = await client.query(
    `SELECT id, sampled_question_ids, completed_at, grading_result
       FROM quiz_attempts
      WHERE user_id = $1 AND lesson_id = $2 AND attempt_token = $3
      FOR UPDATE`, [userId, lessonId, attemptToken]
  );
  const attempt = attemptRes.rows[0];
  if (!attempt) return invalid(404, 'attempt_not_found');
  if (attempt.completed_at) {
    return attempt.grading_result
      ? { status: 200, body: attempt.grading_result }
      : invalid(409, 'already_submitted');
  }
  const lessonRes = await client.query(
    'SELECT type, passing_score_pct, cooldown_hours FROM lessons WHERE id = $1', [lessonId]
  );
  const lesson = lessonRes.rows[0];
  if (!lesson || lesson.type !== 'quiz') return invalid(409, 'lesson_not_quiz');
  const sampledIds = Array.isArray(attempt.sampled_question_ids) ? attempt.sampled_question_ids : [];
  const sampledSet = new Set(sampledIds);
  if (!sampledIds.length || sampledSet.size !== sampledIds.length) return invalid(409, 'quiz_questions_changed');
  if (!Array.isArray(answers)) return invalid(400, 'invalid_answers');
  if (answers.length !== sampledIds.length) return invalid(400, 'answers_incomplete_or_duplicate');
  const choices = new Map();
  for (const answer of answers) {
    if (typeof answer?.questionId !== 'string' || !uuid.test(answer.questionId)
        || typeof answer?.optionId !== 'string' || !uuid.test(answer.optionId)) {
      return invalid(400, 'invalid_answer');
    }
    const questionId = answer.questionId.toLowerCase(), optionId = answer.optionId.toLowerCase();
    if (!sampledSet.has(questionId)) return invalid(400, 'question_not_in_attempt');
    if (choices.has(questionId)) return invalid(400, 'duplicate_question');
    choices.set(questionId, optionId);
  }
  const rows = await client.query(
    `SELECT q.id AS question_id, q.question_category, q.grammar_id,
            o.id AS option_id, o.is_correct
       FROM quiz_questions q LEFT JOIN quiz_options o ON o.question_id = q.id
      WHERE q.id = ANY($1::uuid[]) AND q.lesson_id = $2`, [sampledIds, lessonId]
  );
  const questions = new Map(), options = new Map();
  for (const row of rows.rows) {
    questions.set(row.question_id, row);
    if (row.option_id) options.set(row.option_id, row);
  }
  // Never shrink the denominator when an admin deletes/moves questions.
  if (questions.size !== sampledIds.length) return invalid(409, 'quiz_questions_changed');
  const correctByQuestion = {};
  for (const [questionId, optionId] of choices) {
    const option = options.get(optionId);
    if (!option || option.question_id !== questionId) return invalid(400, 'invalid_option');
    correctByQuestion[questionId] = !!option.is_correct;
  }
  const score = Object.values(correctByQuestion).filter(Boolean).length;
  const total = sampledIds.length;
  const passingScorePct = lesson.passing_score_pct ?? 70;
  const cooldownHours = lesson.cooldown_hours ?? 12;
  const passed = total > 0 && score * 100 / total >= passingScorePct;
  const timing = await client.query('SELECT NOW() AS completed_at');
  const nextAttemptAt = new Date(new Date(timing.rows[0].completed_at).getTime() + cooldownHours * 3600000).toISOString();
  const result = { score, total, correctByQuestion, passingScorePct, passed,
    cooldownHours, nextAttemptAt, completionSaved: passed };
  await client.query(
    `UPDATE quiz_attempts SET score = $1, total_questions = $2, completed_at = NOW(),
            grading_result = $3::jsonb, submitted_answers = $4::jsonb WHERE id = $5`,
    [score, total, JSON.stringify(result), JSON.stringify([...choices].map(([questionId, optionId]) => ({ questionId, optionId }))), attempt.id]
  );
  const values = [], params = [];
  for (const questionId of sampledIds) {
    const question = questions.get(questionId);
    const i = params.length;
    params.push(attempt.id, userId, lessonId, questionId,
      question.question_category || 'vocabulary', question.grammar_id || null, correctByQuestion[questionId]);
    values.push(`($${i+1}, $${i+2}, $${i+3}, $${i+4}, $${i+5}, $${i+6}::uuid, $${i+7})`);
  }
  await client.query(
    `INSERT INTO quiz_question_results
       (attempt_id, user_id, lesson_id, question_id, question_category, grammar_id, is_correct)
     VALUES ${values.join(', ')}`, params
  );
  if (passed) {
    // Same lock as the generic completion endpoint; order is always quiz,
    // then completion. Completion never acquires the quiz lock in reverse.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`lesson-complete:${userId}:${lessonId}`]);
    const completion = await completeLessonWithStats(client, { userId, lessonId });
    if (!completion.found || completion.requiresQuizPass) throw new Error('quiz_completion_failed');
  }
  return { status: 200, body: result };
}
