-- 150_bunpou_flow_dialog_checks.sql — Paket 2 (pemeriksaan mandiri &
-- Smart Review). Aditif murni: melebarkan satu CHECK dan menambah satu
-- kolom nullable. Tidak menyentuh data siswa mana pun.
--
-- KENAPA step 4 dan 5, bukan 3:
-- `grammar_task_session_items.step` (migrasi 147) dibatasi CHECK (1, 2) —
-- Step 1 pemahaman fungsi, Step 2 bentuk/susun kalimat. Angka 3 SENGAJA
-- DILEWATI dan tetap dicadangkan untuk Step 3 Tugas Bunpou yang sudah ada
-- (produksi kalimat bebas, dinilai evaluator AI lewat
-- POST /grammar-task/evaluate — tidak pernah disimpan sebagai item sesi).
-- Memakai 3 untuk pemeriksaan dialog akan membuat satu angka berarti dua
-- hal yang berbeda di dua tempat, persis kelas kebingungan yang mahal
-- diperbaiki belakangan. Jadi:
--
--   step 4 = soal pemahaman dialog  (dari NASKAH ASLI dialog pelajaran)
--   step 5 = soal pembanding        (pola SAMA, kalimat/situasi LAIN)
--
-- Index UNIQUE (session_id, grammar_id, step) yang sudah ada otomatis
-- menjamin paling banyak satu soal pemahaman + satu pembanding per pola
-- per sesi — tidak perlu pagar tambahan.
--
-- KENAPA TIDAK menambah nilai baru ke grammar_attempts.source:
-- kolom itu CHECK (production, controlled, recognition) dan sengaja
-- dibiarkan apa adanya, mengikuti konvensi yang sudah berjalan di repo ini
-- (migrasi 147 memakai kolom metadata baru `evaluation_kind` alih-alih
-- mengubah enum; grammar-mastery.js#loadMastery bahkan melipat
-- quiz_question_results ke dalam 'recognition'). Jadi bukti pemeriksaan
-- dialog ditulis sebagai source='recognition' (pemahaman) dan
-- source='controlled' (pembanding) — masuk ke model mastery yang SAMA,
-- tanpa satu pun perubahan kebijakan penilaian.
--
-- `check_family_id` mencatat "keluarga soal" yang benar-benar dijawab,
-- supaya Smart Review nanti bisa menghindari menyajikan varian yang
-- terlalu dekat dengan soal yang baru saja dikerjakan (rencana Paket 2:
-- "Gunakan item family ID internal untuk mendeteksi variasi yang terlalu
-- dekat"). Nullable: semua penulis lama tidak pernah mengisinya.
--
-- Idempotent: DROP/ADD CONSTRAINT dengan IF EXISTS, ADD COLUMN IF NOT EXISTS.

DO $$
BEGIN
  -- Nama constraint mengikuti penamaan otomatis Postgres dari migrasi 147.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'grammar_task_session_items'::regclass
       AND conname  = 'grammar_task_session_items_step_check'
  ) THEN
    ALTER TABLE grammar_task_session_items
      DROP CONSTRAINT grammar_task_session_items_step_check;
  END IF;

  ALTER TABLE grammar_task_session_items
    ADD CONSTRAINT grammar_task_session_items_step_check
    CHECK (step IN (1, 2, 4, 5));
END $$;

ALTER TABLE grammar_attempts
  ADD COLUMN IF NOT EXISTS check_family_id TEXT;

-- Dipakai Smart Review untuk melihat keluarga soal apa saja yang sudah
-- pernah dijawab siswa ini belakangan. Partial: baris lama tidak ikut.
CREATE INDEX IF NOT EXISTS idx_grammar_attempts_check_family
  ON grammar_attempts(user_id, check_family_id)
  WHERE check_family_id IS NOT NULL;

DO $$
DECLARE
  v_steps TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_steps
    FROM pg_constraint
   WHERE conrelid = 'grammar_task_session_items'::regclass
     AND conname  = 'grammar_task_session_items_step_check';
  RAISE NOTICE '150: step CHECK sekarang %', coalesce(v_steps, '(tidak ditemukan)');

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'grammar_attempts' AND column_name = 'check_family_id'
  ) THEN
    RAISE EXCEPTION '150: kolom check_family_id gagal ditambahkan.';
  END IF;
END $$;
