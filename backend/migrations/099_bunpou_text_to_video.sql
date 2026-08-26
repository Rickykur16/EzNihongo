-- 099_bunpou_text_to_video.sql — Ubah type 18 lesson Tata Bahasa (bunpou)
-- Bab 12-20 (dibuat migrasi 081-089) dari 'text' ke 'video', atas
-- permintaan user.
--
-- CATATAN PENTING (biar tidak salah ekspektasi): ini MURNI ubah kolom
-- `type`, tidak ada perubahan kode frontend/admin. Konsekuensinya:
--   - `welcome.html` render lesson type 'video' biasa (bukan deck/kana)
--     masih placeholder statis "Video akan segera tersedia" — TIDAK
--     membaca `video_url` sama sekali.
--   - Form admin (`admin.html`) belum menampilkan field "Video URL" untuk
--     hasil ubahan ini kecuali tipe-nya memang 'video' (sudah otomatis
--     muncul karena `wireLessonTypeVisibility` mengecek `type === 'video'`).
--   - Kartu pola grammar (pattern/meaning/contoh dari module_grammar +
--     grammar_examples) TIDAK terpengaruh — render-nya independen dari
--     `lessons.type` (lihat renderLessonExtras/renderLessonGrammar di
--     welcome.html), jadi konten tetap tampil seperti biasa.
--   - `video_url` sengaja TIDAK diisi di migrasi ini (belum ada link video
--     saat migrasi ini ditulis) — bisa diisi belakangan lewat admin kalau
--     videonya sudah siap, sekaligus baru itu wiring render benar-benar
--     perlu dikerjakan.
--
-- Match by slug prefix 'tata-bahasa-bab-%' — pola penamaan yang konsisten
-- dipakai 081-089 dan tidak dipakai lesson tipe lain, jadi aman dan presisi
-- tanpa perlu resolve modul satu-satu.
--
-- Idempotent: UPDATE ... WHERE type = 'text' — no-op aman kalau dijalankan
-- ulang (baris yang sudah 'video' tidak match lagi).

DO $$
DECLARE
  v_count INT;
BEGIN
  UPDATE lessons
     SET type = 'video', updated_at = NOW()
   WHERE type = 'text'
     AND slug LIKE 'tata-bahasa-bab-%';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 0 THEN
    RAISE NOTICE '099: tidak ada lesson Tata Bahasa (slug tata-bahasa-bab-%%) bertipe text yang diubah — sudah video semua, atau modulnya belum ada.';
  ELSE
    RAISE NOTICE '099: % lesson Tata Bahasa diubah dari type text ke video.', v_count;
  END IF;
END $$;
