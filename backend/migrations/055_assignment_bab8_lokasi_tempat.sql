-- 055_assignment_bab8_lokasi_tempat.sql — Assignment Bab 8: Lokasi & Tempat.
--
-- Ujian bab untuk Bab 8, sumber Notion N5-B8 "Lokasi & Tempat". Modul
-- di-resolve ordinal (OFFSET 7, lanjutan pola 039-053).
--
-- PERUBAHAN KEBIJAKAN (assignment BARU mulai Bab 8, permintaan eksplisit
-- user): questions_per_attempt = 50 (SEMUA soal ditampilkan tiap attempt,
-- BUKAN sampling 30 dari 50 seperti 039-053). Assignment Bab 1-7 yang
-- sudah live TIDAK diubah — kebijakan ini cuma berlaku untuk assignment
-- baru ke depan. Backend sudah native mendukung ini: sampleQuestionIds()
-- di progress.js otomatis mengembalikan SEMUA soal (tetap di-shuffle
-- urutannya) kalau questionsPerAttempt >= pool size.
--
-- PERUBAHAN PAGAR BESAR: Bab 8 memperkenalkan あります／います (kata kerja
-- eksistensi) dan partikel に／が untuk PERTAMA KALINYA di assignment kuis
-- manapun — keduanya dilarang total di 039-053 (existence verb "baru
-- diajarkan di Bab 8" disebut eksplisit di komentar 047/051/053). Migrasi
-- ini merevisi 2 pagar:
--   1. Partikel: whitelist diperluas dari は/も/の/か/ね/よ/から/まで
--      menjadi + に + が (pola sama dengan penambahan から/まで di Bab 5).
--      を/で/へ/と TETAP dilarang (belum diajarkan).
--   2. Kata kerja: SEBELUMNYA blanket-ban semua kata kerja. SEKARANG
--      strip dulu SEMUA bentuk konjugasi あります／います (afirmatif/
--      negatif/lampau: あります・ありません・ありました・ありませんでした・
--      います・いません・いました・いませんでした) sebagai frasa aman —
--      persis teknik yang sudah dipakai untuk そうじゃありません dkk sejak
--      042 — SEBELUM cek existence kata kerja lain. Kata kerja LAIN
--      (たべます／いきます／みます dst) tetap tertangkap karena substring
--      "ます" masih ada setelah strip (diverifikasi: あります/imasu-forms
--      di-strip duluan, jadi tidak ada residu yang salah lolos).
--
-- 9 kanji resmi Bab 8 (下前外間右中左後上, dikonfirmasi dari kanji_items
-- production DAN Notion Kanji DB) ditambahkan ke whitelist kanji badan
-- kalimat, union dengan 40 kanji taught Bab3-7 + 13 counter Bab5.
--
-- REF_CHECK bacaan (sumber kebenaran tunggal):
--   下＝した   前＝まえ   外＝そと   人間＝にんげん   右＝みぎ
--   中＝なか   左＝ひだり   後ろ＝うしろ   上＝うえ
--   九時間＝くじかん (TIDAK BERATURAN — 九 dibaca く sebelum じ-counter,
--     pola sama persis dengan 九時＝くじ dari 047)
-- Kombinasi lain (前後/上下/左右/中間/時間/外国/中学生/午前中) semua bacaan
-- onyomi beraturan, tidak perlu REF_CHECK.
--
-- DEDUP WAJIB (pola established sejak 047): tidak boleh menguji ulang
-- target <u> yang sudah dipakai di 042/045/047/051/053 — 60 target unik,
-- di-grep ulang dari file migrasi sungguhan.
--
-- Komposisi: もんだい1 漢字読み 9 + もんだい2 表記 9 + もんだい3 文脈規定 12
-- + もんだい1 文の文法1 20 = 50 soal, SEMUA ditampilkan tiap attempt
-- (bukan sampling), lulus 70% (35/50), cooldown 12 jam.
--
-- PERINGATAN RE-RUN: DELETE FROM quiz_questions di bawah tanpa syarat —
-- kalau admin sudah menambah soal manual/AI ke pelajaran ini, re-run
-- migrasi ini manual akan menghapusnya. Runner (migrations/run.js) cuma
-- menjalankan file ini SEKALI per DB (tercatat di schema_migrations).
--
-- Idempotent: lesson di-upsert per (module_id, slug), soal lama dihapus
-- lalu di-insert ulang; no-op aman kalau modul target belum ada.

DO $$
DECLARE
  v_course_slug  TEXT := 'n5';
  v_lesson_slug  TEXT := 'assignment-bab-8-lokasi-tempat';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson_id    UUID;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 7 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '055: modul Bab 8 di kursus % tidak ditemukan — skip seed assignment.', v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* '(lokasi|tempat|posisi|location)' THEN
    RAISE NOTICE '055: modul Bab 8 terbaca "%" — kalau ternyata bukan Bab Lokasi & Tempat, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).', v_module_title;
  END IF;

  RAISE NOTICE '055: seed Assignment Bab 8 ke modul "%".', v_module_title;

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, questions_per_attempt, cooldown_hours
  ) VALUES (
    v_module_id, v_lesson_slug, 'Assignment Bab 8 — Lokasi & Tempat', 'quiz',
    'Tes materi Bab 8 (Lokasi & Tempat) gaya JLPT. Moji-Goi: cara baca 9 kanji baru (下／前／外／間／右／中／左／後ろ／上) dan kombinasinya, cara menulisnya, serta kosakata posisi/arah sesuai konteks. Tata Bahasa: 〜に〜があります／います (menyatakan keberadaan), どこに〜がありますか (menanyakan lokasi), 〜は〜にあります／います (topik dulu), dan posisi relatif [kata benda]の[posisi]. Semua 50 soal ditampilkan tiap attempt. Lulus 70% (35/50), cooldown 12 jam.',
    30, 100, 70, 50, 12
  )
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    type = EXCLUDED.type,
    content = EXCLUDED.content,
    duration_minutes = EXCLUDED.duration_minutes,
    passing_score_pct = EXCLUDED.passing_score_pct,
    questions_per_attempt = EXCLUDED.questions_per_attempt,
    cooldown_hours = EXCLUDED.cooldown_hours,
    updated_at = NOW()
  RETURNING id INTO v_lesson_id;

  DELETE FROM quiz_questions WHERE lesson_id = v_lesson_id;

  WITH sect(cat, num, label, instruction) AS (VALUES
    ('vocabulary'::TEXT, 1, 'もんだい1 漢字読み',
        'Bagaimana cara membaca kata yang bergaris bawah? Pilih satu jawaban yang paling tepat dari nomor 1-4.'),
    ('vocabulary', 2, 'もんだい2 表記',
        'Kata yang bergaris bawah ditulis dengan huruf apa? Pilih satu jawaban yang paling tepat dari nomor 1-4.'),
    ('vocabulary', 3, 'もんだい3 文脈規定',
        'Kata apa yang paling tepat untuk mengisi （　）? Pilih satu jawaban dari nomor 1-4.'),
    ('grammar', 1, 'もんだい1 文の文法1',
        'Kata atau partikel apa yang paling tepat untuk mengisi （　）? Pilih satu jawaban dari nomor 1-4.')
  ), q(no, cat, sect_num, question, explanation) AS (VALUES
    -- ===== もんだい1 漢字読み (1-9) — 9 kanji inti Bab 8 =====
    (1, 'vocabulary'::TEXT, 1, 'ほんは つくえの <u>下</u>に あります。',
        '下 dibaca した (bawah). した adalah bacaan kunyomi dasar, beda dari onyomi カ／ゲ yang dipakai di kata gabungan seperti 地下 (ちか).'),
    (2, 'vocabulary', 1, 'がっこうの <u>前</u>に こうえんが あります。',
        '前 dibaca まえ (depan). まえ adalah bacaan kunyomi dasar untuk posisi, beda dari onyomi ゼン yang dipakai di kata gabungan seperti 午前 (ごぜん).'),
    (3, 'vocabulary', 1, 'いえの <u>外</u>に いぬが います。',
        '外 dibaca そと (luar). そと adalah bacaan kunyomi dasar, beda dari onyomi ガイ yang dipakai di kata gabungan seperti 外国 (がいこく).'),
    (4, 'vocabulary', 1, '<u>人間</u>は とても おもしろいです。',
        '人間 dibaca にんげん (manusia). 人 dibaca ニン dan 間 dibaca ゲン (onyomi keduanya) saat digabung di kata ini.'),
    (5, 'vocabulary', 1, 'わたしの <u>右</u>に せんせいが います。',
        '右 dibaca みぎ (kanan). みぎ adalah bacaan kunyomi dasar untuk posisi, beda dari onyomi ウ／ユウ yang dipakai di kata gabungan.'),
    (6, 'vocabulary', 1, 'はこの <u>中</u>に おかねが あります。',
        '中 dibaca なか (dalam). なか adalah bacaan kunyomi dasar, beda dari onyomi チュウ yang dipakai di kata gabungan seperti 中学生 (ちゅうがくせい).'),
    (7, 'vocabulary', 1, 'わたしの <u>左</u>に がくせいが います。',
        '左 dibaca ひだり (kiri). ひだり adalah bacaan kunyomi dasar untuk posisi, beda dari onyomi サ yang dipakai di kata gabungan.'),
    (8, 'vocabulary', 1, 'いすの <u>後ろ</u>に ねこが います。',
        '後ろ dibaca うしろ (belakang). うしろ dipakai untuk posisi ruang, beda dari あと yang lebih sering dipakai untuk urutan waktu ("setelah").'),
    (9, 'vocabulary', 1, 'つくえの <u>上</u>に ほんが あります。',
        '上 dibaca うえ (atas). うえ adalah bacaan kunyomi dasar untuk posisi, beda dari onyomi ジョウ yang dipakai di kata gabungan seperti 午前中 (ごぜんちゅう).'),

    -- ===== もんだい2 表記 (10-18) — target hiragana, jawaban bentuk tulisan =====
    (10, 'vocabulary', 2, 'がくせいは ひゃくにん <u>ぜんご</u>です。',
        'ぜんご ditulis 前後 (kira-kira/sekitar, dipakai setelah angka). Salah: 上下 (じょうげ, atas-bawah), 左右 (さゆう, kiri-kanan), 中間 (ちゅうかん, tengah/interim) — semuanya kombinasi posisi lain.'),
    (11, 'vocabulary', 2, 'きかいには <u>じょうげ</u>の ボタンが あります。',
        'じょうげ ditulis 上下 (atas-bawah). Salah: 前後 (ぜんご, depan-belakang/kira-kira), 左右 (さゆう, kiri-kanan), 中間 (ちゅうかん, tengah).'),
    (12, 'vocabulary', 2, 'この どうろは <u>さゆう</u>に みせが あります。',
        'さゆう ditulis 左右 (kiri-kanan). Salah: 上下 (じょうげ, atas-bawah), 前後 (ぜんご, depan-belakang), 中間 (ちゅうかん, tengah).'),
    (13, 'vocabulary', 2, 'がっこうの <u>ちゅうかん</u>テストは あしたです。',
        'ちゅうかん ditulis 中間 (tengah, dipakai di 中間テスト＝ujian tengah semester). Salah: 上下 (じょうげ), 左右 (さゆう), 前後 (ぜんご) — semuanya kombinasi posisi lain.'),
    (14, 'vocabulary', 2, 'いま <u>じかん</u>が ありますか。',
        'じかん ditulis 時間 (waktu/jam). Salah: 九時間 (くじかん, sudah ada angka), 人間 (にんげん, manusia, bunyi mirip tapi beda arti total), 中間 (ちゅうかん, tengah).'),
    (15, 'vocabulary', 2, 'わたしは いま <u>がいこく</u>に います。',
        'がいこく ditulis 外国 (luar negeri/negara asing). Salah: 中国 (ちゅうごく, nama negara tertentu, bunyi mirip), 外人 (がいじん, bentuk kurang sopan), 外国人 (がいこくじん, kelebihan kanji 人).'),
    (16, 'vocabulary', 2, 'あには <u>ちゅうがくせい</u>です。',
        'ちゅうがくせい ditulis 中学生 (siswa SMP). Salah: 大学生 (だいがくせい, mahasiswa), 高校生 (こうこうせい, siswa SMA), 中学校 (ちゅうがっこう, kelebihan/kekurangan kanji 生).'),
    (17, 'vocabulary', 2, 'いまは <u>ごぜんちゅう</u>です。',
        'ごぜんちゅう ditulis 午前中 (sepanjang pagi). Salah: 午後中 (kombinasi tidak lazim), 午前後 (urutan kanji salah), 五前中 (五 bukan kanji yang benar untuk ご di sini).'),
    (18, 'vocabulary', 2, 'とうきょうまでは <u>くじかん</u>です。',
        'くじかん ditulis 九時間 (sembilan jam) — bacaan TIDAK beraturan, 九 dibaca く (bukan きゅう) sebelum 時間, pola sama dengan 九時＝くじ. Salah: 九日間 (く jika salah kanji 日=hari), 九人間 (bukan kata yang lazim), 九時 (kurang kanji 間).'),

    -- ===== もんだい3 文脈規定 (19-30) — kosakata posisi/arah, 100% kana =====
    (19, 'vocabulary', 3, 'うえの はんたいは（　）です。',
        'Jawabannya した (bawah), kebalikan dari うえ (atas). みぎ, なか, まえ tidak berkaitan dengan lawan kata うえ.'),
    (20, 'vocabulary', 3, 'みぎの はんたいは（　）です。',
        'Jawabannya ひだり (kiri), kebalikan dari みぎ (kanan). した, なか, うしろ tidak berkaitan dengan lawan kata みぎ.'),
    (21, 'vocabulary', 3, 'なかの はんたいは（　）です。',
        'Jawabannya そと (luar), kebalikan dari なか (dalam). した, みぎ, まえ tidak berkaitan dengan lawan kata なか.'),
    (22, 'vocabulary', 3, 'まえの はんたいは（　）です。',
        'Jawabannya うしろ (belakang), kebalikan dari まえ (depan). した, そと, ひだり tidak berkaitan dengan lawan kata まえ.'),
    (23, 'vocabulary', 3, 'きたの はんたいは（　）です。',
        'Jawabannya みなみ (selatan), kebalikan dari きた (utara). ひがし, にし bukan lawan kata きた (keduanya arah lain).'),
    (24, 'vocabulary', 3, 'ひがしの はんたいは（　）です。',
        'Jawabannya にし (barat), kebalikan dari ひがし (timur). きた, みなみ bukan lawan kata ひがし (keduanya arah lain).'),
    (25, 'vocabulary', 3, 'いえは えきの（　）に あります。',
        'Jawabannya ちかく (dekat). となり berarti sebelah persis, よこ berarti samping, なか berarti dalam — ketiganya kurang tepat untuk "dekat stasiun" secara umum.'),
    (26, 'vocabulary', 3, 'がっこうは えきの（　）に あります。',
        'Jawabannya となり (sebelah persis, bersebelahan). ちかく berarti dekat (tapi tidak harus bersebelahan), よこ berarti samping, なか berarti dalam.'),
    (27, 'vocabulary', 3, 'びょういんは えきの（　）に あります。',
        'Jawabannya よこ (samping). となり berarti sebelah persis, ちかく berarti dekat secara umum, なか berarti dalam — nuansanya beda dari よこ.'),
    (28, 'vocabulary', 3, 'わたしは いま（　）に いますか。「がっこうです。」',
        'Jawabannya どこ (di mana), dijawab dengan がっこうです yang menyebut tempat. なに menanyakan benda, だれ menanyakan orang, いつ menanyakan waktu — ketiganya tidak cocok untuk menanyakan tempat.'),
    (29, 'vocabulary', 3, 'としょかんは（　）に ありますか。「えきの まえです。」',
        'Jawabannya どこ, dijawab dengan lokasi えきの まえです. なに, だれ, いつ tidak cocok untuk menanyakan tempat.'),
    (30, 'vocabulary', 3, 'としょかんは あそこです。びょういんも（　）です。',
        'Jawabannya あそこ (di sana), karena びょういん ada di tempat yang sama dengan としょかん yang sudah disebut あそこ. ここ berarti di sini, そこ berarti di situ, どこ menanyakan tempat — ketiganya tidak cocok untuk menegaskan tempat yang sama seperti kalimat sebelumnya.'),

    -- ===== もんだい1 文の文法1 (31-50) — 4 pola grammar Bab 8 =====
    (31, 'grammar'::TEXT, 1, 'つくえの うえに ほんが（　）。',
        'Jawabannya あります — ほん (buku) adalah benda mati, jadi pakai あります bukan います. います dipakai untuk makhluk hidup, でした dan ました mengubah jadi bentuk lampau (tidak sesuai konteks kini).'),
    (32, 'grammar', 1, 'こうえんに ねこが（　）。',
        'Jawabannya います — ねこ (kucing) adalah makhluk hidup, jadi pakai います bukan あります. あります dipakai untuk benda mati, でした dan ました mengubah jadi bentuk lampau.'),
    (33, 'grammar', 1, 'きょうしつに がくせいが（　）。',
        'Jawabannya います — がくせい (siswa) adalah orang/makhluk hidup. あります dipakai untuk benda mati, でした dan ました mengubah jadi bentuk lampau.'),
    (34, 'grammar', 1, 'はこの なかに おかねが（　）。',
        'Jawabannya あります — おかね (uang) adalah benda mati. います dipakai untuk makhluk hidup, でした dan ました mengubah jadi bentuk lampau.'),
    (35, 'grammar', 1, 'にわに いぬが（　）。',
        'Jawabannya います — いぬ (anjing) adalah makhluk hidup. あります dipakai untuk benda mati, でした dan ました mengubah jadi bentuk lampau.'),
    (36, 'grammar', 1, 'すみません、としょかんは（　）に ありますか。',
        'Jawabannya どこ (di mana), menanyakan lokasi. なに menanyakan benda, だれ menanyakan orang, いつ menanyakan waktu — ketiganya tidak cocok untuk menanyakan tempat.'),
    (37, 'grammar', 1, 'トイレは どこに（　）か。',
        'Jawabannya あります — トイレ (toilet) adalah benda/tempat, bukan makhluk hidup. います dipakai untuk makhluk hidup, でした dan ました mengubah jadi bentuk lampau (tidak sesuai konteks tanya kini).'),
    (38, 'grammar', 1, 'こうえんは どこに（　）か。',
        'Jawabannya あります — こうえん (taman) adalah tempat, bukan makhluk hidup. います dipakai untuk makhluk hidup, でした dan ました mengubah jadi bentuk lampau.'),
    (39, 'grammar', 1, 'せんせいは どこに（　）か。',
        'Jawabannya います — せんせい (guru) adalah orang. あります dipakai untuk benda mati, でした dan ました mengubah jadi bentuk lampau.'),
    (40, 'grammar', 1, 'ねこは どこに（　）か。',
        'Jawabannya います — ねこ (kucing) adalah makhluk hidup. あります dipakai untuk benda mati, でした dan ました mengubah jadi bentuk lampau.'),
    (41, 'grammar', 1, 'ほんは つくえの うえ（　）あります。',
        'Jawabannya に, menandai lokasi tempat ほん berada. は menandai topik (sudah dipakai di depan kalimat), も berarti "juga", の menyatakan kepemilikan — ketiganya tidak cocok menandai lokasi.'),
    (42, 'grammar', 1, 'ねこは にわ（　）います。',
        'Jawabannya に, menandai lokasi. は, も, dan の tidak cocok menandai lokasi.'),
    (43, 'grammar', 1, 'がくせいは きょうしつ（　）います。',
        'Jawabannya に. は, も, dan の tidak cocok menandai lokasi.'),
    (44, 'grammar', 1, 'おかねは はこの なか（　）あります。',
        'Jawabannya に. は, も, dan の tidak cocok menandai lokasi.'),
    (45, 'grammar', 1, 'いぬは にわ（　）います。',
        'Jawabannya に. は, も, dan の tidak cocok menandai lokasi.'),
    (46, 'grammar', 1, 'ほんは つくえ（　）うえに あります。',
        'Jawabannya の, menyambung kata benda つくえ dengan kata posisi うえ (atas). に sudah dipakai setelah うえ, は dan も tidak dipakai untuk menyambung kata benda dengan posisi.'),
    (47, 'grammar', 1, 'ねこは いす（　）したに います。',
        'Jawabannya の, menyambung いす dengan した. に, は, も tidak cocok di posisi ini.'),
    (48, 'grammar', 1, 'がっこうは えき（　）まえに あります。',
        'Jawabannya の, menyambung えき dengan まえ. に, は, も tidak cocok di posisi ini.'),
    (49, 'grammar', 1, 'コンビニは がっこう（　）となりに あります。',
        'Jawabannya の, menyambung がっこう dengan となり. に, は, も tidak cocok di posisi ini.'),
    (50, 'grammar', 1, 'びょういんは こうえん（　）よこに あります。',
        'Jawabannya の, menyambung こうえん dengan よこ. に, は, も tidak cocok di posisi ini.')
  )
  INSERT INTO quiz_questions (
    lesson_id, question, question_type, question_category,
    section_number, section_label, section_instruction, explanation, sort_order
  )
  SELECT v_lesson_id, q.question, 'multiple_choice', q.cat,
         s.num, s.label, s.instruction, q.explanation, q.no
    FROM q JOIN sect s ON s.cat = q.cat AND s.num = q.sect_num;

  -- Opsi: baris pertama tiap soal = jawaban benar; urutan tampil diacak
  -- frontend tiap attempt (transformQuestionFromApi).
  WITH o(qno, ord, option_text, ok) AS (VALUES
    -- 漢字読み — opsi hiragana murni
    (1, 0, 'した', TRUE),   (1, 1, 'か', FALSE),     (1, 2, 'げ', FALSE),     (1, 3, 'しだ', FALSE),
    (2, 0, 'まえ', TRUE),   (2, 1, 'ぜん', FALSE),   (2, 2, 'まい', FALSE),   (2, 3, 'めえ', FALSE),
    (3, 0, 'そと', TRUE),   (3, 1, 'がい', FALSE),   (3, 2, 'ほか', FALSE),   (3, 3, 'そど', FALSE),
    (4, 0, 'にんげん', TRUE), (4, 1, 'ひとあいだ', FALSE), (4, 2, 'じんかん', FALSE), (4, 3, 'にんかん', FALSE),
    (5, 0, 'みぎ', TRUE),   (5, 1, 'う', FALSE),     (5, 2, 'ゆう', FALSE),   (5, 3, 'みき', FALSE),
    (6, 0, 'なか', TRUE),   (6, 1, 'ちゅう', FALSE), (6, 2, 'うち', FALSE),   (6, 3, 'なが', FALSE),
    (7, 0, 'ひだり', TRUE), (7, 1, 'さ', FALSE),     (7, 2, 'ひたり', FALSE), (7, 3, 'させ', FALSE),
    (8, 0, 'うしろ', TRUE), (8, 1, 'あと', FALSE),   (8, 2, 'ご', FALSE),     (8, 3, 'こう', FALSE),
    (9, 0, 'うえ', TRUE),   (9, 1, 'じょう', FALSE), (9, 2, 'しょう', FALSE), (9, 3, 'うい', FALSE),

    -- 表記 — opsi bentuk tulisan
    (10, 0, '前後', TRUE), (10, 1, '上下', FALSE), (10, 2, '左右', FALSE), (10, 3, '中間', FALSE),
    (11, 0, '上下', TRUE), (11, 1, '前後', FALSE), (11, 2, '左右', FALSE), (11, 3, '中間', FALSE),
    (12, 0, '左右', TRUE), (12, 1, '上下', FALSE), (12, 2, '前後', FALSE), (12, 3, '中間', FALSE),
    (13, 0, '中間', TRUE), (13, 1, '上下', FALSE), (13, 2, '左右', FALSE), (13, 3, '前後', FALSE),
    (14, 0, '時間', TRUE), (14, 1, '九時間', FALSE), (14, 2, '人間', FALSE), (14, 3, '中間', FALSE),
    (15, 0, '外国', TRUE), (15, 1, '中国', FALSE), (15, 2, '外人', FALSE), (15, 3, '外国人', FALSE),
    (16, 0, '中学生', TRUE), (16, 1, '大学生', FALSE), (16, 2, '高校生', FALSE), (16, 3, '中学校', FALSE),
    (17, 0, '午前中', TRUE), (17, 1, '午後中', FALSE), (17, 2, '午前後', FALSE), (17, 3, '五前中', FALSE),
    (18, 0, '九時間', TRUE), (18, 1, '九日間', FALSE), (18, 2, '九人間', FALSE), (18, 3, '九時', FALSE),

    -- 文脈規定
    (19, 0, 'した', TRUE),   (19, 1, 'みぎ', FALSE),   (19, 2, 'なか', FALSE),   (19, 3, 'まえ', FALSE),
    (20, 0, 'ひだり', TRUE), (20, 1, 'した', FALSE),   (20, 2, 'なか', FALSE),   (20, 3, 'うしろ', FALSE),
    (21, 0, 'そと', TRUE),   (21, 1, 'した', FALSE),   (21, 2, 'みぎ', FALSE),   (21, 3, 'まえ', FALSE),
    (22, 0, 'うしろ', TRUE), (22, 1, 'した', FALSE),   (22, 2, 'そと', FALSE),   (22, 3, 'ひだり', FALSE),
    (23, 0, 'みなみ', TRUE), (23, 1, 'ひがし', FALSE), (23, 2, 'にし', FALSE),   (23, 3, 'した', FALSE),
    (24, 0, 'にし', TRUE),   (24, 1, 'きた', FALSE),   (24, 2, 'みなみ', FALSE), (24, 3, 'うえ', FALSE),
    (25, 0, 'ちかく', TRUE), (25, 1, 'となり', FALSE), (25, 2, 'よこ', FALSE),   (25, 3, 'なか', FALSE),
    (26, 0, 'となり', TRUE), (26, 1, 'ちかく', FALSE), (26, 2, 'よこ', FALSE),   (26, 3, 'なか', FALSE),
    (27, 0, 'よこ', TRUE),   (27, 1, 'となり', FALSE), (27, 2, 'ちかく', FALSE), (27, 3, 'なか', FALSE),
    (28, 0, 'どこ', TRUE),   (28, 1, 'なに', FALSE),   (28, 2, 'だれ', FALSE),   (28, 3, 'いつ', FALSE),
    (29, 0, 'どこ', TRUE),   (29, 1, 'なに', FALSE),   (29, 2, 'だれ', FALSE),   (29, 3, 'いつ', FALSE),
    (30, 0, 'あそこ', TRUE), (30, 1, 'ここ', FALSE),   (30, 2, 'そこ', FALSE),   (30, 3, 'どこ', FALSE),

    -- 文の文法1
    (31, 0, 'あります', TRUE), (31, 1, 'います', FALSE), (31, 2, 'でした', FALSE), (31, 3, 'ました', FALSE),
    (32, 0, 'います', TRUE), (32, 1, 'あります', FALSE), (32, 2, 'でした', FALSE), (32, 3, 'ました', FALSE),
    (33, 0, 'います', TRUE), (33, 1, 'あります', FALSE), (33, 2, 'でした', FALSE), (33, 3, 'ました', FALSE),
    (34, 0, 'あります', TRUE), (34, 1, 'います', FALSE), (34, 2, 'でした', FALSE), (34, 3, 'ました', FALSE),
    (35, 0, 'います', TRUE), (35, 1, 'あります', FALSE), (35, 2, 'でした', FALSE), (35, 3, 'ました', FALSE),
    (36, 0, 'どこ', TRUE), (36, 1, 'なに', FALSE), (36, 2, 'だれ', FALSE), (36, 3, 'いつ', FALSE),
    (37, 0, 'あります', TRUE), (37, 1, 'います', FALSE), (37, 2, 'でした', FALSE), (37, 3, 'ました', FALSE),
    (38, 0, 'あります', TRUE), (38, 1, 'います', FALSE), (38, 2, 'でした', FALSE), (38, 3, 'ました', FALSE),
    (39, 0, 'います', TRUE), (39, 1, 'あります', FALSE), (39, 2, 'でした', FALSE), (39, 3, 'ました', FALSE),
    (40, 0, 'います', TRUE), (40, 1, 'あります', FALSE), (40, 2, 'でした', FALSE), (40, 3, 'ました', FALSE),
    (41, 0, 'に', TRUE), (41, 1, 'は', FALSE), (41, 2, 'も', FALSE), (41, 3, 'の', FALSE),
    (42, 0, 'に', TRUE), (42, 1, 'は', FALSE), (42, 2, 'も', FALSE), (42, 3, 'の', FALSE),
    (43, 0, 'に', TRUE), (43, 1, 'は', FALSE), (43, 2, 'も', FALSE), (43, 3, 'の', FALSE),
    (44, 0, 'に', TRUE), (44, 1, 'は', FALSE), (44, 2, 'も', FALSE), (44, 3, 'の', FALSE),
    (45, 0, 'に', TRUE), (45, 1, 'は', FALSE), (45, 2, 'も', FALSE), (45, 3, 'の', FALSE),
    (46, 0, 'の', TRUE), (46, 1, 'に', FALSE), (46, 2, 'は', FALSE), (46, 3, 'も', FALSE),
    (47, 0, 'の', TRUE), (47, 1, 'に', FALSE), (47, 2, 'は', FALSE), (47, 3, 'も', FALSE),
    (48, 0, 'の', TRUE), (48, 1, 'に', FALSE), (48, 2, 'は', FALSE), (48, 3, 'も', FALSE),
    (49, 0, 'の', TRUE), (49, 1, 'に', FALSE), (49, 2, 'は', FALSE), (49, 3, 'も', FALSE),
    (50, 0, 'の', TRUE), (50, 1, 'に', FALSE), (50, 2, 'は', FALSE), (50, 3, 'も', FALSE)
  )
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT qq.id, o.option_text, o.ok, o.ord
    FROM o
    JOIN quiz_questions qq
      ON qq.lesson_id = v_lesson_id AND qq.sort_order = o.qno;

  -- ===== Assertion bentuk =====
  IF (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id) <> 50 THEN
    RAISE EXCEPTION '055: jumlah soal bukan 50 (dapat %)',
      (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
      LEFT JOIN quiz_options qo ON qo.question_id = qq.id
     WHERE qq.lesson_id = v_lesson_id
     GROUP BY qq.id
    HAVING COUNT(qo.id) <> 4 OR COUNT(*) FILTER (WHERE qo.is_correct) <> 1
  ) THEN
    RAISE EXCEPTION '055: ada soal yang opsinya bukan 4 atau kuncinya bukan tepat 1';
  END IF;

  -- ===== Pagar level =====

  -- 1. Badan kalimat (di LUAR target <u>…</u>) hanya boleh memakai kanji
  --    taught: 9 Bab3 + 3 Bab4 + 10 Bab5 + 6 Bab6 + 3 Bab7 + 9 Bab8 +
  --    13 counter Bab5.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND regexp_replace(
             regexp_replace(question, '<u>[^<]*</u>', '', 'g'),
             '[先何語校国生学名人魚本花八三十九一五四二六七安高古新白長男女気下前外間右中左後上時分円百千万年月半歳午前後]', '', 'g'
           ) ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '055: ada kanji di luar daftar taught pada badan kalimat soal';
  END IF;

  -- 2. Partikel di luar Bab 1-8. BARU di Bab 8: に dan が (existence
  --    grammar) ditambahkan ke whitelist. を/で/へ/と TETAP dilarang.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND question ~ '(を |で |へ |と )'
  ) THEN
    RAISE EXCEPTION '055: ada partikel di luar materi Bab 1-8 pada teks soal';
  END IF;

  -- 3. Kata kerja: strip dulu SEMUA konjugasi あります／います (existence
  --    verb, BARU diizinkan mulai Bab 8) sebagai frasa aman, baru cek kata
  --    kerja LAIN yang masih dilarang. Urutan strip: paling spesifik dulu
  --    supaya tidak ada residu yang salah lolos.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
             question,
             'そうじゃありません', ''), 'じゃありません', ''),
             'ありませんでした', ''), 'いませんでした', ''),
             'ありました', ''), 'いました', ''),
             'ありません', ''), 'います', ''), 'あります', ''),
             'よろしくおねがいします', ''), 'ありがとうございます', ''), 'そうです', ''),
             'すみません', '')
           ~ '(ます|ました|ません|いる|ある|いて|べんきょう|わかり|はたら)'
  ) THEN
    RAISE EXCEPTION '055: ada indikasi kata kerja di luar あります／います pada teks soal';
  END IF;

  -- 4. Rantai の dalam satu kalimat.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '055: ada kalimat dengan rantai の (lebih dari satu の dalam satu kalimat)';
  END IF;

  -- 5. Target section: もんだい1 wajib kanji di dalam <u>, もんだい2 wajib kana.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 1
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '') !~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '055: ada soal 漢字読み yang target <u> nya tidak mengandung kanji';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 2
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '一') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '055: ada soal 表記 yang target <u> nya sudah berupa kanji';
  END IF;

  -- 6. DEDUP WAJIB — target <u> tidak boleh sama dengan salah satu dari 60
  --    target unik yang sudah dipakai di 042/045/047/051/053.
  IF EXISTS (
    SELECT 1 FROM quiz_questions qq,
      LATERAL (SELECT (regexp_match(qq.question, '<u>([^<]*)</u>'))[1] AS tgt) t
     WHERE qq.lesson_id = v_lesson_id
       AND t.tgt = ANY (ARRAY[
         'いんど','がくせい','がっこう','くに','さかな','せんせい','たい','なに',
         'はな','ひと','べとなむ','ほん','中国','何人','先生','名前','国',
         '大学生','学校','学生','日本','日本人','日本語','本','留学生','花',
         '韓国人','高校','魚',
         'ごご','ごじ','ごぜん','じゅうにじ','せんえん','なんじ','はちじ',
         'はん','まんえん','一人','一分','七分','三百円','九時','二人',
         '二十歳','八百円','六分','六百円','十分','四時',
         'きゅうひゃくえん','ごひゃくえん','さんねんせい','せんにん',
         'ななひゃくえん','なんねん','にねんせい','にひゃくえん','ひゃくにん',
         '三時','二時','六時','古い','安い','新しい','白い','長い','高い',
         '男','女','男の人','女の人','男女','人気','気分','十時','一時',
         '四人','三人','五人','六人','八人','九人','十人','四年生','五年生'
       ])
  ) THEN
    RAISE EXCEPTION '055: ada target <u> yang sudah pernah diujikan di migration 042/045/047/051/053';
  END IF;

  RAISE NOTICE '055: selesai — 50 soal (vocabulary 30, grammar 20), semua pagar level + dedup lolos.';
END $$;
