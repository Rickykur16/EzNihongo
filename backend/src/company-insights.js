import pg from 'pg';

// Derived, aggregate-only data. No durable copies of student evidence, no DDL,
// no changes to progress, and no dependency on this report in student routes.
export const INSIGHTS_MIN_LEARNERS = 10;
export const INSIGHTS_CACHE_MS = 5 * 60 * 1000;
const cache = new Map();
let pool, busy = false;
const unavailable = (status, message) => Object.assign(new Error(message), { status });

export function insightWindow(now = new Date()) {
  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() - (end.getUTCDay() + 6) % 7);
  return {
    previousStart: new Date(end.getTime() - 14 * 86400000).toISOString(),
    start: new Date(end.getTime() - 7 * 86400000).toISOString(),
    end: end.toISOString(),
  };
}

// Suppress the entire ratio, including its counts, when either nonzero bucket
// is small. This is a disclosure reduction, NOT a claim of anonymization.
export function protectedRatio(numerator, denominator, learners, positiveLearners, negativeLearners) {
  const small = value => value > 0 && value < INSIGHTS_MIN_LEARNERS;
  if (learners < INSIGHTS_MIN_LEARNERS || denominator === 0 || small(positiveLearners) || small(negativeLearners)) {
    return { status: 'insufficient_sample', percent: null, numerator: null, denominator: null };
  }
  return { status: 'available', percent: Math.round(100 * numerator / denominator), numerator, denominator };
}

export const INSIGHTS_SQL = `
WITH course_lessons AS MATERIALIZED (
  SELECT l.id, l.title FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = $1
), evidence AS MATERIALIZED (
  SELECT q.user_id, q.lesson_id, q.completed_at AS at
    FROM quiz_attempts q JOIN course_lessons l ON l.id = q.lesson_id
   WHERE q.completed_at >= $2 AND q.completed_at < $4
  UNION ALL
  SELECT p.user_id, p.lesson_id, p.created_at FROM practice_attempts p JOIN course_lessons l ON l.id = p.lesson_id
   WHERE p.created_at >= $2 AND p.created_at < $4 AND (p.course_id IS NULL OR p.course_id = $1)
  UNION ALL
  SELECT g.user_id, g.lesson_id, g.created_at FROM grammar_attempts g JOIN course_lessons l ON l.id = g.lesson_id
   WHERE g.created_at >= $2 AND g.created_at < $4
), valid_evidence AS MATERIALIZED (
  SELECT e.* FROM evidence e JOIN users u ON u.id = e.user_id WHERE u.email NOT LIKE '%@dihapus.invalid'
), cohort AS (
  SELECT n.user_id, EXISTS (SELECT 1 FROM valid_evidence e WHERE e.user_id = n.user_id
    AND e.at >= n.enrolled_at AND e.at < n.enrolled_at + INTERVAL '168 hours') AS activated
  FROM user_enrollments n JOIN users u ON u.id = n.user_id
  WHERE n.course_id = $1 AND n.enrolled_at >= $2 AND n.enrolled_at < $3
    AND u.email NOT LIKE '%@dihapus.invalid'
), previous_active AS (
  SELECT DISTINCT user_id FROM valid_evidence WHERE at < $3
), current_active AS (
  SELECT DISTINCT user_id, lesson_id FROM valid_evidence WHERE at >= $3
), returned AS (
  SELECT p.user_id, EXISTS (SELECT 1 FROM current_active c WHERE c.user_id = p.user_id) AS returned
  FROM previous_active p
), completion AS (
  SELECT a.user_id, a.lesson_id, COALESCE(p.completed, FALSE) AS completed
    FROM current_active a LEFT JOIN user_progress p ON p.user_id = a.user_id AND p.lesson_id = a.lesson_id
), first_answers AS (
  SELECT DISTINCT ON (r.user_id, r.lesson_id, r.question_id)
    r.user_id, r.lesson_id, r.is_correct
  FROM quiz_question_results r JOIN quiz_attempts q ON q.id = r.attempt_id
    AND q.user_id = r.user_id AND q.lesson_id = r.lesson_id
  JOIN course_lessons l ON l.id = r.lesson_id JOIN users u ON u.id = r.user_id
  WHERE q.completed_at >= $3 AND q.completed_at < $4 AND r.created_at >= $3 AND r.created_at < $4
    AND u.email NOT LIKE '%@dihapus.invalid'
  ORDER BY r.user_id, r.lesson_id, r.question_id, q.completed_at, r.created_at, r.id
), learner_scores AS (
  SELECT user_id, lesson_id, AVG(CASE WHEN is_correct THEN 0.0 ELSE 1.0 END) AS wrong,
    BOOL_OR(NOT is_correct) AS has_wrong, BOOL_OR(is_correct) AS has_correct
  FROM first_answers GROUP BY user_id, lesson_id
), tagged_practice AS (
  SELECT p.user_id, EXISTS (SELECT 1 FROM course_lessons l WHERE l.id = p.lesson_id) AS mapped
  FROM practice_attempts p JOIN users u ON u.id = p.user_id
  WHERE p.course_id = $1 AND p.created_at >= $3 AND p.created_at < $4 AND u.email NOT LIKE '%@dihapus.invalid'
), difficulties AS (
  SELECT s.lesson_id, l.title, COUNT(*) AS learners, ROUND(100 * AVG(s.wrong)) AS incorrect_percent
  FROM learner_scores s JOIN course_lessons l ON l.id = s.lesson_id GROUP BY s.lesson_id, l.title
  HAVING COUNT(*) >= 10 AND (COUNT(*) FILTER (WHERE has_wrong) = 0 OR COUNT(*) FILTER (WHERE has_wrong) >= 10)
    AND (COUNT(*) FILTER (WHERE has_correct) = 0 OR COUNT(*) FILTER (WHERE has_correct) >= 10)
  ORDER BY incorrect_percent DESC, s.lesson_id LIMIT 20
)
SELECT
  (SELECT title FROM courses WHERE id = $1) AS course_title,
  (SELECT json_build_object('total', COUNT(*), 'yes', COUNT(*) FILTER (WHERE activated)) FROM cohort) AS activation,
  (SELECT json_build_object('total', COUNT(*), 'yes', COUNT(*) FILTER (WHERE returned)) FROM returned) AS retention,
  (SELECT json_build_object('total', COUNT(*), 'yes', COUNT(*) FILTER (WHERE completed),
    'learners', COUNT(DISTINCT user_id), 'positive', COUNT(DISTINCT user_id) FILTER (WHERE completed),
    'negative', COUNT(DISTINCT user_id) FILTER (WHERE NOT completed)) FROM completion) AS completion,
  (SELECT json_build_object('total', COUNT(*), 'yes', COUNT(*) FILTER (WHERE mapped),
    'learners', COUNT(DISTINCT user_id), 'positive', COUNT(DISTINCT user_id) FILTER (WHERE mapped),
    'negative', COUNT(DISTINCT user_id) FILTER (WHERE NOT mapped)) FROM tagged_practice) AS data_quality,
  COALESCE((SELECT json_agg(d) FROM difficulties d), '[]'::json) AS difficulties,
  clock_timestamp() AS generated_at`;

export function reportFromRow(row, courseId, window) {
  if (row.course_title == null) throw unavailable(404, 'insights_course_not_found');
  const ratio = r => protectedRatio(r.yes, r.total, r.total, r.yes, r.total - r.yes);
  return {
    version: 1, course: { id: courseId, title: row.course_title }, window,
    generatedAt: new Date(row.generated_at).toISOString(), minLearners: INSIGHTS_MIN_LEARNERS,
    activation: ratio(row.activation), retention: ratio(row.retention),
    completion: protectedRatio(row.completion.yes, row.completion.total, row.completion.learners, row.completion.positive, row.completion.negative),
    dataQuality: protectedRatio(row.data_quality.yes, row.data_quality.total, row.data_quality.learners, row.data_quality.positive, row.data_quality.negative),
    difficulties: row.difficulties.map(r => ({ lessonId: r.lesson_id, title: r.title, learners: Number(r.learners), incorrectPercent: Number(r.incorrect_percent) })),
    coverage: 'main_course_evidence_only',
  };
}

// One report calculation per API process, at most one extra DB connection.
// Cache is bounded and contains only already-suppressed aggregates, never IDs
// of learners, submissions, notes, answers, emails, or reusable access grants.
export async function readInsights(courseId) {
  const window = insightWindow(), key = courseId + ':' + window.end, now = Date.now();
  for (const [k, entry] of cache) if (entry.expiresAt <= now) cache.delete(k);
  if (cache.has(key)) return { ...cache.get(key).report, cached: true };
  if (busy) throw unavailable(503, 'insights_busy_retry_later');
  busy = true;
  let client;
  try {
    pool ||= new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1,
      connectionTimeoutMillis: 2000, idleTimeoutMillis: 10000, application_name: 'company-insights',
      options: '-c default_transaction_read_only=on -c statement_timeout=3000 -c lock_timeout=500' });
    // Do not forward DB errors or connection strings to report users.
    if (!pool.listenerCount('error')) pool.on('error', () => {});
    client = await pool.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL statement_timeout = '3s'");
    await client.query("SET LOCAL lock_timeout = '500ms'");
    const { rows } = await client.query(INSIGHTS_SQL, [courseId, window.previousStart, window.start, window.end]);
    await client.query('COMMIT');
    const report = reportFromRow(rows[0], courseId, window);
    if (cache.size >= 32) cache.delete(cache.keys().next().value);
    cache.set(key, { report, expiresAt: Date.now() + INSIGHTS_CACHE_MS });
    return { ...report, cached: false };
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (error.status) throw error;
    throw unavailable(503, 'insights_unavailable');
  } finally { client?.release(); busy = false; }
}

export async function closeInsights() {
  cache.clear();
  if (pool) { await pool.end(); pool = null; }
}
