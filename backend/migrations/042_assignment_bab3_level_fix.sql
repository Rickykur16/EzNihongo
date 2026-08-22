-- 042_assignment_bab3_level_fix.sql — tulis ulang total soal Assignment Bab 3.
--
-- KENAPA ADA MIGRASI INI
-- Migration 041 men-seed 50 soal untuk pelajaran ini, tapi tingkat
-- kesulitannya jauh di atas materi Bab 3. 041 menegakkan aturan KANJI dengan
-- ketat (badan kalimat 100% kana, diverifikasi mesin) tapi TIDAK pernah
-- memagari GRAMMAR dan KOSAKATA. Akibatnya kalimatnya terlihat mudah karena
-- semua kana, padahal isinya materi N4:
--   - "はじめて あった ひとに「（　）」と いいます" → bentuk lampau biasa
--     (あった) + anak kalimat penjelas + と いいます (kutipan) = Minna bab 20-21
--   - "かのじょは びょういんで はたらいて いる（　）です" → て-form + いる
--     + KLAUSA RELATIF menerangkan benda = Minna bab 22, itu level N4
-- Audit lengkap 50 soal 041: 21 soal fatal (kata kerja / kata sifat / klausa
-- relatif / の-penjelas Bab 4), 17 soal sedang (これ・あれ・この・あの dan
-- kosakata luar daftar), hanya 12 soal yang benar-benar sesuai Bab 3.
-- Seluruh もんだい3 文脈規定 (9 soal) fatal semua.
-- Ditambah: 42 dari 50 penjelasan 041 ditulis bahasa Jepang, padahal
-- konvensi repo (QUIZ_GEN_SYSTEM di admin.js) mewajibkan Bahasa Indonesia —
-- percuma untuk siswa yang baru selesai hiragana di Bab 1.
--
-- BATAS MATERI BAB 3 (diverifikasi dari Notion, bukan ditebak)
-- Grammar Bab 3 HANYA 6 pola (GRM-13..17 + GRM-230):
--   〜は〜です / 〜は〜じゃありません / 〜は〜ですか / 〜も /
--   〜の (kepemilikan) / 〜ね・〜よ
-- Yang BELUM diajarkan dan karena itu DILARANG muncul di soal ini:
--   - kata kerja apa pun (bentuk ます sekalipun) — bab-bab berikutnya
--   - kata sifat い / な — Bab 6 dan Bab 7
--   - これ／それ／あれ dan この／その／あの — Bab 4 (GRM-18, GRM-227)
--   - 〜の〜 sebagai PENJELAS jenis/asal/kategori — Bab 4 (GRM-19),
--     dibedakan tegas dari の kepemilikan Bab 3 di catatan Notion
--   - partikel が・を・で・に・へ・と — belum satu pun diajarkan
--   - そうです／だれの — Bab 4
-- Kosakata: 46 kata Bab 3 dari Notion (pronomina, sufiks, nama, negara &
-- kewarganegaraan, profesi, tempat kerja, salam, keluarga, 出身) plus
-- kombinasi kosakata dari 9 kanji Bab 3 (学校・何人・日本人 dst).
-- Kanji: 9 saja — 人・名・何・学・校・先・生・国・語.
--
-- ATURAN の (keputusan sadar, dicatat supaya tidak diperdebatkan lagi)
-- の kepemilikan diajarkan di Bab 3, の penjelas baru di Bab 4. Batas itu
-- soal label, bukan penghalang membaca: siswa yang paham 「わたしの なまえ」
-- tidak akan tersandung 「ちゅうごくの しゅっしん」 atau 「がっこうの
-- せんせい」 — apalagi 出身 memang tidak bisa dipakai tanpa の, dan 出身
-- adalah kosakata Bab 3. Yang benar-benar menyulitkan adalah RANTAI の
-- (「かんこくの だいがくの がくせい」 di 041). Jadi aturannya:
--   BOLEH: maksimal SATU の per kalimat, kedua kata benda dari materi Bab 3.
--   DILARANG: dua の atau lebih dalam satu kalimat.
--
-- KANJI 語 SENGAJA HANYA MUNCUL SEKALI
-- 語 tidak punya kombinasi kosakata di Notion dan satu-satunya kata yang
-- wajar adalah 日本語, yang di dalam kalimat hampir selalu butuh kata kerja
-- (日本語がわかります) atau の-penjelas (日本語の本 — justru contoh Bab 4).
-- Dipakai satu kali dalam bingkai 「あには 日本語の せんせいです」 (satu の,
-- kedua kata dari Bab 3). Latihan 語 yang lebih luas sebaiknya di Bab 4.
--
-- PERUBAHAN STRUKTUR: 文の組み立て DIHAPUS
-- 041 punya 8 soal 文の組み立て (susun kalimat, tanda ★). Itu format mondai
-- tersulit di JLPT, dan dengan materi Bab 3 yang cuma punya は/も/の,
-- puzzle-nya jadi pendek dan dipaksakan — 7 dari 8 soalnya bahkan cuma bisa
-- berdiri dengan の-penjelas Bab 4. Atas keputusan user, section ini dihapus;
-- jatahnya dialihkan ke 文脈規定 (13) dan 文の文法1 (16). 組み立て dimunculkan
-- lagi di bab yang materinya sudah cukup.
--
-- INSTRUKSI SECTION JADI BAHASA INDONESIA
-- Label tetap 「もんだい1 漢字読み」 dst supaya terasa lembar JLPT, tapi
-- instruksinya Indonesia — siswa Bab 3 baru selesai kana, instruksi Jepang
-- penuh tidak terbaca. Ini membuat tuple section tidak lagi byte-exact
-- dengan JLPT_GEN_TASKS (admin.js), dan itu AMAN: tombol "✨ Generate JLPT"
-- mencocokkan section lewat (question_category, section_number) lalu
-- MEWARISI label/instruction dari baris yang sudah ada, jadi soal AI baru
-- ikut memakai instruksi Indonesia ini, bukan bikin section kembar.
--
-- Komposisi: vocabulary 34 (12 漢字読み + 9 表記 + 13 文脈規定),
-- grammar 16 (文の文法1). Total 50, tetap sample 30 per attempt.
-- Section terkecil 9 soal → peluang satu attempt kehilangan section itu
-- ~0,0067%, jauh lebih aman dari ambang 041.
--
-- PERINGATAN RE-RUN: DELETE FROM quiz_questions di bawah tanpa syarat —
-- soal manual/AI yang admin tambahkan ke pelajaran ini akan ikut terhapus
-- kalau migrasi ini dijalankan ulang manual. Runner menjalankannya sekali
-- per DB (tercatat di schema_migrations).

DO $$
DECLARE
  v_course_slug  TEXT := 'n5';
  v_lesson_slug  TEXT := 'assignment-bab-3-perkenalan';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson_id    UUID;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 2 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '042: modul Bab 3 di kursus % tidak ditemukan — skip.', v_course_slug;
    RETURN;
  END IF;

  SELECT id INTO v_lesson_id
    FROM lessons
   WHERE module_id = v_module_id AND slug = v_lesson_slug;

  IF v_lesson_id IS NULL THEN
    RAISE NOTICE '042: pelajaran % belum ada di modul "%" (041 mungkin di-skip) — skip.',
      v_lesson_slug, v_module_title;
    RETURN;
  END IF;

  RAISE NOTICE '042: tulis ulang soal Assignment Bab 3 di modul "%".', v_module_title;

  UPDATE lessons SET
    content = 'Tes materi Bab 3 (Perkenalan Diri) gaya JLPT. Moji-Goi: cara baca 9 kanji dasar, cara menulis kanji/katakana, dan memilih kosakata sesuai konteks. Tata Bahasa: partikel は・も・の・か dan bentuk です／じゃありません／ですか／ね・よ. Semua kalimat memakai pola Bab 3 saja — tanpa kata kerja, tanpa kata sifat, tanpa これ／それ／あれ. Tiap attempt mengambil 30 soal acak dari 50. Lulus 70% (21/30), cooldown 12 jam.',
    updated_at = NOW()
  WHERE id = v_lesson_id;

  DELETE FROM quiz_questions WHERE lesson_id = v_lesson_id;

  WITH sect(cat, num, label, instruction) AS (VALUES
    ('vocabulary'::TEXT, 1, 'もんだい1 漢字読み',
        'Bagaimana cara membaca kata yang bergaris bawah? Pilih satu jawaban yang paling tepat dari nomor 1-4.'),
    ('vocabulary', 2, 'もんだい2 表記',
        'Kata yang bergaris bawah ditulis dengan huruf apa? Pilih satu jawaban yang paling tepat dari nomor 1-4.'),
    ('vocabulary', 3, 'もんだい3 文脈規定',
        'Kata apa yang paling tepat untuk mengisi （　）? Pilih satu jawaban dari nomor 1-4.'),
    ('grammar', 1, 'もんだい1 文の文法1',
        'Partikel atau bentuk apa yang paling tepat untuk mengisi （　）? Pilih satu jawaban dari nomor 1-4.')
  ), q(no, cat, sect_num, question, explanation) AS (VALUES
    -- ===== もんだい1 漢字読み (1-12) — pola は〜です, maksimal satu の =====
    (1, 'vocabulary'::TEXT, 1, 'わたしは <u>学生</u>です。',
        '学生 dibaca がくせい. 学 (belajar) + 生 (murid). Salah: がっせい menambah sokuon っ yang tidak ada, がくせえ menulis bunyi panjang dengan え padahal seharusnya せい, かくせい menghilangkan dakuten pada が.'),
    (2, 'vocabulary', 1, 'ちちは <u>先生</u>です。',
        '先生 dibaca せんせい. 先 (lebih dahulu) + 生. Salah: せんせえ salah menulis bunyi panjang, ぜんせい menambah dakuten pada せ pertama, せいせん membalik urutan suku kata.'),
    (3, 'vocabulary', 1, 'あには <u>大学生</u>です。',
        '大学生 dibaca だいがくせい (mahasiswa S1). Salah: たいがくせい menghilangkan dakuten pada だ, だいかくせい menghilangkan dakuten pada が, だいがくしょう memakai bacaan しょう untuk 生 yang tidak dipakai di kata ini.'),
    (4, 'vocabulary', 1, 'あねは <u>高校</u>の せんせいです。',
        '高校 dibaca こうこう (SMA). Kedua suku katanya panjang. Salah: こおこう menulis bunyi panjang dengan お padahal memakai う, こうごう menambah dakuten, ごうこう menambah dakuten di depan.'),
    (5, 'vocabulary', 1, 'わたしの <u>名前</u>は アニサです。',
        '名前 dibaca なまえ. 名 (nama) dibaca な di sini. Salah: なまへ memakai へ, なあまえ menambah bunyi panjang yang tidak ada, めいまえ memakai bacaan on メイ yang tidak dipakai di kata ini.'),
    (6, 'vocabulary', 1, 'わたしの <u>国</u>は タイです。',
        '国 sendirian dibaca くに (bacaan kun). Bacaan on コク hanya muncul kalau digabung, seperti 中国 ちゅうごく. Salah: こく, ぐに, くいに.'),
    (7, 'vocabulary', 1, 'たなかさんは <u>中国</u>の しゅっしんです。',
        '中国 dibaca ちゅうごく (Tiongkok). 国 di sini memakai bacaan on dengan dakuten: ごく. Salah: ちゅうこく tanpa dakuten, じゅうごく mengubah ち jadi じ, ちゅごく menghilangkan bunyi panjang ゅう.'),
    (8, 'vocabulary', 1, 'リナさんは <u>韓国人</u>です。',
        '韓国人 dibaca かんこくじん (orang Korea). Perhatikan: 韓国 di sini こく tanpa dakuten, berbeda dari 中国 ちゅうごく. Sufiks 〜人 untuk kewarganegaraan dibaca じん. Salah: かんごくじん, かんこくにん, かんこくひと.'),
    (9, 'vocabulary', 1, 'わたしは <u>日本人</u>じゃありません。',
        '日本人 dibaca にほんじん. Sufiks 〜人 untuk kewarganegaraan selalu じん, bukan にん atau ひと. Salah: にほんにん, にっぽんにん, にほんひと.'),
    (10, 'vocabulary', 1, 'あには <u>日本語</u>の せんせいです。',
        '日本語 dibaca にほんご (bahasa Jepang). Kanji 語 berarti bahasa dan dibaca ご. Salah: にほんこ tanpa dakuten, にっぽんご memakai bacaan にっぽん yang tidak dipakai di sini, にほんかた memakai bacaan kun かた(る).'),
    (11, 'vocabulary', 1, 'かぞくは <u>何人</u>ですか。',
        'Di kalimat ini 何人 dibaca なんにん, artinya berapa orang. Bandingkan なにじん yang artinya orang dari negara mana — di sini yang ditanya jumlah anggota keluarga, jadi なんにん. Salah juga: なんじん, なににん.'),
    (12, 'vocabulary', 1, 'わたしは <u>留学生</u>です。',
        '留学生 dibaca りゅうがくせい (mahasiswa asing). Salah: りゅがくせい menghilangkan bunyi panjang ゅう, りゅうかくせい menghilangkan dakuten pada が, りゅうがくしょう memakai bacaan しょう untuk 生.'),

    -- ===== もんだい2 表記 (13-21) — kalimat 100% kana, jawaban bentuk tulisan =====
    (13, 'vocabulary', 2, 'わたしは <u>がくせい</u>です。',
        'がくせい ditulis 学生. Salah: 学正 memakai 正 (benar), 字生 memakai 字 (huruf) yang mirip 学, 学主 memakai 主 (tuan) yang mirip 生.'),
    (14, 'vocabulary', 2, 'ちちは <u>せんせい</u>です。',
        'せんせい ditulis 先生. Salah: 失生 memakai 失 (kehilangan) yang sangat mirip 先, 先正 memakai 正, 洗生 memakai 洗 (mencuci) yang juga mirip 先.'),
    (15, 'vocabulary', 2, 'あねは <u>がっこう</u>の せんせいです。',
        'がっこう ditulis 学校. Salah: 学枝 memakai 枝 (ranting) yang mirip 校, 学交 memakai 交 tanpa radikal kayu, 字校 memakai 字 sebagai ganti 学.'),
    (16, 'vocabulary', 2, 'わたしの <u>くに</u>は タイです。',
        'くに ditulis 国. Salah: 困 (susah), 因 (sebab), 回 (putaran) — ketiganya sama-sama berbingkai kotak 囗 sehingga mudah tertukar, tapi isi di dalam kotaknya berbeda.'),
    (17, 'vocabulary', 2, 'たなかさんは にほんの <u>ひと</u>です。',
        'ひと ditulis 人. Salah: 入 (masuk) yang arah coretannya terbalik, 八 (delapan) yang kedua garisnya tidak menyatu di atas, 大 (besar) yang punya garis mendatar.'),
    (18, 'vocabulary', 2, 'おなまえは <u>なに</u>ですか。',
        'なに ditulis 何. Salah: 可 (bisa) yang merupakan bagian kanan dari 何 tanpa radikal orang 亻, 河 (sungai) memakai radikal air, 荷 (barang) memakai radikal rumput.'),
    (19, 'vocabulary', 2, 'わたしは <u>べとなむ</u>の しゅっしんです。',
        'Nama negara ditulis dengan katakana: ベトナム. Salah: ヘトナム tanpa dakuten pada ベ, ペトナム memakai handakuten (lingkaran kecil) padahal seharusnya dakuten (dua garis), ベトナヌ memakai ヌ yang mirip ム.'),
    (20, 'vocabulary', 2, 'リナさんは <u>たい</u>の しゅっしんです。',
        'Nama negara ditulis dengan katakana: タイ. Salah: クイ memakai ク yang mirip タ tanpa coretan menyilang, ダイ menambah dakuten, タト memakai ト sebagai ganti イ.'),
    (21, 'vocabulary', 2, 'あには <u>いんど</u>の しゅっしんです。',
        'Nama negara ditulis dengan katakana: インド. Salah: イソド memakai ソ yang mirip ン (arah coretannya beda), イント tanpa dakuten pada ド, インヅ memakai ヅ sebagai ganti ド.'),

    -- ===== もんだい3 文脈規定 (22-34) — 100% kana, hanya pola Bab 3 =====
    (22, 'vocabulary', 3, '「はじめまして。わたしは アニサです。（　）。」',
        'Jawabannya よろしくおねがいします — kalimat penutup baku setelah menyebutkan nama saat perkenalan. ありがとうございます dipakai untuk berterima kasih, すみません untuk minta maaf atau memanggil, こちらこそ hanya sebagai balasan, bukan pembuka.'),
    (23, 'vocabulary', 3, '「（　）。たなかです。」「はじめまして。アニサです。」',
        'Jawabannya はじめまして — salam khusus saat pertama kali bertemu, dan lawan bicara membalas dengan salam yang sama. こちらこそ adalah balasan, どうぞ untuk mempersilakan, すみません untuk minta maaf.'),
    (24, 'vocabulary', 3, '「よろしくおねがいします。」「（　）、よろしくおねがいします。」',
        'Jawabannya こちらこそ — artinya saya juga, dipakai membalas ucapan lawan bicara. はじめまして sudah lewat di awal perkenalan, どうぞ untuk mempersilakan, ありがとうございます untuk berterima kasih.'),
    (25, 'vocabulary', 3, 'わたしの（　）は アニサです。',
        'Jawabannya なまえ. アニサ adalah sebuah nama, jadi yang cocok adalah nama. くに diisi nama negara, しごと diisi pekerjaan, かぞく berarti keluarga.'),
    (26, 'vocabulary', 3, 'たなかさんの（　）は たなかです。たろうは なまえです。',
        'Jawabannya みょうじ (nama keluarga). Kalimat kedua sudah menyebut bahwa たろう adalah なまえ, jadi たなか pastilah nama keluarga. おなまえ hanya bentuk sopan dari なまえ, しゅっしん berarti asal, しごと berarti pekerjaan.'),
    (27, 'vocabulary', 3, 'ちちの（　）は かいしゃいんです。',
        'Jawabannya しごと (pekerjaan), karena かいしゃいん adalah sebuah pekerjaan. なまえ diisi nama orang, くに diisi nama negara, かぞく berarti keluarga.'),
    (28, 'vocabulary', 3, 'わたしの（　）は タイです。',
        'Jawabannya くに (negara), karena タイ adalah nama negara. なまえ diisi nama orang, しごと diisi pekerjaan, みょうじ diisi nama keluarga.'),
    (29, 'vocabulary', 3, 'リナさんは かんこくの しゅっしんです。リナさんは（　）です。',
        'Jawabannya かんこくじん. Asalnya dari かんこく, jadi kewarganegaraannya かんこく ditambah sufiks 〜じん. かんこく saja hanya nama negara, bukan orangnya. ちゅうごくじん dan にほんじん salah negara.'),
    (30, 'vocabulary', 3, 'たなかさんは にほんの しゅっしんです。たなかさんは（　）です。',
        'Jawabannya にほんじん. Pola yang sama: nama negara ditambah 〜じん menjadi kewarganegaraan. にほん saja hanya nama negara. ちゅうごくじん dan かんこくじん salah negara.'),
    (31, 'vocabulary', 3, 'わたしは だいがくの（　）です。',
        'Jawabannya がくせい — orang yang belajar di だいがく. せんせい adalah yang mengajar, bukan yang belajar. かいしゃいん bekerja di かいしゃ, いしゃ bekerja merawat orang sakit.'),
    (32, 'vocabulary', 3, 'あには かいしゃの ひとです。あには（　）です。',
        'Jawabannya かいしゃいん — orang yang bekerja di かいしゃ. ぎんこういん bekerja di bank, がくせい masih belajar, かんごし bekerja merawat pasien.'),
    (33, 'vocabulary', 3, '「（　）。」「ありがとうございます。」',
        'Jawabannya どうぞ — diucapkan saat mempersilakan atau menyerahkan sesuatu, dan dibalas dengan terima kasih. すみません untuk minta maaf, はじめまして salam perkenalan, こちらこそ balasan ucapan.'),
    (34, 'vocabulary', 3, '「（　）、たなかさんですか。」',
        'Jawabannya すみません — dipakai untuk menyapa atau memanggil orang sebelum bertanya. どうぞ untuk mempersilakan, こちらこそ balasan ucapan, ありがとうございます untuk berterima kasih.'),

    -- ===== もんだい1 文の文法1 (35-50) — 100% kana, 6 pola Bab 3 =====
    (35, 'grammar'::TEXT, 1, 'わたし（　）がくせいです。',
        'Jawabannya は — partikel penanda topik, dibaca wa. Polanya AはBです yang berarti A adalah B. も berarti juga dan butuh kalimat sebelumnya, の menyatakan kepemilikan, か membuat kalimat jadi pertanyaan.'),
    (36, 'grammar', 1, 'わたしは がくせいです。たなかさん（　）せんせいです。',
        'Jawabannya は. Pekerjaan たなかさん berbeda dari pembicara, jadi ini informasi baru yang dikontraskan — pakai は. Kalau memakai も artinya jadi たなかさん juga がくせい, padahal beliau せんせい.'),
    (37, 'grammar', 1, 'あには いしゃです。あね（　）いしゃです。',
        'Jawabannya も yang berarti juga. Kedua kalimat menyebut pekerjaan yang sama (いしゃ), jadi kalimat kedua menambahkan orang dengan keterangan yang sama. Kalau memakai は, hubungan juga itu hilang.'),
    (38, 'grammar', 1, 'わたしは だいがくせいです。あなた（　）だいがくせいですか。',
        'Jawabannya も. Pembicara sudah menyebut dirinya だいがくせい, lalu menanyakan apakah lawan bicara sama — jadi pakai も. の menyatakan kepemilikan, じゃ dipakai untuk bentuk negatif.'),
    (39, 'grammar', 1, 'ちちは せんせいじゃありません。はは（　）せんせいじゃありません。',
        'Jawabannya も. Partikel も juga dipakai di kalimat negatif, artinya juga tidak. Kedua orang sama-sama bukan せんせい.'),
    (40, 'grammar', 1, 'わたしの くには タイです。リナさんの くに（　）タイです。',
        'Jawabannya も, karena negara keduanya sama-sama タイ. Kalau memakai は, kesan juga yang sama itu hilang.'),
    (41, 'grammar', 1, 'わたし（　）なまえは アニサです。',
        'Jawabannya の — partikel kepemilikan. わたしのなまえ berarti nama saya. Ini pola inti Bab 3: KB1 の KB2.'),
    (42, 'grammar', 1, 'ちち（　）しごとは かいしゃいんです。',
        'Jawabannya の. ちちのしごと berarti pekerjaan ayah saya. は sudah dipakai setelah しごと sebagai penanda topik, jadi yang kosong pasti の.'),
    (43, 'grammar', 1, 'たなかさん（　）くには にほんです。',
        'Jawabannya の. たなかさんのくに berarti negara asal Tanaka-san. Sama seperti わたしのなまえ.'),
    (44, 'grammar', 1, 'あなたは にほんじんです（　）。',
        'Jawabannya か. Menambahkan か di akhir kalimat mengubahnya jadi pertanyaan. Dalam bahasa Jepang tanda tanya tidak dipakai — cukup か. ね meminta persetujuan, よ menegaskan informasi.'),
    (45, 'grammar', 1, '「あなたは りゅうがくせいです（　）。」「はい、りゅうがくせいです。」',
        'Jawabannya か. Kalimat pertama dijawab dengan はい, jadi kalimat itu pasti sebuah pertanyaan. ね dan よ tidak membuat kalimat menjadi pertanyaan.'),
    (46, 'grammar', 1, 'おなまえは なんです（　）。',
        'Jawabannya か. Kalimat yang memakai kata tanya なん wajib diakhiri か. Tanpa か kalimatnya belum menjadi pertanyaan.'),
    (47, 'grammar', 1, 'わたしは せんせい（　）ありません。',
        'Jawabannya じゃ. Bentuk negatif kata benda adalah 〜じゃありません. Bab 3 memakai bentuk じゃありません sebagai bentuk baku.'),
    (48, 'grammar', 1, 'あねは かんごし（　）ありません。いしゃです。',
        'Jawabannya じゃ, membentuk かんごしじゃありません yang berarti bukan perawat. Kalimat berikutnya menyebut pekerjaan yang sebenarnya, yaitu いしゃ.'),
    (49, 'grammar', 1, '「わたしも アニサさんも りゅうがくせいです（　）。」「はい！」',
        'Jawabannya ね. Partikel ね dipakai saat pembicara mengajak lawan bicara menyetujui hal yang sama-sama sudah diketahui, dan dijawab dengan はい. Di sini pembicara tahu tentang dirinya sendiri, jadi ini bukan pertanyaan か.'),
    (50, 'grammar', 1, '「たなかさんは がくせいですか。」「いいえ、せんせいです（　）。」',
        'Jawabannya よ. Partikel よ dipakai untuk menegaskan informasi baru yang belum diketahui lawan bicara — di sini meluruskan dugaan yang salah. Kalimat ini sudah jawaban, jadi tidak mungkin memakai か lagi.')
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
    (1,  0, 'がくせい', TRUE),      (1,  1, 'がっせい', FALSE),      (1,  2, 'がくせえ', FALSE),      (1,  3, 'かくせい', FALSE),
    (2,  0, 'せんせい', TRUE),      (2,  1, 'せんせえ', FALSE),      (2,  2, 'ぜんせい', FALSE),      (2,  3, 'せいせん', FALSE),
    (3,  0, 'だいがくせい', TRUE),  (3,  1, 'たいがくせい', FALSE),  (3,  2, 'だいかくせい', FALSE),  (3,  3, 'だいがくしょう', FALSE),
    (4,  0, 'こうこう', TRUE),      (4,  1, 'こおこう', FALSE),      (4,  2, 'こうごう', FALSE),      (4,  3, 'ごうこう', FALSE),
    (5,  0, 'なまえ', TRUE),        (5,  1, 'なまへ', FALSE),        (5,  2, 'なあまえ', FALSE),      (5,  3, 'めいまえ', FALSE),
    (6,  0, 'くに', TRUE),          (6,  1, 'こく', FALSE),          (6,  2, 'ぐに', FALSE),          (6,  3, 'くいに', FALSE),
    (7,  0, 'ちゅうごく', TRUE),    (7,  1, 'ちゅうこく', FALSE),    (7,  2, 'じゅうごく', FALSE),    (7,  3, 'ちゅごく', FALSE),
    (8,  0, 'かんこくじん', TRUE),  (8,  1, 'かんごくじん', FALSE),  (8,  2, 'かんこくにん', FALSE),  (8,  3, 'かんこくひと', FALSE),
    (9,  0, 'にほんじん', TRUE),    (9,  1, 'にほんにん', FALSE),    (9,  2, 'にっぽんにん', FALSE),  (9,  3, 'にほんひと', FALSE),
    (10, 0, 'にほんご', TRUE),      (10, 1, 'にほんこ', FALSE),      (10, 2, 'にっぽんご', FALSE),    (10, 3, 'にほんかた', FALSE),
    (11, 0, 'なんにん', TRUE),      (11, 1, 'なにじん', FALSE),      (11, 2, 'なんじん', FALSE),      (11, 3, 'なににん', FALSE),
    (12, 0, 'りゅうがくせい', TRUE),(12, 1, 'りゅがくせい', FALSE),  (12, 2, 'りゅうかくせい', FALSE),(12, 3, 'りゅうがくしょう', FALSE),

    -- 表記 — opsi kanji/katakana
    (13, 0, '学生', TRUE),     (13, 1, '学正', FALSE),     (13, 2, '字生', FALSE),     (13, 3, '学主', FALSE),
    (14, 0, '先生', TRUE),     (14, 1, '失生', FALSE),     (14, 2, '先正', FALSE),     (14, 3, '洗生', FALSE),
    (15, 0, '学校', TRUE),     (15, 1, '学枝', FALSE),     (15, 2, '学交', FALSE),     (15, 3, '字校', FALSE),
    (16, 0, '国', TRUE),       (16, 1, '困', FALSE),       (16, 2, '因', FALSE),       (16, 3, '回', FALSE),
    (17, 0, '人', TRUE),       (17, 1, '入', FALSE),       (17, 2, '八', FALSE),       (17, 3, '大', FALSE),
    (18, 0, '何', TRUE),       (18, 1, '可', FALSE),       (18, 2, '河', FALSE),       (18, 3, '荷', FALSE),
    (19, 0, 'ベトナム', TRUE), (19, 1, 'ヘトナム', FALSE), (19, 2, 'ペトナム', FALSE), (19, 3, 'ベトナヌ', FALSE),
    (20, 0, 'タイ', TRUE),     (20, 1, 'クイ', FALSE),     (20, 2, 'ダイ', FALSE),     (20, 3, 'タト', FALSE),
    (21, 0, 'インド', TRUE),   (21, 1, 'イソド', FALSE),   (21, 2, 'イント', FALSE),   (21, 3, 'インヅ', FALSE),

    -- 文脈規定
    (22, 0, 'よろしくおねがいします', TRUE), (22, 1, 'ありがとうございます', FALSE), (22, 2, 'すみません', FALSE), (22, 3, 'こちらこそ', FALSE),
    (23, 0, 'はじめまして', TRUE),           (23, 1, 'こちらこそ', FALSE),           (23, 2, 'どうぞ', FALSE),     (23, 3, 'すみません', FALSE),
    (24, 0, 'こちらこそ', TRUE),             (24, 1, 'はじめまして', FALSE),         (24, 2, 'どうぞ', FALSE),     (24, 3, 'ありがとうございます', FALSE),
    (25, 0, 'なまえ', TRUE),                 (25, 1, 'くに', FALSE),                 (25, 2, 'しごと', FALSE),     (25, 3, 'かぞく', FALSE),
    (26, 0, 'みょうじ', TRUE),               (26, 1, 'おなまえ', FALSE),             (26, 2, 'しゅっしん', FALSE), (26, 3, 'しごと', FALSE),
    (27, 0, 'しごと', TRUE),                 (27, 1, 'なまえ', FALSE),               (27, 2, 'くに', FALSE),       (27, 3, 'かぞく', FALSE),
    (28, 0, 'くに', TRUE),                   (28, 1, 'なまえ', FALSE),               (28, 2, 'しごと', FALSE),     (28, 3, 'みょうじ', FALSE),
    (29, 0, 'かんこくじん', TRUE),           (29, 1, 'かんこく', FALSE),             (29, 2, 'ちゅうごくじん', FALSE), (29, 3, 'にほんじん', FALSE),
    (30, 0, 'にほんじん', TRUE),             (30, 1, 'にほん', FALSE),               (30, 2, 'ちゅうごくじん', FALSE), (30, 3, 'かんこくじん', FALSE),
    (31, 0, 'がくせい', TRUE),               (31, 1, 'せんせい', FALSE),             (31, 2, 'かいしゃいん', FALSE), (31, 3, 'いしゃ', FALSE),
    (32, 0, 'かいしゃいん', TRUE),           (32, 1, 'ぎんこういん', FALSE),         (32, 2, 'がくせい', FALSE),   (32, 3, 'かんごし', FALSE),
    (33, 0, 'どうぞ', TRUE),                 (33, 1, 'すみません', FALSE),           (33, 2, 'はじめまして', FALSE), (33, 3, 'こちらこそ', FALSE),
    (34, 0, 'すみません', TRUE),             (34, 1, 'どうぞ', FALSE),               (34, 2, 'こちらこそ', FALSE), (34, 3, 'ありがとうございます', FALSE),

    -- 文の文法1
    (35, 0, 'は', TRUE),   (35, 1, 'も', FALSE),  (35, 2, 'の', FALSE),  (35, 3, 'か', FALSE),
    (36, 0, 'は', TRUE),   (36, 1, 'も', FALSE),  (36, 2, 'の', FALSE),  (36, 3, 'か', FALSE),
    (37, 0, 'も', TRUE),   (37, 1, 'は', FALSE),  (37, 2, 'の', FALSE),  (37, 3, 'か', FALSE),
    (38, 0, 'も', TRUE),   (38, 1, 'の', FALSE),  (38, 2, 'じゃ', FALSE),(38, 3, 'か', FALSE),
    (39, 0, 'も', TRUE),   (39, 1, 'は', FALSE),  (39, 2, 'の', FALSE),  (39, 3, 'か', FALSE),
    (40, 0, 'も', TRUE),   (40, 1, 'は', FALSE),  (40, 2, 'か', FALSE),  (40, 3, 'じゃ', FALSE),
    (41, 0, 'の', TRUE),   (41, 1, 'は', FALSE),  (41, 2, 'も', FALSE),  (41, 3, 'か', FALSE),
    (42, 0, 'の', TRUE),   (42, 1, 'は', FALSE),  (42, 2, 'も', FALSE),  (42, 3, 'か', FALSE),
    (43, 0, 'の', TRUE),   (43, 1, 'は', FALSE),  (43, 2, 'も', FALSE),  (43, 3, 'じゃ', FALSE),
    (44, 0, 'か', TRUE),   (44, 1, 'ね', FALSE),  (44, 2, 'よ', FALSE),  (44, 3, 'の', FALSE),
    (45, 0, 'か', TRUE),   (45, 1, 'ね', FALSE),  (45, 2, 'よ', FALSE),  (45, 3, 'も', FALSE),
    (46, 0, 'か', TRUE),   (46, 1, 'ね', FALSE),  (46, 2, 'よ', FALSE),  (46, 3, 'は', FALSE),
    (47, 0, 'じゃ', TRUE), (47, 1, 'は', FALSE),  (47, 2, 'も', FALSE),  (47, 3, 'の', FALSE),
    (48, 0, 'じゃ', TRUE), (48, 1, 'の', FALSE),  (48, 2, 'も', FALSE),  (48, 3, 'か', FALSE),
    (49, 0, 'ね', TRUE),   (49, 1, 'よ', FALSE),  (49, 2, 'か', FALSE),  (49, 3, 'も', FALSE),
    (50, 0, 'よ', TRUE),   (50, 1, 'ね', FALSE),  (50, 2, 'か', FALSE),  (50, 3, 'の', FALSE)
  )
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT qq.id, o.option_text, o.ok, o.ord
    FROM o
    JOIN quiz_questions qq
      ON qq.lesson_id = v_lesson_id AND qq.sort_order = o.qno;

  IF (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id) <> 50 THEN
    RAISE EXCEPTION '042: jumlah soal bukan 50 (dapat %)',
      (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
      LEFT JOIN quiz_options qo ON qo.question_id = qq.id
     WHERE qq.lesson_id = v_lesson_id
     GROUP BY qq.id
    HAVING COUNT(qo.id) <> 4 OR COUNT(*) FILTER (WHERE qo.is_correct) <> 1
  ) THEN
    RAISE EXCEPTION '042: ada soal yang opsinya bukan 4 atau kuncinya bukan tepat 1';
  END IF;

  -- Pagar level: kanji HANYA boleh muncul di dalam <u>…</u> (target 漢字読み).
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND regexp_replace(question, '<u>[^<]*</u>', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '042: ada kanji di luar target <u>…</u> pada teks soal';
  END IF;

  -- Pagar level: partikel yang belum diajarkan di Bab 3 tidak boleh muncul.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND question ~ '(が |を |で |へ |に |と )'
  ) THEN
    RAISE EXCEPTION '042: ada partikel di luar materi Bab 3 (が/を/で/へ/に/と) pada teks soal';
  END IF;

  -- Pagar level: これ/それ/あれ/この/その/あの/どこ/ここ = Bab 4 ke atas.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND question ~ '(これ|それ|あれ|どれ|この |その |あの |どこ|ここ|そこ|あそこ)'
  ) THEN
    RAISE EXCEPTION '042: ada kata tunjuk Bab 4 (これ/それ/あれ/この/どこ dst) pada teks soal';
  END IF;

  -- Pagar level: rantai の DALAM SATU KALIMAT dilarang (「かんこくの だいがくの
  -- がくせい」). Dua kalimat yang masing-masing punya satu の tetap boleh —
  -- makanya polanya の…の tanpa melewati 。, bukan hitung の per baris.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND question ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '042: ada kalimat dengan rantai の (lebih dari satu の dalam satu kalimat)';
  END IF;

  RAISE NOTICE '042: selesai — 50 soal (vocabulary 34, grammar 16), semua pagar level lolos.';
END $$;
