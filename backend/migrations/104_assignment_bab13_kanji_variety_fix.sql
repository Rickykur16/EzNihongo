-- 104_assignment_bab13_kanji_variety_fix.sql — perbaikan produksi untuk
-- Assignment Bab 13 yang SUDAH LIVE (102, ter-deploy lewat PR #191).
--
-- MASALAH: user melaporkan "kanji yang kau ujikan bab 12 dan bab 13 sama"
-- — もんだい1/2 di 102 memakai 読/書/見/食/飲 persis sama dengan Assignment
-- Bab 12 (100), jadi tidak ada variasi kanji antar dua assignment
-- berurutan. Sumber 102 SUDAH diedit langsung (fresh install lewat 000-104
-- sekarang benar sejak awal) tapi database yang SUDAH menjalankan 102
-- (tercatat di schema_migrations, tidak akan re-run) tetap punya versi
-- lama — migrasi ini yang memperbaiki data production, pola sama dengan
-- 101 (perbaikan judul 090-097 yang sudah live) dan 065 (restore konten
-- yang sudah live). Isi DO-block di bawah IDENTIK dengan versi 102 yang
-- sudah direvisi (re-run penuh DELETE+INSERT 50 soal ke lesson slug yang
-- sama), supaya idempoten dan konsisten dengan fresh install.
--
-- Ujian bab untuk Bab 13, melanjutkan pola assignment Bab 1-12
-- (039/040/041/045/047/051/053/055/057/059/061/100). Modul di-resolve
-- ordinal (OFFSET 12, lanjutan pola 039-100).
--
-- JUDUL pakai TITIK DUA sejak awal (konvensi migration 079), tidak perlu
-- normalizer susulan seperti 090-097/062 (lihat 101).
--
-- Kebijakan 50/50 (Bab 8+, berlaku sejak 055): questions_per_attempt = 50,
-- SEMUA soal ditampilkan tiap attempt (bukan sampling 30).
--
-- KANJI: Bab 13 TIDAK memperkenalkan kanji baru (dikonfirmasi header
-- 082_bunpou_bab13.sql — "Bab 13 tidak memperkenalkan kanji baru"), jadi
-- whitelist badan kalimat SAMA PERSIS dengan Assignment Bab 12 (100): 62
-- kanji Bab 3-9 + 見読書 (Bab 10) + 週毎 (Bab 11) + 食飲 (Bab 12).
--
-- REVISI (permintaan user setelah 100/102 sama-sama live: "kanji yang
-- diujikan bab 12 dan bab 13 sama"): もんだい1/2 SENGAJA TIDAK memakai
-- 読/書/見/食/飲 (itu sudah jadi milik Assignment Bab 12/100) — dipilih
-- kanji LEBIH LAMA dari whitelist (車・花・電車・道・駅, semuanya sudah
-- diajarkan sebelum Bab 12) digabung dengan 4 pola grammar Bab 13
-- (ています／てください／てもいいですか／てはいけません; てくれませんか
-- tetap hanya di もんだい1 文の文法1, tidak diuji bacaan/tulisannya di
-- sini). Variasi verba: もつ(車を持つ)・さく(花が咲く)・のる(電車に乗る)・
-- あるく(道を歩く)・まつ(駅で待つ) untuk ています, lalu のる/あるく/つかう/
-- とる untuk perintah/izin/larangan — kanji tetap dari whitelist, verba
-- SENGAJA dieja kana (もっています dst, bukan 持っています) karena
-- 持/咲/乗/歩/待/使/取 tidak ada di whitelist taught kanji, pola sama
-- dengan 行 di 100 (kanji taught + verba kana).
--
-- PAGAR KATA KERJA: TETAP DIHAPUS, melanjutkan keputusan 100 (Bab 12).
-- Bab 13 masih bagian dari "keluarga te-form" — ています／てください／
-- てくれませんか／てもいいですか／てはいけません semuanya DIBANGUN dari
-- bentuk te (Bab 12) ditambah ます/imperative/pertanyaan, jadi regex lama
-- yang melarang ます/ました/いる dst masih akan melarang materi inti bab
-- ini. Pagar kanji tetap berlaku penuh.
--
-- PAGAR PARTIKEL: sudah dihapus sejak 059, tidak ada di sini.
--
-- REF_CHECK bacaan (sumber kebenaran tunggal):
--   車をもっています＝くるまをもっています   花がさいています＝はながさいています
--   電車にのっています＝でんしゃにのっています   道をあるいています＝みちをあるいています
--   駅でまっています＝えきでまっています   電車にのってください＝でんしゃにのってください
--   道をあるいてください＝みちをあるいてください
--   車をつかってもいいですか＝くるまをつかってもいいですか
--   花をとってはいけません＝はなをとってはいけません
--
-- JEBAKAN PAGAR "RANTAI の" (assertion 4, regex の[^。]*の terhadap kolom
-- question MENTAH termasuk isi <u>…</u> — lihat catatan di 100): semua
-- target & badan kalimat di file ini di-cek MANUAL sebelum commit, tidak
-- ada kata majemuk ber-の ganda dalam satu kata (mis. のみもの) yang
-- ditaruh di kolom question. Satu-satunya の di section ini ada di
-- "女の人"/"おんなのひと" (もんだい1/2 soal ke-5) — cuma SATU の, aman.
--
-- DEDUP WAJIB (pola established sejak 047): 18 target <u> baru di file ini
-- (もんだい1/2, 9 pasang mirror kanji↔kana) dicek terhadap 177 target unik
-- yang sudah dipakai di 042-100 (159 dari 042-061 + 18 dari 100, di-grep
-- ulang dari file migrasi sungguhan) — sudah diverifikasi tidak nabrak
-- kata kerja te-form apa pun yang pernah dipakai di 042-100/103.
--
-- Komposisi: もんだい1 漢字読み 9 + もんだい2 表記 9 + もんだい3 文脈規定 12
-- + もんだい1 文の文法1 20 (5/4/3/4/4 per pola: ています／てください／
-- てくれませんか／てもいいですか／てはいけません) = 50 soal, SEMUA
-- ditampilkan tiap attempt, lulus 70% (35/50), cooldown 12 jam.
--
-- POSISI: sort_order 100 (akhir modul), sama seperti 039-100 — assignment
-- adalah penutup bab, tidak perlu penomoran ulang.
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
  v_bab_no       INT  := 13;
  v_title_re     TEXT := '(te.?form|progresif|aplikasi|ています)';
  v_lesson_slug  TEXT := 'assignment-bab-13-progresif-permintaan-izin';
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
    RAISE NOTICE '104: modul Bab % di kursus % tidak ditemukan — skip seed assignment.', v_bab_no, v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* v_title_re THEN
    RAISE NOTICE '104: modul Bab % terbaca "%" — kalau ternyata bukan bab yang dimaksud, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).',
      v_bab_no, v_module_title;
  END IF;

  RAISE NOTICE '104: seed Assignment Bab % ke modul "%".', v_bab_no, v_module_title;

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, questions_per_attempt, cooldown_hours
  ) VALUES (
    v_module_id, v_lesson_slug, 'Assignment Bab 13: Progresif, Permintaan & Izin', 'quiz',
    'Tes materi Bab 13 (Progresif, Permintaan & Izin) gaya JLPT. Moji-Goi: cara baca dan menulis kombinasi kata berkanji (車・花・電車・道・駅) dengan pola ています/てください/てもいいですか/てはいけません, serta kosakata fungsional permintaan/izin/larangan (すみません・どうぞ・けっこうです・だいじょうぶ・だめです) dan tempat umum (としょかん・びょういん・はくぶつかん). Tata Bahasa: 〜ています (sedang/kondisi/kebiasaan/profesi), 〜てください (permintaan sopan), 〜てくれませんか (permintaan halus), 〜てもいいですか (meminta izin), 〜てはいけません (larangan). Semua 50 soal ditampilkan tiap attempt. Lulus 70% (35/50), cooldown 12 jam.',
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
    -- ===== もんだい1 漢字読み (1-9) — kanji LAMA (車・花・電車・道・駅, sebelum
    -- Bab 12) + pola baru Bab 13, verba dieja kana (持/咲/乗/歩/待/使/取
    -- tidak ada di whitelist taught kanji) =====
    (1, 'vocabulary'::TEXT, 1, '先生は <u>車をもっています</u>。',
        '車をもっています dibaca くるまをもっています. Bentuk te + います di sini menyatakan kepemilikan yang berlangsung.'),
    (2, 'vocabulary', 1, 'にわに <u>花がさいています</u>。',
        '花がさいています dibaca はながさいています. Bentuk te + います di sini menyatakan keadaan yang sedang berlangsung.'),
    (3, 'vocabulary', 1, '学生は <u>電車にのっています</u>。',
        '電車にのっています dibaca でんしゃにのっています. Bentuk te + います menyatakan aksi yang sedang berlangsung.'),
    (4, 'vocabulary', 1, 'まいあさ <u>道をあるいています</u>。',
        '道をあるいています dibaca みちをあるいています. Bentuk te + います menyatakan aksi yang sedang berlangsung.'),
    (5, 'vocabulary', 1, '女の人は <u>駅でまっています</u>。',
        '駅でまっています dibaca えきでまっています. Bentuk te + います menyatakan aksi yang sedang berlangsung.'),
    (6, 'vocabulary', 1, 'えきで <u>電車にのってください</u>。',
        '電車にのってください dibaca でんしゃにのってください. Bentuk te + ください adalah permintaan atau instruksi yang sopan.'),
    (7, 'vocabulary', 1, 'ゆっくり <u>道をあるいてください</u>。',
        '道をあるいてください dibaca みちをあるいてください. Bentuk te + ください adalah permintaan atau instruksi yang sopan.'),
    (8, 'vocabulary', 1, 'ここで <u>車をつかってもいいですか</u>。',
        '車をつかってもいいですか dibaca くるまをつかってもいいですか. Bentuk te + もいいですか dipakai untuk MEMINTA izin.'),
    (9, 'vocabulary', 1, 'こうえんで <u>花をとってはいけません</u>。',
        '花をとってはいけません dibaca はなをとってはいけません. Bentuk te + はいけません menyatakan larangan tegas.'),

    -- ===== もんだい2 表記 (10-18) — target hiragana (mirror もんだい1), jawaban bentuk tulisan =====
    (10, 'vocabulary', 2, 'せんせいは <u>くるまをもっています</u>。',
        'くるまをもっています ditulis 車をもっています. Salah: 花がさいています (はながさいています, bunga mekar), 電車にのっています (でんしゃにのっています, naik kereta), 道をあるいています (みちをあるいています, berjalan di jalan).'),
    (11, 'vocabulary', 2, 'にわに <u>はながさいています</u>。',
        'はながさいています ditulis 花がさいています. Salah: 車をもっています (くるまをもっています, punya mobil), 電車にのっています (でんしゃにのっています, naik kereta), 駅でまっています (えきでまっています, menunggu di stasiun).'),
    (12, 'vocabulary', 2, 'がくせいは <u>でんしゃにのっています</u>。',
        'でんしゃにのっています ditulis 電車にのっています. Salah: 車をもっています (くるまをもっています, punya mobil), 道をあるいています (みちをあるいています, berjalan di jalan), 駅でまっています (えきでまっています, menunggu di stasiun).'),
    (13, 'vocabulary', 2, 'まいあさ <u>みちをあるいています</u>。',
        'みちをあるいています ditulis 道をあるいています. Salah: 花がさいています (はながさいています, bunga mekar), 電車にのっています (でんしゃにのっています, naik kereta), 駅でまっています (えきでまっています, menunggu di stasiun).'),
    (14, 'vocabulary', 2, 'おんなのひとは <u>えきでまっています</u>。',
        'えきでまっています ditulis 駅でまっています. Salah: 車をもっています (くるまをもっています, punya mobil), 花がさいています (はながさいています, bunga mekar), 道をあるいています (みちをあるいています, berjalan di jalan).'),
    (15, 'vocabulary', 2, 'えきで <u>でんしゃにのってください</u>。',
        'でんしゃにのってください ditulis 電車にのってください. Salah: 道をあるいてください (みちをあるいてください, berjalan di jalan), 車をつかってください (くるまをつかってください, pakai mobil), 花をとってください (はなをとってください, memetik bunga).'),
    (16, 'vocabulary', 2, 'ゆっくり <u>みちをあるいてください</u>。',
        'みちをあるいてください ditulis 道をあるいてください. Salah: 電車にのってください (でんしゃにのってください, naik kereta), 車をつかってください (くるまをつかってください, pakai mobil), 花をとってください (はなをとってください, memetik bunga).'),
    (17, 'vocabulary', 2, 'ここで <u>くるまをつかってもいいですか</u>。',
        'くるまをつかってもいいですか ditulis 車をつかってもいいですか. Salah: 電車にのってもいいですか (でんしゃにのってもいいですか, naik kereta), 道をあるいてもいいですか (みちをあるいてもいいですか, berjalan di jalan), 花をとってもいいですか (はなをとってもいいですか, memetik bunga).'),
    (18, 'vocabulary', 2, 'こうえんで <u>はなをとってはいけません</u>。',
        'はなをとってはいけません ditulis 花をとってはいけません. Salah: 車をつかってはいけません (くるまをつかってはいけません, pakai mobil), 電車にのってはいけません (でんしゃにのってはいけません, naik kereta), 道をあるいてはいけません (みちをあるいてはいけません, berjalan di jalan).'),

    -- ===== もんだい3 文脈規定 (19-30) — kosakata fungsional permintaan/izin/larangan + tempat =====
    (19, 'vocabulary', 3, 'としょかんでは（　）に してください。',
        'Jawabannya しずかに (dengan tenang/pelan). きをつけて, だいじょうぶ, わかりました tidak cocok untuk aturan perpustakaan.'),
    (20, 'vocabulary', 3, '「この 本を 読んでも いいですか。」「はい、（　）。」',
        'Jawabannya どうぞ (silakan), dipakai untuk MENGIZINKAN. けっこうです (menolak), だめです (tidak boleh), すみません (permintaan maaf) tidak cocok untuk mengizinkan.'),
    (21, 'vocabulary', 3, '「コーヒーは いかがですか。」「いいえ、（　）。」',
        'Jawabannya けっこうです (tidak usah, menolak dengan sopan). どうぞ, いいですよ, だいじょうぶ tidak cocok untuk menolak tawaran.'),
    (22, 'vocabulary', 3, '（　）、ちょっと まってくれませんか。',
        'Jawabannya すみません (permisi), pengantar sopan sebelum meminta tolong. どうぞ, けっこうです, だいじょうぶ tidak cocok sebagai pengantar permintaan.'),
    (23, 'vocabulary', 3, '「あたまが いたいです。」「たいへんですね。（　）ですか。」',
        'Jawabannya だいじょうぶ (baik-baik saja), menanyakan kondisi. けっこうです, どうぞ, すみません tidak cocok untuk menanyakan kondisi.'),
    (24, 'vocabulary', 3, 'くるまが おおいですから、（　）ください。',
        'Jawabannya きをつけて (hati-hati). しずかに, どうぞ, だめです tidak cocok sebagai peringatan lalu lintas.'),
    (25, 'vocabulary', 3, '「あした 三時に きてください。」「はい、（　）。」',
        'Jawabannya わかりました (mengerti/baik), menyetujui instruksi. どうぞ, けっこうです, だいじょうぶ tidak cocok untuk menyetujui instruksi.'),
    (26, 'vocabulary', 3, '「ここで しゃしんを とっても いいですか。」「ええ、（　）。」',
        'Jawabannya いいですよ (boleh/silakan), mengizinkan dengan santai. だめです, けっこうです, すみません tidak cocok untuk mengizinkan.'),
    (27, 'vocabulary', 3, '「ここで たばこを すっても いいですか。」「いいえ、（　）。」',
        'Jawabannya だめです (tidak boleh). いいですよ, どうぞ, わかりました tidak cocok untuk melarang.'),
    (28, 'vocabulary', 3, '本を かりたいです。（　）へ 行きます。',
        'Jawabannya としょかん (perpustakaan), tempat meminjam buku. びょういん, はくぶつかん, どうぶつえん tidak berkaitan dengan meminjam buku.'),
    (29, 'vocabulary', 3, 'あたまが いたいですから、（　）へ 行きます。',
        'Jawabannya びょういん (rumah sakit), tempat berobat. としょかん, はくぶつかん, どうぶつえん tidak berkaitan dengan sakit kepala.'),
    (30, 'vocabulary', 3, 'ふるい 本や しゃしんを 見たいです。（　）へ 行きます。',
        'Jawabannya はくぶつかん (museum), tempat melihat benda lama/foto. としょかん, びょういん, どうぶつえん tidak berkaitan dengan benda pameran lama.'),

    -- ===== もんだい1 文の文法1 (31-50) — 5 pola grammar Bab 13 (5/4/3/4/4) =====
    -- Pola 1: 〜ています (31-35)
    (31, 'grammar'::TEXT, 1, 'いま ごはんを（　）。「食べています。」',
        'Jawabannya 食べています — bentuk te + います menyatakan aksi yang sedang berlangsung. 食べます (bukan sedang), 食べてください (permintaan), 食べました (lampau selesai) tidak menyatakan aksi yang sedang terjadi.'),
    (32, 'grammar', 1, 'ちちは かいしゃで（　）。「はたらいています。」',
        'Jawabannya はたらいています — bentuk te + います di sini menyatakan PROFESI (bekerja di perusahaan). はたらきます, はたらいてください, はたらきました tidak menyatakan profesi yang sedang berjalan.'),
    (33, 'grammar', 1, 'あには とうきょうに（　）。「すんでいます。」',
        'Jawabannya すんでいます — bentuk te + います di sini menyatakan KONDISI yang masih bertahan (tinggal di suatu tempat). すみます, すんでください, すみました tidak menyatakan kondisi yang berlangsung.'),
    (34, 'grammar', 1, 'まいあさ コーヒーを（　）。「のんでいます。」',
        'Jawabannya のんでいます — bentuk te + います di sini menyatakan KEBIASAAN yang diulang tiap hari. のみます, のんでください, のみました tidak menyatakan kebiasaan.'),
    (35, 'grammar', 1, 'いま 本を（　）。「よんでいます。」',
        'Jawabannya よんでいます — bentuk te + います menyatakan aksi yang sedang berlangsung. よみます, よんでください, よみました tidak menyatakan aksi yang sedang terjadi.'),

    -- Pola 2: 〜てください (36-39)
    (36, 'grammar', 1, 'ここに 名前を（　）。「かいてください。」',
        'Jawabannya かいてください — bentuk te + ください adalah permintaan sopan. かいています (sedang), かきます (akan), かきました (sudah) tidak menyatakan permintaan.'),
    (37, 'grammar', 1, 'もういちど ゆっくり（　）。「はなしてください。」',
        'Jawabannya はなしてください — permintaan sopan memakai bentuk te + ください. はなしています, はなします, はなしました tidak menyatakan permintaan.'),
    (38, 'grammar', 1, 'この 本を（　）。「みてください。」',
        'Jawabannya みてください — permintaan sopan memakai bentuk te + ください. みています, みます, みました tidak menyatakan permintaan.'),
    (39, 'grammar', 1, 'ちょっと（　）。「まってください。」',
        'Jawabannya まってください — permintaan sopan memakai bentuk te + ください. まっています, まちます, まちました tidak menyatakan permintaan.'),

    -- Pola 3: 〜てくれませんか (40-42)
    (40, 'grammar', 1, 'すみません、ちょっと（　）。「まってくれませんか。」',
        'Jawabannya まってくれませんか — permintaan yang lebih HALUS daripada 〜てください karena berbentuk pertanyaan negatif. まってください (tegas-sopan), まっています, まちました tidak sehalus てくれませんか.'),
    (41, 'grammar', 1, 'この かんじを（　）。「よんでくれませんか。」',
        'Jawabannya よんでくれませんか — permintaan halus, menanyakan kesediaan lawan bicara. よんでください, よんでいます, よみました tidak sehalus てくれませんか.'),
    (42, 'grammar', 1, 'しゃしんを（　）。「とってくれませんか。」',
        'Jawabannya とってくれませんか — permintaan halus, menanyakan kesediaan lawan bicara. とってください, とっています, とりました tidak sehalus てくれませんか.'),

    -- Pola 4: 〜てもいいですか (43-46)
    (43, 'grammar', 1, 'ここで しゃしんを（　）。「とってもいいですか。」',
        'Jawabannya とってもいいですか — bentuk te + もいいですか untuk MEMINTA izin. とってください (permintaan), とっています (sedang), とりました (lampau) tidak menyatakan permintaan izin.'),
    (44, 'grammar', 1, 'この 本を（　）。「よんでもいいですか。」',
        'Jawabannya よんでもいいですか — bentuk te + もいいですか untuk meminta izin. よんでください, よんでいます, よみました tidak menyatakan permintaan izin.'),
    (45, 'grammar', 1, 'すこし（　）。「やすんでもいいですか。」',
        'Jawabannya やすんでもいいですか — bentuk te + もいいですか untuk meminta izin. やすんでください, やすんでいます, やすみました tidak menyatakan permintaan izin.'),
    (46, 'grammar', 1, 'ここで（　）。「たべてもいいですか。」',
        'Jawabannya たべてもいいですか — bentuk te + もいいですか untuk meminta izin. たべてください, たべています, たべました tidak menyatakan permintaan izin.'),

    -- Pola 5: 〜てはいけません (47-50)
    (47, 'grammar', 1, 'ここで たばこを（　）。「すってはいけません。」',
        'Jawabannya すってはいけません — bentuk te + はいけません menyatakan larangan tegas. すってください, すっています, すいました tidak menyatakan larangan.'),
    (48, 'grammar', 1, 'この へやで（　）。「あそんではいけません。」',
        'Jawabannya あそんではいけません — larangan tegas memakai bentuk te + はいけません. あそんでください, あそんでいます, あそびました tidak menyatakan larangan.'),
    (49, 'grammar', 1, 'じゅぎょうちゅうに ものを（　）。「食べてはいけません。」',
        'Jawabannya 食べてはいけません — larangan tegas memakai bentuk te + はいけません. 食べてください, 食べています, 食べました tidak menyatakan larangan.'),
    (50, 'grammar', 1, 'としょかんで（　）。「はなしてはいけません。」',
        'Jawabannya はなしてはいけません — larangan tegas memakai bentuk te + はいけません. はなしてください, はなしています, はなしました tidak menyatakan larangan.')
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
    (1, 0, 'くるまをもっています', TRUE), (1, 1, 'はながさいています', FALSE), (1, 2, 'でんしゃにのっています', FALSE), (1, 3, 'みちをあるいています', FALSE),
    (2, 0, 'はながさいています', TRUE), (2, 1, 'くるまをもっています', FALSE), (2, 2, 'でんしゃにのっています', FALSE), (2, 3, 'えきでまっています', FALSE),
    (3, 0, 'でんしゃにのっています', TRUE), (3, 1, 'くるまをもっています', FALSE), (3, 2, 'みちをあるいています', FALSE), (3, 3, 'えきでまっています', FALSE),
    (4, 0, 'みちをあるいています', TRUE), (4, 1, 'はながさいています', FALSE), (4, 2, 'でんしゃにのっています', FALSE), (4, 3, 'えきでまっています', FALSE),
    (5, 0, 'えきでまっています', TRUE), (5, 1, 'くるまをもっています', FALSE), (5, 2, 'はながさいています', FALSE), (5, 3, 'みちをあるいています', FALSE),
    (6, 0, 'でんしゃにのってください', TRUE), (6, 1, 'みちをあるいてください', FALSE), (6, 2, 'くるまをつかってください', FALSE), (6, 3, 'はなをとってください', FALSE),
    (7, 0, 'みちをあるいてください', TRUE), (7, 1, 'でんしゃにのってください', FALSE), (7, 2, 'くるまをつかってください', FALSE), (7, 3, 'はなをとってください', FALSE),
    (8, 0, 'くるまをつかってもいいですか', TRUE), (8, 1, 'でんしゃにのってもいいですか', FALSE), (8, 2, 'みちをあるいてもいいですか', FALSE), (8, 3, 'はなをとってもいいですか', FALSE),
    (9, 0, 'はなをとってはいけません', TRUE), (9, 1, 'くるまをつかってはいけません', FALSE), (9, 2, 'でんしゃにのってはいけません', FALSE), (9, 3, 'みちをあるいてはいけません', FALSE),

    -- 表記 — opsi bentuk tulisan
    (10, 0, '車をもっています', TRUE), (10, 1, '花がさいています', FALSE), (10, 2, '電車にのっています', FALSE), (10, 3, '道をあるいています', FALSE),
    (11, 0, '花がさいています', TRUE), (11, 1, '車をもっています', FALSE), (11, 2, '電車にのっています', FALSE), (11, 3, '駅でまっています', FALSE),
    (12, 0, '電車にのっています', TRUE), (12, 1, '車をもっています', FALSE), (12, 2, '道をあるいています', FALSE), (12, 3, '駅でまっています', FALSE),
    (13, 0, '道をあるいています', TRUE), (13, 1, '花がさいています', FALSE), (13, 2, '電車にのっています', FALSE), (13, 3, '駅でまっています', FALSE),
    (14, 0, '駅でまっています', TRUE), (14, 1, '車をもっています', FALSE), (14, 2, '花がさいています', FALSE), (14, 3, '道をあるいています', FALSE),
    (15, 0, '電車にのってください', TRUE), (15, 1, '道をあるいてください', FALSE), (15, 2, '車をつかってください', FALSE), (15, 3, '花をとってください', FALSE),
    (16, 0, '道をあるいてください', TRUE), (16, 1, '電車にのってください', FALSE), (16, 2, '車をつかってください', FALSE), (16, 3, '花をとってください', FALSE),
    (17, 0, '車をつかってもいいですか', TRUE), (17, 1, '電車にのってもいいですか', FALSE), (17, 2, '道をあるいてもいいですか', FALSE), (17, 3, '花をとってもいいですか', FALSE),
    (18, 0, '花をとってはいけません', TRUE), (18, 1, '車をつかってはいけません', FALSE), (18, 2, '電車にのってはいけません', FALSE), (18, 3, '道をあるいてはいけません', FALSE),

    -- 文脈規定
    (19, 0, 'しずかに', TRUE), (19, 1, 'きをつけて', FALSE), (19, 2, 'だいじょうぶ', FALSE), (19, 3, 'わかりました', FALSE),
    (20, 0, 'どうぞ', TRUE), (20, 1, 'けっこうです', FALSE), (20, 2, 'だめです', FALSE), (20, 3, 'すみません', FALSE),
    (21, 0, 'けっこうです', TRUE), (21, 1, 'どうぞ', FALSE), (21, 2, 'いいですよ', FALSE), (21, 3, 'だいじょうぶ', FALSE),
    (22, 0, 'すみません', TRUE), (22, 1, 'どうぞ', FALSE), (22, 2, 'けっこうです', FALSE), (22, 3, 'だいじょうぶ', FALSE),
    (23, 0, 'だいじょうぶ', TRUE), (23, 1, 'けっこうです', FALSE), (23, 2, 'どうぞ', FALSE), (23, 3, 'すみません', FALSE),
    (24, 0, 'きをつけて', TRUE), (24, 1, 'しずかに', FALSE), (24, 2, 'どうぞ', FALSE), (24, 3, 'だめです', FALSE),
    (25, 0, 'わかりました', TRUE), (25, 1, 'どうぞ', FALSE), (25, 2, 'けっこうです', FALSE), (25, 3, 'だいじょうぶ', FALSE),
    (26, 0, 'いいですよ', TRUE), (26, 1, 'だめです', FALSE), (26, 2, 'けっこうです', FALSE), (26, 3, 'すみません', FALSE),
    (27, 0, 'だめです', TRUE), (27, 1, 'いいですよ', FALSE), (27, 2, 'どうぞ', FALSE), (27, 3, 'わかりました', FALSE),
    (28, 0, 'としょかん', TRUE), (28, 1, 'びょういん', FALSE), (28, 2, 'はくぶつかん', FALSE), (28, 3, 'どうぶつえん', FALSE),
    (29, 0, 'びょういん', TRUE), (29, 1, 'としょかん', FALSE), (29, 2, 'はくぶつかん', FALSE), (29, 3, 'どうぶつえん', FALSE),
    (30, 0, 'はくぶつかん', TRUE), (30, 1, 'としょかん', FALSE), (30, 2, 'びょういん', FALSE), (30, 3, 'どうぶつえん', FALSE),

    -- 文の文法1 — 〜ています
    (31, 0, '食べています', TRUE), (31, 1, '食べます', FALSE), (31, 2, '食べてください', FALSE), (31, 3, '食べました', FALSE),
    (32, 0, 'はたらいています', TRUE), (32, 1, 'はたらきます', FALSE), (32, 2, 'はたらいてください', FALSE), (32, 3, 'はたらきました', FALSE),
    (33, 0, 'すんでいます', TRUE), (33, 1, 'すみます', FALSE), (33, 2, 'すんでください', FALSE), (33, 3, 'すみました', FALSE),
    (34, 0, 'のんでいます', TRUE), (34, 1, 'のみます', FALSE), (34, 2, 'のんでください', FALSE), (34, 3, 'のみました', FALSE),
    (35, 0, 'よんでいます', TRUE), (35, 1, 'よみます', FALSE), (35, 2, 'よんでください', FALSE), (35, 3, 'よみました', FALSE),

    -- 〜てください
    (36, 0, 'かいてください', TRUE), (36, 1, 'かいています', FALSE), (36, 2, 'かきます', FALSE), (36, 3, 'かきました', FALSE),
    (37, 0, 'はなしてください', TRUE), (37, 1, 'はなしています', FALSE), (37, 2, 'はなします', FALSE), (37, 3, 'はなしました', FALSE),
    (38, 0, 'みてください', TRUE), (38, 1, 'みています', FALSE), (38, 2, 'みます', FALSE), (38, 3, 'みました', FALSE),
    (39, 0, 'まってください', TRUE), (39, 1, 'まっています', FALSE), (39, 2, 'まちます', FALSE), (39, 3, 'まちました', FALSE),

    -- 〜てくれませんか
    (40, 0, 'まってくれませんか', TRUE), (40, 1, 'まってください', FALSE), (40, 2, 'まっています', FALSE), (40, 3, 'まちました', FALSE),
    (41, 0, 'よんでくれませんか', TRUE), (41, 1, 'よんでください', FALSE), (41, 2, 'よんでいます', FALSE), (41, 3, 'よみました', FALSE),
    (42, 0, 'とってくれませんか', TRUE), (42, 1, 'とってください', FALSE), (42, 2, 'とっています', FALSE), (42, 3, 'とりました', FALSE),

    -- 〜てもいいですか
    (43, 0, 'とってもいいですか', TRUE), (43, 1, 'とってください', FALSE), (43, 2, 'とっています', FALSE), (43, 3, 'とりました', FALSE),
    (44, 0, 'よんでもいいですか', TRUE), (44, 1, 'よんでください', FALSE), (44, 2, 'よんでいます', FALSE), (44, 3, 'よみました', FALSE),
    (45, 0, 'やすんでもいいですか', TRUE), (45, 1, 'やすんでください', FALSE), (45, 2, 'やすんでいます', FALSE), (45, 3, 'やすみました', FALSE),
    (46, 0, 'たべてもいいですか', TRUE), (46, 1, 'たべてください', FALSE), (46, 2, 'たべています', FALSE), (46, 3, 'たべました', FALSE),

    -- 〜てはいけません
    (47, 0, 'すってはいけません', TRUE), (47, 1, 'すってください', FALSE), (47, 2, 'すっています', FALSE), (47, 3, 'すいました', FALSE),
    (48, 0, 'あそんではいけません', TRUE), (48, 1, 'あそんでください', FALSE), (48, 2, 'あそんでいます', FALSE), (48, 3, 'あそびました', FALSE),
    (49, 0, '食べてはいけません', TRUE), (49, 1, '食べてください', FALSE), (49, 2, '食べています', FALSE), (49, 3, '食べました', FALSE),
    (50, 0, 'はなしてはいけません', TRUE), (50, 1, 'はなしてください', FALSE), (50, 2, 'はなしています', FALSE), (50, 3, 'はなしました', FALSE)
  )
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT qq.id, o.option_text, o.ok, o.ord
    FROM o
    JOIN quiz_questions qq
      ON qq.lesson_id = v_lesson_id AND qq.sort_order = o.qno;

  -- ===== Assertion bentuk =====
  IF (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id) <> 50 THEN
    RAISE EXCEPTION '104: jumlah soal bukan 50 (dapat %)',
      (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
      LEFT JOIN quiz_options qo ON qo.question_id = qq.id
     WHERE qq.lesson_id = v_lesson_id
     GROUP BY qq.id
    HAVING COUNT(qo.id) <> 4 OR COUNT(*) FILTER (WHERE qo.is_correct) <> 1
  ) THEN
    RAISE EXCEPTION '104: ada soal yang opsinya bukan 4 atau kuncinya bukan tepat 1';
  END IF;

  -- ===== Pagar level =====

  -- 1. Badan kalimat (di LUAR target <u>…</u>) hanya boleh memakai kanji
  --    taught: 62 kanji Bab 3-9 + 見読書 (Bab 10) + 週毎 (Bab 11) + 食飲
  --    (Bab 12) — SAMA PERSIS dengan whitelist 100 (Bab 13 tidak ada kanji baru).
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND regexp_replace(
             regexp_replace(question, '<u>[^<]*</u>', '', 'g'),
             '[先何語校国生学名人魚本花八三十九一五四二六七安高古新白長男女気下前外間右中左後上時分円百千万年月半歳午車東道駅行西電北南見読書週毎食飲]', '', 'g'
           ) ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '104: ada kanji di luar daftar taught pada badan kalimat soal';
  END IF;

  -- 2. Partikel: TIDAK ADA ASSERTION (dihapus sejak 059).
  -- 3. Kata kerja: TIDAK ADA ASSERTION (dihapus sejak 100 — Bab 12/13 sama-sama
  --    bagian keluarga te-form, token yang dulu dilarang justru materi intinya).

  -- 4. Rantai の dalam satu kalimat.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '104: ada kalimat dengan rantai の (lebih dari satu の dalam satu kalimat)';
  END IF;

  -- 5. Target section: もんだい1 wajib kanji di dalam <u>, もんだい2 wajib kana.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 1
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '') !~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '104: ada soal 漢字読み yang target <u> nya tidak mengandung kanji';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 2
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '一') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '104: ada soal 表記 yang target <u> nya sudah berupa kanji';
  END IF;

  -- 6. DEDUP WAJIB — target <u> tidak boleh sama dengan salah satu dari
  --    177 target unik yang sudah dipakai di 042-100 (159 dari 042-061 + 18
  --    dari 100, di-grep ulang dari file migrasi sungguhan).
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
         '飲んでから'
       ])
  ) THEN
    RAISE EXCEPTION '104: ada target <u> yang sudah pernah diujikan di migration 042-100';
  END IF;

  RAISE NOTICE '104: selesai — 50 soal (vocabulary 30, grammar 20), semua pagar level + dedup lolos.';
END $$;
