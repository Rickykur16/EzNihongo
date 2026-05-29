-- 027_adaptive_learning.sql — Belajar adaptif: deteksi kelemahan + rekomendasi.
--
-- Dua tabel baru:
--   quiz_question_results — hasil per-soal tiap submit kuis (benar/salah +
--     kategori), supaya bisa di-agregasi per kategori (vocabulary/grammar/
--     listening) untuk deteksi area lemah. Sebelumnya handler quiz-attempt
--     menghitung correctByQuestion tapi membuangnya — hanya skor total yang
--     disimpan di quiz_attempts. Tanpa per-soal, tidak ada granularitas kategori.
--     question_category di-SNAPSHOT saat submit (tanpa FK ke quiz_questions)
--     supaya admin boleh edit/hapus soal tanpa kehilangan histori.
--   coaching_note_cache — cache catatan coaching AI (Maneko-chan) per "weakness
--     signature", pola sama seperti grammar_eval_cache: kalau kondisi kelemahan
--     siswa tidak berubah, tidak panggil Claude lagi tiap buka dashboard.
--
-- Tidak ada backfill: histori per-soal baru terkumpul untuk attempt SETELAH
-- migrasi ini. Endpoint rekomendasi menangani "data belum cukup" dengan anggun.
--
-- Idempotency / ownership note: tabel net-new (dimiliki migration runner), tapi
-- index tetap di-gate via pg_indexes — kalau production sudah punya tabel ini
-- dari `psql -f schema.sql` bootstrap, Postgres cek ownership SEBELUM IF NOT
-- EXISTS short-circuit di CREATE INDEX. Lihat 008 sebagai contoh pola.

CREATE TABLE IF NOT EXISTS quiz_question_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  question_id UUID NOT NULL,
  question_category TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coaching_note_cache (
  note_hash TEXT PRIMARY KEY,
  note TEXT NOT NULL,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_qqr_user_cat_created') THEN
    EXECUTE 'CREATE INDEX idx_qqr_user_cat_created
               ON quiz_question_results (user_id, question_category, created_at DESC)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_qqr_attempt') THEN
    EXECUTE 'CREATE INDEX idx_qqr_attempt ON quiz_question_results (attempt_id)';
  END IF;
END $$;
