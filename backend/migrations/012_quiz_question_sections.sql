-- Add quiz paper metadata so questions can be grouped into real
-- Vocabulary / Grammar / Listening tabs and section blocks.

ALTER TABLE quiz_questions
  ADD COLUMN IF NOT EXISTS question_category TEXT NOT NULL DEFAULT 'vocabulary',
  ADD COLUMN IF NOT EXISTS section_number INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS section_label TEXT NOT NULL DEFAULT 'Section 1',
  ADD COLUMN IF NOT EXISTS section_instruction TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quiz_questions_category_check'
  ) THEN
    ALTER TABLE quiz_questions
      ADD CONSTRAINT quiz_questions_category_check
      CHECK (question_category IN ('vocabulary', 'grammar', 'listening'));
  END IF;
END $$;

UPDATE quiz_questions
SET section_label = COALESCE(NULLIF(section_label, ''), 'Section ' || section_number::text)
WHERE section_label IS NULL OR section_label = '';

UPDATE quiz_questions
SET question_category = 'listening',
    section_number = 2,
    section_label = 'Section 2',
    section_instruction = COALESCE(section_instruction, '音声を聞いて、ただしい答えをえらんでください。')
WHERE question ILIKE '%Dengar audio%'
   OR question ILIKE '%audio%'
   OR question ILIKE '%音声%';

CREATE INDEX IF NOT EXISTS idx_quiz_questions_lesson_category
  ON quiz_questions(lesson_id, question_category, section_number, sort_order);
