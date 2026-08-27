-- 112_assignment_bab13_dokkai_listening.sql — Tambah もんだい4 Dokkai +
-- もんだい5 Listening ke Assignment Bab 13 (migration 104).
--
-- Bagian kedua dari seri 111-119 yang menambah dokkai (読解) + listening
-- (聴解) ke Assignment Bab 12-20 yang sudah live. Lihat
-- 111_assignment_bab12_dokkai_listening.sql untuk penjelasan lengkap pola
-- yang dipakai berulang di semua bab: EXTEND lesson existing (bukan lesson
-- baru), DELETE hanya menyasar question_category IN ('reading','listening')
-- supaya 50 soal vocabulary/grammar lama tidak ikut terhapus, assertion
-- kanji whitelist + rantai-の diperluas ke kolom `passage`/`audio_script`
-- (bukan cuma `question`), format audio_script wajib "SPEAKER: teks" dengan
-- SPEAKER cuma N/A/B, questions_per_attempt di-update ke total baru.
--
-- GRAMMAR SCOPE Bab 13 (dari 082_bunpou_bab13.sql): 〜ています／てください／
-- てくれませんか／てもいいですか／てはいけません. Bab 13 TIDAK memperkenalkan
-- kanji baru (dikonfirmasi 082/104), jadi whitelist SAMA PERSIS dengan
-- Bab 12 (100/111) — 68 karakter. Konten sengaja TIDAK memakai nai-form,
-- bentuk plain, たことがあります, ましょう／ませんか, atau penghubung
-- そして／それから／でも／〜が、 — semua itu baru Bab 14+, supaya tidak
-- bocor materi bab depan (analog larangan てください/ています di 111 untuk
-- Bab 12).
--
-- Melanjutkan mitigasi jebakan の-chain dari 111 (narator "男の人と女の人が
--話しています" adalah 2 の): dialog di sini pakai nama yang SAMA dengan
-- 111 untuk kontinuitas (ミナさん／たなかさん) plus satu nama baru
-- (おかださん). Perlu extra hati-hati: この/あの/その secara individual
-- masing-masing MENGANDUNG satu karakter の (こ-の, dieja hiragana) — aman
-- dipakai SEKALI per kalimat (何 kalimat di sini pakai この), tapi kalau
-- digabung dengan の lain (posesif, atau この+あono di kalimat yang sama)
-- akan kena regex yang sama. Semua kalimat di file ini sudah dicek manual:
-- maksimum 1 の per kalimat (。-delimited), termasuk yang dari この/駅の/
-- 学校の/もとの.
--
-- Idempotent: DELETE hanya menyasar question_category IN ('reading',
-- 'listening') milik lesson ini; lesson di-resolve via slug yang sama
-- dengan 104 (tidak insert lesson baru).

DO $$
DECLARE
  v_course_slug  TEXT := 'n5';
  v_lesson_slug  TEXT := 'assignment-bab-13-progresif-permintaan-izin';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson_id    UUID;
  v_old_total    INT;
  v_kanji_ok     TEXT := '先何語校国生学名人魚本花八三十九一五四二六七安高古新白長男女気下前外間右中左後上時分円百千万年月半歳午車東道駅行西電北南見読書週毎食飲';
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 12 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '112: modul Bab 13 di kursus % tidak ditemukan — skip.', v_course_slug;
    RETURN;
  END IF;

  SELECT id INTO v_lesson_id FROM lessons
   WHERE module_id = v_module_id AND slug = v_lesson_slug;

  IF v_lesson_id IS NULL THEN
    RAISE NOTICE '112: lesson "%" belum ada (migration 104 belum jalan?) — skip.', v_lesson_slug;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_old_total FROM quiz_questions WHERE lesson_id = v_lesson_id;
  RAISE NOTICE '112: menambah もんだい4/5 ke Assignment Bab 13 ("%", sudah ada % soal).', v_module_title, v_old_total;

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
        'ミナさんは としょかんで 何を していますか。',
        E'ミナさんは 学校の としょかんで 本を 読んでいます。としょかんでは、しずかに してください。ここで おちゃを 飲んでも いいです。ケーキと パンを 食べては いけません。本を 読んでから、もとの ところに もどしてください。',
        NULL,
        'Kalimat pertama「ミナさんは 学校の としょかんで 本を 読んでいます」 = Mina sedang membaca buku. Pola 〜ています menyatakan aksi yang sedang berlangsung.'),
    (52, 'reading', 1,
        'としょかんでは、何を しては いけませんか。',
        E'ミナさんは 学校の としょかんで 本を 読んでいます。としょかんでは、しずかに してください。ここで おちゃを 飲んでも いいです。ケーキと パンを 食べては いけません。本を 読んでから、もとの ところに もどしてください。',
        NULL,
        'Bacaan menyebut 「ケーキと パンを 食べては いけません」. Minum teh justru DIBOLEHKAN (飲んでも いいです), membaca adalah kegiatan Mina, dan bersikap tenang malah diperintahkan (してください).'),
    (53, 'reading', 1,
        '本を 読んでから、どう しますか。',
        E'ミナさんは 学校の としょかんで 本を 読んでいます。としょかんでは、しずかに してください。ここで おちゃを 飲んでも いいです。ケーキと パンを 食べては いけません。本を 読んでから、もとの ところに もどしてください。',
        NULL,
        '「本を 読んでから、もとの ところに もどしてください」 = setelah membaca, kembalikan ke tempat semula. 〜てから menandai urutan.'),

    -- ===== もんだい5 聴解 (54-57) — 4 dialog independen =====
    (54, 'listening'::TEXT, 1,
        'ミナさんは 本を 読んでから、何を しますか。',
        NULL,
        E'N: 学校で ミナさんと たなかさんが はなしています。\nA: たなかさん、この 本を 見ても いいですか。\nB: ええ、どうぞ。外に もって いっては いけませんよ。\nA: わかりました。ここで 読みます。\nB: 読んでから、先生に かえしてください。',
        'Tanaka berkata 「読んでから、先生に かえしてください」 = setelah membaca, kembalikan ke guru. Membawa keluar justru dilarang (外に もって いっては いけませんよ).'),
    (55, 'listening', 1,
        'ミナさんは としょかんで 何を しても いいですか。',
        NULL,
        E'N: としょかんで ミナさんと おかださんが はなしています。\nA: すみません、ここで しゃしんを とっても いいですか。\nB: いいえ、しゃしんを とっては いけません。\nA: そうですか。じゃ、メモを 書いても いいですか。\nB: はい、どうぞ。しずかに 書いてくださいね。',
        'Permintaan memotret ditolak (しゃしんを とっては いけません), sedangkan menulis memo dijawab 「はい、どうぞ」 — jadi yang boleh adalah menulis memo.'),
    (56, 'listening', 1,
        'たなかさんは いま どこに いますか。',
        NULL,
        E'N: ミナさんが たなかさんに でんわを かけています。\nA: もしもし、たなかさん、いま 何を していますか。\nB: いま 駅の 前で 電車を まっています。\nA: そうですか。じゃ、学校で まっています。\nB: はい、十五分ぐらいで 行きます。',
        'Tanaka menjawab 「いま 駅の 前で 電車を まっています」. Yang berada di sekolah adalah Mina, bukan Tanaka.'),
    (57, 'listening', 1,
        'ミナさんは はじめに 何を しますか。',
        NULL,
        E'N: 学校で たなかさんが ミナさんに はなしています。\nA: ミナさん、ちょっと てつだって くれませんか。\nB: いいですよ。何を しますか。\nA: この 花を 外に もって いって くれませんか。\nB: はい。みずを あげてから、もって いきます。',
        'Mina menjawab 「みずを あげてから、もって いきます」 — 〜てから menandai urutan, jadi tindakan PERTAMA adalah menyiram bunga, baru membawanya keluar.')
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
    (51, 0, '本を 読んでいます。', TRUE), (51, 1, 'ごはんを 食べています。', FALSE), (51, 2, 'おちゃを つくっています。', FALSE), (51, 3, '電車に のっています。', FALSE),
    (52, 0, 'ケーキを 食べます。', TRUE), (52, 1, '本を 読みます。', FALSE), (52, 2, 'おちゃを 飲みます。', FALSE), (52, 3, 'しずかに します。', FALSE),
    (53, 0, 'もとの ところに もどします。', TRUE), (53, 1, 'うちに もって かえります。', FALSE), (53, 2, '先生に わたします。', FALSE), (53, 3, 'ともだちに あげます。', FALSE),

    (54, 0, '先生に かえします。', TRUE), (54, 1, '外に もって いきます。', FALSE), (54, 2, 'たなかさんに あげます。', FALSE), (54, 3, 'うちで 読みます。', FALSE),
    (55, 0, 'メモを 書きます。', TRUE), (55, 1, 'しゃしんを とります。', FALSE), (55, 2, 'おんがくを ききます。', FALSE), (55, 3, 'でんわを します。', FALSE),
    (56, 0, '駅の 前', TRUE), (56, 1, '学校の 中', FALSE), (56, 2, 'としょかんの 中', FALSE), (56, 3, 'うちの 前', FALSE),
    (57, 0, '花に みずを あげます。', TRUE), (57, 1, '花を 外に もって いきます。', FALSE), (57, 2, '車を あらいます。', FALSE), (57, 3, '本を 読みます。', FALSE)
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
    RAISE EXCEPTION '112: total soal lesson bukan 57 (dapat %)',
      (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id);
  END IF;

  IF (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id AND question_category = 'reading') <> 3
     OR (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id AND question_category = 'listening') <> 4 THEN
    RAISE EXCEPTION '112: jumlah soal reading/listening baru tidak sesuai (harap 3/4)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
      LEFT JOIN quiz_options qo ON qo.question_id = qq.id
     WHERE qq.lesson_id = v_lesson_id
     GROUP BY qq.id
    HAVING COUNT(qo.id) <> 4 OR COUNT(*) FILTER (WHERE qo.is_correct) <> 1
  ) THEN
    RAISE EXCEPTION '112: ada soal yang opsinya bukan 4 atau kuncinya bukan tepat 1';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND regexp_replace(regexp_replace(question, '<u>[^<]*</u>', '', 'g'),
             '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '112: ada kanji di luar daftar taught pada question';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND passage IS NOT NULL
       AND regexp_replace(passage, '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '112: ada kanji di luar daftar taught pada passage';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND audio_script IS NOT NULL
       AND regexp_replace(audio_script, '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '112: ada kanji di luar daftar taught pada audio_script';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '112: ada rantai の pada question';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND passage IS NOT NULL AND passage ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '112: ada rantai の pada passage';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND audio_script IS NOT NULL AND audio_script ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '112: ada rantai の pada audio_script';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
     WHERE qq.lesson_id = v_lesson_id AND qq.audio_script IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM unnest(string_to_array(qq.audio_script, E'\n')) AS line
          WHERE line !~ '^(N|A|B):\s*\S'
       )
  ) THEN
    RAISE EXCEPTION '112: ada baris audio_script yang tidak berformat "N/A/B: teks"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'reading' AND (passage IS NULL OR passage = '')
  ) THEN
    RAISE EXCEPTION '112: ada soal reading tanpa passage';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'listening' AND (audio_script IS NULL OR audio_script = '')
  ) THEN
    RAISE EXCEPTION '112: ada soal listening tanpa audio_script';
  END IF;

  RAISE NOTICE '112: selesai — Assignment Bab 13 sekarang 57 soal (vocabulary 30, grammar 20, reading 3, listening 4). questions_per_attempt di-update ke 57.';
END $$;
