-- 029_revert_reading_category.sql — Batalkan kategori Dokkai (reading) + passage.
-- Kembali ke 3 kategori soal: vocabulary, grammar, listening.
--
-- Aman: fitur reading/dokkai praktis tidak pernah dipakai — tidak ada baris
-- berkategori 'reading' dan kolom `passage` kosong. UPDATE di bawah cuma jaring
-- pengaman supaya CHECK 3-nilai tidak gagal kalau ada baris reading nyasar.
-- Drop kedua kemungkinan nama constraint (lihat 028) lalu add ulang 3 nilai.

UPDATE quiz_questions SET question_category = 'vocabulary' WHERE question_category = 'reading';

ALTER TABLE quiz_questions DROP CONSTRAINT IF EXISTS quiz_questions_category_check;
ALTER TABLE quiz_questions DROP CONSTRAINT IF EXISTS quiz_questions_question_category_check;

ALTER TABLE quiz_questions
  ADD CONSTRAINT quiz_questions_category_check
  CHECK (question_category IN ('vocabulary', 'grammar', 'listening'));

ALTER TABLE quiz_questions DROP COLUMN IF EXISTS passage;
