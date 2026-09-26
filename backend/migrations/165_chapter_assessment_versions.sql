-- Additive: old banks, attempts and completion history remain untouched.
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS assessment_policy JSONB;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS assessment_meta JSONB;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS assessment_snapshot JSONB;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS draft_answers JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS draft_revision INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_quiz_questions_assessment_version
  ON quiz_questions (lesson_id, ((assessment_meta->>'version')));
