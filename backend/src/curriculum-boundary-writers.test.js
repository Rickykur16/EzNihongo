import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { VALIDATED_WRITERS, LOCKED_TOPOLOGY_WRITERS,
  OFF_ONLY_CLI_IMPORTERS, PENDING_BOUNDARY_WRITERS } from './curriculum-boundary-writers.js';

const routeSource = await readFile(new URL('./routes/admin.js', import.meta.url), 'utf8');
function routeBody(method, path) {
  const marker = `router.${method.toLowerCase()}('${path}'`;
  const start = routeSource.indexOf(marker);
  assert.notEqual(start, -1, `missing reviewed route: ${method} ${path}`);
  const next = routeSource.indexOf('\nrouter.', start + marker.length);
  return routeSource.slice(start, next < 0 ? undefined : next);
}

test('writer manifest lists actual routes and validates every claimed content writer', () => {
  const claimed = [...VALIDATED_WRITERS, ...LOCKED_TOPOLOGY_WRITERS, ...PENDING_BOUNDARY_WRITERS];
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
  for (const [method, path] of PENDING_BOUNDARY_WRITERS) routeBody(method, path);
});

test('direct CLI importers explicitly fail closed outside off mode', async () => {
  for (const file of OFF_ONLY_CLI_IMPORTERS) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(source, /lockCurriculumGraph\(client, \{ exclusive: true \}\)/);
    assert.match(source, /curriculum_boundary_mode !== 'off'/);
  }
});
