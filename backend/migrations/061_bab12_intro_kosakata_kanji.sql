-- 061_bab12_intro_kosakata_kanji.sql — Struktur dasar Bab 12
-- (Te-form: Konjugasi & Penghubung): Pelajaran 1 Pengantar (video), Pelajaran 2
-- Kosakata 語彙 (deck), Pelajaran 3 Kanji 漢字 (kanji).
--
-- Kembaran migration 061 (Bab 12) — lihat file itu untuk penjelasan lengkap
-- pola resolusi modul, semantik upsert, dan alasan konten di-hardcode dari
-- Notion. Ringkasnya:
--   * modul di-resolve ordinal (OFFSET 11) → cari by judul → dibuat kalau
--     belum ada, lengkap dengan metadata kurikulum (CEFR / JF topic /
--     skenario / can-do) yang cuma diisi kalau masih kosong;
--   * tiga pelajaran menempati sort_order 1/2/3, pelajaran lain di modul
--     yang sama digeser ke 4..n dengan urutan relatif tetap;
--   * kosakata: 48 kata dari Notion "📚 Vocabulary 語彙" (relasi Lesson
--     → N5-B12), upsert per (module_id, japanese) lalu di-wire ke deck;
--   * kanji: 2 karakter baru (食・飲); baris kanji yang sudah ada tidak
--     ditimpa dan lesson_id cuma diisi kalau masih NULL;
--   * video_url dibiarkan NULL (admin isi URL Bunny Stream lewat form);
--     duration_minutes estimasi awal 10/30/20 menit, tidak menimpa nilai
--     yang sudah ada.
--
-- Idempotent: aman di-run ulang, aman kalau kursus n5 belum ada.

DO $$
DECLARE
  v_course_slug   TEXT := 'n5';
  v_bab_no        INT  := 12;
  v_kode          TEXT := 'N5-B12';
  v_mod_slug      TEXT := 'te-form-konjugasi-penghubung';
  v_mod_title     TEXT := 'Te-form: Konjugasi & Penghubung';
  v_mod_title_en  TEXT := 'Te-form: Conjugation & Connecting Actions';
  v_mod_cefr      TEXT := 'A1-A2';
  v_mod_topic     TEXT := 'Interaction';
  v_mod_scenario  TEXT := 'Menjelaskan urutan aktivitas sehari-hari (bangun → sarapan → berangkat).';
  v_mod_cando     JSONB := '["Mengkonjugasi verb ke bentuk te untuk semua grup", "Meminta sesuatu dengan sopan menggunakan 〜てください", "Memberi dan menerima instruksi sederhana"]'::jsonb;
  -- Dua regex: yang longgar cuma memverifikasi modul hasil ordinal, yang
  -- ketat dipakai saat mencari modul by judul (biar tidak nyasar ke bab
  -- lain yang judulnya mirip).
  v_title_re      TEXT := '(te.?form|konjugasi|penghubung)';
  v_title_strict  TEXT := '(konjugasi)';
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
    RAISE NOTICE '061: kursus % tidak ditemukan — skip Bab %.', v_course_slug, v_bab_no;
    RETURN;
  END IF;

  -- === 1. Modul ===========================================================
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
   WHERE m.course_id = v_course_id
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET (v_bab_no - 1) LIMIT 1;

  IF v_module_id IS NOT NULL AND v_module_title !~* v_title_re THEN
    RAISE NOTICE '061: modul ordinal ke-% berjudul "%" tidak cocok pola Bab % — coba cari by judul.',
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
    RAISE NOTICE '061: modul Bab % belum ada — dibuat (slug %, sort_order %).',
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
    RAISE NOTICE '061: pakai modul "%" untuk Bab %.', v_module_title, v_bab_no;
  END IF;

  -- === 2. Tiga pelajaran ==================================================
  INSERT INTO lessons (module_id, slug, title, type, content, sort_order, duration_minutes)
  VALUES (v_module_id, 'pelajaran-1-pengantar', 'Pelajaran 1: Pengantar', 'video',
          $html$<p>Pengantar Bab 12 — Te-form: Konjugasi &amp; Penghubung. Tonton video pembuka, lalu lanjut ke Kosakata dan Kanji.</p>
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
  CREATE TEMP TABLE _b12_vocab (japanese TEXT, reading TEXT, indonesian TEXT, category TEXT, note TEXT, ord INT) ON COMMIT DROP;
  INSERT INTO _b12_vocab VALUES
    ('歌う'  , 'うたう'    , 'bernyanyi'            , '動詞', '[subcat: action] Group I', 1),
    ('始まる' , 'はじまる'   , 'mulai (sendiri)'      , '動詞', '[subcat: action] Group I, intransitif. Pasangan 始める', 2),
    ('死ぬ'  , 'しぬ'     , 'mati'                 , '動詞', '[subcat: action] Group I, satu-satunya verba berakhir ぬ', 3),
    ('飛ぶ'  , 'とぶ'     , 'terbang'              , '動詞', '[subcat: action] Group I', 4),
    ('切る'  , 'きる'     , 'memotong'             , '動詞', '[subcat: action] Group I (looks like II)', 5),
    ('結婚する', 'けっこんする' , 'menikah'              , '動詞', '[subcat: action] Irregular -suru. 〜と結婚する', 6),
    ('引く'  , 'ひく'     , 'menarik'              , '動詞', '[subcat: action] Group I', 7),
    ('落とす' , 'おとす'    , 'menjatuhkan'          , '動詞', '[subcat: action] Group I, transitif', 8),
    ('泳ぐ'  , 'およぐ'    , 'berenang'             , '動詞', 'Godan verb. Te-form: 泳いで.', 9),
    ('止める' , 'とめる'    , 'menghentikan'         , '動詞', '[subcat: action] Group II, transitif. Pasangan 止まる', 10),
    ('閉める' , 'しめる'    , 'menutup'              , '動詞', '[subcat: action] Group II, transitif', 11),
    ('立つ'  , 'たつ'     , 'berdiri'              , '動詞', '[subcat: action] Group I', 12),
    ('卒業する', 'そつぎょうする', 'lulus/wisuda'         , '動詞', '[subcat: action] Irregular -suru. 学校を卒業する', 13),
    ('笑う'  , 'わらう'    , 'tertawa'              , '動詞', 'Godan verb. Te-form: 笑って.', 14),
    ('撮る'  , 'とる'     , 'memotret'             , '動詞', '[subcat: action] Group I. 写真を撮る', 15),
    ('質問する', 'しつもんする' , 'bertanya'             , '動詞', '[subcat: action] Irregular -suru', 16),
    ('入れる' , 'いれる'    , 'memasukkan'           , '動詞', '[subcat: action] Group II, transitif (vs 入る)', 17),
    ('やめる' , 'やめる'    , 'berhenti melakukan'   , '動詞', '[subcat: action] Group II. Berhenti dari aktivitas', 18),
    ('止まる' , 'とまる'    , 'berhenti (sendiri)'   , '動詞', '[subcat: action] Group I, intransitif. Pasangan 止める', 19),
    ('押す'  , 'おす'     , 'mendorong/menekan'    , '動詞', '[subcat: action] Group I', 20),
    ('渡す'  , 'わたす'    , 'memberikan'           , '動詞', '[subcat: action] Group I', 21),
    ('待つ'  , 'まつ'     , 'menunggu'             , '動詞', 'Godan verb. Te-form: 待って.', 22),
    ('つける' , 'つける'    , 'menyalakan'           , '動詞', '[subcat: action] Group II. Lampu/AC', 23),
    ('出来る' , 'できる'    , 'bisa/dapat'           , '動詞', '[subcat: action] Group II. Sering pakai できる', 24),
    ('答える' , 'こたえる'   , 'menjawab'             , '動詞', '[subcat: action] Group II', 25),
    ('勝つ'  , 'かつ'     , 'menang'               , '動詞', '[subcat: action] Group I', 26),
    ('貸す'  , 'かす'     , 'meminjamkan'          , '動詞', '[subcat: action] Group I. Pasangan 借りる', 27),
    ('開ける' , 'あける'    , 'membuka'              , '動詞', '[subcat: action] Group II, transitif', 28),
    ('消す'  , 'けす'     , 'mematikan/menghapus'  , '動詞', '[subcat: action] Group I. Lampu/tulisan', 29),
    ('借りる' , 'かりる'    , 'meminjam'             , '動詞', '[subcat: action] Group II. Pasangan 貸す', 30),
    ('覚える' , 'おぼえる'   , 'mengingat/menghafal'  , '動詞', '[subcat: action] Group II', 31),
    ('出す'  , 'だす'     , 'mengeluarkan'         , '動詞', '[subcat: action] Group I, transitif', 32),
    ('動く'  , 'うごく'    , 'bergerak'             , '動詞', '[subcat: action] Group I, intransitif', 33),
    ('教える' , 'おしえる'   , 'mengajar, memberitahu', '動詞', 'Ichidan verb. Te-form: 教えて.', 34),
    ('取る'  , 'とる'     , 'mengambil'            , '動詞', '[subcat: action] Group I', 35),
    ('案内する', 'あんないする' , 'memandu/menuntun'     , '動詞', '[subcat: action] Irregular -suru', 36),
    ('知る'  , 'しる'     , 'tahu/mengetahui'      , '動詞', '[subcat: action] Group I. Sering pakai te-form: 知っている', 37),
    ('なる'  , 'なる'     , 'menjadi'              , '動詞', '[subcat: action] Group I. Sangat sering: 〜になる', 38),
    ('呼ぶ'  , 'よぶ'     , 'memanggil'            , '動詞', '[subcat: action] Group I', 39),
    ('行う'  , 'おこなう'   , 'melaksanakan (formal)', '動詞', '[subcat: action] Group I, formal', 40),
    ('泣く'  , 'なく'     , 'menangis'             , '動詞', '[subcat: action] Group I', 41),
    ('探す'  , 'さがす'    , 'mencari'              , '動詞', '[subcat: action] Group I', 42),
    ('忘れる' , 'わすれる'   , 'lupa'                 , '動詞', '[subcat: action] Group II', 43),
    ('急ぐ'  , 'いそぐ'    , 'bergegas'             , '動詞', '[subcat: action] Group I', 44),
    ('走る'  , 'はしる'    , 'berlari'              , '動詞', 'Godan verb (eksepsi: terlihat ichidan tapi godan). Te-form: 走って.', 45),
    ('歩く'  , 'あるく'    , 'berjalan kaki'        , '動詞', 'Godan verb. Te-form: 歩いて.', 46),
    ('始める' , 'はじめる'   , 'memulai'              , '動詞', 'Ichidan verb. Lawan: 終わる.', 47),
    ('座る'  , 'すわる'    , 'duduk'                , '動詞', 'Godan verb. Te-form: 座って. Lawan: 立つ.', 48);

  UPDATE module_vocabulary mv SET
    reading    = s.reading,
    indonesian = s.indonesian,
    category   = s.category,
    note       = s.note,
    updated_at = NOW()
  FROM _b12_vocab s
  WHERE mv.module_id = v_module_id AND mv.japanese = s.japanese;

  INSERT INTO module_vocabulary (module_id, japanese, reading, indonesian, category, note, sort_order)
  SELECT v_module_id, s.japanese, s.reading, s.indonesian, s.category, s.note, s.ord
    FROM _b12_vocab s
   WHERE NOT EXISTS (
     SELECT 1 FROM module_vocabulary mv
      WHERE mv.module_id = v_module_id AND mv.japanese = s.japanese
   );

  INSERT INTO lesson_deck_items (lesson_id, vocabulary_id, sort_order)
  SELECT v_l_kosakata, mv.id, s.ord
    FROM _b12_vocab s
    JOIN LATERAL (
      SELECT id FROM module_vocabulary
       WHERE module_id = v_module_id AND japanese = s.japanese
       ORDER BY created_at ASC LIMIT 1
    ) mv ON TRUE
  ON CONFLICT (lesson_id, vocabulary_id) DO UPDATE SET sort_order = EXCLUDED.sort_order;

  SELECT COUNT(*) INTO v_n_vocab FROM lesson_deck_items WHERE lesson_id = v_l_kosakata;

  -- === 4. Kanji ===========================================================
  CREATE TEMP TABLE _b12_kanji (character TEXT, on_reading TEXT, kun_reading TEXT, meaning_id TEXT, stroke_count INT, mnemonic TEXT, ord INT) ON COMMIT DROP;
  INSERT INTO _b12_kanji VALUES
    ('食', 'ショク', 'た(べる)、く(う)', 'makan, makanan', 9,
     'Pictograph asal: bentuk tutup wadah (atas, mirip 人) + 皁 (wadah berisi makanan/nasi). Visualnya: tudung saji menutup makanan = MAKANAN/MAKAN.', 1),
    ('飲', 'イン', 'の(む)', 'minum', 12,
     '食 (radikal makanan/minuman) di kiri + 欠 (orang yang BUKA MULUT lebar). Orang membuka mulut untuk meminum cairan dari wadah = MINUM.', 2);

  INSERT INTO kanji_items (character, jlpt_level, on_reading, kun_reading, meaning_id, mnemonic, stroke_count, bab_kode, lesson_id, sort_order)
  SELECT k.character, 'N5', k.on_reading, k.kun_reading, k.meaning_id, k.mnemonic, k.stroke_count, v_kode, v_l_kanji, k.ord
    FROM _b12_kanji k
  ON CONFLICT (character, jlpt_level) DO UPDATE SET
    on_reading   = COALESCE(NULLIF(kanji_items.on_reading, ''), EXCLUDED.on_reading),
    kun_reading  = COALESCE(NULLIF(kanji_items.kun_reading, ''), EXCLUDED.kun_reading),
    meaning_id   = COALESCE(NULLIF(kanji_items.meaning_id, ''), EXCLUDED.meaning_id),
    mnemonic     = COALESCE(NULLIF(kanji_items.mnemonic, ''), EXCLUDED.mnemonic),
    stroke_count = COALESCE(kanji_items.stroke_count, EXCLUDED.stroke_count),
    bab_kode     = COALESCE(NULLIF(kanji_items.bab_kode, ''), EXCLUDED.bab_kode),
    lesson_id    = COALESCE(kanji_items.lesson_id, EXCLUDED.lesson_id),
    sort_order   = CASE WHEN kanji_items.lesson_id IS NULL THEN EXCLUDED.sort_order ELSE kanji_items.sort_order END,
    updated_at   = NOW();

  SELECT COUNT(*) INTO v_n_kanji FROM kanji_items WHERE lesson_id = v_l_kanji;

  RAISE NOTICE '061: Bab % siap — Pengantar (video) + Kosakata (% kata) + Kanji (% karakter).',
    v_bab_no, v_n_vocab, v_n_kanji;
END $$;
