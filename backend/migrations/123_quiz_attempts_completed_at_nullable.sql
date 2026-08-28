-- Perbaikan cacat LAMA (bukan bagian fitur analisis Bunpou) — ditemukan saat
-- menguji migration 122 di database yang dibangun dari `schema.sql` bersih.
--
-- `quiz_attempts.completed_at` dideklarasikan `NOT NULL DEFAULT NOW()`, padahal
-- seluruh kode attempt memperlakukannya sebagai penanda "sudah disubmit":
--   - /quiz/start meng-INSERT baris TANPA completed_at (attempt baru dimulai,
--     belum selesai) → default NOW() langsung mengisinya;
--   - /quiz-attempt menutup attempt dengan
--       UPDATE ... SET completed_at = NOW() WHERE id = $1 AND completed_at IS NULL
--     (pengaman anti double-submit) → rowCount 0 → 409 'already_submitted';
--   - lessonAttemptStatus() sudah meng-ORDER BY completed_at DESC NULLS LAST,
--     yang hanya masuk akal kalau kolomnya memang boleh NULL.
--
-- Akibatnya di database hasil bootstrap schema.sql, SETIAP submit kuis ditolak
-- 409 — Assignment Bab 1-20 mustahil diselesaikan. Produksi tidak terpengaruh
-- (skema di sana sudah nullable, submit kuis jalan normal), jadi migrasi ini
-- no-op di sana dan hanya menyamakan environment baru — termasuk uji restore
-- ke staging yang masih jadi pekerjaan terbuka di CLAUDE.md.
--
-- Idempoten: DROP NOT NULL / DROP DEFAULT aman dijalankan pada kolom yang
-- memang sudah nullable / tanpa default.
ALTER TABLE quiz_attempts
  ALTER COLUMN completed_at DROP NOT NULL,
  ALTER COLUMN completed_at DROP DEFAULT;

DO $$
BEGIN
  RAISE NOTICE 'quiz_attempts.completed_at kini nullable — penanda "sudah disubmit" berfungsi.';
END $$;
