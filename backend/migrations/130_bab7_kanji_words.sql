-- 130_bab7_kanji_words.sql — Lengkapi Kanji Bab 7 dan kata pemakaiannya.
--
-- Bab 7 (Kata Sifat な) hanya memperkenalkan tiga Kanji baru: 男・女・気.
-- Daftar kata sengaja ringkas dan mengikuti materi yang benar-benar dipakai
-- pada assignment Bab 7 (migration 053), bukan dipenuhi sampai jumlah tertentu:
--   男: 男／男の人／男女
--   女: 女／女の人／男女
--   気: 人気／気分
--
-- 元気 tetap diajarkan sebagai げんき pada kosakata Bab 7. Bentuk Kanji-nya
-- tidak dimasukkan di sini karena 元 belum menjadi Kanji yang diperkenalkan
-- untuk siswa pada titik ini. Semua kata manual di bawah juga akan melewati
-- filter level karakter di kanji-compounds.js sebelum dikirim ke dashboard.
--
-- Idempotent: memakai lesson Kanji yang sudah ada; bila belum ada, membuat
-- satu lesson Kanji. Baris Kanji lain yang mungkin dikurasi admin tidak dihapus.

DO $$
DECLARE
  v_course_id    UUID;
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson_id    UUID;
  v_bab_no       INT  := 7;
  v_kode         TEXT := 'N5-B7';
  v_n_target     INT;
BEGIN
  SELECT id INTO v_course_id
    FROM courses
   WHERE slug = 'n5'
   LIMIT 1;

  IF v_course_id IS NULL THEN
    RAISE NOTICE '130: kursus n5 tidak ditemukan — skip Kanji Bab 7.';
    RETURN;
  END IF;

  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
   WHERE m.course_id = v_course_id
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET (v_bab_no - 1) LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '130: modul Bab 7 tidak ditemukan — skip.';
    RETURN;
  END IF;

  IF v_module_title !~* '(sifat|adjective|adjektiva|deskripsi)' THEN
    RAISE NOTICE '130: modul ordinal Bab 7 terbaca "%" — ordinal tetap dipakai, mohon cek manual bila struktur berubah.',
      v_module_title;
  END IF;

  SELECT l.id INTO v_lesson_id
    FROM lessons l
   WHERE l.module_id = v_module_id
     AND l.type = 'kanji'
   ORDER BY l.sort_order ASC, l.created_at ASC
   LIMIT 1;

  IF v_lesson_id IS NULL THEN
    INSERT INTO lessons (
      module_id, slug, title, type, content, sort_order, duration_minutes
    ) VALUES (
      v_module_id,
      'pelajaran-3-kanji',
      'Pelajaran 3: Kanji 漢字',
      'kanji',
      'Pelajari 男・女・気 melalui bentuk dasar dan kata nyata yang dipakai dalam materi Bab 7.',
      3,
      15
    )
    ON CONFLICT (module_id, slug) DO UPDATE SET
      title = EXCLUDED.title,
      type = EXCLUDED.type,
      content = COALESCE(NULLIF(lessons.content, ''), EXCLUDED.content),
      duration_minutes = COALESCE(lessons.duration_minutes, EXCLUDED.duration_minutes),
      updated_at = NOW()
    RETURNING id INTO v_lesson_id;
  END IF;

  CREATE TEMP TABLE _b7_kanji (
    character TEXT,
    on_reading TEXT,
    kun_reading TEXT,
    meaning_id TEXT,
    stroke_count INT,
    mnemonic TEXT,
    compounds JSONB,
    ord INT
  ) ON COMMIT DROP;

  INSERT INTO _b7_kanji VALUES
    (
      '男', 'ダン、ナン', 'おとこ', 'laki-laki, pria', 7,
      '田 (sawah) di atas 力 (tenaga): orang yang memakai tenaga di sawah. Ingat bentuknya sebagai LAKI-LAKI yang bekerja kuat.',
      '[
        {"japanese":"男", "reading":"おとこ", "indonesian":"laki-laki / pria"},
        {"japanese":"男の人", "reading":"おとこのひと", "indonesian":"orang laki-laki / pria"},
        {"japanese":"男女", "reading":"だんじょ", "indonesian":"laki-laki dan perempuan"}
      ]'::jsonb,
      1
    ),
    (
      '女', 'ジョ、ニョ', 'おんな', 'perempuan, wanita', 3,
      'Bentuk asalnya menggambarkan seseorang yang duduk dengan tangan terlipat. Siluet sederhana itu menjadi Kanji untuk PEREMPUAN.',
      '[
        {"japanese":"女", "reading":"おんな", "indonesian":"perempuan / wanita"},
        {"japanese":"女の人", "reading":"おんなのひと", "indonesian":"orang perempuan / wanita"},
        {"japanese":"男女", "reading":"だんじょ", "indonesian":"laki-laki dan perempuan"}
      ]'::jsonb,
      2
    ),
    (
      '気', 'キ、ケ', NULL, 'perasaan, semangat, suasana', 6,
      'Bayangkan aliran udara atau energi yang bergerak di dalam diri. Energi tak terlihat itu adalah PERASAAN, SEMANGAT, atau SUASANA.',
      '[
        {"japanese":"人気", "reading":"にんき", "indonesian":"populer / terkenal"},
        {"japanese":"気分", "reading":"きぶん", "indonesian":"perasaan / suasana hati"}
      ]'::jsonb,
      3
    );

  UPDATE kanji_items ki SET
    jlpt_level  = 'N5',
    on_reading  = k.on_reading,
    kun_reading = k.kun_reading,
    meaning_id  = k.meaning_id,
    mnemonic    = k.mnemonic,
    compounds   = k.compounds,
    stroke_count = k.stroke_count,
    bab_kode    = v_kode,
    sort_order  = k.ord,
    updated_at  = NOW()
  FROM _b7_kanji k
  WHERE ki.lesson_id = v_lesson_id
    AND ki.jlpt_level = 'N5'
    AND ki.character = k.character;

  INSERT INTO kanji_items (
    character, jlpt_level, on_reading, kun_reading, meaning_id, mnemonic,
    compounds, stroke_count, bab_kode, lesson_id, sort_order
  )
  SELECT
    k.character, 'N5', k.on_reading, k.kun_reading, k.meaning_id, k.mnemonic,
    k.compounds, k.stroke_count, v_kode, v_lesson_id, k.ord
  FROM _b7_kanji k
  WHERE NOT EXISTS (
    SELECT 1 FROM kanji_items ki
     WHERE ki.lesson_id = v_lesson_id
       AND ki.jlpt_level = 'N5'
       AND ki.character = k.character
  );

  SELECT COUNT(*) INTO v_n_target
    FROM kanji_items
   WHERE lesson_id = v_lesson_id
     AND jlpt_level = 'N5'
     AND character IN ('男', '女', '気');

  IF v_n_target <> 3 THEN
    RAISE EXCEPTION '130: Kanji Bab 7 tidak lengkap — ditemukan %, seharusnya 3.', v_n_target;
  END IF;

  RAISE NOTICE '130: Bab 7 "%" siap — 男・女・気 beserta 8 relasi kata terkurasi.', v_module_title;
END $$;
