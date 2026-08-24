-- 062_bab13_intro_kosakata_kanji.sql — Struktur dasar Bab 13
-- (Te-form: Progresif & Aplikasi): Pelajaran 1 Pengantar (video), Pelajaran 2
-- Kosakata 語彙 (deck), Pelajaran 3 Kanji 漢字 (kanji).
--
-- Kembaran migration 061 (Bab 12) — lihat file itu untuk penjelasan lengkap
-- pola resolusi modul, semantik upsert, dan alasan konten di-hardcode dari
-- Notion. Ringkasnya:
--   * modul di-resolve ordinal (OFFSET 12) → cari by judul → dibuat kalau
--     belum ada, lengkap dengan metadata kurikulum (CEFR / JF topic /
--     skenario / can-do) yang cuma diisi kalau masih kosong;
--   * tiga pelajaran menempati sort_order 1/2/3, pelajaran lain di modul
--     yang sama digeser ke 4..n dengan urutan relatif tetap;
--   * kosakata: 40 kata dari Notion "📚 Vocabulary 語彙" (relasi Lesson
--     → N5-B13), upsert per (module_id, japanese) lalu di-wire ke deck;
--   * kanji: kolom "Kanji First Introduced" Bab ini MASIH KOSONG di Notion,
--     jadi pelajaran Kanji dibuat tapi belum berisi (lihat blok 4);
--   * video_url dibiarkan NULL (admin isi URL Bunny Stream lewat form);
--     duration_minutes estimasi awal 10/30/20 menit, tidak menimpa nilai
--     yang sudah ada.
--
-- Idempotent: aman di-run ulang, aman kalau kursus n5 belum ada.

DO $$
DECLARE
  v_course_slug   TEXT := 'n5';
  v_bab_no        INT  := 13;
  v_kode          TEXT := 'N5-B13';
  v_mod_slug      TEXT := 'te-form-progresif-aplikasi';
  v_mod_title     TEXT := 'Te-form: Progresif & Aplikasi';
  v_mod_title_en  TEXT := 'Te-form: Progressive & Applications';
  v_mod_cefr      TEXT := 'A1-A2';
  v_mod_topic     TEXT := 'Interaction';
  v_mod_scenario  TEXT := 'Menjelaskan kondisi hidup saat ini (tinggal di mana, bekerja di mana); meminta izin.';
  v_mod_cando     JSONB := '["Menggunakan 〜ています untuk aktivitas yang sedang berlangsung", "Menggunakan 〜ています untuk kondisi/kebiasaan", "Meminta izin dengan 〜てもいいですか"]'::jsonb;
  -- Dua regex: yang longgar cuma memverifikasi modul hasil ordinal, yang
  -- ketat dipakai saat mencari modul by judul (biar tidak nyasar ke bab
  -- lain yang judulnya mirip).
  v_title_re      TEXT := '(te.?form|progresif|aplikasi)';
  v_title_strict  TEXT := '(progresif|aplikasi)';
  v_course_id     UUID;
  v_module_id     UUID;
  v_module_title  TEXT;
  v_l_intro       UUID;
  v_l_kosakata    UUID;
  v_l_kanji       UUID;
  v_n_vocab       INT;
  v_n_kanji       INT;
BEGIN
  SELECT id INTO v_course_id FROM courses WHERE slug = v_course_slug;
  IF v_course_id IS NULL THEN
    RAISE NOTICE '062: kursus % tidak ditemukan — skip Bab %.', v_course_slug, v_bab_no;
    RETURN;
  END IF;

  -- === 1. Modul ===========================================================
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
   WHERE m.course_id = v_course_id
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET (v_bab_no - 1) LIMIT 1;

  IF v_module_id IS NOT NULL AND v_module_title !~* v_title_re THEN
    RAISE NOTICE '062: modul ordinal ke-% berjudul "%" tidak cocok pola Bab % — coba cari by judul.',
      v_bab_no, v_module_title, v_bab_no;
    v_module_id := NULL;
  END IF;

  IF v_module_id IS NULL THEN
    SELECT m.id, m.title INTO v_module_id, v_module_title
      FROM modules m
     WHERE m.course_id = v_course_id
       AND (m.title ~* v_title_strict OR m.slug = v_mod_slug)
     ORDER BY m.sort_order ASC, m.created_at ASC
     LIMIT 1;
  END IF;

  IF v_module_id IS NULL THEN
    INSERT INTO modules (course_id, slug, title, description, sort_order,
                         title_en, cefr_level, jf_topic, scenario, cando_statements)
    VALUES (v_course_id, v_mod_slug, v_mod_title, v_mod_scenario, v_bab_no,
            v_mod_title_en, v_mod_cefr, v_mod_topic, v_mod_scenario, v_mod_cando)
    RETURNING id INTO v_module_id;
    RAISE NOTICE '062: modul Bab % belum ada — dibuat (slug %, sort_order %).',
      v_bab_no, v_mod_slug, v_bab_no;
  ELSE
    -- Modul sudah ada: lengkapi metadata yang masih kosong saja.
    UPDATE modules SET
      title_en         = COALESCE(NULLIF(title_en, ''), v_mod_title_en),
      cefr_level       = COALESCE(NULLIF(cefr_level, ''), v_mod_cefr),
      jf_topic         = COALESCE(NULLIF(jf_topic, ''), v_mod_topic),
      scenario         = COALESCE(NULLIF(scenario, ''), v_mod_scenario),
      cando_statements = CASE WHEN cando_statements = '[]'::jsonb THEN v_mod_cando ELSE cando_statements END,
      updated_at       = NOW()
    WHERE id = v_module_id;
    RAISE NOTICE '062: pakai modul "%" untuk Bab %.', v_module_title, v_bab_no;
  END IF;

  -- === 2. Tiga pelajaran ==================================================
  INSERT INTO lessons (module_id, slug, title, type, content, sort_order, duration_minutes)
  VALUES (v_module_id, 'pelajaran-1-pengantar', 'Pelajaran 1: Pengantar', 'video',
          $html$<p>Pengantar Bab 13 — Te-form: Progresif &amp; Aplikasi. Tonton video pembuka, lalu lanjut ke Kosakata dan Kanji.</p>
<p><strong>Struktur bab:</strong> Pengantar → Kosakata → Kanji → Tata Bahasa → Latihan → Kuis.</p>$html$, 1, 10)
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title            = EXCLUDED.title,
    type             = EXCLUDED.type,
    content          = COALESCE(NULLIF(lessons.content, ''), EXCLUDED.content),
    duration_minutes = COALESCE(lessons.duration_minutes, EXCLUDED.duration_minutes),
    sort_order       = EXCLUDED.sort_order,
    updated_at       = NOW()
  RETURNING id INTO v_l_intro;

  INSERT INTO lessons (module_id, slug, title, type, sort_order, duration_minutes)
  VALUES (v_module_id, 'pelajaran-2-kosakata', 'Pelajaran 2: Kosakata 語彙', 'deck', 2, 30)
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title            = EXCLUDED.title,
    type             = EXCLUDED.type,
    duration_minutes = COALESCE(lessons.duration_minutes, EXCLUDED.duration_minutes),
    sort_order       = EXCLUDED.sort_order,
    updated_at       = NOW()
  RETURNING id INTO v_l_kosakata;

  INSERT INTO lessons (module_id, slug, title, type, sort_order, duration_minutes)
  VALUES (v_module_id, 'pelajaran-3-kanji', 'Pelajaran 3: Kanji 漢字', 'kanji', 3, 20)
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title            = EXCLUDED.title,
    type             = EXCLUDED.type,
    duration_minutes = COALESCE(lessons.duration_minutes, EXCLUDED.duration_minutes),
    sort_order       = EXCLUDED.sort_order,
    updated_at       = NOW()
  RETURNING id INTO v_l_kanji;

  -- Pelajaran lain di modul ini digeser ke 4..n, urutan relatifnya dijaga.
  WITH lain AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order ASC, created_at ASC) AS rn
      FROM lessons
     WHERE module_id = v_module_id
       AND id NOT IN (v_l_intro, v_l_kosakata, v_l_kanji)
  )
  UPDATE lessons l SET sort_order = lain.rn + 3, updated_at = NOW()
    FROM lain
   WHERE l.id = lain.id AND l.sort_order IS DISTINCT FROM lain.rn + 3;

  -- === 3. Kosakata (bank modul + deck) ====================================
  CREATE TEMP TABLE _b13_vocab (japanese TEXT, reading TEXT, indonesian TEXT, category TEXT, note TEXT, ord INT) ON COMMIT DROP;
  INSERT INTO _b13_vocab VALUES
    ('村'   , 'むら'    , 'desa'                   , '名詞'  , NULL, 1),
    ('持つ'  , 'もつ'    , 'memegang / memiliki'    , '動詞'  , 'Group I; 持っている=memiliki', 2),
    ('走る'  , 'はしる'   , 'berlari'                , '動詞'  , 'Group I (irregular ru-verb)', 3),
    ('出かける', 'でかける'  , 'pergi keluar'           , '動詞'  , 'Group II', 4),
    ('町'   , 'まち'    , 'kota kecil / lingkungan', '名詞'  , NULL, 5),
    ('教師'  , 'きょうし'  , 'guru (formal)'          , '名詞'  , 'Profesi', 6),
    ('結婚する', 'けっこんする', 'menikah'                , '動詞'  , 'Group III; ~と結婚する', 7),
    ('職業'  , 'しょくぎょう', 'pekerjaan / profesi'    , '名詞'  , NULL, 8),
    ('始まる' , 'はじまる'  , 'dimulai (intransitif)'  , '動詞'  , 'Group I', 9),
    ('終わる' , 'おわる'   , 'selesai (intransitif)'  , '動詞'  , 'Group I', 10),
    ('着く'  , 'つく'    , 'tiba / sampai'          , '動詞'  , 'Group I; ~に着く', 11),
    ('県'   , 'けん'    , 'prefektur'              , '名詞'  , NULL, 12),
    ('知る'  , 'しる'    , 'tahu / kenal'           , '動詞'  , 'Group I; ~を知っている', 13),
    ('開く'  , 'あく'    , 'terbuka (intransitif)'  , '動詞'  , 'Group I', 14),
    ('住所'  , 'じゅうしょ' , 'alamat'                 , '名詞'  , NULL, 15),
    ('急ぐ'  , 'いそぐ'   , 'buru-buru / bergegas'   , '動詞'  , 'Group I', 16),
    ('医者'  , 'いしゃ'   , 'dokter'                 , '名詞'  , 'Profesi', 17),
    ('立つ'  , 'たつ'    , 'berdiri'                , '動詞'  , 'Group I', 18),
    ('住む'  , 'すむ'    , 'tinggal / berdiam'      , '動詞'  , 'Group I; ~に住んでいる', 19),
    ('歩く'  , 'あるく'   , 'berjalan'               , '動詞'  , 'Group I', 20),
    ('市'   , 'し'     , 'kota'                   , '名詞'  , NULL, 21),
    ('待つ'  , 'まつ'    , 'menunggu'               , '動詞'  , 'Group I', 22),
    ('会社員' , 'かいしゃいん', 'karyawan perusahaan'    , '名詞'  , 'Profesi', 23),
    ('座る'  , 'すわる'   , 'duduk'                  , '動詞'  , 'Group I', 24),
    ('閉まる' , 'しまる'   , 'tertutup (intransitif)' , '動詞'  , 'Group I', 25),
    ('学生'  , 'がくせい'  , 'pelajar / mahasiswa'    , '名詞'  , NULL, 26),
    ('暇'   , 'ひま'    , 'waktu luang'            , '名詞'  , NULL, 27),
    ('大変'  , 'たいへん'  , 'berat / wow'            , 'な形容詞', NULL, 28),
    ('眠い'  , 'ねむい'   , 'ngantuk'                , 'い形容詞', NULL, 29),
    ('忙しい' , 'いそがしい' , 'sibuk'                  , 'い形容詞', NULL, 30),
    ('事'   , 'こと'    , 'hal / perkara'          , '名詞'  , NULL, 31),
    ('お腹'  , 'おなか'   , 'perut'                  , '名詞'  , NULL, 32),
    ('熱'   , 'ねつ'    , 'demam'                  , '名詞'  , NULL, 33),
    ('元気'  , 'げんき'   , 'sehat / semangat'       , 'な形容詞', NULL, 34),
    ('大丈夫' , 'だいじょうぶ', 'tidak apa-apa'          , 'な形容詞', NULL, 35),
    ('疲れる' , 'つかれる'  , 'lelah'                  , '動詞'  , NULL, 36),
    ('痛い'  , 'いたい'   , 'sakit'                  , 'い形容詞', NULL, 37),
    ('喉'   , 'のど'    , 'tenggorokan'            , '名詞'  , NULL, 38),
    ('物'   , 'もの'    , 'barang / hal'           , '名詞'  , NULL, 39),
    ('風邪'  , 'かぜ'    , 'flu / masuk angin'      , '名詞'  , NULL, 40);

  UPDATE module_vocabulary mv SET
    reading    = s.reading,
    indonesian = s.indonesian,
    category   = s.category,
    note       = s.note,
    updated_at = NOW()
  FROM _b13_vocab s
  WHERE mv.module_id = v_module_id AND mv.japanese = s.japanese;

  INSERT INTO module_vocabulary (module_id, japanese, reading, indonesian, category, note, sort_order)
  SELECT v_module_id, s.japanese, s.reading, s.indonesian, s.category, s.note, s.ord
    FROM _b13_vocab s
   WHERE NOT EXISTS (
     SELECT 1 FROM module_vocabulary mv
      WHERE mv.module_id = v_module_id AND mv.japanese = s.japanese
   );

  INSERT INTO lesson_deck_items (lesson_id, vocabulary_id, sort_order)
  SELECT v_l_kosakata, mv.id, s.ord
    FROM _b13_vocab s
    JOIN LATERAL (
      SELECT id FROM module_vocabulary
       WHERE module_id = v_module_id AND japanese = s.japanese
       ORDER BY created_at ASC LIMIT 1
    ) mv ON TRUE
  ON CONFLICT (lesson_id, vocabulary_id) DO UPDATE SET sort_order = EXCLUDED.sort_order;

  SELECT COUNT(*) INTO v_n_vocab FROM lesson_deck_items WHERE lesson_id = v_l_kosakata;

  -- === 4. Kanji ===========================================================
  -- Notion belum punya kanji "First Lesson" untuk bab ini — pelajaran
  -- Kanji tetap dibuat (struktur bab konsisten) tapi masih kosong. Admin
  -- bisa mengisinya lewat "Kelola Kanji" setelah kolom First Lesson di
  -- Notion diisi.
  SELECT COUNT(*) INTO v_n_kanji FROM kanji_items WHERE lesson_id = v_l_kanji;

  RAISE NOTICE '062: Bab % siap — Pengantar (video) + Kosakata (% kata) + Kanji (% karakter).',
    v_bab_no, v_n_vocab, v_n_kanji;
END $$;
