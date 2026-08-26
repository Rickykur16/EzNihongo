-- 101_normalize_tugas_bunpou_title_separator.sql — Samakan pemisah judul
-- 16 lesson Tugas Bunpou Bab 13-20 (dibuat migrasi 090-097) ke titik dua.
--
-- Regresi kecil: migration 079 sudah menetapkan konvensi titik dua untuk
-- 'Assignment Bab N: Topik' / 'Tugas Bunpou Bab N: Topik' (menggantikan em
-- dash lama), tapi 090-097 (ditulis belakangan) tanpa sengaja kembali
-- memakai em dash di title lesson-nya (mis. 'Tugas Bunpou Bab 13 —
-- Progresif & Permintaan'). Migrasi ini menjalankan ULANG logika 079 —
-- regex-nya sudah generik (match APA PUN 'Assignment|Tugas Bunpou Bab N —'),
-- jadi otomatis menangkap 16 lesson baru ini tanpa perlu menyebut slug
-- satu-satu.
--
-- Idempoten: WHERE clause cuma match judul yang masih pakai em dash (sama
-- persis dengan 079), jadi aman dijalankan ulang (run kedua = 0 baris
-- ter-update, termasuk 0 baris kalau dijalankan di DB yang sudah kena 079
-- sekaligus tidak punya 090-097).

DO $$
DECLARE
  v_count INT;
BEGIN
  UPDATE lessons
  SET title = REPLACE(title, ' — ', ': ')
  WHERE title ~ '^(Assignment|Tugas Bunpou) Bab [0-9]+ — ';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '101: normalisasi pemisah judul lesson (em dash -> titik dua) pada % baris.', v_count;
END $$;
