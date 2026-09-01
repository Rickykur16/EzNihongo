import { query } from './db.js';
import { userCanAccessCourse } from './entitlements.js';
import { canJoinLiveClass, organizeStudentLiveClasses } from './live-class-rules.js';

export { canJoinLiveClass } from './live-class-rules.js';

function relatedByClass(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!row.lesson_id) continue;
    if (!map.has(row.class_id)) map.set(row.class_id, []);
    map.get(row.class_id).push({ id: row.lesson_id, slug: row.lesson_slug, title: row.lesson_title, chapter: { slug: row.module_slug, title: row.module_title }, section: row.section_name || null });
  }
  return map;
}

function classJson(row, related) {
  return { id: row.id, courseId: row.course_id, title: row.title, description: row.description || null,
    startsAt: row.starts_at, endsAt: row.ends_at || null, status: row.status,
    meetingUrl: row.meeting_url || null, recordingUrl: row.recording_url || null,
    canJoin: canJoinLiveClass(row), relatedLessons: related.get(row.id) || [] };
}

async function classesWithLessons(courseId, whereSql, params) {
  const rows = await query(
    `SELECT lc.*, CASE WHEN m.course_id = lc.course_id THEN l.id ELSE NULL END AS lesson_id, l.slug AS lesson_slug, l.title AS lesson_title,
            m.slug AS module_slug, m.title AS module_title, m.section_name
       FROM live_classes lc
       LEFT JOIN live_class_lessons lcl ON lcl.live_class_id = lc.id
       LEFT JOIN lessons l ON l.id = lcl.lesson_id
       LEFT JOIN modules m ON m.id = l.module_id
      WHERE lc.course_id = $1 AND ${whereSql}
      ORDER BY lc.starts_at ASC, lcl.sort_order ASC`, [courseId, ...params]
  );
  const grouped = new Map();
  for (const row of rows.rows) if (!grouped.has(row.id)) grouped.set(row.id, row);
  const related = relatedByClass(rows.rows);
  return [...grouped.values()].map((row) => classJson(row, related));
}

export async function loadEntitledLiveClasses(user, courseSlug) {
  const course = await query(`SELECT id, slug, title, level FROM courses WHERE slug = $1 AND is_published = TRUE LIMIT 1`, [courseSlug]);
  if (!course.rows[0]) return { error: 'course_not_found', status: 404 };
  if (!(await userCanAccessCourse(user, course.rows[0].id))) return { error: 'not_enrolled', status: 403 };
  const courseRow = course.rows[0];
  const [scheduled, completed] = await Promise.all([
    classesWithLessons(courseRow.id, `lc.status = 'scheduled' AND COALESCE(lc.ends_at, lc.starts_at + INTERVAL '3 hours') >= NOW()`, []),
    classesWithLessons(courseRow.id, `lc.status = 'completed' AND lc.recording_url IS NOT NULL`, []),
  ]);
  return { course: courseRow, ...organizeStudentLiveClasses([...scheduled, ...completed]) };
}

export async function loadLiveClassSummary(user, courseSlug) {
  const data = await loadEntitledLiveClasses(user, courseSlug);
  if (data.error) return { next: null, recentRecordings: [] };
  return { next: data.next, recentRecordings: data.recordings.slice(0, 3) };
}
