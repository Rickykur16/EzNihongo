-- 115_assignment_bab16_dokkai_listening.sql — Tambah もんだい4 Dokkai +
-- もんだい5 Listening ke Assignment Bab 16 (migration 106).
--
-- Bagian kelima dari seri 111-119. Lihat 111_assignment_bab12_dokkai_
-- listening.sql untuk penjelasan pola lengkap: EXTEND lesson existing,
-- DELETE hanya menyasar question_category IN ('reading','listening'),
-- assertion kanji whitelist + rantai-の diperluas ke `passage`/`audio_script`,
-- format audio_script wajib "SPEAKER: teks" (N/A/B), questions_per_attempt
-- di-update ke total baru.
--
-- GRAMMAR SCOPE Bab 16 (085_bunpou_bab16.sql): 〜に (partikel waktu untuk
-- titik waktu spesifik: jam/hari/tanggal — TIDAK dipakai untuk waktu
-- relatif seperti あした/まいにち), 〜月〜日 (format tanggal), 毎週／毎月／
-- 毎年, 何曜日／何月何日／いつ. Kanji whitelist = whitelist Bab 12-15 (78
-- karakter) UNION 6 kanji baru Bab 16 (日火水木金土) — identik dengan
-- v_kanji_ok di 106_assignment_bab16_waktu_tanggal.sql. 曜 (dalam ようび)
-- TIDAK diajarkan — selalu kana. 京 (dalam 東京) JUGA tidak diajarkan
-- (hanya 東 yang taught) — ditulis とうきょう kana penuh, jebakan yang
-- ditemukan saat drafting (draft pertama sempat pakai 東京 kanji).
--
-- SENGAJA TIDAK memakai: でも／そして／それから／〜が、〜 (direservasi
-- Bab 20, larangan eksplisit di prompt sejak migration 114 — bersih tanpa
-- revisi lagi) dan seluruh grammar Bab 17-20 (好き/上手/できます, 比較,
-- たいです/ほしい/つもり/予定, たことがあります, dst).
--
-- Listening pakai nama (ミナさん／たなかさん／おかださん／やまださん),
-- melanjutkan pola 111-114. Jebakan klasik JLPT choukai: beberapa hari/
-- tanggal disebut dalam satu dialog, siswa harus menyimak SAMPAI AKHIR
-- untuk tahu yang mana yang benar-benar berlaku (dialog 2: rapat berubah
-- dari 六月八日 ke 六月九日; dialog 4: kebiasaan 十二月 tapi tahun ini
-- 一月十五日).
--
-- Idempotent: DELETE hanya menyasar question_category IN ('reading',
-- 'listening') milik lesson ini; lesson di-resolve via slug yang sama
-- dengan 106 (tidak insert lesson baru).

DO $$
DECLARE
  v_course_slug  TEXT := 'n5';
  v_lesson_slug  TEXT := 'assignment-bab-16-waktu-tanggal';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson_id    UUID;
  v_old_total    INT;
  v_kanji_ok     TEXT := '先何語校国生学名人魚本花八三十九一五四二六七安高古新白長男女気下前外間右中左後上時分円百千万年月半歳午車東道駅行西電北南見読書週毎食飲立休入出言話聞買店会社日火水木金土';
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 15 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '115: modul Bab 16 di kursus % tidak ditemukan — skip.', v_course_slug;
    RETURN;
  END IF;

  SELECT id INTO v_lesson_id FROM lessons
   WHERE module_id = v_module_id AND slug = v_lesson_slug;

  IF v_lesson_id IS NULL THEN
    RAISE NOTICE '115: lesson "%" belum ada (migration 106 belum jalan?) — skip.', v_lesson_slug;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_old_total FROM quiz_questions WHERE lesson_id = v_lesson_id;
  RAISE NOTICE '115: menambah もんだい4/5 ke Assignment Bab 16 ("%", sudah ada % soal).', v_module_title, v_old_total;

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
        'ミナさんは 何ようびに 学校へ 行きますか。',
        E'ミナさんは 毎週 火ようびと 木ようびに 日本語の 学校へ 行きます。月ようびと 水ようびと 金ようびは 会社で はたらきます。六月十日に 学校で テストが あります。テストの 日は 土ようびです。ミナさんは 毎月 一日に 新しい 本を 買います。',
        NULL,
        '「毎週 火ようびと 木ようびに 学校へ 行きます」— ke sekolah setiap Selasa dan Kamis. Pilihan lain memakai hari kerja kantor (Senin/Rabu/Jumat) dan hari ujian (Sabtu).'),
    (52, 'reading', 1,
        'テストは いつ ありますか。',
        E'ミナさんは 毎週 火ようびと 木ようびに 日本語の 学校へ 行きます。月ようびと 水ようびと 金ようびは 会社で はたらきます。六月十日に 学校で テストが あります。テストの 日は 土ようびです。ミナさんは 毎月 一日に 新しい 本を 買います。',
        NULL,
        '「六月十日に テストが あります」= ujian tanggal 10 Juni. 六月一日 tertukar dengan hari beli buku (毎月 一日).'),
    (53, 'reading', 1,
        'ミナさんは 毎月 一日に 何を しますか。',
        E'ミナさんは 毎週 火ようびと 木ようびに 日本語の 学校へ 行きます。月ようびと 水ようびと 金ようびは 会社で はたらきます。六月十日に 学校で テストが あります。テストの 日は 土ようびです。ミナさんは 毎月 一日に 新しい 本を 買います。',
        NULL,
        '「毎月 一日に 新しい 本を 買います」= setiap tanggal 1 membeli buku baru. Sekolah/kantor terikat pada hari (ようび), bukan tanggal 1.'),

    -- ===== もんだい5 聴解 (54-57) — 4 dialog independen =====
    (54, 'listening'::TEXT, 1,
        'ふたりは 何ようびに べんきょうしますか。',
        NULL,
        E'N: 学校で ミナさんと たなかさんが 話しています。\nA: たなかさん、テストは 何ようびですか。\nB: 木ようびです。\nA: 水ようびに いっしょに べんきょうします。学校へ きてください。\nB: すみません、水ようびは 会社へ 行きます。火ようびに べんきょうします。\nA: わかりました。',
        '木ようび = hari ujian, 水ようび diusulkan Mina tapi ditolak Tanaka (harus ke kantor), lalu diganti ke 火ようび dan disetujui.'),
    (55, 'listening', 1,
        'かいぎは いつ ありますか。',
        NULL,
        E'N: 会社で やまださんと おかださんが 話しています。\nA: かいぎは 六月八日ですか。\nB: いいえ、六月八日は やすみです。六月九日に なりました。\nA: では、六月九日の 午前 九時に 会社へ 行きます。\nB: おねがいします。',
        '六月八日 disebut lebih dulu tapi ternyata libur — rapat berubah jadi 「六月九日に なりました」.'),
    (56, 'listening', 1,
        'おかださんは 日ようびに 何を しますか。',
        NULL,
        E'N: 駅で ミナさんと おかださんが 話しています。\nA: おかださんは 毎月 とうきょうへ 行きますか。\nB: はい。毎月 二十日に 行きます。\nA: 毎週 土ようびは 何を しますか。\nB: 土ようびは うちで 休みます。日ようびに 花を 買います。',
        '土ようび = istirahat di rumah, 日ようび = membeli bunga. Pergi ke Tokyo adalah acara BULANAN tanggal 20, bukan hari Minggu.'),
    (57, 'listening', 1,
        'やまださんは いつ 国へ かえりますか。',
        NULL,
        E'N: 会社で たなかさんと やまださんが 話しています。\nA: 毎年 十二月に 国へ かえりますか。\nB: いいえ、ことしは 一月に かえります。\nA: 何日に かえりますか。\nB: 一月十五日に かえります。',
        '毎年 十二月 adalah kebiasaan, tapi tahun ini (ことし) Yamada pulang 「一月十五日に」.')
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
    (51, 0, '火ようびと 木ようび', TRUE), (51, 1, '月ようびと 水ようび', FALSE), (51, 2, '金ようびと 土ようび', FALSE), (51, 3, '水ようびと 金ようび', FALSE),
    (52, 0, '六月十日', TRUE), (52, 1, '六月一日', FALSE), (52, 2, '十月六日', FALSE), (52, 3, '一月十日', FALSE),
    (53, 0, '新しい 本を 買います', TRUE), (53, 1, '学校へ 行きます', FALSE), (53, 2, '会社で はたらきます', FALSE), (53, 3, 'テストを うけます', FALSE),

    (54, 0, '火ようび', TRUE), (54, 1, '水ようび', FALSE), (54, 2, '木ようび', FALSE), (54, 3, '金ようび', FALSE),
    (55, 0, '六月九日', TRUE), (55, 1, '六月八日', FALSE), (55, 2, '九月六日', FALSE), (55, 3, '六月十日', FALSE),
    (56, 0, '花を 買います', TRUE), (56, 1, 'とうきょうへ 行きます', FALSE), (56, 2, 'うちで 休みます', FALSE), (56, 3, '本を 読みます', FALSE),
    (57, 0, '一月十五日', TRUE), (57, 1, '十二月十五日', FALSE), (57, 2, '一月十二日', FALSE), (57, 3, '十二月三日', FALSE)
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
    RAISE EXCEPTION '115: total soal lesson bukan 57 (dapat %)',
      (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id);
  END IF;

  IF (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id AND question_category = 'reading') <> 3
     OR (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id AND question_category = 'listening') <> 4 THEN
    RAISE EXCEPTION '115: jumlah soal reading/listening baru tidak sesuai (harap 3/4)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
      LEFT JOIN quiz_options qo ON qo.question_id = qq.id
     WHERE qq.lesson_id = v_lesson_id
     GROUP BY qq.id
    HAVING COUNT(qo.id) <> 4 OR COUNT(*) FILTER (WHERE qo.is_correct) <> 1
  ) THEN
    RAISE EXCEPTION '115: ada soal yang opsinya bukan 4 atau kuncinya bukan tepat 1';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND regexp_replace(regexp_replace(question, '<u>[^<]*</u>', '', 'g'),
             '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '115: ada kanji di luar daftar taught pada question';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND passage IS NOT NULL
       AND regexp_replace(passage, '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '115: ada kanji di luar daftar taught pada passage';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND audio_script IS NOT NULL
       AND regexp_replace(audio_script, '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '115: ada kanji di luar daftar taught pada audio_script';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '115: ada rantai の pada question';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND passage IS NOT NULL AND passage ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '115: ada rantai の pada passage';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND audio_script IS NOT NULL AND audio_script ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '115: ada rantai の pada audio_script';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
     WHERE qq.lesson_id = v_lesson_id AND qq.audio_script IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM unnest(string_to_array(qq.audio_script, E'\n')) AS line
          WHERE line !~ '^(N|A|B):\s*\S'
       )
  ) THEN
    RAISE EXCEPTION '115: ada baris audio_script yang tidak berformat "N/A/B: teks"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'reading' AND (passage IS NULL OR passage = '')
  ) THEN
    RAISE EXCEPTION '115: ada soal reading tanpa passage';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'listening' AND (audio_script IS NULL OR audio_script = '')
  ) THEN
    RAISE EXCEPTION '115: ada soal listening tanpa audio_script';
  END IF;

  RAISE NOTICE '115: selesai — Assignment Bab 16 sekarang 57 soal (vocabulary 30, grammar 20, reading 3, listening 4). questions_per_attempt di-update ke 57.';
END $$;
