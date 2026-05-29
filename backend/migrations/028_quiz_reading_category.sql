-- 028_quiz_reading_category.sql — Tambah kategori soal "reading" (Dokkai 読解)
-- + dukungan passage bacaan untuk soal dokkai.
--
-- Konteks: taksonomi kategori soal sebelumnya {vocabulary, grammar, listening}.
-- Sekarang jadi 4 seksi JLPT — moji-goi (key tetap 'vocabulary', cuma label di
-- UI yang berubah), grammar, dokkai (key baru 'reading'), listening. Pendekatan
-- "relabel + tambah": TIDAK rename key lama / migrasi data — cuma additive.
--
-- Dokkai = satu teks bacaan (passage) → beberapa soal. Passage disimpan di
-- kolom `passage` per-soal (denormalized seperti section_label/section_instruction);
-- semua soal dalam satu section dokkai memuat passage yang sama, di-render sekali
-- di atas section oleh frontend. Admin set passage di form Section.
--
-- CHECK constraint: ada dua kemungkinan nama tergantung cara bootstrap —
-- 'quiz_questions_category_check' (dari migration 012) atau auto-name
-- 'quiz_questions_question_category_check' (dari inline CHECK di schema.sql).
-- Drop keduanya (IF EXISTS) lalu add ulang dengan 4 nilai. quiz_questions
-- alterable oleh runner (migration 012 sukses ALTER tabel ini).

ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS passage TEXT;

ALTER TABLE quiz_questions DROP CONSTRAINT IF EXISTS quiz_questions_category_check;
ALTER TABLE quiz_questions DROP CONSTRAINT IF EXISTS quiz_questions_question_category_check;

ALTER TABLE quiz_questions
  ADD CONSTRAINT quiz_questions_category_check
  CHECK (question_category IN ('vocabulary', 'grammar', 'listening', 'reading'));
