-- seed-n5-b3-content.sql
-- Konten N5-B3 (Perkenalan Diri / Self-Introduction), sumber: Notion 📗 Bab + relasinya.
-- Idempotent & aman dijalankan ulang. Hanya menyentuh modul slug 'n5-b3' di course 'n5';
-- kalau modul/lesson tidak ditemukan → RAISE NOTICE + skip (bukan error).
--
-- ASUMSI slug (samakan dgn dashboard kalau beda):
--   modul   : n5-b3
--   lessons : n5-b3-bunpou-1 / -2 / -3, n5-b3-kanji-1, n5-b3-assignment
--   (skeleton dari seed-n5-lessons.sql harus sudah dijalankan duluan)
--
-- Pembagian (sesuai keputusan "tetap 3 siklus, kurasi manual"):
--   • Vocab (46) → BANK modul (lesson_id NULL). Distribusikan ke Kosakata 1/2/3
--     lewat admin "Kelola Deck" (tabel lesson_deck_items).
--   • Kanji (9) → diwire ke Kanji 1 dulu; pindahkan sebagian ke Kanji 2/3 via admin
--     sesuai sub-topik.
--   • Grammar (6 pola) → otomatis kebagi 2-2 ke Bunpou 1/2/3 (lengkap di sini).
--   • Contoh kalimat (vocabulary_examples): TIDAK ADA di Notion → diisi belakangan.
--   • Quiz: Notion cuma punya spec (distribusi/threshold), bukan soal jadi. File ini
--     set passing score + questions_per_attempt + quiz_spec; SOAL digenerate lewat
--     admin "generate-quiz" (berbasis vocab) atau ditulis manual.
--
-- Jalankan: psql "$DATABASE_URL" -f backend/seed-n5-b3-content.sql

DO $$
DECLARE
  v_course   uuid;
  v_module   uuid;
  v_b1 uuid; v_b2 uuid; v_b3 uuid;
  v_kanji1   uuid;
  v_assign   uuid;
BEGIN
  SELECT id INTO v_course FROM courses WHERE slug = 'n5';
  IF v_course IS NULL THEN RAISE NOTICE 'Course n5 tidak ditemukan — batal.'; RETURN; END IF;

  SELECT id INTO v_module FROM modules WHERE course_id = v_course AND slug = 'n5-b3';
  IF v_module IS NULL THEN RAISE NOTICE 'Modul n5-b3 tidak ditemukan — batal.'; RETURN; END IF;

  -- ── 1) Metadata modul (Title EN / skenario / Can-Do / Quiz Spec) ──
  UPDATE modules SET
    title_en        = 'Self-Introduction',
    scenario        = 'Perkenalan diri di situasi formal: pertemuan pertama di kelas, tempat kerja, atau komunitas.',
    cefr_level      = COALESCE(cefr_level, 'A1'),
    jf_topic        = COALESCE(jf_topic, 'Self & Others'),
    section_name    = COALESCE(section_name, 'Self & Others'),
    cando_statements = '[
      "Memperkenalkan nama, asal negara, dan status (pelajar/pekerja) dengan kalimat sederhana",
      "Bertanya identitas dasar lawan bicara",
      "Membalas perkenalan dengan ungkapan formal yang sesuai"
    ]'::jsonb,
    quiz_spec = '{
      "passing_score_pct": 70,
      "total_items": 26,
      "distribution": { "vocabulary": 10, "grammar": 8, "listening": 5, "dialog": 3 }
    }'::jsonb,
    updated_at = NOW()
  WHERE id = v_module;

  -- ── 2) Lesson ids ──
  SELECT id INTO v_b1     FROM lessons WHERE module_id = v_module AND slug = 'n5-b3-bunpou-1';
  SELECT id INTO v_b2     FROM lessons WHERE module_id = v_module AND slug = 'n5-b3-bunpou-2';
  SELECT id INTO v_b3     FROM lessons WHERE module_id = v_module AND slug = 'n5-b3-bunpou-3';
  SELECT id INTO v_kanji1 FROM lessons WHERE module_id = v_module AND slug = 'n5-b3-kanji-1';
  SELECT id INTO v_assign FROM lessons WHERE module_id = v_module AND slug = 'n5-b3-assignment';

  -- ── 3) Judul Bunpou = pola yang dibahas (konvensi CLAUDE.md) ──
  UPDATE lessons SET title = '〜は〜です / 〜は〜じゃありません', updated_at = NOW() WHERE id = v_b1;
  UPDATE lessons SET title = '〜は〜ですか / 〜も',               updated_at = NOW() WHERE id = v_b2;
  UPDATE lessons SET title = '〜の / 〜ね・〜よ',                 updated_at = NOW() WHERE id = v_b3;

  -- ── 4) Grammar (6 pola → Bunpou 1/2/3). Replace-on-rerun utk lesson ini. ──
  DELETE FROM module_grammar
   WHERE module_id = v_module AND lesson_id IN (v_b1, v_b2, v_b3);

  IF v_b1 IS NOT NULL THEN
    INSERT INTO module_grammar (module_id, lesson_id, pattern, meaning, example, notes, sort_order) VALUES
      (v_module, v_b1, '〜は〜です',          'A adalah B', '私は学生です。',        'Partikel は dibaca "wa".', 1),
      (v_module, v_b1, '〜は〜じゃありません', 'A bukan B',  '私は先生じゃありません。','Bentuk negatif kopula kata benda. じゃありません = standar/kasual N5; ではありません = variasi formal.', 2);
  END IF;
  IF v_b2 IS NOT NULL THEN
    INSERT INTO module_grammar (module_id, lesson_id, pattern, meaning, example, notes, sort_order) VALUES
      (v_module, v_b2, '〜は〜ですか', 'Apakah A B?', 'あなたは日本人ですか。',     NULL, 1),
      (v_module, v_b2, '〜も',         'juga',        '私もインドネシア人です。',   NULL, 2);
  END IF;
  IF v_b3 IS NOT NULL THEN
    INSERT INTO module_grammar (module_id, lesson_id, pattern, meaning, example, notes, sort_order) VALUES
      (v_module, v_b3, '〜の',       'kepemilikan',                              '私の名前',                   NULL, 1),
      (v_module, v_b3, '〜ね／〜よ', 'partikel akhir kalimat (konfirmasi/penegasan)', '寒いですね。／面白いですよ。', 'ね = mengajak konfirmasi/setuju. よ = menegaskan info baru. Diletakkan di akhir kalimat.', 2);
  END IF;

  -- ── 5) Assignment: passing score + jumlah soal + spec ──
  IF v_assign IS NOT NULL THEN
    UPDATE lessons SET passing_score_pct = 70, questions_per_attempt = 26, cooldown_hours = 12, updated_at = NOW()
     WHERE id = v_assign;
  END IF;

  -- ── 6) Vocab (46) → bank modul (lesson_id NULL). Skip kalau japanese sudah ada. ──
  INSERT INTO module_vocabulary (module_id, lesson_id, japanese, reading, indonesian, category, note, sort_order)
  SELECT v_module, NULL, x.japanese, x.reading, x.indonesian, x.category, x.note, x.so
  FROM (VALUES
    ('私',                  'わたし',               'saya',                       '名詞',  'Standar untuk semua situasi', 1),
    ('僕',                  'ぼく',                 'saya (laki-laki, kasual)',   '名詞',  'Hanya untuk laki-laki, kasual', 2),
    ('貴方',                'あなた',               'anda/kamu',                  '名詞',  'Hindari ke senior — lebih baik pakai nama + さん', 3),
    ('〜さん',              'さん',                 'Tn/Ny/Sdr',                  '接尾辞','Sufiks hormat universal', 4),
    ('〜君',                'くん',                 'panggilan laki-laki muda',   '接尾辞','Untuk peer atau bawahan laki-laki', 5),
    ('〜ちゃん',            'ちゃん',               'panggilan akrab',            '接尾辞','Untuk anak kecil atau perempuan dekat', 6),
    ('名前',                'なまえ',               'nama',                       '名詞',  NULL, 7),
    ('お名前',              'おなまえ',             'nama (sopan)',               '名詞',  'Bentuk hormat dengan prefiks お', 8),
    ('苗字',                'みょうじ',             'nama keluarga',              '名詞',  'Nama keluarga di Jepang ditulis duluan', 9),
    ('国',                  'くに',                 'negara',                     '名詞',  NULL, 10),
    ('出身',                'しゅっしん',           'asal',                       '名詞',  'Contoh: ジャカルタ出身です', 11),
    ('〜人',                'じん',                 'orang dari (negara)',        '接尾辞','Tempel ke nama negara: インドネシア人', 12),
    ('日本',                'にほん',               'Jepang',                     NULL,    'Bisa juga dibaca にっぽん', 13),
    ('日本人',              'にほんじん',           'orang Jepang',               NULL,    NULL, 14),
    ('中国',                'ちゅうごく',           'Tiongkok',                   '名詞',  NULL, 15),
    ('中国人',              'ちゅうごくじん',       'orang Tiongkok',             NULL,    NULL, 16),
    ('韓国',                'かんこく',             'Korea',                      NULL,    'Korea Selatan', 17),
    ('韓国人',              'かんこくじん',         'orang Korea',                NULL,    NULL, 18),
    ('ベトナム',            'ベトナム',             'Vietnam',                    '名詞',  NULL, 19),
    ('タイ',                'タイ',                 'Thailand',                   '名詞',  NULL, 20),
    ('インド',              'インド',               'India',                      '名詞',  NULL, 21),
    ('学生',                'がくせい',             'siswa/mahasiswa',            '名詞',  NULL, 22),
    ('留学生',              'りゅうがくせい',       'mahasiswa asing',            '名詞',  NULL, 23),
    ('大学生',              'だいがくせい',         'mahasiswa S1',               '名詞',  NULL, 24),
    ('先生',                'せんせい',             'guru/dosen',                 '名詞',  'Juga panggilan untuk profesi terhormat (dokter, pengacara)', 25),
    ('会社員',              'かいしゃいん',         'karyawan',                   '名詞',  'Profesi paling umum di Jepang', 26),
    ('銀行員',              'ぎんこういん',         'pegawai bank',               NULL,    NULL, 27),
    ('医者',                'いしゃ',               'dokter',                     '名詞',  'Bentuk sopannya お医者さん', 28),
    ('看護師',              'かんごし',             'perawat',                    '名詞',  NULL, 29),
    ('エンジニア',          'エンジニア',           'engineer',                   '名詞',  NULL, 30),
    ('仕事',                'しごと',               'pekerjaan',                  NULL,    NULL, 31),
    ('会社',                'かいしゃ',             'perusahaan',                 NULL,    NULL, 32),
    ('大学',                'だいがく',             'universitas',                '名詞',  NULL, 33),
    ('高校',                'こうこう',             'SMA',                        NULL,    'Singkatan dari 高等学校', 34),
    ('はじめまして',        'はじめまして',         'salam perkenalan',           '表現',  'Wajib di perkenalan pertama', 35),
    ('よろしくお願いします','よろしくおねがいします','mohon kerjasamanya',         '表現',  'Krusial dalam budaya Jepang', 36),
    ('こちらこそ',          'こちらこそ',           'sama-sama (dalam perkenalan)',NULL,   'Respons saat dikenalkan balik', 37),
    ('ありがとうございます','ありがとうございます', 'terima kasih',               NULL,    'Bentuk formal', 38),
    ('すみません',          'すみません',           'permisi/maaf',               '表現',  'Multifungsi: maaf, permisi, terima kasih ringan', 39),
    ('家族',                'かぞく',               'keluarga',                   '名詞',  'Keluarga inti', 40),
    ('父',                  'ちち',                 'ayah saya',                  '名詞',  'Untuk ayah orang lain pakai お父さん', 41),
    ('母',                  'はは',                 'ibu saya',                   NULL,    'Untuk ibu orang lain pakai お母さん', 42),
    ('兄',                  'あに',                 'kakak laki saya',            '名詞',  'Untuk kakak orang lain pakai お兄さん', 43),
    ('姉',                  'あね',                 'kakak perempuan saya',       '名詞',  'Untuk kakak orang lain pakai お姉さん', 44),
    ('弟',                  'おとうと',             'adik laki saya',             '名詞',  'Untuk adik orang lain pakai 弟さん', 45),
    ('どうぞ',              'どうぞ',               'silakan',                    '表現',  'Ungkapan universal untuk mempersilakan', 46)
  ) AS x(japanese, reading, indonesian, category, note, so)
  WHERE NOT EXISTS (
    SELECT 1 FROM module_vocabulary mv WHERE mv.module_id = v_module AND mv.japanese = x.japanese
  );

  -- ── 7) Kanji (9) → diwire ke Kanji 1 (pindahkan sebagian ke Kanji 2/3 via admin). ──
  IF v_kanji1 IS NOT NULL THEN
    INSERT INTO kanji_items
      (lesson_id, character, jlpt_level, on_reading, kun_reading, meaning_id, mnemonic, compounds, stroke_count, bab_kode, sort_order)
    VALUES
      (v_kanji1, '人', 'N5', 'ジン、ニン', 'ひと', 'orang',
        'Sosok orang dengan dua kaki menopang badan — orang berdiri tegak.',
        '[{"japanese":"日本人","reading":"にほんじん","indonesian":"orang Jepang"},{"japanese":"一人","reading":"ひとり","indonesian":"satu orang / sendirian"},{"japanese":"三人","reading":"さんにん","indonesian":"tiga orang"}]'::jsonb, 2, 'B3', 1),
      (v_kanji1, '名', 'N5', 'メイ、ミョウ', 'な', 'nama',
        'Sore hari (夕) ibu memanggil nama anak lewat mulut (口).',
        '[{"japanese":"名前","reading":"なまえ","indonesian":"nama"},{"japanese":"人名","reading":"じんめい","indonesian":"nama orang"},{"japanese":"国名","reading":"こくめい","indonesian":"nama negara"}]'::jsonb, 6, 'B3', 2),
      (v_kanji1, '何', 'N5', 'カ', 'なに、なん', 'apa',
        'Orang (亻) bertanya "apa yang bisa (可) dilakukan?".',
        '[{"japanese":"何","reading":"なに","indonesian":"apa"},{"japanese":"何時","reading":"なんじ","indonesian":"jam berapa"},{"japanese":"何人","reading":"なんにん","indonesian":"berapa orang"}]'::jsonb, 7, 'B3', 3),
      (v_kanji1, '学', 'N5', 'ガク', 'まな(ぶ)', 'belajar',
        'Anak (子) di bawah atap sedang belajar.',
        '[{"japanese":"学生","reading":"がくせい","indonesian":"siswa"},{"japanese":"大学","reading":"だいがく","indonesian":"universitas"},{"japanese":"学校","reading":"がっこう","indonesian":"sekolah"}]'::jsonb, 8, 'B3', 4),
      (v_kanji1, '校', 'N5', 'コウ', NULL, 'sekolah',
        'Bangunan kayu (木) tempat siswa berkumpul/bersilang (交).',
        '[{"japanese":"学校","reading":"がっこう","indonesian":"sekolah"},{"japanese":"高校","reading":"こうこう","indonesian":"SMA"},{"japanese":"校長","reading":"こうちょう","indonesian":"kepala sekolah"}]'::jsonb, 10, 'B3', 5),
      (v_kanji1, '先', 'N5', 'セン', 'さき', 'sebelumnya, lebih dahulu',
        'Senior berjalan lebih dulu dengan kaki (儿) — di depan.',
        '[{"japanese":"先生","reading":"せんせい","indonesian":"guru"},{"japanese":"先週","reading":"せんしゅう","indonesian":"minggu lalu"},{"japanese":"先月","reading":"せんげつ","indonesian":"bulan lalu"}]'::jsonb, 6, 'B3', 6),
      (v_kanji1, '生', 'N5', 'セイ、ショウ', 'い(きる)、う(まれる)、なま', 'hidup, lahir',
        NULL, '[]'::jsonb, 5, 'B3', 7),
      (v_kanji1, '国', 'N5', 'コク', 'くに', 'negara',
        NULL, '[]'::jsonb, 8, 'B3', 8),
      (v_kanji1, '語', 'N5', 'ゴ', 'かた(る)', 'bahasa',
        NULL, '[]'::jsonb, 14, 'B3', 9)
    ON CONFLICT (character, jlpt_level) DO UPDATE SET
      lesson_id    = COALESCE(kanji_items.lesson_id, EXCLUDED.lesson_id),
      on_reading   = EXCLUDED.on_reading,
      kun_reading  = EXCLUDED.kun_reading,
      meaning_id   = EXCLUDED.meaning_id,
      mnemonic     = EXCLUDED.mnemonic,
      compounds    = EXCLUDED.compounds,
      stroke_count = EXCLUDED.stroke_count,
      bab_kode     = EXCLUDED.bab_kode,
      updated_at   = NOW();
  END IF;

  RAISE NOTICE 'N5-B3: metadata + 6 grammar + 46 vocab (bank) + 9 kanji (Kanji 1) selesai.';
END $$;
