-- Image opsi per quiz_option (JLPT-style listening dengan gambar 1-4
-- grid 2x2). image_url nullable — opsi text-only fallback.
--
-- Plus image_url per question (gambar prompt soal, opsional).

ALTER TABLE quiz_options
  ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE quiz_questions
  ADD COLUMN IF NOT EXISTS image_url TEXT;
