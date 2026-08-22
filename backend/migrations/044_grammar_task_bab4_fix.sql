-- 044_grammar_task_bab4_fix.sql — perbaiki posisi + required_count Tugas
-- Bunpou Bab 4 yang sudah dibuat migration 043.
--
-- 043 sudah deploy ke produksi (lesson + wiring sudah ada) sebelum dua
-- revisi berikut sempat masuk, karena migrasi cuma jalan sekali per file
-- (tercatat di schema_migrations) — mengedit 043 lagi tidak akan ter-apply
-- ulang. Jadi perbaikannya lewat migrasi baru ini, bukan amend 043.
--
-- 1) POSISI: user minta urutan sama seperti Bab 3 — tugas bunpou persis
--    SETELAH lesson materi bunpou, bukan nempel di akhir modul
--    (sort_order=100 dari 043). Materi bunpou Bab 4 ditunjuk user sebagai
--    lesson urutan ke-23 di sidebar; tidak ada akses ke DB produksi untuk
--    tahu slug-nya, jadi di-resolve lewat posisi ORDINAL (OFFSET 22) di
--    antara lesson-lesson SELAIN tugas bunpou itu sendiri (harus dikecualikan
--    dari hitungan ordinal, karena sudah ada di modul sejak 043 berjalan).
--    Lesson lain yang sort_order-nya lebih besar dari materi bunpou digeser
--    +1 supaya slotnya kosong.
-- 2) REQUIRED_COUNT: disamakan dengan Bab 3 (dikonfirmasi user: 1 kalimat
--    wajib per pola), dari 2/2/2/2/1 (043) menjadi 1/1/1/1/1.
--
-- Idempotent: geser HANYA terjadi kalau lesson belum di posisi yang benar
-- (guard sama seperti pola 041-043); UPDATE required_count tanpa syarat
-- aman untuk di-re-run (nilai akhirnya selalu 1, bukan increment).
-- No-op aman kalau modul atau lesson target belum ada (043 belum jalan).

DO $$
DECLARE
  v_course_slug  TEXT := 'n5';
  v_lesson_slug  TEXT := 'tugas-bunpou-bab-4-benda-sekitar';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson_id    UUID;
  v_bunpou_lesson_id UUID;
  v_bunpou_sort      INT;
  v_current_sort     INT;
  v_target_sort      INT;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 3 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '044: modul Bab 4 di kursus % tidak ditemukan — skip.', v_course_slug;
    RETURN;
  END IF;

  SELECT id, sort_order INTO v_lesson_id, v_current_sort
    FROM lessons WHERE module_id = v_module_id AND slug = v_lesson_slug;

  IF v_lesson_id IS NULL THEN
    RAISE NOTICE '044: lesson % belum ada di modul "%" (migration 043 mungkin belum jalan) — skip.',
      v_lesson_slug, v_module_title;
    RETURN;
  END IF;

  RAISE NOTICE '044: perbaiki posisi + required_count Tugas Bunpou Bab 4 di modul "%".', v_module_title;

  -- ===== Posisi: cari lesson materi bunpou (ordinal ke-23 DI LUAR tugas bunpou) =====

  SELECT id, sort_order INTO v_bunpou_lesson_id, v_bunpou_sort
    FROM lessons
   WHERE module_id = v_module_id AND id <> v_lesson_id
   ORDER BY sort_order ASC, created_at ASC
   OFFSET 22 LIMIT 1;

  IF v_bunpou_lesson_id IS NULL THEN
    RAISE NOTICE '044: lesson materi bunpou (urutan ke-23) tidak ditemukan di modul "%" — posisi tugas bunpou tidak diubah (tetap %).', v_module_title, v_current_sort;
    v_target_sort := v_current_sort;
  ELSE
    v_target_sort := v_bunpou_sort + 1;

    IF v_current_sort IS DISTINCT FROM v_target_sort THEN
      UPDATE lessons SET sort_order = sort_order + 1
       WHERE module_id = v_module_id
         AND sort_order > v_bunpou_sort
         AND id <> v_lesson_id;

      UPDATE lessons SET sort_order = v_target_sort, updated_at = NOW()
       WHERE id = v_lesson_id;
    END IF;
  END IF;

  -- ===== required_count: turunkan ke 1 per pola (samakan dengan Bab 3) =====

  UPDATE lesson_grammar_task_items
     SET required_count = 1
   WHERE lesson_id = v_lesson_id AND required_count <> 1;

  IF (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson_id) <> 5 THEN
    RAISE EXCEPTION '044: jumlah pola ter-wire bukan 5 (dapat %) — cek apakah 043 sukses jalan',
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson_id);
  END IF;

  IF (SELECT SUM(required_count) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson_id) <> 5 THEN
    RAISE EXCEPTION '044: total required_count bukan 5 setelah perbaikan (dapat %)',
      (SELECT SUM(required_count) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM lessons WHERE module_id = v_module_id AND sort_order = v_target_sort AND id <> v_lesson_id
  ) THEN
    RAISE EXCEPTION '044: sort_order % masih bentrok dengan lesson lain setelah geser', v_target_sort;
  END IF;

  RAISE NOTICE '044: selesai — lesson di sort_order % (materi bunpou %), total required_count=5.',
    v_target_sort, COALESCE(v_bunpou_sort::TEXT, 'n/a');
END $$;
