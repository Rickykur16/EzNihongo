import { createHash } from 'node:crypto';
import { query, withTransaction } from './db.js';
import { lockCurriculumCourse } from './curriculum-content-service.js';
import { isCanonicalUuid } from './live-class-admin-rules.js';

const MODES = new Set(['off', 'audit', 'warn', 'enforce']);
const REVISION = /^sha256:[0-9a-f]{64}$/u;

export class CurriculumModeError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

const fail = (status, code) => { throw new CurriculumModeError(status, code); };
const modeRevision = row => `sha256:${createHash('sha256').update(JSON.stringify([
  String(row.id), row.curriculum_boundary_mode, String(row.row_revision),
])).digest('hex')}`;
const dto = row => ({ course: { id: row.id, slug: row.slug,
  title: row.title, mode: row.curriculum_boundary_mode },
modeRevision: modeRevision(row) });

function validCourseId(courseId) {
  if (typeof courseId !== 'string' || !isCanonicalUuid(courseId)) fail(400, 'invalid_course_id');
}

function validChange(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).sort().join(',') !== 'expectedRevision,mode' ||
      !MODES.has(body.mode) || typeof body.expectedRevision !== 'string' ||
      !REVISION.test(body.expectedRevision)) fail(400, 'boundary_mode_schema_invalid');
}

export async function getCurriculumBoundaryMode(courseId, { dbQuery = query } = {}) {
  validCourseId(courseId);
  const row = (await dbQuery(`SELECT id,slug,title,curriculum_boundary_mode,xmin::text AS row_revision
    FROM courses WHERE id=$1`, [courseId])).rows[0];
  if (!row) fail(404, 'course_not_found');
  if (!MODES.has(row.curriculum_boundary_mode)) fail(503, 'boundary_mode_unavailable');
  return dto(row);
}

export async function saveCurriculumBoundaryMode(courseId, body, {
  transaction = withTransaction, lockCourse = lockCurriculumCourse,
  logger = event => console.info(JSON.stringify(event)),
} = {}) {
  validCourseId(courseId);
  validChange(body);
  const change = await transaction(async client => {
    // Writers use a shared graph lock followed by sorted closure course locks;
    // join that protocol before taking the course row lock or reading its CAS.
    await lockCourse(client, courseId);
    const row = (await client.query(`SELECT id,slug,title,curriculum_boundary_mode,
      xmin::text AS row_revision FROM courses WHERE id=$1 FOR UPDATE`, [courseId])).rows[0];
    if (!row) fail(404, 'course_not_found');
    if (!MODES.has(row.curriculum_boundary_mode)) fail(503, 'boundary_mode_unavailable');
    if (modeRevision(row) !== body.expectedRevision) fail(409, 'boundary_mode_revision_conflict');
    if (body.mode === row.curriculum_boundary_mode) return { result: dto(row), changed: false };
    // No server-owned, current §15.3 readiness-evidence registry exists yet.
    // A client-supplied manifest/report count is not proof, so promotion is
    // unconditionally closed until a separate reviewed implementation lands.
    if (body.mode === 'enforce') fail(422, 'enforce_readiness_evidence_unavailable');
    const updated = (await client.query(`UPDATE courses SET curriculum_boundary_mode=$2
      WHERE id=$1 AND xmin::text=$3
      RETURNING id,slug,title,curriculum_boundary_mode,xmin::text AS row_revision`,
    [courseId, body.mode, row.row_revision])).rows[0];
    if (!updated) fail(409, 'boundary_mode_revision_conflict');
    return { result: dto(updated), changed: true, previousMode: row.curriculum_boundary_mode };
  });
  if (change.changed) {
    try { logger({ event: 'curriculum_boundary_mode_changed', schemaVersion: 1,
      courseId, fromMode: change.previousMode, toMode: change.result.course.mode }); }
    catch { /* telemetry must never turn a committed change into an HTTP error */ }
  }
  return change.result;
}
