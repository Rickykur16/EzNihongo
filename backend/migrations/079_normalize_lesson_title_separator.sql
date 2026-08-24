-- 079_normalize_lesson_title_separator.sql — Samakan pemisah judul lesson.
--
-- Dua konvensi judul lesson yang tumbuh terpisah selama seeding per-Bab
-- (039-065 vs 070-078) berakhir dengan pemisah yang beda untuk hal yang
-- sama (angka Bab + topik):
--   - Assignment & Tugas Bunpou (Bab 1-12): em dash — 'Assignment Bab 6 —
--     Kata Sifat (い)', 'Tugas Bunpou Bab 5 — Waktu'.
--   - Pelajaran intro/deck/kanji (Bab 12-20): titik dua — 'Pelajaran 1:
--     Pengantar'.
--
-- Diseragamkan ke titik dua (dipilih karena sudah dipakai pola "Pelajaran
-- N:" dan konvensi umum "Chapter N: Judul"), nomor Bab yang sudah ada di
-- judul dipertahankan — cuma pemisahnya yang diganti:
--   'Assignment Bab N — Topik'    -> 'Assignment Bab N: Topik'
--   'Tugas Bunpou Bab N — Topik'  -> 'Tugas Bunpou Bab N: Topik'
-- Judul "Pelajaran N: Topik" tidak disentuh (sudah sesuai target).
--
-- Idempoten: WHERE clause cuma match judul yang masih pakai em dash, jadi
-- aman dijalankan ulang (run kedua = 0 baris ter-update).

DO $$
DECLARE
  v_count INT;
BEGIN
  UPDATE lessons
  SET title = REPLACE(title, ' — ', ': ')
  WHERE title ~ '^(Assignment|Tugas Bunpou) Bab [0-9]+ — ';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '079: normalisasi pemisah judul lesson (em dash -> titik dua) pada % baris.', v_count;
END $$;
