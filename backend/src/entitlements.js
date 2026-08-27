// Course access / entitlement checks — Phase 1 (course access foundation).
//
// Access is per (user, course): user_enrollments is the entitlement record
// (see migration 120). Enrolling in N5 never implies N4 access because
// every check below is scoped to a single course_id. Admins get implicit
// access to every course (mirrors GET /api/enrollments/me) so they can
// preview/QA content without a real enrollment row.
import { query } from './db.js';
import { isAdminEmail } from './auth.js';

// 'expired' is not a stored status — a row is only usable while
// status='active' AND (no expiry or the expiry hasn't passed yet).
export async function hasCourseAccess(userId, courseId) {
  if (!userId || !courseId) return false;
  const r = await query(
    `SELECT 1 FROM user_enrollments
      WHERE user_id = $1 AND course_id = $2
        AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1`,
    [userId, courseId]
  );
  return r.rows.length > 0;
}

export async function userCanAccessCourse(user, courseId) {
  if (!user || !courseId) return false;
  if (await hasCourseAccess(user.id, courseId)) return true;
  return isAdminEmail(user.email);
}

export async function courseIdForLessonId(lessonId) {
  const r = await query(
    `SELECT m.course_id FROM lessons l
       JOIN modules m ON m.id = l.module_id
      WHERE l.id = $1 LIMIT 1`,
    [lessonId]
  );
  return r.rows[0]?.course_id || null;
}

export async function courseIdForGrammarId(grammarId) {
  const r = await query(
    `SELECT m.course_id FROM module_grammar g
       JOIN modules m ON m.id = g.module_id
      WHERE g.id = $1 LIMIT 1`,
    [grammarId]
  );
  return r.rows[0]?.course_id || null;
}

// Middleware — resolves the course via a lesson id route param (default
// :lessonId) and 403s unless the caller has access to that lesson's course.
// Must run after requireAuth. Attaches req.courseId for the handler to reuse.
export function requireLessonCourseAccess(paramName = 'lessonId') {
  return async (req, res, next) => {
    const lessonId = req.params[paramName];
    const courseId = await courseIdForLessonId(lessonId);
    if (!courseId) return res.status(404).json({ error: 'Lesson not found' });
    if (!(await userCanAccessCourse(req.user, courseId))) {
      return res.status(403).json({ error: 'not_enrolled' });
    }
    req.courseId = courseId;
    next();
  };
}
