import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { READINESS_GATES, actorDigest, parseReadinessClaim,
  captureReadinessAttestation, listReadinessAttestations } from './curriculum-readiness-attestations.js';

const courseId = '10000000-0000-4000-8000-000000000001';
const moduleId = '10000000-0000-4000-8000-000000000002';
const actorId = '10000000-0000-4000-8000-000000000003';
const sourceId = '10000000-0000-4000-8000-000000000004';
const sha = `sha256:${'a'.repeat(64)}`;
const artifact = { url: 'https://ci.example.invalid/artifacts/review-1', sha256: sha };
const claim = () => ({ moduleId, environment: 'staging', commitSha: 'a'.repeat(40),
  sourceFingerprints: [{ id: sourceId, fingerprint: sha }],
  gates: Object.fromEntries(READINESS_GATES.map(code => [code,
    { status: 'BLOCKED', artifacts: [] }])) });
const observed = { observedMode: 'off', observedModeRevision: sha,
  observedConfigRevision: sha, observedBoundaryFingerprint: sha,
  observedCommitSha: null };

test('fixed-gate claim parser is exact and rejects unsupported PASS evidence or secret-bearing refs', () => {
  const valid = claim();
  valid.gates.browserChecklist = { status: 'PASS', artifacts: [artifact] };
  assert.deepEqual(parseReadinessClaim(valid), valid);
  for (const mutate of [
    value => { value.extra = true; },
    value => { value.environment = 'production'; },
    value => { delete value.gates.ownerApproval; },
    value => { value.gates.browserChecklist.artifacts = []; },
    value => { value.gates.browserChecklist.artifacts[0].url += '?token=private'; },
    value => { value.gates.browserChecklist.artifacts[0].sha256 = [sha]; },
    value => { value.sourceFingerprints[0].fingerprint = [sha]; },
    value => { value.sourceFingerprints[0].fingerprint = 'unverified'; },
  ]) {
    const invalid = structuredClone(valid);
    mutate(invalid);
    assert.throws(() => parseReadinessClaim(invalid),
      error => error.status === 400 && error.code === 'readiness_attestation_schema_invalid');
  }
});

test('capture stores server-observed snapshot and authenticated actor digest, never activates', async () => {
  const calls = [];
  let actorLocked = false;
  const client = { async query(sql, params) {
    calls.push({ sql, params });
    if (sql.includes('pg_advisory_xact_lock')) {
      assert.equal(params[0], `bunpou:${actorId}`); actorLocked = true;
      return { rows: [] };
    }
    if (sql === 'SELECT id,email FROM users WHERE id=$1') {
      assert.equal(actorLocked, true);
      return { rows: [{ id: actorId, email: 'owner@example.invalid' }] };
    }
    if (sql.includes('INSERT INTO curriculum_readiness_attestations')) return {
      rows: [{ id: sourceId, created_at: '2026-09-27T00:00:00Z' }],
    };
    throw new Error(`unexpected SQL: ${sql}`);
  } };
  let locked = false;
  const result = await captureReadinessAttestation(courseId, actorId, claim(), {
    transaction: fn => fn(client),
    lockCourse: async (_client, id) => {
      assert.equal(actorLocked, true, 'actor erasure lock precedes curriculum locks');
      assert.equal(id, courseId); locked = true;
    },
    snapshotReader: async () => { assert.equal(locked, true); return observed; },
  });
  assert.equal(result.activationEligible, false);
  assert.equal(result.verificationStatus, 'unverified');
  assert.equal(result.observedBoundaryFingerprint, sha);
  assert.equal(result.claimedCommitMatchesObserved, false);
  const insert = calls.find(call => call.sql.includes('INSERT INTO curriculum_readiness_attestations'));
  assert.equal(calls.length, 3);
  assert.equal(insert.params[2], actorDigest(actorId));
  assert.equal(insert.params.includes(actorId), false);
  assert.equal(JSON.stringify(result).includes(actorId), false);
  assert.match(result.claimDigest, /^sha256:[a-f0-9]{64}$/);
});

test('capture rejects a tombstone actor under the erasure lock before course access', async () => {
  let courseLocked = false;
  const client = { async query(sql) {
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
    if (sql === 'SELECT id,email FROM users WHERE id=$1') {
      return { rows: [{ id: actorId, email: `dihapus-${actorId}@dihapus.invalid` }] };
    }
    throw new Error(`unexpected SQL: ${sql}`);
  } };
  await assert.rejects(captureReadinessAttestation(courseId, actorId, claim(), {
    transaction: fn => fn(client),
    lockCourse: async () => { courseLocked = true; },
    snapshotReader: async () => observed,
  }), error => error.status === 401 && error.code === 'readiness_actor_unavailable');
  assert.equal(courseLocked, false);
});

test('read flags a changed server snapshot without treating any claim as readiness proof', async () => {
  const row = { id: sourceId, created_at: '2026-09-27T00:00:00Z',
    actor_digest: actorDigest(actorId), claim: claim(), claim_digest: sha,
    observed_mode: 'off', observed_mode_revision: sha,
    observed_config_revision: sha, observed_boundary_fingerprint: sha,
    observed_commit_sha: null };
  const client = { async query(sql) {
    assert.match(sql, /FROM curriculum_readiness_attestations/u);
    return { rows: [row] };
  } };
  const result = await listReadinessAttestations(courseId, moduleId, {
    transaction: fn => fn(client), lockCourse: async () => {},
    snapshotReader: async () => ({ ...observed,
      observedBoundaryFingerprint: `sha256:${'b'.repeat(64)}` }),
  });
  assert.equal(result.attestations[0].observedSnapshotChanged, true);
  assert.equal(result.attestations[0].actorDigest, actorDigest(actorId));
  assert.deepEqual(result.attestations[0].observed, { mode: 'off', modeRevision: sha,
    configRevision: sha, boundaryFingerprint: sha, commitSha: null });
  assert.equal(result.attestations[0].claimedCommitMatchesObserved, false);
  assert.equal(result.attestations[0].activationEligible, false);
  assert.equal(result.attestations[0].verificationStatus, 'unverified');
});

test('PostgreSQL migration is additive, immutable, and erasure-compatible', {
  skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL to an isolated local test database',
  timeout: 30000,
}, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.equal(url.searchParams.has('host'), false);
  assert.equal(url.searchParams.has('hostaddr'), false);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  assert.match(url.pathname, /test/i);
  const schema = `readiness_test_${randomUUID().replaceAll('-', '')}`;
  const client = new pg.Client({ connectionString: url.href, statement_timeout: 10000 });
  await client.connect();
  t.after(async () => {
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  });
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`SET search_path TO "${schema}"`);
  const migration = await readFile(new URL('../migrations/166_curriculum_readiness_attestations.sql',
    import.meta.url), 'utf8');
  await client.query(migration);
  const id = randomUUID();
  await client.query(`INSERT INTO curriculum_readiness_attestations
    (id,course_id,module_id,actor_digest,claim,claim_digest,observed_mode,
     observed_mode_revision,observed_config_revision,observed_boundary_fingerprint)
    VALUES ($1,$2,$3,$4,'{}'::jsonb,$5,'off',$5,$5,$5)`,
  [id, courseId, moduleId, actorDigest(actorId), sha]);
  await assert.rejects(client.query(`UPDATE curriculum_readiness_attestations
    SET verification_status='unverified' WHERE id=$1`, [id]),
  error => error.code === '23514');
  const fks = await client.query(`SELECT 1 FROM pg_constraint WHERE conrelid =
    'curriculum_readiness_attestations'::regclass AND contype='f'`);
  assert.equal(fks.rowCount, 0);
  assert.equal((await client.query('DELETE FROM curriculum_readiness_attestations WHERE id=$1',
    [id])).rowCount, 1);
});
