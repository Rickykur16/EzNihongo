-- 116_assignment_bab17_dokkai_listening.sql — Tambah もんだい4 Dokkai +
-- もんだい5 Listening ke Assignment Bab 17 (migration 107).
--
-- Bagian keenam dari seri 111-119. Lihat 111_assignment_bab12_dokkai_
-- listening.sql untuk penjelasan pola lengkap: EXTEND lesson existing,
-- DELETE hanya menyasar question_category IN ('reading','listening'),
-- assertion kanji whitelist + rantai-の diperluas ke `passage`/`audio_script`,
-- format audio_script wajib "SPEAKER: teks" (N/A/B), questions_per_attempt
-- di-update ke total baru.
--
-- GRAMMAR SCOPE Bab 17 (086_bunpou_bab17.sql): 〜が好きです／嫌いです
-- (selalu kana すき／きらい — 好/嫌 TIDAK diajarkan meski jadi inti pola
-- bab ini), 〜が上手です／下手です, 〜ができます, どんな〜. Kanji whitelist
-- = whitelist Bab 12-16 (84 char) UNION 9 kanji baru Bab 17
-- (子父母友手足口目耳) — identik dengan v_kanji_ok di
-- 107_assignment_bab17_suka_mahir.sql. Kanji baru yang kepakai secara
-- alami di konten ini: 父・母・友・手 (dalam 上手／下手); 子/足/口/目/耳
-- tidak punya konteks alami di skenario suka/mahir (biarkan もんだい1/2
-- yang menguji itu).
--
-- SENGAJA TIDAK memakai でも／そして／それから／〜が、〜 (Bab 20) — bersih
-- tanpa revisi (ketiga kalinya berturut-turut sejak larangan
-- dieksplisitkan di prompt, sejak Bab 15). Juga dihindari total: たいです/
-- ほしい/つもり/予定/ましょう/ませんか/たことがあります/perbandingan
-- (Bab 18-20).
--
-- JEBAKAN LISTENING (khas JLPT): dialog 1 menguji beda 〜が すきです
-- (suka) vs 〜が 上手です (mahir) — kata yang paling sering disebut
-- (サッカー) justru yang TIDAK mahir; dialog 2 melacak kemampuan 3 orang
-- berbeda (Mina "sedikit bisa", ayah "tidak sama sekali", ibu "sangat
-- mahir") — siswa harus mengaitkan subjek dengan levelnya masing-masing.
--
-- Listening pakai nama (ミナさん／たなかさん／おかださん／やまださん),
-- melanjutkan pola 111-115.
--
-- Idempotent: DELETE hanya menyasar question_category IN ('reading',
-- 'listening') milik lesson ini; lesson di-resolve via slug yang sama
-- dengan 107 (tidak insert lesson baru).

DO $$
DECLARE
  v_course_slug  TEXT := 'n5';
  v_lesson_slug  TEXT := 'assignment-bab-17-suka-mahir';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson_id    UUID;
  v_old_total    INT;
  v_kanji_ok     TEXT := '先何語校国生学名人魚本花八三十九一五四二六七安高古新白長男女気下前外間右中左後上時分円百千万年月半歳午車東道駅行西電北南見読書週毎食飲立休入出言話聞買店会社日火水木金土子父母友手足口目耳';
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 16 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '116: modul Bab 17 di kursus % tidak ditemukan — skip.', v_course_slug;
    RETURN;
  END IF;

  SELECT id INTO v_lesson_id FROM lessons
   WHERE module_id = v_module_id AND slug = v_lesson_slug;

  IF v_lesson_id IS NULL THEN
    RAISE NOTICE '116: lesson "%" belum ada (migration 107 belum jalan?) — skip.', v_lesson_slug;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_old_total FROM quiz_questions WHERE lesson_id = v_lesson_id;
  RAISE NOTICE '116: menambah もんだい4/5 ke Assignment Bab 17 ("%", sudah ada % soal).', v_module_title, v_old_total;

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
        'ミナさんは どんな おんがくが すきですか。',
        E'わたしの 名前は ミナです。わたしは しずかな おんがくが すきです。ピアノが とても 上手です。うたは 下手です。友だちの リナさんは ギターが できます。',
        NULL,
        '「わたしは しずかな おんがくが すきです」— Mina suka musik yang TENANG. どんな〜 menanyakan sifat, jadi jawabannya sifat musiknya, bukan alat musik.'),
    (52, 'reading', 1,
        'ミナさんは 何が 上手ですか。',
        E'わたしの 名前は ミナです。わたしは しずかな おんがくが すきです。ピアノが とても 上手です。うたは 下手です。友だちの リナさんは ギターが できます。',
        NULL,
        '「ピアノが とても 上手です」= sangat pandai piano. うたは 下手です justru kebalikannya; ギター adalah kemampuan Rina, bukan Mina.'),
    (53, 'reading', 1,
        'リナさんは 何が できますか。',
        E'わたしの 名前は ミナです。わたしは しずかな おんがくが すきです。ピアノが とても 上手です。うたは 下手です。友だちの リナさんは ギターが できます。',
        NULL,
        '「友だちの リナさんは ギターが できます」— Rina bisa main gitar. Piano dan menyanyi adalah tentang Mina, bukan Rina.'),

    -- ===== もんだい5 聴解 (54-57) — 4 dialog independen =====
    (54, 'listening'::TEXT, 1,
        'たなかさんは 何が 上手ですか。',
        NULL,
        E'N: ミナさんと たなかさんが 話して います。\nA: たなかさんは どんな スポーツが すきですか。\nB: サッカーが すきです。毎週 日よう日に します。\nA: サッカーが 上手ですか。\nB: いいえ、下手です。テニスは とても 上手です。',
        'Jebakan: サッカー paling sering disebut, tapi itu yang DISUKAI, bukan yang DIKUASAI. サッカーは 下手, テニスは とても 上手 — jawabannya tenis.'),
    (55, 'listening', 1,
        'りょうりが 上手な 人は だれですか。',
        NULL,
        E'N: ミナさんと おかださんが 話して います。\nA: ミナさんは りょうりが できますか。\nB: はい、すこし できます。\nA: お父さんも りょうりを しますか。\nB: いいえ、父は しません。母が とても 上手です。',
        'Mina hanya すこし できます (sedikit bisa, bukan mahir), ayah しません (tidak masak sama sekali). Yang 上手 adalah 母 (ibu).'),
    (56, 'listening', 1,
        'やまださんは 何と 言いますか。',
        NULL,
        E'N: 友だちが やまださんに ききます。\nA: やまださんは どんな 本が すきですか。',
        'Pertanyaannya どんな 本 (jenis buku apa), jadi jawaban yang tepat menyebut sifat buku + すきです, bukan jumlah/tempat/perintah.'),
    (57, 'listening', 1,
        'ミナさんは どの クラブに 入りますか。',
        NULL,
        E'N: たなか先生と ミナさんが 話して います。\nA: ミナさんは どんな クラブに 入りますか。\nB: ピアノが できます。おんがくが すきです。\nA: では、おんがくクラブは どうですか。\nB: はい、そう します。',
        'Guru mengusulkan おんがくクラブ berdasarkan alasan Mina (bisa piano, suka musik), lalu Mina menyetujui dengan 「はい、そう します」.')
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
    (51, 0, 'しずかな おんがく', TRUE), (51, 1, 'にぎやかな おんがく', FALSE), (51, 2, '新しい おんがく', FALSE), (51, 3, '古い おんがく', FALSE),
    (52, 0, 'ピアノ', TRUE), (52, 1, 'うた', FALSE), (52, 2, 'ギター', FALSE), (52, 3, 'スポーツ', FALSE),
    (53, 0, 'ギター', TRUE), (53, 1, 'ピアノ', FALSE), (53, 2, 'うた', FALSE), (53, 3, 'りょうり', FALSE),

    (54, 0, 'テニス', TRUE), (54, 1, 'サッカー', FALSE), (54, 2, 'やきゅう', FALSE), (54, 3, 'すいえい', FALSE),
    (55, 0, 'ミナさんの 母', TRUE), (55, 1, 'ミナさんの 父', FALSE), (55, 2, 'ミナさん', FALSE), (55, 3, 'おかださん', FALSE),
    (56, 0, '新しい 本が すきです。', TRUE), (56, 1, '本を 三さつ 買いました。', FALSE), (56, 2, '本やは 駅の 前です。', FALSE), (56, 3, 'その 本を 読んで ください。', FALSE),
    (57, 0, 'おんがくクラブ', TRUE), (57, 1, 'スポーツクラブ', FALSE), (57, 2, '日本語クラブ', FALSE), (57, 3, 'りょうりクラブ', FALSE)
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
    RAISE EXCEPTION '116: total soal lesson bukan 57 (dapat %)',
      (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id);
  END IF;

  IF (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id AND question_category = 'reading') <> 3
     OR (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id AND question_category = 'listening') <> 4 THEN
    RAISE EXCEPTION '116: jumlah soal reading/listening baru tidak sesuai (harap 3/4)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
      LEFT JOIN quiz_options qo ON qo.question_id = qq.id
     WHERE qq.lesson_id = v_lesson_id
     GROUP BY qq.id
    HAVING COUNT(qo.id) <> 4 OR COUNT(*) FILTER (WHERE qo.is_correct) <> 1
  ) THEN
    RAISE EXCEPTION '116: ada soal yang opsinya bukan 4 atau kuncinya bukan tepat 1';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND regexp_replace(regexp_replace(question, '<u>[^<]*</u>', '', 'g'),
             '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '116: ada kanji di luar daftar taught pada question';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND passage IS NOT NULL
       AND regexp_replace(passage, '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '116: ada kanji di luar daftar taught pada passage';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND audio_script IS NOT NULL
       AND regexp_replace(audio_script, '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '116: ada kanji di luar daftar taught pada audio_script';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '116: ada rantai の pada question';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND passage IS NOT NULL AND passage ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '116: ada rantai の pada passage';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND audio_script IS NOT NULL AND audio_script ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '116: ada rantai の pada audio_script';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
     WHERE qq.lesson_id = v_lesson_id AND qq.audio_script IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM unnest(string_to_array(qq.audio_script, E'\n')) AS line
          WHERE line !~ '^(N|A|B):\s*\S'
       )
  ) THEN
    RAISE EXCEPTION '116: ada baris audio_script yang tidak berformat "N/A/B: teks"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'reading' AND (passage IS NULL OR passage = '')
  ) THEN
    RAISE EXCEPTION '116: ada soal reading tanpa passage';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'listening' AND (audio_script IS NULL OR audio_script = '')
  ) THEN
    RAISE EXCEPTION '116: ada soal listening tanpa audio_script';
  END IF;

  RAISE NOTICE '116: selesai — Assignment Bab 17 sekarang 57 soal (vocabulary 30, grammar 20, reading 3, listening 4). questions_per_attempt di-update ke 57.';
END $$;
