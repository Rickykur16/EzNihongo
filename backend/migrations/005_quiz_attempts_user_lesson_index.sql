-- Composite index for per-lesson attempt history lookups.
-- Existing idx_quiz_attempts_user only covers filtering by user; adding
-- lesson_id to the key lets "show me this student's attempts on lesson X"
-- hit an index rather than a full scan as the table grows.
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_lesson
  ON quiz_attempts(user_id, lesson_id);
