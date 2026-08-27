-- 117_assignment_bab18_dokkai_listening.sql — Tambah もんだい4 Dokkai +
-- もんだい5 Listening ke Assignment Bab 18 (migration 108).
--
-- Bagian ketujuh dari seri 111-119. Lihat 111_assignment_bab12_dokkai_
-- listening.sql untuk penjelasan pola lengkap: EXTEND lesson existing,
-- DELETE hanya menyasar question_category IN ('reading','listening'),
-- assertion kanji whitelist + rantai-の diperluas ke `passage`/`audio_script`,
-- format audio_script wajib "SPEAKER: teks" (N/A/B), questions_per_attempt
-- di-update ke total baru.
--
-- GRAMMAR SCOPE Bab 18 (087_bunpou_bab18.sql): AはBより〜です／
-- AよりBのほうが〜／AとBとどちらが〜／〜の中で〜がいちばん〜. Kanji
-- whitelist = whitelist Bab 12-17 (93 char) UNION 4 kanji baru Bab 18
-- (大小多少) — identik dengan v_kanji_ok di
-- 108_assignment_bab18_perbandingan.sql. 番 (dalam いちばん) TIDAK
-- diajarkan — selalu kana penuh.
--
-- JEBAKAN の-CHAIN TERBESAR SEJAUH INI ada di bab perbandingan (lihat
-- catatan panjang di 108: この+あの yang digabung, kata "X-mono" seperti
-- くだもの/のりもの, dll). Migrasi ini MENGHINDARI TOTAL この/あの/その —
-- semua perbandingan pakai nama toko/benda konkret (さくらや／やまだや／
-- ひまわりや, りんご／みかん／バナナ, 車／電車) alih-alih demonstrativa,
-- dan tidak ada kata "X-mono" sama sekali. Larangan eksplisit ini
-- ditambahkan ke prompt drafting dan berhasil — draft pertama bersih
-- tanpa satu pun revisi rantai-の, padahal bab ini yang paling rawan.
--
-- SENGAJA TIDAK memakai でも／そして／それから／〜が、〜 (Bab 20) — bersih
-- tanpa revisi (keempat kalinya berturut-turut). Juga dihindari total:
-- たいです/ほしい/つもり/予定/ましょう/ませんか/たことがあります (Bab
-- 19-20).
--
-- Listening pakai nama (ミナさん／たなかさん／おかださん／やまださん),
-- melanjutkan pola 111-116.
--
-- Idempotent: DELETE hanya menyasar question_category IN ('reading',
-- 'listening') milik lesson ini; lesson di-resolve via slug yang sama
-- dengan 108 (tidak insert lesson baru).

DO $$
DECLARE
  v_course_slug  TEXT := 'n5';
  v_lesson_slug  TEXT := 'assignment-bab-18-perbandingan';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson_id    UUID;
  v_old_total    INT;
  v_kanji_ok     TEXT := '先何語校国生学名人魚本花八三十九一五四二六七安高古新白長男女気下前外間右中左後上時分円百千万年月半歳午車東道駅行西電北南見読書週毎食飲立休入出言話聞買店会社日火水木金土子父母友手足口目耳大小多少';
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 17 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '117: modul Bab 18 di kursus % tidak ditemukan — skip.', v_course_slug;
    RETURN;
  END IF;

  SELECT id INTO v_lesson_id FROM lessons
   WHERE module_id = v_module_id AND slug = v_lesson_slug;

  IF v_lesson_id IS NULL THEN
    RAISE NOTICE '117: lesson "%" belum ada (migration 108 belum jalan?) — skip.', v_lesson_slug;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_old_total FROM quiz_questions WHERE lesson_id = v_lesson_id;
  RAISE NOTICE '117: menambah もんだい4/5 ke Assignment Bab 18 ("%", sudah ada % soal).', v_module_title, v_old_total;

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
        'いちばん 大きい パンやは どれですか。',
        E'うちの そばに パンやが 三つ あります。さくらやは やまだやより 大きいです。ひまわりやは いちばん 小さいです。さくらやより ひまわりやの ほうが 少し 安いです。パンやの 中で ひまわりやが いちばん 人が 多いです。',
        NULL,
        '「さくらやは やまだやより 大きいです」dan「ひまわりやは いちばん 小さいです」— urutan besarnya: さくらや ＞ やまだや ＞ ひまわりや.'),
    (52, 'reading', 1,
        'さくらやと ひまわりやと どちらが 安いですか。',
        E'うちの そばに パンやが 三つ あります。さくらやは やまだやより 大きいです。ひまわりやは いちばん 小さいです。さくらやより ひまわりやの ほうが 少し 安いです。パンやの 中で ひまわりやが いちばん 人が 多いです。',
        NULL,
        '「さくらやより ひまわりやの ほうが 少し 安いです」— dibandingkan さくらや, ひまわりや yang lebih murah.'),
    (53, 'reading', 1,
        '人が いちばん 多い 店は どこですか。',
        E'うちの そばに パンやが 三つ あります。さくらやは やまだやより 大きいです。ひまわりやは いちばん 小さいです。さくらやより ひまわりやの ほうが 少し 安いです。パンやの 中で ひまわりやが いちばん 人が 多いです。',
        NULL,
        '「パンやの 中で ひまわりやが いちばん 人が 多いです」— toko paling kecil justru paling ramai pengunjung, jawaban tidak bisa ditebak dari ukuran toko.'),

    -- ===== もんだい5 聴解 (54-57) — 4 dialog independen =====
    (54, 'listening'::TEXT, 1,
        'ミナさんは どの かばんを 買いますか。',
        NULL,
        E'N: 店で ミナさんと たなかさんが 話しています。\nA: 大きい かばんと 小さい かばんと どちらが 安いですか。\nB: 小さい かばんの ほうが 安いです。大きい かばんは 五千円です。\nA: そうですか。安い ほうを 買います。',
        'たなかさんが「小さい かばんの ほうが 安いです」と言い、ミナさんは「安い ほうを 買います」— jadi tas kecil yang dibeli.'),
    (55, 'listening', 1,
        'やまださんは 何で 駅へ 行きますか。',
        NULL,
        E'N: うちで やまださんと おかださんが 話しています。\nA: 駅まで 車と 電車と どちらが はやいですか。\nB: 車より 電車の ほうが はやいです。車は 時間が かかります。\nA: じゃ、はやい ほうで 行きます。',
        '「車より 電車の ほうが はやいです」lalu「はやい ほうで 行きます」— jadi naik kereta.'),
    (56, 'listening', 1,
        'ミナさんは 何と 言いますか。',
        NULL,
        E'N: 学校で たなかさんが ミナさんに 話しています。\nA: ミナさんは 先週より げんきですね。',
        'Komentar「先週より げんきですね」dijawab dengan alasan yang sejalan: istirahatnya lebih banyak daripada minggu lalu.'),
    (57, 'listening', 1,
        'おかださんは 何を 買いますか。',
        NULL,
        E'N: 店で おかださんと 店の 人が 話しています。\nA: りんごと みかんと バナナは いくらですか。\nB: りんごは 百五十円、みかんは 八十円、バナナは 二百円です。\nA: みかんは りんごより 安いですね。いちばん 安いのを 三つ ください。',
        'Harga: りんご百五十円／みかん八十円／バナナ二百円. おかださんは「いちばん 安いのを」minta — yang termurah adalah みかん.')
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
    (51, 0, 'さくらや', TRUE), (51, 1, 'やまだや', FALSE), (51, 2, 'ひまわりや', FALSE), (51, 3, 'ぜんぶ おなじです', FALSE),
    (52, 0, 'ひまわりや', TRUE), (52, 1, 'さくらや', FALSE), (52, 2, 'やまだや', FALSE), (52, 3, 'ぜんぶ おなじです', FALSE),
    (53, 0, 'ひまわりや', TRUE), (53, 1, 'さくらや', FALSE), (53, 2, 'やまだや', FALSE), (53, 3, 'ぜんぶ おなじです', FALSE),

    (54, 0, '小さい かばん', TRUE), (54, 1, '大きい かばん', FALSE), (54, 2, '白い かばん', FALSE), (54, 3, 'かばんを 買いません', FALSE),
    (55, 0, '電車', TRUE), (55, 1, '車', FALSE), (55, 2, 'バス', FALSE), (55, 3, 'じてんしゃ', FALSE),
    (56, 0, 'はい、先週より 休みが 多かったです。', TRUE), (56, 1, 'いいえ、かばんは 小さいです。', FALSE), (56, 2, 'はい、学校へ 行きます。', FALSE), (56, 3, 'いいえ、水を 飲みます。', FALSE),
    (57, 0, 'みかん', TRUE), (57, 1, 'りんご', FALSE), (57, 2, 'バナナ', FALSE), (57, 3, 'ぜんぶ', FALSE)
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
    RAISE EXCEPTION '117: total soal lesson bukan 57 (dapat %)',
      (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id);
  END IF;

  IF (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id AND question_category = 'reading') <> 3
     OR (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id AND question_category = 'listening') <> 4 THEN
    RAISE EXCEPTION '117: jumlah soal reading/listening baru tidak sesuai (harap 3/4)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
      LEFT JOIN quiz_options qo ON qo.question_id = qq.id
     WHERE qq.lesson_id = v_lesson_id
     GROUP BY qq.id
    HAVING COUNT(qo.id) <> 4 OR COUNT(*) FILTER (WHERE qo.is_correct) <> 1
  ) THEN
    RAISE EXCEPTION '117: ada soal yang opsinya bukan 4 atau kuncinya bukan tepat 1';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND regexp_replace(regexp_replace(question, '<u>[^<]*</u>', '', 'g'),
             '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '117: ada kanji di luar daftar taught pada question';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND passage IS NOT NULL
       AND regexp_replace(passage, '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '117: ada kanji di luar daftar taught pada passage';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND audio_script IS NOT NULL
       AND regexp_replace(audio_script, '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '117: ada kanji di luar daftar taught pada audio_script';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '117: ada rantai の pada question';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND passage IS NOT NULL AND passage ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '117: ada rantai の pada passage';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND audio_script IS NOT NULL AND audio_script ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '117: ada rantai の pada audio_script';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
     WHERE qq.lesson_id = v_lesson_id AND qq.audio_script IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM unnest(string_to_array(qq.audio_script, E'\n')) AS line
          WHERE line !~ '^(N|A|B):\s*\S'
       )
  ) THEN
    RAISE EXCEPTION '117: ada baris audio_script yang tidak berformat "N/A/B: teks"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'reading' AND (passage IS NULL OR passage = '')
  ) THEN
    RAISE EXCEPTION '117: ada soal reading tanpa passage';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'listening' AND (audio_script IS NULL OR audio_script = '')
  ) THEN
    RAISE EXCEPTION '117: ada soal listening tanpa audio_script';
  END IF;

  RAISE NOTICE '117: selesai — Assignment Bab 18 sekarang 57 soal (vocabulary 30, grammar 20, reading 3, listening 4). questions_per_attempt di-update ke 57.';
END $$;
