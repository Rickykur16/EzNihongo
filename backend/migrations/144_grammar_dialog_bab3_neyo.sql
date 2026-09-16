-- 144_grammar_dialog_bab3_neyo.sql — lengkapi dialog contoh Bab 3 untuk pola
-- partikel akhir kalimat ね／よ, satu-satunya dari enam konsep Bab 3 yang
-- belum dapat dialog dari migrasi 143.
--
-- KENAPA TERPISAH: 143 mengisi lima pola lewat pencocokan teks persis, lalu
-- mencari pola keenam lewat eliminasi. Di production eliminasi menolak
-- menulis — dan itu memang benar: log deploy run #410 menunjukkan Bab 3
-- punya SEBELAS baris untuk enam konsep, bukan enam:
--
--   〜は〜です / 〜は〜です (dobel, teks identik) / 〜の〜 /
--   〜は〜じゃありません / 〜は〜じゃ／ではありません / 〜も〜です /
--   〜は〜ですか / 〜ですか / 〜文 + ね／よ / 〜も / 〜の
--
-- Jadi ada enam baris di luar lima pola yang dikenal, bukan satu, dan
-- memaksakan penulisan bisa mendaratkan dialog di baris yang salah.
-- Konvensi 135→136 (pasang NOTICE dulu, baca log deploy) yang akhirnya
-- memberi nama asli baris keenam: "〜文 + ね／よ".
--
-- KENAPA TIDAK DICOCOKKAN TEKS PERSIS: baris itu dibuat lewat admin, dan
-- log deploy tidak bisa membedakan 〜 (U+301C) dari ～ (U+FF5E), atau ／
-- (U+FF0F) dari /. Mencocokkan literal berisiko skip diam-diam lagi —
-- persis kegagalan yang bikin pola ini terlewat sejak 126. Baris dicari
-- lewat tanda yang tidak ambigu: pattern yang memuat ね DAN よ. Di antara
-- kesebelas pattern Bab 3 hanya satu yang memenuhi, dan kalau ternyata
-- cocok lebih dari satu (atau nol), migrasi tidak menebak — hanya melapor.
--
-- Isi dialognya sama persis dengan yang sudah disiapkan 143 untuk konsep
-- ini: ね untuk memastikan hal yang sama-sama diketahui, よ untuk memberi
-- tahu hal yang lawan bicara belum tahu. Semua kana, tanpa kanji, satu
-- giliran per baris, terjemahan sejajar — aturan format sama dengan 143.
--
-- Idempotent: UPDATE tanpa syarat, re-run menulis nilai yang sama.

DO $$
DECLARE
  v_course_slug  TEXT := 'n5';
  v_module_id    UUID;
  v_module_title TEXT;
  v_grammar_id   UUID;
  v_pattern      TEXT;
  v_count        INT;
  v_bad          INT;
  v_jp           TEXT;
  v_id           TEXT;
  r              RECORD;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 2 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '144: modul Bab 3 tidak ditemukan — skip.';
    RETURN;
  END IF;

  SELECT count(*) INTO v_count FROM module_grammar
   WHERE module_id = v_module_id AND pattern LIKE '%ね%' AND pattern LIKE '%よ%';

  IF v_count <> 1 THEN
    RAISE NOTICE '144: % baris Bab 3 memuat ね dan よ — dialog TIDAK ditulis (butuh tepat 1).', v_count;
    FOR r IN SELECT pattern FROM module_grammar
              WHERE module_id = v_module_id AND pattern LIKE '%ね%' AND pattern LIKE '%よ%'
              ORDER BY sort_order ASC, created_at ASC LOOP
      RAISE NOTICE '144: kandidat: "%"', r.pattern;
    END LOOP;
    RETURN;
  END IF;

  SELECT id, pattern INTO v_grammar_id, v_pattern FROM module_grammar
   WHERE module_id = v_module_id AND pattern LIKE '%ね%' AND pattern LIKE '%よ%';

  v_jp := 'N: ハディさんとユウトさんがはなしています。' || E'\n' ||
          'A: ユウトさんはにほんじんですね。'           || E'\n' ||
          'B: はい、そうです。ハディさんもがくせいですね。' || E'\n' ||
          'A: いいえ、わたしはエンジニアですよ。'        || E'\n' ||
          'B: そうですか。';
  v_id := 'N: Hadi dan Yuto sedang berbicara.' || E'\n' ||
          'A: Yuto orang Jepang, ya kan?'      || E'\n' ||
          'B: Ya, benar. Hadi juga pelajar, kan?' || E'\n' ||
          'A: Bukan, saya ini insinyur, lho.'  || E'\n' ||
          'B: Oh, begitu.';

  UPDATE module_grammar
     SET example_dialog    = v_jp,
         example_dialog_id = v_id,
         updated_at        = NOW()
   WHERE id = v_grammar_id;

  -- Pagar sama dengan 143, hanya atas baris yang ditulis migrasi ini.
  -- Terjemahan yang tidak sejajar dibuang SELURUHNYA oleh legacyDraft(),
  -- dan kanji memaksa admin mengisi bacaan sebelum audio bisa digenerate.
  SELECT count(*) INTO v_bad FROM module_grammar
   WHERE id = v_grammar_id
     AND (array_length(string_to_array(example_dialog, E'\n'), 1)
          IS DISTINCT FROM array_length(string_to_array(example_dialog_id, E'\n'), 1)
          OR example_dialog ~ '[一-龥]');
  IF v_bad > 0 THEN
    RAISE EXCEPTION '144: dialog gagal pagar baris-sejajar/tanpa-kanji.';
  END IF;

  RAISE NOTICE '144: Bab 3 "%" — dialog ね／よ diisi ke pola "%".', v_module_title, v_pattern;
END $$;
