import { createHash } from 'node:crypto';
import { withTransaction } from './db.js';
import { BoundaryContextError, BoundaryUnavailableError, getCurriculumBoundary } from './curriculum-boundary.js';
import { validateContentAgainstBoundary, CURRICULUM_VALIDATOR_VERSION } from './curriculum-boundary-validator.js';
import { decideBoundaryAction } from './curriculum-boundary-policy.js';

const jsonHash = value => `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
const revision = value => {
  if (value == null) return null;
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? String(value) : time.toISOString();
};

export class BoundaryWriteError extends Error {
  constructor(decision, report) {
    super(decision.code || 'curriculum_boundary_violation');
    this.name = 'BoundaryWriteError';
    this.code = decision.code;
    this.statusCode = decision.statusCode;
    this.decision = decision;
    this.report = report;
  }
}

export async function lockCurriculumGraph(client, { exclusive = false } = {}) {
  // Ordinary content writers share the graph lock; prerequisite/topology
  // mutations take it exclusively. This stabilizes closure reads without
  // serializing unrelated courses.
  await client.query(exclusive
    ? 'SELECT pg_advisory_xact_lock(hashtext($1))'
    : 'SELECT pg_advisory_xact_lock_shared(hashtext($1))', ['curriculum-boundary:graph']);
}

export async function lockCurriculumCourse(client, courseId) {
  if (!courseId) throw new BoundaryContextError('course_not_found');
  await lockCurriculumGraph(client);
  const closure = await client.query(`WITH RECURSIVE required(id) AS (
      SELECT $1::uuid
      UNION
      SELECT p.prerequisite_course_id FROM course_prerequisites p JOIN required r ON r.id=p.course_id
    ) SELECT id FROM required ORDER BY id::text`, [courseId]);
  for (const row of closure.rows) {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`curriculum-boundary:${row.id}`]);
  }
}

async function insertReport(client, { boundary, course, candidate, report, decision, contentId = null }) {
  const scope = candidate.scope || {};
  await client.query(`INSERT INTO curriculum_boundary_reports
    (course_id,module_id,lesson_id,content_type,content_id,content_fingerprint,
     boundary_fingerprint,validator_version,policy_version,operation,mode,
     validation_status,decision,violations,warnings,usage,integrity_issues,correlation_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'1',$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,$17)`, [
    boundary?.course?.id || course?.id || null, boundary?.currentModule?.id || scope.moduleId || null,
    boundary?.lesson?.id || scope.lessonId || null,
    candidate.contentType, contentId || candidate.contentId || null,
    jsonHash({ fields: candidate.fields, communicationGoal: candidate.communicationGoal }),
    report.boundaryFingerprint, CURRICULUM_VALIDATOR_VERSION, candidate.operation || 'live_write',
    boundary?.course?.mode || course?.mode || 'off', report.status, decision.decision,
    JSON.stringify(report.violations || []), JSON.stringify(report.warnings || []),
    JSON.stringify(report.usage || {}), JSON.stringify(report.integrityIssues || []),
    candidate.correlationId || null,
  ]);
}

// A single lookup identifies the server-owned course even when the full
// resolver is unavailable. Never take a course ID or mode from the request.
export async function loadBoundaryWriteCourse(client, scope) {
  const { moduleId, lessonId, grammarId } = scope || {};
  if (!moduleId && !lessonId && !grammarId) throw new BoundaryContextError('boundary_leaf_context_required');
  let result;
  try { result = await client.query(`SELECT c.id,c.curriculum_boundary_mode AS mode,m.id AS module_id
    FROM modules m JOIN courses c ON c.id=m.course_id
    LEFT JOIN lessons l ON l.module_id=m.id AND l.id=$2
    LEFT JOIN module_grammar g ON g.module_id=m.id AND g.id=$3
    WHERE m.id=COALESCE($1::uuid,l.module_id,g.module_id)
      AND ($2::uuid IS NULL OR l.id IS NOT NULL)
      AND ($3::uuid IS NULL OR g.id IS NOT NULL) LIMIT 1`, [moduleId || null, lessonId || null, grammarId || null]); }
  catch (error) {
    if (error.code === '22P02') throw new BoundaryContextError('invalid_scope_id');
    throw new BoundaryUnavailableError(error);
  }
  if (!result.rows.length) throw new BoundaryContextError('boundary_context_mismatch');
  const row = result.rows[0];
  return { id: row.id, mode: row.mode || 'off', moduleId: row.module_id };
}

function unavailableReport(error) {
  return { status: error instanceof BoundaryContextError ? 'context_invalid' : 'unavailable', valid: null,
    boundaryFingerprint: null, validatorVersion: CURRICULUM_VALIDATOR_VERSION,
    violations: [], warnings: [{ code: error.code || 'boundary_unavailable' }], usage: {},
    integrityIssues: error instanceof BoundaryContextError ? [{ code: error.code, severity: 'error' }] : [] };
}

/**
 * Prepare, resolve, validate, write and report on one PostgreSQL client.
 * `prepare(client,{locked})` must resolve old rows and merge partial input into
 * the full learner-visible candidate. It may take row locks only when `locked`
 * is true, after the course advisory lock. `write(client,candidate)` performs the exact
 * existing write only after validation. A preview report is never accepted as
 * proof: the resolver runs again after the course advisory lock.
 *
 * All curriculum writers must acquire lockCurriculumCourse for the same course,
 * including importers and graph mutations. The lock orders concurrent writers;
 * the fresh fingerprint rejects a candidate based on an older boundary.
 */
export async function validateAndWriteContent({
  prepare, write, transaction = withTransaction, resolveBoundary = getCurriculumBoundary,
  validate = validateContentAgainstBoundary, decide = decideBoundaryAction,
  reportWriter = insertReport, rejectedReportTransaction = withTransaction,
  logger = console,
}) {
  if (typeof prepare !== 'function' || typeof write !== 'function') throw new TypeError('prepare and write required');
  let rejected = null;
  try {
    return await transaction(async client => {
      const preliminary = await prepare(client, { locked: false });
      if (!preliminary?.scope || !preliminary.contentType || !Array.isArray(preliminary.fields)) {
        throw new BoundaryWriteError({ code: 'invalid_content_schema', statusCode: 422, decision: 'blocked' },
          { status: 'schema_invalid', valid: false, violations: [{ code: 'invalid_content_schema' }] });
      }
      const course = await loadBoundaryWriteCourse(client, preliminary.scope);
      await lockCurriculumCourse(client, course.id);
      const candidate = await prepare(client, { locked: true });
      if (!candidate?.scope || !candidate.contentType || !Array.isArray(candidate.fields)) {
        throw new BoundaryContextError('boundary_context_mismatch');
      }
      const lockedCourse = await loadBoundaryWriteCourse(client, candidate.scope);
      if (lockedCourse.id !== course.id) throw new BoundaryContextError('boundary_context_mismatch');
      const operation = candidate.operation || 'live_write';
      const structural = validate({ ...candidate, boundary: null, operation });
      if (structural.status === 'schema_invalid') {
        const decision = decide({ mode: lockedCourse.mode, operation, report: structural });
        rejected = { course: lockedCourse, candidate, report: structural, decision };
        throw new BoundaryWriteError(decision, structural);
      }
      if (candidate.expectedRevision != null && revision(candidate.currentRevision) !== revision(candidate.expectedRevision)) {
        const report = { ...structural, status: 'version_conflict', valid: null,
          warnings: [{ code: 'content_changed_since_editor_open' }] };
        const decision = decide({ mode: lockedCourse.mode, operation, report });
        rejected = { course: lockedCourse, candidate, report, decision };
        throw new BoundaryWriteError(decision, report);
      }
      let boundary;
      await client.query('SAVEPOINT boundary_resolve');
      try {
        boundary = await resolveBoundary(candidate.scope, { dbQuery: client.query.bind(client) });
        await client.query('RELEASE SAVEPOINT boundary_resolve');
      }
      catch (error) {
        await client.query('ROLLBACK TO SAVEPOINT boundary_resolve');
        await client.query('RELEASE SAVEPOINT boundary_resolve');
        if (!(error instanceof BoundaryUnavailableError || error instanceof BoundaryContextError)) throw error;
        const report = unavailableReport(error);
        const decision = decide({ mode: lockedCourse.mode, operation, report,
          contentIsNewOrChanged: candidate.contentIsNewOrChanged !== false });
        if (!decision.canProceed) {
          rejected = { course: lockedCourse, candidate, report, decision };
          throw new BoundaryWriteError(decision, report);
        }
        const value = await write(client, candidate);
        await reportWriter(client, { course: lockedCourse, candidate, report, decision, contentId: value?.id || null });
        return { value, report, decision };
      }
      if (boundary.course.id !== lockedCourse.id) throw new BoundaryContextError('boundary_context_mismatch');
      if (boundary.course.mode !== lockedCourse.mode) throw new BoundaryContextError('boundary_context_mismatch');
      let report;
      if (boundary.course.mode === 'off') {
        const structural = validate({ ...candidate, boundary, operation });
        report = structural.status === 'schema_invalid' || structural.status === 'context_invalid'
          ? structural : { ...structural, status: 'not_run', valid: null, violations: [], warnings: [] };
      } else report = validate({ ...candidate, boundary, operation });
      if (candidate.expectedBoundaryFingerprint && candidate.expectedBoundaryFingerprint !== boundary.boundaryFingerprint) {
        report = { ...report, status: 'version_conflict', valid: null,
          warnings: [{ code: 'boundary_changed_since_preview' }] };
      }
      const decision = decide({ mode: boundary.course.mode, operation, report,
        contentIsNewOrChanged: candidate.contentIsNewOrChanged !== false });
      if (!decision.canProceed) {
        rejected = { boundary, course, candidate, report, decision };
        throw new BoundaryWriteError(decision, report);
      }
      const value = await write(client, candidate);
      await reportWriter(client, { boundary, course, candidate, report, decision, contentId: value?.id || null });
      return { value, report, decision };
    });
  } catch (error) {
    if (!rejected && (error instanceof BoundaryUnavailableError || error instanceof BoundaryContextError)) {
      const report = unavailableReport(error);
      const decision = decide({ mode: error instanceof BoundaryContextError ? 'off' : 'enforce',
        operation: 'live_write', report });
      // Query failures cannot be safely assigned to a course mode. Fail closed.
      const safeDecision = decision.canProceed
        ? { decision: 'blocked', canProceed: false, statusCode: error instanceof BoundaryContextError ? 422 : 503,
          code: error instanceof BoundaryContextError ? 'boundary_context_invalid' : 'boundary_unavailable' }
        : decision;
      throw new BoundaryWriteError(safeDecision, report);
    }
    if (rejected) {
      try {
        await rejectedReportTransaction(client => reportWriter(client, rejected));
      } catch (reportError) {
        logger.error('curriculum_boundary_rejected_report_unavailable', { code: reportError.code || reportError.message });
      }
    }
    throw error;
  }
}

export function boundaryWriteHttpError(error) {
  if (!(error instanceof BoundaryWriteError)) return null;
  return { statusCode: error.statusCode, body: { error: error.code, validation: error.report } };
}
