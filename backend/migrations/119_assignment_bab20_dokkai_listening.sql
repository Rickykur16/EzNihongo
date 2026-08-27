-- 119_assignment_bab20_dokkai_listening.sql — Tambah もんだい4 Dokkai +
-- もんだい5 Listening ke Assignment Bab 20 (migration 110).
--
-- BAB PENUTUP seri 111-119 (dokkai + listening untuk Assignment Bab
-- 12-20). Lihat 111_assignment_bab12_dokkai_listening.sql untuk
-- penjelasan pola lengkap: EXTEND lesson existing, DELETE hanya
-- menyasar question_category IN ('reading','listening'), assertion kanji
-- whitelist + rantai-の diperluas ke `passage`/`audio_script`, format
-- audio_script wajib "SPEAKER: teks" (N/A/B), questions_per_attempt
-- di-update ke total baru.
--
-- GRAMMAR SCOPE Bab 20 (089_bunpou_bab20.sql): 〜たことがあります／
-- 〜たことがありません, 〜から (sebab), 〜が、〜 (pertentangan), そして／
-- それから／でも (penghubung kalimat). BEDA dari migrasi 111-118: keempat
-- pola ini DIRESERVASI untuk bab ini di semua bab sebelumnya — sekarang
-- justru dipakai bebas karena inilah bab yang mengajarkannya. Kanji
-- whitelist = whitelist Bab 12-19 (102 char) UNION 2 kanji baru Bab 20
-- (来令) — identik dengan v_kanji_ok di
-- 110_assignment_bab20_pengalaman_penghubung.sql.
--
-- 来 SENGAJA diuji KEDUA bacaannya dalam satu passage/dialog (poin ajar
-- inti bab ini): らい (on-yomi, kata majemuk waktu 来年／来週／来月) dan
-- き (kun-yomi, kata kerja tidak beraturan 来る "datang": 来ます／来ません).
-- 令 TIDAK DIPAKAI — satu-satunya pemakaian N5 (令和) butuh kanji 和 yang
-- TIDAK ada di whitelist; menambahkan 和 adalah keputusan kurikulum di
-- luar migrasi ini, jadi 令 dibiarkan tidak teruji di mondai 4/5 (kanji
-- itu tetap diajarkan di kanji_items/deck, cuma tidak muncul di sini).
--
-- Listening pakai nama (ミナさん／たなかさん／おかださん／やまださん),
-- melanjutkan pola 111-118. Jebakan tetap ada meski penghubung sekarang
-- bebas dipakai: dialog 1 jawaban "mendaki bersama" tidak diucapkan kata
-- per kata (harus digabung dari ajakan + persetujuan); dialog 3 total
-- harga bukan penjumlahan kedua barang yang disebut, tapi harga barang
-- yang akhirnya DIPILIH (でも membalik keputusan awal).
--
-- Idempotent: DELETE hanya menyasar question_category IN ('reading',
-- 'listening') milik lesson ini; lesson di-resolve via slug yang sama
-- dengan 110 (tidak insert lesson baru).
--
-- Migrasi ini MENUTUP seri 111-119 — Assignment Bab 12-20 sekarang
-- semuanya 57 soal (vocabulary 30 + grammar 20 + reading 3 + listening 4),
-- 9 lesson, 513 soal total.

DO $$
DECLARE
  v_course_slug  TEXT := 'n5';
  v_lesson_slug  TEXT := 'assignment-bab-20-pengalaman-penghubung';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson_id    UUID;
  v_old_total    INT;
  v_kanji_ok     TEXT := '先何語校国生学名人魚本花八三十九一五四二六七安高古新白長男女気下前外間右中左後上時分円百千万年月半歳午車東道駅行西電北南見読書週毎食飲立休入出言話聞買店会社日火水木金土子父母友手足口目耳大小多少雨天空山川来令';
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 19 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '119: modul Bab 20 di kursus % tidak ditemukan — skip.', v_course_slug;
    RETURN;
  END IF;

  SELECT id INTO v_lesson_id FROM lessons
   WHERE module_id = v_module_id AND slug = v_lesson_slug;

  IF v_lesson_id IS NULL THEN
    RAISE NOTICE '119: lesson "%" belum ada (migration 110 belum jalan?) — skip.', v_lesson_slug;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_old_total FROM quiz_questions WHERE lesson_id = v_lesson_id;
  RAISE NOTICE '119: menambah もんだい4/5 ke Assignment Bab 20 ("%", sudah ada % soal).', v_module_title, v_old_total;

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
        'この 人は 川で 何を しましたか。',
        E'わたしは 日本に 行った ことが あります。三年前に 友だちと 山に のぼりました。それから 川で 魚を 見ました。山は きれいでしたが、その日は 雨が ふりました。でも、とても たのしかったですから、また 行く つもりです。来年、友だちも わたしの 国に 来ます。',
        NULL,
        '「それから 川で 魚を 見ました」— setelah itu melihat ikan di sungai. Mendaki gunung terjadi di gunung, bukan di sungai.'),
    (52, 'reading', 1,
        '山に 行った 日、天気は どうでしたか。',
        E'わたしは 日本に 行った ことが あります。三年前に 友だちと 山に のぼりました。それから 川で 魚を 見ました。山は きれいでしたが、その日は 雨が ふりました。でも、とても たのしかったですから、また 行く つもりです。来年、友だちも わたしの 国に 来ます。',
        NULL,
        '「山は きれいでしたが、その日は 雨が ふりました」— pola 〜が、〜 pertentangan: gunungnya indah TETAPI hari itu hujan.'),
    (53, 'reading', 1,
        '来年、だれが 来ますか。',
        E'わたしは 日本に 行った ことが あります。三年前に 友だちと 山に のぼりました。それから 川で 魚を 見ました。山は きれいでしたが、その日は 雨が ふりました。でも、とても たのしかったですから、また 行く つもりです。来年、友だちも わたしの 国に 来ます。',
        NULL,
        '「来年、友だちも わたしの 国に 来ます」— 来年 dibaca らいねん (tahun depan), 来ます dibaca きます (datang), dua bacaan 来 dalam satu kalimat.'),

    -- ===== もんだい5 聴解 (54-57) — 4 dialog independen =====
    (54, 'listening'::TEXT, 1,
        '二人は 来年 何を しますか。',
        NULL,
        E'N: ミナさんと たなかさんが 話しています。\nA: たなかさん、ふじさんに のぼった ことが ありますか。\nB: いいえ、ありません。でも、来年 のぼりたいです。\nA: わたしは 二年前に のぼりました。とても たのしかったですよ。\nB: いいですね。じゃあ、来年 いっしょに 行きませんか。\nA: はい、ぜひ 行きましょう。',
        'Tanaka mengajak「来年 いっしょに 行きませんか」dan Mina setuju「はい、ぜひ 行きましょう」— jawabannya digabung dari ajakan + persetujuan, bukan diucapkan langsung.'),
    (55, 'listening', 1,
        'やまださんは いつ 会社に 来ますか。',
        NULL,
        E'N: おかださんが やまださんに 電話を して います。\nA: やまださん、あした 会社に 来ますか。\nB: いいえ、あしたは 休みます。子どもが びょうきですから。\nA: そうですか。じゃあ、来週の 火よう日は どうですか。\nB: 来週は だいじょうぶです。火よう日に 行きます。',
        'Besok libur karena anak sakit (〜から sebab). Okada menawarkan 来週の 火よう日 dan Yamada setuju.'),
    (56, 'listening', 1,
        'ミナさんは いくら はらいますか。',
        NULL,
        E'N: ミナさんが 店で 買いものを して います。\nA: すみません、この くろい かばんは いくらですか。\nB: それは 五千円です。あかい かばんは 三千円です。\nA: あかい かばんは やすいですね。\nA: でも、くろい かばんが すきですから、くろい かばんを ください。\nB: はい、五千円に なります。',
        'Tas merah lebih murah (三千円), TETAPI (でも) Mina memilih tas hitam karena suka warnanya — jadi yang dibayar 五千円, bukan penjumlahan kedua harga.'),
    (57, 'listening', 1,
        'だれが なっとうを 食べた ことが ありますか。',
        NULL,
        E'N: 学校で ミナさんと おかださんが 話しています。\nA: おかださんは にほんりょうりを 食べた ことが ありますか。\nB: はい、あります。三年前に 日本へ 行きましたから。\nA: いいですね。わたしは すしが すきですが、なっとうは 食べた ことが ありません。\nB: なっとうは おいしいですよ。わたしは 毎日 食べました。',
        'Mina suka sushi TETAPI belum pernah makan natto (〜が、〜). Okada sudah makan natto setiap hari — jadi hanya Okada yang punya pengalaman itu.')
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
    (51, 0, '魚を 見ました。', TRUE), (51, 1, '山に のぼりました。', FALSE), (51, 2, '魚を 買いました。', FALSE), (51, 3, '花を 見ました。', FALSE),
    (52, 0, '雨が ふりました。', TRUE), (52, 1, 'いい 天気でした。', FALSE), (52, 2, 'ゆきが ふりました。', FALSE), (52, 3, 'とても あつかったです。', FALSE),
    (53, 0, '友だちが 来ます。', TRUE), (53, 1, '父と 母が 来ます。', FALSE), (53, 2, '先生が 来ます。', FALSE), (53, 3, 'だれも 来ません。', FALSE),

    (54, 0, 'いっしょに 山に のぼります。', TRUE), (54, 1, 'たなかさんが ひとりで のぼります。', FALSE), (54, 2, 'ミナさんが ひとりで のぼります。', FALSE), (54, 3, '二人とも 行きません。', FALSE),
    (55, 0, '来週の 火よう日', TRUE), (55, 1, '来月の 火よう日', FALSE), (55, 2, 'あした', FALSE), (55, 3, 'きょう', FALSE),
    (56, 0, '五千円', TRUE), (56, 1, '三千円', FALSE), (56, 2, '八千円', FALSE), (56, 3, '二千円', FALSE),
    (57, 0, 'おかださん', TRUE), (57, 1, 'ミナさん', FALSE), (57, 2, '二人とも', FALSE), (57, 3, '二人とも ありません', FALSE)
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
    RAISE EXCEPTION '119: total soal lesson bukan 57 (dapat %)',
      (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id);
  END IF;

  IF (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id AND question_category = 'reading') <> 3
     OR (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id AND question_category = 'listening') <> 4 THEN
    RAISE EXCEPTION '119: jumlah soal reading/listening baru tidak sesuai (harap 3/4)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
      LEFT JOIN quiz_options qo ON qo.question_id = qq.id
     WHERE qq.lesson_id = v_lesson_id
     GROUP BY qq.id
    HAVING COUNT(qo.id) <> 4 OR COUNT(*) FILTER (WHERE qo.is_correct) <> 1
  ) THEN
    RAISE EXCEPTION '119: ada soal yang opsinya bukan 4 atau kuncinya bukan tepat 1';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND regexp_replace(regexp_replace(question, '<u>[^<]*</u>', '', 'g'),
             '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '119: ada kanji di luar daftar taught pada question';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND passage IS NOT NULL
       AND regexp_replace(passage, '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '119: ada kanji di luar daftar taught pada passage';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND audio_script IS NOT NULL
       AND regexp_replace(audio_script, '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '119: ada kanji di luar daftar taught pada audio_script';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '119: ada rantai の pada question';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND passage IS NOT NULL AND passage ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '119: ada rantai の pada passage';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND audio_script IS NOT NULL AND audio_script ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '119: ada rantai の pada audio_script';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
     WHERE qq.lesson_id = v_lesson_id AND qq.audio_script IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM unnest(string_to_array(qq.audio_script, E'\n')) AS line
          WHERE line !~ '^(N|A|B):\s*\S'
       )
  ) THEN
    RAISE EXCEPTION '119: ada baris audio_script yang tidak berformat "N/A/B: teks"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'reading' AND (passage IS NULL OR passage = '')
  ) THEN
    RAISE EXCEPTION '119: ada soal reading tanpa passage';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'listening' AND (audio_script IS NULL OR audio_script = '')
  ) THEN
    RAISE EXCEPTION '119: ada soal listening tanpa audio_script';
  END IF;

  RAISE NOTICE '119: selesai — Assignment Bab 20 sekarang 57 soal (vocabulary 30, grammar 20, reading 3, listening 4). questions_per_attempt di-update ke 57. BAB PENUTUP — seri dokkai/listening Bab 12-20 lengkap.';
END $$;
