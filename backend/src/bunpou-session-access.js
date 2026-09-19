import { isAdminEmail } from './auth.js';

// Call only after acquiring the per-user Bunpou transaction lock. Erasure
// takes that same lock before anonymizing the user or deleting practice data.
export async function pilotAccessError(client, user, sourceLessonId) {
  const account = (await client.query(`SELECT email FROM users WHERE id = $1 FOR SHARE`, [user.id])).rows[0];
  if (!account || account.email?.toLowerCase() !== user.email?.toLowerCase()
    || account.email?.endsWith('@dihapus.invalid')) return { status: 403, error: 'account_unavailable' };
  const settings = await client.query(`SELECT key, value FROM app_settings
    WHERE key IN ('bunpou_flow_pilot_enabled','bunpou_flow_pilot_lesson_id') FOR SHARE`);
  const values = Object.fromEntries(settings.rows.map(row => [row.key, row.value]));
  if (values.bunpou_flow_pilot_enabled !== 'true' || values.bunpou_flow_pilot_lesson_id !== sourceLessonId) {
    return { status: 403, error: 'pilot_not_enabled_for_lesson' };
  }
  const course = (await client.query(`SELECT m.course_id FROM lessons l
    JOIN modules m ON m.id = l.module_id WHERE l.id = $1`, [sourceLessonId])).rows[0];
  if (!course) return { status: 404, error: 'lesson_not_found' };
  const enrollment = await client.query(`SELECT user_id FROM user_enrollments
    WHERE user_id = $1 AND course_id = $2 AND status = 'active'
      AND (expires_at IS NULL OR expires_at > clock_timestamp()) FOR SHARE`, [user.id, course.course_id]);
  if (!enrollment.rows.length && !(await isAdminEmail(account.email))) return { status: 403, error: 'not_enrolled' };
  return null;
}

export async function taskScopeError(client, sourceLessonId, taskLessonId, grammarIds) {
  const scope = await client.query(`SELECT sm.course_id FROM lessons source
    JOIN modules sm ON sm.id = source.module_id
    JOIN lessons task ON task.id = $2 AND task.type = 'grammar_task' AND task.popup_after_lesson_id = source.id
    JOIN modules tm ON tm.id = task.module_id AND tm.course_id = sm.course_id
    WHERE source.id = $1 FOR SHARE OF source, task, sm, tm`, [sourceLessonId, taskLessonId]);
  if (!scope.rows.length) return { status: 403, error: 'session_scope_changed' };
  const foreignItems = await client.query(`SELECT 1 FROM unnest($1::text[]) AS i(id) WHERE NOT EXISTS (
      SELECT 1 FROM module_grammar g JOIN modules m ON m.id = g.module_id
      WHERE g.id::text = i.id AND m.course_id = $2
    ) LIMIT 1`, [grammarIds, scope.rows[0].course_id]);
  if (foreignItems.rows.length) return { status: 403, error: 'session_scope_changed' };
  return null;
}

export async function sessionAccessError(client, user, sessionId) {
  const session = (await client.query(`SELECT *, expires_at > clock_timestamp() AS active
    FROM grammar_task_sessions WHERE id = $1 FOR SHARE`, [sessionId])).rows[0];
  if (!session || session.user_id !== user.id) return { status: 404, error: 'session_not_found' };
  if (!session.active) return { status: 410, error: 'session_expired' };
  const items = await client.query(`SELECT grammar_id FROM grammar_task_session_items WHERE session_id = $1`, [sessionId]);
  const grammarIds = [...new Set([...items.rows.map(row => row.grammar_id),
    ...(session.production_snapshot || []).map(row => row.grammarId)])];
  const scopeError = await taskScopeError(client, session.source_lesson_id, session.task_lesson_id, grammarIds);
  if (scopeError) return scopeError;
  return pilotAccessError(client, user, session.source_lesson_id);
}
