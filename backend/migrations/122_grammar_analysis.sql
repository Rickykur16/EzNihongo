-- Grammar Learning Analysis — spine per konsep grammar.
--
-- MASALAH YANG DITUTUP: sampai sekarang hasil penilaian AI di Tugas Bunpou
-- (POST /api/grammar-task/evaluate) DIBUANG setelah dirender. Satu-satunya
-- yang tersimpan adalah `grammar_eval_cache`, dan itu global + anonim (tidak
-- ada user_id / lesson_id / waktu percobaan) — gunanya cuma menghemat panggilan
-- AI, bukan sinyal belajar. Akibatnya:
--   - server tidak pernah tahu tugas grammar sudah dikerjakan (klaim "selesai"
--     hanya ada di localStorage siswa, lihat gtUpdateComplete di welcome.html);
--   - deteksi kelemahan (routes/recommendations.js) cuma bisa bilang kategori
--     "Tata Bahasa" lemah, tidak pernah pola grammar YANG MANA;
--   - tidak ada retensi: pola yang dikuasai 2 bulan lalu tidak bisa dibedakan
--     dari yang dikuasai kemarin.
--
-- Identitas konsep grammar TIDAK dibuat baru: `module_grammar.id` sudah stabil
-- dan sudah dipakai bersama oleh pelajaran Tata Bahasa (lewat lesson_id) DAN
-- Tugas Bunpou (lewat lesson_grammar_task_items). Migrasi ini hanya menambah
-- tempat menyimpan HASILNYA + atribusi konsep pada soal kuis.
--
-- Aditif penuh: tidak ada tabel/kolom lama yang diubah bentuknya, tidak ada
-- backfill (memang belum ada data historis yang bisa di-backfill), dan
-- Tugas Bunpou Bab 3-20 yang sudah live tetap jalan tanpa perubahan.

-- ===== 1. Satu baris per kalimat yang dinilai =====
-- Sengaja SATU tabel, bukan pasangan attempts + results: di tugas produksi
-- satu submit = satu kalimat = satu verdict, jadi tabel kedua hanya akan
-- jadi relasi 1:1 yang redundan.
--
-- grammar_id CASCADE (bukan SET NULL): riwayat percobaan tanpa polanya tidak
-- bisa diagregasi jadi apa-apa. Konsisten dengan grammar_examples /
-- lesson_grammar_task_items yang juga CASCADE dari module_grammar.
-- lesson_id SET NULL + nullable: tugas bisa dikerjakan lewat popup, dan
-- pelajaran bisa dihapus admin tanpa membuang riwayat belajar siswa.
CREATE TABLE IF NOT EXISTS grammar_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grammar_id UUID NOT NULL REFERENCES module_grammar(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,

  -- Level belajar yang menghasilkan baris ini. 'production' = kalimat bebas
  -- buatan siswa (Tugas Bunpou, satu-satunya sumber saat ini). Dua nilai lain
  -- disiapkan untuk latihan terkontrol/pengenalan yang dinilai deterministik
  -- (tanpa AI) — lihat kolom quiz_questions.grammar_id di bawah.
  source TEXT NOT NULL DEFAULT 'production'
    CHECK (source IN ('production', 'controlled', 'recognition')),
  input_mode TEXT NOT NULL DEFAULT 'text'
    CHECK (input_mode IN ('speech', 'text')),

  sentence TEXT NOT NULL,

  -- Tiga kolom pertama = kontrak lama endpoint evaluate (dipakai frontend
  -- yang sudah live). passed = correct AND uses_pattern, disimpan eksplisit
  -- supaya agregasi mastery tidak perlu mengulang ekspresi itu di tiap query.
  correct BOOLEAN NOT NULL,
  uses_pattern BOOLEAN NOT NULL,
  passed BOOLEAN NOT NULL,

  -- Output terstruktur baru. Semua NULLABLE: prompt evaluasi bisa di-edit
  -- admin (app_settings.grammar_eval_prompt) dan model bisa gagal mengisi
  -- klasifikasi — itu tidak boleh menggagalkan pencatatan percobaannya.
  -- PENTING: klasifikasi ini SIFATNYA PENJELAS, bukan penentu. Model mastery
  -- digerakkan oleh `passed`, tidak pernah oleh error_types — kalau taksonomi
  -- ternyata berisik, analisisnya tetap benar.
  grammar_score SMALLINT CHECK (grammar_score IS NULL OR (grammar_score BETWEEN 0 AND 100)),
  primary_error TEXT,
  error_types TEXT[] NOT NULL DEFAULT '{}',
  severity TEXT,
  concept_signal TEXT,

  feedback TEXT,
  correction TEXT,

  -- 'cache' = verdict identik disajikan dari grammar_eval_cache tanpa panggil
  -- AI. Percobaannya tetap dicatat (kalau tidak, kalimat yang sama dari siswa
  -- kedua akan hilang dari analisis sepenuhnya).
  eval_source TEXT NOT NULL DEFAULT 'ai' CHECK (eval_source IN ('ai', 'cache')),
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hot path agregasi mastery: seluruh percobaan satu siswa untuk satu pola,
-- terbaru dulu (window recency 180 hari, LIMIT 12 per pola).
CREATE INDEX IF NOT EXISTS idx_grammar_attempts_user_grammar
  ON grammar_attempts (user_id, grammar_id, created_at DESC);
-- Dashboard "pola terlemah" lintas pola untuk satu siswa.
CREATE INDEX IF NOT EXISTS idx_grammar_attempts_user_created
  ON grammar_attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_grammar_attempts_lesson
  ON grammar_attempts (lesson_id);

-- ===== 2. Atribusi konsep pada soal kuis =====
-- quiz_questions.question_category = 'grammar' terlalu kasar: bisa bilang
-- "Tata Bahasa lemah", tidak pernah "〜じゃありません lemah". Kolom ini
-- menautkan satu soal ke satu pola di bank modul, sehingga soal pengenalan /
-- latihan terkontrol ikut mengisi mastery per-konsep TANPA biaya AI sama
-- sekali — penilaian opsi pilihan ganda sudah deterministik di progress.js.
--
-- Nullable + tanpa backfill: ribuan soal Assignment Bab 1-20 yang sudah ada
-- tetap valid dengan grammar_id NULL dan tetap dihitung di kategori 'grammar'
-- seperti sebelumnya. Hanya soal yang admin tautkan yang masuk analisis
-- per-konsep. SET NULL supaya menghapus satu pola tidak ikut menghapus soal.
ALTER TABLE quiz_questions
  ADD COLUMN IF NOT EXISTS grammar_id UUID REFERENCES module_grammar(id) ON DELETE SET NULL;

-- Snapshot pada hasil per-soal, pola sama persis dengan question_category yang
-- juga di-snapshot di migration 027: analisis historis tidak boleh berubah
-- retroaktif kalau admin menautkan ulang soal ke pola lain. Sengaja TANPA FK —
-- ini catatan sejarah, bukan relasi hidup (sama seperti question_id di sana).
ALTER TABLE quiz_question_results
  ADD COLUMN IF NOT EXISTS grammar_id UUID;

-- Gating pg_indexes per konvensi repo (lihat 008): tabel kuis dimiliki role
-- lain dari eznihongo_app di production, jadi CREATE INDEX yang tidak digerbangi
-- bisa kena "must be owner of table" saat deploy.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE tablename = 'quiz_questions' AND indexname = 'idx_quiz_questions_grammar'
  ) THEN
    CREATE INDEX idx_quiz_questions_grammar ON quiz_questions (grammar_id)
      WHERE grammar_id IS NOT NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE tablename = 'quiz_question_results' AND indexname = 'idx_qqr_user_grammar'
  ) THEN
    CREATE INDEX idx_qqr_user_grammar ON quiz_question_results (user_id, grammar_id, created_at DESC)
      WHERE grammar_id IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE 'grammar_attempts siap; quiz_questions/quiz_question_results dapat kolom grammar_id (nullable, tanpa backfill).';
END $$;
