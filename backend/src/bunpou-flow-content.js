import { query } from './db.js';
import { loadTaskConcepts, loadModulePool } from './routes/grammar-task.js';
import { companionIsCurrent, contentRevisionId } from './bunpou-flow-service.js';
import { loadQuestionSets, effectiveDialogChecks } from './bunpou-dialog-checks.js';

export async function loadCompanionContext(sourceLessonId, dbQuery = query) {
  const result = await dbQuery(
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
  const foreignGrammar = await dbQuery(
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
    loadTaskConcepts(row.task_lesson_id, dbQuery), loadModulePool(row.task_lesson_id, dbQuery),
  ]);
  const fingerprint = contentRevisionId(items, pool);
  const published = row.bunpou_flow_published;
  // Soal pemeriksaan dialog yang benar-benar dipakai (lihat
  // bunpou-dialog-checks.js). `v1Published` hanya untuk jalur v1: sama PERSIS
  // dengan publikasinya selama belum ada pola yang pindah ke set pertanyaan
  // 🎭 Dialog, supaya revisi sesi v1 yang sedang berjalan tidak berubah.
  // Jalur v2 tetap membaca `published` apa adanya.
  const questionSets = await loadQuestionSets(sourceLessonId, items.map(item => item.id), dbQuery);
  const effective = effectiveDialogChecks(items.map(item => item.id), questionSets, published?.dialogChecks);
  const v1Published = effective.usesQuestionSet && published
    ? { ...published, dialogChecks: effective.checks } : published;
  return { taskLessonId: row.task_lesson_id, items, pool, fingerprint, published,
    dialogChecks: effective.checks, checkSources: effective.sources, v1Published,
    current: companionIsCurrent(published, fingerprint) };
}
