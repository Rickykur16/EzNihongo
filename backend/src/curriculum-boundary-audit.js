import { createHash, randomUUID } from 'node:crypto';
import { query } from './db.js';
import { BoundaryContextError, createCurriculumBoundaryLoader } from './curriculum-boundary.js';
import { validateContentAgainstBoundary, CURRICULUM_VALIDATOR_VERSION } from './curriculum-boundary-validator.js';
import { decideBoundaryAction } from './curriculum-boundary-policy.js';

export const CURRICULUM_POLICY_VERSION = 'v1';
const CONTENT_TYPES = new Set([
  'grammar_dialog', 'grammar_example', 'vocabulary_example', 'quiz_question', 'reading',
  'dialogue_question', 'dialogue_comprehension', 'dialogue_transfer',
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const stable = value => Array.isArray(value) ? value.map(stable)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
    : value;
const digest = value => `sha256:${createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')}`;

export function validateAuditOptions(options = {}) {
  if (typeof options.course !== 'string' || !options.course.trim()) throw new Error('course_required');
  if (options.moduleId != null && !UUID.test(options.moduleId)) throw new Error('invalid_module_id');
  if (options.lessonId != null && !UUID.test(options.lessonId)) throw new Error('invalid_lesson_id');
  if (options.contentType != null && !CONTENT_TYPES.has(options.contentType)) throw new Error('invalid_content_type');
  if (!Number.isInteger(options.pageSize ?? 100) || (options.pageSize ?? 100) < 1 || (options.pageSize ?? 100) > 500) throw new Error('invalid_page_size');
  if (options.persistReports && !UUID.test(options.auditRunId || '')) throw new Error('persist_requires_run_id');
}

async function resolveCourse(course, dbQuery) {
  const result = await dbQuery(
    `/* boundary-audit:course */ SELECT id,slug,curriculum_boundary_mode
       FROM courses WHERE id::text=$1 OR slug=$1 ORDER BY (id::text=$1) DESC LIMIT 2`, [course]
  );
  if (result.rows.length !== 1) throw new Error(result.rows.length ? 'course_ambiguous' : 'course_not_found');
  return result.rows[0];
}

async function assertRunCompatible({ auditRunId, course, mode }, dbQuery) {
  const result = await dbQuery(`/* boundary-audit:run */
    SELECT DISTINCT course_id,mode,operation,validator_version,policy_version
      FROM curriculum_boundary_reports WHERE audit_run_id=$1 LIMIT 2`, [auditRunId]);
  for (const row of result.rows) {
    if (String(row.course_id) !== String(course.id) || row.mode !== mode || row.operation !== 'audit' ||
        row.validator_version !== CURRICULUM_VALIDATOR_VERSION || row.policy_version !== CURRICULUM_POLICY_VERSION) {
      throw new Error('audit_run_configuration_mismatch');
    }
  }
}

async function loadPage({ courseId, moduleId, lessonId, contentType, cursor, pageSize }, dbQuery) {
  return (await dbQuery(`/* boundary-audit:inventory */
    WITH inventory AS (
      SELECT 'grammar_dialog'::text AS content_type,g.id AS content_id,m.course_id,g.module_id,g.lesson_id,
             g.id AS grammar_id,g.communication_goal,
             jsonb_build_array(
               jsonb_build_object('path','example','text',COALESCE(g.example,''),'language','ja'),
               jsonb_build_object('path','dialogue','text',COALESCE(g.example_dialog,''),'language','ja'),
               jsonb_build_object('path','dialogueTranslation','text',COALESCE(g.example_dialog_id,''),'language','id'),
               jsonb_build_object('path','recognitionDistractors','text',COALESCE(g.recognition_distractors,''),'language','ja'),
               jsonb_build_object('path','controlledDistractors','text',COALESCE(g.controlled_distractors,''),'language','ja')
             ) AS fields
        FROM module_grammar g JOIN modules m ON m.id=g.module_id
      UNION ALL
      SELECT 'dialogue_question',q.id,m.course_id,l.module_id,q.source_lesson_id,q.grammar_id,g.communication_goal,
             jsonb_build_array(
               jsonb_build_object('path','prompt','text',q.prompt,'language','ja'),
               jsonb_build_object('path','explanation','text',q.explanation,'language','id')
             ) || COALESCE((SELECT jsonb_agg(jsonb_build_object('path','options['||(o.ordinality-1)::text||']','text',o.value,'language','ja') ORDER BY o.ordinality)
                              FROM jsonb_array_elements_text(q.options) WITH ORDINALITY o(value,ordinality)),'[]'::jsonb)
        FROM grammar_dialog_questions q JOIN lessons l ON l.id=q.source_lesson_id
        JOIN modules m ON m.id=l.module_id JOIN module_grammar g ON g.id=q.grammar_id
       WHERE q.state='active'
      UNION ALL
      SELECT CASE legacy_check.kind WHEN 'comprehension' THEN 'dialogue_comprehension' ELSE 'dialogue_transfer' END,
             md5(l.id::text||':'||checks.grammar_key||':'||legacy_check.kind)::uuid,
             m.course_id,l.module_id,l.id,
             CASE WHEN checks.grammar_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
                  THEN checks.grammar_key::uuid ELSE NULL END,
             g.communication_goal,
             jsonb_build_array(
               jsonb_build_object('path','prompt','text',COALESCE(legacy_check.question->>'prompt',''),'language','ja'),
               jsonb_build_object('path','explanation','text',COALESCE(legacy_check.question->>'explanation',''),'language','id')
             ) || COALESCE((SELECT jsonb_agg(jsonb_build_object('path','options['||(o.ordinality-1)::text||']','text',o.value,'language','ja') ORDER BY o.ordinality)
                              FROM jsonb_array_elements_text(COALESCE(legacy_check.question->'options','[]'::jsonb)) WITH ORDINALITY o(value,ordinality)),'[]'::jsonb)
        FROM lessons l JOIN modules m ON m.id=l.module_id
        CROSS JOIN LATERAL jsonb_each(COALESCE(l.bunpou_flow_published->'dialogChecks','{}'::jsonb)) checks(grammar_key,questions)
        CROSS JOIN LATERAL (VALUES ('comprehension',checks.questions->'comprehension'),('comparison',checks.questions->'comparison')) legacy_check(kind,question)
        LEFT JOIN module_grammar g ON g.id=CASE
          WHEN checks.grammar_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          THEN checks.grammar_key::uuid END
       WHERE legacy_check.question IS NOT NULL
      UNION ALL
      SELECT 'grammar_example',e.id,m.course_id,g.module_id,g.lesson_id,g.id,NULL,
             jsonb_build_array(jsonb_build_object('path','japanese','text',COALESCE(e.japanese,''),'language','ja'))
        FROM grammar_examples e JOIN module_grammar g ON g.id=e.grammar_id JOIN modules m ON m.id=g.module_id
      UNION ALL
      SELECT 'vocabulary_example',e.id,m.course_id,v.module_id,v.lesson_id,NULL,NULL,
             jsonb_build_array(jsonb_build_object('path','japanese','text',COALESCE(e.japanese,''),'language','ja'))
        FROM vocabulary_examples e JOIN module_vocabulary v ON v.id=e.vocabulary_id JOIN modules m ON m.id=v.module_id
      UNION ALL
      SELECT 'quiz_question',q.id,m.course_id,l.module_id,q.lesson_id,q.grammar_id,NULL,
             jsonb_build_array(
               jsonb_build_object('path','question','text',COALESCE(q.question,''),'language','ja'),
               jsonb_build_object('path','passage','text',COALESCE(q.passage,''),'language','ja'),
               jsonb_build_object('path','audioScript','text',COALESCE(q.audio_script,''),'language','ja'),
               jsonb_build_object('path','explanation','text',COALESCE(q.explanation,''),'language','id')
             ) || COALESCE((SELECT jsonb_agg(jsonb_build_object('path','options['||(o.sort_order)::text||']','text',o.option_text,'language','ja') ORDER BY o.sort_order,o.id)
                              FROM quiz_options o WHERE o.question_id=q.id),'[]'::jsonb)
        FROM quiz_questions q JOIN lessons l ON l.id=q.lesson_id JOIN modules m ON m.id=l.module_id
      UNION ALL
      SELECT 'reading',l.id,m.course_id,l.module_id,l.id,NULL,NULL,
             jsonb_build_array(jsonb_build_object('path','content','text',COALESCE(l.content,''),'language','ja'))
        FROM lessons l JOIN modules m ON m.id=l.module_id WHERE l.content IS NOT NULL
    )
    SELECT * FROM inventory
     WHERE course_id=$1 AND ($2::uuid IS NULL OR module_id=$2) AND ($3::uuid IS NULL OR lesson_id=$3)
       AND ($4::text IS NULL OR content_type=$4)
       AND ($5::text IS NULL OR (content_type,content_id) > ($5,$6::uuid))
     ORDER BY content_type,content_id LIMIT $7`, [
    courseId, moduleId || null, lessonId || null, contentType || null,
    cursor?.contentType || null, cursor?.contentId || '00000000-0000-0000-0000-000000000000', pageSize,
  ])).rows;
}

function unavailableReport(error) {
  if (error instanceof BoundaryContextError) return {
    status: 'context_invalid', valid: null, violations: [], warnings: [], usage: {},
    integrityIssues: [{ code: error.code, severity: 'error', ...error.details }], boundaryFingerprint: null,
    validatorVersion: CURRICULUM_VALIDATOR_VERSION,
  };
  return {
    status: 'unavailable', valid: null, violations: [], warnings: [{ code: 'boundary_unavailable' }],
    usage: {}, integrityIssues: [], boundaryFingerprint: null, validatorVersion: CURRICULUM_VALIDATOR_VERSION,
  };
}

async function persist(item, course, report, decision, options, contentFingerprint, dbQuery) {
  return dbQuery(`/* boundary-audit:report */ INSERT INTO curriculum_boundary_reports
    (course_id,module_id,lesson_id,content_type,content_id,content_fingerprint,boundary_fingerprint,
     validator_version,policy_version,operation,mode,validation_status,decision,
     violations,warnings,usage,integrity_issues,correlation_id,audit_run_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'audit',$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,$17,$18)
    ON CONFLICT DO NOTHING RETURNING id`, [
    course.id, item.module_id, item.lesson_id, item.content_type, item.content_id, contentFingerprint,
    report.boundaryFingerprint, CURRICULUM_VALIDATOR_VERSION, CURRICULUM_POLICY_VERSION,
    course.curriculum_boundary_mode, report.status, decision.decision,
    JSON.stringify(report.violations || []), JSON.stringify(report.warnings || []), JSON.stringify(report.usage || {}),
    JSON.stringify(report.integrityIssues || []), options.correlationId || null, options.auditRunId,
  ]);
}

export async function auditCurriculumBoundary(options, {
  dbQuery = query, loadBoundary = null, onResult = () => {},
} = {}) {
  validateAuditOptions(options);
  const pageSize = options.pageSize ?? 100;
  const course = await resolveCourse(options.course.trim(), dbQuery);
  const mode = course.curriculum_boundary_mode;
  if (!['off', 'audit', 'warn', 'enforce'].includes(mode)) throw new Error('invalid_course_boundary_mode');
  if (options.persistReports) await assertRunCompatible({ auditRunId: options.auditRunId, course, mode }, dbQuery);
  const boundaryLoader = loadBoundary || createCurriculumBoundaryLoader({ dbQuery });
  const summary = {
    schemaVersion: 1, dryRun: !options.persistReports, auditRunId: options.auditRunId || randomUUID(),
    course: { id: String(course.id), slug: course.slug, mode }, scanned: 0, insertedReports: 0,
    skippedReports: 0, evaluated: 0, unavailable: 0, valid: 0, violations: 0, warnings: 0,
    coverage: { complete: true, mappingGaps: 0, surfaces: [...CONTENT_TYPES].sort() },
  };
  let cursor = null;
  for (;;) {
    const rows = await loadPage({ courseId: course.id, moduleId: options.moduleId, lessonId: options.lessonId,
      contentType: options.contentType, cursor, pageSize }, dbQuery);
    if (!rows.length) break;
    for (const item of rows) {
      const fields = Array.isArray(item.fields) ? item.fields : JSON.parse(item.fields);
      const contentFingerprint = digest({ contentType: item.content_type, fields, communicationGoal: item.communication_goal });
      let report;
      try {
        const grammarOwnsScope = ['grammar_dialog', 'grammar_example'].includes(item.content_type);
        const boundary = await boundaryLoader({ courseId: String(course.id), moduleId: String(item.module_id),
          lessonId: item.lesson_id ? String(item.lesson_id) : null,
          grammarId: grammarOwnsScope && item.grammar_id ? String(item.grammar_id) : null });
        report = validateContentAgainstBoundary({
          boundary, contentType: item.content_type, operation: 'audit', fields,
          communicationGoal: item.communication_goal,
          verifiedGrammarIds: item.grammar_id ? [String(item.grammar_id)] : [],
        });
      } catch (error) { report = unavailableReport(error); }
      if (['dialogue_comprehension', 'dialogue_transfer', 'dialogue_question'].includes(item.content_type) && !item.grammar_id) {
        report.warnings.push({ code: 'grammar_mapping_unresolved', confidence: 'unknown' });
        summary.coverage.mappingGaps++;
        summary.coverage.complete = false;
      }
      const decision = decideBoundaryAction({ mode, operation: 'audit', report, contentIsNewOrChanged: false });
      const output = { contentType: item.content_type, contentId: String(item.content_id), contentFingerprint,
        boundaryFingerprint: report.boundaryFingerprint, report, decision };
      onResult(output);
      summary.scanned++;
      summary[report.status === 'evaluated' ? 'evaluated' : 'unavailable']++;
      if (report.status !== 'evaluated') summary.coverage.complete = false;
      if (report.valid === true) summary.valid++;
      summary.violations += report.violations?.length || 0;
      summary.warnings += report.warnings?.length || 0;
      if (options.persistReports) {
        const inserted = await persist(item, course, report, decision, options, contentFingerprint, dbQuery);
        if (inserted.rowCount) summary.insertedReports++; else summary.skippedReports++;
      }
    }
    const last = rows.at(-1);
    cursor = { contentType: last.content_type, contentId: String(last.content_id) };
    if (rows.length < pageSize) break;
  }
  return summary;
}
