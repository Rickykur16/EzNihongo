// Transaction-scoped completion operations.  The caller provides a pg client
// already protected by an advisory lock for (user, lesson).

export async function completeLessonWithStats(client, { userId, lessonId }) {
  const lesson = await client.query(
    `SELECT id, duration_minutes FROM lessons WHERE id = $1 LIMIT 1`,
    [lessonId]
  );
  if (lesson.rows.length === 0) return { found: false, firstComplete: false };

  // `WHERE user_progress.completed IS DISTINCT FROM TRUE` makes the returned
  // row exactly the one-time FALSE/NULL → TRUE transition.  It works even
  // when a row was previously created for a note, unlike xmax-based detection.
  const transition = await client.query(
    `INSERT INTO user_progress (user_id, lesson_id, completed, completed_at)
     VALUES ($1, $2, TRUE, NOW())
     ON CONFLICT (user_id, lesson_id) DO UPDATE
       SET completed = TRUE,
           completed_at = COALESCE(user_progress.completed_at, NOW()),
           updated_at = NOW()
       WHERE user_progress.completed IS DISTINCT FROM TRUE
     RETURNING lesson_id`,
    [userId, lessonId]
  );
  const firstComplete = transition.rowCount === 1;

  if (firstComplete) {
    const minutes = Number(lesson.rows[0].duration_minutes) || 0;
    const xpGained = 10 + minutes;
    await client.query(
      `INSERT INTO user_stats (user_id, xp, total_lessons_completed, total_minutes_learned, last_active_date)
       VALUES ($1, $2, 1, $3, CURRENT_DATE)
       ON CONFLICT (user_id) DO UPDATE
       SET xp = user_stats.xp + EXCLUDED.xp,
           total_lessons_completed = user_stats.total_lessons_completed + 1,
           total_minutes_learned = user_stats.total_minutes_learned + EXCLUDED.total_minutes_learned,
           streak_days = CASE
             WHEN user_stats.last_active_date = CURRENT_DATE THEN user_stats.streak_days
             WHEN user_stats.last_active_date = CURRENT_DATE - 1 THEN user_stats.streak_days + 1
             ELSE 1
           END,
           last_active_date = CURRENT_DATE,
           updated_at = NOW()`,
      [userId, xpGained, minutes]
    );
  }

  return { found: true, firstComplete };
}

export async function reconcileLegacyProgress(client, userId) {
  // Legacy blobs only say an item is complete; they do not carry a trustworthy
  // completion timestamp.  Keep completed_at NULL for records reconstructed
  // here and do not award retrospective XP or stats.
  const result = await client.query(
    `WITH legacy_lessons AS (
       SELECT DISTINCT l.id AS lesson_id
       FROM user_learning_state uls
       CROSS JOIN LATERAL jsonb_each(
         CASE WHEN jsonb_typeof(uls.progress) = 'object' THEN uls.progress ELSE '{}'::jsonb END
       ) AS course_entry(course_slug, course_progress)
       CROSS JOIN LATERAL jsonb_each(
         CASE WHEN jsonb_typeof(course_entry.course_progress) = 'object'
              THEN course_entry.course_progress ELSE '{}'::jsonb END
       ) AS progress_entry(legacy_key, is_completed)
       JOIN courses c ON c.slug = course_entry.course_slug
       JOIN modules m ON m.course_id = c.id
       JOIN lessons l ON l.module_id = m.id
                    AND progress_entry.legacy_key = m.slug || ':' || l.slug
       WHERE uls.user_id = $1
         AND progress_entry.is_completed = 'true'::jsonb
     ), transitioned AS (
       INSERT INTO user_progress (user_id, lesson_id, completed, completed_at)
       SELECT $1, lesson_id, TRUE, NULL
       FROM legacy_lessons
       ON CONFLICT (user_id, lesson_id) DO UPDATE
         SET completed = TRUE,
             completed_at = user_progress.completed_at,
             updated_at = NOW()
         WHERE user_progress.completed IS DISTINCT FROM TRUE
       RETURNING lesson_id
     )
     SELECT
       (SELECT COUNT(*)::int FROM legacy_lessons) AS candidates,
       (SELECT COUNT(*)::int FROM transitioned) AS reconciled`,
    [userId]
  );
  return result.rows[0] || { candidates: 0, reconciled: 0 };
}
