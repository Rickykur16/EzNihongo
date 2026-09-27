import { createHash, randomUUID } from 'node:crypto';
import { withTransaction } from './db.js';
import { lockCurriculumCourse } from './curriculum-content-service.js';
import { getCurriculumBoundary, hasBlockingIntegrityIssues } from './curriculum-boundary.js';
import { validateContentAgainstBoundary, CURRICULUM_VALIDATOR_VERSION } from './curriculum-boundary-validator.js';
import { companionIsCurrent, contentRevisionId, dialogCheckAvailability,
  dialogCheckFamilyId, validateDialogCheckQuestion } from './bunpou-flow-service.js';
import { loadTaskConcepts, loadModulePool } from './routes/grammar-task.js';
import { dialogueFingerprint, dialogueTurns, questionFingerprint } from './dialogue-question-service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const stable = value => Array.isArray(value) ? `[${value.map(stable).join(',')}]` :
  value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}` : JSON.stringify(value ?? null);
const hash = value => `sha256:${createHash('sha256').update(stable(value)).digest('hex')}`;
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
const result = (scope, legacyKind, status, details = {}) => ({ ...scope, legacyKind, status, ...details });
const fail = code => { throw new Error(code); };

export function validateBackfillScope({ courseIds = [], moduleIds = [], lessonIds = [],
  apply = false, runId } = {}) {
  if (![courseIds, moduleIds, lessonIds].every(ids => Array.isArray(ids) &&
      ids.length <= 500 && ids.every(id => typeof id === 'string' && UUID.test(id) &&
        id === id.toLowerCase()) && new Set(ids).size === ids.length) ||
      !courseIds.length || !UUID.test(String(runId || '')) ||
      typeof apply !== 'boolean') fail('backfill_scope_invalid');
  return { courseIds: [...courseIds].sort(), moduleIds: [...moduleIds].sort(),
    lessonIds: [...lessonIds].sort(), apply, runId };
}

export function legacySourceKey({ sourceLessonId, grammarId, legacyKind, slot = 0 }) {
  return `legacy_bunpou:v1:${sourceLessonId}:${grammarId}:${legacyKind}:${slot}`;
}

export function assessLegacyQuestion({ check, legacyKind, grammar, sourceLessonId,
  publishedFingerprint, boundary, validate = validateContentAgainstBoundary }) {
  const kind = legacyKind === 'comparison' ? 'transfer' : 'comprehension';
  const raw = check?.[legacyKind];
  const base = { sourceLessonId, grammarId: grammar.id, kind };
  if (!plain(raw)) return result(base, legacyKind, 'missing');
  const available = dialogCheckAvailability(check);
  const structural = validateDialogCheckQuestion(raw, legacyKind);
  if (!structural.ok || !available.available) {
    return result(base, legacyKind, 'invalid_legacy_question',
      { issues: structural.ok ? [available.reason, ...(available.errors || [])] : structural.errors });
  }
  if (!Number.isInteger(raw.correctIndex)) {
    return result(base, legacyKind, 'needs_editor_review',
      { issues: ['correct_index_type_invalid'] });
  }
  // The legacy sanitizer did not invent evidence or explanation. A missing
  // field is an editorial task, never a license to fabricate a grounding.
  if (typeof raw.explanation !== 'string' || !raw.explanation.trim() ||
      (kind === 'comprehension' && (!Array.isArray(raw.evidence) ||
        raw.evidence.length < 1 || raw.evidence.length > 6))) {
    return result(base, legacyKind, 'needs_editor_review',
      { issues: [kind === 'comprehension' ? 'evidence_or_explanation_missing' : 'explanation_missing'] });
  }
  if (kind === 'transfer' && raw.evidence != null) {
    return result(base, legacyKind, 'needs_editor_review', { issues: ['transfer_evidence_unexpected'] });
  }
  const turns = dialogueTurns(grammar);
  if (kind === 'comprehension' && raw.evidence.some(entry => !plain(entry) ||
      Object.keys(entry).some(key => !['turnIndex', 'quote'].includes(key)) ||
      !Number.isInteger(entry.turnIndex) || entry.turnIndex < 0 ||
      typeof entry.quote !== 'string' || !entry.quote.trim() ||
      !turns[entry.turnIndex]?.text.includes(entry.quote))) {
    return result(base, legacyKind, 'needs_editor_review', { issues: ['evidence_not_grounded'] });
  }
  // Preserve every authored byte. Normalization here is for validation only;
  // stored text/options/key/explanation come directly from published JSON.
  const candidate = { kind, prompt: raw.prompt, options: raw.options,
    correctIndex: raw.correctIndex, explanation: raw.explanation,
    evidence: kind === 'comprehension' ? raw.evidence : null };
  if (typeof candidate.prompt !== 'string' || candidate.prompt !== candidate.prompt.trim() ||
      candidate.prompt.length > 2000 || candidate.explanation.length > 2000 ||
      candidate.explanation !== candidate.explanation.trim() ||
      candidate.options.some(option => typeof option !== 'string' || option !== option.trim() ||
        option.length > 500)) {
    return result(base, legacyKind, 'needs_editor_review', { issues: ['authored_text_requires_review'] });
  }
  const fields = [{ path: 'question.prompt', text: candidate.prompt },
    ...candidate.options.map((text, index) => ({ path: `question.options[${index}]`, text })),
    { path: 'question.explanation', text: candidate.explanation },
    ...(candidate.evidence || []).map((entry, index) =>
      ({ path: `question.evidence[${index}].quote`, text: entry.quote }))];
  const report = validate({ boundary,
    contentType: kind === 'comprehension' ? 'dialogue_comprehension' : 'dialogue_transfer',
    operation: 'audit', fields, question: { prompt: candidate.prompt,
      options: candidate.options, correctIndex: candidate.correctIndex },
    verifiedGrammarIds: [grammar.id], focusGrammarIds: [grammar.id] });
  if (report.status !== 'evaluated' || report.valid !== true ||
      report.warnings?.some(warning => warning.code === 'target_grammar_unverified')) {
    return result(base, legacyKind, 'boundary_rejected', { issues: report.violations || [],
      boundaryFingerprint: report.boundaryFingerprint || null });
  }
  const sourceKey = legacySourceKey({ sourceLessonId, grammarId: grammar.id, legacyKind });
  return result(base, legacyKind, 'ready', { candidate, sourceKey,
    sourceFingerprint: hash({ version: 1, sourceLessonId, grammarId: grammar.id,
      legacyKind, publishedFingerprint, dialogueFingerprint: dialogueFingerprint(grammar), raw }),
    questionFingerprint: questionFingerprint(candidate),
    dialogueFingerprint: dialogueFingerprint(grammar),
    boundaryFingerprint: report.boundaryFingerprint || null });
}

async function scopedLessons(client, scope) {
  const courses = await client.query('SELECT id FROM courses WHERE id=ANY($1::uuid[])',
    [scope.courseIds]);
  const modules = await client.query('SELECT id,course_id FROM modules WHERE id=ANY($1::uuid[])',
    [scope.moduleIds]);
  const lessons = await client.query(`SELECT l.id,l.module_id,m.course_id FROM lessons l
    JOIN modules m ON m.id=l.module_id WHERE l.id=ANY($1::uuid[])`, [scope.lessonIds]);
  for (const [expected, rows] of [[scope.courseIds, courses.rows],
    [scope.moduleIds, modules.rows], [scope.lessonIds, lessons.rows]]) {
    if (expected.length !== rows.length) fail('backfill_scope_id_missing');
  }
  if (modules.rows.some(row => !scope.courseIds.includes(row.course_id)) ||
      lessons.rows.some(row => !scope.courseIds.includes(row.course_id) ||
        (scope.moduleIds.length && !scope.moduleIds.includes(row.module_id)))) {
    fail('backfill_scope_owner_mismatch');
  }
  return (await client.query(`SELECT s.id AS source_lesson_id,s.module_id,m.course_id
    FROM lessons s JOIN modules m ON m.id=s.module_id
    WHERE ($1::uuid[]='{}'::uuid[] OR m.course_id=ANY($1::uuid[]))
      AND ($2::uuid[]='{}'::uuid[] OR s.module_id=ANY($2::uuid[]))
      AND ($3::uuid[]='{}'::uuid[] OR s.id=ANY($3::uuid[]))
      AND (s.bunpou_flow_published IS NOT NULL OR s.bunpou_flow_draft IS NOT NULL
        OR EXISTS (SELECT 1 FROM lessons t WHERE t.popup_after_lesson_id=s.id
          AND t.type='grammar_task'))
    ORDER BY m.course_id,s.module_id,s.id`,
  [scope.courseIds, scope.moduleIds, scope.lessonIds])).rows;
}

async function inspectLesson(client, lesson, {
  resolveBoundary, validate, apply, validationRefreshOnly = false,
}) {
  const prefix = { courseId: lesson.course_id, moduleId: lesson.module_id,
    sourceLessonId: lesson.source_lesson_id };
  const sources = (await client.query(`SELECT s.id,s.module_id,s.bunpou_flow_published,
      s.bunpou_flow_draft,t.id AS task_lesson_id,t.module_id AS task_module_id
    FROM lessons s LEFT JOIN lessons t ON t.popup_after_lesson_id=s.id
      AND t.type='grammar_task'
    WHERE s.id=$1 ORDER BY t.id ${apply ? 'FOR SHARE OF s' : ''}`,
  [lesson.source_lesson_id])).rows;
  if (sources.length !== 1 || !sources[0].task_lesson_id ||
      sources[0].task_module_id !== lesson.module_id ||
      sources[0].module_id !== lesson.module_id) {
    return [result(prefix, null, 'source_mapping_ambiguous')];
  }
  const source = sources[0];
  const draftPresent = source.bunpou_flow_draft != null;
  if (!source.bunpou_flow_published) return [result(prefix, null, 'published_missing',
    { draftPresent })];
  const dbQuery = client.query.bind(client);
  const items = await loadTaskConcepts(source.task_lesson_id, dbQuery);
  const pool = await loadModulePool(source.task_lesson_id, dbQuery);
  const published = source.bunpou_flow_published;
  const publishedFingerprint = contentRevisionId(items, pool);
  if (!companionIsCurrent(published, publishedFingerprint)) {
    return [result(prefix, null, 'published_stale', { draftPresent })];
  }
  const checks = published.dialogChecks;
  if (!plain(checks)) return [result(prefix, null, 'published_checks_missing', { draftPresent })];
  const itemIds = new Set(items.map(item => item.id));
  const own = (await client.query('SELECT id FROM module_grammar WHERE lesson_id=$1',
    [source.id])).rows.map(row => row.id);
  const known = new Set([...itemIds, ...own]);
  const outputs = [];
  for (const grammarId of Object.keys(checks).sort()) {
    const scope = { ...prefix, grammarId };
    if (!UUID.test(grammarId) || !known.has(grammarId)) {
      outputs.push(result(scope, null, 'grammar_scope_invalid')); continue;
    }
    const grammar = (await client.query(`SELECT g.*,m.course_id FROM module_grammar g
      JOIN modules m ON m.id=g.module_id WHERE g.id=$1
      ${apply ? 'FOR SHARE OF g' : ''}`, [grammarId])).rows[0];
    if (!grammar || grammar.module_id !== lesson.module_id ||
        grammar.course_id !== lesson.course_id ||
        (grammar.lesson_id && grammar.lesson_id !== source.id) ||
        !dialogueTurns(grammar).some(turn => turn.text)) {
      outputs.push(result(scope, null, 'grammar_source_invalid')); continue;
    }
    if (!grammar.lesson_id) {
      const candidates = (await client.query(`SELECT DISTINCT s.id FROM lessons s
        JOIN lessons t ON t.popup_after_lesson_id=s.id AND t.type='grammar_task'
        JOIN lesson_grammar_task_items i ON i.lesson_id=t.id AND i.grammar_id=$1
        WHERE s.module_id=$2 ORDER BY s.id`, [grammarId, lesson.module_id])).rows;
      if (candidates.length !== 1 || candidates[0].id !== source.id) {
        outputs.push(result(scope, null, 'grammar_source_ambiguous')); continue;
      }
    }
    // A PostgreSQL error leaves this transaction aborted; propagating it
    // prevents a misleading success report or partial commit.
    const boundary = await resolveBoundary({ lessonId: source.id, grammarId }, { dbQuery });
    if (boundary.course?.id !== lesson.course_id ||
        boundary.currentModule?.id !== lesson.module_id || hasBlockingIntegrityIssues(boundary)) {
      outputs.push(result(scope, null, 'boundary_context_invalid')); continue;
    }
    const sourceKeys = ['comprehension', 'comparison'].map(legacyKind => legacySourceKey({
      sourceLessonId: source.id, grammarId, legacyKind }));
    const existing = (await client.query(`SELECT * FROM grammar_dialog_questions
      WHERE grammar_id=$1 OR (source_kind='legacy_bunpou' AND source_key=ANY($2::text[]))
      ORDER BY id ${apply ? 'FOR UPDATE' : ''}`, [grammarId, sourceKeys])).rows;
    for (const legacyKind of ['comprehension', 'comparison']) {
      const assessed = assessLegacyQuestion({ check: checks[grammarId], legacyKind,
        grammar, sourceLessonId: source.id, publishedFingerprint, boundary, validate });
      if (assessed.status !== 'ready') { outputs.push({ ...prefix, ...assessed }); continue; }
      const same = existing.find(row => row.source_kind === 'legacy_bunpou' &&
        row.source_key === assessed.sourceKey);
      if (same) {
        if (same.source_fingerprint !== assessed.sourceFingerprint) {
          outputs.push(result(scope, legacyKind, 'source_changed', { questionId: same.id,
            sourceKey: assessed.sourceKey, sourceFingerprint: assessed.sourceFingerprint,
            questionFingerprint: assessed.questionFingerprint })); continue;
        }
        const contentChanged = same.state !== 'active' || same.grammar_id !== grammarId ||
          same.source_lesson_id !== source.id || same.kind !== assessed.kind ||
          same.sort_order !== 0 ||
          same.question_fingerprint !== assessed.questionFingerprint ||
          same.dialogue_fingerprint !== assessed.dialogueFingerprint ||
          same.prompt !== assessed.candidate.prompt ||
          stable(same.options) !== stable(assessed.candidate.options) ||
          same.correct_index !== assessed.candidate.correctIndex ||
          same.explanation !== assessed.candidate.explanation ||
          stable(same.evidence) !== stable(assessed.candidate.evidence);
        if (contentChanged) {
          outputs.push(result(scope, legacyKind, 'edited_conflict', { questionId: same.id,
            sourceKey: assessed.sourceKey, sourceFingerprint: assessed.sourceFingerprint,
            questionFingerprint: assessed.questionFingerprint })); continue;
        }
        const reviewChanged = same.boundary_fingerprint !== assessed.boundaryFingerprint ||
          same.validator_version !== CURRICULUM_VALIDATOR_VERSION;
        if (reviewChanged && validationRefreshOnly) {
          if (!apply) fail('validation_refresh_requires_apply');
          const refreshed = await client.query(`UPDATE grammar_dialog_questions
            SET boundary_fingerprint=$2,validator_version=$3
            WHERE id=$1 AND state='active' AND source_kind='legacy_bunpou'
              AND source_key=$4 AND source_fingerprint=$5
              AND question_fingerprint=$6 AND dialogue_fingerprint=$7
              AND boundary_fingerprint IS NOT DISTINCT FROM $8
              AND validator_version IS NOT DISTINCT FROM $9
            RETURNING id,question_version,boundary_fingerprint,validator_version`,
          [same.id, assessed.boundaryFingerprint, CURRICULUM_VALIDATOR_VERSION,
            assessed.sourceKey, assessed.sourceFingerprint, assessed.questionFingerprint,
            assessed.dialogueFingerprint, same.boundary_fingerprint, same.validator_version]);
          const updated = refreshed.rows[0];
          if (refreshed.rowCount !== 1 || updated?.id !== same.id ||
              updated.question_version !== same.question_version ||
              updated.boundary_fingerprint !== assessed.boundaryFingerprint ||
              updated.validator_version !== CURRICULUM_VALIDATOR_VERSION) {
            fail('validation_refresh_conflict');
          }
          outputs.push(result(scope, legacyKind, 'review_refreshed', { questionId: same.id,
            sourceKey: assessed.sourceKey, sourceFingerprint: assessed.sourceFingerprint,
            questionFingerprint: assessed.questionFingerprint })); continue;
        }
        outputs.push(result(scope, legacyKind, reviewChanged ? 'edited_conflict' : 'already_present', {
          questionId: same.id,
          sourceKey: assessed.sourceKey,
          sourceFingerprint: assessed.sourceFingerprint,
          questionFingerprint: assessed.questionFingerprint })); continue;
      }
      const active = existing.filter(row => row.grammar_id === grammarId && row.state === 'active');
      const sameFamily = active.some(row => row.options &&
        dialogCheckFamilyId({ options: row.options, correctIndex: row.correct_index }) ===
        dialogCheckFamilyId(assessed.candidate));
      if (active.some(row => row.kind === assessed.kind && row.sort_order === 0) ||
          active.filter(row => row.kind === assessed.kind).length >=
            (assessed.kind === 'comprehension' ? 2 : 1) || sameFamily) {
        outputs.push(result(scope, legacyKind, 'skipped_conflict',
          { sourceKey: assessed.sourceKey })); continue;
      }
      if (!apply || validationRefreshOnly) {
        outputs.push(result(scope, legacyKind, 'would_insert',
          { sourceKey: assessed.sourceKey, sourceFingerprint: assessed.sourceFingerprint,
            questionFingerprint: assessed.questionFingerprint }));
        continue;
      }
      const id = randomUUID(), version = randomUUID(), q = assessed.candidate;
      await client.query(`INSERT INTO grammar_dialog_questions
        (id,grammar_id,source_lesson_id,kind,prompt,options,correct_index,explanation,
         sort_order,question_version,question_fingerprint,dialogue_fingerprint,evidence,
         source_kind,source_key,source_fingerprint,boundary_fingerprint,validator_version,state)
        VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,0,$9,$10,$11,$12::jsonb,
          'legacy_bunpou',$13,$14,$15,$16,'active')`,
      [id, grammarId, source.id, q.kind, q.prompt, JSON.stringify(q.options),
        q.correctIndex, q.explanation, version, assessed.questionFingerprint,
        assessed.dialogueFingerprint, q.evidence ? JSON.stringify(q.evidence) : null,
        assessed.sourceKey, assessed.sourceFingerprint, assessed.boundaryFingerprint,
        CURRICULUM_VALIDATOR_VERSION]);
      const saved = (await client.query(`SELECT * FROM grammar_dialog_questions WHERE id=$1`, [id])).rows[0];
      if (!saved || saved.question_fingerprint !== assessed.questionFingerprint ||
          saved.prompt !== q.prompt || stable(saved.options) !== stable(q.options) ||
          saved.correct_index !== q.correctIndex || saved.explanation !== q.explanation ||
          saved.dialogue_fingerprint !== assessed.dialogueFingerprint ||
          stable(saved.evidence) !== stable(q.evidence)) fail('backfill_post_insert_verification_failed');
      outputs.push(result(scope, legacyKind, 'inserted', { questionId: id,
        sourceKey: assessed.sourceKey, sourceFingerprint: assessed.sourceFingerprint,
        questionFingerprint: assessed.questionFingerprint }));
      existing.push(saved);
    }
  }
  return outputs;
}

export async function backfillDialogueQuestions(options, {
  transaction = withTransaction, resolveBoundary = getCurriculumBoundary,
  validate = validateContentAgainstBoundary, lockCourse = lockCurriculumCourse,
  validationRefreshOnly = false,
} = {}) {
  const scope = validateBackfillScope(options);
  const lessons = await transaction(async client => {
    if (!scope.apply) await client.query('SET TRANSACTION READ ONLY');
    return scopedLessons(client, scope);
  });
  const rows = [];
  for (const lesson of lessons) {
    const batch = await transaction(async client => {
      if (!scope.apply) await client.query('SET TRANSACTION READ ONLY');
      if (scope.apply) await lockCourse(client, lesson.course_id);
      return inspectLesson(client, lesson, {
        resolveBoundary, validate, apply: scope.apply, validationRefreshOnly,
      });
    });
    rows.push(...batch);
  }
  const counts = Object.fromEntries([...new Set(rows.map(row => row.status))].sort().map(status =>
    [status, rows.filter(row => row.status === status).length]));
  return { runId: scope.runId, dryRun: !scope.apply, scope: {
    courseIds: scope.courseIds, moduleIds: scope.moduleIds, lessonIds: scope.lessonIds },
  lessonCount: lessons.length, counts, rows,
  sourceChecksum: hash(rows.filter(row => row.sourceKey).map(row => ({
    sourceKey: row.sourceKey, sourceFingerprint: row.sourceFingerprint || null,
    questionFingerprint: row.questionFingerprint || null }))),
  checksum: hash(rows.map(row => ({ courseId: row.courseId, moduleId: row.moduleId,
    sourceLessonId: row.sourceLessonId, grammarId: row.grammarId || null,
    legacyKind: row.legacyKind, status: row.status, sourceKey: row.sourceKey || null,
    sourceFingerprint: row.sourceFingerprint || null }))) };
}
