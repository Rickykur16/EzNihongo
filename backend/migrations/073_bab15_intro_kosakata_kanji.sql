-- 073_bab15_intro_kosakata_kanji.sql — Struktur dasar Bab 15
-- (Komunikasi Pelayanan): Pelajaran 1 Pengantar (video), Pelajaran 2
-- Kosakata 語彙 (deck), Pelajaran 3 Kanji 漢字 (kanji).
--
-- Kembaran migration 061 (Bab 12) — lihat file itu untuk penjelasan lengkap
-- pola resolusi modul, semantik upsert, dan alasan konten di-hardcode dari
-- Notion. Ringkasnya:
--   * modul di-resolve ordinal (OFFSET 14, sama seperti 039-065); judul yang
--     tidak cocok cuma memicu NOTICE, bukan skip. Kalau ordinalnya memang
--     tidak ada → cari by judul → baru dibuat, lengkap dengan metadata
--     kurikulum (CEFR / JF topic / skenario / can-do) yang cuma diisi kalau
--     masih kosong;
--   * tiga pelajaran menempati sort_order 1/2/3, pelajaran lain di modul
--     yang sama digeser ke 4..n dengan urutan relatif tetap;
--   * kosakata: 41 kata dari Notion "📚 Vocabulary 語彙" (relasi Lesson
--     → N5-B15), upsert per (module_id, japanese) lalu di-wire ke deck;
--   * kanji: 8 karakter baru (言・話・聞・買・店・円・会・社);
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
  v_bab_no        INT  := 15;
  v_kode          TEXT := 'N5-B15';
  v_mod_slug      TEXT := 'komunikasi-pelayanan';
  v_mod_title     TEXT := 'Komunikasi Pelayanan';
  v_mod_title_en  TEXT := 'Service Interactions';
  v_mod_cefr      TEXT := 'A2';
  v_mod_topic     TEXT := 'Interaction';
  v_mod_scenario  TEXT := 'Interaksi service standar — sebagai pelanggan maupun sebagai petugas.';
  v_mod_cando     JSONB := '["Berinteraksi sopan sebagai pelanggan maupun petugas layanan", "Memahami ungkapan keigo dasar yang umum di Jepang", "Merespons permintaan dengan ungkapan standar"]'::jsonb;
  -- Dua regex: yang longgar cuma memverifikasi modul hasil ordinal, yang
  -- ketat dipakai saat mencari modul by judul (biar tidak nyasar ke bab
  -- lain yang judulnya mirip).
  v_title_re      TEXT := '(pelayanan|komunikasi|service)';
  v_title_strict  TEXT := '(pelayanan)';
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
    RAISE NOTICE '073: kursus % tidak ditemukan — skip Bab %.', v_course_slug, v_bab_no;
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
    RAISE NOTICE '073: modul Bab % terbaca "%" — kalau ternyata bukan bab yang dimaksud, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).',
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
    RAISE NOTICE '073: modul Bab % belum ada — dibuat (slug %, sort_order %).',
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
    RAISE NOTICE '073: pakai modul "%" untuk Bab %.', v_module_title, v_bab_no;
  END IF;

  -- === 2. Tiga pelajaran ==================================================
  INSERT INTO lessons (module_id, slug, title, type, content, sort_order, duration_minutes)
  VALUES (v_module_id, 'pelajaran-1-pengantar', 'Pelajaran 1: Pengantar', 'video',
          $html$<p>Pengantar Bab 15 — Komunikasi Pelayanan. Tonton video pembuka, lalu lanjut ke Kosakata dan Kanji.</p>
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
  CREATE TEMP TABLE _b15_vocab (japanese TEXT, reading TEXT, indonesian TEXT, category TEXT, note TEXT, ord INT) ON COMMIT DROP;
  INSERT INTO _b15_vocab VALUES
    ('予約'      , 'よやく'     , 'reservasi'                     , '名詞'  , NULL, 1),
    ('いらっしゃいませ', 'いらっしゃいませ', 'selamat datang (toko/restoran)', '挨拶'  , 'Sapaan staf', 2),
    ('ダブル'     , 'だぶる'     , 'kamar double'                  , '名詞'  , NULL, 3),
    ('メニュー'    , 'めにゅー'    , 'menu'                          , '名詞'  , 'Loanword. Restoran/cafe context.', 4),
    ('店員'      , 'てんいん'    , 'pelayan toko'                  , '名詞'  , NULL, 5),
    ('案内する'    , 'あんないする'  , 'memandu'                       , '動詞'  , 'Group III', 6),
    ('注文する'    , 'ちゅうもんする' , 'memesan'                       , '動詞'  , 'Group III', 7),
    ('シングル'    , 'しんぐる'    , 'kamar single'                  , '名詞'  , NULL, 8),
    ('受付'      , 'うけつけ'    , 'resepsionis / loket'           , '名詞'  , NULL, 9),
    ('キャンセル'   , 'きゃんせる'   , 'membatalkan'                   , '名詞'  , 'キャンセルする', 10),
    ('お客様'     , 'おきゃくさま'  , 'pelanggan (sangat formal)'     , '名詞'  , NULL, 11),
    ('現金'      , 'げんきん'    , 'uang tunai'                    , '名詞'  , NULL, 12),
    ('チェックアウト' , 'ちぇっくあうと' , 'check-out'                     , '名詞'  , NULL, 13),
    ('お釣り'     , 'おつり'     , 'kembalian'                     , '名詞'  , NULL, 14),
    ('クレジットカード', 'くれじっとかーど', 'kartu kredit'                  , '名詞'  , NULL, 15),
    ('レシート'    , 'れしーと'    , 'struk'                         , '名詞'  , NULL, 16),
    ('かしこまりました', 'かしこまりました', 'baik (formal)'                 , '表現'  , 'Respon formal staf', 17),
    ('注文'      , 'ちゅうもん'   , 'pesanan'                       , '名詞'  , NULL, 18),
    ('お会計'     , 'おかいけい'   , 'tagihan / bill'                , '名詞'  , 'お会計お願いします', 19),
    ('払う'      , 'はらう'     , 'membayar'                      , '動詞'  , 'Group I', 20),
    ('チェックイン'  , 'ちぇっくいん'  , 'check-in'                      , '名詞'  , NULL, 21),
    ('予約する'    , 'よやくする'   , 'memesan / mereservasi'         , '動詞'  , 'Group III', 22),
    ('案内'      , 'あんない'    , 'panduan / pengarahan'          , '名詞'  , NULL, 23),
    ('甘い'      , 'あまい'     , 'manis'                         , 'い形容詞', NULL, 24),
    ('食べ物'     , 'たべもの'    , 'makanan'                       , '名詞'  , NULL, 25),
    ('辛い'      , 'からい'     , 'pedas'                         , 'い形容詞', NULL, 26),
    ('何名様'     , 'なんめいさま'  , 'berapa orang (formal)'         , '表現'  , 'Restoran', 27),
    ('夕食'      , 'ゆうしょく'   , 'makan malam (formal)'          , '名詞'  , NULL, 28),
    ('ご飯'      , 'ごはん'     , 'nasi / makan'                  , '名詞'  , '朝ご飯 = sarapan', 29),
    ('アンケート'   , 'あんけーと'   , 'kuesioner / survei'            , '名詞'  , NULL, 30),
    ('〜名'      , '〜めい'     , 'penghitung orang (formal)'     , '助数詞' , '2名様', 31),
    ('部屋'      , 'へや'      , 'kamar'                         , '名詞'  , NULL, 32),
    ('デザート'    , 'でざーと'    , 'pencuci mulut'                 , '名詞'  , NULL, 33),
    ('ベジタリアン'  , 'べじたりあん'  , 'vegetarian'                    , '名詞'  , NULL, 34),
    ('美味しい'    , 'おいしい'    , 'lezat / enak'                  , 'い形容詞', NULL, 35),
    ('飲み物'     , 'のみもの'    , 'minuman'                       , '名詞'  , NULL, 36),
    ('アレルギー'   , 'あれるぎー'   , 'alergi'                        , '名詞'  , NULL, 37),
    ('昼食'      , 'ちゅうしょく'  , 'makan siang (formal)'          , '名詞'  , NULL, 38),
    ('朝食'      , 'ちょうしょく'  , 'sarapan (formal)'              , '名詞'  , 'Hotel/restoran', 39),
    ('お土産'     , 'おみやげ'    , 'oleh-oleh'                     , '名詞'  , NULL, 40),
    ('値段'      , 'ねだん'     , 'harga'                         , '名詞'  , NULL, 41);

  UPDATE module_vocabulary mv SET
    reading    = s.reading,
    indonesian = s.indonesian,
    category   = s.category,
    note       = s.note,
    updated_at = NOW()
  FROM _b15_vocab s
  WHERE mv.module_id = v_module_id AND mv.japanese = s.japanese;

  INSERT INTO module_vocabulary (module_id, japanese, reading, indonesian, category, note, sort_order)
  SELECT v_module_id, s.japanese, s.reading, s.indonesian, s.category, s.note, s.ord
    FROM _b15_vocab s
   WHERE NOT EXISTS (
     SELECT 1 FROM module_vocabulary mv
      WHERE mv.module_id = v_module_id AND mv.japanese = s.japanese
   );

  INSERT INTO lesson_deck_items (lesson_id, vocabulary_id, sort_order)
  SELECT v_l_kosakata, mv.id, s.ord
    FROM _b15_vocab s
    JOIN LATERAL (
      SELECT id FROM module_vocabulary
       WHERE module_id = v_module_id AND japanese = s.japanese
       ORDER BY created_at ASC LIMIT 1
    ) mv ON TRUE
  ON CONFLICT (lesson_id, vocabulary_id) DO UPDATE SET sort_order = EXCLUDED.sort_order;

  SELECT COUNT(*) INTO v_n_vocab FROM lesson_deck_items WHERE lesson_id = v_l_kosakata;

  -- === 4. Kanji ===========================================================
  CREATE TEMP TABLE _b15_kanji (character TEXT, on_reading TEXT, kun_reading TEXT, meaning_id TEXT, stroke_count INT, mnemonic TEXT, ord INT) ON COMMIT DROP;
  INSERT INTO _b15_kanji VALUES
    ('言', 'ゲン、ゴン', 'い(う)、こと', 'berkata, kata', 7,
     'Piktogram mulut yang sedang mengeluarkan suara. Bagian bawah adalah 口 (mulut), garis-garis di atasnya menggambarkan kata-kata atau napas yang keluar dari mulut. Maknanya berkembang menjadi berkata dan kata.', 1),
    ('話', 'ワ', 'はな(す)、はなし', 'berbicara, cerita', 13,
     'Gabungan 言 (kata) di kiri + 舌 (lidah) di kanan. Lidah yang menggerakkan kata-kata = berbicara, lalu meluas menjadi cerita.', 2),
    ('聞', 'ブン、モン', 'き(く)', 'mendengar, bertanya', 14,
     'Gabungan 門 (gerbang) yang membungkus 耳 (telinga). Telinga yang ditempelkan di balik gerbang untuk menangkap suara dari luar = mendengar; karena ingin tahu, juga bertanya.', 3),
    ('買', 'バイ', 'か(う)', 'membeli', 12,
     'Bagian atas 罒 (variasi 网, jaring/wadah) + 貝 (kerang) di bawah. Di Tiongkok kuno, kerang dipakai sebagai uang. Mengumpulkan kerang ke dalam wadah untuk ditukar barang = membeli.', 4),
    ('店', 'テン', 'みせ', 'toko', 8,
     'Gabungan 广 (atap bangunan terbuka) + 占 (menempati suatu tempat). Tempat berkanopi yang ditempati untuk memajang dan menjual barang = toko.', 5),
    ('円', 'エン', 'まる(い)', 'yen, bulat', 4,
     'Bentuk asal: lingkaran tertutup yang melambangkan benda bundar. Bentuk modern adalah penyederhanaan dari 圓. Karena koin Jepang berbentuk bulat, kanji ini juga dipakai untuk mata uang yen.', 6),
    ('会', 'カイ、エ', 'あ(う)', 'bertemu, pertemuan', 6,
     'Bagian atas 人 (orang/atap) + bawah 云 (berkumpul). Sekelompok orang yang berkumpul di bawah satu atap = pertemuan, lalu kata kerja bertemu.', 7),
    ('社', 'シャ', 'やしろ', 'perusahaan, kuil shinto', 7,
     'Gabungan 礻 (radikal altar/dewa) + 土 (tanah). Awalnya berarti tempat suci di atas tanah = kuil shinto. Maknanya berkembang menjadi kelompok yang berkumpul untuk satu tujuan → perusahaan.', 8);

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
  FROM _b15_kanji k
  WHERE ki.lesson_id = v_l_kanji AND ki.jlpt_level = 'N5' AND ki.character = k.character;

  INSERT INTO kanji_items (character, jlpt_level, on_reading, kun_reading, meaning_id, mnemonic, stroke_count, bab_kode, lesson_id, sort_order)
  SELECT k.character, 'N5', k.on_reading, k.kun_reading, k.meaning_id, k.mnemonic, k.stroke_count, v_kode, v_l_kanji, k.ord
    FROM _b15_kanji k
   WHERE NOT EXISTS (
     SELECT 1 FROM kanji_items ki
      WHERE ki.lesson_id = v_l_kanji AND ki.jlpt_level = 'N5' AND ki.character = k.character
   );

  SELECT COUNT(*) INTO v_n_kanji FROM kanji_items WHERE lesson_id = v_l_kanji;

  RAISE NOTICE '073: Bab % siap — Pengantar (video) + Kosakata (% kata) + Kanji (% karakter).',
    v_bab_no, v_n_vocab, v_n_kanji;
END $$;
