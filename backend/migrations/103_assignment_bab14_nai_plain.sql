-- 103_assignment_bab14_nai_plain.sql — Assignment Bab 14: Bentuk Nai &
-- Bentuk Plain.
--
-- Ujian bab untuk Bab 14, melanjutkan pola assignment Bab 1-13
-- (039/040/041/045/047/051/053/055/057/059/061/100/102). Modul di-resolve
-- ordinal (OFFSET 13, lanjutan pola 039-102).
--
-- JUDUL pakai TITIK DUA sejak awal (konvensi migration 079).
--
-- Kebijakan 50/50 (Bab 8+, berlaku sejak 055): questions_per_attempt = 50,
-- SEMUA soal ditampilkan tiap attempt (bukan sampling 30).
--
-- KANJI: Bab 14 memperkenalkan 4 kanji BARU — 立(たつ)・休(やすむ)・
-- 入(はいる)・出(でる) — dikonfirmasi dari whitelist 083_bunpou_bab14.sql.
-- Untuk PERTAMA KALINYA sejak Bab 12, もんだい1/2 bisa diisi 100% kanji
-- BARU bab ini sendiri (bukan review kanji lama seperti 061/102), digabung
-- dengan 3 bentuk konjugasi yang JUGA baru di Bab 14: nai-form, bentuk
-- kamus, dan bentuk ta plain. Whitelist badan kalimat = whitelist 100/102
-- (62 kanji Bab3-9 + 見読書 Bab10 + 週毎 Bab11 + 食飲 Bab12) UNION 立休入出.
--
-- PAGAR KATA KERJA: TETAP DIHAPUS, melanjutkan keputusan 100/102. Bab 14
-- adalah bab konjugasi plain (ない/kamus/た/なかった) — regex lama yang
-- melarang ます/ました/いる dst akan melarang materi inti bab ini (bentuk
-- kamus & ta secara definisi TIDAK berakhiran ます).
--
-- PAGAR PARTIKEL: sudah dihapus sejak 059, tidak ada di sini.
--
-- REF_CHECK bacaan (sumber kebenaran tunggal):
--   立たない＝たたない   休まない＝やすまない   入らない＝はいらない
--   出ない＝でない       立つ＝たつ             休む＝やすむ
--   入る＝はいる         出る＝でる             出た＝でた
--
-- JEBAKAN PAGAR "RANTAI の": tidak ada kata/kalimat ber-の ganda di file
-- ini (partikel の nyaris tidak dipakai sama sekali) — dicek manual +
-- otomatis sebelum commit, lihat catatan di migration 100.
--
-- MONDAI-1/2 SCOPE: target sengaja dibatasi ke nai-form/kamus/ta-form
-- (bukan ないでください／なければなりません／なくてもいいです yang juga
-- pola Bab 14) — tiga bentuk konjugasi INTI yang menentukan bacaan kanji,
-- sementara tiga pola fungsi-kalimat lainnya diuji di もんだい1 文の文法1.
--
-- DEDUP WAJIB (pola established sejak 047): 18 target <u> baru di file ini
-- (もんだい1/2, 9 pasang mirror kanji↔kana) dicek terhadap 195 target unik
-- yang sudah dipakai di 042-102 (159 dari 042-061 + 18 dari 100 + 18 dari
-- 102, di-grep ulang dari file migrasi sungguhan). Kanji 立休入出 belum
-- pernah dipakai jadi target di migrasi manapun sebelumnya, jadi tabrakan
-- tidak diharapkan.
--
-- Komposisi: もんだい1 漢字読み 9 + もんだい2 表記 9 + もんだい3 文脈規定 12
-- + もんだい1 文の文法1 20 (3/3/3/3/3/3/2 per pola: nai-form／ないでください／
-- なければなりません／なくてもいいです／kamus／ta／nakatta) = 50 soal,
-- SEMUA ditampilkan tiap attempt, lulus 70% (35/50), cooldown 12 jam.
--
-- POSISI: sort_order 100 (akhir modul), sama seperti 039-102.
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
  v_bab_no       INT  := 14;
  v_title_re     TEXT := '(bentuk|verb|kewajiban)';
  v_lesson_slug  TEXT := 'assignment-bab-14-nai-bentuk-plain';
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
    RAISE NOTICE '103: modul Bab % di kursus % tidak ditemukan — skip seed assignment.', v_bab_no, v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* v_title_re THEN
    RAISE NOTICE '103: modul Bab % terbaca "%" — kalau ternyata bukan bab yang dimaksud, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).',
      v_bab_no, v_module_title;
  END IF;

  RAISE NOTICE '103: seed Assignment Bab % ke modul "%".', v_bab_no, v_module_title;

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, questions_per_attempt, cooldown_hours
  ) VALUES (
    v_module_id, v_lesson_slug, 'Assignment Bab 14: Bentuk Nai & Bentuk Plain', 'quiz',
    'Tes materi Bab 14 (Bentuk Nai & Bentuk Plain) gaya JLPT. Moji-Goi: cara baca dan menulis 4 kanji baru (立つ・休む・入る・出る) dalam bentuk nai/kamus/ta, serta kosakata fungsional kewajiban/peraturan (きそく・きまり・ひつよう・だいじ・あぶない・がまん・かならず・めんきょ・だめ) dan tempat (出口・入口・休み). Tata Bahasa: konjugasi nai-form, 〜ないでください (larangan halus), 〜なければなりません (kewajiban), 〜なくてもいいです (tidak wajib), bentuk kamus, bentuk lampau plain 〜た, dan lampau negatif plain 〜なかった. Semua 50 soal ditampilkan tiap attempt. Lulus 70% (35/50), cooldown 12 jam.',
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
    -- ===== もんだい1 漢字読み (1-9) — 4 kanji baru (立/休/入/出) x nai/kamus/ta =====
    (1, 'vocabulary'::TEXT, 1, 'あめの ひは そとへ <u>出ない</u>。',
        '出ない dibaca でない. 出る kata kerja Golongan 2, bentuk nai cukup buang る tambah ない.'),
    (2, 'vocabulary', 1, 'げんきですから、しごとを <u>休まない</u>。',
        '休まない dibaca やすまない. 休む berakhiran む, bentuk nai Golongan 1 untuk む adalah berubah jadi まない.'),
    (3, 'vocabulary', 1, 'でんしゃの なかで <u>立たない</u>で、すわります。',
        '立たない dibaca たたない. 立つ berakhiran つ, bentuk nai Golongan 1 untuk つ adalah berubah jadi たない.'),
    (4, 'vocabulary', 1, 'かぎが ないから、いえに <u>入らない</u>。',
        '入らない dibaca はいらない. 入る berakhiran る tapi Golongan 1 (kekecualian), bentuk nai-nya はいらない, bukan はいない.'),
    (5, 'vocabulary', 1, 'まいあさ いえを <u>出る</u>まえに、かおを あらいます。',
        '出る dibaca でる. Bentuk kamus 出る dipakai sebelum まえに untuk menyatakan urutan waktu.'),
    (6, 'vocabulary', 1, 'にちようびに かならず <u>休む</u>。',
        '休む dibaca やすむ. Bentuk kamus, bentuk dasar yang tertulis di kamus.'),
    (7, 'vocabulary', 1, 'でんしゃの なかで <u>立つ</u>ひとが おおいです。',
        '立つ dibaca たつ. Bentuk kamus 立つ dipakai untuk menerangkan kata benda ひと (orang yang berdiri).'),
    (8, 'vocabulary', 1, 'きょうしつに <u>入る</u>まえに、名前を 書きます。',
        '入る dibaca はいる. Bentuk kamus 入る dipakai sebelum まえに untuk menyatakan urutan waktu.'),
    (9, 'vocabulary', 1, 'きのう はやく いえを <u>出た</u>。',
        '出た dibaca でた. Bentuk lampau plain, dibentuk dari bentuk te (出て) diganti て→た.'),

    -- ===== もんだい2 表記 (10-18) — target hiragana (mirror もんだい1), jawaban bentuk tulisan =====
    (10, 'vocabulary', 2, 'あめの ひは そとへ <u>でない</u>。',
        'でない ditulis 出ない. Salah: 休まない (やすまない, tidak libur), 立たない (たたない, tidak berdiri), 入らない (はいらない, tidak masuk).'),
    (11, 'vocabulary', 2, 'げんきですから、しごとを <u>やすまない</u>。',
        'やすまない ditulis 休まない. Salah: 出ない (でない, tidak keluar), 立たない (たたない, tidak berdiri), 入らない (はいらない, tidak masuk).'),
    (12, 'vocabulary', 2, 'でんしゃの なかで <u>たたない</u>で、すわります。',
        'たたない ditulis 立たない. Salah: 出ない (でない, tidak keluar), 休まない (やすまない, tidak libur), 入らない (はいらない, tidak masuk).'),
    (13, 'vocabulary', 2, 'かぎが ないから、いえに <u>はいらない</u>。',
        'はいらない ditulis 入らない. Salah: 出ない (でない, tidak keluar), 休まない (やすまない, tidak libur), 立たない (たたない, tidak berdiri).'),
    (14, 'vocabulary', 2, 'まいあさ いえを <u>でる</u>まえに、かおを あらいます。',
        'でる ditulis 出る. Salah: 休む (やすむ, libur), 立つ (たつ, berdiri), 入る (はいる, masuk).'),
    (15, 'vocabulary', 2, 'にちようびに かならず <u>やすむ</u>。',
        'やすむ ditulis 休む. Salah: 出る (でる, keluar), 立つ (たつ, berdiri), 入る (はいる, masuk).'),
    (16, 'vocabulary', 2, 'でんしゃの なかで <u>たつ</u>ひとが おおいです。',
        'たつ ditulis 立つ. Salah: 出る (でる, keluar), 休む (やすむ, libur), 入る (はいる, masuk).'),
    (17, 'vocabulary', 2, 'きょうしつに <u>はいる</u>まえに、名前を 書きます。',
        'はいる ditulis 入る. Salah: 出る (でる, keluar), 休む (やすむ, libur), 立つ (たつ, berdiri).'),
    (18, 'vocabulary', 2, 'きのう はやく いえを <u>でた</u>。',
        'でた ditulis 出た. Salah: 休んだ (やすんだ, sudah libur), 立った (たった, sudah berdiri), 入った (はいった, sudah masuk).'),

    -- ===== もんだい3 文脈規定 (19-30) — kosakata kewajiban/peraturan + tempat =====
    (19, 'vocabulary', 3, 'でんしゃの（　）から 出ます。',
        'Jawabannya 出口 (でぐち, pintu keluar). 入口, 休み, きそく tidak berkaitan dengan keluar dari kereta.'),
    (20, 'vocabulary', 3, 'びじゅつかんの（　）で きっぷを かいます。',
        'Jawabannya 入口 (いりぐち, pintu masuk), tempat membeli tiket sebelum masuk. 出口, 休み, きそく tidak berkaitan dengan pintu masuk.'),
    (21, 'vocabulary', 3, '学校は にちようびが（　）です。',
        'Jawabannya 休み (やすみ, libur). 出口, 入口, きそく tidak berkaitan dengan hari libur.'),
    (22, 'vocabulary', 3, 'がっこうには（　）が あります。ちこくしては いけません。',
        'Jawabannya きそく (peraturan). ひつよう, がまん, だめ tidak cocok sebagai kata benda "peraturan sekolah".'),
    (23, 'vocabulary', 3, 'パスポートは りょこうに（　）です。',
        'Jawabannya ひつよう (perlu/dibutuhkan). きそく, がまん, だいじ tidak cocok untuk menyatakan sesuatu dibutuhkan.'),
    (24, 'vocabulary', 3, 'この しゃしんは わたしに とても（　）です。なくしたら たいへんです。',
        'Jawabannya だいじ (penting). ひつよう, きそく, あぶない tidak cocok untuk menyatakan sesuatu berharga/penting.'),
    (25, 'vocabulary', 3, 'くるまが おおいですから、ここは（　）です。',
        'Jawabannya あぶない (berbahaya). だいじ, ひつよう, きそく tidak cocok untuk menyatakan bahaya.'),
    (26, 'vocabulary', 3, 'いたくても（　）してください。',
        'Jawabannya がまん (menahan diri/bersabar). ひつよう, だいじ, きそく tidak cocok untuk menyatakan menahan sakit.'),
    (27, 'vocabulary', 3, 'あしたは しけんですから、（　）べんきょうしてください。',
        'Jawabannya かならず (pasti/wajib). たまに, ときどき, あまり tidak menekankan kewajiban seperti かならず.'),
    (28, 'vocabulary', 3, 'うんてんするには（　）が いります。',
        'Jawabannya めんきょ (SIM/lisensi), yang diperlukan untuk menyetir. きそく, ひつよう, がまん tidak cocok sebagai kata benda yang "diperlukan" untuk menyetir.'),
    (29, 'vocabulary', 3, 'としょかんでは（　）を まもってください。しずかに してください。',
        'Jawabannya きまり (aturan/ketentuan). ひつよう, だいじ, がまん tidak cocok sebagai kata benda "aturan" yang dipatuhi.'),
    (30, 'vocabulary', 3, '学校に ちこくしては（　）です。',
        'Jawabannya だめ (tidak boleh). だいじ, ひつよう, あぶない tidak menyatakan larangan.'),

    -- ===== もんだい1 文の文法1 (31-50) — 7 pola grammar Bab 14 (3/3/3/3/3/3/2) =====
    -- Pola 1: Nai-form konjugasi (31-33)
    (31, 'grammar'::TEXT, 1, 'あめですから、そとへ（　）。「出ない。」',
        'Jawabannya 出ない — 出る kata kerja Golongan 2, bentuk nai cukup buang る tambah ない. 出る, 出た, 出ます tidak menyatakan bentuk negatif plain.'),
    (32, 'grammar', 1, 'きょうは しごとを（　）。「休まない。」',
        'Jawabannya 休まない — 休む berakhiran む, bentuk nai Golongan 1 untuk む adalah まない. 休む, 休んだ, 休みます tidak menyatakan bentuk negatif plain.'),
    (33, 'grammar', 1, 'あぶないですから、そこに（　）。「立たない。」',
        'Jawabannya 立たない — 立つ berakhiran つ, bentuk nai Golongan 1 untuk つ adalah たない. 立つ, 立った, 立ちます tidak menyatakan bentuk negatif plain.'),

    -- Pola 2: 〜ないでください (34-36)
    (34, 'grammar', 1, 'ここに（　）。「入らないでください。」',
        'Jawabannya 入らないでください — bentuk ない (tanpa い) + でください adalah larangan sopan. 入ってください, 入っています, 入りました tidak menyatakan larangan.'),
    (35, 'grammar', 1, 'じゅぎょうちゅうに（　）。「立たないでください。」',
        'Jawabannya 立たないでください — larangan sopan memakai bentuk ない + でください. 立ってください, 立っています, 立ちました tidak menyatakan larangan.'),
    (36, 'grammar', 1, 'あぶないですから、そこから（　）。「出ないでください。」',
        'Jawabannya 出ないでください — larangan sopan memakai bentuk ない + でください. 出てください, 出ています, 出ました tidak menyatakan larangan.'),

    -- Pola 3: 〜なければなりません (37-39)
    (37, 'grammar', 1, 'あした しけんが ありますから、（　）。「べんきょうしなければなりません。」',
        'Jawabannya べんきょうしなければなりません — bentuk ない → buang い, tambah ければなりません, menyatakan kewajiban. べんきょうしてください, べんきょうしています, べんきょうしました tidak menyatakan kewajiban.'),
    (38, 'grammar', 1, 'きそくですから、名前を（　）。「書かなければなりません。」',
        'Jawabannya 書かなければなりません — menyatakan kewajiban karena aturan. 書いてください, 書いています, 書きました tidak menyatakan kewajiban.'),
    (39, 'grammar', 1, 'でんしゃに（　）。「のらなければなりません。」',
        'Jawabannya のらなければなりません — menyatakan kewajiban. のってください, のっています, のりました tidak menyatakan kewajiban.'),

    -- Pola 4: 〜なくてもいいです (40-42)
    (40, 'grammar', 1, 'きょうは（　）。「休まなくてもいいです。」',
        'Jawabannya 休まなくてもいいです — bentuk ない → buang い, tambah くてもいいです, menyatakan tidak wajib. 休んでください, 休んでいます, 休みました tidak menyatakan sesuatu tidak wajib.'),
    (41, 'grammar', 1, 'あしたは やすみですから、はやく（　）。「おきなくてもいいです。」',
        'Jawabannya おきなくてもいいです — menyatakan sesuatu tidak wajib dilakukan. おきてください, おきています, おきました tidak menyatakan sesuatu tidak wajib.'),
    (42, 'grammar', 1, 'この しごとは ひとりで（　）。「しなくてもいいです。」',
        'Jawabannya しなくてもいいです — menyatakan sesuatu tidak wajib dilakukan sendirian. してください, しています, しました tidak menyatakan sesuatu tidak wajib.'),

    -- Pola 5: Bentuk kamus (43-45)
    (43, 'grammar', 1, 'でんしゃが（　）まえに、駅に 行きます。「出る」',
        'Jawabannya 出る — bentuk kamus dipakai sebelum まえに untuk menyatakan urutan waktu. 出た, 出ない, 出ます tidak dipakai dalam pola 〜まえに.'),
    (44, 'grammar', 1, '学校に（　）まえに、名前を 書きます。「入る」',
        'Jawabannya 入る — bentuk kamus dipakai sebelum まえに. 入った, 入らない, 入ります tidak dipakai dalam pola 〜まえに.'),
    (45, 'grammar', 1, 'しごとを（　）まえに、れんらくしてください。「休む」',
        'Jawabannya 休む — bentuk kamus dipakai sebelum まえに. 休んだ, 休まない, 休みます tidak dipakai dalam pola 〜まえに.'),

    -- Pola 6: Bentuk lampau plain た (46-48)
    (46, 'grammar', 1, 'きのう はやく いえを（　）。「出た。」',
        'Jawabannya 出た — bentuk lampau plain, dibentuk seperti bentuk te (出て) diganti て→た. 出る, 出ない, 出ました tidak menyatakan bentuk lampau plain.'),
    (47, 'grammar', 1, 'せんしゅう しごとを（　）。「休んだ。」',
        'Jawabannya 休んだ — bentuk lampau plain dari 休む (休んで→休んだ). 休む, 休まない, 休みました tidak menyatakan bentuk lampau plain.'),
    (48, 'grammar', 1, 'でんしゃの なかで（　）。「立った。」',
        'Jawabannya 立った — bentuk lampau plain dari 立つ (立って→立った). 立つ, 立たない, 立ちました tidak menyatakan bentuk lampau plain.'),

    -- Pola 7: Lampau negatif plain なかった (49-50)
    (49, 'grammar', 1, 'きのう どこへも（　）。「出なかった。」',
        'Jawabannya 出なかった — dari bentuk ない: buang い, tambah かった. 出た, 出る, 出ません tidak menyatakan lampau negatif plain.'),
    (50, 'grammar', 1, 'せんしゅう ぜんぜん（　）。「休まなかった。」',
        'Jawabannya 休まなかった — dari bentuk ない: buang い, tambah かった. 休んだ, 休む, 休みません tidak menyatakan lampau negatif plain.')
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
    (1, 0, 'でない', TRUE), (1, 1, 'やすまない', FALSE), (1, 2, 'たたない', FALSE), (1, 3, 'はいらない', FALSE),
    (2, 0, 'やすまない', TRUE), (2, 1, 'でない', FALSE), (2, 2, 'たたない', FALSE), (2, 3, 'はいらない', FALSE),
    (3, 0, 'たたない', TRUE), (3, 1, 'でない', FALSE), (3, 2, 'やすまない', FALSE), (3, 3, 'はいらない', FALSE),
    (4, 0, 'はいらない', TRUE), (4, 1, 'でない', FALSE), (4, 2, 'やすまない', FALSE), (4, 3, 'たたない', FALSE),
    (5, 0, 'でる', TRUE), (5, 1, 'やすむ', FALSE), (5, 2, 'たつ', FALSE), (5, 3, 'はいる', FALSE),
    (6, 0, 'やすむ', TRUE), (6, 1, 'でる', FALSE), (6, 2, 'たつ', FALSE), (6, 3, 'はいる', FALSE),
    (7, 0, 'たつ', TRUE), (7, 1, 'でる', FALSE), (7, 2, 'やすむ', FALSE), (7, 3, 'はいる', FALSE),
    (8, 0, 'はいる', TRUE), (8, 1, 'でる', FALSE), (8, 2, 'やすむ', FALSE), (8, 3, 'たつ', FALSE),
    (9, 0, 'でた', TRUE), (9, 1, 'やすんだ', FALSE), (9, 2, 'たった', FALSE), (9, 3, 'はいった', FALSE),

    -- 表記 — opsi bentuk tulisan
    (10, 0, '出ない', TRUE), (10, 1, '休まない', FALSE), (10, 2, '立たない', FALSE), (10, 3, '入らない', FALSE),
    (11, 0, '休まない', TRUE), (11, 1, '出ない', FALSE), (11, 2, '立たない', FALSE), (11, 3, '入らない', FALSE),
    (12, 0, '立たない', TRUE), (12, 1, '出ない', FALSE), (12, 2, '休まない', FALSE), (12, 3, '入らない', FALSE),
    (13, 0, '入らない', TRUE), (13, 1, '出ない', FALSE), (13, 2, '休まない', FALSE), (13, 3, '立たない', FALSE),
    (14, 0, '出る', TRUE), (14, 1, '休む', FALSE), (14, 2, '立つ', FALSE), (14, 3, '入る', FALSE),
    (15, 0, '休む', TRUE), (15, 1, '出る', FALSE), (15, 2, '立つ', FALSE), (15, 3, '入る', FALSE),
    (16, 0, '立つ', TRUE), (16, 1, '出る', FALSE), (16, 2, '休む', FALSE), (16, 3, '入る', FALSE),
    (17, 0, '入る', TRUE), (17, 1, '出る', FALSE), (17, 2, '休む', FALSE), (17, 3, '立つ', FALSE),
    (18, 0, '出た', TRUE), (18, 1, '休んだ', FALSE), (18, 2, '立った', FALSE), (18, 3, '入った', FALSE),

    -- 文脈規定
    (19, 0, '出口', TRUE), (19, 1, '入口', FALSE), (19, 2, '休み', FALSE), (19, 3, 'きそく', FALSE),
    (20, 0, '入口', TRUE), (20, 1, '出口', FALSE), (20, 2, '休み', FALSE), (20, 3, 'きそく', FALSE),
    (21, 0, '休み', TRUE), (21, 1, '出口', FALSE), (21, 2, '入口', FALSE), (21, 3, 'きそく', FALSE),
    (22, 0, 'きそく', TRUE), (22, 1, 'ひつよう', FALSE), (22, 2, 'がまん', FALSE), (22, 3, 'だめ', FALSE),
    (23, 0, 'ひつよう', TRUE), (23, 1, 'きそく', FALSE), (23, 2, 'がまん', FALSE), (23, 3, 'だいじ', FALSE),
    (24, 0, 'だいじ', TRUE), (24, 1, 'ひつよう', FALSE), (24, 2, 'きそく', FALSE), (24, 3, 'あぶない', FALSE),
    (25, 0, 'あぶない', TRUE), (25, 1, 'だいじ', FALSE), (25, 2, 'ひつよう', FALSE), (25, 3, 'きそく', FALSE),
    (26, 0, 'がまん', TRUE), (26, 1, 'ひつよう', FALSE), (26, 2, 'だいじ', FALSE), (26, 3, 'きそく', FALSE),
    (27, 0, 'かならず', TRUE), (27, 1, 'たまに', FALSE), (27, 2, 'ときどき', FALSE), (27, 3, 'あまり', FALSE),
    (28, 0, 'めんきょ', TRUE), (28, 1, 'きそく', FALSE), (28, 2, 'ひつよう', FALSE), (28, 3, 'がまん', FALSE),
    (29, 0, 'きまり', TRUE), (29, 1, 'ひつよう', FALSE), (29, 2, 'だいじ', FALSE), (29, 3, 'がまん', FALSE),
    (30, 0, 'だめ', TRUE), (30, 1, 'だいじ', FALSE), (30, 2, 'ひつよう', FALSE), (30, 3, 'あぶない', FALSE),

    -- 文の文法1 — Nai-form
    (31, 0, '出ない', TRUE), (31, 1, '出る', FALSE), (31, 2, '出た', FALSE), (31, 3, '出ます', FALSE),
    (32, 0, '休まない', TRUE), (32, 1, '休む', FALSE), (32, 2, '休んだ', FALSE), (32, 3, '休みます', FALSE),
    (33, 0, '立たない', TRUE), (33, 1, '立つ', FALSE), (33, 2, '立った', FALSE), (33, 3, '立ちます', FALSE),

    -- 〜ないでください
    (34, 0, '入らないでください', TRUE), (34, 1, '入ってください', FALSE), (34, 2, '入っています', FALSE), (34, 3, '入りました', FALSE),
    (35, 0, '立たないでください', TRUE), (35, 1, '立ってください', FALSE), (35, 2, '立っています', FALSE), (35, 3, '立ちました', FALSE),
    (36, 0, '出ないでください', TRUE), (36, 1, '出てください', FALSE), (36, 2, '出ています', FALSE), (36, 3, '出ました', FALSE),

    -- 〜なければなりません
    (37, 0, 'べんきょうしなければなりません', TRUE), (37, 1, 'べんきょうしてください', FALSE), (37, 2, 'べんきょうしています', FALSE), (37, 3, 'べんきょうしました', FALSE),
    (38, 0, '書かなければなりません', TRUE), (38, 1, '書いてください', FALSE), (38, 2, '書いています', FALSE), (38, 3, '書きました', FALSE),
    (39, 0, 'のらなければなりません', TRUE), (39, 1, 'のってください', FALSE), (39, 2, 'のっています', FALSE), (39, 3, 'のりました', FALSE),

    -- 〜なくてもいいです
    (40, 0, '休まなくてもいいです', TRUE), (40, 1, '休んでください', FALSE), (40, 2, '休んでいます', FALSE), (40, 3, '休みました', FALSE),
    (41, 0, 'おきなくてもいいです', TRUE), (41, 1, 'おきてください', FALSE), (41, 2, 'おきています', FALSE), (41, 3, 'おきました', FALSE),
    (42, 0, 'しなくてもいいです', TRUE), (42, 1, 'してください', FALSE), (42, 2, 'しています', FALSE), (42, 3, 'しました', FALSE),

    -- bentuk kamus
    (43, 0, '出る', TRUE), (43, 1, '出た', FALSE), (43, 2, '出ない', FALSE), (43, 3, '出ます', FALSE),
    (44, 0, '入る', TRUE), (44, 1, '入った', FALSE), (44, 2, '入らない', FALSE), (44, 3, '入ります', FALSE),
    (45, 0, '休む', TRUE), (45, 1, '休んだ', FALSE), (45, 2, '休まない', FALSE), (45, 3, '休みます', FALSE),

    -- た-form
    (46, 0, '出た', TRUE), (46, 1, '出る', FALSE), (46, 2, '出ない', FALSE), (46, 3, '出ました', FALSE),
    (47, 0, '休んだ', TRUE), (47, 1, '休む', FALSE), (47, 2, '休まない', FALSE), (47, 3, '休みました', FALSE),
    (48, 0, '立った', TRUE), (48, 1, '立つ', FALSE), (48, 2, '立たない', FALSE), (48, 3, '立ちました', FALSE),

    -- なかった-form
    (49, 0, '出なかった', TRUE), (49, 1, '出た', FALSE), (49, 2, '出る', FALSE), (49, 3, '出ません', FALSE),
    (50, 0, '休まなかった', TRUE), (50, 1, '休んだ', FALSE), (50, 2, '休む', FALSE), (50, 3, '休みません', FALSE)
  )
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT qq.id, o.option_text, o.ok, o.ord
    FROM o
    JOIN quiz_questions qq
      ON qq.lesson_id = v_lesson_id AND qq.sort_order = o.qno;

  -- ===== Assertion bentuk =====
  IF (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id) <> 50 THEN
    RAISE EXCEPTION '103: jumlah soal bukan 50 (dapat %)',
      (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
      LEFT JOIN quiz_options qo ON qo.question_id = qq.id
     WHERE qq.lesson_id = v_lesson_id
     GROUP BY qq.id
    HAVING COUNT(qo.id) <> 4 OR COUNT(*) FILTER (WHERE qo.is_correct) <> 1
  ) THEN
    RAISE EXCEPTION '103: ada soal yang opsinya bukan 4 atau kuncinya bukan tepat 1';
  END IF;

  -- ===== Pagar level =====

  -- 1. Badan kalimat (di LUAR target <u>…</u>) hanya boleh memakai kanji
  --    taught: whitelist 100/102 (62 kanji Bab 3-9 + 見読書 Bab10 + 週毎
  --    Bab11 + 食飲 Bab12) UNION 立休入出 (Bab 14).
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND regexp_replace(
             regexp_replace(question, '<u>[^<]*</u>', '', 'g'),
             '[先何語校国生学名人魚本花八三十九一五四二六七安高古新白長男女気下前外間右中左後上時分円百千万年月半歳午車東道駅行西電北南見読書週毎食飲立休入出]', '', 'g'
           ) ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '103: ada kanji di luar daftar taught pada badan kalimat soal';
  END IF;

  -- 2. Partikel: TIDAK ADA ASSERTION (dihapus sejak 059).
  -- 3. Kata kerja: TIDAK ADA ASSERTION (dihapus sejak 100 — Bab 14 bagian
  --    dari materi konjugasi plain, token yang dulu dilarang justru materinya).

  -- 4. Rantai の dalam satu kalimat.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '103: ada kalimat dengan rantai の (lebih dari satu の dalam satu kalimat)';
  END IF;

  -- 5. Target section: もんだい1 wajib kanji di dalam <u>, もんだい2 wajib kana.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 1
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '') !~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '103: ada soal 漢字読み yang target <u> nya tidak mengandung kanji';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 2
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '一') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '103: ada soal 表記 yang target <u> nya sudah berupa kanji';
  END IF;

  -- 6. DEDUP WAJIB — target <u> tidak boleh sama dengan salah satu dari
  --    195 target unik yang sudah dipakai di 042-102 (159 dari 042-061 +
  --    18 dari 100 + 18 dari 102, di-grep ulang dari file migrasi sungguhan).
  IF EXISTS (
    SELECT 1 FROM quiz_questions qq,
      LATERAL (SELECT (regexp_match(qq.question, '<u>([^<]*)</u>'))[1] AS tgt) t
     WHERE qq.lesson_id = v_lesson_id
       AND t.tgt = ANY (ARRAY[
         'いんど','えきまえ','かきます','がいこく','がくせい','がっこう','きゅうにん',
         'きゅうひゃくえん','くじかん','くに','こくどう','ごご','ごじ','ごじゅうにん',
         'ごせんえん','ごぜん','ごぜんちゅう','ごにん','ごねんせい','ごひゃくえん','ごほん',
         'さかな','さゆう','さんにん','さんねんせい','しゃどう','じかん','じゅうごふん',
         'じゅうにじ','じゅうにん','じゅっぽん','じょうげ','せんえん','せんげつ','せんせい',
         'せんにん','ぜんご','たい','ちゅうかん','ちゅうがくせい','ちゅうねん','とうざい',
         'ななひゃくえん','なに','なんじ','なんせい','なんとう','なんねん','なんぼく',
         'にじゅうにん','にせんえん','にねんせい','にひゃくえん','にほん','はちじ','はちにん',
         'はな','はん','はんとし','はんぶん','ひと','ひゃくにん','べとなむ','ほくせい',
         'ほくとう','ほん','まいにち','まんえん','みました','よにん','よねんせい','よみました',
         'よんじゅうにん','よんほん','ろくにん',
         '一人','一分','一時','一本','七人','七分','三十人','三十分','三時','三本','三百円',
         '上','下','中','中国','九時','二人','二十歳','二時','二百人','人気','人間','何人',
         '何年生','何本','先生','先週','八時半','八百円','六分','六年生','六時','六本','六百円',
         '前','北','十分','十時','南','古い','右','名前','四時','国','外','大学生','女',
         '女の人','学校','学生','安い','左','後ろ','新しい','日本','日本人','日本語',
         '書きました','本','東','毎月','毎週','気分','男','男の人','男女','留学生','白い','花',
         '行','西','見ません','読みます','車','道','長い','電車','韓国人','駅','高い','高校',
         '高校生','魚',
         'いきました','いって','かいて','たべて','たべもの','のみました','のんで','みて',
         'よんで','書いて','行って','見て','見てから','読んで','食べて','食べてから','飲んで',
         '飲んでから',
         '読んでいます','書いています','見ています','食べています','飲んでいます',
         '書いてください','読んでください','食べてもいいですか','飲んではいけません',
         'よんでいます','かいています','みています','たべています','のんでいます',
         'かいてください','よんでください','たべてもいいですか','のんではいけません'
       ])
  ) THEN
    RAISE EXCEPTION '103: ada target <u> yang sudah pernah diujikan di migration 042-102';
  END IF;

  RAISE NOTICE '103: selesai — 50 soal (vocabulary 30, grammar 20), semua pagar level + dedup lolos.';
END $$;
