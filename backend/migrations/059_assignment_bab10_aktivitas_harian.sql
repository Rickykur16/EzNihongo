-- 059_assignment_bab10_aktivitas_harian.sql — Assignment Bab 10: Aktivitas
-- Harian.
--
-- Ujian bab untuk Bab 10, sumber Notion N5-B10 "Aktivitas Harian" (Daily
-- Activities). Modul di-resolve ordinal (OFFSET 9, lanjutan pola 039-057).
--
-- Kebijakan 50/50 (Bab 8+, sudah berlaku sejak 055): questions_per_attempt
-- = 50, SEMUA soal ditampilkan tiap attempt (bukan sampling 30).
--
-- PERUBAHAN PAGAR PALING BESAR SEJAUH INI — Bab 10 memperkenalkan
-- paradigma konjugasi kata kerja LENGKAP (kini afirmatif/negatif, lampau
-- afirmatif/negatif) DAN partikel を (objek langsung) untuk PERTAMA
-- KALINYA di assignment kuis manapun:
--   1. Partikel: を ditambahkan ke whitelist. Dengan ini, SEMUA partikel
--      dasar N5 (は/も/の/か/ね/よ/から/まで/に/が/へ/で/と/を) sudah
--      resmi diajarkan kumulatif — ASSERTION PARTIKEL-BAN DIHAPUS mulai
--      migrasi ini (tidak ada lagi partikel dasar N5 yang perlu
--      dilarang; partikel lanjutan seperti や/とか/だけ/しか belum
--      diajarkan tapi tidak butuh assertion terpisah karena migrasi ini
--      tidak memakainya sama sekali).
--   2. Kata kerja: strip-chain diperluas dengan 11 kata kerja Bab 10 yang
--      DIPAKAI di file ini (bukan seluruh 35 kosakata 動詞 Bab 10 — hanya
--      yang benar-benar dipakai, konsisten dengan disiplin "extend hanya
--      yang dipakai" sejak Bab 8/9): 読む・書く・見る・食べる・飲む・
--      話す・勉強する・働く, semua 4 bentuk (ます/ません/ました/
--      ませんでした) SEJAUH bentuk itu benar-benar muncul di teks soal
--      (opsi jawaban TIDAK di-pagar — assertion cuma cek kolom question).
--      PENTING: 勉強します WAJIB di-strip SEBELUM します bare (urutan
--      nested replace: paling spesifik dulu) — kalau tidak, sisa
--      "べんきょう" akan salah ke-flag oleh regex banned-verb yang masih
--      punya べんきょう sebagai salah satu alternatif literal.
--   3. Dari 8 kata kerja itu, hanya 読/見/書 yang kanjinya resmi
--      diajarkan Bab 10 (lihat whitelist di bawah) — jadi 読みます/
--      書きました/見ません SELALU ditulis kanji (jadi target §1 soal
--      1-3, seluruh kata di dalam <u> supaya tidak kepotong tag), sisanya
--      (食べる/飲む/話す/勉強する/働く, kanji belum diajarkan) SELALU
--      ditulis hiragana murni di seluruh file.
--
-- 3 kanji resmi Bab 10 (見読書, dikonfirmasi dari Notion Kanji DB filter
-- "First Lesson"=Bab10 — lebih sedikit dari 8 kandidat yang disebut di
-- catatan Notion) ditambahkan ke whitelist kanji badan kalimat, union
-- dengan 62 kanji taught Bab3-9.
--
-- Karena cuma 3 kanji resmi baru, §1 漢字読み diisi 3 soal kata kerja
-- (読/見/書) + 6 soal REVIEW kombinasi kanji taught lama yang belum
-- pernah jadi target (bukan kosakata benda Bab 10 sendiri — semua benda
-- Bab 10 seperti 仕事/宿題/授業/試験 pakai kanji yang BELUM diajarkan,
-- jadi tetap kana murni di seluruh soal).
--
-- REF_CHECK bacaan (sumber kebenaran tunggal):
--   読みます＝よみます   書きました＝かきました   見ません＝みません
--   (ketiganya beraturan — kunyomi verb-stem standar)
--   三十分＝さんじゅっぷん (TIDAK BERATURAN — euphonic/rendaku, 分 setelah
--     じゅう berubah jadi っぷん, bukan ぶん)
-- Kombinasi lain di §1/§2 (六年生/高校生/二百人/八時半/何年生/半年/中年/
-- 五千円/二千円/半分/十五分) semua bacaan onyomi/kunyomi beraturan.
--
-- DEDUP WAJIB (pola established sejak 047): tidak boleh menguji ulang
-- target <u> yang sudah dipakai di 042/045/047/051/053/055/057 — 96
-- target unik (78 dari 042-055 + 18 dari 057), di-grep ulang dari file
-- migrasi sungguhan.
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
  v_lesson_slug  TEXT := 'assignment-bab-10-aktivitas-harian';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson_id    UUID;
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 9 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '059: modul Bab 10 di kursus % tidak ditemukan — skip seed assignment.', v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* '(aktivitas|harian|daily|kegiatan)' THEN
    RAISE NOTICE '059: modul Bab 10 terbaca "%" — kalau ternyata bukan Bab Aktivitas Harian, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).', v_module_title;
  END IF;

  RAISE NOTICE '059: seed Assignment Bab 10 ke modul "%".', v_module_title;

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, questions_per_attempt, cooldown_hours
  ) VALUES (
    v_module_id, v_lesson_slug, 'Assignment Bab 10 — Aktivitas Harian', 'quiz',
    'Tes materi Bab 10 (Aktivitas Harian) gaya JLPT. Moji-Goi: cara baca kata kerja 読む／見る／書く dan kombinasi kanji review, cara menulisnya, serta kosakata aktivitas harian sesuai konteks. Tata Bahasa: 〜を[kata kerja]ます (objek langsung), [kata kerja]ません (negatif kini), [kata kerja]ました (lampau afirmatif), [kata kerja]ませんでした (lampau negatif), dan kata keterangan frekuensi (毎日／いつも／時々). Semua 50 soal ditampilkan tiap attempt. Lulus 70% (35/50), cooldown 12 jam.',
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
    -- ===== もんだい1 漢字読み (1-9) — 3 kata kerja + 6 review kombinasi =====
    (1, 'vocabulary'::TEXT, 1, 'わたしは まいにち ほんを <u>読みます</u>。',
        '読みます dibaca よみます (membaca). 読 dibaca よ(む) di bentuk kunyomi kata kerja ini.'),
    (2, 'vocabulary', 1, 'きのう てがみを <u>書きました</u>。',
        '書きました dibaca かきました (sudah menulis). 書 dibaca か(く) di bentuk kunyomi kata kerja ini.'),
    (3, 'vocabulary', 1, 'テレビを <u>見ません</u>。',
        '見ません dibaca みません (tidak menonton). 見 dibaca み(る) di bentuk kunyomi kata kerja ini.'),
    (4, 'vocabulary', 1, 'あには <u>六年生</u>です。',
        '六年生 dibaca ろくねんせい (siswa kelas 6). 六 dibaca ろく, beda dari bacaan む(っつ) yang dipakai untuk menghitung benda.'),
    (5, 'vocabulary', 1, 'あねは <u>高校生</u>です。',
        '高校生 dibaca こうこうせい (siswa SMA). 高 dibaca コウ (onyomi) di kata gabungan ini, beda dari kunyomi たか(い).'),
    (6, 'vocabulary', 1, 'じゅぎょうは <u>三十分</u>です。',
        '三十分 dibaca さんじゅっぷん (30 menit) — bacaan TIDAK beraturan, 分 setelah じゅう berubah jadi っぷん (bukan ぶん) karena perubahan bunyi (euphonic).'),
    (7, 'vocabulary', 1, 'がっこうに <u>二百人</u>の がくせいが います。',
        '二百人 dibaca にひゃくにん (200 orang). 二 dibaca に, 百 dibaca ひゃく, 人 dibaca にん — semua bacaan beraturan.'),
    (8, 'vocabulary', 1, 'テストは <u>八時半</u>からです。',
        '八時半 dibaca はちじはん (jam 8:30). 八 dibaca はち, 時 dibaca じ, 半 dibaca はん — semua bacaan beraturan.'),
    (9, 'vocabulary', 1, 'あには <u>何年生</u>ですか。',
        '何年生 dibaca なんねんせい (kelas berapa). 何 dibaca なん sebelum kata benda, sama seperti 何人 (なんにん) dan 何時 (なんじ).'),

    -- ===== もんだい2 表記 (10-18) — target hiragana, jawaban bentuk tulisan =====
    (10, 'vocabulary', 2, 'きのう ざっしを <u>よみました</u>。',
        'よみました ditulis 読みました (sudah membaca majalah). Salah: 見ました (みました, sudah menonton), 聞きました (ききました, sudah mendengar), 書きました (かきました, sudah menulis).'),
    (11, 'vocabulary', 2, 'あした しゅくだいを <u>かきます</u>。',
        'かきます ditulis 書きます (menulis PR). Salah: 読みます (よみます, membaca), 見ます (みます, menonton), 話します (はなします, berbicara).'),
    (12, 'vocabulary', 2, 'えいがを <u>みました</u>。',
        'みました ditulis 見ました (sudah menonton film). Salah: 読みました (よみました, sudah membaca), 聞きました (ききました, sudah mendengar), 書きました (かきました, sudah menulis).'),
    (13, 'vocabulary', 2, 'テストは <u>はんとし</u>に いちど あります。',
        'はんとし ditulis 半年 (setengah tahun/6 bulan). Salah: 半分 (はんぶん, setengah), 中年 (ちゅうねん, usia paruh baya), 一年 (いちねん, satu tahun).'),
    (14, 'vocabulary', 2, 'あには <u>ちゅうねん</u>です。',
        'ちゅうねん ditulis 中年 (usia paruh baya). Salah: 半年 (はんとし, setengah tahun), 中学生 (ちゅうがくせい, siswa SMP), 中間 (ちゅうかん, tengah).'),
    (15, 'vocabulary', 2, 'これは <u>ごせんえん</u>です。',
        'ごせんえん ditulis 五千円 (5000 yen). Salah: 五百円 (ごひゃくえん, 500 yen), 二千円 (にせんえん, 2000 yen), 五千人 (ごせんにん, 5000 orang).'),
    (16, 'vocabulary', 2, 'きっぷは <u>にせんえん</u>です。',
        'にせんえん ditulis 二千円 (2000 yen). Salah: 二百円 (にひゃくえん, 200 yen), 五千円 (ごせんえん, 5000 yen), 二千人 (にせんにん, 2000 orang).'),
    (17, 'vocabulary', 2, 'これは りんごの <u>はんぶん</u>です。',
        'はんぶん ditulis 半分 (setengah). Salah: 半年 (はんとし, setengah tahun), 十分 (じゅっぷん, 10 menit), 三十分 (さんじゅっぷん, 30 menit).'),
    (18, 'vocabulary', 2, 'やすみは <u>じゅうごふん</u>です。',
        'じゅうごふん ditulis 十五分 (15 menit). Salah: 十分 (じゅっぷん, 10 menit), 五分 (ごふん, 5 menit), 二十分 (にじゅっぷん, 20 menit).'),

    -- ===== もんだい3 文脈規定 (19-30) — kosakata aktivitas harian =====
    (19, 'vocabulary', 3, 'あさの ごはんは（　）です。',
        'Jawabannya あさごはん (sarapan), makanan di waktu pagi. ひるごはん (makan siang), ばんごはん (makan malam), おべんとう (bento) bukan makanan pagi.'),
    (20, 'vocabulary', 3, 'ひるの ごはんは（　）です。',
        'Jawabannya ひるごはん (makan siang). あさごはん, ばんごはん, おべんとう tidak berkaitan dengan waktu siang.'),
    (21, 'vocabulary', 3, 'ばんの ごはんは（　）です。',
        'Jawabannya ばんごはん (makan malam). あさごはん, ひるごはん, おべんとう tidak berkaitan dengan waktu malam.'),
    (22, 'vocabulary', 3, 'がっこうの（　）は はちじからです。',
        'Jawabannya じゅぎょう (pelajaran/kelas), sesuatu yang dimulai jam 8 di sekolah. しけん (ujian), かいぎ (rapat, bukan di sekolah), れんしゅう (latihan) kurang tepat konteksnya.'),
    (23, 'vocabulary', 3, 'きょうは（　）が あります。「だいがくの しけんです。」',
        'Jawabannya しけん (ujian), dijawab dengan だいがくの しけんです. じゅぎょう, かいぎ, れんしゅう tidak cocok dengan jawaban tentang ujian.'),
    (24, 'vocabulary', 3, 'スポーツの（　）は おもしろいです。',
        'Jawabannya れんしゅう (latihan), sesuatu yang dilakukan dalam olahraga. しけん, じゅぎょう, かいぎ tidak berkaitan dengan olahraga.'),
    (25, 'vocabulary', 3, 'かいしゃに（　）が あります。「あした じゅうじからです。」',
        'Jawabannya かいぎ (rapat), sesuatu di kantor yang dijawab dengan waktu jam 10. しけん, じゅぎょう, れんしゅう tidak cocok untuk konteks kantor.'),
    (26, 'vocabulary', 3, 'きょうの（　）は むずかしいです。',
        'Jawabannya しゅくだい (PR), sesuatu yang bisa "sulit". しけん, じゅぎょう, かいぎ kurang cocok dipasangkan dengan kata "sulit" di konteks ini.'),
    (27, 'vocabulary', 3, 'がっこうで（　）を たべます。「おべんとうです。」',
        'Jawabannya おべんとう (bento), dijawab langsung di kalimat kedua. あさごはん, ひるごはん, ばんごはん tidak cocok dibawa dan dimakan di sekolah.'),
    (28, 'vocabulary', 3, 'かいしゃで（　）を します。「しごとです。」',
        'Jawabannya しごと (pekerjaan), dijawab langsung. しゅくだい, しけん, れんしゅう tidak cocok untuk konteks kantor.'),
    (29, 'vocabulary', 3, 'まいにち（　）を します。「うんどうです。」',
        'Jawabannya うんどう (olahraga), dijawab langsung. しごと, しゅくだい, れんしゅう kurang cocok untuk kegiatan harian yang disebut.'),
    (30, 'vocabulary', 3, 'わたしは いつも（　）を のみます。「コーヒーです。」',
        'Jawabannya コーヒー (kopi), dijawab langsung. ぎゅうにゅう (susu), みず (air), おちゃ (teh) juga minuman tapi bukan jawaban yang disebut di kalimat kedua.'),

    -- ===== もんだい1 文の文法1 (31-50) — 5 pola grammar Bab 10 =====
    (31, 'grammar'::TEXT, 1, 'ごはん（　）たべます。',
        'Jawabannya を, menandai objek langsung (apa yang dimakan). は menandai topik, が menandai subjek, に menandai lokasi/tujuan — ketiganya tidak menandai objek langsung.'),
    (32, 'grammar', 1, 'ほん（　）よみます。',
        'Jawabannya を, menandai objek langsung. は, が, に tidak menandai objek langsung.'),
    (33, 'grammar', 1, 'にほんご（　）はなします。',
        'Jawabannya を, menandai objek langsung. は, が, に tidak menandai objek langsung.'),
    (34, 'grammar', 1, 'コーヒー（　）のみます。',
        'Jawabannya を, menandai objek langsung. は, が, に tidak menandai objek langsung.'),
    (35, 'grammar', 1, 'わたしは にくを ぜんぜん（　）。',
        'Jawabannya たべません — ぜんぜん (tidak sama sekali) memerlukan bentuk negatif. たべます (afirmatif kini), たべました (afirmatif lampau), たべませんでした (negatif lampau) tidak cocok dengan konteks kini.'),
    (36, 'grammar', 1, 'きょうは しごとが ありません。（　）。',
        'Jawabannya はたらきません — tidak ada kerjaan hari ini, jadi tidak bekerja. はたらきます, はたらきました, はたらきませんでした tidak cocok konteks negatif kini.'),
    (37, 'grammar', 1, 'わたしは おさけを ぜんぜん（　）。',
        'Jawabannya のみません — ぜんぜん memerlukan bentuk negatif kini. のみます, のみました, のみませんでした tidak cocok.'),
    (38, 'grammar', 1, 'あには えいごを ぜんぜん（　）。',
        'Jawabannya はなしません — ぜんぜん memerlukan bentuk negatif kini. はなします, はなしました, はなしませんでした tidak cocok.'),
    (39, 'grammar', 1, 'きのう ほんを（　）。',
        'Jawabannya よみました — きのう (kemarin) memerlukan bentuk lampau afirmatif. よみます, よみません, よみませんでした tidak cocok konteks lampau afirmatif.'),
    (40, 'grammar', 1, 'きのう てがみを（　）。',
        'Jawabannya かきました — きのう memerlukan bentuk lampau afirmatif. かきます, かきません, かきませんでした tidak cocok.'),
    (41, 'grammar', 1, 'きのう えいがを（　）。',
        'Jawabannya みました — きのう memerlukan bentuk lampau afirmatif. みます, みません, みませんでした tidak cocok.'),
    (42, 'grammar', 1, 'きのう おんがくを（　）。',
        'Jawabannya ききました — きのう memerlukan bentuk lampau afirmatif. ききます, ききません, ききませんでした tidak cocok.'),
    (43, 'grammar', 1, 'きのう なにも（　）。',
        'Jawabannya たべませんでした — きのう + なにも (tidak apa-apa) memerlukan bentuk lampau negatif. たべます, たべません, たべました tidak cocok konteks lampau negatif.'),
    (44, 'grammar', 1, 'きのうは にちようびでした。（　）。',
        'Jawabannya はたらきませんでした — hari Minggu kemarin, jadi tidak bekerja (lampau negatif). はたらきます, はたらきません, はたらきました tidak cocok.'),
    (45, 'grammar', 1, 'きのう だれとも（　）。',
        'Jawabannya はなしませんでした — きのう + だれとも (dengan siapa pun tidak) memerlukan bentuk lampau negatif. はなします, はなしません, はなしました tidak cocok.'),
    (46, 'grammar', 1, 'きのう テレビを（　）。',
        'Jawabannya みませんでした — konteks kalimat 43-46 semua きのう bentuk lampau negatif (tidak ada penanda afirmatif). みます, みません, みました tidak cocok.'),
    (47, 'grammar', 1, 'わたしは（　）べんきょうします。',
        'Jawabannya まいにち (setiap hari), kata keterangan frekuensi paling umum untuk kebiasaan belajar rutin. いつも, ときどき, ぜんぜん kurang pas untuk konteks netral ini.'),
    (48, 'grammar', 1, 'あには（　）はたらきません。',
        'Jawabannya ぜんぜん (tidak sama sekali), memperkuat bentuk negatif はたらきません. まいにち, いつも, ときどき tidak selaras dengan makna negatif total.'),
    (49, 'grammar', 1, 'わたしは（　）としょかんに いきます。',
        'Jawabannya ときどき (kadang-kadang), frekuensi sedang untuk kegiatan yang tidak rutin. まいにち, いつも, ぜんぜん kurang pas untuk konteks kadang-kadang.'),
    (50, 'grammar', 1, 'あねは（　）げんきです。',
        'Jawabannya いつも (selalu), cocok untuk sifat yang konsisten seperti selalu sehat/bersemangat. ぜんぜん, ときどき, まいにち kurang pas untuk makna "selalu".')
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
    (1, 0, 'よみます', TRUE),   (1, 1, 'みます', FALSE),     (1, 2, 'かきます', FALSE),   (1, 3, 'ききます', FALSE),
    (2, 0, 'かきました', TRUE), (2, 1, 'よみました', FALSE), (2, 2, 'みました', FALSE),   (2, 3, 'たべました', FALSE),
    (3, 0, 'みません', TRUE),   (3, 1, 'よみません', FALSE), (3, 2, 'ききません', FALSE), (3, 3, 'かきません', FALSE),
    (4, 0, 'ろくねんせい', TRUE), (4, 1, 'ごねんせい', FALSE), (4, 2, 'よねんせい', FALSE), (4, 3, 'はちねんせい', FALSE),
    (5, 0, 'こうこうせい', TRUE), (5, 1, 'だいがくせい', FALSE), (5, 2, 'ちゅうがくせい', FALSE), (5, 3, 'しょうがくせい', FALSE),
    (6, 0, 'さんじゅっぷん', TRUE), (6, 1, 'さんじゅうぶん', FALSE), (6, 2, 'じゅっぷん', FALSE), (6, 3, 'よんじゅっぷん', FALSE),
    (7, 0, 'にひゃくにん', TRUE), (7, 1, 'にひゃくえん', FALSE), (7, 2, 'ひゃくにん', FALSE), (7, 3, 'さんびゃくにん', FALSE),
    (8, 0, 'はちじはん', TRUE), (8, 1, 'くじはん', FALSE), (8, 2, 'しちじはん', FALSE), (8, 3, 'はちじ', FALSE),
    (9, 0, 'なんねんせい', TRUE), (9, 1, 'なんじ', FALSE), (9, 2, 'なんにん', FALSE), (9, 3, 'なんがつ', FALSE),

    -- 表記 — opsi bentuk tulisan
    (10, 0, '読みました', TRUE), (10, 1, '見ました', FALSE), (10, 2, '聞きました', FALSE), (10, 3, '書きました', FALSE),
    (11, 0, '書きます', TRUE), (11, 1, '読みます', FALSE), (11, 2, '見ます', FALSE), (11, 3, '話します', FALSE),
    (12, 0, '見ました', TRUE), (12, 1, '読みました', FALSE), (12, 2, '聞きました', FALSE), (12, 3, '書きました', FALSE),
    (13, 0, '半年', TRUE), (13, 1, '半分', FALSE), (13, 2, '中年', FALSE), (13, 3, '一年', FALSE),
    (14, 0, '中年', TRUE), (14, 1, '半年', FALSE), (14, 2, '中学生', FALSE), (14, 3, '中間', FALSE),
    (15, 0, '五千円', TRUE), (15, 1, '五百円', FALSE), (15, 2, '二千円', FALSE), (15, 3, '五千人', FALSE),
    (16, 0, '二千円', TRUE), (16, 1, '二百円', FALSE), (16, 2, '五千円', FALSE), (16, 3, '二千人', FALSE),
    (17, 0, '半分', TRUE), (17, 1, '半年', FALSE), (17, 2, '十分', FALSE), (17, 3, '三十分', FALSE),
    (18, 0, '十五分', TRUE), (18, 1, '十分', FALSE), (18, 2, '五分', FALSE), (18, 3, '二十分', FALSE),

    -- 文脈規定
    (19, 0, 'あさごはん', TRUE), (19, 1, 'ひるごはん', FALSE), (19, 2, 'ばんごはん', FALSE), (19, 3, 'おべんとう', FALSE),
    (20, 0, 'ひるごはん', TRUE), (20, 1, 'あさごはん', FALSE), (20, 2, 'ばんごはん', FALSE), (20, 3, 'おべんとう', FALSE),
    (21, 0, 'ばんごはん', TRUE), (21, 1, 'あさごはん', FALSE), (21, 2, 'ひるごはん', FALSE), (21, 3, 'おべんとう', FALSE),
    (22, 0, 'じゅぎょう', TRUE), (22, 1, 'しけん', FALSE), (22, 2, 'かいぎ', FALSE), (22, 3, 'れんしゅう', FALSE),
    (23, 0, 'しけん', TRUE), (23, 1, 'じゅぎょう', FALSE), (23, 2, 'かいぎ', FALSE), (23, 3, 'れんしゅう', FALSE),
    (24, 0, 'れんしゅう', TRUE), (24, 1, 'しけん', FALSE), (24, 2, 'じゅぎょう', FALSE), (24, 3, 'かいぎ', FALSE),
    (25, 0, 'かいぎ', TRUE), (25, 1, 'しけん', FALSE), (25, 2, 'じゅぎょう', FALSE), (25, 3, 'れんしゅう', FALSE),
    (26, 0, 'しゅくだい', TRUE), (26, 1, 'しけん', FALSE), (26, 2, 'じゅぎょう', FALSE), (26, 3, 'かいぎ', FALSE),
    (27, 0, 'おべんとう', TRUE), (27, 1, 'あさごはん', FALSE), (27, 2, 'ひるごはん', FALSE), (27, 3, 'ばんごはん', FALSE),
    (28, 0, 'しごと', TRUE), (28, 1, 'しゅくだい', FALSE), (28, 2, 'しけん', FALSE), (28, 3, 'れんしゅう', FALSE),
    (29, 0, 'うんどう', TRUE), (29, 1, 'しごと', FALSE), (29, 2, 'しゅくだい', FALSE), (29, 3, 'れんしゅう', FALSE),
    (30, 0, 'コーヒー', TRUE), (30, 1, 'ぎゅうにゅう', FALSE), (30, 2, 'みず', FALSE), (30, 3, 'おちゃ', FALSE),

    -- 文の文法1
    (31, 0, 'を', TRUE), (31, 1, 'は', FALSE), (31, 2, 'が', FALSE), (31, 3, 'に', FALSE),
    (32, 0, 'を', TRUE), (32, 1, 'は', FALSE), (32, 2, 'が', FALSE), (32, 3, 'に', FALSE),
    (33, 0, 'を', TRUE), (33, 1, 'は', FALSE), (33, 2, 'が', FALSE), (33, 3, 'に', FALSE),
    (34, 0, 'を', TRUE), (34, 1, 'は', FALSE), (34, 2, 'が', FALSE), (34, 3, 'に', FALSE),
    (35, 0, 'たべません', TRUE), (35, 1, 'たべます', FALSE), (35, 2, 'たべました', FALSE), (35, 3, 'たべませんでした', FALSE),
    (36, 0, 'はたらきません', TRUE), (36, 1, 'はたらきます', FALSE), (36, 2, 'はたらきました', FALSE), (36, 3, 'はたらきませんでした', FALSE),
    (37, 0, 'のみません', TRUE), (37, 1, 'のみます', FALSE), (37, 2, 'のみました', FALSE), (37, 3, 'のみませんでした', FALSE),
    (38, 0, 'はなしません', TRUE), (38, 1, 'はなします', FALSE), (38, 2, 'はなしました', FALSE), (38, 3, 'はなしませんでした', FALSE),
    (39, 0, 'よみました', TRUE), (39, 1, 'よみます', FALSE), (39, 2, 'よみません', FALSE), (39, 3, 'よみませんでした', FALSE),
    (40, 0, 'かきました', TRUE), (40, 1, 'かきます', FALSE), (40, 2, 'かきません', FALSE), (40, 3, 'かきませんでした', FALSE),
    (41, 0, 'みました', TRUE), (41, 1, 'みます', FALSE), (41, 2, 'みません', FALSE), (41, 3, 'みませんでした', FALSE),
    (42, 0, 'ききました', TRUE), (42, 1, 'ききます', FALSE), (42, 2, 'ききません', FALSE), (42, 3, 'ききませんでした', FALSE),
    (43, 0, 'たべませんでした', TRUE), (43, 1, 'たべます', FALSE), (43, 2, 'たべません', FALSE), (43, 3, 'たべました', FALSE),
    (44, 0, 'はたらきませんでした', TRUE), (44, 1, 'はたらきます', FALSE), (44, 2, 'はたらきません', FALSE), (44, 3, 'はたらきました', FALSE),
    (45, 0, 'はなしませんでした', TRUE), (45, 1, 'はなします', FALSE), (45, 2, 'はなしません', FALSE), (45, 3, 'はなしました', FALSE),
    (46, 0, 'みませんでした', TRUE), (46, 1, 'みます', FALSE), (46, 2, 'みません', FALSE), (46, 3, 'みました', FALSE),
    (47, 0, 'まいにち', TRUE), (47, 1, 'いつも', FALSE), (47, 2, 'ときどき', FALSE), (47, 3, 'ぜんぜん', FALSE),
    (48, 0, 'ぜんぜん', TRUE), (48, 1, 'まいにち', FALSE), (48, 2, 'いつも', FALSE), (48, 3, 'ときどき', FALSE),
    (49, 0, 'ときどき', TRUE), (49, 1, 'まいにち', FALSE), (49, 2, 'いつも', FALSE), (49, 3, 'ぜんぜん', FALSE),
    (50, 0, 'いつも', TRUE), (50, 1, 'ぜんぜん', FALSE), (50, 2, 'ときどき', FALSE), (50, 3, 'まいにち', FALSE)
  )
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT qq.id, o.option_text, o.ok, o.ord
    FROM o
    JOIN quiz_questions qq
      ON qq.lesson_id = v_lesson_id AND qq.sort_order = o.qno;

  -- ===== Assertion bentuk =====
  IF (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id) <> 50 THEN
    RAISE EXCEPTION '059: jumlah soal bukan 50 (dapat %)',
      (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
      LEFT JOIN quiz_options qo ON qo.question_id = qq.id
     WHERE qq.lesson_id = v_lesson_id
     GROUP BY qq.id
    HAVING COUNT(qo.id) <> 4 OR COUNT(*) FILTER (WHERE qo.is_correct) <> 1
  ) THEN
    RAISE EXCEPTION '059: ada soal yang opsinya bukan 4 atau kuncinya bukan tepat 1';
  END IF;

  -- ===== Pagar level =====

  -- 1. Badan kalimat (di LUAR target <u>…</u>) hanya boleh memakai kanji
  --    taught: 62 kanji Bab3-9 + 3 kanji Bab 10 (見読書).
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND regexp_replace(
             regexp_replace(question, '<u>[^<]*</u>', '', 'g'),
             '[先何語校国生学名人魚本花八三十九一五四二六七安高古新白長男女気下前外間右中左後上時分円百千万年月半歳午前後車東道駅行西電北南見読書]', '', 'g'
           ) ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '059: ada kanji di luar daftar taught pada badan kalimat soal';
  END IF;

  -- 2. Partikel: TIDAK ADA ASSERTION LAGI mulai migrasi ini — semua
  --    partikel dasar N5 (は/も/の/か/ね/よ/から/まで/に/が/へ/で/と/を)
  --    sudah resmi diajarkan kumulatif sampai Bab 10.

  -- 3. Kata kerja: strip dulu SEMUA konjugasi あります／います (Bab 8),
  --    行く／来る／帰る (Bab 9), DAN 8 kata kerja Bab 10 yang dipakai file
  --    ini (読む・書く・見る・食べる・飲む・話す・勉強する・働く) sebagai
  --    frasa aman, baru cek kata kerja LAIN yang masih dilarang. Urutan
  --    strip: paling spesifik dulu — 勉強します WAJIB sebelum します bare
  --    supaya residu "べんきょう" tidak salah ke-flag.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(question,
             'そうじゃありません', ''), 'じゃありません', ''), 'ありませんでした', ''), 'いませんでした', ''), 'ありました', ''), 'いました', ''), 'ありません', ''), 'います', ''), 'あります', ''), '行きます', ''), 'きます', ''), 'かえります', ''), '読みます', ''), '書きました', ''), '見ません', ''), 'よみました', ''), 'かきます', ''), 'みました', ''), 'たべます', ''), '勉強します', ''), 'べんきょうします', ''), 'します', ''), 'のみます', ''), 'よみます', ''), 'はなします', ''), 'はたらきません', ''), 'よろしくおねがいします', ''), 'ありがとうございます', ''), 'そうです', ''), 'すみません', '')
           ~ '(ます|ました|ません|いる|ある|いて|べんきょう|わかり|はたら)'
  ) THEN
    RAISE EXCEPTION '059: ada indikasi kata kerja di luar daftar aman pada teks soal';
  END IF;

  -- 4. Rantai の dalam satu kalimat.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '059: ada kalimat dengan rantai の (lebih dari satu の dalam satu kalimat)';
  END IF;

  -- 5. Target section: もんだい1 wajib kanji di dalam <u>, もんだい2 wajib kana.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 1
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '') !~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '059: ada soal 漢字読み yang target <u> nya tidak mengandung kanji';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 2
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '一') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '059: ada soal 表記 yang target <u> nya sudah berupa kanji';
  END IF;

  -- 6. DEDUP WAJIB — target <u> tidak boleh sama dengan salah satu dari 96
  --    target unik yang sudah dipakai di 042/045/047/051/053/055/057.
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
         'しゃどう','えきまえ','とうざい','なんぼく','ほくとう','ほくせい','なんとう','なんせい','こくどう'
       ])
  ) THEN
    RAISE EXCEPTION '059: ada target <u> yang sudah pernah diujikan di migration 042/045/047/051/053/055/057';
  END IF;

  RAISE NOTICE '059: selesai — 50 soal (vocabulary 30, grammar 20), semua pagar level + dedup lolos.';
END $$;
