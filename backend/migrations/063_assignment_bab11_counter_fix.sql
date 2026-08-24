-- 063_assignment_bab11_counter_fix.sql — Perbaikan Assignment Bab 11:
-- Counter (Penghitung), pakai kanji kata bantu bilangan yang baru di-import.
--
-- FIX untuk 061_assignment_bab11_counter.sql (pola sama seperti 044 yang
-- memperbaiki 043 — migrasi 061 sudah ter-apply di production/schema_
-- migrations, jadi TIDAK bisa diedit langsung; file baru ini re-upsert
-- lesson yang SAMA — slug assignment-bab-11-counter — via DELETE+INSERT
-- ulang quiz_questions/options, pola idempotent standar).
--
-- SEBAB: setelah 061 di-deploy, user meng-import kanji kata bantu bilangan
-- (助数詞) 個/枚/匹/頭/台/回/杯/階/番/倍/冊 ke Notion Vocabulary DB (field
-- "Japanese 日本語" tiap entry sudah berisi kanji, mis. 〜個/〜枚/〜杯/〜台/
-- 〜冊/〜番/〜匹/〜回/〜階/〜倍/〜頭) — kanji-kanji ini SEBELUMNYA sengaja
-- dikeluarkan dari whitelist di 061 karena belum ada row resmi di Notion
-- Kanji DB (filter First Lesson=Bab11 cuma menemukan 年百午半週万千毎, tidak
-- termasuk kata bantu bilangan). Sekarang whitelist DITAMBAH 11 kanji
-- tersebut, dan seluruh kemunculan kata bantu bilangan di §4 (もんだい1
-- 文の文法1, 31-50) — baik body kalimat maupun kutipan jawaban dalam badan
-- soal — ditulis kanji, konsisten dengan cara 本／人 sudah ditulis kanji
-- sejak awal (kanjinya sudah taught dari Bab3/Bab4).
--
-- TAMBAHAN §1 漢字読み (1-9): 2 dari 6 soal 本/人 lama (六本／七人) diganti
-- dengan 2 soal bacaan kata bantu bilangan BARU yang juga punya perubahan
-- bunyi (euphonic) — 一杯(いっぱい, counter minuman) dan 三匹(さんびき,
-- counter hewan kecil) — supaya assignment ini benar-benar menguji kanji
-- yang baru di-import, bukan cuma membiarkannya lewat di badan kalimat.
-- §1 final: 先週/毎週/毎月 (kombinasi kanji taught, 3) + 一本/三本/何本
-- (perubahan bunyi 本, 3) + 一杯/三匹 (perubahan bunyi BARU, 2) + 三十人
-- (review reguler, 1) = 9. §2/§3 TIDAK berubah (masih valid, tidak
-- menyentuh kata bantu bilangan baru).
--
-- REF_CHECK TAMBAHAN (di luar yang sudah ada di 061 utk 本/週/毎/人):
--   一杯＝いっぱい(irregular)   三匹＝さんびき(irregular)
--
-- KANJI: whitelist 061 (67 kanji: 62 Bab3-9 + 3 Bab10 見読書 + 2 Bab11
-- 週毎) DITAMBAH 11 kanji kata bantu bilangan Bab 11 yang baru resmi:
-- 個枚匹頭台回杯階番倍冊 → total 78 kanji.
--
-- DEDUP: TIDAK berubah dari 061 (masih menolak 114 target dari 042/045/
-- 047/051/053/055/057/059). Target BARU yang diperkenalkan migrasi ini
-- sendiri (一杯／三匹, plus semua target §1/§2 lama yang masih dipakai)
-- WAJIB masuk DEDUP_PRIOR migrasi assignment Bab 12+ berikutnya.
--
-- PAGAR PARTIKEL & KATA KERJA: tidak berubah dari 061 (masih tidak ada
-- assertion partikel; strip-chain kata kerja masih sama — あります／います
-- + おねがいします).
--
-- Komposisi: TIDAK berubah — もんだい1 漢字読み 9 + もんだい2 表記 9 +
-- もんだい3 文脈規定 12 + もんだい1 文の文法1 20 = 50 soal.
--
-- PERINGATAN RE-RUN: DELETE FROM quiz_questions di bawah tanpa syarat —
-- kalau admin sudah menambah soal manual/AI ke pelajaran ini, re-run
-- migrasi ini manual akan menghapusnya. Runner (migrations/run.js) cuma
-- menjalankan file ini SEKALI per DB (tercatat di schema_migrations, dan
-- runner melacak PER NAMA FILE — mengedit 061 langsung TIDAK akan pernah
-- re-apply ke DB yang sudah menjalankannya, makanya fix ini jadi file baru).
--
-- Idempotent: lesson di-upsert per (module_id, slug) — SAMA dengan 061 —
-- soal lama dihapus lalu di-insert ulang; no-op aman kalau modul target
-- belum ada.

DO $$
DECLARE
  v_course_slug  TEXT := 'n5';
  v_lesson_slug  TEXT := 'assignment-bab-11-counter';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson_id    UUID;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 10 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '063: modul Bab 11 di kursus % tidak ditemukan — skip fix assignment.', v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* '(counter|penghitung|hitung)' THEN
    RAISE NOTICE '063: modul Bab 11 terbaca "%" — kalau ternyata bukan Bab Counter/Penghitung, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).', v_module_title;
  END IF;

  RAISE NOTICE '063: perbaiki Assignment Bab 11 (kanji kata bantu bilangan) di modul "%".', v_module_title;

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, questions_per_attempt, cooldown_hours
  ) VALUES (
    v_module_id, v_lesson_slug, 'Assignment Bab 11 — Counter (Penghitung)', 'quiz',
    'Tes materi Bab 11 (Counter/Penghitung) gaya JLPT. Moji-Goi: cara baca kombinasi 週／毎, perubahan bunyi kata bantu bilangan 本／杯／匹 (いっぽん／さんぼん／いっぱい／さんびき dst), cara menulisnya, serta kosakata counter/restoran sesuai konteks. Tata Bahasa: 〜を[counter]+[verb] (memesan dengan jumlah), [counter]+ あります／います, いくつ／何人／何枚 (menanyakan jumlah), dan bilangan asli Jepang (ひとつ・ふたつ・みっつ…). Semua 50 soal ditampilkan tiap attempt. Lulus 70% (35/50), cooldown 12 jam.',
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
    -- ===== もんだい1 漢字読み (1-9) — kombinasi 週/毎 + perubahan bunyi 本/杯/匹/人 =====
    (1, 'vocabulary'::TEXT, 1, '<u>先週</u>、テストが ありました。',
        '先週 dibaca せんしゅう (minggu lalu). 先 dan 週 masing-masing dibaca onyomi saat digabung.'),
    (2, 'vocabulary', 1, '<u>毎週</u> にちようびに テストが あります。',
        '毎週 dibaca まいしゅう (setiap minggu). 毎 dan 週 masing-masing dibaca onyomi saat digabung.'),
    (3, 'vocabulary', 1, '<u>毎月</u> テストが あります。',
        '毎月 dibaca まいつき (setiap bulan). 毎 dibaca onyomi マイ, 月 dibaca kunyomi つき saat digabung di kata ini.'),
    (4, 'vocabulary', 1, 'ビールを <u>一本</u> ください。',
        '一本 dibaca いっぽん — bacaan TIDAK beraturan, 本 berubah jadi ぽん (bukan ほん) setelah いち→いっ karena perubahan bunyi (euphonic).'),
    (5, 'vocabulary', 1, 'ビールを <u>三本</u> ください。',
        '三本 dibaca さんぼん — bacaan TIDAK beraturan, 本 berubah jadi ぼん (bersuara) setelah さん.'),
    (6, 'vocabulary', 1, 'コーヒーを <u>一杯</u> ください。',
        '一杯 dibaca いっぱい — bacaan TIDAK beraturan, 杯 berubah jadi ぱい setelah いち→いっ, pola perubahan bunyi sama seperti 一本＝いっぽん.'),
    (7, 'vocabulary', 1, '<u>何本</u> ありますか。',
        '何本 dibaca なんぼん — 本 berubah jadi ぼん (bersuara) setelah なん, pola sama dengan 三本.'),
    (8, 'vocabulary', 1, 'にわに ねこが <u>三匹</u> います。',
        '三匹 dibaca さんびき — bacaan TIDAK beraturan, 匹 berubah jadi びき (bersuara) setelah さん, pola perubahan bunyi sama seperti 三本＝さんぼん.'),
    (9, 'vocabulary', 1, 'きょうしつに がくせいが <u>三十人</u> います。',
        '三十人 dibaca さんじゅうにん. 三十 dibaca さんじゅう, 人 dibaca にん — semua bacaan beraturan.'),

    -- ===== もんだい2 表記 (10-18) — target hiragana, jawaban bentuk tulisan =====
    (10, 'vocabulary', 2, 'ビールが <u>にほん</u> あります。',
        'にほん ditulis 二本 (2 botol). Salah: 四本 (よんほん, 4 botol), 五本 (ごほん, 5 botol), 十本 (じゅっぽん, 10 botol).'),
    (11, 'vocabulary', 2, 'ペンが <u>よんほん</u> あります。',
        'よんほん ditulis 四本 (4 batang). Salah: 二本 (にほん, 2 batang), 五本 (ごほん, 5 batang), 十本 (じゅっぽん, 10 batang).'),
    (12, 'vocabulary', 2, 'えんぴつが <u>ごほん</u> あります。',
        'ごほん ditulis 五本 (5 batang). Salah: 二本 (にほん), 四本 (よんほん), 十本 (じゅっぽん).'),
    (13, 'vocabulary', 2, '<u>せんげつ</u> テストが ありました。',
        'せんげつ ditulis 先月 (bulan lalu). Salah: 毎日 (まいにち, setiap hari), 二十人 (にじゅうにん), 四十人 (よんじゅうにん).'),
    (14, 'vocabulary', 2, '<u>まいにち</u> しごとが あります。',
        'まいにち ditulis 毎日 (setiap hari). Salah: 先月 (せんげつ, bulan lalu), 二十人 (にじゅうにん), 五十人 (ごじゅうにん).'),
    (15, 'vocabulary', 2, 'はなが <u>じゅっぽん</u> あります。',
        'じゅっぽん ditulis 十本 (10 batang bunga) — bacaan TIDAK beraturan, bukan じゅうほん. Salah: 二本 (にほん), 四本 (よんほん), 五本 (ごほん).'),
    (16, 'vocabulary', 2, 'がくせいが <u>よんじゅうにん</u> います。',
        'よんじゅうにん ditulis 四十人 (40 orang). Salah: 五十人 (ごじゅうにん, 50 orang), 二十人 (にじゅうにん, 20 orang), 先月 (せんげつ).'),
    (17, 'vocabulary', 2, 'がくせいが <u>ごじゅうにん</u> います。',
        'ごじゅうにん ditulis 五十人 (50 orang). Salah: 四十人 (よんじゅうにん, 40 orang), 二十人 (にじゅうにん, 20 orang), 毎日 (まいにち).'),
    (18, 'vocabulary', 2, 'がくせいが <u>にじゅうにん</u> います。',
        'にじゅうにん ditulis 二十人 (20 orang). Salah: 四十人 (よんじゅうにん), 五十人 (ごじゅうにん), 先月 (せんげつ).'),

    -- ===== もんだい3 文脈規定 (19-30) — kosakata counter/restoran =====
    (19, 'vocabulary', 3, 'れすとらんの リストは（　）です。',
        'Jawabannya メニュー (menu), daftar makanan dan minuman di restoran. お会計, レシート, お代わり tidak berkaitan dengan daftar makanan.'),
    (20, 'vocabulary', 3, 'たべたあとの おかねは（　）です。',
        'Jawabannya おかいけい (tagihan/bayar), uang yang dibayar setelah makan. メニュー, レシート, おかわり kurang tepat untuk konsep tagihan.'),
    (21, 'vocabulary', 3, 'おみせの かみは（　）です。「レシートです。」',
        'Jawabannya レシート (struk), dijawab langsung. メニュー, おかいけい, おかわり tidak berkaitan dengan kertas bukti pembayaran.'),
    (22, 'vocabulary', 3, 'コーヒーが もう ありません。もう いっぱい（　）を おねがいします。',
        'Jawabannya おかわり (tambah porsi/minuman), meminta lagi karena sudah habis. メニュー, おかいけい, レシート tidak cocok untuk konteks minta tambah.'),
    (23, 'vocabulary', 3, 'ごはんを たべる どうぐは（　）です。「はしです。」',
        'Jawabannya はし (sumpit), dijawab langsung. おさら, のみもの, たべもの bukan alat makan.'),
    (24, 'vocabulary', 3, 'ごはんの うつわは（　）です。「おさらです。」',
        'Jawabannya おさら (piring), dijawab langsung. はし, のみもの, たべもの bukan wadah makanan.'),
    (25, 'vocabulary', 3, 'みずや おちゃや コーヒーは ぜんぶ（　）です。',
        'Jawabannya のみもの (minuman), kategori umum untuk air/teh/kopi. たべもの, おさら, はし bukan kategori minuman.'),
    (26, 'vocabulary', 3, 'パンや ケーキや アイスクリームは ぜんぶ（　）です。',
        'Jawabannya たべもの (makanan), kategori umum untuk roti/kue/es krim. のみもの, おさら, はし bukan kategori makanan.'),
    (27, 'vocabulary', 3, 'ビールは（　）です。「おさけです。」',
        'Jawabannya おさけ (sake/minuman beralkohol), dijawab langsung — bir termasuk kategori ini. のみもの (terlalu umum untuk jawaban ini), たべもの, メニュー kurang tepat.'),
    (28, 'vocabulary', 3, 'りんごの（　）は みっつです。',
        'Jawabannya かず (jumlah/angka), yang ditanyakan dan dijawab dengan bilangan asli みっつ. ばんごう, いちにんまえ, メニュー tidak berkaitan dengan jumlah benda.'),
    (29, 'vocabulary', 3, 'ひとりの りょうは（　）です。',
        'Jawabannya いちにんまえ (satu porsi), porsi untuk satu orang. かず, ばんごう, おかわり tidak berkaitan dengan porsi makanan.'),
    (30, 'vocabulary', 3, 'でんわの（　）は なんですか。',
        'Jawabannya ばんごう (nomor), yang dimiliki telepon. かず, いちにんまえ, メニュー tidak berkaitan dengan nomor telepon.'),

    -- ===== もんだい1 文の文法1 (31-50) — 4 pola grammar Bab 11, kata bantu =====
    -- bilangan sekarang ditulis kanji (個/枚/匹/冊 baru resmi taught).
    (31, 'grammar'::TEXT, 1, 'りんごを（　）ください。「三個です。」',
        'Jawabannya 三個 — りんご (benda kecil bulat) pakai kata bantu bilangan 個. 三枚 (benda pipih), 三本 (benda panjang), 三匹 (hewan kecil) tidak cocok untuk apel.'),
    (32, 'grammar', 1, 'かみを（　）ください。「二枚です。」',
        'Jawabannya 二枚 — かみ (benda pipih) pakai kata bantu bilangan 枚. 二個, 二本, 二匹 tidak cocok untuk kertas.'),
    (33, 'grammar', 1, 'ペンを（　）ください。「五本です。」',
        'Jawabannya 五本 — ペン (benda panjang) pakai kata bantu bilangan 本. 五枚, 五個, 五匹 tidak cocok untuk pena.'),
    (34, 'grammar', 1, 'ねこを（　）ください。「二匹です。」',
        'Jawabannya 二匹 — ねこ (hewan kecil) pakai kata bantu bilangan 匹. 二枚, 二個, 二本 tidak cocok untuk kucing.'),
    (35, 'grammar', 1, 'Tシャツを（　）ください。「四枚です。」',
        'Jawabannya 四枚 — Tシャツ (benda pipih) pakai kata bantu bilangan 枚. 四個, 四本, 四匹 tidak cocok untuk baju.'),
    (36, 'grammar', 1, 'つくえの うえに ペンが 二本（　）。',
        'Jawabannya あります — ペン (benda mati) pakai あります bukan います. います dipakai untuk makhluk hidup, でした dan ました mengubah jadi bentuk lampau.'),
    (37, 'grammar', 1, 'にわに ねこが 二匹（　）。',
        'Jawabannya います — ねこ (makhluk hidup) pakai います bukan あります. あります dipakai untuk benda mati, でした dan ました mengubah jadi bentuk lampau.'),
    (38, 'grammar', 1, 'はこの なかに りんごが 五個（　）。',
        'Jawabannya あります — りんご (benda mati) pakai あります. います dipakai untuk makhluk hidup, でした dan ました mengubah jadi bentuk lampau.'),
    (39, 'grammar', 1, 'きょうしつに がくせいが 十人（　）。',
        'Jawabannya います — がくせい (orang) pakai います. あります dipakai untuk benda mati, でした dan ました mengubah jadi bentuk lampau.'),
    (40, 'grammar', 1, 'たなに ほんが 三冊（　）。',
        'Jawabannya あります — ほん (benda mati) pakai あります. います dipakai untuk makhluk hidup, でした dan ました mengubah jadi bentuk lampau.'),
    (41, 'grammar', 1, 'りんごは（　）ですか。「みっつです。」',
        'Jawabannya いくつ (berapa banyak, secara umum), dijawab dengan bilangan asli みっつ. 何人, 何枚, 何本 tidak cocok untuk pertanyaan jumlah benda umum.'),
    (42, 'grammar', 1, 'きょうしつに がくせいが（　）いますか。「十人です。」',
        'Jawabannya 何人 (berapa orang), dijawab dengan 十人です. いくつ, 何枚, 何本 tidak cocok untuk menghitung orang.'),
    (43, 'grammar', 1, 'かみが（　）ありますか。「二枚です。」',
        'Jawabannya 何枚 (berapa lembar), dijawab dengan 二枚です. いくつ, 何人, 何本 tidak cocok untuk menghitung kertas.'),
    (44, 'grammar', 1, 'ペンが（　）ありますか。「三本です。」',
        'Jawabannya 何本 (berapa batang), dijawab dengan 三本です. いくつ, 何人, 何枚 tidak cocok untuk menghitung pena.'),
    (45, 'grammar', 1, 'テーブルは（　）ですか。「ふたつです。」',
        'Jawabannya いくつ, dijawab dengan bilangan asli ふたつ. 何人, 何枚, 何本 tidak cocok untuk pertanyaan jumlah benda umum.'),
    (46, 'grammar', 1, 'りんごが（　）あります。「一個です。」',
        'Jawabannya ひとつ — bilangan asli Jepang untuk jumlah 1, senilai dengan 一個. ふたつ, みっつ, よっつ tidak sesuai jumlah 1.'),
    (47, 'grammar', 1, 'たまごが（　）あります。「二個です。」',
        'Jawabannya ふたつ — bilangan asli Jepang untuk jumlah 2, senilai dengan 二個. ひとつ, みっつ, よっつ tidak sesuai jumlah 2.'),
    (48, 'grammar', 1, 'パンが（　）あります。「三個です。」',
        'Jawabannya みっつ — bilangan asli Jepang untuk jumlah 3, senilai dengan 三個. ひとつ, ふたつ, よっつ tidak sesuai jumlah 3.'),
    (49, 'grammar', 1, 'ケーキが（　）あります。「四個です。」',
        'Jawabannya よっつ — bilangan asli Jepang untuk jumlah 4, senilai dengan 四個. ひとつ, ふたつ, みっつ tidak sesuai jumlah 4.'),
    (50, 'grammar', 1, 'りんごが（　）あります。「五個です。」',
        'Jawabannya いつつ — bilangan asli Jepang untuk jumlah 5, senilai dengan 五個. ひとつ, ふたつ, みっつ tidak sesuai jumlah 5.')
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
    (1, 0, 'せんしゅう', TRUE), (1, 1, 'まいしゅう', FALSE), (1, 2, 'せんげつ', FALSE), (1, 3, 'らいしゅう', FALSE),
    (2, 0, 'まいしゅう', TRUE), (2, 1, 'せんしゅう', FALSE), (2, 2, 'まいつき', FALSE), (2, 3, 'まいにち', FALSE),
    (3, 0, 'まいつき', TRUE), (3, 1, 'まいしゅう', FALSE), (3, 2, 'せんげつ', FALSE), (3, 3, 'まいにち', FALSE),
    (4, 0, 'いっぽん', TRUE), (4, 1, 'いちほん', FALSE), (4, 2, 'いっほん', FALSE), (4, 3, 'いちぼん', FALSE),
    (5, 0, 'さんぼん', TRUE), (5, 1, 'さんほん', FALSE), (5, 2, 'さんぽん', FALSE), (5, 3, 'みっぽん', FALSE),
    (6, 0, 'いっぱい', TRUE), (6, 1, 'いちはい', FALSE), (6, 2, 'いっはい', FALSE), (6, 3, 'いちばい', FALSE),
    (7, 0, 'なんぼん', TRUE), (7, 1, 'なにほん', FALSE), (7, 2, 'なんほん', FALSE), (7, 3, 'なんぽん', FALSE),
    (8, 0, 'さんびき', TRUE), (8, 1, 'さんひき', FALSE), (8, 2, 'さんぴき', FALSE), (8, 3, 'みっぴき', FALSE),
    (9, 0, 'さんじゅうにん', TRUE), (9, 1, 'さんじゅうねん', FALSE), (9, 2, 'みそじゅうにん', FALSE), (9, 3, 'さんじっにん', FALSE),

    -- 表記 — opsi bentuk tulisan
    (10, 0, '二本', TRUE), (10, 1, '四本', FALSE), (10, 2, '五本', FALSE), (10, 3, '十本', FALSE),
    (11, 0, '四本', TRUE), (11, 1, '二本', FALSE), (11, 2, '五本', FALSE), (11, 3, '十本', FALSE),
    (12, 0, '五本', TRUE), (12, 1, '二本', FALSE), (12, 2, '四本', FALSE), (12, 3, '十本', FALSE),
    (13, 0, '先月', TRUE), (13, 1, '毎日', FALSE), (13, 2, '二十人', FALSE), (13, 3, '四十人', FALSE),
    (14, 0, '毎日', TRUE), (14, 1, '先月', FALSE), (14, 2, '二十人', FALSE), (14, 3, '五十人', FALSE),
    (15, 0, '十本', TRUE), (15, 1, '二本', FALSE), (15, 2, '四本', FALSE), (15, 3, '五本', FALSE),
    (16, 0, '四十人', TRUE), (16, 1, '五十人', FALSE), (16, 2, '二十人', FALSE), (16, 3, '先月', FALSE),
    (17, 0, '五十人', TRUE), (17, 1, '四十人', FALSE), (17, 2, '二十人', FALSE), (17, 3, '毎日', FALSE),
    (18, 0, '二十人', TRUE), (18, 1, '四十人', FALSE), (18, 2, '五十人', FALSE), (18, 3, '先月', FALSE),

    -- 文脈規定
    (19, 0, 'メニュー', TRUE), (19, 1, 'お会計', FALSE), (19, 2, 'レシート', FALSE), (19, 3, 'お代わり', FALSE),
    (20, 0, 'お会計', TRUE), (20, 1, 'メニュー', FALSE), (20, 2, 'レシート', FALSE), (20, 3, 'お代わり', FALSE),
    (21, 0, 'レシート', TRUE), (21, 1, 'メニュー', FALSE), (21, 2, 'お会計', FALSE), (21, 3, 'お代わり', FALSE),
    (22, 0, 'お代わり', TRUE), (22, 1, 'メニュー', FALSE), (22, 2, 'お会計', FALSE), (22, 3, 'レシート', FALSE),
    (23, 0, 'はし', TRUE), (23, 1, 'おさら', FALSE), (23, 2, 'のみもの', FALSE), (23, 3, 'たべもの', FALSE),
    (24, 0, 'おさら', TRUE), (24, 1, 'はし', FALSE), (24, 2, 'のみもの', FALSE), (24, 3, 'たべもの', FALSE),
    (25, 0, 'のみもの', TRUE), (25, 1, 'たべもの', FALSE), (25, 2, 'おさら', FALSE), (25, 3, 'はし', FALSE),
    (26, 0, 'たべもの', TRUE), (26, 1, 'のみもの', FALSE), (26, 2, 'おさら', FALSE), (26, 3, 'はし', FALSE),
    (27, 0, 'おさけ', TRUE), (27, 1, 'のみもの', FALSE), (27, 2, 'たべもの', FALSE), (27, 3, 'メニュー', FALSE),
    (28, 0, 'かず', TRUE), (28, 1, 'ばんごう', FALSE), (28, 2, 'いちにんまえ', FALSE), (28, 3, 'メニュー', FALSE),
    (29, 0, 'いちにんまえ', TRUE), (29, 1, 'かず', FALSE), (29, 2, 'ばんごう', FALSE), (29, 3, 'おかわり', FALSE),
    (30, 0, 'ばんごう', TRUE), (30, 1, 'かず', FALSE), (30, 2, 'いちにんまえ', FALSE), (30, 3, 'メニュー', FALSE),

    -- 文の文法1 — opsi kata bantu bilangan sekarang kanji
    (31, 0, '三個', TRUE), (31, 1, '三枚', FALSE), (31, 2, '三本', FALSE), (31, 3, '三匹', FALSE),
    (32, 0, '二枚', TRUE), (32, 1, '二個', FALSE), (32, 2, '二本', FALSE), (32, 3, '二匹', FALSE),
    (33, 0, '五本', TRUE), (33, 1, '五枚', FALSE), (33, 2, '五個', FALSE), (33, 3, '五匹', FALSE),
    (34, 0, '二匹', TRUE), (34, 1, '二枚', FALSE), (34, 2, '二個', FALSE), (34, 3, '二本', FALSE),
    (35, 0, '四枚', TRUE), (35, 1, '四個', FALSE), (35, 2, '四本', FALSE), (35, 3, '四匹', FALSE),
    (36, 0, 'あります', TRUE), (36, 1, 'います', FALSE), (36, 2, 'でした', FALSE), (36, 3, 'ました', FALSE),
    (37, 0, 'います', TRUE), (37, 1, 'あります', FALSE), (37, 2, 'でした', FALSE), (37, 3, 'ました', FALSE),
    (38, 0, 'あります', TRUE), (38, 1, 'います', FALSE), (38, 2, 'でした', FALSE), (38, 3, 'ました', FALSE),
    (39, 0, 'います', TRUE), (39, 1, 'あります', FALSE), (39, 2, 'でした', FALSE), (39, 3, 'ました', FALSE),
    (40, 0, 'あります', TRUE), (40, 1, 'います', FALSE), (40, 2, 'でした', FALSE), (40, 3, 'ました', FALSE),
    (41, 0, 'いくつ', TRUE), (41, 1, '何人', FALSE), (41, 2, '何枚', FALSE), (41, 3, '何本', FALSE),
    (42, 0, '何人', TRUE), (42, 1, 'いくつ', FALSE), (42, 2, '何枚', FALSE), (42, 3, '何本', FALSE),
    (43, 0, '何枚', TRUE), (43, 1, 'いくつ', FALSE), (43, 2, '何人', FALSE), (43, 3, '何本', FALSE),
    (44, 0, '何本', TRUE), (44, 1, 'いくつ', FALSE), (44, 2, '何人', FALSE), (44, 3, '何枚', FALSE),
    (45, 0, 'いくつ', TRUE), (45, 1, '何人', FALSE), (45, 2, '何枚', FALSE), (45, 3, '何本', FALSE),
    (46, 0, 'ひとつ', TRUE), (46, 1, 'ふたつ', FALSE), (46, 2, 'みっつ', FALSE), (46, 3, 'よっつ', FALSE),
    (47, 0, 'ふたつ', TRUE), (47, 1, 'ひとつ', FALSE), (47, 2, 'みっつ', FALSE), (47, 3, 'よっつ', FALSE),
    (48, 0, 'みっつ', TRUE), (48, 1, 'ひとつ', FALSE), (48, 2, 'ふたつ', FALSE), (48, 3, 'よっつ', FALSE),
    (49, 0, 'よっつ', TRUE), (49, 1, 'ひとつ', FALSE), (49, 2, 'ふたつ', FALSE), (49, 3, 'みっつ', FALSE),
    (50, 0, 'いつつ', TRUE), (50, 1, 'ひとつ', FALSE), (50, 2, 'ふたつ', FALSE), (50, 3, 'みっつ', FALSE)
  )
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT qq.id, o.option_text, o.ok, o.ord
    FROM o
    JOIN quiz_questions qq
      ON qq.lesson_id = v_lesson_id AND qq.sort_order = o.qno;

  -- ===== Assertion bentuk =====
  IF (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id) <> 50 THEN
    RAISE EXCEPTION '063: jumlah soal bukan 50 (dapat %)',
      (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
      LEFT JOIN quiz_options qo ON qo.question_id = qq.id
     WHERE qq.lesson_id = v_lesson_id
     GROUP BY qq.id
    HAVING COUNT(qo.id) <> 4 OR COUNT(*) FILTER (WHERE qo.is_correct) <> 1
  ) THEN
    RAISE EXCEPTION '063: ada soal yang opsinya bukan 4 atau kuncinya bukan tepat 1';
  END IF;

  -- ===== Pagar level =====

  -- 1. Badan kalimat (di LUAR target <u>…</u>) hanya boleh memakai kanji
  --    taught: 62 kanji Bab3-9 + 3 kanji Bab10 (見読書) + 2 kanji Bab11
  --    (週毎) + 11 kanji kata bantu bilangan Bab11 yang baru resmi
  --    (個枚匹頭台回杯階番倍冊, baru di-import ke Notion Vocabulary DB).
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND regexp_replace(
             regexp_replace(question, '<u>[^<]*</u>', '', 'g'),
             '[先何語校国生学名人魚本花八三十九一五四二六七安高古新白長男女気下前外間右中左後上時分円百千万年月半歳午前後車東道駅行西電北南見読書週毎個枚匹頭台回杯階番倍冊]', '', 'g'
           ) ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '063: ada kanji di luar daftar taught pada badan kalimat soal';
  END IF;

  -- 2. Partikel: TIDAK ADA ASSERTION (dihapus sejak 059 — semua partikel
  --    dasar N5 sudah taught kumulatif).

  -- 3. Kata kerja: strip dulu SEMUA konjugasi あります／います (sudah
  --    taught sejak Bab 8) sebagai frasa aman, baru cek kata kerja LAIN
  --    yang masih dilarang. Migrasi ini SENGAJA tidak memakai kata kerja
  --    lain (ください imperative tidak match regex apa pun secara
  --    mekanis, jadi aman dipakai bebas tanpa whitelist eksplisit).
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
             question,
             'そうじゃありません', ''), 'じゃありません', ''),
             'ありませんでした', ''), 'いませんでした', ''),
             'ありました', ''), 'いました', ''),
             'ありません', ''), 'います', ''), 'あります', ''), 'おねがいします', '')
           ~ '(ます|ました|ません|いる|ある|いて|べんきょう|わかり|はたら)'
  ) THEN
    RAISE EXCEPTION '063: ada indikasi kata kerja di luar あります／います pada teks soal';
  END IF;

  -- 4. Rantai の dalam satu kalimat.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '063: ada kalimat dengan rantai の (lebih dari satu の dalam satu kalimat)';
  END IF;

  -- 5. Target section: もんだい1 wajib kanji di dalam <u>, もんだい2 wajib kana.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 1
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '') !~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '063: ada soal 漢字読み yang target <u> nya tidak mengandung kanji';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 2
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '一') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '063: ada soal 表記 yang target <u> nya sudah berupa kanji';
  END IF;

  -- 6. DEDUP WAJIB — target <u> tidak boleh sama dengan salah satu dari
  --    114 target unik yang sudah dipakai di 042/045/047/051/053/055/057/059.
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
         '四人','三人','五人','六人','八人','九人','十人','四年生','五年生',
         '下','前','外','人間','右','中','左','後ろ','上',
         '前後','上下','左右','中間','時間','外国','中学生','午前中','九時間',
         '車','東','道','駅','行','西','電車','北','南',
         'しゃどう','えきまえ','とうざい','なんぼく','ほくとう','ほくせい','なんとう','なんせい','こくどう',
         '読みます','書きました','見ません','六年生','高校生','三十分','二百人','八時半','何年生',
         'よみました','かきます','みました','はんとし','ちゅうねん','ごせんえん','にせんえん','はんぶん','じゅうごふん'
       ])
  ) THEN
    RAISE EXCEPTION '063: ada target <u> yang sudah pernah diujikan di migration 042/045/047/051/053/055/057/059';
  END IF;

  RAISE NOTICE '063: selesai — 50 soal (vocabulary 30, grammar 20), semua pagar level + dedup lolos, kata bantu bilangan kini kanji.';
END $$;
