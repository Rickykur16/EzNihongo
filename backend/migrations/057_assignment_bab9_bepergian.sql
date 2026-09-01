-- 057_assignment_bab9_bepergian.sql — Assignment Bab 9: Bepergian.
--
-- Ujian bab untuk Bab 9, sumber Notion N5-B9 "Bepergian" (Going Places &
-- Transportation). Modul di-resolve ordinal (OFFSET 8, lanjutan pola
-- 039-055).
--
-- Kebijakan 50/50 (Bab 8+, sudah berlaku sejak 055): questions_per_attempt
-- = 50, SEMUA soal ditampilkan tiap attempt (bukan sampling 30).
--
-- PERUBAHAN PAGAR BESAR — Bab 9 memperkenalkan kata kerja gerak
-- (行く／来る／帰る) untuk PERTAMA KALINYA di assignment kuis manapun,
-- plus partikel へ／で／と:
--   1. Partikel: whitelist diperluas dari は/も/の/か/ね/よ/から/まで/に/が
--      menjadi + へ (arah tujuan) + で (moda transportasi) + と (bersama
--      siapa, "だれと"). を TETAP dilarang (belum diajarkan objek langsung
--      kata kerja manapun).
--   2. Kata kerja: strip-chain diperluas dengan 行きます／きます／かえります
--      (keluarga 行く／来る／帰る, afirmatif hadir) sebagai frasa aman,
--      SETELAH strip あります／います family (sudah ada sejak Bab 8). Kata
--      kerja lain (たべます／のみます dst) tetap tertangkap karena residu
--      substring "ます" masih ada setelah semua strip.
--   3. PENTING: dari 3 kata kerja gerak, HANYA 行 yang kanji-nya resmi
--      diajarkan Bab 9 (lihat kanji whitelist di bawah). 来る dan 帰る
--      BELUM diajarkan sebagai kanji — jadi きます dan かえります WAJIB
--      ditulis hiragana murni di SELURUH file ini (termasuk di
--      quiz_options, walau assertion pagar kanji cuma mengecek kolom
--      question — disiplin kurikulum tetap dijaga manual). 行きます boleh
--      kanji karena 行 adalah salah satu dari 9 kanji resmi Bab 9 (dan
--      jadi target §1 soal nomor 5).
--
-- 9 kanji resmi Bab 9 (車東道駅行西電北南, dikonfirmasi dari Notion Kanji DB
-- filter "First Lesson"=Bab9) ditambahkan ke whitelist kanji badan
-- kalimat, union dengan 53 kanji taught Bab3-8 (termasuk 13 counter Bab5).
--
-- REF_CHECK bacaan (sumber kebenaran tunggal, semua BERATURAN — tidak ada
-- kasus irregular seperti 九時＝くじ di Bab ini):
--   車＝くるま(kunyomi)   東＝ひがし(kunyomi)   道＝みち(kunyomi)
--   駅＝えき(onyomi, tidak punya kunyomi)   行＝い (kunyomi, di 行きます)
--   西＝にし(kunyomi)   電車＝でんしゃ(onyomi+onyomi)   北＝きた(kunyomi)
--   南＝みなみ(kunyomi)
-- §2 (kombinasi onyomi, semua beraturan, tidak perlu REF_CHECK):
--   車道＝しゃどう   駅前＝えきまえ(onyomi+kunyomi)   東西＝とうざい
--   南北＝なんぼく   北東＝ほくとう   北西＝ほくせい   南東＝なんとう
--   南西＝なんせい   国道＝こくどう
--
-- DEDUP WAJIB (pola established sejak 047): tidak boleh menguji ulang
-- target <u> yang sudah dipakai di 042/045/047/051/053/055 — 78 target
-- unik (60 dari 042-053 + 18 dari 055), di-grep ulang dari file migrasi
-- sungguhan.
--
-- Komposisi: もんだい1 漢字読み 9 + もんだい2 表記 9 + もんだい3 文脈規定 12
-- + もんだい1 文の文法1 20 = 50 soal, SEMUA ditampilkan tiap attempt,
-- lulus 70% (35/50), cooldown 12 jam.
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
  v_lesson_slug  TEXT := 'assignment-bab-9-bepergian';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson_id    UUID;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 8 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '057: modul Bab 9 di kursus % tidak ditemukan — skip seed assignment.', v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* '(bepergian|perjalanan|transport|travel)' THEN
    RAISE NOTICE '057: modul Bab 9 terbaca "%" — kalau ternyata bukan Bab Bepergian, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).', v_module_title;
  END IF;

  RAISE NOTICE '057: seed Assignment Bab 9 ke modul "%".', v_module_title;

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, questions_per_attempt, cooldown_hours
  ) VALUES (
    v_module_id, v_lesson_slug, 'Assignment Bab 9 — Bepergian', 'quiz',
    'Tes materi Bab 9 (Bepergian) gaya JLPT. Moji-Goi: cara baca 9 kanji baru (車／東／道／駅／行／西／電／北／南) dan kombinasinya, cara menulisnya, serta kosakata transportasi/perjalanan sesuai konteks. Tata Bahasa: 〜へ行きます／来ます／帰ります (arah tujuan), 〜で行きます (moda transportasi), 〜から〜まで (dari-sampai tempat), dan いつ／どこへ／だれと (kata tanya rencana bepergian). Semua 50 soal ditampilkan tiap attempt. Lulus 70% (35/50), cooldown 12 jam.',
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
    -- ===== もんだい1 漢字読み (1-9) — 9 kanji inti Bab 9 =====
    (1, 'vocabulary'::TEXT, 1, 'わたしは <u>車</u>で かいしゃへ 行きます。',
        '車 dibaca くるま (mobil). くるま adalah bacaan kunyomi dasar, beda dari onyomi シャ yang dipakai di kata gabungan seperti 電車 (でんしゃ).'),
    (2, 'vocabulary', 1, 'がっこうは <u>東</u>に あります。',
        '東 dibaca ひがし (timur). ひがし adalah bacaan kunyomi dasar, beda dari onyomi トウ yang dipakai di kata gabungan seperti 東西 (とうざい).'),
    (3, 'vocabulary', 1, '<u>道</u>は ながいです。',
        '道 dibaca みち (jalan). みち adalah bacaan kunyomi dasar, beda dari onyomi ドウ yang dipakai di kata gabungan seperti 車道 (しゃどう).'),
    (4, 'vocabulary', 1, 'いえから <u>駅</u>まで 行きます。',
        '駅 dibaca えき (stasiun). 駅 cuma punya satu bacaan (onyomi エキ／えき), tidak ada bacaan kunyomi terpisah.'),
    (5, 'vocabulary', 1, 'がっこうへ <u>行</u>きます。',
        '行 dibaca い di kata kerja 行きます (pergi) — ini bacaan kunyomi い(く). 行 juga punya onyomi コウ／ギョウ yang dipakai di kata benda seperti 旅行 (りょこう, wisata/perjalanan).'),
    (6, 'vocabulary', 1, 'としょかんは <u>西</u>に あります。',
        '西 dibaca にし (barat). にし adalah bacaan kunyomi dasar, beda dari onyomi セイ／サイ yang dipakai di kata gabungan seperti 北西 (ほくせい).'),
    (7, 'vocabulary', 1, '<u>電車</u>で 行きます。',
        '電車 dibaca でんしゃ (kereta listrik). Baik 電 (でん) maupun 車 (しゃ) dibaca onyomi saat digabung — beda dari 車 sendirian yang dibaca kunyomi くるま.'),
    (8, 'vocabulary', 1, 'がっこうは <u>北</u>に あります。',
        '北 dibaca きた (utara). きた adalah bacaan kunyomi dasar, beda dari onyomi ホク yang dipakai di kata gabungan seperti 北東 (ほくとう).'),
    (9, 'vocabulary', 1, 'こうえんは <u>南</u>に あります。',
        '南 dibaca みなみ (selatan). みなみ adalah bacaan kunyomi dasar, beda dari onyomi ナン yang dipakai di kata gabungan seperti 南西 (なんせい).'),

    -- ===== もんだい2 表記 (10-18) — target hiragana, jawaban bentuk tulisan =====
    (10, 'vocabulary', 2, '<u>しゃどう</u>は くるまの みちです。',
        'しゃどう ditulis 車道 (jalan untuk mobil). Salah: 駅前 (えきまえ, depan stasiun), 国道 (こくどう, jalan nasional), 東西 (とうざい, timur-barat) — semuanya kombinasi kanji lain.'),
    (11, 'vocabulary', 2, '<u>えきまえ</u>に みせが あります。',
        'えきまえ ditulis 駅前 (depan stasiun). Salah: 車道 (しゃどう, jalan mobil), 国道 (こくどう, jalan nasional), 南北 (なんぼく, utara-selatan).'),
    (12, 'vocabulary', 2, '<u>とうざい</u>は ひがしと にしです。',
        'とうざい ditulis 東西 (timur dan barat). Salah: 南北 (なんぼく, utara-selatan), 北東 (ほくとう, timur laut), 北西 (ほくせい, barat laut).'),
    (13, 'vocabulary', 2, '<u>なんぼく</u>は きたと みなみです。',
        'なんぼく ditulis 南北 (utara dan selatan). Salah: 東西 (とうざい, timur-barat), 南東 (なんとう, tenggara), 南西 (なんせい, barat daya).'),
    (14, 'vocabulary', 2, 'がっこうは えきの <u>ほくとう</u>に あります。',
        'ほくとう ditulis 北東 (timur laut). Salah: 北西 (ほくせい, barat laut), 南東 (なんとう, tenggara), 南西 (なんせい, barat daya).'),
    (15, 'vocabulary', 2, 'こうえんは えきの <u>ほくせい</u>に あります。',
        'ほくせい ditulis 北西 (barat laut). Salah: 北東 (ほくとう, timur laut), 南東 (なんとう, tenggara), 南西 (なんせい, barat daya).'),
    (16, 'vocabulary', 2, 'びょういんは えきの <u>なんとう</u>に あります。',
        'なんとう ditulis 南東 (tenggara). Salah: 南西 (なんせい, barat daya), 北東 (ほくとう, timur laut), 北西 (ほくせい, barat laut).'),
    (17, 'vocabulary', 2, 'としょかんは えきの <u>なんせい</u>に あります。',
        'なんせい ditulis 南西 (barat daya). Salah: 南東 (なんとう, tenggara), 北東 (ほくとう, timur laut), 北西 (ほくせい, barat laut).'),
    (18, 'vocabulary', 2, 'この どうろは <u>こくどう</u>です。',
        'こくどう ditulis 国道 (jalan nasional). Salah: 車道 (しゃどう, jalan mobil), 駅前 (えきまえ, depan stasiun), 東西 (とうざい, timur-barat).'),

    -- ===== もんだい3 文脈規定 (19-30) — kosakata transportasi/perjalanan =====
    (19, 'vocabulary', 3, 'そらに（　）が あります。「ひこうきです。」',
        'Jawabannya ひこうき (pesawat), kendaraan yang terbang di langit. ふね (kapal), でんしゃ (kereta), バス (bus) bukan kendaraan udara.'),
    (20, 'vocabulary', 3, 'うみに（　）が あります。「ふねです。」',
        'Jawabannya ふね (kapal), kendaraan di laut. ひこうき, でんしゃ, くるま bukan kendaraan laut.'),
    (21, 'vocabulary', 3, 'とても はやい でんしゃは（　）です。',
        'Jawabannya しんかんせん (shinkansen), kereta tercepat. ちかてつ (kereta bawah tanah), バス, タクシー bukan kereta super cepat.'),
    (22, 'vocabulary', 3, 'かたみちの はんたいは（　）です。',
        'Jawabannya おうふく (pulang-pergi), kebalikan dari かたみち (sekali jalan). きっぷ, りょこう, しゅっちょう tidak berkaitan dengan lawan kata かたみち.'),
    (23, 'vocabulary', 3, 'りょこうの かばんは（　）です。',
        'Jawabannya スーツケース (koper), tas khusus untuk bepergian. にもつ (barang bawaan secara umum), きっぷ, パスポート bukan jenis tas.'),
    (24, 'vocabulary', 3, 'たのしい りょこうは（　）です。',
        'Jawabannya かんこう (wisata), perjalanan untuk bersenang-senang. しゅっちょう (perjalanan dinas, untuk kerja), よやく, きょり tidak cocok.'),
    (25, 'vocabulary', 3, 'こうさてんに（　）が あります。「あかと あおと きいろです。」',
        'Jawabannya しんごう (lampu lalu lintas), dijawab dengan warna merah-biru-kuning. かいさつ (pintu masuk stasiun), ホーム (peron), せん (jalur kereta) tidak berkaitan dengan warna lampu.'),
    (26, 'vocabulary', 3, 'みちが たくさん あります。そこは（　）です。',
        'Jawabannya こうさてん (persimpangan), tempat banyak jalan bertemu. とおり (jalan besar), ばすてい (halte bus), えき (stasiun) tidak cocok untuk banyak jalan bertemu.'),
    (27, 'vocabulary', 3, 'いえから がっこうまでの（　）が あります。',
        'Jawabannya きょり (jarak), sesuatu yang ada antara dua tempat. りょこう, かたみち, おうふく tidak cocok untuk konsep antara dua tempat.'),
    (28, 'vocabulary', 3, 'なまえと しゃしんが あります。それは（　）です。',
        'Jawabannya パスポート (paspor), dokumen yang berisi nama dan foto. きっぷ (tiket), にもつ (bagasi), よやく (reservasi) tidak berisi nama dan foto.'),
    (29, 'vocabulary', 3, 'かばんと スーツケースは（　）です。',
        'Jawabannya にもつ (barang bawaan), kategori umum untuk tas dan koper. きっぷ, パスポート, よやく bukan kategori barang bawaan.'),
    (30, 'vocabulary', 3, '「（　）くうこうまで 行きますか。」「タクシーで 行きます。」',
        'Jawabannya どうやって (bagaimana caranya), dijawab dengan cara transportasi タクシーで. なんで biasanya berarti "kenapa/mengapa"; sebagai 何で dalam konteks alat dapat berarti "dengan apa", sehingga bentuk kana saja ambigu. Untuk menanyakan CARA secara jelas, どうやって paling tepat. いつ menanyakan waktu dan だれと menanyakan teman.'),

    -- ===== もんだい1 文の文法1 (31-50) — 4 pola grammar Bab 9 =====
    (31, 'grammar'::TEXT, 1, 'あした がっこうへ（　）。',
        'Jawabannya 行きます (pergi) — besok saya PERGI ke sekolah. きます (datang) dan かえります (pulang) tidak cocok konteks pergi ke sekolah, あります dipakai untuk benda mati bukan aktivitas orang.'),
    (32, 'grammar', 1, 'あした せんせいは わたしの いえへ（　）。',
        'Jawabannya きます (datang) — besok guru DATANG ke rumah saya. 行きます (pergi) dan かえります (pulang) tidak cocok konteks seseorang datang ke tempat pembicara.'),
    (33, 'grammar', 1, 'わたしは まいにち いえへ（　）。',
        'Jawabannya かえります (pulang) — setiap hari saya PULANG ke rumah. 行きます (pergi) dan きます (datang) tidak cocok konteks pulang ke rumah sendiri.'),
    (34, 'grammar', 1, 'らいしゅう ともだちが にほんへ（　）。',
        'Jawabannya きます (datang) — minggu depan teman DATANG ke Jepang. 行きます dan かえります tidak cocok konteks seseorang datang ke tempat pembicara berada.'),
    (35, 'grammar', 1, 'がくせいは いえへ（　）。',
        'Jawabannya かえります (pulang) — siswa PULANG ke rumah. 行きます dan きます tidak cocok konteks pulang ke rumah sendiri.'),
    (36, 'grammar', 1, 'でんしゃ（　）行きます。',
        'Jawabannya で, menandai moda transportasi yang dipakai (naik kereta pergi). へ menandai arah tujuan (bukan moda), に dan の tidak cocok menandai moda transportasi.'),
    (37, 'grammar', 1, 'じてんしゃ（　）行きます。',
        'Jawabannya で, menandai moda transportasi. へ, に, の tidak cocok menandai moda transportasi.'),
    (38, 'grammar', 1, 'ひこうき（　）きます。',
        'Jawabannya で, menandai moda transportasi (naik pesawat datang). へ, に, の tidak cocok menandai moda transportasi.'),
    (39, 'grammar', 1, 'バス（　）かえります。',
        'Jawabannya で, menandai moda transportasi (naik bus pulang). へ, に, の tidak cocok menandai moda transportasi.'),
    (40, 'grammar', 1, 'タクシー（　）行きます。',
        'Jawabannya で, menandai moda transportasi (naik taksi pergi). へ, に, の tidak cocok menandai moda transportasi.'),
    (41, 'grammar', 1, 'いえ（　）がっこうまで とおいです。',
        'Jawabannya から, menandai titik awal rentang tempat (dari rumah). まで sudah dipakai di belakang kalimat, に dan の tidak cocok menandai titik awal.'),
    (42, 'grammar', 1, 'くじ（　）じゅうにじまで じゅぎょうが あります。',
        'Jawabannya から, menandai titik awal rentang waktu. まで sudah dipakai di belakang kalimat, に dan の tidak cocok menandai titik awal.'),
    (43, 'grammar', 1, 'いえから がっこう（　）とおいです。',
        'Jawabannya まで, menandai titik akhir rentang tempat. から sudah dipakai di depan kalimat, に dan の tidak cocok menandai titik akhir.'),
    (44, 'grammar', 1, 'くじから じゅうにじ（　）じゅぎょうが あります。',
        'Jawabannya まで, menandai titik akhir rentang waktu. から sudah dipakai di depan kalimat, に dan の tidak cocok menandai titik akhir.'),
    (45, 'grammar', 1, 'えき（　）くうこうまで タクシーで 行きます。',
        'Jawabannya から, menandai titik awal rentang tempat (dari stasiun). まで sudah dipakai di belakang kalimat, に dan の tidak cocok menandai titik awal.'),
    (46, 'grammar', 1, 'あした（　）行きますか。「がっこうへ 行きます。」',
        'Jawabannya どこへ (ke mana), dijawab dengan がっこうへ yang menyebut tujuan. いつ menanyakan waktu, だれと menanyakan teman, なんで menanyakan cara/alasan — ketiganya tidak cocok untuk menanyakan tujuan.'),
    (47, 'grammar', 1, '（　）にほんへ 行きますか。「らいねん 行きます。」',
        'Jawabannya いつ (kapan), dijawab dengan らいねん (tahun depan) yang menyebut waktu. どこへ menanyakan tujuan, だれと menanyakan teman, なんで menanyakan cara/alasan — ketiganya tidak cocok untuk menanyakan waktu.'),
    (48, 'grammar', 1, '（　）りょこうへ 行きますか。「かぞくと 行きます。」',
        'Jawabannya だれと (dengan siapa), dijawab dengan かぞくと (dengan keluarga). いつ menanyakan waktu, どこへ menanyakan tujuan, なんで menanyakan cara/alasan — ketiganya tidak cocok untuk menanyakan teman bepergian.'),
    (49, 'grammar', 1, 'せんせいは（　）きますか。「あした きます。」',
        'Jawabannya いつ (kapan), dijawab dengan あした (besok) yang menyebut waktu. どこへ, だれと, なんで tidak cocok untuk menanyakan waktu.'),
    (50, 'grammar', 1, '（　）としょかんへ 行きますか。「ともだちと 行きます。」',
        'Jawabannya だれと (dengan siapa), dijawab dengan ともだちと (dengan teman). いつ, どこへ, なんで tidak cocok untuk menanyakan teman bepergian.')
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
    (1, 0, 'くるま', TRUE),  (1, 1, 'しゃ', FALSE),   (1, 2, 'くろま', FALSE), (1, 3, 'くるみ', FALSE),
    (2, 0, 'ひがし', TRUE),  (2, 1, 'とう', FALSE),   (2, 2, 'ひかし', FALSE), (2, 3, 'ひがす', FALSE),
    (3, 0, 'みち', TRUE),    (3, 1, 'どう', FALSE),   (3, 2, 'みぢ', FALSE),   (3, 3, 'みつ', FALSE),
    (4, 0, 'えき', TRUE),    (4, 1, 'やく', FALSE),   (4, 2, 'うま', FALSE),   (4, 3, 'えぎ', FALSE),
    (5, 0, 'い', TRUE),      (5, 1, 'こう', FALSE),   (5, 2, 'ぎょう', FALSE), (5, 3, 'おこな', FALSE),
    (6, 0, 'にし', TRUE),    (6, 1, 'せい', FALSE),   (6, 2, 'にす', FALSE),   (6, 3, 'にじ', FALSE),
    (7, 0, 'でんしゃ', TRUE), (7, 1, 'でんくるま', FALSE), (7, 2, 'たいしゃ', FALSE), (7, 3, 'でんしや', FALSE),
    (8, 0, 'きた', TRUE),    (8, 1, 'ほく', FALSE),   (8, 2, 'きだ', FALSE),   (8, 3, 'きつ', FALSE),
    (9, 0, 'みなみ', TRUE),  (9, 1, 'なん', FALSE),   (9, 2, 'みなん', FALSE), (9, 3, 'みのみ', FALSE),

    -- 表記 — opsi bentuk tulisan
    (10, 0, '車道', TRUE), (10, 1, '駅前', FALSE), (10, 2, '国道', FALSE), (10, 3, '東西', FALSE),
    (11, 0, '駅前', TRUE), (11, 1, '車道', FALSE), (11, 2, '国道', FALSE), (11, 3, '南北', FALSE),
    (12, 0, '東西', TRUE), (12, 1, '南北', FALSE), (12, 2, '北東', FALSE), (12, 3, '北西', FALSE),
    (13, 0, '南北', TRUE), (13, 1, '東西', FALSE), (13, 2, '南東', FALSE), (13, 3, '南西', FALSE),
    (14, 0, '北東', TRUE), (14, 1, '北西', FALSE), (14, 2, '南東', FALSE), (14, 3, '南西', FALSE),
    (15, 0, '北西', TRUE), (15, 1, '北東', FALSE), (15, 2, '南東', FALSE), (15, 3, '南西', FALSE),
    (16, 0, '南東', TRUE), (16, 1, '南西', FALSE), (16, 2, '北東', FALSE), (16, 3, '北西', FALSE),
    (17, 0, '南西', TRUE), (17, 1, '南東', FALSE), (17, 2, '北西', FALSE), (17, 3, '北東', FALSE),
    (18, 0, '国道', TRUE), (18, 1, '車道', FALSE), (18, 2, '駅前', FALSE), (18, 3, '東西', FALSE),

    -- 文脈規定
    (19, 0, 'ひこうき', TRUE), (19, 1, 'ふね', FALSE),   (19, 2, 'でんしゃ', FALSE), (19, 3, 'バス', FALSE),
    (20, 0, 'ふね', TRUE),   (20, 1, 'ひこうき', FALSE), (20, 2, 'でんしゃ', FALSE), (20, 3, 'くるま', FALSE),
    (21, 0, 'しんかんせん', TRUE), (21, 1, 'ちかてつ', FALSE), (21, 2, 'バス', FALSE), (21, 3, 'タクシー', FALSE),
    (22, 0, 'おうふく', TRUE), (22, 1, 'きっぷ', FALSE), (22, 2, 'りょこう', FALSE), (22, 3, 'しゅっちょう', FALSE),
    (23, 0, 'スーツケース', TRUE), (23, 1, 'にもつ', FALSE), (23, 2, 'きっぷ', FALSE), (23, 3, 'パスポート', FALSE),
    (24, 0, 'かんこう', TRUE), (24, 1, 'しゅっちょう', FALSE), (24, 2, 'よやく', FALSE), (24, 3, 'きょり', FALSE),
    (25, 0, 'しんごう', TRUE), (25, 1, 'かいさつ', FALSE), (25, 2, 'ホーム', FALSE), (25, 3, 'せん', FALSE),
    (26, 0, 'こうさてん', TRUE), (26, 1, 'とおり', FALSE), (26, 2, 'ばすてい', FALSE), (26, 3, 'えき', FALSE),
    (27, 0, 'きょり', TRUE), (27, 1, 'りょこう', FALSE), (27, 2, 'かたみち', FALSE), (27, 3, 'おうふく', FALSE),
    (28, 0, 'パスポート', TRUE), (28, 1, 'きっぷ', FALSE), (28, 2, 'にもつ', FALSE), (28, 3, 'よやく', FALSE),
    (29, 0, 'にもつ', TRUE), (29, 1, 'きっぷ', FALSE), (29, 2, 'パスポート', FALSE), (29, 3, 'よやく', FALSE),
    (30, 0, 'どうやって', TRUE), (30, 1, 'なんで', FALSE), (30, 2, 'いつ', FALSE), (30, 3, 'だれと', FALSE),

    -- 文の文法1
    (31, 0, '行きます', TRUE), (31, 1, 'きます', FALSE), (31, 2, 'かえります', FALSE), (31, 3, 'あります', FALSE),
    (32, 0, 'きます', TRUE), (32, 1, '行きます', FALSE), (32, 2, 'かえります', FALSE), (32, 3, 'あります', FALSE),
    (33, 0, 'かえります', TRUE), (33, 1, '行きます', FALSE), (33, 2, 'きます', FALSE), (33, 3, 'あります', FALSE),
    (34, 0, 'きます', TRUE), (34, 1, '行きます', FALSE), (34, 2, 'かえります', FALSE), (34, 3, 'あります', FALSE),
    (35, 0, 'かえります', TRUE), (35, 1, '行きます', FALSE), (35, 2, 'きます', FALSE), (35, 3, 'あります', FALSE),
    (36, 0, 'で', TRUE), (36, 1, 'へ', FALSE), (36, 2, 'に', FALSE), (36, 3, 'の', FALSE),
    (37, 0, 'で', TRUE), (37, 1, 'へ', FALSE), (37, 2, 'に', FALSE), (37, 3, 'の', FALSE),
    (38, 0, 'で', TRUE), (38, 1, 'へ', FALSE), (38, 2, 'に', FALSE), (38, 3, 'の', FALSE),
    (39, 0, 'で', TRUE), (39, 1, 'へ', FALSE), (39, 2, 'に', FALSE), (39, 3, 'の', FALSE),
    (40, 0, 'で', TRUE), (40, 1, 'へ', FALSE), (40, 2, 'に', FALSE), (40, 3, 'の', FALSE),
    (41, 0, 'から', TRUE), (41, 1, 'まで', FALSE), (41, 2, 'に', FALSE), (41, 3, 'の', FALSE),
    (42, 0, 'から', TRUE), (42, 1, 'まで', FALSE), (42, 2, 'に', FALSE), (42, 3, 'の', FALSE),
    (43, 0, 'まで', TRUE), (43, 1, 'から', FALSE), (43, 2, 'に', FALSE), (43, 3, 'の', FALSE),
    (44, 0, 'まで', TRUE), (44, 1, 'から', FALSE), (44, 2, 'に', FALSE), (44, 3, 'の', FALSE),
    (45, 0, 'から', TRUE), (45, 1, 'まで', FALSE), (45, 2, 'に', FALSE), (45, 3, 'の', FALSE),
    (46, 0, 'どこへ', TRUE), (46, 1, 'いつ', FALSE), (46, 2, 'だれと', FALSE), (46, 3, 'なんで', FALSE),
    (47, 0, 'いつ', TRUE), (47, 1, 'どこへ', FALSE), (47, 2, 'だれと', FALSE), (47, 3, 'なんで', FALSE),
    (48, 0, 'だれと', TRUE), (48, 1, 'いつ', FALSE), (48, 2, 'どこへ', FALSE), (48, 3, 'なんで', FALSE),
    (49, 0, 'いつ', TRUE), (49, 1, 'どこへ', FALSE), (49, 2, 'だれと', FALSE), (49, 3, 'なんで', FALSE),
    (50, 0, 'だれと', TRUE), (50, 1, 'いつ', FALSE), (50, 2, 'どこへ', FALSE), (50, 3, 'なんで', FALSE)
  )
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT qq.id, o.option_text, o.ok, o.ord
    FROM o
    JOIN quiz_questions qq
      ON qq.lesson_id = v_lesson_id AND qq.sort_order = o.qno;

  -- ===== Assertion bentuk =====
  IF (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id) <> 50 THEN
    RAISE EXCEPTION '057: jumlah soal bukan 50 (dapat %)',
      (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
      LEFT JOIN quiz_options qo ON qo.question_id = qq.id
     WHERE qq.lesson_id = v_lesson_id
     GROUP BY qq.id
    HAVING COUNT(qo.id) <> 4 OR COUNT(*) FILTER (WHERE qo.is_correct) <> 1
  ) THEN
    RAISE EXCEPTION '057: ada soal yang opsinya bukan 4 atau kuncinya bukan tepat 1';
  END IF;

  -- ===== Pagar level =====

  -- 1. Badan kalimat (di LUAR target <u>…</u>) hanya boleh memakai kanji
  --    taught: 53 kanji Bab3-8 (termasuk 13 counter Bab5) + 9 kanji Bab 9.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND regexp_replace(
             regexp_replace(question, '<u>[^<]*</u>', '', 'g'),
             '[先何語校国生学名人魚本花八三十九一五四二六七安高古新白長男女気下前外間右中左後上時分円百千万年月半歳午前後車東道駅行西電北南]', '', 'g'
           ) ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '057: ada kanji di luar daftar taught pada badan kalimat soal';
  END IF;

  -- 2. Partikel di luar Bab 1-9. BARU di Bab 9: へ (arah tujuan), で (moda
  --    transportasi), と (bersama siapa) ditambahkan ke whitelist. を TETAP
  --    dilarang (belum diajarkan objek langsung kata kerja manapun).
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND question ~ '(を )'
  ) THEN
    RAISE EXCEPTION '057: ada partikel di luar materi Bab 1-9 pada teks soal';
  END IF;

  -- 3. Kata kerja: strip dulu SEMUA konjugasi あります／います (Bab 8) DAN
  --    行きます／きます／かえります (BARU Bab 9, afirmatif hadir) sebagai
  --    frasa aman, baru cek kata kerja LAIN yang masih dilarang. Urutan
  --    strip: paling spesifik dulu supaya tidak ada residu yang salah lolos.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
             question,
             'そうじゃありません', ''), 'じゃありません', ''),
             'ありませんでした', ''), 'いませんでした', ''),
             'ありました', ''), 'いました', ''),
             'ありません', ''), 'います', ''), 'あります', ''),
             '行きます', ''), 'きます', ''), 'かえります', ''),
             'よろしくおねがいします', ''), 'ありがとうございます', ''), 'そうです', ''),
             'すみません', '')
           ~ '(ます|ました|ません|いる|ある|いて|べんきょう|わかり|はたら)'
  ) THEN
    RAISE EXCEPTION '057: ada indikasi kata kerja di luar あります／います／行く／来る／帰る pada teks soal';
  END IF;

  -- 4. Rantai の dalam satu kalimat.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '057: ada kalimat dengan rantai の (lebih dari satu の dalam satu kalimat)';
  END IF;

  -- 5. Target section: もんだい1 wajib kanji di dalam <u>, もんだい2 wajib kana.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 1
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '') !~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '057: ada soal 漢字読み yang target <u> nya tidak mengandung kanji';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 2
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '一') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '057: ada soal 表記 yang target <u> nya sudah berupa kanji';
  END IF;

  -- 6. DEDUP WAJIB — target <u> tidak boleh sama dengan salah satu dari 78
  --    target unik yang sudah dipakai di 042/045/047/051/053/055.
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
         '前後','上下','左右','中間','時間','外国','中学生','午前中','九時間'
       ])
  ) THEN
    RAISE EXCEPTION '057: ada target <u> yang sudah pernah diujikan di migration 042/045/047/051/053/055';
  END IF;

  RAISE NOTICE '057: selesai — 50 soal (vocabulary 30, grammar 20), semua pagar level + dedup lolos.';
END $$;
