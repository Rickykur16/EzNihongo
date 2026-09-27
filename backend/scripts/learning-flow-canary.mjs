import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { db, withTransaction } from '../src/db.js';
import { getCurriculumBoundaryMode,
  saveCurriculumBoundaryMode } from '../src/curriculum-boundary-mode.js';
import { getLearningFlowSettings, learningFlowReadiness,
  saveLearningFlowSettings } from '../src/learning-flow-config.js';

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

const defaults = {
  getMode: getCurriculumBoundaryMode,
  saveMode: saveCurriculumBoundaryMode,
  getSettings: getLearningFlowSettings,
  saveSettings: saveLearningFlowSettings,
  inspect: inspectScope,
};

export async function runCanary(options, dependencies = {}) {
  const deps = { ...defaults, ...dependencies };
  const [modeBefore, settingsBefore] = await Promise.all([
    deps.getMode(options.courseId), deps.getSettings(),
  ]);
  if (!['off', 'audit', 'warn'].includes(modeBefore.course.mode)) {
    fail('canary_boundary_mode_invalid');
  }
  let config = candidateConfig(settingsBefore.config, options.moduleId);
  let inspected = await deps.inspect(options.courseId, options.moduleId, config);
  const base = { type: options.apply ? 'applied' : 'preflight',
    apply: options.apply, scope: inspected.scope,
    boundaryMode: modeBefore.course.mode, config, readiness: inspected.readiness };
  if (!options.apply) return base;
  if (!inspected.readiness.ready) fail('flow_readiness_failed', inspected.readiness);

  const modeAfter = modeBefore.course.mode === 'off'
    ? await deps.saveMode(options.courseId,
      { mode: 'audit', expectedRevision: modeBefore.modeRevision })
    : modeBefore;
  const freshSettings = await deps.getSettings();
  config = candidateConfig(freshSettings.config, options.moduleId);
  const saved = await deps.saveSettings({
    expectedConfigRevision: freshSettings.configRevision, config,
  });
  inspected = await deps.inspect(options.courseId, options.moduleId, saved.config);
  if (!saved.config.enabled || !saved.config.moduleIds.includes(options.moduleId) ||
      !inspected.readiness.ready) fail('canary_postcondition_failed', inspected.readiness);
  return { ...base, boundaryMode: modeAfter.course.mode,
    config: saved.config, configRevision: saved.configRevision,
    readiness: inspected.readiness };
}

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  if (!process.env.DATABASE_URL && !dependencies.getMode) fail('DATABASE_URL_required');
  const result = await runCanary(parseArgs(argv), dependencies);
  console.log(JSON.stringify(result));
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    console.error(JSON.stringify({ type: 'error', code: error.message,
      ...(error.details ? { readiness: error.details } : {}) }));
    process.exitCode = 1;
  }).finally(() => db.end().catch(() => {}));
}
