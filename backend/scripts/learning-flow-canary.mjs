import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { db, withTransaction } from '../src/db.js';
import { getCurriculumBoundaryMode,
  saveCurriculumBoundaryMode } from '../src/curriculum-boundary-mode.js';
import { lockCurriculumCourses } from '../src/curriculum-content-service.js';
import { getLearningFlowSettings, learningFlowReadiness,
  saveLearningFlowSettings } from '../src/learning-flow-config.js';
import { backfillDialogueQuestions } from '../src/dialogue-question-backfill.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function fail(code, details) {
  const error = new Error(code);
  if (details) error.details = details;
  throw error;
}

export function parseArgs(argv) {
  const options = { apply: false };
  let mode = null;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--apply' || arg === '--dry-run') {
      const next = arg === '--apply' ? 'apply' : 'dry-run';
      if (mode && mode !== next) fail('conflicting_canary_mode');
      mode = next;
      options.apply = next === 'apply';
      continue;
    }
    if (arg === '--course-id' || arg === '--module-id') {
      const value = argv[++index];
      if (!value || value.startsWith('--')) fail(`missing_value:${arg}`);
      const key = arg === '--course-id' ? 'courseId' : 'moduleId';
      if (options[key]) fail(`duplicate_value:${arg}`);
      options[key] = value;
      continue;
    }
    fail(`unknown_argument:${arg}`);
  }
  if (!UUID.test(options.courseId || '')) fail('invalid_course_id');
  if (!UUID.test(options.moduleId || '')) fail('invalid_module_id');
  return options;
}

function candidateConfig(current, moduleId) {
  return {
    enabled: true,
    courseIds: [...current.courseIds],
    moduleIds: [...new Set([...current.moduleIds, moduleId])].sort(),
    lessonIds: [...current.lessonIds],
  };
}

async function inspectScope(courseId, moduleId, config) {
  return withTransaction(async client => {
    const module = (await client.query(`SELECT m.id,m.slug,m.title,m.course_id,c.slug AS course_slug,
        c.title AS course_title
      FROM modules m JOIN courses c ON c.id=m.course_id
      WHERE m.id=$1 AND c.id=$2`, [moduleId, courseId])).rows[0];
    if (!module) fail('canary_scope_owner_mismatch');
    const readiness = await learningFlowReadiness(client, config);
    return { scope: { courseId, courseSlug: module.course_slug,
      courseTitle: module.course_title, moduleId, moduleSlug: module.slug,
      moduleTitle: module.title }, readiness };
  });
}

function validateMode(mode) {
  if (!['off', 'audit', 'warn'].includes(mode?.course?.mode)) {
    fail('canary_boundary_mode_invalid');
  }
}

function validateSettings(settings) {
  if (settings?.diagnostic) fail(settings.diagnostic);
  if (!settings?.config || typeof settings.configRevision !== 'string') {
    fail('flow_config_unavailable');
  }
}

export async function resolveCanaryCourseIds(client, config, targetCourseId, targetModuleId) {
  const courseIds = [...new Set([...config.courseIds, targetCourseId])].sort();
  const moduleIds = [...new Set([...config.moduleIds, targetModuleId])].sort();
  const lessonIds = [...config.lessonIds];
  const courses = await client.query('SELECT id FROM courses WHERE id=ANY($1::uuid[])', [courseIds]);
  const modules = await client.query('SELECT id,course_id FROM modules WHERE id=ANY($1::uuid[])',
    [moduleIds]);
  const lessons = await client.query(`SELECT l.id,m.course_id FROM lessons l
    JOIN modules m ON m.id=l.module_id WHERE l.id=ANY($1::uuid[])`, [lessonIds]);
  for (const [kind, wanted, rows] of [
    ['course', courseIds, courses.rows], ['module', moduleIds, modules.rows],
    ['lesson', lessonIds, lessons.rows],
  ]) {
    const found = new Set(rows.map(row => row.id));
    const missing = wanted.filter(id => !found.has(id));
    if (missing.length) fail('canary_scope_id_missing', { kind, ids: missing });
  }
  const target = modules.rows.find(row => row.id === targetModuleId);
  if (!target || target.course_id !== targetCourseId) fail('canary_scope_owner_mismatch');
  return [...new Set([
    ...courses.rows.map(row => row.id), ...modules.rows.map(row => row.course_id),
    ...lessons.rows.map(row => row.course_id),
  ])].sort();
}

export async function refreshCanaryQuestionReviews(client, { courseId, moduleId }, {
  backfill = backfillDialogueQuestions, runId = randomUUID(),
} = {}) {
  const report = await backfill({ courseIds: [courseId], moduleIds: [moduleId],
    lessonIds: [], runId, apply: true }, {
    transaction: fn => fn(client), lockCourse: async () => {}, validationRefreshOnly: true,
  });
  const accepted = new Set(['already_present', 'review_refreshed']);
  if (!report.lessonCount || !report.rows.length ||
      report.rows.some(row => !accepted.has(row.status))) {
    fail('canary_question_review_invalid', report);
  }
  return report;
}

export async function applyCanaryTransaction(options, expected, dependencies = {}) {
  const transaction = dependencies.transaction || withTransaction;
  const getMode = dependencies.getMode || getCurriculumBoundaryMode;
  const saveMode = dependencies.saveMode || saveCurriculumBoundaryMode;
  const getSettings = dependencies.getSettings || getLearningFlowSettings;
  const saveSettings = dependencies.saveSettings || saveLearningFlowSettings;
  const checkReadiness = dependencies.checkReadiness || learningFlowReadiness;
  const resolveCourseIds = dependencies.resolveCourseIds || resolveCanaryCourseIds;
  const lockCourses = dependencies.lockCourses || lockCurriculumCourses;
  const refreshReviews = dependencies.refreshReviews || refreshCanaryQuestionReviews;
  const logger = dependencies.logger || (event => console.info(JSON.stringify(event)));
  const activated = await transaction(async client => {
    const dbQuery = client.query.bind(client);
    const mode = await getMode(options.courseId, { dbQuery });
    validateMode(mode);
    if (mode.modeRevision !== expected.modeRevision) fail('canary_state_changed');
    const settings = await getSettings({ transaction: fn => fn(client) });
    validateSettings(settings);
    if (settings.configRevision !== expected.configRevision) fail('canary_state_changed');
    const config = candidateConfig(settings.config, options.moduleId);

    // Resolve every allowlisted owner, then acquire the complete prerequisite
    // closure in the shared global order before either nested writer runs.
    // This prevents target-course-first lock inversion for multi-course scopes.
    const courseIds = await resolveCourseIds(client, config,
      options.courseId, options.moduleId);
    await lockCourses(client, courseIds);
    const lockedCourseIds = await resolveCourseIds(client, config,
      options.courseId, options.moduleId);
    if (JSON.stringify(lockedCourseIds) !== JSON.stringify(courseIds)) {
      fail('canary_scope_changed');
    }
    const alreadyLocked = async () => {};

    // The mode, module owner and flow config remain one atomic observation
    // through the settings commit. Nested services still perform their own
    // row, revision, scope and readiness checks without changing lock order.
    const targetMode = mode.course.mode === 'off' ? 'audit' : mode.course.mode;
    const savedMode = await saveMode(options.courseId,
      { mode: targetMode, expectedRevision: mode.modeRevision },
      { transaction: fn => fn(client), lockCourse: alreadyLocked, logger: () => {} });
    const module = (await client.query(`SELECT m.id,m.slug,m.title,m.course_id,
        c.slug AS course_slug,c.title AS course_title
      FROM modules m JOIN courses c ON c.id=m.course_id
      WHERE m.id=$1 AND c.id=$2 FOR UPDATE OF m`,
    [options.moduleId, options.courseId])).rows[0];
    if (!module) fail('canary_scope_owner_mismatch');
    const questionReview = await refreshReviews(client, options);
    const guardedReadiness = async (readinessClient, candidate) => {
      if (readinessClient !== client) fail('canary_transaction_mismatch');
      const owner = (await client.query(`SELECT m.id FROM modules m
        WHERE m.id=$1 AND m.course_id=$2 FOR UPDATE`,
      [options.moduleId, options.courseId])).rows[0];
      if (!owner) fail('canary_scope_owner_mismatch');
      const currentMode = (await client.query(`SELECT curriculum_boundary_mode AS mode
        FROM courses WHERE id=$1 FOR SHARE`, [options.courseId])).rows[0]?.mode;
      if (!['audit', 'warn'].includes(currentMode)) fail('canary_boundary_mode_changed');
      return checkReadiness(client, candidate);
    };
    const saved = await saveSettings({
      expectedConfigRevision: settings.configRevision, config,
    }, { transaction: fn => fn(client), checkReadiness: guardedReadiness,
      lockCourses: alreadyLocked });
    if (!saved.config.enabled || !saved.config.moduleIds.includes(options.moduleId) ||
        !saved.readiness?.ready) fail('canary_postcondition_failed', saved.readiness);
    return { mode: savedMode, settings: saved, questionReview,
      previousMode: mode.course.mode,
      scope: { courseId: options.courseId, courseSlug: module.course_slug,
        courseTitle: module.course_title, moduleId: options.moduleId,
        moduleSlug: module.slug, moduleTitle: module.title } };
  });
  if (activated.previousMode !== activated.mode.course.mode) {
    try { logger({ event: 'curriculum_boundary_mode_changed', schemaVersion: 1,
      courseId: options.courseId, fromMode: activated.previousMode,
      toMode: activated.mode.course.mode }); } catch { /* telemetry must not change activation */ }
  }
  return activated;
}

const defaults = {
  getMode: getCurriculumBoundaryMode,
  getSettings: getLearningFlowSettings,
  inspect: inspectScope,
  activate: applyCanaryTransaction,
};

export async function runCanary(options, dependencies = {}) {
  const deps = { ...defaults, ...dependencies };
  const [modeBefore, settingsBefore] = await Promise.all([
    deps.getMode(options.courseId), deps.getSettings(),
  ]);
  validateMode(modeBefore);
  validateSettings(settingsBefore);
  let config = candidateConfig(settingsBefore.config, options.moduleId);
  let inspected = await deps.inspect(options.courseId, options.moduleId, config);
  const base = { type: options.apply ? 'applied' : 'preflight',
    apply: options.apply, scope: inspected.scope,
    boundaryMode: modeBefore.course.mode, config, readiness: inspected.readiness };
  if (!options.apply) return base;
  if (!inspected.readiness.ready) fail('flow_readiness_failed', inspected.readiness);
  const activated = await deps.activate(options, {
    modeRevision: modeBefore.modeRevision,
    configRevision: settingsBefore.configRevision,
  });
  return { ...base, boundaryMode: activated.mode.course.mode,
    scope: activated.scope, config: activated.settings.config,
    configRevision: activated.settings.configRevision,
    readiness: activated.settings.readiness,
    questionReview: activated.questionReview };
}

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  if (!process.env.DATABASE_URL && !dependencies.getMode) fail('DATABASE_URL_required');
  const result = await runCanary(parseArgs(argv), dependencies);
  // Keep large readiness diagnostics visible in GitHub Actions. The SSH
  // action can drop a single oversized line, while formatted JSON splits the
  // readiness object across log lines and stays machine-readable once the
  // action's per-line prefixes are removed.
  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    console.error(JSON.stringify({ type: 'error', code: error.message,
      ...((error.details || error.readiness) ?
        { readiness: error.details || error.readiness } : {}) }));
    process.exitCode = 1;
  }).finally(() => db.end().catch(() => {}));
}
