import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { VALIDATED_WRITERS, LOCKED_TOPOLOGY_WRITERS, LOCKED_CONTEXT_WRITERS,
  OFF_ONLY_GLOBAL_WRITERS, MIXED_SCOPE_KANJI_WRITERS, SNAPSHOT_METADATA_WRITERS,
  OFF_ONLY_CLI_IMPORTERS, TEST_ONLY_DIAGNOSTIC_SCRIPTS,
  PENDING_BOUNDARY_WRITERS } from './curriculum-boundary-writers.js';

const routeSource = await readFile(new URL('./routes/admin.js', import.meta.url), 'utf8');
function routeBody(method, path) {
  const marker = `router.${method.toLowerCase()}('${path}'`;
  const start = routeSource.indexOf(marker);
  assert.notEqual(start, -1, `missing reviewed route: ${method} ${path}`);
  const next = routeSource.indexOf('\nrouter.', start + marker.length);
  return routeSource.slice(start, next < 0 ? undefined : next);
}

test('writer manifest lists actual routes and validates every claimed content writer', () => {
  const claimed = [...VALIDATED_WRITERS, ...LOCKED_TOPOLOGY_WRITERS,
    ...LOCKED_CONTEXT_WRITERS, ...OFF_ONLY_GLOBAL_WRITERS,
    ...MIXED_SCOPE_KANJI_WRITERS, ...SNAPSHOT_METADATA_WRITERS, ...PENDING_BOUNDARY_WRITERS];
  const keys = claimed.map(([method, path]) => `${method} ${path}`);
  assert.equal(new Set(keys).size, keys.length, 'writer appears in multiple coverage buckets');
  for (const [method, path] of VALIDATED_WRITERS) {
    const body = routeBody(method, path);
    if (path.endsWith('/generate-deck-readings')) {
      assert.match(body, /saveDeckReading\(/);
      assert.match(routeSource.slice(routeSource.indexOf('async function saveDeckReading'),
        routeSource.indexOf("router.post('/lessons/:lessonId/generate-deck-readings'")), /bulkBoundaryWrite\(/);
    } else if (path.endsWith('/generate-distractors-bulk')) {
      assert.match(body, /bulkBoundaryWrite\(/);
    } else assert.match(body, /adminBoundaryWrite\(res/, `${method} ${path} lacks transactional validation`);
  }
  assert.match(routeSource.slice(routeSource.indexOf('async function bulkBoundaryWrite'),
    routeSource.indexOf('// ── YouTube video sources')), /validateAndWriteContent\(options\)/);
  for (const [method, path] of LOCKED_TOPOLOGY_WRITERS) {
    assert.match(routeBody(method, path), /lockCurriculum(?:Course|Graph)\(/,
      `${method} ${path} lacks curriculum lock`);
  }
  for (const [method, path] of LOCKED_CONTEXT_WRITERS) {
    assert.match(routeBody(method, path), /adminLockedMutation\(res/,
      `${method} ${path} lacks transactional course locking`);
  }
  for (const [method, path] of OFF_ONLY_GLOBAL_WRITERS) {
    assert.match(routeBody(method, path), /globalOffQuery\(res/,
      `${method} ${path} lacks global off-mode gate`);
  }
  for (const [method, path] of MIXED_SCOPE_KANJI_WRITERS) {
    const body = routeBody(method, path);
    assert.match(body, /globalOffQuery\(res/);
    assert.match(body, method === 'DELETE' ? /adminLockedMutation\(res/ : /adminBoundaryWrite\(res/);
  }
  for (const [method, path] of SNAPSHOT_METADATA_WRITERS) routeBody(method, path);
  assert.equal(PENDING_BOUNDARY_WRITERS.length, 0);
  for (const [method, path] of PENDING_BOUNDARY_WRITERS) routeBody(method, path);
});

test('direct CLI importers explicitly fail closed outside off mode', async () => {
  for (const file of OFF_ONLY_CLI_IMPORTERS) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(source, /lockCurriculumGraph\(client, \{ exclusive: true \}\)/);
    assert.match(source, /curriculum_boundary_mode\s*!==?\s*'off'/);
  }
  for (const file of TEST_ONLY_DIAGNOSTIC_SCRIPTS) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(source, /DATABASE_URL WAJIB menunjuk database sekali-pakai/);
    assert.match(source, /test\|tmp\|local\|dev/);
  }
});

test('speaker defaults are outside the resolver fingerprint inputs', async () => {
  const resolver = await readFile(new URL('./curriculum-boundary.js', import.meta.url), 'utf8');
  assert.doesNotMatch(resolver, /dialogue_speakers/);
  assert.match(routeSource, /default_display_name = \$2/);
});
