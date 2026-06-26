-- 038_custom_quiz_category.sql — Tambah kategori soal `custom` (non-JLPT).
--
-- Kategori bebas untuk soal di luar pola JLPT (vocabulary/grammar/reading/
-- listening): label + instruksi section diisi admin sendiri, mendukung gambar
-- di soal & pilihan (kolom image_url sudah ada di quiz_questions/quiz_options).
-- Cuma melebarkan CHECK constraint; tidak ada kolom baru.
-- Idempotent: aman dijalankan ulang & pada bootstrap schema baru.

ALTER TABLE quiz_questions DROP CONSTRAINT IF EXISTS quiz_questions_category_check;
ALTER TABLE quiz_questions DROP CONSTRAINT IF EXISTS quiz_questions_question_category_check;

ALTER TABLE quiz_questions
  ADD CONSTRAINT quiz_questions_category_check
  CHECK (question_category IN ('vocabulary', 'grammar', 'listening', 'reading', 'custom'));
