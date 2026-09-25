-- Kana placement is decided by the overall score. Section scores are feedback,
-- not independent pass gates. Reconcile attempts rejected by the old rule.

UPDATE lessons l
   SET content = REPLACE(
         l.content,
         'Lulus jika nilai total minimal 85% dan sedikitnya 3 dari 4 soal benar pada setiap bagian.',
         'Lulus jika nilai total minimal 85%. Nilai per bagian hanya menunjukkan bacaan yang perlu dilatih lagi.'
       ),
       updated_at = NOW()
  FROM modules m
  JOIN courses c ON c.id = m.course_id
 WHERE l.module_id = m.id
   AND c.slug = 'n5'
   AND l.slug IN ('assignment-bab-1-hiragana', 'assignment-bab-2-katakana')
   AND l.content LIKE '%Lulus jika nilai total minimal 85% dan sedikitnya 3 dari 4 soal benar pada setiap bagian.%';

CREATE TEMP TABLE kana_placement_regraded ON COMMIT DROP AS
SELECT qa.id AS attempt_id, qa.user_id, qa.lesson_id, qa.completed_at,
       CASE l.slug
         WHEN 'assignment-bab-1-hiragana' THEN 'hiragana'
         ELSE 'katakana'
       END AS kind
  FROM quiz_attempts qa
  JOIN lessons l ON l.id = qa.lesson_id
  JOIN modules m ON m.id = l.module_id
  JOIN courses c ON c.id = m.course_id
 WHERE c.slug = 'n5'
   AND l.slug IN ('assignment-bab-1-hiragana', 'assignment-bab-2-katakana')
   AND qa.completed_at IS NOT NULL
   AND qa.score IS NOT NULL
   AND qa.total_questions > 0
   AND qa.score * 100 >= l.passing_score_pct * qa.total_questions
   AND qa.grading_result->>'passed' = 'false';

CREATE TEMP TABLE kana_placement_regraded_lessons ON COMMIT DROP AS
SELECT r.attempt_id, r.user_id, r.completed_at, l.id AS lesson_id,
       m.slug AS module_slug, l.slug AS lesson_slug
  FROM kana_placement_regraded r
  JOIN lessons assessment ON assessment.id = r.lesson_id
  JOIN modules assessment_module ON assessment_module.id = assessment.module_id
  JOIN modules m ON m.course_id = assessment_module.course_id
  JOIN lessons l ON l.module_id = m.id
  JOIN lesson_kana_items lki ON lki.lesson_id = l.id
  JOIN kana_items k ON k.id = lki.kana_id
 WHERE l.type = 'kana'
   AND (
     m.sort_order < assessment_module.sort_order
     OR (m.id = assessment_module.id AND l.sort_order < assessment.sort_order)
   )
 GROUP BY r.attempt_id, r.user_id, r.completed_at, r.kind, l.id, m.slug, l.slug
HAVING BOOL_AND(k.kind = r.kind);

UPDATE quiz_attempts qa
   SET grading_result = jsonb_set(
         jsonb_set(
           jsonb_set(qa.grading_result, '{passed}', 'true'::jsonb),
           '{completionSaved}', 'true'::jsonb
         ),
         '{proficiencyCompletions}',
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'lessonId', p.lesson_id,
             'moduleSlug', p.module_slug,
             'lessonSlug', p.lesson_slug
           ) ORDER BY p.module_slug, p.lesson_slug)
             FROM kana_placement_regraded_lessons p
            WHERE p.attempt_id = r.attempt_id
         ), '[]'::jsonb)
       )
  FROM kana_placement_regraded r
 WHERE qa.id = r.attempt_id;

WITH first_pass AS (
  SELECT user_id, lesson_id, MIN(completed_at) AS completed_at
    FROM kana_placement_regraded
   GROUP BY user_id, lesson_id
), transitioned AS (
  INSERT INTO user_progress (user_id, lesson_id, completed, completed_at)
  SELECT user_id, lesson_id, TRUE, completed_at FROM first_pass
  ON CONFLICT (user_id, lesson_id) DO UPDATE
    SET completed = TRUE,
        completed_at = COALESCE(user_progress.completed_at, EXCLUDED.completed_at),
        updated_at = NOW()
    WHERE user_progress.completed IS DISTINCT FROM TRUE
  RETURNING user_id, lesson_id
), awards AS (
  SELECT t.user_id,
         SUM(10 + COALESCE(l.duration_minutes, 0))::int AS xp,
         COUNT(*)::int AS completed_count,
         SUM(COALESCE(l.duration_minutes, 0))::int AS minutes
    FROM transitioned t
    JOIN lessons l ON l.id = t.lesson_id
   GROUP BY t.user_id
)
INSERT INTO user_stats (user_id, xp, total_lessons_completed, total_minutes_learned)
SELECT user_id, xp, completed_count, minutes FROM awards
ON CONFLICT (user_id) DO UPDATE
  SET xp = COALESCE(user_stats.xp, 0) + EXCLUDED.xp,
      total_lessons_completed = COALESCE(user_stats.total_lessons_completed, 0) + EXCLUDED.total_lessons_completed,
      total_minutes_learned = COALESCE(user_stats.total_minutes_learned, 0) + EXCLUDED.total_minutes_learned,
      updated_at = NOW();

INSERT INTO user_progress (user_id, lesson_id, completed, completed_at)
SELECT user_id, lesson_id, TRUE, MIN(completed_at)
  FROM kana_placement_regraded_lessons
 GROUP BY user_id, lesson_id
ON CONFLICT (user_id, lesson_id) DO UPDATE
  SET completed = TRUE,
      completed_at = COALESCE(user_progress.completed_at, EXCLUDED.completed_at),
      updated_at = NOW()
  WHERE user_progress.completed IS DISTINCT FROM TRUE;
