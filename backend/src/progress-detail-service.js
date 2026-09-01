import { query } from './db.js';
import { loadMastery } from './grammar-mastery.js';
import { masteryDisplay, masteryDisplayFromPercentage } from './dashboard-rules.js';
import { loadDashboard } from './dashboard-service.js';
import { buildReviewCandidates } from './routes/smart-review.js';
import { chapterStructuralProgress } from './progress-detail-rules.js';

export async function loadProgressDetail(user, courseSlug) {
  const dashboard = await loadDashboard(user, courseSlug);
  // Dashboard is allowed to fall back to the first entitled course for its
  // default selector.  A detailed Progress URL names a course explicitly, so
  // it must fail closed instead of returning a different course's analytics.
  if (courseSlug && dashboard.course?.slug !== courseSlug) return { error: 'not_enrolled', status: 403 };
  if (!dashboard.course) return { ...dashboard, chapters: [] };
  const courseId = dashboard.course.id;
  const modules = await query(
    `SELECT m.id, m.slug, m.title, m.section_name, m.sort_order,
            COUNT(l.id)::int AS total_lessons,
            COUNT(*) FILTER (WHERE p.completed)::int AS completed_lessons
       FROM modules m LEFT JOIN lessons l ON l.module_id = m.id
       LEFT JOIN user_progress p ON p.lesson_id = l.id AND p.user_id = $1
      WHERE m.course_id = $2 GROUP BY m.id ORDER BY m.sort_order, m.created_at`, [user.id, courseId]
  );
  const generic = await query(
    `WITH scoped AS (
       SELECT DISTINCT m.id AS module_id, 'kana'::text AS item_type, k.id AS item_id FROM kana_items k JOIN lesson_kana_items li ON li.kana_id=k.id JOIN lessons l ON l.id=li.lesson_id JOIN modules m ON m.id=l.module_id JOIN user_progress p ON p.lesson_id=l.id WHERE p.user_id=$1 AND p.completed=TRUE AND m.course_id=$2
       UNION SELECT DISTINCT m.id, 'vocabulary', v.id FROM module_vocabulary v JOIN lesson_deck_items di ON di.vocabulary_id=v.id JOIN lessons l ON l.id=di.lesson_id JOIN modules m ON m.id=l.module_id JOIN user_progress p ON p.lesson_id=l.id WHERE p.user_id=$1 AND p.completed=TRUE AND m.course_id=$2
       UNION SELECT DISTINCT m.id, 'vocabulary', v.id FROM module_vocabulary v JOIN modules m ON m.id=v.module_id JOIN user_progress p ON p.lesson_id=v.lesson_id WHERE p.user_id=$1 AND p.completed=TRUE AND m.course_id=$2
       UNION SELECT DISTINCT m.id, 'kanji', k.id FROM kanji_items k JOIN lessons l ON l.id=k.lesson_id JOIN modules m ON m.id=l.module_id JOIN user_progress p ON p.lesson_id=l.id WHERE p.user_id=$1 AND p.completed=TRUE AND m.course_id=$2
     ) SELECT module_id, COALESCE(SUM(ups.attempts),0)::int AS attempts, COALESCE(SUM(ups.correct),0)::int AS correct
       FROM scoped s LEFT JOIN user_practice_state ups ON ups.user_id=$1 AND ups.item_type=s.item_type AND ups.item_id=s.item_id GROUP BY module_id`, [user.id, courseId]
  );
  const genericByModule = new Map(generic.rows.map((row) => [row.module_id, masteryDisplay(row)]));
  const grammarRows = await query(
    `SELECT DISTINCT m.id AS module_id, g.id FROM module_grammar g JOIN modules m ON m.id=g.module_id JOIN lesson_grammar_task_items gi ON gi.grammar_id=g.id JOIN user_progress p ON p.lesson_id=gi.lesson_id WHERE p.user_id=$1 AND p.completed=TRUE AND m.course_id=$2`, [user.id, courseId]
  );
  const grammarMastery = await loadMastery(user.id, grammarRows.rows.map((row) => row.id));
  const grammarByModule = new Map();
  for (const row of grammarRows.rows) {
    const m = grammarMastery.get(row.id); if (!m) continue;
    const current = grammarByModule.get(row.module_id) || { scores: [], attempts: 0 };
    if (m.score != null) current.scores.push(m.score); current.attempts += m.attempts; grammarByModule.set(row.module_id, current);
  }
  const reviews = (await buildReviewCandidates(user)).candidates.filter((candidate) => candidate.courseId === courseId);
  const lessonIds = [...new Set(reviews.map((row) => row.lessonId).filter(Boolean))];
  const lessonModules = lessonIds.length ? await query(`SELECT id, module_id FROM lessons WHERE id = ANY($1::uuid[])`, [lessonIds]) : { rows: [] };
  const moduleForLesson = new Map(lessonModules.rows.map((row) => [row.id, row.module_id])); const reviewsByModule = new Map();
  for (const review of reviews) { const moduleId = moduleForLesson.get(review.lessonId); if (moduleId) reviewsByModule.set(moduleId, (reviewsByModule.get(moduleId) || 0) + 1); }
  const chapters = modules.rows.map((module) => {
    const genericPerformance = genericByModule.get(module.id) || masteryDisplay({}); const grammar = grammarByModule.get(module.id);
    const grammarPerformance = grammar?.scores?.length ? masteryDisplayFromPercentage({ attempts: grammar.attempts, percentage: grammar.scores.reduce((sum, score) => sum + score, 0) / grammar.scores.length }) : null;
    const performance = genericPerformance.percentage != null ? genericPerformance : (grammarPerformance || genericPerformance);
    return { id: module.id, slug: module.slug, title: module.title, section: module.section_name || null,
      progress: chapterStructuralProgress(module),
      performance, grammarPerformance, reviewDue: reviewsByModule.get(module.id) || 0 };
  });
  return { ...dashboard, chapters };
}
