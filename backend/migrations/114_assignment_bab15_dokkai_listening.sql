-- 114_assignment_bab15_dokkai_listening.sql — Tambah もんだい4 Dokkai +
-- もんだい5 Listening ke Assignment Bab 15 (migration 105).
--
-- Bagian keempat dari seri 111-119. Lihat 111_assignment_bab12_dokkai_
-- listening.sql untuk penjelasan pola lengkap: EXTEND lesson existing,
-- DELETE hanya menyasar question_category IN ('reading','listening'),
-- assertion kanji whitelist + rantai-の diperluas ke `passage`/`audio_script`,
-- format audio_script wajib "SPEAKER: teks" (N/A/B), questions_per_attempt
-- di-update ke total baru.
--
-- GRAMMAR SCOPE Bab 15 (084_bunpou_bab15.sql): 〜を[counter]お願いします
-- (memesan), 〜はいかがですか (menawarkan), 〜になります (keigo total/hasil),
-- お〜ください (permintaan hormat), 〜にします (memutuskan pilihan),
-- 〜くなります／〜になります (perubahan). Konteks toko/restoran. Kanji
-- whitelist = whitelist Bab 12-14 (72 char) UNION 7 kanji baru Bab 15
-- (言話聞買店会社) — identik dengan v_kanji_ok di
-- 105_assignment_bab15_pelayanan_perubahan.sql. 願 (dalam おねがいします)
-- TIDAK di whitelist — selalu ditulis kana, sama seperti 105.
--
-- SENGAJA TIDAK memakai: penghubung そして／それから／でも dan
-- pertentangan 〜が、〜 (direservasi Bab 20) — kali ini di-larang eksplisit
-- di prompt subagent dan dikonfirmasi bersih tanpa perlu revisi manual
-- (beda dari migration 113 yang sempat kebobolan「でも」). Juga dihindari:
-- causal から (〜からdesu/masu, direservasi Bab 20) dan seluruh grammar
-- Bab 16-20 (曜日, 好き/上手/できます, perbandingan, たいです/ほしい/つもり,
-- たことがあります, dst).
--
-- Listening pakai nama (ミナさん／たなかさん／おかださん／やまださん),
-- melanjutkan pola 111-113.
--
-- Idempotent: DELETE hanya menyasar question_category IN ('reading',
-- 'listening') milik lesson ini; lesson di-resolve via slug yang sama
-- dengan 105 (tidak insert lesson baru).

DO $$
DECLARE
  v_course_slug  TEXT := 'n5';
  v_lesson_slug  TEXT := 'assignment-bab-15-pelayanan-perubahan';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson_id    UUID;
  v_old_total    INT;
  v_kanji_ok     TEXT := '先何語校国生学名人魚本花八三十九一五四二六七安高古新白長男女気下前外間右中左後上時分円百千万年月半歳午車東道駅行西電北南見読書週毎食飲立休入出言話聞買店会社';
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 14 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '114: modul Bab 15 di kursus % tidak ditemukan — skip.', v_course_slug;
    RETURN;
  END IF;

  SELECT id INTO v_lesson_id FROM lessons
   WHERE module_id = v_module_id AND slug = v_lesson_slug;

  IF v_lesson_id IS NULL THEN
    RAISE NOTICE '114: lesson "%" belum ada (migration 105 belum jalan?) — skip.', v_lesson_slug;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_old_total FROM quiz_questions WHERE lesson_id = v_lesson_id;
  RAISE NOTICE '114: menambah もんだい4/5 ke Assignment Bab 15 ("%", sudah ada % soal).', v_module_title, v_old_total;

  DELETE FROM quiz_questions
   WHERE lesson_id = v_lesson_id AND question_category IN ('reading', 'listening');

  WITH sect(cat, num, label, instruction) AS (VALUES
    ('reading'::TEXT, 1, 'もんだい4 読解 (短文)',
        'Bacalah teks berikut, lalu jawab pertanyaannya. Pilih satu jawaban yang paling tepat dari nomor 1-4.'),
    ('listening', 1, 'もんだい5 聴解',
        'Dengarkan percakapannya, lalu jawab pertanyaannya. Pilih satu jawaban yang paling tepat dari nomor 1-4.')
  ), q(no, cat, sect_num, question, passage, audio_script, explanation) AS (VALUES
    -- ===== もんだい4 読解 (51-53) — 1 passage, 3 soal =====
    (51, 'reading'::TEXT, 1,
        'ミナさんは いつ 店に 入りましたか。',
        E'ミナさんは 学校の 後で 店に 入りました。ミナさんは 「コーヒーを 二つ おねがいします。」と 言いました。店の 人は 「ケーキは いかがですか。」と 聞きました。ミナさんは チーズケーキに しました。店の 人は 「ぜんぶで 千五百円に なります。すこし おまちください。」と 言いました。',
        NULL,
        'Kalimat pertama menyebut 「学校の 後で 店に 入りました」 — Mina ke toko SETELAH sekolah, bukan sebelumnya.'),
    (52, 'reading', 1,
        'ミナさんは 何に しましたか。',
        E'ミナさんは 学校の 後で 店に 入りました。ミナさんは 「コーヒーを 二つ おねがいします。」と 言いました。店の 人は 「ケーキは いかがですか。」と 聞きました。ミナさんは チーズケーキに しました。店の 人は 「ぜんぶで 千五百円に なります。すこし おまちください。」と 言いました。',
        NULL,
        'Pegawai menawarkan kue dengan 「ケーキは いかがですか」, lalu Mina memutuskan dengan pola 〜にします: 「チーズケーキに しました」.'),
    (53, 'reading', 1,
        'ぜんぶで いくらに なりましたか。',
        E'ミナさんは 学校の 後で 店に 入りました。ミナさんは 「コーヒーを 二つ おねがいします。」と 言いました。店の 人は 「ケーキは いかがですか。」と 聞きました。ミナさんは チーズケーキに しました。店の 人は 「ぜんぶで 千五百円に なります。すこし おまちください。」と 言いました。',
        NULL,
        'Pegawai menyebut total dengan pola keigo 〜になります: 「ぜんぶで 千五百円に なります」.'),

    -- ===== もんだい5 聴解 (54-57) — 4 dialog independen =====
    (54, 'listening'::TEXT, 1,
        'ミナさんは 何を ちゅうもんしましたか。',
        NULL,
        E'N: 店で 店の 人と ミナさんが 話しています。\nA: いらっしゃいませ。コーヒーは いかがですか。\nB: すみません、こうちゃに します。ケーキも 一つ おねがいします。\nA: はい。ぜんぶで 八百円に なります。',
        'Pegawai MENAWARKAN kopi, tetapi Mina memilih teh dengan pola 〜にします: 「こうちゃに します」. Ia juga memesan satu kue.'),
    (55, 'listening', 1,
        'たなかさんは ぜんぶで いくら はらいますか。',
        NULL,
        E'N: 店で たなかさんと 店の 人が 話しています。\nA: この 本を 二さつ おねがいします。\nB: 一さつ 五百円です。ぜんぶで 千円に なります。\nA: こちらの ペンも おねがいします。\nB: ペンは 百円です。ぜんぶで 千百円に なります。',
        '二冊×五百円=千円, lalu ditambah pena 百円, sehingga total AKHIR「千百円に なります」. 千円 adalah total SEMENTARA sebelum pena ditambahkan.'),
    (56, 'listening', 1,
        'ミナさんは 何を 書きますか。',
        NULL,
        E'N: 店で やまださんが ミナさんに 言います。\nA: おきゃくさま、こちらの かみに お名前と 電話ばんごうを お書きください。\nB: はい、わかりました。',
        'Pegawai memakai pola hormat お〜ください untuk mempersilakan menulis DUA hal: 「お名前と 電話ばんごうを お書きください」.'),
    (57, 'listening', 1,
        'おかださんは あした いくらで セーターを 買いますか。',
        NULL,
        E'N: 店で おかださんと 店の 人が 話しています。\nA: すみません、この セーターは いくらですか。\nB: 五千円です。あしたから やすく なります。三千円に なりますよ。\nA: そうですか。じゃあ、あした また きます。',
        'Harga hari ini 五千円, tetapi mulai besok 「やすく なります」 menjadi 「三千円に なります」. Okada membeli besok, jadi membayar 三千円.')
  )
  INSERT INTO quiz_questions (
    lesson_id, question, question_type, question_category,
    section_number, section_label, section_instruction,
    passage, audio_script, explanation, sort_order
  )
  SELECT v_lesson_id, q.question, 'multiple_choice', q.cat,
         s.num, s.label, s.instruction, q.passage, q.audio_script, q.explanation, q.no
    FROM q JOIN sect s ON s.cat = q.cat AND s.num = q.sect_num;

  WITH o(qno, ord, option_text, ok) AS (VALUES
    (51, 0, '学校の 後で', TRUE), (51, 1, '学校の 前に', FALSE), (51, 2, '会社の 後で', FALSE), (51, 3, 'しごとの 後で', FALSE),
    (52, 0, 'チーズケーキ', TRUE), (52, 1, 'アイスクリーム', FALSE), (52, 2, 'サンドイッチ', FALSE), (52, 3, 'おみやげ', FALSE),
    (53, 0, '千五百円', TRUE), (53, 1, '五百円', FALSE), (53, 2, '千円', FALSE), (53, 3, '一万円', FALSE),

    (54, 0, 'こうちゃと ケーキ', TRUE), (54, 1, 'コーヒーと ケーキ', FALSE), (54, 2, 'こうちゃと アイスクリーム', FALSE), (54, 3, 'コーヒーだけ', FALSE),
    (55, 0, '千百円', TRUE), (55, 1, '五百円', FALSE), (55, 2, '千円', FALSE), (55, 3, '千五百円', FALSE),
    (56, 0, '名前と 電話ばんごう', TRUE), (56, 1, '名前だけ', FALSE), (56, 2, '電話ばんごうだけ', FALSE), (56, 3, '会社の 名前', FALSE),
    (57, 0, '三千円', TRUE), (57, 1, '五千円', FALSE), (57, 2, '二千円', FALSE), (57, 3, '八千円', FALSE)
  )
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT qq.id, o.option_text, o.ok, o.ord
    FROM o
    JOIN quiz_questions qq
      ON qq.lesson_id = v_lesson_id AND qq.sort_order = o.qno;

  UPDATE lessons
     SET questions_per_attempt = (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id),
         content = content || ' Ditambah もんだい4 読解 (1 bacaan, 3 soal) dan もんだい5 聴解 (4 dialog, 4 soal).',
         updated_at = NOW()
   WHERE id = v_lesson_id;

  -- ===== Assertion bentuk (mencakup SEMUA soal lesson, lama + baru) =====
  IF (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id) <> 57 THEN
    RAISE EXCEPTION '114: total soal lesson bukan 57 (dapat %)',
      (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id);
  END IF;

  IF (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id AND question_category = 'reading') <> 3
     OR (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id AND question_category = 'listening') <> 4 THEN
    RAISE EXCEPTION '114: jumlah soal reading/listening baru tidak sesuai (harap 3/4)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
      LEFT JOIN quiz_options qo ON qo.question_id = qq.id
     WHERE qq.lesson_id = v_lesson_id
     GROUP BY qq.id
    HAVING COUNT(qo.id) <> 4 OR COUNT(*) FILTER (WHERE qo.is_correct) <> 1
  ) THEN
    RAISE EXCEPTION '114: ada soal yang opsinya bukan 4 atau kuncinya bukan tepat 1';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND regexp_replace(regexp_replace(question, '<u>[^<]*</u>', '', 'g'),
             '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '114: ada kanji di luar daftar taught pada question';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND passage IS NOT NULL
       AND regexp_replace(passage, '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '114: ada kanji di luar daftar taught pada passage';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND audio_script IS NOT NULL
       AND regexp_replace(audio_script, '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '114: ada kanji di luar daftar taught pada audio_script';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '114: ada rantai の pada question';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND passage IS NOT NULL AND passage ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '114: ada rantai の pada passage';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND audio_script IS NOT NULL AND audio_script ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '114: ada rantai の pada audio_script';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
     WHERE qq.lesson_id = v_lesson_id AND qq.audio_script IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM unnest(string_to_array(qq.audio_script, E'\n')) AS line
          WHERE line !~ '^(N|A|B):\s*\S'
       )
  ) THEN
    RAISE EXCEPTION '114: ada baris audio_script yang tidak berformat "N/A/B: teks"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'reading' AND (passage IS NULL OR passage = '')
  ) THEN
    RAISE EXCEPTION '114: ada soal reading tanpa passage';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'listening' AND (audio_script IS NULL OR audio_script = '')
  ) THEN
    RAISE EXCEPTION '114: ada soal listening tanpa audio_script';
  END IF;

  RAISE NOTICE '114: selesai — Assignment Bab 15 sekarang 57 soal (vocabulary 30, grammar 20, reading 3, listening 4). questions_per_attempt di-update ke 57.';
END $$;
