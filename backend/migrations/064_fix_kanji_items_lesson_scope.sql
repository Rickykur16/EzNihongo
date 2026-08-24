-- 064_fix_kanji_items_lesson_scope.sql — Perbaiki root cause deck kanji
-- "hilang" berulang kali: kanji yang dipakai ulang di Bab lain "dicuri"
-- (lesson_id di-timpa) alih-alih dibuatkan baris sendiri per Bab.
--
-- ROOT CAUSE (didiagnosis di migration 049/050, belum pernah diperbaiki):
--   - UNIQUE INDEX kanji_items_character_level_uniq ON kanji_items
--     (character, jlpt_level) — TANPA lesson_id di scope-nya, artinya
--     satu karakter kanji cuma boleh punya SATU baris di seluruh course,
--     regardless Bab mana pun.
--   - Endpoint import (backend/src/routes/admin.js,
--     POST /lessons/:lessonId/import-notion-kanji-bab) mencari existing
--     row via `WHERE character = $1 AND jlpt_level = $2` (global, BUKAN
--     per lesson), lalu `UPDATE ... SET lesson_id = $2` tanpa syarat.
--   - Akibatnya: import kanji untuk Bab MANA PUN yang kebetulan memuat
--     karakter yang SUDAH ada di Bab lain (sangat umum — 人/年/生/一/二/三
--     dst muncul di banyak Bab) akan DIAM-DIAM memindahkan kepemilikan
--     baris itu ke Bab yang baru di-import, membuat deck kanji Bab asalnya
--     kehilangan karakter tersebut tanpa error apa pun.
--
-- FIX (2 bagian, harus jalan bareng):
--   1. Migrasi ini: ganti UNIQUE INDEX dari (character, jlpt_level) jadi
--      (character, jlpt_level, lesson_id) — satu karakter sekarang BOLEH
--      punya baris terpisah per Bab (setiap Bab urus salinannya sendiri).
--   2. backend/src/routes/admin.js (commit yang sama): existing-row lookup
--      di endpoint import di-scope tambah lesson_id — re-import kanji yang
--      SUDAH ada di Bab yang SAMA tetap update in-place (idempotent),
--      tapi kanji yang sudah ada di Bab LAIN sekarang di-INSERT sebagai
--      baris baru (bukan di-UPDATE/dicuri).
--
-- TIDAK ADA DATA REPAIR di migrasi ini — tidak ada cara mengetahui secara
-- pasti kanji mana yang sudah "tercuri" dari Bab mana sebelumnya (UPDATE
-- lama tidak menyisakan jejak state sebelumnya). Bab yang deck kanji-nya
-- sekarang kosong/salah HARUS di-re-import manual lewat admin ("Kelola
-- Kanji" -> Import dari Notion) setelah fix ini deploy — import berikutnya
-- sudah aman (tidak akan mencuri dari Bab lain lagi).
--
-- schema.sql juga sudah diupdate (index sama, database baru langsung dapat
-- versi yang benar) — migrasi ini HANYA untuk DB yang sudah ter-bootstrap
-- dengan index lama (termasuk production).
--
-- Aman untuk kanji_items yang punya lesson_id NULL (orphan, lihat 049/050)
-- — index baru tetap berlaku, NULL diperlakukan postgres sebagai "tidak
-- sama dengan NULL lain" jadi tidak memblokir apa pun untuk baris orphan.
--
-- Idempotent: DROP INDEX IF EXISTS + CREATE UNIQUE INDEX IF NOT EXISTS,
-- aman di-re-run. Existence-gated (pola sama seperti 008) untuk berjaga-
-- jaga soal ownership index kalau ownership kanji_items ternyata beda dari
-- eznihongo_app (belum ada laporan begitu, beda dengan kanji_users/
-- kanji_sessions/subscriptions/kanji_progress yang sudah diketahui
-- bermasalah — lihat CLAUDE.md).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE indexname = 'kanji_items_character_level_uniq'
  ) THEN
    DROP INDEX kanji_items_character_level_uniq;
    RAISE NOTICE '064: index lama kanji_items_character_level_uniq (character, jlpt_level) dihapus.';
  ELSE
    RAISE NOTICE '064: index lama kanji_items_character_level_uniq tidak ada — skip drop.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE indexname = 'kanji_items_character_level_lesson_uniq'
  ) THEN
    CREATE UNIQUE INDEX kanji_items_character_level_lesson_uniq
      ON kanji_items (character, jlpt_level, lesson_id);
    RAISE NOTICE '064: index baru kanji_items_character_level_lesson_uniq (character, jlpt_level, lesson_id) dibuat.';
  ELSE
    RAISE NOTICE '064: index baru kanji_items_character_level_lesson_uniq sudah ada — skip create.';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'kanji_items_character_level_uniq') THEN
    RAISE EXCEPTION '064: index lama masih ada setelah drop — periksa manual';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'kanji_items_character_level_lesson_uniq') THEN
    RAISE EXCEPTION '064: index baru gagal dibuat — periksa manual';
  END IF;

  RAISE NOTICE '064: selesai — kanji sekarang boleh punya baris terpisah per Bab, endpoint import (admin.js) sudah di-scope lesson_id di commit yang sama. Bab yang deck-nya sudah kosong/salah perlu di-re-import manual lewat admin.';
END $$;
