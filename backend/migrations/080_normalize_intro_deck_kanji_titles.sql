-- 080_normalize_intro_deck_kanji_titles.sql — Seragamkan judul tiga pelajaran
-- pertama tiap Bab (Pengantar / Kosakata / Kanji).
--
-- Lanjutan 079 (yang merapikan Assignment & Tugas Bunpou). Bab yang dibuat
-- manual lewat admin (Bab 1-11) vs yang diseed migrasi 070-078 (Bab 12-20)
-- memakai tiga gaya penamaan berbeda sekaligus:
--
--   tipe    | Bab 1-11 (manual)  | Bab 12-20 (migrasi 070-078)
--   --------|--------------------|-----------------------------
--   video   | 'Introduction'     | 'Pelajaran 1: Pengantar'
--   deck    | 'Kosakata'         | 'Pelajaran 2: Kosakata 語彙'
--   kanji   | 'Kanji'            | 'Pelajaran 3: Kanji 漢字'
--
-- Prefix "Pelajaran N:" juga bentrok dengan penomoran sidebar welcome.html
-- yang sudah merender nomor urutnya sendiri ("87. Pelajaran 1: Pengantar" —
-- dua angka yang artinya beda: posisi global vs posisi dalam modul).
--
-- Diseragamkan ke bentuk polos + kanji Jepang dipertahankan:
--   video -> 'Pengantar', deck -> 'Kosakata 語彙', kanji -> 'Kanji 漢字'
--
-- Whitelist regex per tipe, BUKAN rename semua lesson bertipe itu — supaya
-- video bertopik spesifik (mis. 'Kalimat Identitas (です・じゃありません・
-- ですか)' di Bab 3) tidak ikut ke-rename. Idempoten: guard `title <> '<kanonik>'`
-- bikin run kedua = 0 baris.
--
-- HANYA `title` yang diubah — `slug` sengaja TIDAK disentuh karena progres
-- siswa di localStorage di-key slug ("<moduleId>:<lessonId>"), rename slug =
-- progres tereset.

DO $$
DECLARE
  v_intro INT;
  v_deck  INT;
  v_kanji INT;
  r       RECORD;
BEGIN
  -- 1. Pengantar (video intro)
  UPDATE lessons l
  SET title = 'Pengantar'
  FROM modules m
  JOIN courses c ON c.id = m.course_id
  WHERE l.module_id = m.id
    AND c.slug = 'n5'
    AND l.type = 'video'
    AND l.title ~* '^\s*(pelajaran\s*\d+\s*[:\-–—]\s*)?(introduction|intro|pengantar)\s*$'
    AND l.title <> 'Pengantar';
  GET DIAGNOSTICS v_intro = ROW_COUNT;

  -- 2. Kosakata 語彙 (deck)
  UPDATE lessons l
  SET title = 'Kosakata 語彙'
  FROM modules m
  JOIN courses c ON c.id = m.course_id
  WHERE l.module_id = m.id
    AND c.slug = 'n5'
    AND l.type = 'deck'
    AND l.title ~* '^\s*(pelajaran\s*\d+\s*[:\-–—]\s*)?(kosakata|vocabulary|vocab)(\s*語彙)?\s*$'
    AND l.title <> 'Kosakata 語彙';
  GET DIAGNOSTICS v_deck = ROW_COUNT;

  -- 3. Kanji 漢字
  UPDATE lessons l
  SET title = 'Kanji 漢字'
  FROM modules m
  JOIN courses c ON c.id = m.course_id
  WHERE l.module_id = m.id
    AND c.slug = 'n5'
    AND l.type = 'kanji'
    AND l.title ~* '^\s*(pelajaran\s*\d+\s*[:\-–—]\s*)?kanji(\s*漢字)?\s*$'
    AND l.title <> 'Kanji 漢字';
  GET DIAGNOSTICS v_kanji = ROW_COUNT;

  RAISE NOTICE '080: judul dinormalkan — % intro, % kosakata, % kanji.',
    v_intro, v_deck, v_kanji;

  -- Laporan sisa: tiap modul standarnya punya TEPAT SATU deck + satu kanji,
  -- jadi apa pun yang masih non-kanonik di sini = varian judul yang belum
  -- tertangkap whitelist di atas. Muncul di deploy log (run.js men-subscribe
  -- event 'notice'), jadi bisa ditindaklanjuti dengan migrasi kecil berikutnya.
  -- Tipe 'video' sengaja tidak dilaporkan: banyak video bertopik yang memang
  -- bukan pelajaran pengantar.
  FOR r IN
    SELECT m.sort_order AS bab, l.type, l.title
    FROM lessons l
    JOIN modules m ON m.id = l.module_id
    JOIN courses c ON c.id = m.course_id
    WHERE c.slug = 'n5'
      AND l.type IN ('deck', 'kanji')
      AND l.title NOT IN ('Kosakata 語彙', 'Kanji 漢字')
    ORDER BY m.sort_order, l.sort_order
  LOOP
    RAISE NOTICE '080: judul belum kanonik — Bab % [%] "%"', r.bab, r.type, r.title;
  END LOOP;
END $$;
