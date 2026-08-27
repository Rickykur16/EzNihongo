-- 107_assignment_bab17_suka_mahir.sql — Assignment Bab 17: Suka & Mahir.
--
-- Ujian bab untuk Bab 17, melanjutkan pola assignment Bab 1-16
-- (039/040/041/045/047/051/053/055/057/059/061/100/104/103/105/106). Modul
-- di-resolve ordinal (OFFSET 16, lanjutan pola 039-106).
--
-- JUDUL pakai TITIK DUA sejak awal (konvensi migration 079).
--
-- Kebijakan 50/50 (Bab 8+, berlaku sejak 055): questions_per_attempt = 50,
-- SEMUA soal ditampilkan tiap attempt (bukan sampling 30).
--
-- KANJI: Bab 17 memperkenalkan 9 kanji BARU — 子(こ)・父(ちち)・母(はは)・
-- 友(とも)・手(て)・足(あし)・口(くち)・目(め)・耳(みみ), keluarga & bagian
-- tubuh — dikonfirmasi header 086_bunpou_bab17.sql. 好・嫌 (suki/kirai)
-- BELUM diajarkan, jadi すき／きらい SELALU kana, tidak pernah 好き／嫌い.
-- もんだい1/2 diisi KOSAKATA POLOS 9 kanji baru (父／母／友だち／手／足／
-- 口／目／耳／子ども), gaya 105/106 — bukan konjugasi, karena kanji baru
-- bab ini semuanya KATA BENDA (keluarga/tubuh), sementara 4 pola grammar
-- Bab 17 (〜が好きです・〜が上手です・〜ができます・どんな〜) tidak
-- membutuhkan kanji baru sama sekali untuk diuji (partikel が dan kata
-- tanya どんな). Dua soal (2 dan 9) sengaja menaruh pola grammar bab ini
-- (が上手です／が好きです) di badan kalimat sebagai bonus preview, TANPA
-- memaksakannya ke semua 9 soal.
--
-- Whitelist kanji = whitelist 100/104/103/105/106 UNION 子父母友手足口目耳
-- (SAMA PERSIS dengan v_kanji_ok di 086_bunpou_bab17.sql).
--
-- PAGAR KATA KERJA: TIDAK RELEVAN (もんだい1/2 kosakata polos) — tidak ada
-- assertion kata kerja di file ini, konsisten sejak 100.
--
-- PAGAR PARTIKEL: sudah dihapus sejak 059, tidak ada di sini. (Partikel が
-- justru jadi topik utama もんだい1 文の文法1 Bab ini — lihat di bawah.)
--
-- REF_CHECK bacaan (sumber kebenaran tunggal):
--   父＝ちち   母＝はは   友だち＝ともだち   手＝て   足＝あし
--   口＝くち   目＝め   耳＝みみ   子ども＝こども
--
-- JEBAKAN PAGAR "RANTAI の": satu-satunya の di もんだい1/2 ada di
-- "わたしの" (soal ke-1/10 dan 2/11, di LUAR target <u>) — cuma SATU の
-- per kalimat, aman (sudah dicek manual, tidak ada kata/frasa ber-の
-- ganda lain di section ini).
--
-- CATATAN PROSES (lanjutan dari 106): array dedup di bawah di-grep ulang
-- PENUH dari SEMUA migrasi assignment 039-106 yang benar-benar ada di
-- repo saat ini (251 target unik, sudah bersih dari baris komentar palsu
-- — lihat catatan di 106 soal placeholder tag di komentar).
--
-- Komposisi: もんだい1 漢字読み 9 + もんだい2 表記 9 + もんだい3 文脈規定 12
-- + もんだい1 文の文法1 20 (5/5/5/5 per pola: 〜が好きです／嫌いです／
-- 〜が上手です／下手です／〜ができます／どんな〜) = 50 soal, SEMUA
-- ditampilkan tiap attempt, lulus 70% (35/50), cooldown 12 jam.
--
-- Pola 1-3 (31-45) semuanya menguji PARTIKEL が (bukan を) yang menandai
-- objek yang disukai/dikuasai/bisa dilakukan — nuansa inti Bab 17 karena
-- すき/きらい/じょうず/へた/できます semuanya berperilaku seperti kata
-- sifat な, bukan kata kerja transitif. Opsi salah seragam (を/に/で) di
-- ketiga pola supaya siswa fokus pada SATU nuansa partikel yang sama
-- berulang di konteks berbeda. Pola 4 (46-50) menguji どんな melawan kata
-- tanya lain yang mirip fungsinya (どう／なに／だれ) — cross-distractor
-- gaya 105/106.
--
-- もんだい3 文脈規定: Bab 17 BELUM punya bank kosakata resmi
-- (075_bab17_intro_kosakata_kanji.sql cuma seed kanji_items, TIDAK seed
-- module_vocabulary — deck kosakata Bab 17 masih kosong, lihat catatan
-- "Sisa pekerjaan Bab 12-20" di CLAUDE.md). 12 target di sini memakai
-- kosakata umum N5 yang tematik dengan Bab 17 (suka/mahir/hobi):
-- すき／きらい／だいすき／だいきらい／じょうず／へた／とくい／どんな
-- (8 kata inti dari catatan grammar 086) + りょうり／うた／え／おんがく
-- (4 kata hobi umum). SEMUA ditulis kana polos, tidak perlu pagar kanji
-- khusus karena tidak ada kanji sama sekali di section ini.
--
-- POSISI: sort_order 100 (akhir modul), sama seperti 039-106.
--
-- PERINGATAN RE-RUN: DELETE FROM quiz_questions di bawah tanpa syarat —
-- kalau admin sudah menambah soal manual/AI ke pelajaran ini, re-run
-- migrasi ini manual akan menghapusnya. Runner (migrations/run.js) cuma
-- menjalankan file ini SEKALI per DB.
--
-- Idempotent: lesson di-upsert per (module_id, slug), soal lama dihapus
-- lalu di-insert ulang; no-op aman kalau modul target belum ada.

DO $$
DECLARE
  v_course_slug  TEXT := 'n5';
  v_bab_no       INT  := 17;
  v_title_re     TEXT := '(suka|mahir|hobi)';
  v_lesson_slug  TEXT := 'assignment-bab-17-suka-mahir';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson_id    UUID;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET (v_bab_no - 1) LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '107: modul Bab % di kursus % tidak ditemukan — skip seed assignment.', v_bab_no, v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* v_title_re THEN
    RAISE NOTICE '107: modul Bab % terbaca "%" — kalau ternyata bukan bab yang dimaksud, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).',
      v_bab_no, v_module_title;
  END IF;

  RAISE NOTICE '107: seed Assignment Bab % ke modul "%".', v_bab_no, v_module_title;

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, questions_per_attempt, cooldown_hours
  ) VALUES (
    v_module_id, v_lesson_slug, 'Assignment Bab 17: Suka & Mahir', 'quiz',
    'Tes materi Bab 17 (Suka & Mahir) gaya JLPT. Moji-Goi: cara baca dan menulis 9 kanji baru (子・父・母・友・手・足・口・目・耳) sebagai kosakata keluarga & tubuh, serta kosakata suka/mahir/hobi (すき・きらい・だいすき・じょうず・へた・とくい dst). Tata Bahasa: partikel 〜が好きです／嫌いです (suka/tidak suka), 〜が上手です／下手です (mahir/tidak mahir), 〜ができます (kemampuan) — semuanya memakai partikel が, bukan を — dan kata tanya どんな〜 (jenis/macam apa). Semua 50 soal ditampilkan tiap attempt. Lulus 70% (35/50), cooldown 12 jam.',
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
    -- ===== もんだい1 漢字読み (1-9) — 9 kanji baru (子/父/母/友/手/足/口/目/耳) =====
    (1, 'vocabulary'::TEXT, 1, 'わたしの <u>父</u>は 先生です。',
        '父 dibaca ちち. Kanji baru Bab 17 untuk "ayah" (dipakai untuk keluarga sendiri).'),
    (2, 'vocabulary', 1, 'わたしの <u>母</u>は りょうりが 上手です。',
        '母 dibaca はは. Kanji baru Bab 17 untuk "ibu" (dipakai untuk keluarga sendiri).'),
    (3, 'vocabulary', 1, '<u>友だち</u>と 話します。',
        '友だち dibaca ともだち. 友 kanji baru Bab 17 untuk "teman".'),
    (4, 'vocabulary', 1, '<u>手</u>で 書きます。',
        '手 dibaca て. Kanji baru Bab 17 untuk "tangan".'),
    (5, 'vocabulary', 1, '<u>足</u>が いたいです。',
        '足 dibaca あし. Kanji baru Bab 17 untuk "kaki".'),
    (6, 'vocabulary', 1, '<u>口</u>を あけます。',
        '口 dibaca くち. Kanji baru Bab 17 untuk "mulut".'),
    (7, 'vocabulary', 1, '<u>目</u>が わるいです。',
        '目 dibaca め. Kanji baru Bab 17 untuk "mata".'),
    (8, 'vocabulary', 1, '<u>耳</u>が いいです。',
        '耳 dibaca みみ. Kanji baru Bab 17 untuk "telinga".'),
    (9, 'vocabulary', 1, '<u>子ども</u>が すきです。',
        '子ども dibaca こども. 子 kanji baru Bab 17 untuk "anak".'),

    -- ===== もんだい2 表記 (10-18) — target hiragana (mirror もんだい1), jawaban bentuk tulisan =====
    (10, 'vocabulary', 2, 'わたしの <u>ちち</u>は 先生です。',
        'ちち ditulis 父. Salah: 母 (はは, ibu), 友だち (ともだち, teman), 子ども (こども, anak).'),
    (11, 'vocabulary', 2, 'わたしの <u>はは</u>は りょうりが 上手です。',
        'はは ditulis 母. Salah: 父 (ちち, ayah), 友だち (ともだち, teman), 子ども (こども, anak).'),
    (12, 'vocabulary', 2, '<u>ともだち</u>と 話します。',
        'ともだち ditulis 友だち. Salah: 父 (ちち, ayah), 母 (はは, ibu), 子ども (こども, anak).'),
    (13, 'vocabulary', 2, '<u>て</u>で 書きます。',
        'て ditulis 手. Salah: 足 (あし, kaki), 口 (くち, mulut), 目 (め, mata).'),
    (14, 'vocabulary', 2, '<u>あし</u>が いたいです。',
        'あし ditulis 足. Salah: 手 (て, tangan), 口 (くち, mulut), 耳 (みみ, telinga).'),
    (15, 'vocabulary', 2, '<u>くち</u>を あけます。',
        'くち ditulis 口. Salah: 手 (て, tangan), 足 (あし, kaki), 目 (め, mata).'),
    (16, 'vocabulary', 2, '<u>め</u>が わるいです。',
        'め ditulis 目. Salah: 手 (て, tangan), 口 (くち, mulut), 耳 (みみ, telinga).'),
    (17, 'vocabulary', 2, '<u>みみ</u>が いいです。',
        'みみ ditulis 耳. Salah: 手 (て, tangan), 足 (あし, kaki), 目 (め, mata).'),
    (18, 'vocabulary', 2, '<u>こども</u>が すきです。',
        'こども ditulis 子ども. Salah: 父 (ちち, ayah), 母 (はは, ibu), 友だち (ともだち, teman).'),

    -- ===== もんだい3 文脈規定 (19-30) — kosakata suka/mahir/hobi =====
    (19, 'vocabulary', 3, 'わたしは やさいが（　）です。たべたくないです。',
        'Jawabannya きらい (tidak suka). すき, だいすき, へた tidak cocok dengan "tidak mau makan".'),
    (20, 'vocabulary', 3, 'わたしは くだものが（　）です。まいにち たべます。',
        'Jawabannya すき (suka). きらい, だいきらい, じょうず tidak cocok dengan "makan tiap hari".'),
    (21, 'vocabulary', 3, 'あねは りょうりが とても（　）です。レストランみたいです。',
        'Jawabannya じょうず (mahir, untuk memuji orang lain). へた, とくい, どんな tidak cocok untuk memuji orang lain.'),
    (22, 'vocabulary', 3, 'わたしは うたが（　）です。いつも まちがえます。',
        'Jawabannya へた (tidak mahir). じょうず, とくい, どんな tidak cocok dengan "selalu salah".'),
    (23, 'vocabulary', 3, 'わたしは えいごが（　）です。がっこうで いちばんです。',
        'Jawabannya とくい (mahir, untuk diri sendiri — beda dari じょうず yang untuk orang lain). じょうず, へた, どんな tidak cocok untuk memuji diri sendiri.'),
    (24, 'vocabulary', 3, '「いぬが すきですか。」「はい、とても（　）です。」',
        'Jawabannya だいすき (sangat suka). だいきらい, すき, きらい tidak sekuat だいすき untuk penekanan "とても".'),
    (25, 'vocabulary', 3, '「ごきぶりが すきですか。」「いいえ、とても（　）です。」',
        'Jawabannya だいきらい (sangat benci). だいすき, きらい, すき tidak sekuat だいきらい untuk penekanan "とても".'),
    (26, 'vocabulary', 3, '（　）おんがくが すきですか。「クラシックが すきです。」',
        'Jawabannya どんな (jenis apa). じょうず, へた, とくい tidak bisa dipakai sebagai kata tanya jenis.'),
    (27, 'vocabulary', 3, 'わたしは まいにち ばんごはんを つくります。（　）が すきです。',
        'Jawabannya りょうり (memasak). うた, え, おんがく tidak cocok dengan "membuat makan malam".'),
    (28, 'vocabulary', 3, 'あねは カラオケで（　）を うたいます。とても じょうずです。',
        'Jawabannya うた (lagu). りょうり, え, おんがく tidak cocok dengan "menyanyi di karaoke".'),
    (29, 'vocabulary', 3, 'わたしは（　）が すきです。よく びじゅつかんへ 行きます。',
        'Jawabannya え (gambar/lukisan). りょうり, うた, おんがく tidak cocok dengan "sering pergi ke museum seni".'),
    (30, 'vocabulary', 3, 'わたしは（　）が すきです。まいばん クラシックを ききます。',
        'Jawabannya おんがく (musik). りょうり, うた, え tidak sesuai konteks "mendengarkan musik klasik tiap malam".'),

    -- ===== もんだい1 文の文法1 (31-50) — 4 pola grammar Bab 17 (5/5/5/5) =====
    -- Pola 1: 〜が好きです／嫌いです (31-35) — menguji partikel が, bukan を
    (31, 'grammar'::TEXT, 1, 'ねこ（　）すきです。「が。」',
        'Jawabannya が — objek yang disukai ditandai が, bukan を, karena すき adalah kata sifat な, bukan kata kerja. を, に, で tidak tepat.'),
    (32, 'grammar', 1, 'さかな（　）きらいです。「が。」',
        'Jawabannya が — sama seperti すき, きらい juga memakai が. を, に, で tidak tepat.'),
    (33, 'grammar', 1, 'やさい（　）だいすきです。「が。」',
        'Jawabannya が — だいすき tetap memakai partikel が seperti すき. を, に, で tidak tepat.'),
    (34, 'grammar', 1, 'にく（　）だいきらいです。「が。」',
        'Jawabannya が — だいきらい tetap memakai partikel が seperti きらい. を, に, で tidak tepat.'),
    (35, 'grammar', 1, 'すし（　）すきです。「が。」',
        'Jawabannya が — konsisten dengan pola 〜が好きです. を, に, で tidak tepat.'),

    -- Pola 2: 〜が上手です／下手です (36-40) — menguji partikel が
    (36, 'grammar', 1, 'りょうり（　）上手です。「が。」',
        'Jawabannya が — kemampuan yang dipuji ditandai が, bukan を, karena 上手 adalah kata sifat な. を, に, で tidak tepat.'),
    (37, 'grammar', 1, 'うた（　）下手です。「が。」',
        'Jawabannya が — sama seperti 上手, 下手 juga memakai が. を, に, で tidak tepat.'),
    (38, 'grammar', 1, '日本語（　）上手です。「が。」',
        'Jawabannya が — bahasa yang dikuasai ditandai が. を, に, で tidak tepat.'),
    (39, 'grammar', 1, 'え（　）上手です。「が。」',
        'Jawabannya が — konsisten dengan pola 〜が上手です. を, に, で tidak tepat.'),
    (40, 'grammar', 1, 'スポーツ（　）下手です。「が。」',
        'Jawabannya が — konsisten dengan pola 〜が下手です. を, に, で tidak tepat.'),

    -- Pola 3: 〜ができます (41-45) — menguji partikel が
    (41, 'grammar', 1, 'わたしは 日本語（　）できます。「が。」',
        'Jawabannya が — kemampuan yang dinyatakan できます ditandai が, bukan を. を, に, で tidak tepat.'),
    (42, 'grammar', 1, 'あには うんてん（　）できます。「が。」',
        'Jawabannya が — sama seperti 日本語ができます, うんてん juga memakai が. を, に, で tidak tepat.'),
    (43, 'grammar', 1, 'わたしは ピアノ（　）できません。「が。」',
        'Jawabannya が — bentuk negatif できません tetap memakai partikel が. を, に, で tidak tepat.'),
    (44, 'grammar', 1, 'ちちは えいご（　）できます。「が。」',
        'Jawabannya が — konsisten dengan pola 〜ができます. を, に, で tidak tepat.'),
    (45, 'grammar', 1, 'わたしは りょうり（　）できます。「が。」',
        'Jawabannya が — konsisten dengan pola 〜ができます. を, に, で tidak tepat.'),

    -- Pola 4: どんな〜 (46-50) — menguji どんな vs kata tanya lain
    (46, 'grammar', 1, '（　）たべものが すきですか。「どんな。」',
        'Jawabannya どんな — selalu diikuti kata benda (たべもの) untuk menanyakan jenis. どう, なに, だれ tidak diikuti kata benda dengan cara yang sama.'),
    (47, 'grammar', 1, '（　）本を 読みますか。「どんな。」',
        'Jawabannya どんな — menanyakan jenis buku. どう, なに, だれ tidak tepat untuk menanyakan jenis.'),
    (48, 'grammar', 1, 'お父さんは（　）人ですか。「どんな。」',
        'Jawabannya どんな — menanyakan sifat/jenis orang. どう, なに, だれ tidak tepat untuk menanyakan jenis orang.'),
    (49, 'grammar', 1, '（　）おんがくが すきですか。「どんな。」',
        'Jawabannya どんな — menanyakan jenis musik. どう, なに, だれ tidak tepat.'),
    (50, 'grammar', 1, '（　）スポーツが とくいですか。「どんな。」',
        'Jawabannya どんな — menanyakan jenis olahraga. どう, なに, だれ tidak tepat.')
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
    (1, 0, 'ちち', TRUE), (1, 1, 'はは', FALSE), (1, 2, 'ともだち', FALSE), (1, 3, 'こども', FALSE),
    (2, 0, 'はは', TRUE), (2, 1, 'ちち', FALSE), (2, 2, 'ともだち', FALSE), (2, 3, 'こども', FALSE),
    (3, 0, 'ともだち', TRUE), (3, 1, 'ちち', FALSE), (3, 2, 'はは', FALSE), (3, 3, 'こども', FALSE),
    (4, 0, 'て', TRUE), (4, 1, 'あし', FALSE), (4, 2, 'くち', FALSE), (4, 3, 'め', FALSE),
    (5, 0, 'あし', TRUE), (5, 1, 'て', FALSE), (5, 2, 'くち', FALSE), (5, 3, 'みみ', FALSE),
    (6, 0, 'くち', TRUE), (6, 1, 'て', FALSE), (6, 2, 'あし', FALSE), (6, 3, 'め', FALSE),
    (7, 0, 'め', TRUE), (7, 1, 'て', FALSE), (7, 2, 'くち', FALSE), (7, 3, 'みみ', FALSE),
    (8, 0, 'みみ', TRUE), (8, 1, 'て', FALSE), (8, 2, 'あし', FALSE), (8, 3, 'め', FALSE),
    (9, 0, 'こども', TRUE), (9, 1, 'ちち', FALSE), (9, 2, 'はは', FALSE), (9, 3, 'ともだち', FALSE),

    -- 表記 — opsi kanji murni (target soal hiragana)
    (10, 0, '父', TRUE), (10, 1, '母', FALSE), (10, 2, '友だち', FALSE), (10, 3, '子ども', FALSE),
    (11, 0, '母', TRUE), (11, 1, '父', FALSE), (11, 2, '友だち', FALSE), (11, 3, '子ども', FALSE),
    (12, 0, '友だち', TRUE), (12, 1, '父', FALSE), (12, 2, '母', FALSE), (12, 3, '子ども', FALSE),
    (13, 0, '手', TRUE), (13, 1, '足', FALSE), (13, 2, '口', FALSE), (13, 3, '目', FALSE),
    (14, 0, '足', TRUE), (14, 1, '手', FALSE), (14, 2, '口', FALSE), (14, 3, '耳', FALSE),
    (15, 0, '口', TRUE), (15, 1, '手', FALSE), (15, 2, '足', FALSE), (15, 3, '目', FALSE),
    (16, 0, '目', TRUE), (16, 1, '手', FALSE), (16, 2, '口', FALSE), (16, 3, '耳', FALSE),
    (17, 0, '耳', TRUE), (17, 1, '手', FALSE), (17, 2, '足', FALSE), (17, 3, '目', FALSE),
    (18, 0, '子ども', TRUE), (18, 1, '父', FALSE), (18, 2, '母', FALSE), (18, 3, '友だち', FALSE),

    -- 文脈規定
    (19, 0, 'きらい', TRUE), (19, 1, 'すき', FALSE), (19, 2, 'だいすき', FALSE), (19, 3, 'へた', FALSE),
    (20, 0, 'すき', TRUE), (20, 1, 'きらい', FALSE), (20, 2, 'だいきらい', FALSE), (20, 3, 'じょうず', FALSE),
    (21, 0, 'じょうず', TRUE), (21, 1, 'へた', FALSE), (21, 2, 'とくい', FALSE), (21, 3, 'どんな', FALSE),
    (22, 0, 'へた', TRUE), (22, 1, 'じょうず', FALSE), (22, 2, 'とくい', FALSE), (22, 3, 'どんな', FALSE),
    (23, 0, 'とくい', TRUE), (23, 1, 'じょうず', FALSE), (23, 2, 'へた', FALSE), (23, 3, 'どんな', FALSE),
    (24, 0, 'だいすき', TRUE), (24, 1, 'だいきらい', FALSE), (24, 2, 'すき', FALSE), (24, 3, 'きらい', FALSE),
    (25, 0, 'だいきらい', TRUE), (25, 1, 'だいすき', FALSE), (25, 2, 'きらい', FALSE), (25, 3, 'すき', FALSE),
    (26, 0, 'どんな', TRUE), (26, 1, 'じょうず', FALSE), (26, 2, 'へた', FALSE), (26, 3, 'とくい', FALSE),
    (27, 0, 'りょうり', TRUE), (27, 1, 'うた', FALSE), (27, 2, 'え', FALSE), (27, 3, 'おんがく', FALSE),
    (28, 0, 'うた', TRUE), (28, 1, 'りょうり', FALSE), (28, 2, 'え', FALSE), (28, 3, 'おんがく', FALSE),
    (29, 0, 'え', TRUE), (29, 1, 'りょうり', FALSE), (29, 2, 'うた', FALSE), (29, 3, 'おんがく', FALSE),
    (30, 0, 'おんがく', TRUE), (30, 1, 'りょうり', FALSE), (30, 2, 'うた', FALSE), (30, 3, 'え', FALSE),

    -- 文の文法1 — 〜が好きです／嫌いです
    (31, 0, 'が', TRUE), (31, 1, 'を', FALSE), (31, 2, 'に', FALSE), (31, 3, 'で', FALSE),
    (32, 0, 'が', TRUE), (32, 1, 'を', FALSE), (32, 2, 'に', FALSE), (32, 3, 'で', FALSE),
    (33, 0, 'が', TRUE), (33, 1, 'を', FALSE), (33, 2, 'に', FALSE), (33, 3, 'で', FALSE),
    (34, 0, 'が', TRUE), (34, 1, 'を', FALSE), (34, 2, 'に', FALSE), (34, 3, 'で', FALSE),
    (35, 0, 'が', TRUE), (35, 1, 'を', FALSE), (35, 2, 'に', FALSE), (35, 3, 'で', FALSE),

    -- 〜が上手です／下手です
    (36, 0, 'が', TRUE), (36, 1, 'を', FALSE), (36, 2, 'に', FALSE), (36, 3, 'で', FALSE),
    (37, 0, 'が', TRUE), (37, 1, 'を', FALSE), (37, 2, 'に', FALSE), (37, 3, 'で', FALSE),
    (38, 0, 'が', TRUE), (38, 1, 'を', FALSE), (38, 2, 'に', FALSE), (38, 3, 'で', FALSE),
    (39, 0, 'が', TRUE), (39, 1, 'を', FALSE), (39, 2, 'に', FALSE), (39, 3, 'で', FALSE),
    (40, 0, 'が', TRUE), (40, 1, 'を', FALSE), (40, 2, 'に', FALSE), (40, 3, 'で', FALSE),

    -- 〜ができます
    (41, 0, 'が', TRUE), (41, 1, 'を', FALSE), (41, 2, 'に', FALSE), (41, 3, 'で', FALSE),
    (42, 0, 'が', TRUE), (42, 1, 'を', FALSE), (42, 2, 'に', FALSE), (42, 3, 'で', FALSE),
    (43, 0, 'が', TRUE), (43, 1, 'を', FALSE), (43, 2, 'に', FALSE), (43, 3, 'で', FALSE),
    (44, 0, 'が', TRUE), (44, 1, 'を', FALSE), (44, 2, 'に', FALSE), (44, 3, 'で', FALSE),
    (45, 0, 'が', TRUE), (45, 1, 'を', FALSE), (45, 2, 'に', FALSE), (45, 3, 'で', FALSE),

    -- どんな〜
    (46, 0, 'どんな', TRUE), (46, 1, 'どう', FALSE), (46, 2, 'なに', FALSE), (46, 3, 'だれ', FALSE),
    (47, 0, 'どんな', TRUE), (47, 1, 'どう', FALSE), (47, 2, 'なに', FALSE), (47, 3, 'だれ', FALSE),
    (48, 0, 'どんな', TRUE), (48, 1, 'どう', FALSE), (48, 2, 'なに', FALSE), (48, 3, 'だれ', FALSE),
    (49, 0, 'どんな', TRUE), (49, 1, 'どう', FALSE), (49, 2, 'なに', FALSE), (49, 3, 'だれ', FALSE),
    (50, 0, 'どんな', TRUE), (50, 1, 'どう', FALSE), (50, 2, 'なに', FALSE), (50, 3, 'だれ', FALSE)
  )
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT qq.id, o.option_text, o.ok, o.ord
    FROM o
    JOIN quiz_questions qq
      ON qq.lesson_id = v_lesson_id AND qq.sort_order = o.qno;

  -- ===== Assertion bentuk =====
  IF (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id) <> 50 THEN
    RAISE EXCEPTION '107: jumlah soal bukan 50 (dapat %)',
      (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
      LEFT JOIN quiz_options qo ON qo.question_id = qq.id
     WHERE qq.lesson_id = v_lesson_id
     GROUP BY qq.id
    HAVING COUNT(qo.id) <> 4 OR COUNT(*) FILTER (WHERE qo.is_correct) <> 1
  ) THEN
    RAISE EXCEPTION '107: ada soal yang opsinya bukan 4 atau kuncinya bukan tepat 1';
  END IF;

  -- ===== Pagar level =====

  -- 1. Badan kalimat (di LUAR target <u>…</u>) hanya boleh memakai kanji
  --    taught: 62 kanji Bab 3-9 + 見読書 (Bab 10) + 週毎 (Bab 11) + 食飲
  --    (Bab 12) + 立休入出 (Bab 14) + 言話聞買店会社 (Bab 15) +
  --    日火水木金土 (Bab 16) + 子父母友手足口目耳 (Bab 17) — SAMA PERSIS
  --    dengan v_kanji_ok di 086_bunpou_bab17.sql. もんだい3 tidak memakai
  --    <u>, jadi SELURUH kolom question-nya kena pagar ini juga.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND regexp_replace(
             regexp_replace(question, '<u>[^<]*</u>', '', 'g'),
             '[先何語校国生学名人魚本花八三十九一五四二六七安高古新白長男女気下前外間右中左後上時分円百千万年月半歳午車東道駅行西電北南見読書週毎食飲立休入出言話聞買店会社日火水木金土子父母友手足口目耳]', '', 'g'
           ) ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '107: ada kanji di luar daftar taught pada badan kalimat soal';
  END IF;

  -- 2. Partikel: TIDAK ADA ASSERTION UMUM (dihapus sejak 059) — partikel が
  --    justru topik utama もんだい1 文の文法1, diuji manual di atas.
  -- 3. Kata kerja: TIDAK ADA ASSERTION (もんだい1/2 kosakata polos, bukan
  --    konjugasi — tidak relevan sejak 100).

  -- 4. Rantai の dalam satu kalimat.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '107: ada kalimat dengan rantai の (lebih dari satu の dalam satu kalimat)';
  END IF;

  -- 5. Target section: もんだい1 wajib kanji di dalam <u>, もんだい2 wajib kana.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 1
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '') !~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '107: ada soal 漢字読み yang target <u> nya tidak mengandung kanji';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 2
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '一') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '107: ada soal 表記 yang target <u> nya sudah berupa kanji';
  END IF;

  -- 6. DEDUP WAJIB — target <u> tidak boleh sama dengan salah satu dari
  --    251 target unik yang sudah dipakai di 039-106 (di-grep ulang penuh
  --    dari file migrasi sungguhan, dibersihkan dari baris komentar
  --    palsu — lihat catatan header di atas).
  IF EXISTS (
    SELECT 1 FROM quiz_questions qq,
      LATERAL (SELECT (regexp_match(qq.question, '<u>([^<]*)</u>'))[1] AS tgt) t
     WHERE qq.lesson_id = v_lesson_id
       AND t.tgt = ANY (ARRAY[
         'あいます','いいます','いきました','いって','いんど','えきでまっています','えきまえ','おみせ','お店','かいしゃ',
         'かいて','かいます','かきます','かようび','がいこく','がくせい','がっこう','ききます','きゅうにん','きゅうひゃくえん',
         'きんようび','くじかん','くに','くるまをつかってもいいですか','くるまをもっています','げつようび','こくどう','ごご',
         'ごじ','ごじゅうにん','ごせんえん','ごぜん','ごぜんちゅう','ごにん','ごねんせい','ごひゃくえん','ごほん','さかな',
         'さゆう','さんにん','さんねんせい','しゃどう','じかん','じゅうごふん','じゅうにじ','じゅうにん','じゅっぽん',
         'じょうげ','すいようび','せんえん','せんげつ','せんせい','せんにん','ぜんご','たい','たたない','たつ','たべて',
         'たべもの','ちゅうかん','ちゅうがくせい','ちゅうねん','でた','でない','でる','でんしゃにのっています',
         'でんしゃにのってください','でんわ','とうざい','どようび','ななひゃくえん','なに','なんがつなんにち','なんじ','なんせい',
         'なんとう','なんねん','なんぼく','にじゅうにん','にせんえん','にちようび','にねんせい','にひゃくえん','にほん',
         'のみました','のんで','はいらない','はいる','はちじ','はちにん','はな','はながさいています','はなします',
         'はなをとってはいけません','はん','はんとし','はんぶん','ひと','ひゃくにん','べとなむ','ほくせい','ほくとう','ほん',
         'まいにち','まんえん','みせのひと','みちをあるいています','みちをあるいてください','みて','みました','もくようび',
         'やすまない','やすむ','よにん','よねんせい','よみました','よんじゅうにん','よんで','よんほん','ろくがつみっか',
         'ろくにん','一人','一分','一年','一時','一本','七人','七分','三十人','三十分','三時','三本','三百円','上',
         '下','中','中国','九時','二人','二十歳','二時','二百人','人','人気','人間','休まない','休む','会います',
         '会社','何人','何年生','何月何日','何本','先生','先週','入らない','入る','八時半','八百円','六分','六年生',
         '六時','六月三日','六本','六百円','出た','出ない','出る','前','北','十分','十時','南','古い','右',
         '名前','四時','国','土ようび','外','大学','大学生','女','女の人','学校','学生','安い','左','店の人',
         '後ろ','新しい','日ようび','日本','日本人','日本語','書いて','書きました','月ようび','木ようび','本','東',
         '毎月','毎週','気分','水ようび','火ようび','男','男の人','男女','留学生','白い','立たない','立つ','聞きます',
         '花','花がさいています','花をとってはいけません','行','行って','西','見て','見てから','見ません','言います',
         '話します','読みます','読んで','買います','車','車をつかってもいいですか','車をもっています','道','道をあるいています',
         '道をあるいてください','金ようび','長い','電話','電車','電車にのっています','電車にのってください','韓国人','食べて',
         '食べてから','飲んで','飲んでから','駅','駅でまっています','高い','高校','高校生','魚'
       ])
  ) THEN
    RAISE EXCEPTION '107: ada target <u> yang sudah pernah diujikan di migration 039-106';
  END IF;

  RAISE NOTICE '107: selesai — 50 soal (vocabulary 30, grammar 20), semua pagar level + dedup lolos.';
END $$;
