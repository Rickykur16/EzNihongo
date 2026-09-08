-- 137_practice_state_fsrs.sql
--
-- Memberi `user_practice_state` memori FSRS-5, menggantikan tangga tetap
-- `nextReviewDelayMs()` (salah→0, streak1→1 hari, 2-3→3, 4-5→7, ≥6→14 hari
-- DAN BERHENTI DI SITU SELAMANYA).
--
-- KENAPA: user — "yg sudah hafal tapi di tagih tiap 2 minggu". Memang begitu
-- perilakunya: plafon 14 hari tidak pernah naik berapa kali pun dijawab benar,
-- jadi kata yang sudah dikuasai bertahun-tahun tetap menagih ~26x setahun.
-- Dengan FSRS-5, deret intervalnya (selalu benar, tepat jadwal) menjadi
-- 3 → 11 → 35 → 101 → 269 → 669 → 1563 → 3454 hari, tanpa plafon.
--
-- Kolom `next_review_at` dan `last_reviewed_at` yang SUDAH ADA dipakai sebagai
-- `due` dan `lastReview` milik kartu, jadi hanya lima nilai di bawah yang
-- benar-benar baru. Semuanya NULLABLE supaya baris lama tetap sah — baris
-- tanpa nilai FSRS diperlakukan sebagai kartu baru saat pertama dijawab lagi.
--
-- Kolom `mastery_state` lama SENGAJA TIDAK DISENTUH: CHECK-nya cuma mengenal
-- new/learning/mastered, sedangkan FSRS punya empat keadaan sendiri
-- (new/learning/review/relearning). Keduanya hidup berdampingan; yang lama
-- tetap dipakai UI drill adaptif.

ALTER TABLE user_practice_state
  ADD COLUMN IF NOT EXISTS fsrs_stability  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS fsrs_difficulty DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS fsrs_state      TEXT,
  ADD COLUMN IF NOT EXISTS fsrs_reps       INTEGER,
  ADD COLUMN IF NOT EXISTS fsrs_lapses     INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'user_practice_state_fsrs_state_check'
  ) THEN
    ALTER TABLE user_practice_state
      ADD CONSTRAINT user_practice_state_fsrs_state_check
      CHECK (fsrs_state IN ('new', 'learning', 'review', 'relearning'));
  END IF;
END $$;

-- SEED dari data tangga lama.
--
-- Tanpa ini dua hal rusak sekaligus: (1) progres yang sudah dikumpulkan siswa
-- hangus dan semuanya mulai dari nol, dan (2) gate "arah baru menunggu sampai
-- arah yang sudah dilatih mantap" tidak punya bahan sama sekali — tidak ada
-- satu pun baris ber-`fsrs_state = 'review'`, sehingga arah yang belum dilatih
-- terkunci selamanya.
--
-- Pemetaannya:
--   streak >= 2   → 'review'    (sudah berkali-kali benar berturut-turut)
--   attempts > 0  → 'learning'  (pernah dicoba tapi belum stabil)
--   selain itu    → dibiarkan NULL (dianggap kartu baru saat dijawab nanti)
-- stability  = interval tangga lama (next_review_at - last_reviewed_at) dalam
--              hari, minimal 1 — inilah tebakan terbaik yang kita punya soal
--              seberapa kuat ingatannya sekarang.
-- difficulty = D0(Good) = w4 - e^(w5*2) + 1 dengan bobot default FSRS-5
--              (7.1949 - e^(0.5345*2) + 1 = 5.2794...), titik awal netral.
-- reps/lapses diturunkan dari attempts/correct yang sudah tercatat.
UPDATE user_practice_state
   SET fsrs_state = CASE WHEN streak >= 2 THEN 'review' ELSE 'learning' END,
       fsrs_stability = GREATEST(
         1,
         COALESCE(
           EXTRACT(EPOCH FROM (next_review_at - last_reviewed_at)) / 86400.0,
           1
         )
       ),
       fsrs_difficulty = 5.2794,
       fsrs_reps = attempts,
       fsrs_lapses = GREATEST(0, attempts - correct)
 WHERE attempts > 0
   AND fsrs_state IS NULL;

DO $$
DECLARE
  v_seeded INT;
  v_review INT;
BEGIN
  SELECT count(*) INTO v_seeded FROM user_practice_state WHERE fsrs_state IS NOT NULL;
  SELECT count(*) INTO v_review FROM user_practice_state WHERE fsrs_state = 'review';
  RAISE NOTICE '137: % baris user_practice_state punya state FSRS (% di antaranya sudah ''review'')',
    v_seeded, v_review;

  -- Pagar: setelah seed, tidak boleh ada baris yang sudah pernah dicoba tapi
  -- masih kosong state FSRS-nya — itu berarti UPDATE di atas tidak kena.
  IF EXISTS (SELECT 1 FROM user_practice_state WHERE attempts > 0 AND fsrs_state IS NULL) THEN
    RAISE EXCEPTION '137: masih ada baris attempts > 0 tanpa fsrs_state';
  END IF;
END $$;
