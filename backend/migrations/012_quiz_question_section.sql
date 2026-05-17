-- Tag tiap quiz_question dengan section JLPT-style (vocabulary / grammar /
-- listening / reading). Frontend group questions by section dan render
-- sebagai tab navigation di quiz page. Nullable — old quizzes default ke
-- 'vocabulary' lewat COALESCE di backend response.
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS section TEXT;
