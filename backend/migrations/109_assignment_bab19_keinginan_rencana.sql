-- 109_assignment_bab19_keinginan_rencana.sql — Assignment Bab 19:
-- Keinginan & Rencana.
--
-- Ujian bab untuk Bab 19, melanjutkan pola assignment Bab 1-18
-- (039/040/041/045/047/051/053/055/057/059/061/100/104/103/105/106/107/108).
-- Modul di-resolve ordinal (OFFSET 18, lanjutan pola 039-108).
--
-- JUDUL pakai TITIK DUA sejak awal (konvensi migration 079).
--
-- Kebijakan 50/50 (Bab 8+, berlaku sejak 055): questions_per_attempt = 50,
-- SEMUA soal ditampilkan tiap attempt (bukan sampling 30).
--
-- KANJI: Bab 19 memperkenalkan 5 kanji BARU — 雨(あめ)・天(てん, dalam
-- 天気)・空(そら)・山(やま)・川(かわ) — dikonfirmasi header
-- 088_bunpou_bab19.sql. 欲・予定 BELUM diajarkan, jadi ほしい／よてい
-- SELALU kana. もんだい1/2 diisi KOSAKATA POLOS 5 kanji baru bab ini
-- (雨／天気／空／山／川) plus 4 kombinasi (雨の日／山の上／川の水／
-- あおい空), gaya 105/106/107 — bukan konjugasi, karena kanji baru bab
-- ini semuanya kata benda ALAM/CUACA, sementara 6 pola grammar Bab 19
-- (〜たいです・〜たくないです・〜が欲しいです・〜つもりです・〜予定です・
-- 〜ましょう／ませんか) berlaku untuk sembarang kata kerja/kata benda,
-- tidak spesifik butuh kanji baru untuk diuji.
--
-- Whitelist kanji = whitelist 100/104/103/105/106/107/108 UNION 雨天空山川
-- (SAMA PERSIS dengan v_kanji_ok di 088_bunpou_bab19.sql).
--
-- PAGAR KATA KERJA: TIDAK RELEVAN (もんだい1/2 kosakata polos) — tidak ada
-- assertion kata kerja di file ini, konsisten sejak 100.
--
-- PAGAR PARTIKEL: sudah dihapus sejak 059, tidak ada di sini. (Partikel
-- が justru jadi topik utama もんだい1 文の文法1 pola 3 — lihat di
-- bawah.)
--
-- REF_CHECK bacaan (sumber kebenaran tunggal):
--   雨＝あめ   天気＝てんき   空＝そら   山＝やま   川＝かわ
--   雨の日＝あめのひ   山の上＝やまのうえ   川の水＝かわのみず
--   あおい空＝あおいそら
--
-- JEBAKAN PAGAR "RANTAI の": tiga soal (6/15, 7/16, 8/17) masing-masing
-- punya SATU の di dalam target <u> sendiri (雨の日／山の上／川の水) —
-- sudah dicek manual, TIDAK ada の lain di luar tag pada kalimat yang
-- sama, jadi total tetap satu の per kalimat, aman (lihat catatan varian
-- ke-4 di 108 soal kata berakhiran の — kata-kata ini TIDAK berakhiran
-- の sendiri, jadi tidak masuk kategori jebakan itu).
--
-- CATATAN PROSES (lanjutan dari 106/107/108): array dedup di bawah
-- di-grep ulang PENUH dari SEMUA migrasi assignment 039-108 yang
-- benar-benar ada di repo saat ini (287 target unik, sudah bersih dari
-- baris komentar palsu — lihat catatan di 106 soal placeholder tag di
-- komentar).
--
-- Komposisi: もんだい1 漢字読み 9 + もんだい2 表記 9 + もんだい3 文脈規定 12
-- + もんだい1 文の文法1 20 (4/3/3/3/3/4 per pola: 〜たいです／
-- 〜たくないです／〜が欲しいです／〜つもりです／〜予定です／
-- 〜ましょう・ませんか) = 50 soal, SEMUA ditampilkan tiap attempt, lulus
-- 70% (35/50), cooldown 12 jam.
--
-- Pola 1-2 (31-37) menguji konjugasi たい/たくない vs bentuk lain
-- (ます／ません／ました) dari verba yang sama. Pola 3 (38-40) menguji
-- partikel が (bukan を/に/で) untuk 〜が欲しいです, konsisten dengan
-- nuansa partikel が di Bab 17 (すき/じょうず/できます). Pola 4-5 (41-46)
-- menguji つもりです vs よていです secara cross-pattern (opsi salah juga
-- mencakup ましょう/ませんか untuk variasi), menegaskan bedanya di
-- catatan grammar 088 (niat pribadi vs jadwal ditetapkan). Pola 6
-- (47-50) menguji ませんか (mengajak) di 2 soal pertama dan ましょう
-- (menyetujui ajakan) di 2 soal berikutnya, opsi salah termasuk bentuk
-- たい/たくない sebagai distraktor tambahan.
--
-- もんだい3 文脈規定: Bab 19 BELUM punya bank kosakata resmi
-- (077_bab19_intro_kosakata_kanji.sql cuma seed kanji_items, TIDAK seed
-- module_vocabulary). 12 target di sini memakai kosakata umum N5 yang
-- tematik dengan Bab 19 (keinginan & rencana): りょこう／かいもの／
-- さんぽ／しごと／べんきょう／かいぎ／しゅみ／けいかく／よてい／
-- つもり／きぼう／ゆめ. SEMUA ditulis kana polos, tidak ada kanji di
-- section ini jadi tidak perlu pagar kanji khusus.
--
-- POSISI: sort_order 100 (akhir modul), sama seperti 039-108.
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
  v_bab_no       INT  := 19;
  v_title_re     TEXT := '(keinginan|rencana|cita)';
  v_lesson_slug  TEXT := 'assignment-bab-19-keinginan-rencana';
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
    RAISE NOTICE '109: modul Bab % di kursus % tidak ditemukan — skip seed assignment.', v_bab_no, v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* v_title_re THEN
    RAISE NOTICE '109: modul Bab % terbaca "%" — kalau ternyata bukan bab yang dimaksud, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).',
      v_bab_no, v_module_title;
  END IF;

  RAISE NOTICE '109: seed Assignment Bab % ke modul "%".', v_bab_no, v_module_title;

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, questions_per_attempt, cooldown_hours
  ) VALUES (
    v_module_id, v_lesson_slug, 'Assignment Bab 19: Keinginan & Rencana', 'quiz',
    'Tes materi Bab 19 (Keinginan & Rencana) gaya JLPT. Moji-Goi: cara baca dan menulis 5 kanji baru (雨・天気・空・山・川) sebagai kosakata alam/cuaca, serta kosakata rencana/keinginan (りょこう・しゅみ・けいかく・よてい・つもり dst). Tata Bahasa: 〜たいです／〜たくないです (ingin/tidak ingin melakukan), 〜が欲しいです (menginginkan benda, memakai partikel が), 〜つもりです (niat pribadi) vs 〜予定です (jadwal yang sudah ditetapkan), dan 〜ましょう／ませんか (ajakan). Semua 50 soal ditampilkan tiap attempt. Lulus 70% (35/50), cooldown 12 jam.',
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
    -- ===== もんだい1 漢字読み (1-9) — 5 kanji baru (雨/天/空/山/川) sebagai kosakata polos =====
    (1, 'vocabulary'::TEXT, 1, 'きょうは <u>雨</u>です。',
        '雨 dibaca あめ. Kanji baru Bab 19 untuk "hujan".'),
    (2, 'vocabulary', 1, '<u>天気</u>が いいです。',
        '天気 dibaca てんき. 天 kanji baru Bab 19 + 気 (sudah taught) membentuk kata "cuaca".'),
    (3, 'vocabulary', 1, '<u>空</u>が きれいです。',
        '空 dibaca そら. Kanji baru Bab 19 untuk "langit".'),
    (4, 'vocabulary', 1, '<u>山</u>に のぼります。',
        '山 dibaca やま. Kanji baru Bab 19 untuk "gunung".'),
    (5, 'vocabulary', 1, '<u>川</u>で およぎます。',
        '川 dibaca かわ. Kanji baru Bab 19 untuk "sungai".'),
    (6, 'vocabulary', 1, '<u>雨の日</u>は 出かけません。',
        '雨の日 dibaca あめのひ. 雨 (hujan) + の + 日 (hari, taught Bab 16) = "hari hujan".'),
    (7, 'vocabulary', 1, '<u>山の上</u>に ゆきが あります。',
        '山の上 dibaca やまのうえ. 山 (gunung) + の + 上 (atas, taught) = "puncak/atas gunung".'),
    (8, 'vocabulary', 1, '<u>川の水</u>は つめたいです。',
        '川の水 dibaca かわのみず. 川 (sungai) + の + 水 (air, taught Bab 16) = "air sungai".'),
    (9, 'vocabulary', 1, 'あおい <u>空</u>を 見ます。',
        '空 dibaca そら. あおい空 = "langit biru" (あおい ditulis kana, 青 belum diajarkan).'),

    -- ===== もんだい2 表記 (10-18) — target hiragana (mirror もんだい1), jawaban bentuk tulisan =====
    (10, 'vocabulary', 2, 'きょうは <u>あめ</u>です。',
        'あめ ditulis 雨. Salah: 天気 (てんき, cuaca), 空 (そら, langit), 山 (やま, gunung).'),
    (11, 'vocabulary', 2, '<u>てんき</u>が いいです。',
        'てんき ditulis 天気. Salah: 雨 (あめ, hujan), 空 (そら, langit), 川 (かわ, sungai).'),
    (12, 'vocabulary', 2, '<u>そら</u>が きれいです。',
        'そら ditulis 空. Salah: 雨 (あめ, hujan), 山 (やま, gunung), 川 (かわ, sungai).'),
    (13, 'vocabulary', 2, '<u>やま</u>に のぼります。',
        'やま ditulis 山. Salah: 雨 (あめ, hujan), 空 (そら, langit), 川 (かわ, sungai).'),
    (14, 'vocabulary', 2, '<u>かわ</u>で およぎます。',
        'かわ ditulis 川. Salah: 雨 (あめ, hujan), 天気 (てんき, cuaca), 山 (やま, gunung).'),
    (15, 'vocabulary', 2, '<u>あめのひ</u>は 出かけません。',
        'あめのひ ditulis 雨の日. Salah: 山の上 (やまのうえ, puncak gunung), 川の水 (かわのみず, air sungai), 空 (そら, langit).'),
    (16, 'vocabulary', 2, '<u>やまのうえ</u>に ゆきが あります。',
        'やまのうえ ditulis 山の上. Salah: 雨の日 (あめのひ, hari hujan), 川の水 (かわのみず, air sungai), 空 (そら, langit).'),
    (17, 'vocabulary', 2, '<u>かわのみず</u>は つめたいです。',
        'かわのみず ditulis 川の水. Salah: 雨の日 (あめのひ, hari hujan), 山の上 (やまのうえ, puncak gunung), 空 (そら, langit).'),
    (18, 'vocabulary', 2, 'あおい <u>そら</u>を 見ます。',
        'そら ditulis 空. あおいそら = "langit biru". Salah: 雨 (あめ, hujan), 山 (やま, gunung), 川 (かわ, sungai).'),

    -- ===== もんだい3 文脈規定 (19-30) — kosakata keinginan/rencana/hobi =====
    (19, 'vocabulary', 3, 'なつやすみに（　）を したいです。にほんへ 行きたいです。',
        'Jawabannya りょこう (jalan-jalan/travel). かいもの, さんぽ, しごと tidak cocok dengan "ingin pergi ke Jepang".'),
    (20, 'vocabulary', 3, 'デパートで（　）を したいです。あたらしい ふくが ほしいです。',
        'Jawabannya かいもの (belanja). りょこう, さんぽ, べんきょう tidak cocok dengan "ingin baju baru".'),
    (21, 'vocabulary', 3, 'まいあさ こうえんで（　）を します。',
        'Jawabannya さんぽ (jalan santai). りょこう, かいもの, しごと tidak cocok untuk kegiatan pagi di taman.'),
    (22, 'vocabulary', 3, 'あした（　）が あります。やすみたいです。',
        'Jawabannya しごと (pekerjaan). べんきょう, かいぎ, さんぽ kurang cocok dengan konteks ingin istirahat dari rutinitas.'),
    (23, 'vocabulary', 3, 'まいばん にほんごを（　）します。',
        'Jawabannya べんきょう (belajar). しごと, かいぎ, さんぽ tidak cocok dengan "bahasa Jepang".'),
    (24, 'vocabulary', 3, 'らいしゅう かいしゃで（　）が あります。',
        'Jawabannya かいぎ (rapat). しごと, べんきょう, よてい kurang tepat untuk acara spesifik di kantor.'),
    (25, 'vocabulary', 3, 'わたしの（　）は しゃしんを とることです。',
        'Jawabannya しゅみ (hobi). けいかく, よてい, つもり tidak cocok dengan "kegiatan kesukaan".'),
    (26, 'vocabulary', 3, 'らいねんの（　）を たてます。',
        'Jawabannya けいかく (rencana, "menyusun rencana"). しゅみ, よてい, つもり tidak cocok dengan kata kerja たてます.'),
    (27, 'vocabulary', 3, 'あしたの（　）は かいぎです。',
        'Jawabannya よてい (jadwal). けいかく, つもり, きぼう tidak cocok untuk menyebut agenda hari tertentu.'),
    (28, 'vocabulary', 3, 'にほんへ 行く（　）です。まだ きめていません。',
        'Jawabannya つもり (niat, belum diputuskan pasti). よてい, けいかく, きぼう kurang cocok dengan "belum diputuskan".'),
    (29, 'vocabulary', 3, 'せかいを りょこうする（　）が あります。',
        'Jawabannya きぼう (harapan). ゆめ, つもり, よてい kurang cocok dalam konteks ini.'),
    (30, 'vocabulary', 3, 'いつか せんせいに なりたいです。それが わたしの（　）です。',
        'Jawabannya ゆめ (cita-cita/impian). きぼう, つもり, よてい tidak sekuat ゆめ untuk cita-cita jangka panjang.'),

    -- ===== もんだい1 文の文法1 (31-50) — 6 pola grammar Bab 19 (4/3/3/3/3/4) =====
    -- Pola 1: 〜たいです (31-34)
    (31, 'grammar'::TEXT, 1, '日本へ（　）。「行きたいです。」',
        'Jawabannya 行きたいです — bentuk ます + たいです menyatakan keinginan melakukan sesuatu. 行きます, 行きません, 行きました tidak menyatakan keinginan.'),
    (32, 'grammar', 1, 'みずが（　）。「飲みたいです。」',
        'Jawabannya 飲みたいです — menyatakan keinginan minum. 飲みます, 飲みません, 飲みました tidak menyatakan keinginan.'),
    (33, 'grammar', 1, '山に（　）。「のぼりたいです。」',
        'Jawabannya のぼりたいです — menyatakan keinginan mendaki. のぼります, のぼりません, のぼりました tidak menyatakan keinginan.'),
    (34, 'grammar', 1, 'すしが（　）。「食べたいです。」',
        'Jawabannya 食べたいです — menyatakan keinginan makan. 食べます, 食べません, 食べました tidak menyatakan keinginan.'),

    -- Pola 2: 〜たくないです (35-37)
    (35, 'grammar', 1, 'きょうは どこへも（　）。「行きたくないです。」',
        'Jawabannya 行きたくないです — たい berkonjugasi seperti kata sifat い, negatifnya たくないです. 行きたいです, 行きません, 行きました tidak tepat.'),
    (36, 'grammar', 1, '雨の日は（　）。「出かけたくないです。」',
        'Jawabannya 出かけたくないです — tidak ingin keluar di hari hujan. 出かけたいです, 出かけません, 出かけました tidak tepat.'),
    (37, 'grammar', 1, 'まだ（　）。「かえりたくないです。」',
        'Jawabannya かえりたくないです — belum ingin pulang. かえりたいです, かえりません, かえりました tidak tepat.'),

    -- Pola 3: [noun]が欲しいです (38-40) — menguji partikel が
    (38, 'grammar', 1, 'あたらしい かばん（　）ほしいです。「が。」',
        'Jawabannya が — benda yang diinginkan ditandai が, bukan を, karena ほしい adalah kata sifat い. を, に, で tidak tepat.'),
    (39, 'grammar', 1, 'もっと じかん（　）ほしいです。「が。」',
        'Jawabannya が — konsisten dengan pola 〜が欲しいです. を, に, で tidak tepat.'),
    (40, 'grammar', 1, '大きい 車（　）ほしいです。「が。」',
        'Jawabannya が — konsisten dengan pola 〜が欲しいです. を, に, で tidak tepat.'),

    -- Pola 4: 〜つもりです (41-43)
    (41, 'grammar', 1, 'らいねん 日本へ 行く（　）。「つもりです。」',
        'Jawabannya つもりです — niat pribadi yang sudah dipikirkan matang. よていです (jadwal ditetapkan), ましょう, ませんか tidak tepat untuk niat pribadi.'),
    (42, 'grammar', 1, 'なつやすみは 山へ 行く（　）。「つもりです。」',
        'Jawabannya つもりです — konsisten dengan pola 〜つもりです. よていです, ましょう, ませんか tidak tepat.'),
    (43, 'grammar', 1, 'きょうは 出かけない（　）。「つもりです。」',
        'Jawabannya つもりです — bentuk ない + つもりです untuk niat negatif. よていです, ましょう, ませんか tidak tepat.'),

    -- Pola 5: 〜予定です (44-46)
    (44, 'grammar', 1, '三月に 国へ かえる（　）。「よていです。」',
        'Jawabannya よていです — jadwal yang sudah ditetapkan, bisa untuk orang lain. つもりです (niat pribadi), ましょう, ませんか tidak tepat.'),
    (45, 'grammar', 1, 'あした 先生と 会う（　）。「よていです。」',
        'Jawabannya よていです — konsisten dengan pola 〜予定です. つもりです, ましょう, ませんか tidak tepat.'),
    (46, 'grammar', 1, 'らいしゅう しけんの（　）。「よていです。」',
        'Jawabannya よていです — [kata benda]の + よていです. つもりです, ましょう, ませんか tidak tepat.'),

    -- Pola 6: 〜ましょう／ませんか (47-50)
    (47, 'grammar', 1, 'いっしょに 川へ（　）。「行きませんか。」',
        'Jawabannya 行きませんか — mengajak dengan halus, menanyakan kesediaan. 行きましょう (menyetujui, bukan mengajak awal), 行きたいです, 行きたくないです tidak tepat untuk mengajak.'),
    (48, 'grammar', 1, 'いっしょに 山に（　）。「のぼりませんか。」',
        'Jawabannya のぼりませんか — mengajak dengan halus. のぼりましょう, のぼりたいです, のぼりたくないです tidak tepat untuk mengajak.'),
    (49, 'grammar', 1, '「いっしょに 行きませんか。」「はい、（　）。」',
        'Jawabannya 行きましょう — menyetujui ajakan dengan tegas. 行きませんか (mengajak, bukan menyetujui), 行きたいです, 行きたくないです tidak tepat untuk menyetujui.'),
    (50, 'grammar', 1, '「いっしょに 食べませんか。」「はい、（　）。」',
        'Jawabannya 食べましょう — menyetujui ajakan dengan tegas. 食べませんか, 食べたいです, 食べたくないです tidak tepat untuk menyetujui.')
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
    (1, 0, 'あめ', TRUE), (1, 1, 'てんき', FALSE), (1, 2, 'そら', FALSE), (1, 3, 'やま', FALSE),
    (2, 0, 'てんき', TRUE), (2, 1, 'あめ', FALSE), (2, 2, 'そら', FALSE), (2, 3, 'かわ', FALSE),
    (3, 0, 'そら', TRUE), (3, 1, 'あめ', FALSE), (3, 2, 'やま', FALSE), (3, 3, 'かわ', FALSE),
    (4, 0, 'やま', TRUE), (4, 1, 'あめ', FALSE), (4, 2, 'そら', FALSE), (4, 3, 'かわ', FALSE),
    (5, 0, 'かわ', TRUE), (5, 1, 'あめ', FALSE), (5, 2, 'てんき', FALSE), (5, 3, 'やま', FALSE),
    (6, 0, 'あめのひ', TRUE), (6, 1, 'やまのうえ', FALSE), (6, 2, 'かわのみず', FALSE), (6, 3, 'そら', FALSE),
    (7, 0, 'やまのうえ', TRUE), (7, 1, 'あめのひ', FALSE), (7, 2, 'かわのみず', FALSE), (7, 3, 'そら', FALSE),
    (8, 0, 'かわのみず', TRUE), (8, 1, 'あめのひ', FALSE), (8, 2, 'やまのうえ', FALSE), (8, 3, 'そら', FALSE),
    (9, 0, 'そら', TRUE), (9, 1, 'あめ', FALSE), (9, 2, 'やま', FALSE), (9, 3, 'かわ', FALSE),

    -- 表記 — opsi kanji murni (target soal hiragana)
    (10, 0, '雨', TRUE), (10, 1, '天気', FALSE), (10, 2, '空', FALSE), (10, 3, '山', FALSE),
    (11, 0, '天気', TRUE), (11, 1, '雨', FALSE), (11, 2, '空', FALSE), (11, 3, '川', FALSE),
    (12, 0, '空', TRUE), (12, 1, '雨', FALSE), (12, 2, '山', FALSE), (12, 3, '川', FALSE),
    (13, 0, '山', TRUE), (13, 1, '雨', FALSE), (13, 2, '空', FALSE), (13, 3, '川', FALSE),
    (14, 0, '川', TRUE), (14, 1, '雨', FALSE), (14, 2, '天気', FALSE), (14, 3, '山', FALSE),
    (15, 0, '雨の日', TRUE), (15, 1, '山の上', FALSE), (15, 2, '川の水', FALSE), (15, 3, '空', FALSE),
    (16, 0, '山の上', TRUE), (16, 1, '雨の日', FALSE), (16, 2, '川の水', FALSE), (16, 3, '空', FALSE),
    (17, 0, '川の水', TRUE), (17, 1, '雨の日', FALSE), (17, 2, '山の上', FALSE), (17, 3, '空', FALSE),
    (18, 0, '空', TRUE), (18, 1, '雨', FALSE), (18, 2, '山', FALSE), (18, 3, '川', FALSE),

    -- 文脈規定
    (19, 0, 'りょこう', TRUE), (19, 1, 'かいもの', FALSE), (19, 2, 'さんぽ', FALSE), (19, 3, 'しごと', FALSE),
    (20, 0, 'かいもの', TRUE), (20, 1, 'りょこう', FALSE), (20, 2, 'さんぽ', FALSE), (20, 3, 'べんきょう', FALSE),
    (21, 0, 'さんぽ', TRUE), (21, 1, 'りょこう', FALSE), (21, 2, 'かいもの', FALSE), (21, 3, 'しごと', FALSE),
    (22, 0, 'しごと', TRUE), (22, 1, 'べんきょう', FALSE), (22, 2, 'かいぎ', FALSE), (22, 3, 'さんぽ', FALSE),
    (23, 0, 'べんきょう', TRUE), (23, 1, 'しごと', FALSE), (23, 2, 'かいぎ', FALSE), (23, 3, 'さんぽ', FALSE),
    (24, 0, 'かいぎ', TRUE), (24, 1, 'しごと', FALSE), (24, 2, 'べんきょう', FALSE), (24, 3, 'よてい', FALSE),
    (25, 0, 'しゅみ', TRUE), (25, 1, 'けいかく', FALSE), (25, 2, 'よてい', FALSE), (25, 3, 'つもり', FALSE),
    (26, 0, 'けいかく', TRUE), (26, 1, 'しゅみ', FALSE), (26, 2, 'よてい', FALSE), (26, 3, 'つもり', FALSE),
    (27, 0, 'よてい', TRUE), (27, 1, 'けいかく', FALSE), (27, 2, 'つもり', FALSE), (27, 3, 'きぼう', FALSE),
    (28, 0, 'つもり', TRUE), (28, 1, 'よてい', FALSE), (28, 2, 'けいかく', FALSE), (28, 3, 'きぼう', FALSE),
    (29, 0, 'きぼう', TRUE), (29, 1, 'ゆめ', FALSE), (29, 2, 'つもり', FALSE), (29, 3, 'よてい', FALSE),
    (30, 0, 'ゆめ', TRUE), (30, 1, 'きぼう', FALSE), (30, 2, 'つもり', FALSE), (30, 3, 'よてい', FALSE),

    -- 文の文法1 — 〜たいです
    (31, 0, '行きたいです', TRUE), (31, 1, '行きます', FALSE), (31, 2, '行きません', FALSE), (31, 3, '行きました', FALSE),
    (32, 0, '飲みたいです', TRUE), (32, 1, '飲みます', FALSE), (32, 2, '飲みません', FALSE), (32, 3, '飲みました', FALSE),
    (33, 0, 'のぼりたいです', TRUE), (33, 1, 'のぼります', FALSE), (33, 2, 'のぼりません', FALSE), (33, 3, 'のぼりました', FALSE),
    (34, 0, '食べたいです', TRUE), (34, 1, '食べます', FALSE), (34, 2, '食べません', FALSE), (34, 3, '食べました', FALSE),

    -- 〜たくないです
    (35, 0, '行きたくないです', TRUE), (35, 1, '行きたいです', FALSE), (35, 2, '行きません', FALSE), (35, 3, '行きました', FALSE),
    (36, 0, '出かけたくないです', TRUE), (36, 1, '出かけたいです', FALSE), (36, 2, '出かけません', FALSE), (36, 3, '出かけました', FALSE),
    (37, 0, 'かえりたくないです', TRUE), (37, 1, 'かえりたいです', FALSE), (37, 2, 'かえりません', FALSE), (37, 3, 'かえりました', FALSE),

    -- [noun]が欲しいです
    (38, 0, 'が', TRUE), (38, 1, 'を', FALSE), (38, 2, 'に', FALSE), (38, 3, 'で', FALSE),
    (39, 0, 'が', TRUE), (39, 1, 'を', FALSE), (39, 2, 'に', FALSE), (39, 3, 'で', FALSE),
    (40, 0, 'が', TRUE), (40, 1, 'を', FALSE), (40, 2, 'に', FALSE), (40, 3, 'で', FALSE),

    -- 〜つもりです
    (41, 0, 'つもりです', TRUE), (41, 1, 'よていです', FALSE), (41, 2, 'ましょう', FALSE), (41, 3, 'ませんか', FALSE),
    (42, 0, 'つもりです', TRUE), (42, 1, 'よていです', FALSE), (42, 2, 'ましょう', FALSE), (42, 3, 'ませんか', FALSE),
    (43, 0, 'つもりです', TRUE), (43, 1, 'よていです', FALSE), (43, 2, 'ましょう', FALSE), (43, 3, 'ませんか', FALSE),

    -- 〜予定です
    (44, 0, 'よていです', TRUE), (44, 1, 'つもりです', FALSE), (44, 2, 'ましょう', FALSE), (44, 3, 'ませんか', FALSE),
    (45, 0, 'よていです', TRUE), (45, 1, 'つもりです', FALSE), (45, 2, 'ましょう', FALSE), (45, 3, 'ませんか', FALSE),
    (46, 0, 'よていです', TRUE), (46, 1, 'つもりです', FALSE), (46, 2, 'ましょう', FALSE), (46, 3, 'ませんか', FALSE),

    -- 〜ましょう／ませんか
    (47, 0, '行きませんか', TRUE), (47, 1, '行きましょう', FALSE), (47, 2, '行きたいです', FALSE), (47, 3, '行きたくないです', FALSE),
    (48, 0, 'のぼりませんか', TRUE), (48, 1, 'のぼりましょう', FALSE), (48, 2, 'のぼりたいです', FALSE), (48, 3, 'のぼりたくないです', FALSE),
    (49, 0, '行きましょう', TRUE), (49, 1, '行きませんか', FALSE), (49, 2, '行きたいです', FALSE), (49, 3, '行きたくないです', FALSE),
    (50, 0, '食べましょう', TRUE), (50, 1, '食べませんか', FALSE), (50, 2, '食べたいです', FALSE), (50, 3, '食べたくないです', FALSE)
  )
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT qq.id, o.option_text, o.ok, o.ord
    FROM o
    JOIN quiz_questions qq
      ON qq.lesson_id = v_lesson_id AND qq.sort_order = o.qno;

  -- ===== Assertion bentuk =====
  IF (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id) <> 50 THEN
    RAISE EXCEPTION '109: jumlah soal bukan 50 (dapat %)',
      (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
      LEFT JOIN quiz_options qo ON qo.question_id = qq.id
     WHERE qq.lesson_id = v_lesson_id
     GROUP BY qq.id
    HAVING COUNT(qo.id) <> 4 OR COUNT(*) FILTER (WHERE qo.is_correct) <> 1
  ) THEN
    RAISE EXCEPTION '109: ada soal yang opsinya bukan 4 atau kuncinya bukan tepat 1';
  END IF;

  -- ===== Pagar level =====

  -- 1. Badan kalimat (di LUAR target <u>…</u>) hanya boleh memakai kanji
  --    taught: 62 kanji Bab 3-9 + 見読書 (Bab 10) + 週毎 (Bab 11) + 食飲
  --    (Bab 12) + 立休入出 (Bab 14) + 言話聞買店会社 (Bab 15) +
  --    日火水木金土 (Bab 16) + 子父母友手足口目耳 (Bab 17) + 大小多少
  --    (Bab 18) + 雨天空山川 (Bab 19) — SAMA PERSIS dengan v_kanji_ok di
  --    088_bunpou_bab19.sql. もんだい3 tidak memakai <u>, jadi SELURUH
  --    kolom question-nya kena pagar ini juga.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND regexp_replace(
             regexp_replace(question, '<u>[^<]*</u>', '', 'g'),
             '[先何語校国生学名人魚本花八三十九一五四二六七安高古新白長男女気下前外間右中左後上時分円百千万年月半歳午車東道駅行西電北南見読書週毎食飲立休入出言話聞買店会社日火水木金土子父母友手足口目耳大小多少雨天空山川]', '', 'g'
           ) ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '109: ada kanji di luar daftar taught pada badan kalimat soal';
  END IF;

  -- 2. Partikel: TIDAK ADA ASSERTION UMUM (dihapus sejak 059) — partikel
  --    が justru topik utama もんだい1 文の文法1, diuji manual di atas.
  -- 3. Kata kerja: TIDAK ADA ASSERTION (もんだい1/2 kosakata polos, bukan
  --    konjugasi — tidak relevan sejak 100).

  -- 4. Rantai の dalam satu kalimat.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '109: ada kalimat dengan rantai の (lebih dari satu の dalam satu kalimat)';
  END IF;

  -- 5. Target section: もんだい1 wajib kanji di dalam <u>, もんだい2 wajib kana.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 1
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '') !~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '109: ada soal 漢字読み yang target <u> nya tidak mengandung kanji';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 2
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '一') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '109: ada soal 表記 yang target <u> nya sudah berupa kanji';
  END IF;

  -- 6. DEDUP WAJIB — target <u> tidak boleh sama dengan salah satu dari
  --    287 target unik yang sudah dipakai di 039-108 (di-grep ulang penuh
  --    dari file migrasi sungguhan, dibersihkan dari baris komentar
  --    palsu — lihat catatan header di atas).
  IF EXISTS (
    SELECT 1 FROM quiz_questions qq,
      LATERAL (SELECT (regexp_match(qq.question, '<u>([^<]*)</u>'))[1] AS tgt) t
     WHERE qq.lesson_id = v_lesson_id
       AND t.tgt = ANY (ARRAY[
         'あいます','あし','いいます','いきました','いちばんおおきい','いちばん大きい','いって','いんど','えきでまっています',
         'えきまえ','おおい','おおかった','おおきい','おおきかった','おみせ','お店','かいしゃ','かいて','かいます',
         'かきます','かようび','がいこく','がくせい','がっこう','ききます','きゅうにん','きゅうひゃくえん','きんようび',
         'くじかん','くち','くに','くるまをつかってもいいですか','くるまをもっています','げつようび','こくどう','こども','ごご',
         'ごじ','ごじゅうにん','ごせんえん','ごぜん','ごぜんちゅう','ごにん','ごねんせい','ごひゃくえん','ごほん','さかな',
         'さゆう','さんにん','さんねんせい','しゃどう','じかん','じゅうごふん','じゅうにじ','じゅうにん','じゅっぽん',
         'じょうげ','すいようび','すくない','すくなかった','せんえん','せんげつ','せんせい','せんにん','ぜんご','たい',
         'たたない','たつ','たべて','たべもの','ちいさい','ちいさかった','ちち','ちゅうかん','ちゅうがくせい','ちゅうねん',
         'て','でた','でない','でる','でんしゃにのっています','でんしゃにのってください','でんわ','とうざい','ともだち',
         'どようび','ななひゃくえん','なに','なんがつなんにち','なんじ','なんせい','なんとう','なんねん','なんぼく',
         'にじゅうにん','にせんえん','にちようび','にねんせい','にひゃくえん','にほん','のみました','のんで','はいらない',
         'はいる','はちじ','はちにん','はな','はながさいています','はなします','はなをとってはいけません','はは','はん',
         'はんとし','はんぶん','ひと','ひゃくにん','べとなむ','ほくせい','ほくとう','ほん','まいにち','まんえん',
         'みせのひと','みちをあるいています','みちをあるいてください','みて','みました','みみ','め','もくようび','やすまない',
         'やすむ','よにん','よねんせい','よみました','よんじゅうにん','よんで','よんほん','ろくがつみっか','ろくにん','一人',
         '一分','一年','一時','一本','七人','七分','三十人','三十分','三時','三本','三百円','上','下','中',
         '中国','九時','二人','二十歳','二時','二百人','人','人気','人間','休まない','休む','会います','会社',
         '何人','何年生','何月何日','何本','先生','先週','入らない','入る','八時半','八百円','六分','六年生','六時',
         '六月三日','六本','六百円','出た','出ない','出る','前','北','十分','十時','南','友だち','口','古い',
         '右','名前','四時','国','土ようび','外','多い','多かった','大きい','大きかった','大学','大学生','女',
         '女の人','子ども','学校','学生','安い','小さい','小さかった','少ない','少なかった','左','店の人','後ろ','手',
         '新しい','日ようび','日本','日本人','日本語','書いて','書きました','月ようび','木ようび','本','東','母',
         '毎月','毎週','気分','水ようび','火ようび','父','男','男の人','男女','留学生','白い','目','立たない',
         '立つ','耳','聞きます','花','花がさいています','花をとってはいけません','行','行って','西','見て','見てから',
         '見ません','言います','話します','読みます','読んで','買います','足','車','車をつかってもいいですか',
         '車をもっています','道','道をあるいています','道をあるいてください','金ようび','長い','電話','電車','電車にのっています',
         '電車にのってください','韓国人','食べて','食べてから','飲んで','飲んでから','駅','駅でまっています','高い','高校',
         '高校生','魚'
       ])
  ) THEN
    RAISE EXCEPTION '109: ada target <u> yang sudah pernah diujikan di migration 039-108';
  END IF;

  RAISE NOTICE '109: selesai — 50 soal (vocabulary 30, grammar 20), semua pagar level + dedup lolos.';
END $$;
