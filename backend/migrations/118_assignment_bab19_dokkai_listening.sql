-- 118_assignment_bab19_dokkai_listening.sql — Tambah もんだい4 Dokkai +
-- もんだい5 Listening ke Assignment Bab 19 (migration 109).
--
-- Bagian kedelapan dari seri 111-119. Lihat 111_assignment_bab12_dokkai_
-- listening.sql untuk penjelasan pola lengkap: EXTEND lesson existing,
-- DELETE hanya menyasar question_category IN ('reading','listening'),
-- assertion kanji whitelist + rantai-の diperluas ke `passage`/`audio_script`,
-- format audio_script wajib "SPEAKER: teks" (N/A/B), questions_per_attempt
-- di-update ke total baru.
--
-- GRAMMAR SCOPE Bab 19 (088_bunpou_bab19.sql): 〜たいです／〜たくないです
-- ／[noun]が欲しいです (kana ほしいです — 欲 tidak diajarkan)／〜つもりです
-- (niat pribadi) vs 〜予定です (kana よていです — jadwal tetap, 予定 tidak
-- diajarkan)／〜ましょう・〜ませんか (ajakan). Kanji whitelist = whitelist
-- Bab 12-18 (97 char) UNION 5 kanji baru Bab 19 (雨天空山川) — identik
-- dengan v_kanji_ok di 109_assignment_bab19_keinginan_rencana.sql.
--
-- SENGAJA TIDAK memakai でも／そして／それから／〜が、〜 (Bab 20) — bersih
-- tanpa revisi (kelima kalinya berturut-turut). Kontras di dialog 2/3
-- dinyatakan sebagai dua kalimat berdiri sendiri. Juga dihindari total:
-- たことがあります (Bab 20).
--
-- Listening: dialog 1 menguji jebakan klasik "harus disimak sampai akhir"
-- (jadwal digeser dua kali sebelum disepakati); dialog 2 menguji keinginan
-- yang BERUBAH di tengah percakapan (permintaan pertama dikoreksi lawan
-- bicara); dialog 3 menguji barang yang disebut PERTAMA justru DITOLAK
-- (kamera terlalu mahal, niat sebenarnya beli sepeda) — pola sama dengan
-- jebakan suka-vs-mahir di Bab 17 dan perbandingan di Bab 18.
--
-- Listening pakai nama (ミナさん／たなかさん／おかださん／やまださん),
-- melanjutkan pola 111-117.
--
-- Idempotent: DELETE hanya menyasar question_category IN ('reading',
-- 'listening') milik lesson ini; lesson di-resolve via slug yang sama
-- dengan 109 (tidak insert lesson baru).

DO $$
DECLARE
  v_course_slug  TEXT := 'n5';
  v_lesson_slug  TEXT := 'assignment-bab-19-keinginan-rencana';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson_id    UUID;
  v_old_total    INT;
  v_kanji_ok     TEXT := '先何語校国生学名人魚本花八三十九一五四二六七安高古新白長男女気下前外間右中左後上時分円百千万年月半歳午車東道駅行西電北南見読書週毎食飲立休入出言話聞買店会社日火水木金土子父母友手足口目耳大小多少雨天空山川';
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 18 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '118: modul Bab 19 di kursus % tidak ditemukan — skip.', v_course_slug;
    RETURN;
  END IF;

  SELECT id INTO v_lesson_id FROM lessons
   WHERE module_id = v_module_id AND slug = v_lesson_slug;

  IF v_lesson_id IS NULL THEN
    RAISE NOTICE '118: lesson "%" belum ada (migration 109 belum jalan?) — skip.', v_lesson_slug;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_old_total FROM quiz_questions WHERE lesson_id = v_lesson_id;
  RAISE NOTICE '118: menambah もんだい4/5 ke Assignment Bab 19 ("%", sudah ada % soal).', v_module_title, v_old_total;

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
        'この 人は らいげつ、なにを する よていですか。',
        E'わたしは 山が すきです。らいげつ、ミナさんと 山に のぼる よていです。山の 上から 川や 空を 見たいです。新しい くつが ほしいです。天気が わるい 日は、うちで 本を 読む つもりです。',
        NULL,
        '「らいげつ、ミナさんと 山に のぼる よていです」— bulan depan dijadwalkan mendaki gunung bersama Mina. Sungai/langit hanya ingin DILIHAT dari atas gunung, buku dibaca hanya kalau cuaca buruk, sepatu hanya diinginkan (ほしい).'),
    (52, 'reading', 1,
        'この 人は なにが ほしいですか。',
        E'わたしは 山が すきです。らいげつ、ミナさんと 山に のぼる よていです。山の 上から 川や 空を 見たいです。新しい くつが ほしいです。天気が わるい 日は、うちで 本を 読む つもりです。',
        NULL,
        '「新しい くつが ほしいです」— yang diinginkan sepatu baru. Buku disebut untuk dibaca, bukan diinginkan; tas dan mobil tidak disebut.'),
    (53, 'reading', 1,
        '天気が わるい 日、この 人は なにを しますか。',
        E'わたしは 山が すきです。らいげつ、ミナさんと 山に のぼる よていです。山の 上から 川や 空を 見たいです。新しい くつが ほしいです。天気が わるい 日は、うちで 本を 読む つもりです。',
        NULL,
        '「天気が わるい 日は、うちで 本を 読む つもりです」— kalau cuaca buruk, niatnya membaca buku di rumah. Mendaki gunung justru rencana bulan depan.'),

    -- ===== もんだい5 聴解 (54-57) — 4 dialog independen =====
    (54, 'listening'::TEXT, 1,
        'ふたりは いつ 山に のぼりますか。',
        NULL,
        E'N: ミナさんと たなかさんが 話しています。\nA: たなかさん、日よう日に 山に のぼりませんか。\nB: すみません、日よう日は 雨が ふります。\nA: そうですか。土よう日は どうですか。\nB: 土よう日は しごとの よていです。らいしゅうの 日よう日は どうですか。\nA: はい、いいですよ。いっしょに 行きましょう。',
        'Minggu ini ditolak (hujan), Sabtu ini ditolak (ada jadwal kerja). Tanaka mengusulkan らいしゅうの 日よう日 dan Mina setuju.'),
    (55, 'listening', 1,
        'やまださんは なにが ほしいですか。',
        NULL,
        E'N: おかださんと やまださんが 話しています。\nA: やまださん、たんじょう日に なにが ほしいですか。\nB: 新しい 本が ほしいです。\nA: やまださんは せんしゅう、本を 五さつ 買いましたよ。\nB: あ、そうですね。じゃあ、新しい かばんが ほしいです。',
        'Yamada awalnya ingin buku, tapi diingatkan sudah beli 5 buku minggu lalu, lalu mengubah jawaban jadi 新しい かばんが ほしいです.'),
    (56, 'listening', 1,
        'たなかさんは なにを 買う つもりですか。',
        NULL,
        E'N: おかださんと たなかさんが 店で 話しています。\nA: たなかさん、新しい カメラを 買う つもりですか。\nB: カメラは 高いです。じてんしゃを 買う つもりです。\nA: いつ 買う よていですか。\nB: らいげつ、お金が 入る よていです。',
        'Kamera disebut pertama tapi ditolak (terlalu mahal). Niat Tanaka yang sebenarnya:「じてんしゃを 買う つもりです」.'),
    (57, 'listening', 1,
        'ミナさんは なんと 言いますか。',
        NULL,
        E'N: やまださんが ミナさんに 聞きます。\nA: ミナさん、なつ休みに なにが したいですか。',
        '「なにが したいですか」menanyakan keinginan melakukan sesuatu, jawaban memakai 〜たいです:「山に のぼりたいです」. ほしい dipakai untuk benda, bukan kegiatan.')
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
    (51, 0, 'ミナさんと 山に のぼります。', TRUE), (51, 1, 'ひとりで 川で あそびます。', FALSE), (51, 2, 'うちで 本を 読みます。', FALSE), (51, 3, '新しい くつを 買います。', FALSE),
    (52, 0, '新しい くつ', TRUE), (52, 1, '新しい かばん', FALSE), (52, 2, '新しい 本', FALSE), (52, 3, '新しい 車', FALSE),
    (53, 0, 'うちで 本を 読みます。', TRUE), (53, 1, '山に のぼります。', FALSE), (53, 2, '川で あそびます。', FALSE), (53, 3, '店に くつを 買いに 行きます。', FALSE),

    (54, 0, 'らいしゅうの 日よう日', TRUE), (54, 1, 'こんしゅうの 日よう日', FALSE), (54, 2, 'こんしゅうの 土よう日', FALSE), (54, 3, 'らいしゅうの 土よう日', FALSE),
    (55, 0, 'かばん', TRUE), (55, 1, '本', FALSE), (55, 2, 'くつ', FALSE), (55, 3, '花', FALSE),
    (56, 0, 'じてんしゃ', TRUE), (56, 1, 'カメラ', FALSE), (56, 2, '車', FALSE), (56, 3, '新しい くつ', FALSE),
    (57, 0, '山に のぼりたいです。', TRUE), (57, 1, '山に のぼりました。', FALSE), (57, 2, '山が ほしいです。', FALSE), (57, 3, '山に のぼっても いいですか。', FALSE)
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
    RAISE EXCEPTION '118: total soal lesson bukan 57 (dapat %)',
      (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id);
  END IF;

  IF (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id AND question_category = 'reading') <> 3
     OR (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id AND question_category = 'listening') <> 4 THEN
    RAISE EXCEPTION '118: jumlah soal reading/listening baru tidak sesuai (harap 3/4)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
      LEFT JOIN quiz_options qo ON qo.question_id = qq.id
     WHERE qq.lesson_id = v_lesson_id
     GROUP BY qq.id
    HAVING COUNT(qo.id) <> 4 OR COUNT(*) FILTER (WHERE qo.is_correct) <> 1
  ) THEN
    RAISE EXCEPTION '118: ada soal yang opsinya bukan 4 atau kuncinya bukan tepat 1';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND regexp_replace(regexp_replace(question, '<u>[^<]*</u>', '', 'g'),
             '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '118: ada kanji di luar daftar taught pada question';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND passage IS NOT NULL
       AND regexp_replace(passage, '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '118: ada kanji di luar daftar taught pada passage';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND audio_script IS NOT NULL
       AND regexp_replace(audio_script, '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '118: ada kanji di luar daftar taught pada audio_script';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '118: ada rantai の pada question';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND passage IS NOT NULL AND passage ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '118: ada rantai の pada passage';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND audio_script IS NOT NULL AND audio_script ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '118: ada rantai の pada audio_script';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
     WHERE qq.lesson_id = v_lesson_id AND qq.audio_script IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM unnest(string_to_array(qq.audio_script, E'\n')) AS line
          WHERE line !~ '^(N|A|B):\s*\S'
       )
  ) THEN
    RAISE EXCEPTION '118: ada baris audio_script yang tidak berformat "N/A/B: teks"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'reading' AND (passage IS NULL OR passage = '')
  ) THEN
    RAISE EXCEPTION '118: ada soal reading tanpa passage';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'listening' AND (audio_script IS NULL OR audio_script = '')
  ) THEN
    RAISE EXCEPTION '118: ada soal listening tanpa audio_script';
  END IF;

  RAISE NOTICE '118: selesai — Assignment Bab 19 sekarang 57 soal (vocabulary 30, grammar 20, reading 3, listening 4). questions_per_attempt di-update ke 57.';
END $$;
