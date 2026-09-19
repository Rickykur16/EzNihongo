import { query } from './db.js';
import { loadTaskConcepts, loadModulePool } from './routes/grammar-task.js';
import { companionIsCurrent, contentRevisionId, publicCompanionView } from './bunpou-flow-service.js';

export async function loadCompanionContext(sourceLessonId) {
  const result = await query(
    `SELECT s.bunpou_flow_published, sm.course_id AS source_course_id,
            t.id AS task_lesson_id, t.module_id AS task_module_id, tm.course_id AS task_course_id
       FROM lessons s
       JOIN modules sm ON sm.id = s.module_id
       LEFT JOIN lessons t ON t.popup_after_lesson_id = s.id AND t.type = 'grammar_task'
       LEFT JOIN modules tm ON tm.id = t.module_id
      WHERE s.id = $1 ORDER BY t.sort_order, t.id`, [sourceLessonId]);
  const row = result.rows[0];
  // A source with ambiguous task mapping cannot silently pick a task.
  if (!row?.task_lesson_id || result.rows.length !== 1) return null;
  if (!row.source_course_id || row.task_course_id !== row.source_course_id) return null;
  // Check all content used by the source, task, and distractor pool. A grammar
  // card's module and its optional source lesson must agree on course scope.
  const foreignGrammar = await query(
    `SELECT 1 FROM module_grammar g
       LEFT JOIN modules gm ON gm.id = g.module_id
       LEFT JOIN lessons gl ON gl.id = g.lesson_id
       LEFT JOIN modules glm ON glm.id = gl.module_id
      WHERE (g.lesson_id = $1 OR g.module_id = $2 OR g.id IN (
        SELECT grammar_id FROM lesson_grammar_task_items WHERE lesson_id = $3
      )) AND (gm.course_id IS DISTINCT FROM $4::uuid
        OR (g.lesson_id IS NOT NULL AND glm.course_id IS DISTINCT FROM $4::uuid))
      LIMIT 1`, [sourceLessonId, row.task_module_id, row.task_lesson_id, row.source_course_id]);
  if (foreignGrammar.rows.length) return null;
  const [items, pool] = await Promise.all([
    loadTaskConcepts(row.task_lesson_id), loadModulePool(row.task_lesson_id),
  ]);
  const fingerprint = contentRevisionId(items, pool);
  return { taskLessonId: row.task_lesson_id, items, pool, fingerprint,
    published: row.bunpou_flow_published,
    current: companionIsCurrent(row.bunpou_flow_published, fingerprint) };
}

export async function pilotPublicCompanion(sourceLessonId) {
  try {
    const context = await loadCompanionContext(sourceLessonId);
    if (!context?.current) return { objective: null, directions: {}, needsReview: true };
    return publicCompanionView(context.published);
  } catch {
    // An optional companion failure must not take down the original lesson.
    return { objective: null, directions: {}, unavailable: true };
  }
}
