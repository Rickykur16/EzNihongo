-- 110_assignment_bab20_pengalaman_penghubung.sql — Assignment Bab 20:
-- Pengalaman & Penghubung Kalimat.
--
-- Ujian bab untuk Bab 20 — BAB PENUTUP N5 — melanjutkan pola assignment
-- Bab 1-19 (039/040/041/045/047/051/053/055/057/059/061/100/104/103/
-- 105/106/107/108/109). Modul di-resolve ordinal (OFFSET 19, lanjutan
-- pola 039-109).
--
-- JUDUL pakai TITIK DUA sejak awal (konvensi migration 079).
--
-- Kebijakan 50/50 (Bab 8+, berlaku sejak 055): questions_per_attempt = 50,
-- SEMUA soal ditampilkan tiap attempt (bukan sampling 30).
--
-- KANJI: Bab 20 memperkenalkan 2 kanji BARU — 来 dan 令 — dikonfirmasi
-- header 089_bunpou_bab20.sql. 来 ISTIMEWA karena punya DUA cara baca
-- berbeda tergantung konteks: らい (on-yomi, dipakai di kata majemuk
-- waktu seperti 来年／来月／来週 — kata-kata ini SEBELUMNYA selalu
-- ditulis kana di 106/109 karena 来 belum taught, SEKARANG boleh kanji)
-- dan き／く／こ (kun-yomi, dipakai untuk verba tidak beraturan 来る "kuru"
-- — 来ます／来ました／来ません／来て／来ない). もんだい1/2 SENGAJA
-- memakai 7 dari 9 target untuk menguji KEDUA cara baca ini sekaligus
-- (jebakan klasik JLPT), plus 令和 (nama era, satu-satunya kata yang
-- memakai 令 di level ini).
--
-- Whitelist kanji = whitelist 100/104/103/105/106/107/108/109 UNION 来令
-- (SAMA PERSIS dengan v_kanji_ok di 089_bunpou_bab20.sql).
--
-- PAGAR KATA KERJA: TIDAK RELEVAN (もんだい1/2 kosakata+konjugasi 来 saja,
-- bukan pola kata kerja umum) — tidak ada assertion kata kerja di file
-- ini, konsisten sejak 100.
--
-- PAGAR PARTIKEL: sudah dihapus sejak 059, tidak ada di sini. (から
-- sebagai penanda sebab justru topik utama もんだい1 文の文法1 pola 3 —
-- lihat di bawah.)
--
-- REF_CHECK bacaan (sumber kebenaran tunggal):
--   来年＝らいねん   来月＝らいげつ   来週＝らいしゅう   来ます＝きます
--   来ました＝きました   来ません＝きません   来て＝きて   来ない＝こない
--   令和＝れいわ
--
-- JEBAKAN PAGAR "RANTAI の": satu-satunya の di もんだい1/2 ada di
-- "いまの" (soal ke-9/18, di LUAR target <u>) — cuma SATU の per kalimat,
-- aman.
--
-- CATATAN PROSES (lanjutan dari 106-109): array dedup di bawah di-grep
-- ulang PENUH dari SEMUA migrasi assignment 039-109 yang benar-benar ada
-- di repo saat ini (303 target unik, sudah bersih dari baris komentar
-- palsu — lihat catatan di 106 soal placeholder tag di komentar).
--
-- Komposisi: もんだい1 漢字読み 9 + もんだい2 表記 9 + もんだい3 文脈規定 12
-- + もんだい1 文の文法1 20 (4/4/4/4/4 per pola: 〜たことがあります／
-- 〜たことがありません／〜から (sebab)／〜が、〜／そして・それから・
-- でも) = 50 soal, SEMUA ditampilkan tiap attempt, lulus 70% (35/50),
-- cooldown 12 jam. BAB PENUTUP seri Assignment Bab 12-20 (lihat CLAUDE.md
-- untuk ringkasan seluruh seri).
--
-- Pola 1-2 (31-38) menguji bentuk た+ことが+あります／ありません vs
-- bentuk lain (ます／ました／ています) dari verba yang sama. Pola 3
-- (39-42) menguji から sebagai penanda SEBAB vs penghubung lain
-- (が／でも／そして) yang salah secara gramatikal di posisi itu. Pola 4
-- (43-46) menguji が、〜 (menempel di AKHIR kalimat pertama) vs
-- penghubung lain yang mirip fungsi (から／ので／と). Pola 5 (47-50)
-- menguji pemilihan penghubung ANTAR KALIMAT yang tepat (そして／
-- それから／でも) berdasarkan hubungan logis kedua kalimat — satu-satunya
-- pola yang testable murni dari konteks makna, bukan posisi gramatikal.
--
-- もんだい3 文脈規定: Bab 20 BELUM punya bank kosakata resmi
-- (078_bab20_intro_kosakata_kanji.sql cuma seed kanji_items). 12 target
-- di sini memakai kata keterangan (adverbia) umum N5/N4 yang sering
-- menyertai kalimat pengalaman/pendapat: いちども／はじめて／もう／まだ／
-- やっと／ぜんぜん／たぶん／もちろん／ぜひ／きっと／やっぱり／とても.
-- SEMUA ditulis kana polos, tidak ada kanji baru di section ini jadi
-- tidak perlu pagar kanji khusus.
--
-- POSISI: sort_order 100 (akhir modul), sama seperti 039-109.
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
  v_bab_no       INT  := 20;
  v_title_re     TEXT := '(pengalaman|penghubung)';
  v_lesson_slug  TEXT := 'assignment-bab-20-pengalaman-penghubung';
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
    RAISE NOTICE '110: modul Bab % di kursus % tidak ditemukan — skip seed assignment.', v_bab_no, v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* v_title_re THEN
    RAISE NOTICE '110: modul Bab % terbaca "%" — kalau ternyata bukan bab yang dimaksud, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).',
      v_bab_no, v_module_title;
  END IF;

  RAISE NOTICE '110: seed Assignment Bab % ke modul "%".', v_bab_no, v_module_title;

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, questions_per_attempt, cooldown_hours
  ) VALUES (
    v_module_id, v_lesson_slug, 'Assignment Bab 20: Pengalaman & Penghubung Kalimat', 'quiz',
    'Tes materi Bab 20 (Pengalaman & Penghubung Kalimat) gaya JLPT — bab penutup N5. Moji-Goi: cara baca dan menulis kanji baru 来 (dua cara baca: らい di 来年／来月／来週, dan き／く／こ di kata kerja 来る "datang") serta 令 (dalam 令和). Tata Bahasa: 〜たことがあります／ありません (pengalaman pernah/belum pernah), 〜から (sebab), 〜が、〜 (pertentangan), dan そして／それから／でも (penghubung antar kalimat). Semua 50 soal ditampilkan tiap attempt. Lulus 70% (35/50), cooldown 12 jam.',
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
    -- ===== もんだい1 漢字読み (1-9) — 来 (dua cara baca) + 令 (令和) =====
    (1, 'vocabulary'::TEXT, 1, '<u>来年</u>、日本へ 行きます。',
        '来年 dibaca らいねん. 来 di kata majemuk waktu dibaca らい (on-yomi).'),
    (2, 'vocabulary', 1, '<u>来月</u>、たんじょうびです。',
        '来月 dibaca らいげつ. 来 dibaca らい di kata majemuk waktu.'),
    (3, 'vocabulary', 1, '<u>来週</u>、テストが あります。',
        '来週 dibaca らいしゅう. 来 dibaca らい di kata majemuk waktu.'),
    (4, 'vocabulary', 1, 'あした ここに <u>来ます</u>。',
        '来ます dibaca きます. 来る (verba tidak beraturan "datang") dibaca き di bentuk ます (kun-yomi, BEDA dari らい).'),
    (5, 'vocabulary', 1, 'きのう がっこうに <u>来ました</u>。',
        '来ました dibaca きました. Bentuk lampau dari 来ます.'),
    (6, 'vocabulary', 1, 'あしたは <u>来ません</u>。',
        '来ません dibaca きません. Bentuk negatif dari 来ます.'),
    (7, 'vocabulary', 1, 'ここに <u>来て</u>ください。',
        '来て dibaca きて. Bentuk te dari 来る.'),
    (8, 'vocabulary', 1, 'かれは まだ <u>来ない</u>と おもいます。',
        '来ない dibaca こない. Bentuk nai dari 来る dibaca こ (cara baca ketiga, beda lagi dari き dan らい).'),
    (9, 'vocabulary', 1, 'いまの じだいは <u>令和</u>です。',
        '令和 dibaca れいわ. 令 hanya dipakai dalam kata ini di level N5 — nama era Jepang saat ini.'),

    -- ===== もんだい2 表記 (10-18) — target hiragana (mirror もんだい1), jawaban bentuk tulisan =====
    (10, 'vocabulary', 2, '<u>らいねん</u>、日本へ 行きます。',
        'らいねん ditulis 来年. Salah: 来月 (らいげつ, bulan depan), 来週 (らいしゅう, minggu depan), 来ます (きます, datang).'),
    (11, 'vocabulary', 2, '<u>らいげつ</u>、たんじょうびです。',
        'らいげつ ditulis 来月. Salah: 来年 (らいねん, tahun depan), 来週 (らいしゅう, minggu depan), 来ます (きます, datang).'),
    (12, 'vocabulary', 2, '<u>らいしゅう</u>、テストが あります。',
        'らいしゅう ditulis 来週. Salah: 来年 (らいねん, tahun depan), 来月 (らいげつ, bulan depan), 来ます (きます, datang).'),
    (13, 'vocabulary', 2, 'あした ここに <u>きます</u>。',
        'きます ditulis 来ます. Salah: 来ました (きました, sudah datang), 来ません (きません, tidak datang), 来て (きて, bentuk te).'),
    (14, 'vocabulary', 2, 'きのう がっこうに <u>きました</u>。',
        'きました ditulis 来ました. Salah: 来ます (きます, datang), 来ません (きません, tidak datang), 来て (きて, bentuk te).'),
    (15, 'vocabulary', 2, 'あしたは <u>きません</u>。',
        'きません ditulis 来ません. Salah: 来ます (きます, datang), 来ました (きました, sudah datang), 来ない (こない, bentuk nai).'),
    (16, 'vocabulary', 2, 'ここに <u>きて</u>ください。',
        'きて ditulis 来て. Salah: 来ます (きます, datang), 来ました (きました, sudah datang), 来ない (こない, bentuk nai).'),
    (17, 'vocabulary', 2, 'かれは まだ <u>こない</u>と おもいます。',
        'こない ditulis 来ない. Salah: 来ます (きます, datang), 来て (きて, bentuk te), 来年 (らいねん, tahun depan).'),
    (18, 'vocabulary', 2, 'いまの じだいは <u>れいわ</u>です。',
        'れいわ ditulis 令和. Salah: 来年 (らいねん, tahun depan), 来ます (きます, datang), 来ない (こない, bentuk nai).'),

    -- ===== もんだい3 文脈規定 (19-30) — kata keterangan pengalaman/pendapat =====
    (19, 'vocabulary', 3, '「日本へ 行ったことが ありますか。」「いいえ、（　）ありません。」',
        'Jawabannya いちども (tidak sekali pun). はじめて, もう, まだ tidak cocok untuk menegaskan "tidak pernah sama sekali".'),
    (20, 'vocabulary', 3, 'きょう（　）すしを 食べました。これまで 食べたことが ありませんでした。',
        'Jawabannya はじめて (untuk pertama kalinya). いちども, もう, まだ tidak cocok dengan "belum pernah sampai sekarang".'),
    (21, 'vocabulary', 3, 'しゅくだいは（　）おわりました。',
        'Jawabannya もう (sudah). まだ, いちども, はじめて tidak cocok dengan "selesai".'),
    (22, 'vocabulary', 3, 'しゅくだいは（　）おわっていません。',
        'Jawabannya まだ (belum). もう, いちども, はじめて tidak cocok dengan "belum selesai".'),
    (23, 'vocabulary', 3, 'ながく まって、（　）バスが きました。',
        'Jawabannya やっと (akhirnya). もう, まだ, きっと tidak cocok dengan "setelah menunggu lama".'),
    (24, 'vocabulary', 3, 'かんじが（　）わかりません。ぜんぶ むずかしいです。',
        'Jawabannya ぜんぜん (sama sekali tidak). とても, たぶん, きっと tidak cocok dipasangkan dengan わかりません untuk penekanan total.'),
    (25, 'vocabulary', 3, 'あしたは（　）雨でしょう。',
        'Jawabannya たぶん (mungkin/kemungkinan). きっと, ぜんぜん, もちろん kurang cocok dengan でしょう (perkiraan tidak pasti).'),
    (26, 'vocabulary', 3, '「あした 来ますか。」「（　）来ます。」',
        'Jawabannya もちろん (tentu saja). たぶん, きっと, ぜひ tidak setegas もちろん untuk jawaban pasti.'),
    (27, 'vocabulary', 3, 'いつか 日本へ（　）行きたいです。',
        'Jawabannya ぜひ (sangat berharap/dengan segala cara). もちろん, たぶん, きっと tidak cocok dengan 行きたいです (keinginan kuat).'),
    (28, 'vocabulary', 3, 'あしたは（　）雨が ふります。てんきよほうで 言っていました。',
        'Jawabannya きっと (pasti, berdasarkan info kuat). たぶん, もちろん, やっぱり tidak sekuat きっと saat ada dasar ramalan cuaca.'),
    (29, 'vocabulary', 3, 'かれは（　）来ませんでした。いつも おそいですから。',
        'Jawabannya やっぱり (seperti dugaan). きっと, たぶん, もちろん tidak cocok dengan konteks "sesuai dugaan karena selalu telat".'),
    (30, 'vocabulary', 3, 'この 山は（　）大きいです。',
        'Jawabannya とても (sangat). ぜんぜん, やっと, きっと tidak cocok sebagai penguat kata sifat 大きい.'),

    -- ===== もんだい1 文の文法1 (31-50) — 5 pola grammar Bab 20 (4/4/4/4/4) =====
    -- Pola 1: 〜たことがあります (31-34)
    (31, 'grammar'::TEXT, 1, '日本へ（　）。「行ったことが あります。」',
        'Jawabannya 行ったことが あります — bentuk た + ことが あります menyatakan pengalaman pernah. 行きます, 行きました, 行っています tidak menyatakan pengalaman.'),
    (32, 'grammar', 1, 'すしを（　）。「食べたことが あります。」',
        'Jawabannya 食べたことが あります — pengalaman pernah makan. 食べます, 食べました, 食べています tidak menyatakan pengalaman.'),
    (33, 'grammar', 1, '山に（　）。「のぼったことが あります。」',
        'Jawabannya のぼったことが あります — pengalaman pernah mendaki. のぼります, のぼりました, のぼっています tidak menyatakan pengalaman.'),
    (34, 'grammar', 1, '日本語を（　）。「話したことが あります。」',
        'Jawabannya 話したことが あります — pengalaman pernah berbicara. 話します, 話しました, 話しています tidak menyatakan pengalaman.'),

    -- Pola 2: 〜たことがありません (35-38)
    (35, 'grammar', 1, 'ゆきを（　）。「見たことが ありません。」',
        'Jawabannya 見たことが ありません — belum pernah melihat sama sekali. 見ます, 見ました, 見ています tidak menyatakan pengalaman.'),
    (36, 'grammar', 1, 'この 店に（　）。「入ったことが ありません。」',
        'Jawabannya 入ったことが ありません — belum pernah masuk. 入ります, 入りました, 入っています tidak menyatakan pengalaman.'),
    (37, 'grammar', 1, '車を（　）。「うんてんしたことが ありません。」',
        'Jawabannya うんてんしたことが ありません — belum pernah menyetir. うんてんします, うんてんしました, うんてんしています tidak menyatakan pengalaman.'),
    (38, 'grammar', 1, 'すしを（　）。「食べたことが ありません。」',
        'Jawabannya 食べたことが ありません — belum pernah makan. 食べます, 食べました, 食べています tidak menyatakan pengalaman.'),

    -- Pola 3: 〜から (sebab) (39-42)
    (39, 'grammar', 1, '雨が（　）、行きません。「ふるから。」',
        'Jawabannya ふるから — から menandai SEBAB, menempel di belakang alasan. ふるが, ふるでも, ふるそして tidak tepat sebagai penanda sebab.'),
    (40, 'grammar', 1, 'あした しけんが（　）、べんきょうします。「あるから。」',
        'Jawabannya あるから — menyatakan sebab. あるが, あるでも, あるそして tidak tepat.'),
    (41, 'grammar', 1, 'この 店は（　）、よく 来ます。「安いから。」',
        'Jawabannya 安いから — menyatakan sebab. 安いが, 安いでも, 安いそして tidak tepat.'),
    (42, 'grammar', 1, 'じかんが（　）、いそぎます。「ないから。」',
        'Jawabannya ないから — menyatakan sebab. ないが, ないでも, ないそして tidak tepat.'),

    -- Pola 4: 〜が、〜 (43-46)
    (43, 'grammar', 1, '日本語は むずかしいです（　）、おもしろいです。「が。」',
        'Jawabannya が — menyambung dua kalimat berlawanan di AKHIR kalimat pertama. から, ので, と tidak menyatakan pertentangan di posisi ini.'),
    (44, 'grammar', 1, 'この 店は 高いです（　）、おいしいです。「が。」',
        'Jawabannya が — konsisten dengan pola 〜が、〜. から, ので, と tidak tepat.'),
    (45, 'grammar', 1, '雨が ふりました（　）、山へ 行きました。「が。」',
        'Jawabannya が — konsisten dengan pola 〜が、〜. から, ので, と tidak tepat.'),
    (46, 'grammar', 1, 'すしは すきです（　）、なっとうは きらいです。「が。」',
        'Jawabannya が — konsisten dengan pola 〜が、〜. から, ので, と tidak tepat.'),

    -- Pola 5: そして／それから／でも (47-50)
    (47, 'grammar', 1, 'きのう 本を 読みました。（　）、ねました。「それから。」',
        'Jawabannya それから — menyatakan urutan berikutnya (setelah itu). そして, でも, から tidak setepat それから untuk urutan kejadian.'),
    (48, 'grammar', 1, '山は 大きいです。（　）、きれいです。「そして。」',
        'Jawabannya そして — menambahkan informasi (dan juga). それから, でも, から tidak setepat そして untuk penambahan.'),
    (49, 'grammar', 1, '雨が ふりました。（　）、川へ 行きました。「でも。」',
        'Jawabannya でも — menyatakan pertentangan (tetapi). そして, それから, から tidak menyatakan pertentangan.'),
    (50, 'grammar', 1, 'すしを 食べました。（　）、うちへ かえりました。「それから。」',
        'Jawabannya それから — menyatakan urutan berikutnya. そして, でも, から tidak setepat それから untuk urutan kejadian.')
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
    (1, 0, 'らいねん', TRUE), (1, 1, 'らいげつ', FALSE), (1, 2, 'らいしゅう', FALSE), (1, 3, 'きます', FALSE),
    (2, 0, 'らいげつ', TRUE), (2, 1, 'らいねん', FALSE), (2, 2, 'らいしゅう', FALSE), (2, 3, 'きます', FALSE),
    (3, 0, 'らいしゅう', TRUE), (3, 1, 'らいねん', FALSE), (3, 2, 'らいげつ', FALSE), (3, 3, 'きます', FALSE),
    (4, 0, 'きます', TRUE), (4, 1, 'きました', FALSE), (4, 2, 'きません', FALSE), (4, 3, 'らいねん', FALSE),
    (5, 0, 'きました', TRUE), (5, 1, 'きます', FALSE), (5, 2, 'きません', FALSE), (5, 3, 'きて', FALSE),
    (6, 0, 'きません', TRUE), (6, 1, 'きます', FALSE), (6, 2, 'きました', FALSE), (6, 3, 'こない', FALSE),
    (7, 0, 'きて', TRUE), (7, 1, 'きます', FALSE), (7, 2, 'きました', FALSE), (7, 3, 'こない', FALSE),
    (8, 0, 'こない', TRUE), (8, 1, 'きます', FALSE), (8, 2, 'きて', FALSE), (8, 3, 'らいねん', FALSE),
    (9, 0, 'れいわ', TRUE), (9, 1, 'らいねん', FALSE), (9, 2, 'きます', FALSE), (9, 3, 'こない', FALSE),

    -- 表記 — opsi kanji murni (target soal hiragana)
    (10, 0, '来年', TRUE), (10, 1, '来月', FALSE), (10, 2, '来週', FALSE), (10, 3, '来ます', FALSE),
    (11, 0, '来月', TRUE), (11, 1, '来年', FALSE), (11, 2, '来週', FALSE), (11, 3, '来ます', FALSE),
    (12, 0, '来週', TRUE), (12, 1, '来年', FALSE), (12, 2, '来月', FALSE), (12, 3, '来ます', FALSE),
    (13, 0, '来ます', TRUE), (13, 1, '来ました', FALSE), (13, 2, '来ません', FALSE), (13, 3, '来て', FALSE),
    (14, 0, '来ました', TRUE), (14, 1, '来ます', FALSE), (14, 2, '来ません', FALSE), (14, 3, '来て', FALSE),
    (15, 0, '来ません', TRUE), (15, 1, '来ます', FALSE), (15, 2, '来ました', FALSE), (15, 3, '来ない', FALSE),
    (16, 0, '来て', TRUE), (16, 1, '来ます', FALSE), (16, 2, '来ました', FALSE), (16, 3, '来ない', FALSE),
    (17, 0, '来ない', TRUE), (17, 1, '来ます', FALSE), (17, 2, '来て', FALSE), (17, 3, '来年', FALSE),
    (18, 0, '令和', TRUE), (18, 1, '来年', FALSE), (18, 2, '来ます', FALSE), (18, 3, '来ない', FALSE),

    -- 文脈規定
    (19, 0, 'いちども', TRUE), (19, 1, 'はじめて', FALSE), (19, 2, 'もう', FALSE), (19, 3, 'まだ', FALSE),
    (20, 0, 'はじめて', TRUE), (20, 1, 'いちども', FALSE), (20, 2, 'もう', FALSE), (20, 3, 'まだ', FALSE),
    (21, 0, 'もう', TRUE), (21, 1, 'まだ', FALSE), (21, 2, 'いちども', FALSE), (21, 3, 'はじめて', FALSE),
    (22, 0, 'まだ', TRUE), (22, 1, 'もう', FALSE), (22, 2, 'いちども', FALSE), (22, 3, 'はじめて', FALSE),
    (23, 0, 'やっと', TRUE), (23, 1, 'もう', FALSE), (23, 2, 'まだ', FALSE), (23, 3, 'きっと', FALSE),
    (24, 0, 'ぜんぜん', TRUE), (24, 1, 'とても', FALSE), (24, 2, 'たぶん', FALSE), (24, 3, 'きっと', FALSE),
    (25, 0, 'たぶん', TRUE), (25, 1, 'きっと', FALSE), (25, 2, 'ぜんぜん', FALSE), (25, 3, 'もちろん', FALSE),
    (26, 0, 'もちろん', TRUE), (26, 1, 'たぶん', FALSE), (26, 2, 'きっと', FALSE), (26, 3, 'ぜひ', FALSE),
    (27, 0, 'ぜひ', TRUE), (27, 1, 'もちろん', FALSE), (27, 2, 'たぶん', FALSE), (27, 3, 'きっと', FALSE),
    (28, 0, 'きっと', TRUE), (28, 1, 'たぶん', FALSE), (28, 2, 'もちろん', FALSE), (28, 3, 'やっぱり', FALSE),
    (29, 0, 'やっぱり', TRUE), (29, 1, 'きっと', FALSE), (29, 2, 'たぶん', FALSE), (29, 3, 'もちろん', FALSE),
    (30, 0, 'とても', TRUE), (30, 1, 'ぜんぜん', FALSE), (30, 2, 'やっと', FALSE), (30, 3, 'きっと', FALSE),

    -- 文の文法1 — 〜たことがあります
    (31, 0, '行ったことが あります', TRUE), (31, 1, '行きます', FALSE), (31, 2, '行きました', FALSE), (31, 3, '行っています', FALSE),
    (32, 0, '食べたことが あります', TRUE), (32, 1, '食べます', FALSE), (32, 2, '食べました', FALSE), (32, 3, '食べています', FALSE),
    (33, 0, 'のぼったことが あります', TRUE), (33, 1, 'のぼります', FALSE), (33, 2, 'のぼりました', FALSE), (33, 3, 'のぼっています', FALSE),
    (34, 0, '話したことが あります', TRUE), (34, 1, '話します', FALSE), (34, 2, '話しました', FALSE), (34, 3, '話しています', FALSE),

    -- 〜たことがありません
    (35, 0, '見たことが ありません', TRUE), (35, 1, '見ます', FALSE), (35, 2, '見ました', FALSE), (35, 3, '見ています', FALSE),
    (36, 0, '入ったことが ありません', TRUE), (36, 1, '入ります', FALSE), (36, 2, '入りました', FALSE), (36, 3, '入っています', FALSE),
    (37, 0, 'うんてんしたことが ありません', TRUE), (37, 1, 'うんてんします', FALSE), (37, 2, 'うんてんしました', FALSE), (37, 3, 'うんてんしています', FALSE),
    (38, 0, '食べたことが ありません', TRUE), (38, 1, '食べます', FALSE), (38, 2, '食べました', FALSE), (38, 3, '食べています', FALSE),

    -- 〜から (sebab)
    (39, 0, 'ふるから', TRUE), (39, 1, 'ふるが', FALSE), (39, 2, 'ふるでも', FALSE), (39, 3, 'ふるそして', FALSE),
    (40, 0, 'あるから', TRUE), (40, 1, 'あるが', FALSE), (40, 2, 'あるでも', FALSE), (40, 3, 'あるそして', FALSE),
    (41, 0, '安いから', TRUE), (41, 1, '安いが', FALSE), (41, 2, '安いでも', FALSE), (41, 3, '安いそして', FALSE),
    (42, 0, 'ないから', TRUE), (42, 1, 'ないが', FALSE), (42, 2, 'ないでも', FALSE), (42, 3, 'ないそして', FALSE),

    -- 〜が、〜
    (43, 0, 'が', TRUE), (43, 1, 'から', FALSE), (43, 2, 'ので', FALSE), (43, 3, 'と', FALSE),
    (44, 0, 'が', TRUE), (44, 1, 'から', FALSE), (44, 2, 'ので', FALSE), (44, 3, 'と', FALSE),
    (45, 0, 'が', TRUE), (45, 1, 'から', FALSE), (45, 2, 'ので', FALSE), (45, 3, 'と', FALSE),
    (46, 0, 'が', TRUE), (46, 1, 'から', FALSE), (46, 2, 'ので', FALSE), (46, 3, 'と', FALSE),

    -- そして／それから／でも
    (47, 0, 'それから', TRUE), (47, 1, 'そして', FALSE), (47, 2, 'でも', FALSE), (47, 3, 'から', FALSE),
    (48, 0, 'そして', TRUE), (48, 1, 'それから', FALSE), (48, 2, 'でも', FALSE), (48, 3, 'から', FALSE),
    (49, 0, 'でも', TRUE), (49, 1, 'そして', FALSE), (49, 2, 'それから', FALSE), (49, 3, 'から', FALSE),
    (50, 0, 'それから', TRUE), (50, 1, 'そして', FALSE), (50, 2, 'でも', FALSE), (50, 3, 'から', FALSE)
  )
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT qq.id, o.option_text, o.ok, o.ord
    FROM o
    JOIN quiz_questions qq
      ON qq.lesson_id = v_lesson_id AND qq.sort_order = o.qno;

  -- ===== Assertion bentuk =====
  IF (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id) <> 50 THEN
    RAISE EXCEPTION '110: jumlah soal bukan 50 (dapat %)',
      (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
      LEFT JOIN quiz_options qo ON qo.question_id = qq.id
     WHERE qq.lesson_id = v_lesson_id
     GROUP BY qq.id
    HAVING COUNT(qo.id) <> 4 OR COUNT(*) FILTER (WHERE qo.is_correct) <> 1
  ) THEN
    RAISE EXCEPTION '110: ada soal yang opsinya bukan 4 atau kuncinya bukan tepat 1';
  END IF;

  -- ===== Pagar level =====

  -- 1. Badan kalimat (di LUAR target <u>…</u>) hanya boleh memakai kanji
  --    taught: 62 kanji Bab 3-9 + 見読書 (Bab 10) + 週毎 (Bab 11) + 食飲
  --    (Bab 12) + 立休入出 (Bab 14) + 言話聞買店会社 (Bab 15) +
  --    日火水木金土 (Bab 16) + 子父母友手足口目耳 (Bab 17) + 大小多少
  --    (Bab 18) + 雨天空山川 (Bab 19) + 来令 (Bab 20) — SAMA PERSIS
  --    dengan v_kanji_ok di 089_bunpou_bab20.sql. もんだい3 tidak memakai
  --    <u>, jadi SELURUH kolom question-nya kena pagar ini juga.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND regexp_replace(
             regexp_replace(question, '<u>[^<]*</u>', '', 'g'),
             '[先何語校国生学名人魚本花八三十九一五四二六七安高古新白長男女気下前外間右中左後上時分円百千万年月半歳午車東道駅行西電北南見読書週毎食飲立休入出言話聞買店会社日火水木金土子父母友手足口目耳大小多少雨天空山川来令]', '', 'g'
           ) ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '110: ada kanji di luar daftar taught pada badan kalimat soal';
  END IF;

  -- 2. Partikel: TIDAK ADA ASSERTION UMUM (dihapus sejak 059) — から
  --    sebagai penanda sebab justru topik utama もんだい1 文の文法1,
  --    diuji manual di atas.
  -- 3. Kata kerja: TIDAK ADA ASSERTION (もんだい1/2 fokus pada 2 cara
  --    baca 来, bukan pola kata kerja umum — tidak relevan).

  -- 4. Rantai の dalam satu kalimat.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '110: ada kalimat dengan rantai の (lebih dari satu の dalam satu kalimat)';
  END IF;

  -- 5. Target section: もんだい1 wajib kanji di dalam <u>, もんだい2 wajib kana.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 1
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '') !~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '110: ada soal 漢字読み yang target <u> nya tidak mengandung kanji';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'vocabulary' AND section_number = 2
       AND COALESCE((regexp_match(question, '<u>([^<]*)</u>'))[1], '一') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '110: ada soal 表記 yang target <u> nya sudah berupa kanji';
  END IF;

  -- 6. DEDUP WAJIB — target <u> tidak boleh sama dengan salah satu dari
  --    303 target unik yang sudah dipakai di 039-109 (di-grep ulang penuh
  --    dari file migrasi sungguhan, dibersihkan dari baris komentar
  --    palsu — lihat catatan header di atas).
  IF EXISTS (
    SELECT 1 FROM quiz_questions qq,
      LATERAL (SELECT (regexp_match(qq.question, '<u>([^<]*)</u>'))[1] AS tgt) t
     WHERE qq.lesson_id = v_lesson_id
       AND t.tgt = ANY (ARRAY[
         'あいます','あし','あめ','あめのひ','いいます','いきました','いちばんおおきい','いちばん大きい','いって','いんど',
         'えきでまっています','えきまえ','おおい','おおかった','おおきい','おおきかった','おみせ','お店','かいしゃ','かいて',
         'かいます','かきます','かようび','かわ','かわのみず','がいこく','がくせい','がっこう','ききます','きゅうにん',
         'きゅうひゃくえん','きんようび','くじかん','くち','くに','くるまをつかってもいいですか','くるまをもっています','げつようび',
         'こくどう','こども','ごご','ごじ','ごじゅうにん','ごせんえん','ごぜん','ごぜんちゅう','ごにん','ごねんせい',
         'ごひゃくえん','ごほん','さかな','さゆう','さんにん','さんねんせい','しゃどう','じかん','じゅうごふん','じゅうにじ',
         'じゅうにん','じゅっぽん','じょうげ','すいようび','すくない','すくなかった','せんえん','せんげつ','せんせい',
         'せんにん','ぜんご','そら','たい','たたない','たつ','たべて','たべもの','ちいさい','ちいさかった','ちち',
         'ちゅうかん','ちゅうがくせい','ちゅうねん','て','てんき','でた','でない','でる','でんしゃにのっています',
         'でんしゃにのってください','でんわ','とうざい','ともだち','どようび','ななひゃくえん','なに','なんがつなんにち','なんじ',
         'なんせい','なんとう','なんねん','なんぼく','にじゅうにん','にせんえん','にちようび','にねんせい','にひゃくえん',
         'にほん','のみました','のんで','はいらない','はいる','はちじ','はちにん','はな','はながさいています','はなします',
         'はなをとってはいけません','はは','はん','はんとし','はんぶん','ひと','ひゃくにん','べとなむ','ほくせい','ほくとう',
         'ほん','まいにち','まんえん','みせのひと','みちをあるいています','みちをあるいてください','みて','みました','みみ',
         'め','もくようび','やすまない','やすむ','やま','やまのうえ','よにん','よねんせい','よみました','よんじゅうにん',
         'よんで','よんほん','ろくがつみっか','ろくにん','一人','一分','一年','一時','一本','七人','七分','三十人',
         '三十分','三時','三本','三百円','上','下','中','中国','九時','二人','二十歳','二時','二百人','人',
         '人気','人間','休まない','休む','会います','会社','何人','何年生','何月何日','何本','先生','先週','入らない',
         '入る','八時半','八百円','六分','六年生','六時','六月三日','六本','六百円','出た','出ない','出る','前',
         '北','十分','十時','南','友だち','口','古い','右','名前','四時','国','土ようび','外','多い','多かった',
         '大きい','大きかった','大学','大学生','天気','女','女の人','子ども','学校','学生','安い','小さい',
         '小さかった','少ない','少なかった','山','山の上','川','川の水','左','店の人','後ろ','手','新しい','日ようび',
         '日本','日本人','日本語','書いて','書きました','月ようび','木ようび','本','東','母','毎月','毎週','気分',
         '水ようび','火ようび','父','男','男の人','男女','留学生','白い','目','空','立たない','立つ','耳',
         '聞きます','花','花がさいています','花をとってはいけません','行','行って','西','見て','見てから','見ません',
         '言います','話します','読みます','読んで','買います','足','車','車をつかってもいいですか','車をもっています','道',
         '道をあるいています','道をあるいてください','金ようび','長い','雨','雨の日','電話','電車','電車にのっています',
         '電車にのってください','韓国人','食べて','食べてから','飲んで','飲んでから','駅','駅でまっています','高い','高校',
         '高校生','魚'
       ])
  ) THEN
    RAISE EXCEPTION '110: ada target <u> yang sudah pernah diujikan di migration 039-109';
  END IF;

  RAISE NOTICE '110: selesai — 50 soal (vocabulary 30, grammar 20), semua pagar level + dedup lolos. BAB PENUTUP N5 (seri Assignment Bab 12-20 lengkap).';
END $$;
