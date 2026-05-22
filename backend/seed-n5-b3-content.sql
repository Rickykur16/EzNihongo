-- seed-n5-b3-content.sql
-- Konten N5-B3 (Perkenalan Diri / Self-Introduction), sumber: Notion 📗 Bab + relasinya.
-- Idempotent & aman dijalankan ulang. Hanya menyentuh modul slug 'n5-b3' di course 'n5';
-- kalau modul/lesson tidak ditemukan → RAISE NOTICE + skip (bukan error).
--
-- ASUMSI slug (samakan dgn dashboard kalau beda):
--   modul   : n5-b3
--   lessons : n5-b3-kosakata-1/-2/-3, n5-b3-kanji-1/-2/-3, n5-b3-bunpou-1/-2/-3, n5-b3-assignment
--   (skeleton dari seed-n5-lessons.sql harus sudah dijalankan duluan)
--
-- Pembagian per siklus (urutan vocab → kanji → bunpou, ulang per sub-topik):
--   Siklus 1 — は〜です / じゃありません : sapaan, kata ganti & nama
--   Siklus 2 — 〜ですか / 〜も           : negara & kewarganegaraan
--   Siklus 3 — 〜の / 〜ね・よ           : status/pekerjaan & keluarga
--   • Vocab (46) → bank modul + di-wire ke deck Kosakata 1/2/3 (lesson_deck_items).
--   • Kanji (9) → di-wire ke Kanji 1/2/3 sesuai siklus.
--   • Grammar (6 pola) → 2-2 ke Bunpou 1/2/3.
--   • Contoh kalimat (vocabulary_examples): TIDAK ADA di Notion → diisi belakangan.
--   • Quiz: Notion cuma punya spec (distribusi/threshold), bukan soal jadi. File ini
--     set passing score + questions_per_attempt + quiz_spec; SOAL digenerate lewat
--     admin "generate-quiz" (berbasis vocab) atau ditulis manual.
--
-- Jalankan: psql "$DATABASE_URL" -f backend/seed-n5-b3-content.sql

DO $$
DECLARE
  v_course uuid;
  v_module uuid;
  v_b1 uuid; v_b2 uuid; v_b3 uuid;
  v_ko1 uuid; v_ko2 uuid; v_ko3 uuid;
  v_ka1 uuid; v_ka2 uuid; v_ka3 uuid;
  v_assign uuid;
BEGIN
  SELECT id INTO v_course FROM courses WHERE slug = 'n5';
  IF v_course IS NULL THEN RAISE NOTICE 'Course n5 tidak ditemukan — batal.'; RETURN; END IF;

  SELECT id INTO v_module FROM modules WHERE course_id = v_course AND slug = 'n5-b3';
  IF v_module IS NULL THEN RAISE NOTICE 'Modul n5-b3 tidak ditemukan — batal.'; RETURN; END IF;

  -- ── Lesson ids ──
  SELECT id INTO v_ko1 FROM lessons WHERE module_id = v_module AND slug = 'n5-b3-kosakata-1';
  SELECT id INTO v_ko2 FROM lessons WHERE module_id = v_module AND slug = 'n5-b3-kosakata-2';
  SELECT id INTO v_ko3 FROM lessons WHERE module_id = v_module AND slug = 'n5-b3-kosakata-3';
  SELECT id INTO v_ka1 FROM lessons WHERE module_id = v_module AND slug = 'n5-b3-kanji-1';
  SELECT id INTO v_ka2 FROM lessons WHERE module_id = v_module AND slug = 'n5-b3-kanji-2';
  SELECT id INTO v_ka3 FROM lessons WHERE module_id = v_module AND slug = 'n5-b3-kanji-3';
  SELECT id INTO v_b1  FROM lessons WHERE module_id = v_module AND slug = 'n5-b3-bunpou-1';
  SELECT id INTO v_b2  FROM lessons WHERE module_id = v_module AND slug = 'n5-b3-bunpou-2';
  SELECT id INTO v_b3  FROM lessons WHERE module_id = v_module AND slug = 'n5-b3-bunpou-3';
  SELECT id INTO v_assign FROM lessons WHERE module_id = v_module AND slug = 'n5-b3-assignment';

  -- ── 1) Metadata modul ──
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

  -- ── 2) Judul Bunpou = pola yang dibahas ──
  UPDATE lessons SET title = '〜は〜です / 〜は〜じゃありません', updated_at = NOW() WHERE id = v_b1;
  UPDATE lessons SET title = '〜は〜ですか / 〜も',               updated_at = NOW() WHERE id = v_b2;
  UPDATE lessons SET title = '〜の / 〜ね・〜よ',                 updated_at = NOW() WHERE id = v_b3;

  -- ── 3) Grammar (6 pola → Bunpou 1/2/3) ──
  DELETE FROM module_grammar WHERE module_id = v_module AND lesson_id IN (v_b1, v_b2, v_b3);
  IF v_b1 IS NOT NULL THEN
    INSERT INTO module_grammar (module_id, lesson_id, pattern, meaning, example, notes, sort_order) VALUES
      (v_module, v_b1, '〜は〜です',          'A adalah B', '私は学生です。',          'Partikel は dibaca "wa".', 1),
      (v_module, v_b1, '〜は〜じゃありません', 'A bukan B',  '私は先生じゃありません。', 'Bentuk negatif kopula kata benda. じゃありません = standar/kasual N5; ではありません = variasi formal.', 2);
  END IF;
  IF v_b2 IS NOT NULL THEN
    INSERT INTO module_grammar (module_id, lesson_id, pattern, meaning, example, notes, sort_order) VALUES
      (v_module, v_b2, '〜は〜ですか', 'Apakah A B?', 'あなたは日本人ですか。',   NULL, 1),
      (v_module, v_b2, '〜も',         'juga',        '私もインドネシア人です。', NULL, 2);
  END IF;
  IF v_b3 IS NOT NULL THEN
    INSERT INTO module_grammar (module_id, lesson_id, pattern, meaning, example, notes, sort_order) VALUES
      (v_module, v_b3, '〜の',       'kepemilikan',                                   '私の名前',                     NULL, 1),
      (v_module, v_b3, '〜ね／〜よ', 'partikel akhir kalimat (konfirmasi/penegasan)', '寒いですね。／面白いですよ。', 'ね = mengajak konfirmasi/setuju. よ = menegaskan info baru. Diletakkan di akhir kalimat.', 2);
  END IF;

  -- ── 4) Assignment: passing score + jumlah soal ──
  IF v_assign IS NOT NULL THEN
    UPDATE lessons SET passing_score_pct = 70, questions_per_attempt = 26, cooldown_hours = 12, updated_at = NOW()
     WHERE id = v_assign;
  END IF;

  -- ── 5) Vocab (46): bank + wiring ke deck Kosakata per siklus ──
  CREATE TEMP TABLE _b3_vocab (
    japanese text, reading text, indonesian text, category text, note text, cycle int, so int
  ) ON COMMIT DROP;
  INSERT INTO _b3_vocab VALUES
    -- Siklus 1: sapaan, kata ganti & nama
    ('私',                  'わたし',               'saya',                        '名詞',  'Standar untuk semua situasi', 1, 1),
    ('僕',                  'ぼく',                 'saya (laki-laki, kasual)',    '名詞',  'Hanya untuk laki-laki, kasual', 1, 2),
    ('貴方',                'あなた',               'anda/kamu',                   '名詞',  'Hindari ke senior — lebih baik pakai nama + さん', 1, 3),
    ('〜さん',              'さん',                 'Tn/Ny/Sdr',                   '接尾辞','Sufiks hormat universal', 1, 4),
    ('〜君',                'くん',                 'panggilan laki-laki muda',    '接尾辞','Untuk peer atau bawahan laki-laki', 1, 5),
    ('〜ちゃん',            'ちゃん',               'panggilan akrab',             '接尾辞','Untuk anak kecil atau perempuan dekat', 1, 6),
    ('名前',                'なまえ',               'nama',                        '名詞',  NULL, 1, 7),
    ('お名前',              'おなまえ',             'nama (sopan)',                '名詞',  'Bentuk hormat dengan prefiks お', 1, 8),
    ('苗字',                'みょうじ',             'nama keluarga',               '名詞',  'Nama keluarga di Jepang ditulis duluan', 1, 9),
    ('はじめまして',        'はじめまして',         'salam perkenalan',            '表現',  'Wajib di perkenalan pertama', 1, 10),
    ('よろしくお願いします','よろしくおねがいします','mohon kerjasamanya',          '表現',  'Krusial dalam budaya Jepang', 1, 11),
    ('こちらこそ',          'こちらこそ',           'sama-sama (dalam perkenalan)',NULL,   'Respons saat dikenalkan balik', 1, 12),
    ('ありがとうございます','ありがとうございます', 'terima kasih',                NULL,   'Bentuk formal', 1, 13),
    ('すみません',          'すみません',           'permisi/maaf',                '表現',  'Multifungsi: maaf, permisi, terima kasih ringan', 1, 14),
    ('どうぞ',              'どうぞ',               'silakan',                     '表現',  'Ungkapan universal untuk mempersilakan', 1, 15),
    -- Siklus 2: negara & kewarganegaraan
    ('国',                  'くに',                 'negara',                      '名詞',  NULL, 2, 16),
    ('出身',                'しゅっしん',           'asal',                        '名詞',  'Contoh: ジャカルタ出身です', 2, 17),
    ('〜人',                'じん',                 'orang dari (negara)',         '接尾辞','Tempel ke nama negara: インドネシア人', 2, 18),
    ('日本',                'にほん',               'Jepang',                      NULL,    'Bisa juga dibaca にっぽん', 2, 19),
    ('日本人',              'にほんじん',           'orang Jepang',                NULL,    NULL, 2, 20),
    ('中国',                'ちゅうごく',           'Tiongkok',                    '名詞',  NULL, 2, 21),
    ('中国人',              'ちゅうごくじん',       'orang Tiongkok',              NULL,    NULL, 2, 22),
    ('韓国',                'かんこく',             'Korea',                       NULL,    'Korea Selatan', 2, 23),
    ('韓国人',              'かんこくじん',         'orang Korea',                 NULL,    NULL, 2, 24),
    ('ベトナム',            'ベトナム',             'Vietnam',                     '名詞',  NULL, 2, 25),
    ('タイ',                'タイ',                 'Thailand',                    '名詞',  NULL, 2, 26),
    ('インド',              'インド',               'India',                       '名詞',  NULL, 2, 27),
    -- Siklus 3: status/pekerjaan & keluarga
    ('学生',                'がくせい',             'siswa/mahasiswa',             '名詞',  NULL, 3, 28),
    ('留学生',              'りゅうがくせい',       'mahasiswa asing',             '名詞',  NULL, 3, 29),
    ('大学生',              'だいがくせい',         'mahasiswa S1',                '名詞',  NULL, 3, 30),
    ('先生',                'せんせい',             'guru/dosen',                  '名詞',  'Juga panggilan untuk profesi terhormat (dokter, pengacara)', 3, 31),
    ('会社員',              'かいしゃいん',         'karyawan',                    '名詞',  'Profesi paling umum di Jepang', 3, 32),
    ('銀行員',              'ぎんこういん',         'pegawai bank',                NULL,    NULL, 3, 33),
    ('医者',                'いしゃ',               'dokter',                      '名詞',  'Bentuk sopannya お医者さん', 3, 34),
    ('看護師',              'かんごし',             'perawat',                     '名詞',  NULL, 3, 35),
    ('エンジニア',          'エンジニア',           'engineer',                    '名詞',  NULL, 3, 36),
    ('仕事',                'しごと',               'pekerjaan',                   NULL,    NULL, 3, 37),
    ('会社',                'かいしゃ',             'perusahaan',                  NULL,    NULL, 3, 38),
    ('大学',                'だいがく',             'universitas',                 '名詞',  NULL, 3, 39),
    ('高校',                'こうこう',             'SMA',                         NULL,    'Singkatan dari 高等学校', 3, 40),
    ('家族',                'かぞく',               'keluarga',                    '名詞',  'Keluarga inti', 3, 41),
    ('父',                  'ちち',                 'ayah saya',                   '名詞',  'Untuk ayah orang lain pakai お父さん', 3, 42),
    ('母',                  'はは',                 'ibu saya',                    NULL,    'Untuk ibu orang lain pakai お母さん', 3, 43),
    ('兄',                  'あに',                 'kakak laki saya',             '名詞',  'Untuk kakak orang lain pakai お兄さん', 3, 44),
    ('姉',                  'あね',                 'kakak perempuan saya',        '名詞',  'Untuk kakak orang lain pakai お姉さん', 3, 45),
    ('弟',                  'おとうと',             'adik laki saya',              '名詞',  'Untuk adik orang lain pakai 弟さん', 3, 46);

  -- bank (lesson_id NULL), skip kalau japanese sudah ada di modul
  INSERT INTO module_vocabulary (module_id, lesson_id, japanese, reading, indonesian, category, note, sort_order)
  SELECT v_module, NULL, t.japanese, t.reading, t.indonesian, t.category, t.note, t.so
  FROM _b3_vocab t
  WHERE NOT EXISTS (
    SELECT 1 FROM module_vocabulary mv WHERE mv.module_id = v_module AND mv.japanese = t.japanese
  );

  -- wiring ke deck Kosakata sesuai siklus
  INSERT INTO lesson_deck_items (lesson_id, vocabulary_id, sort_order)
  SELECT CASE t.cycle WHEN 1 THEN v_ko1 WHEN 2 THEN v_ko2 WHEN 3 THEN v_ko3 END, mv.id, t.so
  FROM _b3_vocab t
  JOIN module_vocabulary mv ON mv.module_id = v_module AND mv.japanese = t.japanese
  WHERE CASE t.cycle WHEN 1 THEN v_ko1 WHEN 2 THEN v_ko2 WHEN 3 THEN v_ko3 END IS NOT NULL
  ON CONFLICT (lesson_id, vocabulary_id) DO NOTHING;

  -- ── 6) Kanji (9) → Kanji 1/2/3 sesuai siklus ──
  INSERT INTO kanji_items
    (lesson_id, character, jlpt_level, on_reading, kun_reading, meaning_id, mnemonic, compounds, stroke_count, bab_kode, sort_order)
  SELECT CASE k.cycle WHEN 1 THEN v_ka1 WHEN 2 THEN v_ka2 WHEN 3 THEN v_ka3 END,
         k.character, 'N5', k.on_reading, k.kun_reading, k.meaning_id, k.mnemonic, k.compounds::jsonb, k.stroke_count, 'B3', k.so
  FROM (VALUES
    -- Siklus 1
    ('人', 'ジン、ニン', 'ひと', 'orang',
      'Sosok orang dengan dua kaki menopang badan — orang berdiri tegak.',
      '[{"japanese":"日本人","reading":"にほんじん","indonesian":"orang Jepang"},{"japanese":"一人","reading":"ひとり","indonesian":"satu orang / sendirian"},{"japanese":"三人","reading":"さんにん","indonesian":"tiga orang"}]', 2, 1, 1),
    ('名', 'メイ、ミョウ', 'な', 'nama',
      'Sore hari (夕) ibu memanggil nama anak lewat mulut (口).',
      '[{"japanese":"名前","reading":"なまえ","indonesian":"nama"},{"japanese":"人名","reading":"じんめい","indonesian":"nama orang"},{"japanese":"国名","reading":"こくめい","indonesian":"nama negara"}]', 6, 1, 2),
    -- Siklus 2
    ('何', 'カ', 'なに、なん', 'apa',
      'Orang (亻) bertanya "apa yang bisa (可) dilakukan?".',
      '[{"japanese":"何","reading":"なに","indonesian":"apa"},{"japanese":"何時","reading":"なんじ","indonesian":"jam berapa"},{"japanese":"何人","reading":"なんにん","indonesian":"berapa orang"}]', 7, 2, 1),
    ('国', 'コク', 'くに', 'negara',
      NULL, '[]', 8, 2, 2),
    ('語', 'ゴ', 'かた(る)', 'bahasa',
      NULL, '[]', 14, 2, 3),
    -- Siklus 3
    ('学', 'ガク', 'まな(ぶ)', 'belajar',
      'Anak (子) di bawah atap sedang belajar.',
      '[{"japanese":"学生","reading":"がくせい","indonesian":"siswa"},{"japanese":"大学","reading":"だいがく","indonesian":"universitas"},{"japanese":"学校","reading":"がっこう","indonesian":"sekolah"}]', 8, 3, 1),
    ('校', 'コウ', NULL, 'sekolah',
      'Bangunan kayu (木) tempat siswa berkumpul/bersilang (交).',
      '[{"japanese":"学校","reading":"がっこう","indonesian":"sekolah"},{"japanese":"高校","reading":"こうこう","indonesian":"SMA"},{"japanese":"校長","reading":"こうちょう","indonesian":"kepala sekolah"}]', 10, 3, 2),
    ('先', 'セン', 'さき', 'sebelumnya, lebih dahulu',
      'Senior berjalan lebih dulu dengan kaki (儿) — di depan.',
      '[{"japanese":"先生","reading":"せんせい","indonesian":"guru"},{"japanese":"先週","reading":"せんしゅう","indonesian":"minggu lalu"},{"japanese":"先月","reading":"せんげつ","indonesian":"bulan lalu"}]', 6, 3, 3),
    ('生', 'セイ、ショウ', 'い(きる)、う(まれる)、なま', 'hidup, lahir',
      NULL, '[]', 5, 3, 4)
  ) AS k(character, on_reading, kun_reading, meaning_id, mnemonic, compounds, stroke_count, cycle, so)
  WHERE CASE k.cycle WHEN 1 THEN v_ka1 WHEN 2 THEN v_ka2 WHEN 3 THEN v_ka3 END IS NOT NULL
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

  RAISE NOTICE 'N5-B3: metadata + 6 grammar + 46 vocab (3 deck) + 9 kanji (3 lesson) selesai.';
END $$;
