-- 034_restore_reading_category.sql — Hidupkan lagi kategori Dokkai (reading) + passage.
--
-- Sejarah: ditambah di 028, dibatalkan di 029 (waktu itu belum dipakai).
-- Sekarang user minta dokkai beneran (generator soal JLPT per-mondai), jadi
-- restore: kolom `passage` (teks bacaan, dishare oleh beberapa soal — semua
-- soal satu bacaan menyimpan string passage yang sama) + CHECK 4 kategori.
-- Idempotent: aman dijalankan setelah 029 maupun pada bootstrap schema baru.

ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS passage TEXT;

ALTER TABLE quiz_questions DROP CONSTRAINT IF EXISTS quiz_questions_category_check;
ALTER TABLE quiz_questions DROP CONSTRAINT IF EXISTS quiz_questions_question_category_check;

ALTER TABLE quiz_questions
  ADD CONSTRAINT quiz_questions_category_check
  CHECK (question_category IN ('vocabulary', 'grammar', 'listening', 'reading'));
