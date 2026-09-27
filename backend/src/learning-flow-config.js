import { createHash } from 'node:crypto';
import { withTransaction } from './db.js';
import { loadTaskConcepts, loadModulePool } from './routes/grammar-task.js';
import { companionIsCurrent, contentRevisionId } from './bunpou-flow-service.js';
import { dialogueFingerprint, dialogueTurns, questionFingerprint } from './dialogue-question-service.js';
import { getCurriculumBoundary } from './curriculum-boundary.js';
import { CURRICULUM_VALIDATOR_VERSION,
  validateContentAgainstBoundary } from './curriculum-boundary-validator.js';
import { lockCurriculumCourses } from './curriculum-content-service.js';

export const FLOW_SETTING_KEY = 'learning_flow_communication_v1';
// PR6 is passive. PR7 must deliberately replace this capability only after
// the v2 session/asset/resume path exists and its tests pass.
export const V2_RUNTIME_AVAILABLE = false;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const EMPTY = Object.freeze({ enabled: false, courseIds: [], moduleIds: [], lessonIds: [] });
const hash = (raw, rowRevision = null) => `sha256:${createHash('sha256')
  .update(JSON.stringify({ raw: raw ?? null, rowRevision })).digest('hex')}`;
const issue = code => ({ code });
const visibleFields = (path, value) => {
  if (typeof value === 'string') return [{ path, text: value }];
  if (Array.isArray(value)) return value.flatMap((entry, index) =>
    visibleFields(`${path}[${index}]`, entry));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, entry]) =>
    visibleFields(`${path}.${key}`, entry));
  return [];
};
const fail = (status, code, readiness = null) => {
  const error = new Error(code); error.status = status; error.readiness = readiness; throw error;
};

export function parseLearningFlowConfig(raw) {
  let value;
  try { value = typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch { fail(400, 'flow_config_invalid'); }
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== 'courseIds,enabled,lessonIds,moduleIds' ||
      typeof value.enabled !== 'boolean') fail(400, 'flow_config_invalid');
  const config = { enabled: value.enabled };
  for (const key of ['courseIds', 'moduleIds', 'lessonIds']) {
    const ids = value[key];
    if (!Array.isArray(ids) || ids.length > 500 ||
        ids.some(id => typeof id !== 'string' || !UUID.test(id) || id !== id.toLowerCase()) ||
        new Set(ids).size !== ids.length) fail(400, 'flow_config_invalid');
    config[key] = [...ids].sort();
  }
  if (config.enabled && ![config.courseIds, config.moduleIds, config.lessonIds]
    .some(ids => ids.length)) fail(400, 'flow_scope_required');
  return config;
}

export async function loadLearningFlowConfig(client, { locked = false, shared = false } = {}) {
  const row = (await client.query(`SELECT value,xmin::text AS row_revision FROM app_settings WHERE key=$1
    ${locked ? 'FOR UPDATE' : shared ? 'FOR SHARE' : ''}`, [FLOW_SETTING_KEY])).rows[0];
  const configRevision = hash(row?.value ?? null, row?.row_revision ?? null);
  if (!row) return { config: { ...EMPTY }, configRevision, diagnostic: 'flow_config_missing' };
  try { return { config: parseLearningFlowConfig(row.value), configRevision, diagnostic: null }; }
  catch { return { config: { ...EMPTY }, configRevision, diagnostic: 'flow_config_invalid' }; }
}

export function flowScopeAllows(config, { courseId, moduleId, lessonId }) {
  return !!config?.enabled && (config.courseIds.includes(courseId) ||
    config.moduleIds.includes(moduleId) || config.lessonIds.includes(lessonId));
}

async function scopedLessons(client, config) {
  const ids = [config.courseIds, config.moduleIds, config.lessonIds];
  const [courses, modules, lessons] = await Promise.all([
    client.query('SELECT id FROM courses WHERE id=ANY($1::uuid[])', [ids[0]]),
    client.query('SELECT id,course_id FROM modules WHERE id=ANY($1::uuid[])', [ids[1]]),
    client.query(`SELECT l.id,l.module_id,l.type,m.course_id FROM lessons l
      JOIN modules m ON m.id=l.module_id WHERE l.id=ANY($1::uuid[])`, [ids[2]]),
  ]);
  const issues = [];
  for (const [key, wanted, found] of [
    ['course', ids[0], courses.rows], ['module', ids[1], modules.rows], ['lesson', ids[2], lessons.rows],
  ]) {
    const have = new Set(found.map(row => row.id));
    for (const id of wanted) if (!have.has(id)) issues.push({ code: 'flow_scope_id_missing', kind: key, id });
  }
  for (const row of lessons.rows) if (!['video', 'text'].includes(row.type)) {
    issues.push({ code: 'flow_scope_lesson_type_invalid', kind: 'lesson', id: row.id });
  }
  if (issues.length) return { lessons: [], issues, courseIds: [] };
  const selected = await client.query(`SELECT l.id,l.module_id,m.course_id,l.type
    FROM lessons l JOIN modules m ON m.id=l.module_id
    WHERE (m.course_id=ANY($1::uuid[]) OR l.module_id=ANY($2::uuid[])
      OR l.id=ANY($3::uuid[])) AND l.type IN ('video','text')
      AND (l.id=ANY($3::uuid[])
        OR EXISTS (SELECT 1 FROM module_grammar g WHERE g.lesson_id=l.id
          AND (btrim(COALESCE(g.example_dialog,''))<>'' OR g.dialog_scene IS NOT NULL))
        OR EXISTS (SELECT 1 FROM lessons t
          WHERE t.popup_after_lesson_id=l.id AND t.type='grammar_task'))
    ORDER BY m.course_id,l.module_id,l.id`, ids);
  for (const courseId of config.courseIds) if (!selected.rows.some(row => row.course_id === courseId)) {
    issues.push({ code: 'flow_scope_has_no_lessons', kind: 'course', id: courseId });
  }
  for (const moduleId of config.moduleIds) if (!selected.rows.some(row => row.module_id === moduleId)) {
    issues.push({ code: 'flow_scope_has_no_lessons', kind: 'module', id: moduleId });
  }
  for (const lessonId of config.lessonIds) if (!selected.rows.some(row => row.id === lessonId)) {
    issues.push({ code: 'flow_scope_has_no_lessons', kind: 'lesson', id: lessonId });
  }
  return { lessons: selected.rows, issues, courseIds: [...new Set([
    ...courses.rows.map(row => row.id), ...modules.rows.map(row => row.course_id),
    ...lessons.rows.map(row => row.course_id),
  ])].sort() };
}

async function lessonReadiness(client, lesson, { resolveBoundary = getCurriculumBoundary } = {}) {
  const issues = [];
  const task = (await client.query(`SELECT t.id,s.bunpou_flow_published,
      sm.course_id AS source_course_id,tm.course_id AS task_course_id
    FROM lessons s JOIN modules sm ON sm.id=s.module_id
    LEFT JOIN lessons t ON t.popup_after_lesson_id=s.id AND t.type='grammar_task'
    LEFT JOIN modules tm ON tm.id=t.module_id
    WHERE s.id=$1 ORDER BY t.id`, [lesson.id])).rows;
  if (task.length !== 1 || !task[0].id || task[0].source_course_id !== lesson.course_id ||
      task[0].task_course_id !== lesson.course_id) return { lessonId: lesson.id,
    ready: false, issues: [issue('flow_task_mapping_invalid')] };
  const dbQuery = client.query.bind(client);
  const [items, pool] = await Promise.all([
    loadTaskConcepts(task[0].id, dbQuery), loadModulePool(task[0].id, dbQuery),
  ]);
  if (!items.length) issues.push(issue('flow_task_empty'));
  if (!companionIsCurrent(task[0].bunpou_flow_published, contentRevisionId(items, pool))) {
    issues.push(issue('flow_companion_not_current'));
  }
  let boundary = null;
  try {
    boundary = await resolveBoundary({ lessonId: lesson.id }, { dbQuery });
    if (boundary.course?.id !== lesson.course_id ||
        boundary.currentModule?.id !== lesson.module_id ||
        boundary.integrityIssues?.length) issues.push(issue('flow_boundary_invalid'));
  } catch { issues.push(issue('flow_boundary_unavailable')); }
  if (boundary && !boundary.integrityIssues?.length) {
    const coreItems = items.map(({ recognitionDistractors, controlledDistractors,
      recognition_distractors, controlled_distractors, ...item }) => item);
    const sourceReport = validateContentAgainstBoundary({ boundary,
      contentType: 'grammar_example', operation: 'audit',
      fields: visibleFields('bunpou.items', coreItems) });
    const distractorReport = validateContentAgainstBoundary({ boundary,
      contentType: 'grammar_distractors', operation: 'audit', fields: [
        ...visibleFields('bunpou.itemDistractors', items.map(item => ({
          recognitionDistractors: item.recognitionDistractors,
          controlledDistractors: item.controlledDistractors,
        }))),
        ...visibleFields('bunpou.pool', pool),
      ] });
    const published = task[0].bunpou_flow_published || {};
    const companionReport = validateContentAgainstBoundary({ boundary,
      contentType: 'dialogue_transfer', operation: 'audit', fields: visibleFields('bunpou.companion', {
        objective: published.objective, directions: published.directions, overlays: published.overlays,
      }) });
    for (const [code, report] of [
      ['flow_task_source_boundary_invalid', sourceReport],
      ['flow_task_distractor_boundary_invalid', distractorReport],
      ['flow_companion_boundary_invalid', companionReport],
    ]) if (report.valid !== true) issues.push({ code,
      violations: (report.violations || []).map(entry => entry.code) });
  }
  const taskGrammarIds = [...new Set(items.map(item => item.id))];
  const visible = (await client.query(`SELECT id FROM module_grammar WHERE lesson_id=$1
    AND (btrim(COALESCE(example_dialog,''))<>'' OR dialog_scene IS NOT NULL)`, [lesson.id])).rows;
  const visibleIds = visible.map(row => row.id);
  for (const grammarId of visibleIds) if (!taskGrammarIds.includes(grammarId)) {
    issues.push({ code: 'flow_task_dialogue_coverage_incomplete', grammarId });
  }
  const grammarIds = [...new Set([...taskGrammarIds, ...visibleIds])];
  const grammars = (await client.query(`SELECT id,module_id,lesson_id,example_dialog,
      example_dialog_id,communication_goal,dialog_scene
    FROM module_grammar WHERE id=ANY($1::uuid[])`, [grammarIds])).rows;
  const questions = (await client.query(`SELECT * FROM grammar_dialog_questions
    WHERE grammar_id=ANY($1::uuid[]) AND state='active' ORDER BY grammar_id,kind,sort_order`,
  [grammarIds])).rows;
  const byGrammar = new Map(grammars.map(row => [row.id, row]));
  for (const grammarId of grammarIds) {
    const grammar = byGrammar.get(grammarId);
    if (!grammar || grammar.module_id !== lesson.module_id ||
        (grammar.lesson_id && grammar.lesson_id !== lesson.id) ||
        !dialogueTurns(grammar).some(turn => turn.text)) {
      issues.push({ code: 'flow_dialogue_owner_or_source_invalid', grammarId }); continue;
    }
    const rows = questions.filter(row => row.grammar_id === grammarId);
    const comp = rows.filter(row => row.kind === 'comprehension');
    const transfer = rows.filter(row => row.kind === 'transfer');
    if (comp.length < 1 || comp.length > 2 || transfer.length !== 1) {
      issues.push({ code: 'flow_question_count_invalid', grammarId }); continue;
    }
    const fingerprint = dialogueFingerprint(grammar);
    if (boundary && !boundary.integrityIssues?.length) {
      const sourceReport = validateContentAgainstBoundary({ boundary,
        contentType: 'grammar_dialog', operation: 'publish',
        communicationGoal: grammar.communication_goal,
        fields: visibleFields(`grammar.${grammarId}`, {
          dialogue: grammar.example_dialog, translation: grammar.example_dialog_id,
          communicationGoal: grammar.communication_goal, scene: grammar.dialog_scene,
        }) });
      if (sourceReport.valid !== true) issues.push({ code: 'flow_dialogue_boundary_invalid',
        grammarId, violations: (sourceReport.violations || []).map(entry => entry.code) });
    }
    for (const row of rows) {
      if (!['manual', 'generated', 'legacy_bunpou'].includes(row.source_kind) ||
          (row.source_kind === 'legacy_bunpou' &&
            (!row.source_key || !row.source_fingerprint)) ||
          (row.kind === 'transfer' && row.evidence != null)) {
        issues.push({ code: 'flow_question_provenance_invalid', grammarId, questionId: row.id });
      }
      if (row.source_lesson_id !== lesson.id || row.dialogue_fingerprint !== fingerprint ||
          row.question_fingerprint !== questionFingerprint({ kind: row.kind,
            prompt: row.prompt, options: row.options, correctIndex: row.correct_index,
            explanation: row.explanation, evidence: row.evidence })) {
        issues.push({ code: 'flow_question_stale', grammarId, questionId: row.id }); continue;
      }
      if (row.kind === 'comprehension' && (!Array.isArray(row.evidence) ||
          row.evidence.length === 0 || row.evidence.some(entry =>
            !dialogueTurns(grammar)[entry.turnIndex]?.text.includes(entry.quote)))) {
        issues.push({ code: 'flow_comprehension_evidence_invalid', grammarId, questionId: row.id });
      }
      if (boundary && !boundary.integrityIssues?.length) {
        if (row.boundary_fingerprint !== boundary.boundaryFingerprint ||
            row.validator_version !== CURRICULUM_VALIDATOR_VERSION) {
          issues.push({ code: 'flow_question_review_stale', grammarId, questionId: row.id });
        }
        const fields = [{ path: 'question.prompt', text: row.prompt },
          ...row.options.map((text, index) => ({ path: `question.options[${index}]`, text })),
          { path: 'question.explanation', text: row.explanation },
          ...(row.evidence || []).map((entry, index) =>
            ({ path: `question.evidence[${index}].quote`, text: entry.quote }))];
        const report = validateContentAgainstBoundary({ boundary,
          contentType: row.kind === 'comprehension' ? 'dialogue_comprehension' : 'dialogue_transfer',
          operation: 'live_write', fields,
          question: { prompt: row.prompt, options: row.options,
            correctIndex: row.correct_index } });
        if (report.valid !== true) issues.push({ code: 'flow_question_boundary_invalid',
          grammarId, questionId: row.id });
      }
    }
  }
  return { lessonId: lesson.id, ready: issues.length === 0, issues };
}

export async function learningFlowReadiness(client, config, options = {}) {
  const scope = await scopedLessons(client, config);
  const lessons = [];
  for (const lesson of scope.lessons) lessons.push(await lessonReadiness(client, lesson, options));
  const issues = [...scope.issues, ...(scope.lessons.length ? [] : [issue('flow_scope_empty')])];
  return { ready: !issues.length && lessons.length > 0 && lessons.every(row => row.ready),
    issues, lessons };
}

export async function resolveFlowEligibility({ client, user, lessonId, courseId, moduleId,
  runtimeAvailable = V2_RUNTIME_AVAILABLE, resolveBoundary = getCurriculumBoundary,
  checkLessonReadiness = lessonReadiness, sharedConfig = false } = {}) {
  const active = (await client.query(`SELECT id,flow_version FROM grammar_task_sessions
    WHERE user_id=$1 AND source_lesson_id=$2 AND expires_at>NOW()
    ORDER BY created_at DESC,id DESC LIMIT 1`, [user.id, lessonId])).rows[0];
  if (active?.flow_version === 1) return { mode: 'legacy_session',
    reason: 'active_legacy_session', activeSessionId: active.id };
  if (active?.flow_version === 2) return runtimeAvailable
    ? { mode: 'inline', flowVersion: 2, reason: 'active_v2_session', activeSessionId: active.id }
    : { mode: 'legacy', reason: 'v2_runtime_unavailable' };
  const loaded = await loadLearningFlowConfig(client, { shared: sharedConfig });
  if (loaded.diagnostic) return { mode: 'legacy', reason: loaded.diagnostic };
  if (!flowScopeAllows(loaded.config, { courseId, moduleId, lessonId })) {
    return { mode: 'legacy', reason: loaded.config.enabled ? 'flow_scope_not_allowed' : 'flow_disabled' };
  }
  if (!runtimeAvailable) return { mode: 'legacy', reason: 'v2_runtime_unavailable' };
  const readiness = await checkLessonReadiness(client,
    { id: lessonId, module_id: moduleId, course_id: courseId }, { resolveBoundary });
  return readiness.ready ? { mode: 'inline', flowVersion: 2, reason: 'eligible' }
    : { mode: 'legacy', reason: 'flow_readiness_failed' };
}

export async function getLearningFlowSettings({ transaction = withTransaction,
  checkReadiness = learningFlowReadiness } = {}) {
  return transaction(async client => {
    const loaded = await loadLearningFlowConfig(client);
    const readiness = loaded.diagnostic ? { ready: false,
      issues: [issue(loaded.diagnostic)], lessons: [] } :
      await checkReadiness(client, loaded.config);
    return { ...loaded, readiness };
  });
}

export async function saveLearningFlowSettings(body, { transaction = withTransaction,
  checkReadiness = learningFlowReadiness, lockCourses = lockCurriculumCourses,
  resolveScope = scopedLessons } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).sort().join(',') !== 'config,expectedConfigRevision' ||
      typeof body.expectedConfigRevision !== 'string') fail(400, 'flow_settings_schema_invalid');
  const config = parseLearningFlowConfig(body.config);
  return transaction(async client => {
    // Content writers take graph/course locks before touching their rows. Do
    // the same here, before the setting lock, so activation observes one
    // stable reviewed snapshot and cannot deadlock with answer submission.
    if (config.enabled) {
      const scope = await resolveScope(client, config);
      if (scope.issues.some(entry => ['flow_scope_id_missing',
        'flow_scope_lesson_type_invalid'].includes(entry.code))) {
        fail(422, 'flow_scope_invalid', { ready: false, issues: scope.issues, lessons: [] });
      }
      if (scope.courseIds.length) await lockCourses(client, scope.courseIds);
      const lockedScope = await resolveScope(client, config);
      if (lockedScope.issues.some(entry => ['flow_scope_id_missing',
        'flow_scope_lesson_type_invalid'].includes(entry.code)) ||
          JSON.stringify(lockedScope.courseIds) !== JSON.stringify(scope.courseIds)) {
        fail(409, 'flow_scope_changed', { ready: false,
          issues: lockedScope.issues, lessons: [] });
      }
    }
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['learning-flow:config']);
    const loaded = await loadLearningFlowConfig(client, { locked: true });
    if (loaded.configRevision !== body.expectedConfigRevision) fail(409, 'flow_config_revision_conflict');
    const readiness = config.enabled ? await checkReadiness(client, config) : {
      ready: false, issues: [issue('flow_disabled')], lessons: [],
    };
    if (config.enabled && readiness.issues.some(entry => entry.code === 'flow_scope_id_missing')) {
      fail(422, 'flow_scope_invalid', readiness);
    }
    if (config.enabled && !readiness.ready) fail(422, 'flow_readiness_failed', readiness);
    const value = JSON.stringify(config);
    const saved = await client.query(`INSERT INTO app_settings(key,value,updated_at) VALUES ($1,$2,NOW())
      ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()
      RETURNING xmin::text AS row_revision`, [FLOW_SETTING_KEY, value]);
    return { config, configRevision: hash(value, saved.rows[0].row_revision),
      diagnostic: null, readiness };
  });
}
