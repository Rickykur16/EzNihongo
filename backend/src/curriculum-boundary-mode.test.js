import test from 'node:test';
import assert from 'node:assert/strict';
import { getCurriculumBoundaryMode, saveCurriculumBoundaryMode } from './curriculum-boundary-mode.js';

const ID = '10000000-0000-4000-8000-000000000001';

function fixture({ exists = true } = {}) {
  let row = exists ? { id: ID, slug: 'n4', title: 'N4',
    curriculum_boundary_mode: 'off', row_revision: '7' } : null;
  const calls = [], events = [];
  let locked = false;
  const client = { async query(sql, params) {
    calls.push({ sql, params });
    if (sql === 'SELECT id FROM courses WHERE id=$1') return { rows: row ? [{ id: row.id }] : [] };
    if (sql.includes('FROM courses WHERE id=$1 FOR UPDATE')) {
      assert.equal(locked, true, 'row lock follows curriculum course lock');
      return { rows: row ? [{ ...row }] : [] };
    }
    if (sql.startsWith('UPDATE courses SET curriculum_boundary_mode=')) {
      assert.equal(locked, true);
      assert.equal(params[2], row.row_revision);
      row = { ...row, curriculum_boundary_mode: params[1],
        row_revision: String(Number(row.row_revision) + 1) };
      return { rows: [{ ...row }] };
    }
    if (sql.includes('FROM courses WHERE id=$1')) return { rows: row ? [{ ...row }] : [] };
    throw new Error(`unexpected SQL: ${sql}`);
  } };
  const deps = { transaction: fn => fn(client),
    lockCourse: async (clientArg, courseId) => {
      assert.equal(clientArg, client); assert.equal(courseId, ID);
      calls.push({ sql: 'CURRICULUM COURSE LOCK' }); locked = true;
    }, logger: event => events.push(event) };
  return { client, calls, events, deps, current: () => row };
}

test('GET returns scoped identity, mode, and an opaque revision; absent/invalid course fail', async () => {
  const f = fixture();
  const get = await getCurriculumBoundaryMode(ID, { dbQuery: f.client.query.bind(f.client) });
  assert.deepEqual(get.course, { id: ID, slug: 'n4', title: 'N4', mode: 'off' });
  assert.match(get.modeRevision, /^sha256:[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(get).includes('row_revision'), false);
  await assert.rejects(getCurriculumBoundaryMode('not-a-uuid', { dbQuery: f.client.query.bind(f.client) }),
    e => e.status === 400 && e.code === 'invalid_course_id');
  const missing = fixture({ exists: false });
  await assert.rejects(getCurriculumBoundaryMode(ID, { dbQuery: missing.client.query.bind(missing.client) }),
    e => e.status === 404 && e.code === 'course_not_found');
});

test('mode change uses lock, exact CAS, mode-only UPDATE, and post-commit event', async () => {
  const f = fixture();
  const before = await getCurriculumBoundaryMode(ID, { dbQuery: f.client.query.bind(f.client) });
  const changed = await saveCurriculumBoundaryMode(ID,
    { mode: 'audit', expectedRevision: before.modeRevision }, f.deps);
  assert.equal(changed.course.mode, 'audit');
  assert.notEqual(changed.modeRevision, before.modeRevision);
  assert.equal(f.calls.findIndex(call => call.sql === 'CURRICULUM COURSE LOCK') <
    f.calls.findIndex(call => call.sql.includes('FOR UPDATE')), true);
  const updates = f.calls.filter(call => call.sql.startsWith('UPDATE courses'));
  assert.equal(updates.length, 1);
  assert.match(updates[0].sql, /^UPDATE courses SET curriculum_boundary_mode=\$2/u);
  assert.doesNotMatch(updates[0].sql, /app_settings|bunpou|lesson|progress|report/u);
  assert.deepEqual(f.events, [{ event: 'curriculum_boundary_mode_changed',
    schemaVersion: 1, courseId: ID, fromMode: 'off', toMode: 'audit' }]);
  await assert.rejects(saveCurriculumBoundaryMode(ID,
    { mode: 'warn', expectedRevision: before.modeRevision }, f.deps),
  e => e.status === 409 && e.code === 'boundary_mode_revision_conflict');
  assert.equal(f.current().curriculum_boundary_mode, 'audit');
  assert.equal(f.events.length, 1);
  const noop = await saveCurriculumBoundaryMode(ID,
    { mode: 'audit', expectedRevision: changed.modeRevision }, f.deps);
  assert.equal(noop.modeRevision, changed.modeRevision);
  assert.equal(f.events.length, 1);
  const downgraded = await saveCurriculumBoundaryMode(ID,
    { mode: 'off', expectedRevision: noop.modeRevision }, f.deps);
  assert.equal(downgraded.course.mode, 'off');
});

test('enforce is blocked without server-owned evidence, and client manifest cannot override it', async () => {
  const f = fixture();
  const before = await getCurriculumBoundaryMode(ID, { dbQuery: f.client.query.bind(f.client) });
  await assert.rejects(saveCurriculumBoundaryMode(ID,
    { mode: 'enforce', expectedRevision: before.modeRevision }, f.deps),
  e => e.status === 422 && e.code === 'enforce_readiness_evidence_unavailable');
  await assert.rejects(saveCurriculumBoundaryMode(ID,
    { mode: 'enforce', expectedRevision: before.modeRevision,
      manifest: { approved: true } }, f.deps),
  e => e.status === 400 && e.code === 'boundary_mode_schema_invalid');
  assert.equal(f.current().curriculum_boundary_mode, 'off');
  assert.equal(f.calls.some(call => call.sql.startsWith('UPDATE courses')), false);
});

test('a revision from another course is not a valid CAS token', async () => {
  const f = fixture();
  const otherId = '10000000-0000-4000-8000-000000000002';
  const other = await getCurriculumBoundaryMode(otherId, { dbQuery: async () => ({ rows: [{
    id: otherId, slug: 'n5', title: 'N5', curriculum_boundary_mode: 'off', row_revision: '7',
  }] }) });
  await assert.rejects(saveCurriculumBoundaryMode(ID,
    { mode: 'warn', expectedRevision: other.modeRevision }, f.deps),
  e => e.status === 409 && e.code === 'boundary_mode_revision_conflict');
  assert.equal(f.current().curriculum_boundary_mode, 'off');
});

test('malformed writes and missing course never mutate', async () => {
  const f = fixture();
  for (const body of [null, {}, [], { mode: 'warn', expectedRevision: 'stale' },
    { mode: 'invalid', expectedRevision: `sha256:${'0'.repeat(64)}` },
    { mode: 'warn', expectedRevision: `sha256:${'0'.repeat(64)}`, force: true }]) {
    await assert.rejects(saveCurriculumBoundaryMode(ID, body, f.deps),
      e => e.status === 400 && e.code === 'boundary_mode_schema_invalid');
  }
  const missing = fixture({ exists: false });
  await assert.rejects(saveCurriculumBoundaryMode(ID,
    { mode: 'audit', expectedRevision: `sha256:${'0'.repeat(64)}` }, missing.deps),
  e => e.status === 404 && e.code === 'course_not_found');
  assert.equal(f.calls.some(call => call.sql.startsWith('UPDATE courses')), false);
});
