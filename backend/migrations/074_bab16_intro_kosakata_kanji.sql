-- 074_bab16_intro_kosakata_kanji.sql — Struktur dasar Bab 16
-- (Hari & Jadwal): Pelajaran 1 Pengantar (video), Pelajaran 2
-- Kosakata 語彙 (deck), Pelajaran 3 Kanji 漢字 (kanji).
--
-- Kembaran migration 061 (Bab 12) — lihat file itu untuk penjelasan lengkap
-- pola resolusi modul, semantik upsert, dan alasan konten di-hardcode dari
-- Notion. Ringkasnya:
--   * modul di-resolve ordinal (OFFSET 15, sama seperti 039-065); judul yang
--     tidak cocok cuma memicu NOTICE, bukan skip. Kalau ordinalnya memang
--     tidak ada → cari by judul → baru dibuat, lengkap dengan metadata
--     kurikulum (CEFR / JF topic / skenario / can-do) yang cuma diisi kalau
--     masih kosong;
--   * tiga pelajaran menempati sort_order 1/2/3, pelajaran lain di modul
--     yang sama digeser ke 4..n dengan urutan relatif tetap;
--   * kosakata: 41 kata dari Notion "📚 Vocabulary 語彙" (relasi Lesson
--     → N5-B16), upsert per (module_id, japanese) lalu di-wire ke deck;
--   * kanji: 9 karakter baru (日・月・火・水・木・金・土・時・分);
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
  v_bab_no        INT  := 16;
  v_kode          TEXT := 'N5-B16';
  v_mod_slug      TEXT := 'hari-jadwal';
  v_mod_title     TEXT := 'Hari & Jadwal';
  v_mod_title_en  TEXT := 'Days, Dates & Schedule';
  v_mod_cefr      TEXT := 'A1';
  v_mod_topic     TEXT := 'Daily Life';
  v_mod_scenario  TEXT := 'Mengatur jadwal: mengajukan izin, konfirmasi jadwal kelas/shift, membuat janji.';
  v_mod_cando     JSONB := '["Menyebut hari, tanggal, dan bulan", "Mengatur jadwal dan mengajukan permohonan izin", "Berbicara tentang rencana mingguan dan bulanan"]'::jsonb;
  -- Dua regex: yang longgar cuma memverifikasi modul hasil ordinal, yang
  -- ketat dipakai saat mencari modul by judul (biar tidak nyasar ke bab
  -- lain yang judulnya mirip).
  v_title_re      TEXT := '(hari|jadwal|tanggal)';
  v_title_strict  TEXT := '(jadwal)';
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
    RAISE NOTICE '074: kursus % tidak ditemukan — skip Bab %.', v_course_slug, v_bab_no;
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
    RAISE NOTICE '074: modul Bab % terbaca "%" — kalau ternyata bukan bab yang dimaksud, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).',
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
    RAISE NOTICE '074: modul Bab % belum ada — dibuat (slug %, sort_order %).',
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
    RAISE NOTICE '074: pakai modul "%" untuk Bab %.', v_module_title, v_bab_no;
  END IF;

  -- === 2. Tiga pelajaran ==================================================
  INSERT INTO lessons (module_id, slug, title, type, content, sort_order, duration_minutes)
  VALUES (v_module_id, 'pelajaran-1-pengantar', 'Pelajaran 1: Pengantar', 'video',
          $html$<p>Pengantar Bab 16 — Hari &amp; Jadwal. Tonton video pembuka, lalu lanjut ke Kosakata dan Kanji.</p>
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
  CREATE TEMP TABLE _b16_vocab (japanese TEXT, reading TEXT, indonesian TEXT, category TEXT, note TEXT, ord INT) ON COMMIT DROP;
  INSERT INTO _b16_vocab VALUES
    ('なつ'    , 'なつ'    , 'musim panas'             , '名詞', '[subcat: season]', 1),
    ('つき'    , 'つき'    , 'bulan'                   , '名詞', '[subcat: calendar] Bisa berarti ''bulan'' kalender (homonim)', 2),
    ('あき'    , 'あき'    , 'musim gugur'             , '名詞', '[subcat: season]', 3),
    ('ふゆ'    , 'ふゆ'    , 'musim dingin'            , '名詞', '[subcat: season]', 4),
    ('はる'    , 'はる'    , 'musim semi'              , '名詞', '[subcat: season]', 5),
    ('明後日'   , 'あさって'  , 'lusa'                    , '名詞', NULL, 6),
    ('土曜日'   , 'どようび'  , 'Sabtu'                   , '名詞', NULL, 7),
    ('時間'    , 'じかん'   , 'waktu'                   , '名詞', NULL, 8),
    ('今日'    , 'きょう'   , 'hari ini'                , '名詞', NULL, 9),
    ('来年'    , 'らいねん'  , 'tahun depan'             , '名詞', NULL, 10),
    ('夕方'    , 'ゆうがた'  , 'sore'                    , '名詞', NULL, 11),
    ('木曜日'   , 'もくようび' , 'Kamis'                   , '名詞', NULL, 12),
    ('朝'     , 'あさ'    , 'pagi'                    , '名詞', '朝に (di pagi hari). 朝ごはん (sarapan).', 13),
    ('先月'    , 'せんげつ'  , 'bulan lalu'              , '名詞', NULL, 14),
    ('夜'     , 'よる'    , 'malam'                   , '名詞', NULL, 15),
    ('予定'    , 'よてい'   , 'rencana / jadwal'        , '名詞', NULL, 16),
    ('午後'    , 'ごご'    , 'PM (sesudah tengah hari)', '名詞', NULL, 17),
    ('今週'    , 'こんしゅう' , 'minggu ini'              , '名詞', NULL, 18),
    ('昼'     , 'ひる'    , 'siang'                   , '名詞', NULL, 19),
    ('一昨日'   , 'おととい'  , 'kemarin lusa'            , '名詞', NULL, 20),
    ('金曜日'   , 'きんようび' , 'Jumat'                   , '名詞', NULL, 21),
    ('今年'    , 'ことし'   , 'tahun ini'               , '名詞', NULL, 22),
    ('明日'    , 'あした'   , 'besok'                   , '名詞', NULL, 23),
    ('祝日'    , 'しゅくじつ' , 'hari raya / hari besar'  , '名詞', NULL, 24),
    ('火曜日'   , 'かようび'  , 'Selasa'                  , '名詞', NULL, 25),
    ('スケジュール', 'すけじゅーる', 'jadwal / schedule'       , '名詞', NULL, 26),
    ('会議'    , 'かいぎ'   , 'rapat / meeting'         , '名詞', NULL, 27),
    ('昨日'    , 'きのう'   , 'kemarin'                 , '名詞', NULL, 28),
    ('午前'    , 'ごぜん'   , 'AM (sebelum tengah hari)', '名詞', NULL, 29),
    ('先週'    , 'せんしゅう' , 'minggu lalu'             , '名詞', NULL, 30),
    ('来週'    , 'らいしゅう' , 'minggu depan'            , '名詞', NULL, 31),
    ('休日'    , 'きゅうじつ' , 'hari libur'              , '名詞', NULL, 32),
    ('平日'    , 'へいじつ'  , 'hari kerja'              , '名詞', NULL, 33),
    ('来月'    , 'らいげつ'  , 'bulan depan'             , '名詞', NULL, 34),
    ('日曜日'   , 'にちようび' , 'Minggu'                  , '名詞', NULL, 35),
    ('今月'    , 'こんげつ'  , 'bulan ini'               , '名詞', NULL, 36),
    ('週末'    , 'しゅうまつ' , 'akhir pekan'             , '名詞', NULL, 37),
    ('去年'    , 'きょねん'  , 'tahun lalu'              , '名詞', NULL, 38),
    ('月曜日'   , 'げつようび' , 'Senin'                   , '名詞', NULL, 39),
    ('カレンダー' , 'かれんだー' , 'kalender'                , '名詞', NULL, 40),
    ('水曜日'   , 'すいようび' , 'Rabu'                    , '名詞', NULL, 41);

  UPDATE module_vocabulary mv SET
    reading    = s.reading,
    indonesian = s.indonesian,
    category   = s.category,
    note       = s.note,
    updated_at = NOW()
  FROM _b16_vocab s
  WHERE mv.module_id = v_module_id AND mv.japanese = s.japanese;

  INSERT INTO module_vocabulary (module_id, japanese, reading, indonesian, category, note, sort_order)
  SELECT v_module_id, s.japanese, s.reading, s.indonesian, s.category, s.note, s.ord
    FROM _b16_vocab s
   WHERE NOT EXISTS (
     SELECT 1 FROM module_vocabulary mv
      WHERE mv.module_id = v_module_id AND mv.japanese = s.japanese
   );

  INSERT INTO lesson_deck_items (lesson_id, vocabulary_id, sort_order)
  SELECT v_l_kosakata, mv.id, s.ord
    FROM _b16_vocab s
    JOIN LATERAL (
      SELECT id FROM module_vocabulary
       WHERE module_id = v_module_id AND japanese = s.japanese
       ORDER BY created_at ASC LIMIT 1
    ) mv ON TRUE
  ON CONFLICT (lesson_id, vocabulary_id) DO UPDATE SET sort_order = EXCLUDED.sort_order;

  SELECT COUNT(*) INTO v_n_vocab FROM lesson_deck_items WHERE lesson_id = v_l_kosakata;

  -- === 4. Kanji ===========================================================
  CREATE TEMP TABLE _b16_kanji (character TEXT, on_reading TEXT, kun_reading TEXT, meaning_id TEXT, stroke_count INT, mnemonic TEXT, ord INT) ON COMMIT DROP;
  INSERT INTO _b16_kanji VALUES
    ('日', 'ニチ、ジツ', 'ひ、か', 'matahari, hari', 4,
     'Piktogram matahari. Bentuk asal adalah lingkaran dengan titik di tengah; lalu disederhanakan menjadi kotak dengan garis tengah. Karena matahari menandai pergantian siang dan malam, maknanya juga hari.', 1),
    ('月', 'ゲツ、ガツ', 'つき', 'bulan', 4,
     'Piktogram bulan sabit dengan dua garis di dalamnya yang menggambarkan bayangan permukaan bulan. Karena fase bulan menandai pergantian bulan kalender, kanji ini juga berarti bulan.', 2),
    ('火', 'カ', 'ひ', 'api', 4,
     'Piktogram api yang menyala. Bentuk asal: lidah api yang bergerak ke atas dengan percikan-percikan di sisinya. Garis-garis di kanji modern adalah penyederhanaan bentuk lidah api.', 3),
    ('水', 'スイ', 'みず', 'air', 4,
     'Piktogram aliran air sungai. Garis tengah panjang melambangkan arus utama, garis-garis di samping adalah percikan air yang memantul. Maknanya: air yang mengalir.', 4),
    ('木', 'ボク、モク', 'き', 'pohon, kayu', 4,
     'Piktogram pohon: garis vertikal adalah batang, garis horizontal di tengah adalah cabang yang merentang ke kiri-kanan, dan garis-garis bawah adalah akar yang menjalar ke tanah.', 5),
    ('金', 'キン、コン', 'かね', 'emas, uang, logam', 8,
     'Bagian atas 人 (atap/payung) + bawah 土 (tanah) dengan dua titik (butiran logam) di sampingnya. Logam mulia yang ditemukan di dalam tanah di bawah lindungan = emas, lalu meluas menjadi uang dan logam.', 6),
    ('土', 'ド、ト', 'つち', 'tanah', 3,
     'Piktogram gundukan tanah di atas permukaan. Garis vertikal adalah tunggul yang menancap, dua garis horizontal melambangkan lapisan tanah yang terhampar. Maknanya: tanah, bumi.', 7),
    ('時', 'ジ', 'とき', 'waktu, jam', 10,
     'Gabungan 日 (matahari) di kiri + 寺 (kuil/tempat tetap) di kanan. Pergerakan matahari yang diukur secara teratur dari satu titik tetap = waktu. Modern: jam pada penunjuk waktu.', 8),
    ('分', 'ブン、フン、ブ', 'わ(かる)、わ(ける)', 'menit, membagi, mengerti', 4,
     'Bagian atas 八 (membelah, membuka) + bawah 刀 (pisau). Pisau yang membelah sesuatu menjadi bagian-bagian. Dari membagi lahir makna menit (bagian dari jam) dan mengerti (memilah-milah pemahaman).', 9);

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
  FROM _b16_kanji k
  WHERE ki.lesson_id = v_l_kanji AND ki.jlpt_level = 'N5' AND ki.character = k.character;

  INSERT INTO kanji_items (character, jlpt_level, on_reading, kun_reading, meaning_id, mnemonic, stroke_count, bab_kode, lesson_id, sort_order)
  SELECT k.character, 'N5', k.on_reading, k.kun_reading, k.meaning_id, k.mnemonic, k.stroke_count, v_kode, v_l_kanji, k.ord
    FROM _b16_kanji k
   WHERE NOT EXISTS (
     SELECT 1 FROM kanji_items ki
      WHERE ki.lesson_id = v_l_kanji AND ki.jlpt_level = 'N5' AND ki.character = k.character
   );

  SELECT COUNT(*) INTO v_n_kanji FROM kanji_items WHERE lesson_id = v_l_kanji;

  RAISE NOTICE '074: Bab % siap — Pengantar (video) + Kosakata (% kata) + Kanji (% karakter).',
    v_bab_no, v_n_vocab, v_n_kanji;
END $$;
