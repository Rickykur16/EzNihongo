-- 113_assignment_bab14_dokkai_listening.sql — Tambah もんだい4 Dokkai +
-- もんだい5 Listening ke Assignment Bab 14 (migration 103).
--
-- Bagian ketiga dari seri 111-119. Lihat 111_assignment_bab12_dokkai_
-- listening.sql untuk penjelasan pola lengkap: EXTEND lesson existing,
-- DELETE hanya menyasar question_category IN ('reading','listening'),
-- assertion kanji whitelist + rantai-の diperluas ke `passage`/`audio_script`,
-- format audio_script wajib "SPEAKER: teks" (N/A/B), questions_per_attempt
-- di-update ke total baru.
--
-- GRAMMAR SCOPE Bab 14 (083_bunpou_bab14.sql): V-ない, 〜ないでください,
-- 〜なければなりません, 〜なくてもいいです (pelajaran 1), V-kamus, 〜た,
-- 〜なかった bentuk plain (pelajaran 2). Boleh pakai Bab 12/13 (te-form,
-- ています/てください/てはいけません) sebagai penopang. Bab 14
-- memperkenalkan 4 kanji baru — 立(たつ)・休(やすむ)・入(はいる)・出(でる)
-- — whitelist = whitelist Bab 12/13 (68 char) UNION 立休入出 (72 char),
-- identik dengan v_kanji_ok di 103_assignment_bab14_nai_plain.sql.
--
-- SENGAJA TIDAK memakai grammar Bab 15+: pola penghubung そして／それから／
-- でも dan pertentangan 〜が、〜 (keduanya baru diajarkan Bab 20, lihat
-- 089_bunpou_bab20.sql) DIHINDARI TOTAL — draft awal (subagent) sempat
-- menyelipkan「でも、」sebagai penghubung kalimat di salah satu dialog
-- listening; dihapus manual sebelum commit (dua kalimat berdiri sendiri
-- tanpa penghubung tetap gramatikal dan tidak mengubah makna).
--
-- JEBAKAN の BARU: きのう (kemarin) mengandung karakter の di suku
-- tengahnya (き-の-う) — sama seperti pola "kata X-mono" (たべもの dst)
-- yang sudah dicatat di migration 100/108. Kalimat apa pun yang memakai
-- きのう otomatis sudah memakai jatah の-nya; jangan digabung dengan
-- この／あの／の posesif lain di kalimat yang sama. Semua kalimat ber-
-- きのう di file ini sudah dicek bersih (の hanya 1 per kalimat).
--
-- Listening pakai nama (ミナさん／たなかさん／おかださん), melanjutkan
-- pola 111/112 untuk menghindari jebakan "男の人と女の人が話しています".
--
-- Idempotent: DELETE hanya menyasar question_category IN ('reading',
-- 'listening') milik lesson ini; lesson di-resolve via slug yang sama
-- dengan 103 (tidak insert lesson baru).

DO $$
DECLARE
  v_course_slug  TEXT := 'n5';
  v_lesson_slug  TEXT := 'assignment-bab-14-nai-bentuk-plain';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson_id    UUID;
  v_old_total    INT;
  v_kanji_ok     TEXT := '先何語校国生学名人魚本花八三十九一五四二六七安高古新白長男女気下前外間右中左後上時分円百千万年月半歳午車東道駅行西電北南見読書週毎食飲立休入出';
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 13 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '113: modul Bab 14 di kursus % tidak ditemukan — skip.', v_course_slug;
    RETURN;
  END IF;

  SELECT id INTO v_lesson_id FROM lessons
   WHERE module_id = v_module_id AND slug = v_lesson_slug;

  IF v_lesson_id IS NULL THEN
    RAISE NOTICE '113: lesson "%" belum ada (migration 103 belum jalan?) — skip.', v_lesson_slug;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_old_total FROM quiz_questions WHERE lesson_id = v_lesson_id;
  RAISE NOTICE '113: menambah もんだい4/5 ke Assignment Bab 14 ("%", sudah ada % soal).', v_module_title, v_old_total;

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
        '学生は 何時に 学校を 出ますか。',
        E'あした クラスで こうえんへ 行きます。学生は 八時に 学校を 出ます。こうえんの 花を とらないで ください。べんとうを もって こなければ なりません。かさは もって こなくても いいです。',
        NULL,
        'Kalimat kedua menyebut 「学生は 八時に 学校を 出ます」 — jam 8. Angka lain tidak pernah muncul di bacaan.'),
    (52, 'reading', 1,
        'こうえんで 何を しては いけませんか。',
        E'あした クラスで こうえんへ 行きます。学生は 八時に 学校を 出ます。こうえんの 花を とらないで ください。べんとうを もって こなければ なりません。かさは もって こなくても いいです。',
        NULL,
        '「花を とらないで ください」= tolong jangan memetik bunga. Bekal justru wajib dibawa, foto dan membaca buku tidak disinggung.'),
    (53, 'reading', 1,
        '学生が かならず もって いく ものは 何ですか。',
        E'あした クラスで こうえんへ 行きます。学生は 八時に 学校を 出ます。こうえんの 花を とらないで ください。べんとうを もって こなければ なりません。かさは もって こなくても いいです。',
        NULL,
        'べんとう memakai 〜なければなりません (wajib), sedangkan かさ memakai 〜なくてもいいです (tidak wajib) — bukan barang wajib.'),

    -- ===== もんだい5 聴解 (54-57) — 4 dialog independen =====
    (54, 'listening'::TEXT, 1,
        '学生は あした 何を もって いきますか。',
        NULL,
        E'N: 学校で 先生と 学生が はなして います。\nA: あしたの テストは 九時に はじまります。八時半に きょうしつに 入って ください。\nB: 本は もって いかなければ なりませんか。\nA: 本は もって こなくても いいです。じしょは もって こなければ なりません。\nB: はい、わかりました。',
        '本 → こなくてもいいです (tidak wajib), じしょ → こなければなりません (wajib). 本 disebut lebih banyak, tapi kuncinya di akhiran kalimat.'),
    (55, 'listening', 1,
        'ミナさんは きのう 何を しましたか。',
        NULL,
        E'N: たなかさんと ミナさんが はなして います。\nA: ミナさん、きのう としょかんへ 行った？\nB: ううん、行かなかった。あさから きぶんが わるかった。うちで 休んだ。\nA: きょうは 行く？\nB: うん、三時に 行く。',
        '行かなかった (lampau negatif plain) = kemarin TIDAK pergi; yang dilakukan adalah 休んだ (istirahat) di rumah. Tiga時 dan としょかん adalah rencana HARI INI, bukan kemarin.'),
    (56, 'listening', 1,
        '先生は 何と いいますか。',
        NULL,
        E'N: 学生が 先生に ききます。\nA: 先生、この 本も 読まなければ なりませんか。',
        'Pertanyaan 〜なければなりませんか dijawab negatif dengan pasangannya: いいえ + 〜なくてもいいです.'),
    (57, 'listening', 1,
        'おかださんは あした どう しますか。',
        NULL,
        E'N: 駅で ミナさんと おかださんが はなして います。\nA: おかださん、いつも 電車で 学校へ 行きますか。\nB: はい、電車で 行きます。\nA: あさの 電車は こみますか。\nB: ええ、人が たくさん いて、いつも 立って います。\nA: あしたも はやく うちを 出ますか。\nB: いいえ、あしたは 学校が 休みです。はやく 出なくても いいです。',
        'Seluruh dialog membangun kebiasaan Okada (naik kereta, berdiri, berangkat pagi), lalu baris terakhir membaliknya: besok libur, jadi 出なくてもいいです.')
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
    (51, 0, '八時。', TRUE), (51, 1, '七時。', FALSE), (51, 2, '九時。', FALSE), (51, 3, '十時。', FALSE),
    (52, 0, '花を とる こと。', TRUE), (52, 1, 'べんとうを 食べる こと。', FALSE), (52, 2, 'しゃしんを とる こと。', FALSE), (52, 3, '本を 読む こと。', FALSE),
    (53, 0, 'べんとう。', TRUE), (53, 1, 'かさ。', FALSE), (53, 2, '花。', FALSE), (53, 3, 'じしょ。', FALSE),

    (54, 0, 'じしょ。', TRUE), (54, 1, '本。', FALSE), (54, 2, '本と じしょ。', FALSE), (54, 3, 'なにも もって いきません。', FALSE),
    (55, 0, 'うちで 休みました。', TRUE), (55, 1, 'としょかんで 本を 読みました。', FALSE), (55, 2, '学校で べんきょうしました。', FALSE), (55, 3, '三時に 出かけました。', FALSE),
    (56, 0, 'いいえ、読まなくても いいです。', TRUE), (56, 1, 'はい、読んでは いけません。', FALSE), (56, 2, 'いいえ、読んで います。', FALSE), (56, 3, 'はい、読まないで ください。', FALSE),
    (57, 0, 'はやく 出なくても いいです。', TRUE), (57, 1, 'はやく うちを 出ます。', FALSE), (57, 2, '車で 学校へ 行きます。', FALSE), (57, 3, '駅で ミナさんに あいます。', FALSE)
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
    RAISE EXCEPTION '113: total soal lesson bukan 57 (dapat %)',
      (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id);
  END IF;

  IF (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id AND question_category = 'reading') <> 3
     OR (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id AND question_category = 'listening') <> 4 THEN
    RAISE EXCEPTION '113: jumlah soal reading/listening baru tidak sesuai (harap 3/4)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
      LEFT JOIN quiz_options qo ON qo.question_id = qq.id
     WHERE qq.lesson_id = v_lesson_id
     GROUP BY qq.id
    HAVING COUNT(qo.id) <> 4 OR COUNT(*) FILTER (WHERE qo.is_correct) <> 1
  ) THEN
    RAISE EXCEPTION '113: ada soal yang opsinya bukan 4 atau kuncinya bukan tepat 1';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND regexp_replace(regexp_replace(question, '<u>[^<]*</u>', '', 'g'),
             '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '113: ada kanji di luar daftar taught pada question';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND passage IS NOT NULL
       AND regexp_replace(passage, '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '113: ada kanji di luar daftar taught pada passage';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND audio_script IS NOT NULL
       AND regexp_replace(audio_script, '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '113: ada kanji di luar daftar taught pada audio_script';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '113: ada rantai の pada question';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND passage IS NOT NULL AND passage ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '113: ada rantai の pada passage';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND audio_script IS NOT NULL AND audio_script ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '113: ada rantai の pada audio_script';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
     WHERE qq.lesson_id = v_lesson_id AND qq.audio_script IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM unnest(string_to_array(qq.audio_script, E'\n')) AS line
          WHERE line !~ '^(N|A|B):\s*\S'
       )
  ) THEN
    RAISE EXCEPTION '113: ada baris audio_script yang tidak berformat "N/A/B: teks"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'reading' AND (passage IS NULL OR passage = '')
  ) THEN
    RAISE EXCEPTION '113: ada soal reading tanpa passage';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'listening' AND (audio_script IS NULL OR audio_script = '')
  ) THEN
    RAISE EXCEPTION '113: ada soal listening tanpa audio_script';
  END IF;

  RAISE NOTICE '113: selesai — Assignment Bab 14 sekarang 57 soal (vocabulary 30, grammar 20, reading 3, listening 4). questions_per_attempt di-update ke 57.';
END $$;
