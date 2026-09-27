import { withTransaction } from './db.js';
import { lockCurriculumCourse } from './curriculum-content-service.js';
import { loadTaskConcepts, loadModulePool } from './routes/grammar-task.js';
import { contentRevisionId, validateCompanionEnvelope } from './bunpou-flow-service.js';
import { backfillDialogueQuestions } from './dialogue-question-backfill.js';
import { learningFlowReadiness } from './learning-flow-config.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SOURCE_SLUGS = ['bunpou-n5-b3', 'bunpou2-n5-b3'];

class DryRunComplete extends Error {
  constructor(report) { super('bab3_preparation_dry_run_complete'); this.report = report; }
}

const fail = code => { throw new Error(code); };

export function validateBab3PreparationOptions({ courseId, moduleId, runId, apply = false } = {}) {
  if (![courseId, moduleId, runId].every(value => typeof value === 'string' &&
      UUID.test(value) && value === value.toLowerCase()) || typeof apply !== 'boolean') {
    fail('bab3_preparation_scope_invalid');
  }
  return { courseId, moduleId, runId, apply };
}

export async function prepareBab3LearningFlow(options, {
  transaction = withTransaction,
  lockCourse = lockCurriculumCourse,
  loadItems = loadTaskConcepts,
  loadPool = loadModulePool,
  validateEnvelope = validateCompanionEnvelope,
  backfill = backfillDialogueQuestions,
  readiness = learningFlowReadiness,
} = {}) {
  const scope = validateBab3PreparationOptions(options);
  try {
    return await transaction(async client => {
      await lockCourse(client, scope.courseId);
      const owner = (await client.query(`SELECT c.id AS course_id,c.slug AS course_slug,
          m.id AS module_id,m.slug AS module_slug
        FROM courses c JOIN modules m ON m.course_id=c.id
        WHERE c.id=$1 AND m.id=$2 FOR SHARE OF c,m`,
      [scope.courseId, scope.moduleId])).rows;
      if (owner.length !== 1 || owner[0].course_slug !== 'n5' || owner[0].module_slug !== 'n5-b3') {
        fail('bab3_preparation_owner_mismatch');
      }

      const snapshot = (await client.query(`SELECT md5(
          coalesce((SELECT jsonb_agg((to_jsonb(g) - 'created_at' - 'updated_at') ORDER BY g.id)
            FROM module_grammar g WHERE g.module_id=$1), '[]'::jsonb)::text
          || '|' ||
          coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.lesson_id,i.sort_order,i.grammar_id)
            FROM lesson_grammar_task_items i JOIN lessons t ON t.id=i.lesson_id
            WHERE t.module_id=$1), '[]'::jsonb)::text
        ) AS source_snapshot_md5`, [scope.moduleId])).rows[0]?.source_snapshot_md5;
      if (typeof snapshot !== 'string' || !/^[0-9a-f]{32}$/u.test(snapshot)) {
        fail('bab3_preparation_snapshot_unavailable');
      }

      const sources = (await client.query(`SELECT s.id,s.slug,s.bunpou_flow_draft,
          s.bunpou_flow_published,t.id AS task_lesson_id,
          md5((s.bunpou_flow_draft - 'sourceFingerprint' - 'preparationReview')::text)
            AS draft_payload_md5,
          md5((s.bunpou_flow_published - 'sourceFingerprint' - 'preparationReview')::text)
            AS published_payload_md5
        FROM lessons s JOIN lessons t ON t.popup_after_lesson_id=s.id
          AND t.type='grammar_task' AND t.module_id=s.module_id
        WHERE s.module_id=$1 AND s.slug=ANY($2::text[])
        ORDER BY s.slug,t.id FOR SHARE OF s,t`, [scope.moduleId, SOURCE_SLUGS])).rows;
      if (sources.length !== 2 || new Set(sources.map(row => row.slug)).size !== 2 ||
          sources.some(row => !SOURCE_SLUGS.includes(row.slug))) {
        fail('bab3_preparation_source_mapping_invalid');
      }

      const refreshed = [];
      for (const source of sources) {
        if (!source.bunpou_flow_published || !source.bunpou_flow_draft) {
          fail('bab3_preparation_companion_missing');
        }
        const draftReview = source.bunpou_flow_draft.preparationReview;
        const publishedReview = source.bunpou_flow_published.preparationReview;
        if (source.bunpou_flow_draft.editor?.email !==
              'migration/174_prepare_bab3_learning_flow.sql' ||
            source.bunpou_flow_published.publishedBy?.email !==
              'migration/174_prepare_bab3_learning_flow.sql' ||
            !draftReview || JSON.stringify(draftReview) !== JSON.stringify(publishedReview) ||
            draftReview.version !== 1 ||
            draftReview.migration !== '174_prepare_bab3_learning_flow.sql' ||
            draftReview.sourceSnapshotMd5 !== snapshot ||
            draftReview.draftPayloadMd5 !== source.draft_payload_md5 ||
            draftReview.publishedPayloadMd5 !== source.published_payload_md5) {
          fail('bab3_preparation_review_snapshot_changed');
        }
        const dbQuery = client.query.bind(client);
        const [items, pool] = await Promise.all([
          loadItems(source.task_lesson_id, dbQuery), loadPool(source.task_lesson_id, dbQuery),
        ]);
        if (items.length !== 3 || new Set(items.map(item => item.id)).size !== 3) {
          fail('bab3_preparation_task_items_invalid');
        }
        const known = items.map(item => item.id);
        const published = { ...source.bunpou_flow_published,
          sourceFingerprint: contentRevisionId(items, pool) };
        const draft = { ...source.bunpou_flow_draft,
          sourceFingerprint: published.sourceFingerprint };
        for (const envelope of [published, draft]) {
          const structural = validateEnvelope(envelope, known);
          if (!structural.ok) fail(`bab3_preparation_companion_invalid:${structural.errors.join('|')}`);
          if (Object.keys(envelope.dialogChecks || {}).length !== 3 ||
              Object.values(envelope.dialogChecks || {}).some(check =>
                !Array.isArray(check?.comprehension?.evidence) ||
                check.comprehension.evidence.length < 1 || check.comparison?.evidence != null)) {
            fail('bab3_preparation_reviewed_checks_missing');
          }
        }
        const updated = await client.query(`UPDATE lessons
          SET bunpou_flow_draft=$2::jsonb,bunpou_flow_published=$3::jsonb,updated_at=NOW()
          WHERE id=$1`, [source.id, JSON.stringify(draft), JSON.stringify(published)]);
        if (updated.rowCount !== 1) fail('bab3_preparation_companion_refresh_failed');
        refreshed.push({ sourceLessonId: source.id, taskLessonId: source.task_lesson_id,
          sourceFingerprint: published.sourceFingerprint });
      }

      const nestedTransaction = fn => fn(client);
      const questionReport = await backfill({
        courseIds: [scope.courseId], moduleIds: [scope.moduleId],
        lessonIds: sources.map(row => row.id), runId: scope.runId, apply: true,
      }, { transaction: nestedTransaction, lockCourse: async () => {} });
      const accepted = new Set(['inserted', 'already_present']);
      if (questionReport.lessonCount !== 2 || questionReport.rows.length !== 12 ||
          questionReport.rows.some(row => !accepted.has(row.status))) {
        fail('bab3_preparation_question_backfill_not_clean');
      }

      const readinessReport = await readiness(client, {
        enabled: true, courseIds: [], moduleIds: [scope.moduleId], lessonIds: [],
      });
      if (!readinessReport.ready || readinessReport.lessons.length !== 2) {
        const error = new Error('bab3_preparation_readiness_failed');
        error.readiness = readinessReport;
        throw error;
      }

      const counts = { ...questionReport.counts };
      if (!scope.apply && counts.inserted) {
        counts.would_insert = counts.inserted;
        delete counts.inserted;
      }
      const report = { type: 'bab3_preparation', runId: scope.runId,
        dryRun: !scope.apply, courseId: scope.courseId, moduleId: scope.moduleId,
        companion: refreshed.map(row => ({ ...row,
          status: scope.apply ? 'refreshed' : 'would_refresh' })),
        questions: { counts, sourceChecksum: questionReport.sourceChecksum,
          checksum: questionReport.checksum },
        readiness: readinessReport };
      if (!scope.apply) throw new DryRunComplete(report);
      return report;
    });
  } catch (error) {
    if (error instanceof DryRunComplete) return error.report;
    throw error;
  }
}
