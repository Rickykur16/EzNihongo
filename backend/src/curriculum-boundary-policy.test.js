import test from 'node:test';
import assert from 'node:assert/strict';
import { decideBoundaryAction } from './curriculum-boundary-policy.js';

const clean = { status: 'evaluated', valid: true, violations: [], warnings: [] };
const hard = { status: 'evaluated', valid: false, violations: [{ code: 'future_kanji' }], warnings: [] };
const unknown = { status: 'evaluated', valid: true, violations: [], warnings: [{ code: 'unregistered_kanji' }] };
const unavailable = { status: 'unavailable', valid: null, violations: [], warnings: [] };
const decide = (mode, report, operation = 'live_write', contentIsNewOrChanged = true) =>
  decideBoundaryAction({ mode, report, operation, contentIsNewOrChanged });

test('W01: off/audit/warn/enforce keep validation truth separate from save decision', () => {
  for (const mode of ['off', 'audit', 'warn', 'enforce']) {
    assert.equal(decide(mode, clean).decision, 'allowed');
    assert.equal(decide(mode, unknown).decision, 'allowed_with_warning');
  }
  assert.equal(decide('off', { status: 'not_run', valid: null }).decision, 'allowed');
  for (const mode of ['off', 'audit', 'warn']) {
    const result = decide(mode, hard);
    assert.equal(result.decision, 'allowed_with_warning');
    assert.equal(result.canProceed, true);
    assert.equal(hard.valid, false);
  }
  assert.deepEqual(decide('enforce', hard), {
    decision: 'blocked', canProceed: false, statusCode: 422, code: 'curriculum_boundary_violation',
  });
  assert.equal(decide('enforce', hard, 'generate').decision, 'blocked');
  assert.equal(decide('enforce', hard, 'publish').decision, 'blocked');
  assert.equal(decide('enforce', hard, 'audit').decision, 'allowed_with_warning');
  assert.equal(decide('enforce', hard, 'live_write', false).canProceed, true, 'pure media metadata may use existing guard');
});

test('W04: unavailable context fails closed in enforce; audit and warn expose unavailable', () => {
  for (const mode of ['audit', 'warn']) {
    assert.deepEqual(decide(mode, unavailable), { decision: 'unavailable', canProceed: true, statusCode: 200, code: 'unavailable' });
  }
  assert.equal(decide('enforce', unavailable).statusCode, 503);
  assert.equal(decide('enforce', unavailable).canProceed, false);
  const graph = { status: 'context_invalid', valid: null, integrityIssues: [{ code: 'prerequisite_cycle', severity: 'error' }] };
  assert.equal(decide('audit', graph).decision, 'unavailable');
  assert.equal(decide('enforce', graph).code, 'boundary_context_invalid');
});

test('schema, access, stale version and unresolved owner are rejected in every mode', () => {
  const failures = [
    [{ status: 'schema_invalid', valid: false }, 422],
    [{ status: 'access_denied', valid: null }, 403],
    [{ status: 'version_conflict', valid: null }, 409],
    [{ status: 'context_invalid', valid: null, integrityIssues: [{ code: 'grammar_lesson_owner_mismatch' }] }, 422],
  ];
  for (const mode of ['off', 'audit', 'warn', 'enforce']) {
    for (const [report, statusCode] of failures) {
      const result = decide(mode, report);
      assert.equal(result.decision, 'blocked', `${mode} ${report.status}`);
      assert.equal(result.statusCode, statusCode);
    }
  }
  assert.equal(decide('garbage', clean).code, 'boundary_policy_invalid');
  assert.equal(decide('enforce', null).code, 'boundary_report_invalid');
  assert.equal(decide('enforce', { status: 'evaluated', valid: null }).code, 'boundary_report_invalid');
});
