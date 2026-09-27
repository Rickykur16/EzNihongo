import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCanaryTransaction, parseArgs,
  runCanary } from '../scripts/learning-flow-canary.mjs';
import { db } from './db.js';

const COURSE = 'a0000000-0000-4000-8000-000000000001';
const COURSE_A = '10000000-0000-4000-8000-000000000001';
const MODULE = 'b0000000-0000-4000-8000-000000000002';
const OTHER = 'c0000000-0000-4000-8000-000000000003';

test.after(() => db.end());

test('canary CLI requires exact lowercase UUID scope and explicit mutation mode', () => {
  assert.deepEqual(parseArgs(['--course-id', COURSE, '--module-id', MODULE, '--dry-run']), {
    apply: false, courseId: COURSE, moduleId: MODULE,
  });
  assert.equal(parseArgs(['--course-id', COURSE, '--module-id', MODULE, '--apply']).apply, true);
  for (const args of [[], ['--course-id', COURSE],
    ['--course-id', COURSE.toUpperCase(), '--module-id', MODULE],
    ['--course-id', COURSE, '--module-id', MODULE, '--apply', '--dry-run'],
    ['--course-id', COURSE, '--module-id', MODULE, '--force']]) {
    assert.throws(() => parseArgs(args));
  }
});

function fixture({ ready = true, mode = 'off' } = {}) {
  const calls = [];
  let settings = { config: { enabled: false, courseIds: [], moduleIds: [OTHER], lessonIds: [] },
    configRevision: 'revision-1' };
  let currentMode = { course: { id: COURSE, slug: 'n5', title: 'N5', mode },
    modeRevision: 'mode-1' };
  const deps = {
    getMode: async id => { calls.push(['getMode', id]); return currentMode; },
    saveMode: async (id, body) => {
      calls.push(['saveMode', id, body]);
      currentMode = { ...currentMode, course: { ...currentMode.course, mode: body.mode },
        modeRevision: 'mode-2' };
      return currentMode;
    },
    getSettings: async () => { calls.push(['getSettings']); return structuredClone(settings); },
    inspect: async (courseId, moduleId, config) => {
      calls.push(['inspect', courseId, moduleId, structuredClone(config)]);
      return { scope: { courseId, moduleId, courseSlug: 'n5', moduleSlug: 'n5-b3' },
        readiness: { ready, issues: ready ? [] : [{ code: 'flow_question_count_invalid' }],
          lessons: [] } };
    },
    activate: async (options, expected) => {
      calls.push(['activate', options, expected]);
      currentMode = { ...currentMode, course: { ...currentMode.course,
        mode: currentMode.course.mode === 'off' ? 'audit' : currentMode.course.mode },
      modeRevision: 'mode-2' };
      settings = { config: { ...structuredClone(settings.config), enabled: true,
        moduleIds: [...new Set([...settings.config.moduleIds, options.moduleId])].sort() },
      configRevision: 'revision-2', readiness: { ready: true, issues: [], lessons: [] } };
      return { mode: structuredClone(currentMode), settings: structuredClone(settings),
        scope: { courseId: options.courseId, moduleId: options.moduleId,
          courseSlug: 'n5', moduleSlug: 'n5-b3' } };
    },
  };
  return { calls, deps };
}

test('dry-run reports prospective scope without writing or dropping an existing allowlist', async () => {
  const f = fixture();
  const result = await runCanary({ apply: false, courseId: COURSE, moduleId: MODULE }, f.deps);
  assert.equal(result.type, 'preflight');
  assert.deepEqual(result.config.moduleIds, [MODULE, OTHER].sort());
  assert.equal(f.calls.some(([name]) => name === 'activate'), false);
});

test('apply fails closed before writes when readiness is incomplete', async () => {
  const f = fixture({ ready: false });
  await assert.rejects(runCanary({ apply: true, courseId: COURSE, moduleId: MODULE }, f.deps),
    error => error.message === 'flow_readiness_failed' &&
      error.details.issues[0].code === 'flow_question_count_invalid');
  assert.equal(f.calls.some(([name]) => name === 'activate'), false);
});

test('apply promotes off to audit, preserves scopes, enables v2 and verifies postconditions', async () => {
  const f = fixture();
  const result = await runCanary({ apply: true, courseId: COURSE, moduleId: MODULE }, f.deps);
  assert.equal(result.type, 'applied');
  assert.equal(result.boundaryMode, 'audit');
  assert.equal(result.config.enabled, true);
  assert.deepEqual(result.config.moduleIds, [MODULE, OTHER].sort());
  assert.equal(f.calls.filter(([name]) => name === 'activate').length, 1);
  assert.equal(f.calls.filter(([name]) => name === 'inspect').length, 1);
});

test('an existing warn mode is retained during apply', async () => {
  const f = fixture({ mode: 'warn' });
  const result = await runCanary({ apply: true, courseId: COURSE, moduleId: MODULE }, f.deps);
  assert.equal(result.boundaryMode, 'warn');
  assert.equal(f.calls.filter(([name]) => name === 'activate').length, 1);
});

test('a malformed stored config blocks preflight and apply before inspection or activation', async () => {
  const f = fixture();
  f.deps.getSettings = async () => ({ config: { enabled: false, courseIds: [],
    moduleIds: [], lessonIds: [] }, configRevision: 'broken', diagnostic: 'flow_config_invalid' });
  await assert.rejects(runCanary({ apply: true, courseId: COURSE, moduleId: MODULE }, f.deps),
    error => error.message === 'flow_config_invalid');
  assert.equal(f.calls.some(([name]) => name === 'inspect' || name === 'activate'), false);
});

test('two-course activation takes one sorted union lock before nested writers', async () => {
  const calls = [];
  const client = { async query(sql, params) {
    calls.push(['query', sql, params]);
    if (sql.includes('FOR UPDATE OF m')) return { rows: [{ id: MODULE, slug: 'n5-b3',
      title: 'Bab 3', course_id: COURSE, course_slug: 'n5', course_title: 'N5' }] };
    if (sql.includes('SELECT m.id FROM modules')) return { rows: [{ id: MODULE }] };
    if (sql.includes('SELECT curriculum_boundary_mode AS mode')) return { rows: [{ mode: 'audit' }] };
    throw new Error(`unexpected SQL: ${sql}`);
  } };
  const transaction = async fn => { calls.push(['transaction']); return fn(client); };
  const result = await applyCanaryTransaction({ courseId: COURSE, moduleId: MODULE },
    { modeRevision: 'mode-1', configRevision: 'config-1' }, {
      transaction,
      getMode: async (_id, options) => {
        assert.equal(await options.dbQuery('SELECT curriculum_boundary_mode AS mode FROM courses WHERE id=$1 FOR SHARE', [COURSE])
          .then(value => value.rows[0].mode), 'audit');
        return { course: { mode: 'audit' }, modeRevision: 'mode-1' };
      },
      getSettings: async options => options.transaction(async lockedClient => {
        assert.equal(lockedClient, client);
        return { config: { enabled: false, courseIds: [COURSE_A],
          moduleIds: [OTHER], lessonIds: [] },
          configRevision: 'config-1', diagnostic: null };
      }),
      resolveCourseIds: async (lockedClient, config, targetCourseId, targetModuleId) => {
        assert.equal(lockedClient, client);
        assert.equal(targetCourseId, COURSE);
        assert.equal(targetModuleId, MODULE);
        assert.deepEqual(config.courseIds, [COURSE_A]);
        calls.push(['resolveCourseIds']);
        return [COURSE_A, COURSE];
      },
      lockCourses: async (lockedClient, courseIds) => {
        assert.equal(lockedClient, client);
        assert.deepEqual(courseIds, [COURSE_A, COURSE]);
        calls.push(['lockCourses', ...courseIds]);
      },
      saveMode: async (_id, body, options) => options.transaction(async lockedClient => {
        assert.equal(lockedClient, client); assert.equal(body.mode, 'audit');
        calls.push(['saveMode']);
        await options.lockCourse(lockedClient, COURSE);
        return { course: { mode: 'audit' }, modeRevision: 'mode-1' };
      }),
      saveSettings: async (body, options) => options.transaction(async lockedClient => {
        calls.push(['saveSettings']);
        await options.lockCourses(lockedClient, [COURSE_A, COURSE]);
        const readiness = await options.checkReadiness(lockedClient, body.config);
        return { config: body.config, configRevision: 'config-2', readiness };
      }),
      checkReadiness: async (lockedClient, config) => {
        assert.equal(lockedClient, client);
        assert.deepEqual(config.moduleIds, [MODULE, OTHER].sort());
        return { ready: true, issues: [], lessons: [] };
      },
    });
  assert.equal(result.settings.config.enabled, true);
  assert.deepEqual(calls.filter(([name]) => name === 'resolveCourseIds').length, 2);
  assert.ok(calls.findIndex(([name]) => name === 'lockCourses') <
    calls.findIndex(([name]) => name === 'saveMode'));
  assert.equal(calls.filter(([name]) => name === 'lockCourses').length, 1);
  assert.ok(calls.some(([, sql]) => typeof sql === 'string' && sql.includes('FOR UPDATE OF m')));
  assert.ok(calls.some(([, sql]) => typeof sql === 'string' && sql.includes('SELECT m.id FROM modules')));
});
