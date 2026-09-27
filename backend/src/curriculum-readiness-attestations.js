import { createHash } from 'node:crypto';
import { query, withTransaction } from './db.js';
import { lockCurriculumCourse } from './curriculum-content-service.js';
import { BoundaryContextError, getCurriculumBoundary } from './curriculum-boundary.js';
import { getCurriculumBoundaryMode, CurriculumModeError } from './curriculum-boundary-mode.js';
import { loadLearningFlowConfig } from './learning-flow-config.js';
import { isCanonicalUuid } from './live-class-admin-rules.js';

export const READINESS_GATES = Object.freeze([
  'migrationRerunAndLedger', 'n5ExistingSentinelZero',
  'graphOwnerOrderBankDeckKanji', 'writerInventoryNoBypass',
  'auditHardZeroUnavailableZero', 'unknownWarningsEditorialReview',
  'questionCurrentEvidenceNoKeyLeak', 'backfillDryApplyRerun',
  'v1V2ResumeReplayRollback', 'fullSuitesRealDbNoCriticalSkip',
  'browserChecklist', 'latencyAndQueryBaseline',
  'pilotTrafficAndEditorialCycle', 'ownerApproval',
]);
const STATUS = new Set(['PASS', 'FAIL', 'SKIP', 'UNKNOWN', 'BLOCKED']);
const SHA = /^sha256:[0-9a-f]{64}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const fail = (status, code) => { throw new CurriculumModeError(status, code); };
const digest = value => `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
export const actorDigest = id => digest(String(id));
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');

function validId(id, code) {
  if (typeof id !== 'string' || !isCanonicalUuid(id) || id !== id.toLowerCase()) fail(400, code);
}

function validArtifact(artifact) {
  if (!exact(artifact, ['url', 'sha256']) || typeof artifact.url !== 'string' ||
      artifact.url.length > 2048 || typeof artifact.sha256 !== 'string' ||
      !SHA.test(artifact.sha256)) return false;
  try {
    const url = new URL(artifact.url);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password &&
      !url.search && !url.hash;
  } catch { return false; }
}

export function parseReadinessClaim(body) {
  if (!exact(body, ['moduleId', 'environment', 'commitSha', 'sourceFingerprints', 'gates'])) {
    fail(400, 'readiness_attestation_schema_invalid');
  }
  validId(body.moduleId, 'invalid_module_id');
  if (body.environment !== 'staging' ||
      typeof body.commitSha !== 'string' || !COMMIT.test(body.commitSha) ||
      !Array.isArray(body.sourceFingerprints) || !body.sourceFingerprints.length ||
      body.sourceFingerprints.length > 500 ||
      body.sourceFingerprints.some(entry => !exact(entry, ['id', 'fingerprint']) ||
        typeof entry.id !== 'string' || !isCanonicalUuid(entry.id) ||
        entry.id !== entry.id.toLowerCase() || typeof entry.fingerprint !== 'string' ||
        !SHA.test(entry.fingerprint)) ||
      new Set(body.sourceFingerprints.map(entry => entry.id)).size !== body.sourceFingerprints.length ||
      !exact(body.gates, READINESS_GATES)) fail(400, 'readiness_attestation_schema_invalid');
  const gates = {};
  for (const code of READINESS_GATES) {
    const gate = body.gates[code];
    if (!exact(gate, ['status', 'artifacts']) || !STATUS.has(gate.status) ||
        !Array.isArray(gate.artifacts) || gate.artifacts.length > 10 ||
        gate.artifacts.some(artifact => !validArtifact(artifact)) ||
        (gate.status === 'PASS' && !gate.artifacts.length)) {
      fail(400, 'readiness_attestation_schema_invalid');
    }
    gates[code] = { status: gate.status, artifacts: gate.artifacts.map(artifact => ({
      url: artifact.url, sha256: artifact.sha256,
    })) };
  }
  return { moduleId: body.moduleId, environment: body.environment,
    commitSha: body.commitSha,
    sourceFingerprints: [...body.sourceFingerprints].sort((a, b) => a.id.localeCompare(b.id)),
    gates };
}

async function observedSnapshot(client, courseId, moduleId, {
  boundaryReader = getCurriculumBoundary, modeReader = getCurriculumBoundaryMode,
  configReader = loadLearningFlowConfig,
} = {}) {
  const dbQuery = client.query.bind(client);
  const mode = await modeReader(courseId, { dbQuery });
  let boundary;
  try { boundary = await boundaryReader({ courseId, moduleId }, { dbQuery }); }
  catch (error) {
    if (error instanceof BoundaryContextError) fail(422, 'readiness_scope_invalid');
    throw error;
  }
  if (String(boundary.course?.id) !== courseId ||
      String(boundary.currentModule?.id) !== moduleId ||
      typeof boundary.boundaryFingerprint !== 'string' ||
      !SHA.test(boundary.boundaryFingerprint)) fail(422, 'readiness_scope_invalid');
  const config = await configReader(client, { shared: true });
  // RELEASE_SHA must be injected from trusted deployment metadata. Generic
  // CI/provider variables are deliberately ignored because this process has
  // no proof that they describe the running checkout.
  const sha = typeof process.env.RELEASE_SHA === 'string' &&
    COMMIT.test(process.env.RELEASE_SHA) ? process.env.RELEASE_SHA : null;
  return { observedMode: mode.course.mode, observedModeRevision: mode.modeRevision,
    observedConfigRevision: config.configRevision,
    observedBoundaryFingerprint: boundary.boundaryFingerprint,
    observedCommitSha: sha };
}

async function lockLiveActor(client, actorId) {
  // Account erasure uses the same lock before deleting attestations and
  // anonymizing users. Taking it before course locks prevents a request that
  // authenticated just before erasure from recreating an actor-linked row
  // after erasure commits.
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`bunpou:${actorId}`]);
  const actor = (await client.query('SELECT id,email FROM users WHERE id=$1', [actorId])).rows[0];
  if (!actor || typeof actor.email !== 'string' || actor.email.endsWith('@dihapus.invalid')) {
    fail(401, 'readiness_actor_unavailable');
  }
}

export async function captureReadinessAttestation(courseId, actorId, body, {
  transaction = withTransaction, lockCourse = lockCurriculumCourse,
  snapshotReader = observedSnapshot, actorLocker = lockLiveActor,
} = {}) {
  validId(courseId, 'invalid_course_id');
  validId(actorId, 'invalid_actor_id');
  const claim = parseReadinessClaim(body);
  return transaction(async client => {
    await actorLocker(client, actorId);
    await lockCourse(client, courseId);
    const snapshot = await snapshotReader(client, courseId, claim.moduleId);
    const hash = digest(claim);
    const saved = (await client.query(`INSERT INTO curriculum_readiness_attestations
      (course_id,module_id,actor_digest,claim,claim_digest,observed_mode,
       observed_mode_revision,observed_config_revision,observed_boundary_fingerprint,
       observed_commit_sha)
      VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10)
      RETURNING id,created_at`, [courseId, claim.moduleId, actorDigest(actorId),
      JSON.stringify(claim), hash, snapshot.observedMode,
      snapshot.observedModeRevision, snapshot.observedConfigRevision,
      snapshot.observedBoundaryFingerprint, snapshot.observedCommitSha])).rows[0];
    return { id: saved.id, createdAt: saved.created_at,
      courseId, claimDigest: hash, claim, ...snapshot,
      claimedCommitMatchesObserved: snapshot.observedCommitSha !== null &&
        claim.commitSha === snapshot.observedCommitSha,
      verificationStatus: 'unverified', activationEligible: false };
  });
}

export async function listReadinessAttestations(courseId, moduleId, {
  transaction = withTransaction, lockCourse = lockCurriculumCourse,
  snapshotReader = observedSnapshot,
} = {}) {
  validId(courseId, 'invalid_course_id');
  validId(moduleId, 'invalid_module_id');
  return transaction(async client => {
    await lockCourse(client, courseId);
    const current = await snapshotReader(client, courseId, moduleId);
    const rows = (await client.query(`SELECT id,created_at,actor_digest,claim,claim_digest,
      observed_mode,observed_mode_revision,observed_config_revision,
      observed_boundary_fingerprint,observed_commit_sha,verification_status
      FROM curriculum_readiness_attestations
      WHERE course_id=$1 AND module_id=$2 ORDER BY created_at DESC,id DESC LIMIT 50`,
    [courseId, moduleId])).rows;
    return { courseId, moduleId, current, attestations: rows.map(row => ({
      id: row.id, createdAt: row.created_at, claim: row.claim,
      actorDigest: row.actor_digest, claimDigest: row.claim_digest,
      observed: { mode: row.observed_mode,
        modeRevision: row.observed_mode_revision,
        configRevision: row.observed_config_revision,
        boundaryFingerprint: row.observed_boundary_fingerprint,
        commitSha: row.observed_commit_sha },
      claimedCommitMatchesObserved: row.observed_commit_sha !== null &&
        row.claim.commitSha === row.observed_commit_sha,
      verificationStatus: 'unverified',
      activationEligible: false,
      observedSnapshotChanged: row.observed_mode_revision !== current.observedModeRevision ||
        row.observed_config_revision !== current.observedConfigRevision ||
        row.observed_boundary_fingerprint !== current.observedBoundaryFingerprint ||
        row.observed_commit_sha !== current.observedCommitSha,
    })) };
  });
}
