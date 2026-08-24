-- 072_bab14_intro_kosakata_kanji.sql — Struktur dasar Bab 14
-- (Bentuk-Bentuk Verb & Kewajiban): Pelajaran 1 Pengantar (video), Pelajaran 2
-- Kosakata 語彙 (deck), Pelajaran 3 Kanji 漢字 (kanji).
--
-- Kembaran migration 061 (Bab 12) — lihat file itu untuk penjelasan lengkap
-- pola resolusi modul, semantik upsert, dan alasan konten di-hardcode dari
-- Notion. Ringkasnya:
--   * modul di-resolve ordinal (OFFSET 13, sama seperti 039-065); judul yang
--     tidak cocok cuma memicu NOTICE, bukan skip. Kalau ordinalnya memang
--     tidak ada → cari by judul → baru dibuat, lengkap dengan metadata
--     kurikulum (CEFR / JF topic / skenario / can-do) yang cuma diisi kalau
--     masih kosong;
--   * tiga pelajaran menempati sort_order 1/2/3, pelajaran lain di modul
--     yang sama digeser ke 4..n dengan urutan relatif tetap;
--   * kosakata: 27 kata dari Notion "📚 Vocabulary 語彙" (relasi Lesson
--     → N5-B14), upsert per (module_id, japanese) lalu di-wire ke deck;
--   * kanji: 4 karakter baru (立・休・入・出);
--   * kanji di-scope per pelajaran (character + jlpt_level + lesson_id,
--     sesuai migration 064) — baris kanji milik Bab lain tidak diambil alih;
--   * video_url dibiarkan NULL (admin isi URL Bunny Stream lewat form);
--     duration_minutes estimasi awal 10/30/20 menit, tidak menimpa nilai
--     yang sudah ada.
--
-- Idempotent: aman di-run ulang, aman kalau kursus n5 belum ada.

DO $$
DECLARE
  v_course_slug   TEXT := 'n5';
  v_bab_no        INT  := 14;
  v_kode          TEXT := 'N5-B14';
  v_mod_slug      TEXT := 'bentuk-verb-kewajiban';
  v_mod_title     TEXT := 'Bentuk-Bentuk Verb & Kewajiban';
  v_mod_title_en  TEXT := 'Verb Forms (Jisho, Nai, Ta) & Obligations';
  v_mod_cefr      TEXT := 'A2';
  v_mod_topic     TEXT := 'Interaction';
  v_mod_scenario  TEXT := 'Memahami aturan dan kewajiban: tempat umum, kantor, sekolah — apa yang harus, tidak boleh, tidak perlu, dan tolong jangan.';
  v_mod_cando     JSONB := '["Memahami aturan (yang boleh dan tidak boleh) di tempat umum", "Meminta izin kepada orang yang lebih senior", "Memberi tahu orang lain tentang larangan"]'::jsonb;
  -- Dua regex: yang longgar cuma memverifikasi modul hasil ordinal, yang
  -- ketat dipakai saat mencari modul by judul (biar tidak nyasar ke bab
  -- lain yang judulnya mirip).
  v_title_re      TEXT := '(bentuk|verb|kewajiban)';
  v_title_strict  TEXT := '(kewajiban)';
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
    RAISE NOTICE '072: kursus % tidak ditemukan — skip Bab %.', v_course_slug, v_bab_no;
    RETURN;
  END IF;

  -- === 1. Modul ===========================================================
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
   WHERE m.course_id = v_course_id
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET (v_bab_no - 1) LIMIT 1;

  -- Judul modul di produksi tidak selalu sama dengan judul Notion (mis.
  -- "BAB 12: Bentuk Te : Konjugasi & Permintaan"), jadi ketidakcocokan judul
  -- cuma jadi PERINGATAN — ordinal tetap dipercaya, sama seperti migrasi
  -- 039-065. Modul baru hanya dibuat kalau ordinalnya memang tidak ada.
  IF v_module_id IS NOT NULL AND v_module_title !~* v_title_re THEN
    RAISE NOTICE '072: modul Bab % terbaca "%" — kalau ternyata bukan bab yang dimaksud, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).',
      v_bab_no, v_module_title;
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
    RAISE NOTICE '072: modul Bab % belum ada — dibuat (slug %, sort_order %).',
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
    RAISE NOTICE '072: pakai modul "%" untuk Bab %.', v_module_title, v_bab_no;
  END IF;

  -- === 2. Tiga pelajaran ==================================================
  INSERT INTO lessons (module_id, slug, title, type, content, sort_order, duration_minutes)
  VALUES (v_module_id, 'pelajaran-1-pengantar', 'Pelajaran 1: Pengantar', 'video',
          $html$<p>Pengantar Bab 14 — Bentuk-Bentuk Verb &amp; Kewajiban. Tonton video pembuka, lalu lanjut ke Kosakata dan Kanji.</p>
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
  CREATE TEMP TABLE _b14_vocab (japanese TEXT, reading TEXT, indonesian TEXT, category TEXT, note TEXT, ord INT) ON COMMIT DROP;
  INSERT INTO _b14_vocab VALUES
    ('車道'  , 'しゃどう'  , 'jalan kendaraan'                , '名詞'  , NULL, 1),
    ('マナー' , 'まなー'   , 'tata krama'                     , '名詞'  , NULL, 2),
    ('飲食'  , 'いんしょく' , 'makan & minum'                  , '名詞'  , '飲食禁止', 3),
    ('写真'  , 'しゃしん'  , 'foto'                           , '名詞'  , NULL, 4),
    ('ルール' , 'るーる'   , 'aturan'                         , '名詞'  , 'Loanword (rule). ルールを守る (mematuhi aturan).', 5),
    ('禁止'  , 'きんし'   , 'dilarang / larangan'            , '名詞'  , NULL, 6),
    ('信号'  , 'しんごう'  , 'lampu lalu lintas'              , '名詞'  , NULL, 7),
    ('撮る'  , 'とる'    , 'mengambil (foto)'               , '動詞'  , 'Group I; 写真を撮る', 8),
    ('撮影'  , 'さつえい'  , 'pemotretan / pengambilan gambar', '名詞'  , '撮影禁止 = dilarang foto', 9),
    ('タバコ' , 'たばこ'   , 'rokok'                          , '名詞'  , NULL, 10),
    ('駐輪'  , 'ちゅうりん' , 'parkir sepeda'                  , '名詞'  , '駐輪場', 11),
    ('動画'  , 'どうが'   , 'video'                          , '名詞'  , NULL, 12),
    ('持ち込み', 'もちこみ'  , 'membawa masuk'                  , '名詞'  , '持ち込み禁止', 13),
    ('静か'  , 'しずか'   , 'tenang'                         , 'な形容詞', NULL, 14),
    ('触る'  , 'さわる'   , 'menyentuh'                      , '動詞'  , 'Group I; ~に触る', 15),
    ('携帯'  , 'けいたい'  , 'HP / ponsel'                    , '名詞'  , '携帯電話 versi pendek', 16),
    ('禁煙'  , 'きんえん'  , 'dilarang merokok'               , '名詞'  , 'Tanda umum', 17),
    ('うるさい', 'うるさい'  , 'berisik'                        , 'い形容詞', NULL, 18),
    ('歩道'  , 'ほどう'   , 'trotoar'                        , '名詞'  , NULL, 19),
    ('横断'  , 'おうだん'  , 'menyeberang'                    , '名詞'  , '横断歩道', 20),
    ('吸う'  , 'すう'    , 'menghisap'                      , '動詞'  , 'Group I; タバコを吸う', 21),
    ('電源'  , 'でんげん'  , 'daya listrik / power'           , '名詞'  , '電源を切る = matikan', 22),
    ('入場'  , 'にゅうじょう', 'masuk (tempat)'                 , '名詞'  , '入場料', 23),
    ('駐車'  , 'ちゅうしゃ' , 'parkir mobil'                   , '名詞'  , '駐車禁止', 24),
    ('心配'  , 'しんぱい'  , 'khawatir'                       , 'な形容詞', '心配する (khawatir). 心配しないで (jangan khawatir).', 25),
    ('約束'  , 'やくそく'  , 'janji'                          , '名詞'  , '約束をする (membuat janji). 約束を守る (menepati janji).', 26),
    ('大丈夫' , 'だいじょうぶ', 'tidak apa-apa, oke'             , 'な形容詞', 'Reassurance: 大丈夫です. Pertanyaan: 大丈夫ですか。', 27);

  UPDATE module_vocabulary mv SET
    reading    = s.reading,
    indonesian = s.indonesian,
    category   = s.category,
    note       = s.note,
    updated_at = NOW()
  FROM _b14_vocab s
  WHERE mv.module_id = v_module_id AND mv.japanese = s.japanese;

  INSERT INTO module_vocabulary (module_id, japanese, reading, indonesian, category, note, sort_order)
  SELECT v_module_id, s.japanese, s.reading, s.indonesian, s.category, s.note, s.ord
    FROM _b14_vocab s
   WHERE NOT EXISTS (
     SELECT 1 FROM module_vocabulary mv
      WHERE mv.module_id = v_module_id AND mv.japanese = s.japanese
   );

  INSERT INTO lesson_deck_items (lesson_id, vocabulary_id, sort_order)
  SELECT v_l_kosakata, mv.id, s.ord
    FROM _b14_vocab s
    JOIN LATERAL (
      SELECT id FROM module_vocabulary
       WHERE module_id = v_module_id AND japanese = s.japanese
       ORDER BY created_at ASC LIMIT 1
    ) mv ON TRUE
  ON CONFLICT (lesson_id, vocabulary_id) DO UPDATE SET sort_order = EXCLUDED.sort_order;

  SELECT COUNT(*) INTO v_n_vocab FROM lesson_deck_items WHERE lesson_id = v_l_kosakata;

  -- === 4. Kanji ===========================================================
  CREATE TEMP TABLE _b14_kanji (character TEXT, on_reading TEXT, kun_reading TEXT, meaning_id TEXT, stroke_count INT, mnemonic TEXT, ord INT) ON COMMIT DROP;
  INSERT INTO _b14_kanji VALUES
    ('立', 'リツ', 'た(つ)', 'berdiri', 5,
     'Piktogram orang yang berdiri tegak di atas tanah. Bagian atas adalah figur orang dengan kaki terbuka, garis bawah melambangkan permukaan tanah tempat ia berpijak. Maknanya berkembang menjadi berdiri, berdiri tegak, lalu didirikan/ditegakkan.', 1),
    ('休', 'キュウ', 'やす(む)', 'istirahat, libur', 6,
     'Gabungan 亻(orang) + 木 (pohon). Menggambarkan seseorang yang bersandar di pohon untuk melepas lelah di tengah perjalanan. Dari adegan inilah lahir makna istirahat dan libur.', 2),
    ('入', 'ニュウ', 'はい(る)、い(れる)', 'masuk, memasukkan', 2,
     'Piktogram mulut gua atau pintu masuk yang menyempit ke dalam. Bentuk dua garis yang menyatu di atas menunjukkan gerakan dari luar ke dalam, seperti memasuki celah. Karena itu kanji ini bermakna masuk atau memasukkan.', 3),
    ('出', 'シュツ', 'で(る)、だ(す)', 'keluar, mengeluarkan', 5,
     'Piktogram kaki yang melangkah keluar dari sebuah lubang atau lekukan tanah. Bagian bawah menggambarkan cekungan, dan bentuk di atasnya adalah jejak langkah yang naik ke luar. Maka maknanya keluar atau mengeluarkan.', 4);

  -- Scope per pelajaran, bukan per (character, jlpt_level): sejak migration
  -- 064 satu karakter boleh punya baris sendiri di tiap Bab, dan baris milik
  -- Bab lain TIDAK boleh diambil alih. Update-lalu-insert (bukan ON CONFLICT)
  -- supaya tidak terikat ke nama index tertentu.
  UPDATE kanji_items ki SET
    on_reading   = COALESCE(NULLIF(ki.on_reading, ''), k.on_reading),
    kun_reading  = COALESCE(NULLIF(ki.kun_reading, ''), k.kun_reading),
    meaning_id   = COALESCE(NULLIF(ki.meaning_id, ''), k.meaning_id),
    mnemonic     = COALESCE(NULLIF(ki.mnemonic, ''), k.mnemonic),
    stroke_count = COALESCE(ki.stroke_count, k.stroke_count),
    bab_kode     = COALESCE(NULLIF(ki.bab_kode, ''), v_kode),
    updated_at   = NOW()
  FROM _b14_kanji k
  WHERE ki.lesson_id = v_l_kanji AND ki.jlpt_level = 'N5' AND ki.character = k.character;

  INSERT INTO kanji_items (character, jlpt_level, on_reading, kun_reading, meaning_id, mnemonic, stroke_count, bab_kode, lesson_id, sort_order)
  SELECT k.character, 'N5', k.on_reading, k.kun_reading, k.meaning_id, k.mnemonic, k.stroke_count, v_kode, v_l_kanji, k.ord
    FROM _b14_kanji k
   WHERE NOT EXISTS (
     SELECT 1 FROM kanji_items ki
      WHERE ki.lesson_id = v_l_kanji AND ki.jlpt_level = 'N5' AND ki.character = k.character
   );

  SELECT COUNT(*) INTO v_n_kanji FROM kanji_items WHERE lesson_id = v_l_kanji;

  RAISE NOTICE '072: Bab % siap — Pengantar (video) + Kosakata (% kata) + Kanji (% karakter).',
    v_bab_no, v_n_vocab, v_n_kanji;
END $$;
