import { query } from './db.js';
import { isAdminEmail } from './auth.js';
import { loadMastery, focusSentence } from './grammar-mastery.js';
import { buildReviewCandidates } from './routes/smart-review.js';
import { summarizeCandidates } from './smart-review-service.js';
import { isVisibleCurriculumLesson, masteryDisplay, masteryDisplayFromPercentage, structuralProgressAndNext, weeklyInsight } from './dashboard-rules.js';
import { loadLiveClassSummary } from './live-class-service.js';

const WEEK_DAYS = 7;

export { masteryDisplay, weeklyInsight } from './dashboard-rules.js';

async function accessibleCourses(user) {
  const enrolled = await query(
    `SELECT c.id, c.slug, c.title, c.level, c.sort_order
       FROM user_enrollments e JOIN courses c ON c.id = e.course_id
      WHERE e.user_id = $1 AND e.status = 'active' AND (e.expires_at IS NULL OR e.expires_at > NOW())
      ORDER BY c.sort_order, c.created_at`, [user.id]
  );
  if (!(await isAdminEmail(user.email))) return enrolled.rows;
  return (await query(`SELECT id, slug, title, level, sort_order FROM courses WHERE is_published = TRUE ORDER BY sort_order, created_at`)).rows;
}

async function structuralCourse(userId, course) {
  const lessons = await query(
    `SELECT l.id, l.slug, l.title, l.type, l.popup_after_lesson_id, l.sort_order, m.id AS module_id, m.slug AS module_slug,
            m.title AS module_title, m.section_name, m.sort_order AS module_sort,
            p.completed, p.completed_at
       FROM lessons l JOIN modules m ON m.id = l.module_id
       LEFT JOIN user_progress p ON p.lesson_id = l.id AND p.user_id = $1
      WHERE m.course_id = $2
      ORDER BY m.sort_order, l.sort_order, l.created_at`, [userId, course.id]
  );
  const rows = lessons.rows.filter(isVisibleCurriculumLesson);
  const structural = structuralProgressAndNext(rows);
  const next = structural.next;
  return {
    ...course,
    progress: { completedLessons: structural.completedLessons, totalLessons: structural.totalLessons, percentage: structural.percentage },
    continueLearning: next ? { section: next.section_name || null, chapter: { id: next.module_id, slug: next.module_slug, title: next.module_title }, lesson: { id: next.id, slug: next.slug, title: next.title, type: next.type } } : null,
  };
}

async function genericMastery(userId, courseId) {
  const result = await query(
    `WITH scoped AS (
       SELECT DISTINCT 'kana'::text AS item_type, k.id AS item_id
         FROM kana_items k JOIN lesson_kana_items li ON li.kana_id = k.id JOIN lessons l ON l.id = li.lesson_id JOIN modules m ON m.id = l.module_id JOIN user_progress p ON p.lesson_id = l.id
        WHERE p.user_id = $1 AND p.completed = TRUE AND m.course_id = $2
       UNION
       SELECT DISTINCT 'vocabulary', v.id
         FROM module_vocabulary v JOIN lesson_deck_items di ON di.vocabulary_id = v.id JOIN lessons l ON l.id = di.lesson_id JOIN modules m ON m.id = l.module_id JOIN user_progress p ON p.lesson_id = l.id
        WHERE p.user_id = $1 AND p.completed = TRUE AND m.course_id = $2
       UNION
       SELECT DISTINCT 'vocabulary', v.id
         FROM module_vocabulary v JOIN modules m ON m.id = v.module_id JOIN user_progress p ON p.lesson_id = v.lesson_id
        WHERE p.user_id = $1 AND p.completed = TRUE AND m.course_id = $2
       UNION
       SELECT DISTINCT 'kanji', k.id
         FROM kanji_items k JOIN lessons l ON l.id = k.lesson_id JOIN modules m ON m.id = l.module_id JOIN user_progress p ON p.lesson_id = l.id
        WHERE p.user_id = $1 AND p.completed = TRUE AND m.course_id = $2
     )
     SELECT s.item_type, COALESCE(SUM(u.attempts), 0)::int AS attempts, COALESCE(SUM(u.correct), 0)::int AS correct
       FROM scoped s LEFT JOIN user_practice_state u ON u.user_id = $1 AND u.item_type = s.item_type AND u.item_id = s.item_id
      GROUP BY s.item_type`, [userId, courseId]
  );
  const values = new Map(result.rows.map((row) => [row.item_type, masteryDisplay(row)]));
  return { kana: values.get('kana') || masteryDisplay({}), vocabulary: values.get('vocabulary') || masteryDisplay({}), kanji: values.get('kanji') || masteryDisplay({}) };
}

async function grammarMastery(userId, courseId) {
  const concepts = await query(
    `SELECT DISTINCT g.id, g.pattern FROM module_grammar g JOIN modules m ON m.id = g.module_id
       JOIN lesson_grammar_task_items gi ON gi.grammar_id = g.id JOIN user_progress p ON p.lesson_id = gi.lesson_id
      WHERE p.user_id = $1 AND p.completed = TRUE AND m.course_id = $2`, [userId, courseId]
  );
  const mastery = await loadMastery(userId, concepts.rows.map((row) => row.id));
  const analyzed = [...mastery.values()].filter((row) => row.score != null);
  const weak = concepts.rows.map((concept) => ({ concept, mastery: mastery.get(concept.id) })).filter(({ mastery: m }) => m && (m.state === 'NEEDS_PRACTICE' || m.dueReview));
  const percentage = analyzed.length ? Math.round(analyzed.reduce((sum, row) => sum + row.score, 0) / analyzed.length) : null;
  const attempts = [...mastery.values()].reduce((sum, row) => sum + row.attempts, 0);
  const display = masteryDisplayFromPercentage({ attempts, percentage });
  return { display, weak, mastery };
}

async function weeklyActivity(userId, courseId) {
  const result = await query(
    `WITH evidence AS (
       SELECT created_at, is_correct AS correct FROM practice_attempts WHERE user_id = $1 AND course_id = $2 AND created_at >= NOW() - INTERVAL '7 days'
       UNION ALL
       SELECT ga.created_at, ga.passed FROM grammar_attempts ga JOIN module_grammar g ON g.id = ga.grammar_id JOIN modules m ON m.id = g.module_id WHERE ga.user_id = $1 AND m.course_id = $2 AND ga.created_at >= NOW() - INTERVAL '7 days'
     ), previous AS (
       SELECT is_correct AS correct FROM practice_attempts WHERE user_id = $1 AND course_id = $2 AND created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days'
       UNION ALL
       SELECT ga.passed FROM grammar_attempts ga JOIN module_grammar g ON g.id = ga.grammar_id JOIN modules m ON m.id = g.module_id WHERE ga.user_id = $1 AND m.course_id = $2 AND ga.created_at >= NOW() - INTERVAL '14 days' AND ga.created_at < NOW() - INTERVAL '7 days'
     )
     SELECT (SELECT COUNT(DISTINCT DATE(created_at))::int FROM evidence) AS active_days,
            (SELECT COUNT(*)::int FROM evidence) AS attempts,
            (SELECT COALESCE(SUM(correct::int), 0)::int FROM evidence) AS correct,
            ((SELECT COUNT(*)::int FROM practice_attempts WHERE user_id = $1 AND course_id = $2 AND source = 'smart_review' AND created_at >= NOW() - INTERVAL '7 days')
             + (SELECT COUNT(*)::int FROM grammar_attempts ga JOIN module_grammar g ON g.id = ga.grammar_id JOIN modules m ON m.id = g.module_id WHERE ga.user_id = $1 AND m.course_id = $2 AND ga.eval_source = 'smart_review' AND ga.created_at >= NOW() - INTERVAL '7 days')) AS review_questions,
            (SELECT COUNT(*)::int FROM user_progress p JOIN lessons l ON l.id = p.lesson_id JOIN modules m ON m.id = l.module_id WHERE p.user_id = $1 AND p.completed = TRUE AND p.completed_at >= NOW() - INTERVAL '7 days' AND m.course_id = $2 AND NOT (l.type = 'grammar_task' AND l.popup_after_lesson_id IS NOT NULL)) AS lessons_completed,
            (SELECT COUNT(*)::int FROM previous) AS previous_attempts,
            (SELECT COALESCE(SUM(correct::int), 0)::int FROM previous) AS previous_correct`, [userId, courseId]
  );
  const row = result.rows[0] || {}; const attempts = Number(row.attempts) || 0; const previous = Number(row.previous_attempts) || 0;
  const accuracy = attempts ? Math.round((Number(row.correct) / attempts) * 100) : null;
  const previousAccuracy = previous ? Math.round((Number(row.previous_correct) / previous) * 100) : null;
  return { activeDays: Number(row.active_days) || 0, lessonsCompleted: Number(row.lessons_completed) || 0, reviewQuestions: Number(row.review_questions) || 0, attempts, accuracy, accuracyTrend: accuracy != null && previousAccuracy != null ? accuracy - previousAccuracy : null, windowDays: WEEK_DAYS };
}

function pickFocus(mastery, grammar, review, continueLearning) {
  const grammarWeak = grammar.weak.sort((a, b) => (a.mastery.score ?? 100) - (b.mastery.score ?? 100))[0];
  if (grammarWeak) return { category: 'grammar', title: grammarWeak.concept.pattern, detail: focusSentence(grammarWeak.concept.pattern, grammarWeak.mastery, grammarWeak.mastery.dominantError), action: 'review', reviewCategory: 'grammar' };
  const weakGeneric = Object.entries(mastery).map(([category, value]) => ({ category, value })).filter(({ value }) => value.percentage != null && value.percentage < 60).sort((a, b) => a.value.percentage - b.value.percentage)[0];
  if (weakGeneric) return { category: weakGeneric.category, title: weakGeneric.category === 'vocabulary' ? 'Kosakata' : weakGeneric.category[0].toUpperCase() + weakGeneric.category.slice(1), detail: 'Latih kembali bagian ini agar semakin mantap.', action: 'review', reviewCategory: weakGeneric.category };
  if (review.total > 0) return { category: 'review', title: 'Smart Review', detail: 'Ada materi yang sudah dipelajari dan siap diulang.', action: 'review', reviewCategory: 'mixed' };
  if (continueLearning) return { category: 'continue', title: continueLearning.lesson.title, detail: 'Lanjutkan pelajaran berikutnya dalam kurikulum.', action: 'continue' };
  return null;
}

export async function loadDashboard(user, courseSlug) {
  const courses = await accessibleCourses(user); const selected = courses.find((course) => course.slug === courseSlug) || courses[0] || null;
  if (!selected) return { courses: [], course: null, continueLearning: null, review: { total: 0, byCategory: {} }, mastery: null, focus: null, weeklyActivity: null, weeklyInsight: null, liveClass: null };
  const course = await structuralCourse(user.id, selected);
  const [reviewData, generic, grammar, activity, profile, liveClass] = await Promise.all([
    buildReviewCandidates(user), genericMastery(user.id, selected.id), grammarMastery(user.id, selected.id), weeklyActivity(user.id, selected.id), query(`SELECT full_name FROM users WHERE id = $1`, [user.id]), loadLiveClassSummary(user, selected.slug),
  ]);
  const review = summarizeCandidates(reviewData.candidates.filter((candidate) => candidate.courseId === selected.id));
  const mastery = { ...generic, grammar: grammar.display };
  const focus = pickFocus(mastery, grammar, review, course.continueLearning);
  return { greetingName: String(profile.rows[0]?.full_name || '').trim().split(/\s+/)[0] || null, courses: courses.map(({ id, slug, title, level }) => ({ id, slug, title, level })), course: { id: course.id, slug: course.slug, title: course.title, level: course.level, progress: course.progress }, continueLearning: course.continueLearning, review, mastery, focus, weeklyActivity: activity, weeklyInsight: weeklyInsight({ reviewDue: review.total, ...activity, focus }), liveClass };
}
