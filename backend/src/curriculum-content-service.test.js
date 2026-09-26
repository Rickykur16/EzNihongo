import assert from 'node:assert/strict';
import test from 'node:test';
import { BoundaryUnavailableError } from './curriculum-boundary.js';
import { validateAndWriteContent, BoundaryWriteError } from './curriculum-content-service.js';
import { validateContentAgainstBoundary } from './curriculum-boundary-validator.js';

const COURSE = '11111111-1111-4111-8111-111111111111';
const MODULE = '22222222-2222-4222-8222-222222222222';
const candidate = () => ({ scope: { moduleId: MODULE }, contentType: 'grammar_example',
  operation: 'live_write', fields: [{ path: 'japanese', text: '文' }] });
const boundary = mode => ({ course: { id: COURSE, mode }, currentModule: { id: MODULE },
  boundaryFingerprint: 'sha256:current' });
const report = (status = 'evaluated', valid = true) => ({ status, valid,
  boundaryFingerprint: 'sha256:current', violations: valid ? [] : [{ code: 'future_kanji' }],
  warnings: [], usage: {}, integrityIssues: [] });

function harness(mode, overrides = {}) {
  const calls = [];
  const client = { query: async sql => {
    if (sql.includes('FROM modules m JOIN courses c')) return { rows: [{ id: COURSE, module_id: MODULE,
      mode: typeof mode === 'function' ? mode() : mode }] };
    if (sql.includes('pg_advisory_xact_lock')) { calls.push('lock'); return { rows: [] }; }
    if (sql.includes('SAVEPOINT')) return { rows: [] };
    throw new Error(`unexpected SQL: ${sql}`);
  } };
  const transaction = async work => {
    calls.push('begin');
    try { const result = await work(client); calls.push('commit'); return result; }
    catch (error) { calls.push('rollback'); throw error; }
  };
  const options = {
    prepare: async () => { calls.push('prepare'); return candidate(); },
    write: async () => { calls.push('write'); return { id: '33333333-3333-4333-8333-333333333333' }; },
    transaction,
    rejectedReportTransaction: transaction,
    resolveBoundary: async () => { calls.push('resolve'); return boundary(mode); },
    validate: () => report(),
    reportWriter: async () => { calls.push('report'); },
    ...overrides,
  };
  return { calls, options };
}

test('enforce rejects before mutation; rejected report is written after rollback', async () => {
  const h = harness('enforce', { validate: () => report('evaluated', false) });
  await assert.rejects(validateAndWriteContent(h.options), error => error instanceof BoundaryWriteError && error.statusCode === 422);
  assert.deepEqual(h.calls, ['begin', 'prepare', 'lock', 'prepare', 'resolve', 'rollback', 'begin', 'report', 'commit']);
});

test('warn preserves exact content and commits its report in the same transaction', async () => {
  const h = harness('warn', { validate: () => report('evaluated', false) });
  const result = await validateAndWriteContent(h.options);
  assert.equal(result.decision.decision, 'allowed_with_warning');
  assert.deepEqual(h.calls, ['begin', 'prepare', 'lock', 'prepare', 'resolve', 'write', 'report', 'commit']);
});

test('enforce returns 503 when resolver unavailable, while warn reports unavailable and writes', async () => {
  for (const mode of ['enforce', 'warn']) {
    const h = harness(mode, { resolveBoundary: async () => { throw new BoundaryUnavailableError(new Error('db')); } });
    if (mode === 'enforce') {
      await assert.rejects(validateAndWriteContent(h.options), error => error.statusCode === 503);
      assert.ok(!h.calls.includes('write'));
    } else {
      const result = await validateAndWriteContent(h.options);
      assert.equal(result.report.status, 'unavailable');
      assert.ok(h.calls.indexOf('write') < h.calls.indexOf('report'));
    }
  }
});

test('stale preview fingerprint cannot authorize a later save', async () => {
  const h = harness('enforce', { prepare: async () => ({ ...candidate(), expectedBoundaryFingerprint: 'sha256:stale' }) });
  await assert.rejects(validateAndWriteContent(h.options), error => error.statusCode === 409);
  assert.ok(!h.calls.includes('write'));
});

test('stale editor revision gives 409 before mutation', async () => {
  const h = harness('enforce', { prepare: async () => ({ ...candidate(),
    expectedRevision: '2026-09-26T03:00:00.000Z', currentRevision: new Date('2026-09-26T03:01:00.000Z') }) });
  await assert.rejects(validateAndWriteContent(h.options), error => error.statusCode === 409);
  assert.ok(!h.calls.includes('write'));
});

test('warn/unavailable still rejects malformed schema and stale revision', async () => {
  for (const prepare of [
    async () => ({ ...candidate(), fields: [{ path: 'japanese', text: null }] }),
    async () => ({ ...candidate(), expectedRevision: 'old', currentRevision: 'new' }),
  ]) {
    const h = harness('warn', { prepare, validate: validateContentAgainstBoundary,
      resolveBoundary: async () => { throw new BoundaryUnavailableError(new Error('db')); } });
    await assert.rejects(validateAndWriteContent(h.options), error =>
      error instanceof BoundaryWriteError && [409, 422].includes(error.statusCode));
    assert.ok(!h.calls.includes('write'));
  }
});

test('mode is reread after the lock; warn to enforce rejects unavailable validation', async () => {
  let reads = 0;
  const h = harness(() => ++reads === 1 ? 'warn' : 'enforce', {
    resolveBoundary: async () => { throw new BoundaryUnavailableError(new Error('db')); },
  });
  await assert.rejects(validateAndWriteContent(h.options), error => error.statusCode === 503);
  assert.ok(!h.calls.includes('write'));
});
