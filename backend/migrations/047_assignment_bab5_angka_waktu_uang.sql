-- 047_assignment_bab5_angka_waktu_uang.sql — Assignment Bab 5: Angka, Waktu & Uang.
--
-- Ujian bab untuk Bab 5, sumber Notion N5-B5 "Angka, Waktu & Uang". Modul
-- di-resolve ordinal (OFFSET 4, lanjutan pola 039-046).
--
-- KANJI: 10 kanji baru resmi Bab 5 — 一二三四五六七八九十. Ditambah keputusan
-- desain (dikonfirmasi user): 時／分／円／百／千／万／年／月／半／歳／午前／
-- 午後 dianggap TAUGHT juga walau tidak ada di katalog "Kanji First
-- Introduced" — kata-kata itu adalah kosakata inti Bab 5 dan memang selalu
-- ditulis berkanji bahkan di JLPT N5 asli. Ini pengecualian SEMPIT khusus
-- counter Bab 5, bukan pelonggaran umum: kata Bab 3/4 yang tidak masuk
-- katalog resmi (出身・家族・兄・姉 dst) tetap wajib kana seperti di 042.
-- Kanji whitelist badan kalimat = union: 人名何学校先生国語本花魚 (12, Bab3-4)
-- + 一二三四五六七八九十 (10, Bab5 resmi) + 時分円百千万年月半歳午前午後
-- (12, counter Bab5 yang diperlakukan taught).
--
-- GRAMMAR: 4 pola Bab 5 (GRM-22..25) — これはいくらですか／今〜時〜分です／
-- 〜時から〜時まで／おいくつですか・何歳ですか — jadi fokus grammar §1,
-- dengan sedikit review pola Bab 3/4 (fresh kalimat, bukan diambil dari
-- 042/045). から／まで BARU diizinkan di sini (belum diizinkan di 042/045
-- karena belum diajarkan saat itu).
--
-- ADJEKTIVA: たかい／やすい／おおい adalah kosakata resmi Bab 5 (mahal/murah/
-- banyak), jadi TIDAK dilarang di sini — beda dari 042/045 yang melarang
-- total kata sifat karena belum diajarkan. Kata sifat LAIN yang masih belum
-- diajarkan (おもしろい・じょうず・おおきい・ちいさい・あたらしい・ふるい)
-- tetap dilarang. KATA KERJA masih dilarang total (termasuk あります／います
-- — existence verb baru diajarkan di Bab 8, bukan Bab 5) — semua kalimat di
-- sini murni pola AはBです / から〜まで, tanpa satu pun kata kerja.
--
-- DEDUP WAJIB (permintaan eksplisit user): tidak boleh menguji ulang soal
-- yang sudah diujikan di 042 (Bab 3) / 045 (Bab 4). Sudah di-grep 30 target
-- <u>…</u> unik yang pernah dipakai kedua migrasi itu — daftar lengkap ada
-- di bawah sebagai assertion SQL (bukan sekadar catatan). Karena topik Bab 5
-- (angka/waktu/uang) sama sekali belum disentuh 042/045, seluruh 21 target
-- <u> migrasi ini otomatis baru; assertion di bawah membuktikannya secara
-- mesin, bukan cuma "kelihatannya beda".
--
-- BACAAN JAM/MENIT/RATUS TIDAK BERATURAN — inti kesulitan Bab 5, wajib diuji
-- (permintaan eksplisit user). Semua kasus di bawah adalah bacaan standar
-- N5/JLPT yang TIDAK ambigu (berbeda dari 七時 yang punya dua bacaan valid
-- しちじ／ななじ tergantung konteks — sengaja DIHINDARI sebagai target supaya
-- tidak ada kunci jawaban yang diperdebatkan):
--   時: 四時＝よじ (bukan よんじ), 九時＝くじ (bukan きゅうじ)
--   分: 七分＝ななふん (bukan しちふん), 一分＝いっぷん, 六分＝ろっぷん,
--       十分＝じゅっぷん
--   人: 一人＝ひとり, 二人＝ふたり (bukan いちにん／ににん)
--   歳: 二十歳＝はたち (bukan にじゅっさい)
--   百: 三百円＝さんびゃくえん, 六百円＝ろっぴゃくえん, 八百円＝はっぴゃくえん
--
-- Komposisi: もんだい1 漢字読み 12 + もんだい2 表記 9 + もんだい3 文脈規定 13
-- + もんだい1 文の文法1 16 = pool 50, sample 30 per attempt, lulus 70%,
-- cooldown 12 jam — seimbang seperti assignment Bab 3/4 (pilihan user).
--
-- PERINGATAN RE-RUN: DELETE FROM quiz_questions di bawah tanpa syarat — kalau
-- admin sudah menambah soal manual/AI ke pelajaran ini, re-run migrasi ini
-- manual akan menghapusnya. Runner (migrations/run.js) cuma menjalankan file
-- ini SEKALI per DB (tercatat di schema_migrations).
--
-- Idempotent: lesson di-upsert per (module_id, slug), soal lama dihapus lalu
-- di-insert ulang; no-op aman kalau modul target belum ada.

DO $$
DECLARE
  v_course_slug  TEXT := 'n5';
  v_lesson_slug  TEXT := 'assignment-bab-5-angka-waktu-uang';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson_id    UUID;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 4 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '047: modul Bab 5 di kursus % tidak ditemukan — skip seed assignment.', v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* '(angka|waktu|uang)' THEN
    RAISE NOTICE '047: modul Bab 5 terbaca "%" — kalau ternyata bukan Bab Angka/Waktu/Uang, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).', v_module_title;
  END IF;

  RAISE NOTICE '047: seed Assignment Bab 5 ke modul "%".', v_module_title;

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, questions_per_attempt, cooldown_hours
  ) VALUES (
    v_module_id, v_lesson_slug, 'Assignment Bab 5 — Angka, Waktu & Uang', 'quiz',
    'Tes materi Bab 5 (Angka, Waktu & Uang) gaya JLPT. Moji-Goi: cara baca angka 一〜十 dan bacaan tidak beraturan jam/menit/ratus (4時＝よじ, 9時＝くじ, 一人＝ひとり dst), cara menulisnya, serta kosakata waktu dan uang sesuai konteks. Tata Bahasa: いくらですか, 〜時から〜時まで, おいくつですか／何歳ですか. Tiap attempt mengambil 30 soal acak dari 50. Lulus 70% (21/30), cooldown 12 jam.',
    25, 100, 70, 30, 12
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
    -- ===== もんだい1 漢字読み (1-12) — fokus bacaan tidak beraturan Bab 5 =====
    (1, 'vocabulary'::TEXT, 1, 'いまは <u>四時</u>です。',
        '四時 dibaca よじ. Ini pengecualian penting: 四 sendirian dibaca よん, tapi digabung dengan 時 dibaca よ (bukan よん). よんじ adalah kesalahan paling umum. しじ dan よつじ juga bukan bacaan yang benar.'),
    (2, 'vocabulary', 1, 'いまは <u>九時</u>です。',
        '九時 dibaca くじ. 九 digabung dengan 時 dibaca く (bukan きゅう). きゅうじ adalah kesalahan paling umum. くうじ dan ここのじ juga bukan bacaan yang benar.'),
    (3, 'vocabulary', 1, 'テストは <u>七分</u>です。',
        '七分 dibaca ななふん. Kata 七 di sini dipakai bacaan なな (bukan しち), beda dari 七時＝しちじ yang memakai しち. しちふん bukan bacaan yang benar untuk 分.'),
    (4, 'vocabulary', 1, 'あには <u>一人</u>です。',
        '一人 dibaca ひとり — bacaan khusus untuk satu orang, bukan いちにん. いちにん dan ひとつ bukan bacaan yang benar di sini.'),
    (5, 'vocabulary', 1, 'かぞくは <u>二人</u>です。',
        '二人 dibaca ふたり — bacaan khusus untuk dua orang, bukan ににん. ににん dan ふたつ bukan bacaan yang benar di sini.'),
    (6, 'vocabulary', 1, 'あねは <u>二十歳</u>です。',
        '二十歳 dibaca はたち — bacaan khusus untuk umur 20 tahun, tidak memakai pola にじゅっさい seperti umur lainnya. にじゅっさい dan はつか (bacaan untuk tanggal 20) bukan bacaan yang benar di sini.'),
    (7, 'vocabulary', 1, 'いまは 五時 <u>一分</u>です。',
        '一分 dibaca いっぷん. 一 digabung 分 memakai sokuon っ dan ぷん (bukan ふん). いちふん dan いちぷん bukan bacaan yang benar.'),
    (8, 'vocabulary', 1, 'いまは 五時 <u>六分</u>です。',
        '六分 dibaca ろっぷん. 六 digabung 分 memakai sokuon っ dan ぷん (bukan ふん). ろくふん dan ろくぷん bukan bacaan yang benar.'),
    (9, 'vocabulary', 1, 'いまは 五時 <u>十分</u>です。',
        '十分 dibaca じゅっぷん. 十 digabung 分 memakai sokuon っ dan ぷん (bukan ふん). じゅうふん dan じゅうぷん bukan bacaan yang benar.'),
    (10, 'vocabulary', 1, 'この ペンは <u>三百円</u>です。',
        '三百円 dibaca さんびゃくえん. 百 setelah 三 berubah jadi びゃく (dakuten). さんひゃくえん (tanpa dakuten) dan さんぴゃくえん (handakuten, salah tempat) bukan bacaan yang benar.'),
    (11, 'vocabulary', 1, 'この とけいは <u>六百円</u>です。',
        '六百円 dibaca ろっぴゃくえん. 百 setelah 六 memakai sokuon っ dan ぴゃく (handakuten). ろくひゃくえん dan ろくびゃくえん bukan bacaan yang benar.'),
    (12, 'vocabulary', 1, 'この かばんは <u>八百円</u>です。',
        '八百円 dibaca はっぴゃくえん. 百 setelah 八 memakai sokuon っ dan ぴゃく (handakuten), sama polanya dengan 六百. はちひゃくえん dan はちびゃくえん bukan bacaan yang benar.'),

    -- ===== もんだい2 表記 (13-21) — target hiragana, jawaban bentuk tulisan =====
    (13, 'vocabulary', 2, 'いまは <u>ごじ</u>です。',
        'ごじ ditulis 五時. Salah: 六時 (ろくじ), 四時 (よじ), 九時 (くじ) — semuanya angka jam yang berbeda.'),
    (14, 'vocabulary', 2, 'いまは <u>はちじ</u>です。',
        'はちじ ditulis 八時. Salah: 六時 (ろくじ), 九時 (くじ), 四時 (よじ) — semuanya angka jam yang berbeda.'),
    (15, 'vocabulary', 2, 'いまは <u>じゅうにじ</u>です。',
        'じゅうにじ ditulis 十二時. Salah: 十一時 (じゅういちじ, angka berbeda), 二十時 (にじゅうじ, urutan kanji terbalik), 十時 (じゅうじ, kurang satu kanji).'),
    (16, 'vocabulary', 2, 'いまは 五時 <u>はん</u>です。',
        'はん ditulis 半 (setengah). Salah: 羊 (ひつじ), 米 (こめ), 平 (へい) — bentuknya sekilas mirip tapi artinya berbeda jauh.'),
    (17, 'vocabulary', 2, 'この かばんは <u>せんえん</u>です。',
        'せんえん ditulis 千円. Salah: 干円 (干 kehilangan satu titik dari 千, bentuknya sangat mirip), 十円 (じゅうえん), 百円 (ひゃくえん).'),
    (18, 'vocabulary', 2, 'この とけいは <u>まんえん</u>です。',
        'まんえん ditulis 万円. Salah: 方円 (方 bentuknya mirip 万), 千円 (せんえん), 百円 (ひゃくえん).'),
    (19, 'vocabulary', 2, 'テストは <u>ごぜん</u>です。',
        'ごぜん ditulis 午前. Salah: 牛前 (牛 bentuknya mirip 午), 午後 (ごご, kebalikan artinya), 五前 (bukan kata yang benar).'),
    (20, 'vocabulary', 2, 'テストは <u>ごご</u>です。',
        'ごご ditulis 午後. Salah: 牛後 (牛 bentuknya mirip 午), 午前 (ごぜん, kebalikan artinya), 五五 (bukan kata yang benar).'),
    (21, 'vocabulary', 2, '<u>なんじ</u>ですか。',
        'なんじ ditulis 何時. Salah: 何字 (字 artinya huruf, bukan waktu), 何寺 (寺 artinya kuil), 何持 (持 artinya membawa) — ketiganya berbagi bentuk kanan yang mirip 時.'),

    -- ===== もんだい3 文脈規定 (22-34) — kosakata waktu/uang/umur, 100% kana =====
    (22, 'vocabulary', 3, '（　）は ６じから ８じまでです。',
        'Jawabannya あさ (pagi) — rentang jam 6 sampai 8 pagi. ひる (siang), よる (malam), dan ゆうがた (sore) tidak cocok dengan jam segitu.'),
    (23, 'vocabulary', 3, '（　）は １２じから １じまでです。',
        'Jawabannya ひる (siang) — jam 12 siang sampai 1 siang. あさ, よる, dan ゆうがた tidak cocok dengan jam segitu.'),
    (24, 'vocabulary', 3, '（　）は ６じから ７じまでです。',
        'Jawabannya ゆうがた (sore) — jam 6 sampai 7 sore, transisi antara siang dan malam. あさ, ひる, dan よる tidak cocok dengan jam segitu.'),
    (25, 'vocabulary', 3, '（　）は １０じから ６じまでです。',
        'Jawabannya よる (malam). あさ, ひる, dan ゆうがた tidak cocok dengan jam malam segitu.'),
    (26, 'vocabulary', 3, '（　）は ９じから １２じまでです。',
        'Jawabannya ごぜん (AM/sebelum tengah hari) — jam 9 sampai 12 siang. ごご berarti sesudah tengah hari, jadi tidak cocok. あさ dan ひる bukan istilah AM/PM.'),
    (27, 'vocabulary', 3, '（　）は １じから ５じまでです。',
        'Jawabannya ごご (PM/sesudah tengah hari) — jam 1 sampai 5 sore. ごぜん berarti sebelum tengah hari, jadi tidak cocok. よる dan ゆうがた bukan istilah AM/PM.'),
    (28, 'vocabulary', 3, 'これは １００００円です。（　）ですね。',
        'Jawabannya たかい (mahal) — 10000円 termasuk harga tinggi. やすい berarti murah, むりょう berarti gratis, すこし berarti sedikit — ketiganya tidak cocok untuk menilai harga tinggi.'),
    (29, 'vocabulary', 3, 'これは １００円です。（　）ですね。',
        'Jawabannya やすい (murah) — 100円 termasuk harga rendah. たかい berarti mahal, むりょう berarti gratis (0円, bukan 100円), たくさん berarti banyak — ketiganya tidak cocok.'),
    (30, 'vocabulary', 3, 'これは ０円です。（　）ですね。',
        'Jawabannya むりょう (gratis) — harga 0円 berarti gratis. たかい dan やすい tetap mengasumsikan ada harga, すこし berarti sedikit — ketiganya tidak cocok untuk 0円.'),
    (31, 'vocabulary', 3, 'りんごは（　）ですか。「はい、たくさんです。」',
        'Jawabannya たくさん (banyak), sesuai jawaban はい、たくさんです. すこし berarti sedikit, ぜんぶ berarti semuanya, やく berarti kira-kira — ketiganya tidak cocok dengan jawaban itu.'),
    (32, 'vocabulary', 3, 'おかねは（　）ですか。「はい、すこしです。」',
        'Jawabannya すこし (sedikit), sesuai jawaban はい、すこしです. たくさん berarti banyak, ぜんぶ berarti semuanya, やく berarti kira-kira — ketiganya tidak cocok dengan jawaban itu.'),
    (33, 'vocabulary', 3, 'たなかさんは（　）ですか。「さんじゅっさいです。」',
        'Jawabannya おいくつ — cara sopan menanyakan umur, dijawab dengan angka+さい. いくら menanyakan harga, なんじ menanyakan jam, なんにん menanyakan jumlah orang — ketiganya tidak cocok untuk menanyakan umur.'),
    (34, 'vocabulary', 3, 'ちちは（　）です。わたしは こどもです。',
        'Jawabannya おとな (orang dewasa), berpasangan dengan こども (anak) di kalimat berikutnya. がくせい dan せんせい adalah profesi/status, bukan pasangan kata untuk こども di konteks ini.'),

    -- ===== もんだい1 文の文法1 (35-50) — fokus 4 pola Bab 5 =====
    (35, 'grammar'::TEXT, 1, 'この ペンは（　）ですか。「さんびゃくえんです。」',
        'Jawabannya いくら (menanyakan harga), dijawab dengan angka+円. なんじ menanyakan jam, おいくつ menanyakan umur, だれの menanyakan pemilik — ketiganya tidak cocok dengan jawaban harga.'),
    (36, 'grammar', 1, 'この とけいは（　）ですか。「ごせんえんです。」',
        'Jawabannya いくら, dijawab dengan angka+円. なんじ, おいくつ, dan だれの tidak cocok dengan jawaban harga.'),
    (37, 'grammar', 1, 'これは（　）ですか。「むりょうです。」',
        'Jawabannya いくら — walau jawabannya むりょう (gratis), pertanyaannya tetap menanyakan harga. なんじ, おいくつ, dan だれの tidak cocok.'),
    (38, 'grammar', 1, 'いま（　）ですか。「くじです。」',
        'Jawabannya なんじ (menanyakan jam), dijawab dengan angka+時. いくら menanyakan harga, おいくつ menanyakan umur, だれ menanyakan orang — ketiganya tidak cocok dengan jawaban jam.'),
    (39, 'grammar', 1, 'テストは（　）ですか。「くじ じゅうごふんです。」',
        'Jawabannya なんじ, dijawab dengan angka jam dan menit. いくら, おいくつ, dan なんにん tidak cocok dengan jawaban jam.'),
    (40, 'grammar', 1, 'あには（　）ですか。「にじゅうごさいです。」',
        'Jawabannya なんさい (menanyakan umur, santai), dijawab dengan angka+歳. いくら menanyakan harga, なんじ menanyakan jam, だれの menanyakan pemilik — ketiganya tidak cocok dengan jawaban umur.'),
    (41, 'grammar', 1, 'せんせいは（　）ですか。「ごじゅっさいです。」',
        'Jawabannya おいくつ (menanyakan umur, sopan — cocok dipakai untuk guru), dijawab dengan angka+歳. いくら menanyakan harga, なんじ menanyakan jam, どの wajib diikuti kata benda — ketiganya tidak cocok.'),
    (42, 'grammar', 1, 'わたしは じゅうきゅう（　）です。',
        'Jawabannya さい (歳, satuan untuk menyatakan umur). ど, かい, dan にん adalah satuan untuk hal lain (suhu/frekuensi, kali, orang), bukan untuk umur.'),
    (43, 'grammar', 1, 'これは（　）とけいですか。「ちちのです。」',
        'Jawabannya だれの (punya siapa), karena dijawab dengan ちちのです yang menyebut pemilik. なんの menanyakan jenis, どの wajib diikuti kata benda tapi tidak menanyakan pemilik, いくら menanyakan harga.'),
    (44, 'grammar', 1, 'かいしゃは ９じ（　）５じまでです。',
        'Jawabannya から (dari), menandai titik awal sebelum まで. まで menandai titik akhir, jadi tidak cocok di posisi pertama. も dan の tidak membentuk rentang waktu.'),
    (45, 'grammar', 1, 'がっこうは ８じから ３じ（　）です。',
        'Jawabannya まで (sampai), menandai titik akhir setelah から di awal kalimat. から menandai titik awal, jadi tidak cocok di posisi kedua. も dan の tidak membentuk rentang waktu.'),
    (46, 'grammar', 1, 'なんじ（　）なんじまでですか。',
        'Jawabannya から, karena berpasangan dengan まで yang sudah ada di kalimat untuk menanyakan rentang waktu. まで tidak bisa dipakai dua kali, も dan の tidak membentuk rentang waktu.'),
    (47, 'grammar', 1, 'デパートは １０じから ８じ（　）です。',
        'Jawabannya まで, menandai jam tutup setelah から di awal kalimat. から sudah dipakai di awal, jadi tidak cocok dipakai lagi. も dan の tidak membentuk rentang waktu.'),
    (48, 'grammar', 1, 'あの とけいは たかいです（　）。「はい、そうです。」',
        'Jawabannya か. Kalimat itu dijawab dengan はい、そうです, jadi pasti sebuah pertanyaan. ね meminta persetujuan (bukan pertanyaan ya/tidak), よ menegaskan informasi, の menyatakan kepemilikan — ketiganya tidak cocok di sini.'),
    (49, 'grammar', 1, 'いま くじは まだ あさです（　）。',
        'Jawabannya ね. Partikel ね dipakai saat pembicara mengajak lawan bicara menyetujui hal yang sama-sama sudah jelas (jam 9 masih pagi). か mengubah kalimat jadi pertanyaan yang tidak cocok di sini, よ menegaskan info baru yang belum diketahui.'),
    (50, 'grammar', 1, 'この かばんは さんぜんえんです（　）。「え、たかいですね。」',
        'Jawabannya よ. Partikel よ dipakai untuk menegaskan informasi baru yang belum diketahui lawan bicara — di sini memberi tahu harga yang membuat lawan bicara kaget. ね mengajak persetujuan atas hal yang sudah diketahui bersama, jadi tidak cocok untuk info baru.')
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
    (1,  0, 'よじ', TRUE),          (1,  1, 'よんじ', FALSE),       (1,  2, 'しじ', FALSE),         (1,  3, 'よつじ', FALSE),
    (2,  0, 'くじ', TRUE),          (2,  1, 'きゅうじ', FALSE),     (2,  2, 'くうじ', FALSE),       (2,  3, 'ここのじ', FALSE),
    (3,  0, 'ななふん', TRUE),      (3,  1, 'しちふん', FALSE),     (3,  2, 'ななぷん', FALSE),     (3,  3, 'しちぷん', FALSE),
    (4,  0, 'ひとり', TRUE),        (4,  1, 'いちにん', FALSE),     (4,  2, 'ひとつ', FALSE),       (4,  3, 'いちり', FALSE),
    (5,  0, 'ふたり', TRUE),        (5,  1, 'ににん', FALSE),       (5,  2, 'ふたつ', FALSE),       (5,  3, 'にり', FALSE),
    (6,  0, 'はたち', TRUE),        (6,  1, 'にじゅっさい', FALSE), (6,  2, 'はつか', FALSE),       (6,  3, 'にじゅうさい', FALSE),
    (7,  0, 'いっぷん', TRUE),      (7,  1, 'いちふん', FALSE),     (7,  2, 'いちぷん', FALSE),     (7,  3, 'いっふん', FALSE),
    (8,  0, 'ろっぷん', TRUE),      (8,  1, 'ろくふん', FALSE),     (8,  2, 'ろくぷん', FALSE),     (8,  3, 'ろっふん', FALSE),
    (9,  0, 'じゅっぷん', TRUE),    (9,  1, 'じゅうふん', FALSE),   (9,  2, 'じゅうぷん', FALSE),   (9,  3, 'じっふん', FALSE),
    (10, 0, 'さんびゃくえん', TRUE),(10, 1, 'さんひゃくえん', FALSE),(10, 2, 'さんぴゃくえん', FALSE),(10, 3, 'さんばくえん', FALSE),
    (11, 0, 'ろっぴゃくえん', TRUE),(11, 1, 'ろくひゃくえん', FALSE),(11, 2, 'ろくびゃくえん', FALSE),(11, 3, 'ろっひゃくえん', FALSE),
    (12, 0, 'はっぴゃくえん', TRUE),(12, 1, 'はちひゃくえん', FALSE),(12, 2, 'はちびゃくえん', FALSE),(12, 3, 'はっひゃくえん', FALSE),

    -- 表記 — opsi bentuk tulisan
    (13, 0, '五時', TRUE),  (13, 1, '六時', FALSE),  (13, 2, '四時', FALSE),  (13, 3, '九時', FALSE),
    (14, 0, '八時', TRUE),  (14, 1, '六時', FALSE),  (14, 2, '九時', FALSE),  (14, 3, '四時', FALSE),
    (15, 0, '十二時', TRUE),(15, 1, '十一時', FALSE),(15, 2, '二十時', FALSE),(15, 3, '十時', FALSE),
    (16, 0, '半', TRUE),    (16, 1, '羊', FALSE),    (16, 2, '米', FALSE),    (16, 3, '平', FALSE),
    (17, 0, '千円', TRUE),  (17, 1, '干円', FALSE),  (17, 2, '十円', FALSE),  (17, 3, '百円', FALSE),
    (18, 0, '万円', TRUE),  (18, 1, '方円', FALSE),  (18, 2, '千円', FALSE),  (18, 3, '百円', FALSE),
    (19, 0, '午前', TRUE),  (19, 1, '牛前', FALSE),  (19, 2, '午後', FALSE),  (19, 3, '五前', FALSE),
    (20, 0, '午後', TRUE),  (20, 1, '牛後', FALSE),  (20, 2, '午前', FALSE),  (20, 3, '五五', FALSE),
    (21, 0, '何時', TRUE),  (21, 1, '何字', FALSE),  (21, 2, '何寺', FALSE),  (21, 3, '何持', FALSE),

    -- 文脈規定
    (22, 0, 'あさ', TRUE),   (22, 1, 'ひる', FALSE),   (22, 2, 'よる', FALSE),   (22, 3, 'ゆうがた', FALSE),
    (23, 0, 'ひる', TRUE),   (23, 1, 'あさ', FALSE),   (23, 2, 'よる', FALSE),   (23, 3, 'ゆうがた', FALSE),
    (24, 0, 'ゆうがた', TRUE),(24, 1, 'あさ', FALSE),  (24, 2, 'ひる', FALSE),   (24, 3, 'よる', FALSE),
    (25, 0, 'よる', TRUE),   (25, 1, 'あさ', FALSE),   (25, 2, 'ひる', FALSE),   (25, 3, 'ゆうがた', FALSE),
    (26, 0, 'ごぜん', TRUE), (26, 1, 'ごご', FALSE),   (26, 2, 'あさ', FALSE),   (26, 3, 'ひる', FALSE),
    (27, 0, 'ごご', TRUE),   (27, 1, 'ごぜん', FALSE), (27, 2, 'よる', FALSE),   (27, 3, 'ゆうがた', FALSE),
    (28, 0, 'たかい', TRUE), (28, 1, 'やすい', FALSE), (28, 2, 'むりょう', FALSE), (28, 3, 'すこし', FALSE),
    (29, 0, 'やすい', TRUE), (29, 1, 'たかい', FALSE), (29, 2, 'むりょう', FALSE), (29, 3, 'たくさん', FALSE),
    (30, 0, 'むりょう', TRUE), (30, 1, 'たかい', FALSE), (30, 2, 'やすい', FALSE), (30, 3, 'すこし', FALSE),
    (31, 0, 'たくさん', TRUE), (31, 1, 'すこし', FALSE), (31, 2, 'ぜんぶ', FALSE), (31, 3, 'やく', FALSE),
    (32, 0, 'すこし', TRUE), (32, 1, 'たくさん', FALSE), (32, 2, 'ぜんぶ', FALSE), (32, 3, 'やく', FALSE),
    (33, 0, 'おいくつ', TRUE), (33, 1, 'いくら', FALSE), (33, 2, 'なんじ', FALSE), (33, 3, 'なんにん', FALSE),
    (34, 0, 'おとな', TRUE), (34, 1, 'こども', FALSE), (34, 2, 'がくせい', FALSE), (34, 3, 'せんせい', FALSE),

    -- 文の文法1
    (35, 0, 'いくら', TRUE), (35, 1, 'なんじ', FALSE), (35, 2, 'おいくつ', FALSE), (35, 3, 'だれの', FALSE),
    (36, 0, 'いくら', TRUE), (36, 1, 'なんじ', FALSE), (36, 2, 'おいくつ', FALSE), (36, 3, 'だれの', FALSE),
    (37, 0, 'いくら', TRUE), (37, 1, 'なんじ', FALSE), (37, 2, 'おいくつ', FALSE), (37, 3, 'だれの', FALSE),
    (38, 0, 'なんじ', TRUE), (38, 1, 'いくら', FALSE), (38, 2, 'おいくつ', FALSE), (38, 3, 'だれ', FALSE),
    (39, 0, 'なんじ', TRUE), (39, 1, 'いくら', FALSE), (39, 2, 'おいくつ', FALSE), (39, 3, 'なんにん', FALSE),
    (40, 0, 'なんさい', TRUE), (40, 1, 'いくら', FALSE), (40, 2, 'なんじ', FALSE), (40, 3, 'だれの', FALSE),
    (41, 0, 'おいくつ', TRUE), (41, 1, 'いくら', FALSE), (41, 2, 'なんじ', FALSE), (41, 3, 'どの', FALSE),
    (42, 0, 'さい', TRUE),   (42, 1, 'ど', FALSE),     (42, 2, 'かい', FALSE),   (42, 3, 'にん', FALSE),
    (43, 0, 'だれの', TRUE), (43, 1, 'なんの', FALSE), (43, 2, 'どの', FALSE),   (43, 3, 'いくら', FALSE),
    (44, 0, 'から', TRUE),   (44, 1, 'まで', FALSE),   (44, 2, 'も', FALSE),     (44, 3, 'の', FALSE),
    (45, 0, 'まで', TRUE),   (45, 1, 'から', FALSE),   (45, 2, 'も', FALSE),     (45, 3, 'の', FALSE),
    (46, 0, 'から', TRUE),   (46, 1, 'まで', FALSE),   (46, 2, 'も', FALSE),     (46, 3, 'の', FALSE),
    (47, 0, 'まで', TRUE),   (47, 1, 'から', FALSE),   (47, 2, 'も', FALSE),     (47, 3, 'の', FALSE),
    (48, 0, 'か', TRUE),     (48, 1, 'ね', FALSE),     (48, 2, 'よ', FALSE),     (48, 3, 'の', FALSE),
    (49, 0, 'ね', TRUE),     (49, 1, 'よ', FALSE),     (49, 2, 'か', FALSE),     (49, 3, 'も', FALSE),
    (50, 0, 'よ', TRUE),     (50, 1, 'ね', FALSE),     (50, 2, 'か', FALSE),     (50, 3, 'も', FALSE)
  )
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT qq.id, o.option_text, o.ok, o.ord
    FROM o
    JOIN quiz_questions qq
      ON qq.lesson_id = v_lesson_id AND qq.sort_order = o.qno;

  -- ===== Assertion bentuk =====
  IF (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id) <> 50 THEN
    RAISE EXCEPTION '047: jumlah soal bukan 50 (dapat %)',
      (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
      LEFT JOIN quiz_options qo ON qo.question_id = qq.id
     WHERE qq.lesson_id = v_lesson_id
     GROUP BY qq.id
    HAVING COUNT(qo.id) <> 4 OR COUNT(*) FILTER (WHERE qo.is_correct) <> 1
  ) THEN
    RAISE EXCEPTION '047: ada soal yang opsinya bukan 4 atau kuncinya bukan tepat 1';
  END IF;

  -- ===== Pagar level =====

  -- 1. Badan kalimat (di LUAR target <u>…</u>) hanya boleh memakai kanji
  --    taught: 12 lama (Bab3-4) + 10 angka (Bab5) + 12 counter Bab5 yang
  --    diperlakukan taught (時分円百千万年月半歳午前午後).
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND regexp_replace(
             regexp_replace(question, '<u>[^<]*</u>', '', 'g'),
             '[人名何学校先生国語本花魚一二三四五六七八九十時分円百千万年月半歳午前午後]', '', 'g'
           ) ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '047: ada kanji di luar daftar taught pada badan kalimat soal';
  END IF;

  -- 2. Partikel yang belum diajarkan sampai Bab 5 (が/を/で/に/へ/と). から dan
  --    まで SENGAJA tidak dilarang di sini — itu materi baru Bab 5 (GRM-24).
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND question ~ '(が |を |で |へ |に |と )'
  ) THEN
    RAISE EXCEPTION '047: ada partikel di luar materi Bab 1-5 pada teks soal';
  END IF;

  -- 3. Kata kerja masih dilarang total (termasuk あります／います — existence
  --    verb baru Bab 8, bukan Bab 5). Frasa aman (bentuk negatif kata benda +
  --    salam baku + そうです pola Bab 4) dibuang dulu sebelum dicek.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND replace(replace(replace(replace(replace(replace(replace(question,
             'そうじゃありません', ''), 'じゃありません', ''), 'ありません', ''),
             'よろしくおねがいします', ''), 'ありがとうございます', ''), 'そうです', ''),
             'すみません', '')
           ~ '(ます|ました|ません|いる|ある|いて|べんきょう|わかり|はたら)'
  ) THEN
    RAISE EXCEPTION '047: ada indikasi kata kerja pada teks soal';
  END IF;

  -- 4. Kata sifat yang MASIH belum diajarkan sampai Bab 5 (Bab 6-7). たかい／
  --    やすい／おおい SENGAJA tidak dilarang — itu kosakata resmi Bab 5.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND question ~ '(おもしろい|じょうず|おおきい|ちいさい|あたらしい|ふるい)'
  ) THEN
    RAISE EXCEPTION '047: ada kata sifat yang belum diajarkan (Bab 6-7) pada teks soal';
  END IF;

  -- 5. Rantai の dalam satu kalimat.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '047: ada kalimat dengan rantai の (lebih dari satu の dalam satu kalimat)';
  END IF;

  -- 6. Target section: もんだい1 wajib kanji di dalam <u>, もんだい2 wajib kana.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 1
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '') !~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '047: ada soal 漢字読み yang target <u> nya tidak mengandung kanji';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 2
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '一') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '047: ada soal 表記 yang target <u> nya sudah berupa kanji';
  END IF;

  -- 7. DEDUP WAJIB — target <u> tidak boleh sama dengan salah satu dari 30
  --    target unik yang sudah dipakai di 042 (Bab 3) & 045 (Bab 4).
  IF EXISTS (
    SELECT 1 FROM quiz_questions qq,
      LATERAL (SELECT (regexp_match(qq.question, '<u>([^<]*)</u>'))[1] AS tgt) t
     WHERE qq.lesson_id = v_lesson_id
       AND t.tgt = ANY (ARRAY[
         'いんど','がくせい','がっこう','くに','さかな','せんせい','たい','なに',
         'はな','ひと','べとなむ','ほん','中国','何人','先生','名前','国',
         '大学生','学校','学生','日本','日本人','日本語','本','留学生','花',
         '韓国人','高校','魚'
       ])
  ) THEN
    RAISE EXCEPTION '047: ada target <u> yang sudah pernah diujikan di migration 042/045';
  END IF;

  RAISE NOTICE '047: selesai — 50 soal (vocabulary 34, grammar 16), semua pagar level + dedup lolos.';
END $$;
