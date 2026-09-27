import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, runCanary } from '../scripts/learning-flow-canary.mjs';
import { db } from './db.js';

const COURSE = 'a0000000-0000-4000-8000-000000000001';
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
    saveSettings: async body => {
      calls.push(['saveSettings', body]);
      settings = { config: structuredClone(body.config), configRevision: 'revision-2' };
      return structuredClone(settings);
    },
    inspect: async (courseId, moduleId, config) => {
      calls.push(['inspect', courseId, moduleId, structuredClone(config)]);
      return { scope: { courseId, moduleId, courseSlug: 'n5', moduleSlug: 'n5-b3' },
        readiness: { ready, issues: ready ? [] : [{ code: 'flow_question_count_invalid' }],
          lessons: [] } };
    },
  };
  return { calls, deps };
}

test('dry-run reports prospective scope without writing or dropping an existing allowlist', async () => {
  const f = fixture();
  const result = await runCanary({ apply: false, courseId: COURSE, moduleId: MODULE }, f.deps);
  assert.equal(result.type, 'preflight');
  assert.deepEqual(result.config.moduleIds, [MODULE, OTHER].sort());
  assert.equal(f.calls.some(([name]) => name === 'saveMode' || name === 'saveSettings'), false);
});

test('apply fails closed before writes when readiness is incomplete', async () => {
  const f = fixture({ ready: false });
  await assert.rejects(runCanary({ apply: true, courseId: COURSE, moduleId: MODULE }, f.deps),
    error => error.message === 'flow_readiness_failed' &&
      error.details.issues[0].code === 'flow_question_count_invalid');
  assert.equal(f.calls.some(([name]) => name === 'saveMode' || name === 'saveSettings'), false);
});

test('apply promotes off to audit, preserves scopes, enables v2 and verifies postconditions', async () => {
  const f = fixture();
  const result = await runCanary({ apply: true, courseId: COURSE, moduleId: MODULE }, f.deps);
  assert.equal(result.type, 'applied');
  assert.equal(result.boundaryMode, 'audit');
  assert.equal(result.config.enabled, true);
  assert.deepEqual(result.config.moduleIds, [MODULE, OTHER].sort());
  assert.equal(f.calls.filter(([name]) => name === 'saveMode').length, 1);
  assert.equal(f.calls.filter(([name]) => name === 'saveSettings').length, 1);
  assert.equal(f.calls.filter(([name]) => name === 'inspect').length, 2);
});

test('an existing warn mode is retained during apply', async () => {
  const f = fixture({ mode: 'warn' });
  const result = await runCanary({ apply: true, courseId: COURSE, moduleId: MODULE }, f.deps);
  assert.equal(result.boundaryMode, 'warn');
  assert.equal(f.calls.some(([name]) => name === 'saveMode'), false);
});
