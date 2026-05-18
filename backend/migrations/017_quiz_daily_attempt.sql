-- Assignment harian: kuis pelajaran cuma boleh dicoba sekali per N jam
-- (default 12h). Tiap attempt sample acak dari pool soal lesson.
-- Threshold lulus per-lesson, default 70%.
--
-- Schema additions:
-- - lessons: passing_score_pct (default 70), questions_per_attempt
--   (NULL = ambil semua), cooldown_hours (default 12).
-- - quiz_attempts: attempt_token (UUID), sampled_question_ids (JSONB
--   snapshot soal yang dipilih), started_at (waktu attempt dimulai).
--
-- Backward compat: existing rows ga ke-affect (lessons.passing_score_pct
-- default 70 dipakai, questions_per_attempt NULL → semua soal lama
-- dipakai, cooldown_hours 12 jadi default baru).

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS passing_score_pct INT NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS questions_per_attempt INT,
  ADD COLUMN IF NOT EXISTS cooldown_hours INT NOT NULL DEFAULT 12;

ALTER TABLE quiz_attempts
  ADD COLUMN IF NOT EXISTS attempt_token UUID,
  ADD COLUMN IF NOT EXISTS sampled_question_ids JSONB,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- Backfill attempt_token untuk row existing supaya tidak null.
UPDATE quiz_attempts SET attempt_token = gen_random_uuid() WHERE attempt_token IS NULL;

-- Setelah backfill, set default + not null untuk forward.
ALTER TABLE quiz_attempts
  ALTER COLUMN attempt_token SET DEFAULT gen_random_uuid();

-- Index buat query "last attempt user pada lesson ini" cepat — dipakai
-- buat hitung cooldown remaining.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_quiz_attempts_user_lesson_completed') THEN
    CREATE INDEX idx_quiz_attempts_user_lesson_completed
      ON quiz_attempts (user_id, lesson_id, completed_at DESC);
  END IF;
END $$;
