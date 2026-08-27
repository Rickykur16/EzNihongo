-- 111_assignment_bab12_dokkai_listening.sql — Tambah もんだい4 Dokkai +
-- もんだい5 Listening ke Assignment Bab 12 (migration 100).
--
-- LATAR BELAKANG: Assignment Bab 12-20 (migrasi 100/104/103/105-110) hanya
-- menguji vocabulary + grammar (漢字読み/表記/文脈規定/文の文法1, 50 soal),
-- mengikuti pola persis Bab 1-11 (039-061). User menyadari dokkai (読解)
-- dan choukai (聴解) — dua bagian JLPT asli — tidak pernah masuk Assignment
-- sama sekali, walau kolomnya (question_category IN ('reading','listening'),
-- passage, audio_script) sudah ada sejak lama (migration 012/013/034) dan
-- dipakai fitur lain (generator JLPT dokkai/listening terpisah). Keputusan
-- user: EXTEND lesson Assignment yang sudah ada (bukan bikin lesson baru),
-- satu migrasi tambahan per bab (111-119), agar satu lesson quiz tetap jadi
-- satu-satunya "ujian akhir bab".
--
-- ISI TAMBAHAN (sama untuk semua bab 111-119): もんだい4 漢字読解 (短文,
-- 1 passage + 3 soal) + もんだい5 聴解 (4 dialog independen, masing-masing
-- audio_script sendiri, 1 soal per dialog) = 7 soal baru. Total lesson naik
-- dari 50 → 57; questions_per_attempt di-update ke 57 supaya kebijakan
-- "semua soal tampil tiap attempt" (established sejak Bab 8/055) tetap
-- berlaku dgn soal baru.
--
-- ISI Bab 12 digrounding ke te-form (tema bab ini) + whitelist kanji SAMA
-- PERSIS dengan 100/081 (068 karakter — lihat catatan v_kanji_ok). Drafting
-- awal (subagent) menemukan jebakan baru: kalimat narator standar JLPT
-- "男の人と女の人が話しています" adalah rantai の (男の人＋女の人 = 2 の),
-- jadi listening di sini pakai NAMA (ミナさん／たなかさん) untuk kedua
-- pembicara, bukan "男の人／女の人" generik — CATAT untuk migrasi 112-119
-- juga supaya tidak mengulang jebakan yang sama.
--
-- 〜てください dan 〜ています SENGAJA tidak dipakai di listening Bab 12 —
-- keduanya baru diajarkan Bab 13 (lihat 082/090). Listening Bab 12 hanya
-- memakai 〜て、〜 dan 〜てから, konsisten dengan pagar grammar 100.
--
-- ASSERTION BARU (di luar 6 assertion existing 100, yang tetap berlaku utuh
-- karena WHERE lesson_id = v_lesson_id mencakup semua soal termasuk yang
-- baru): kanji whitelist + rantai の kini JUGA dicek pada kolom `passage`
-- dan `audio_script` (bukan cuma `question` seperti di 100 — makna kalimat
-- dokkai/listening yang sesungguhnya ada di dua kolom itu, bukan di
-- `question` yang cuma berisi kalimat tanya pendek), plus format baris
-- audio_script wajib "SPEAKER: teks" dengan SPEAKER hanya N/A/B (subset
-- dari SPEAKER_RE di backend/src/routes/tts.js parseDialog()).
--
-- Idempotent: DELETE hanya menyasar question_category IN ('reading',
-- 'listening') milik lesson ini (bukan seluruh lesson) supaya re-run tidak
-- menghapus 50 soal vocabulary/grammar dari migration 100; lesson di-resolve
-- via slug yang sama dengan 100 (tidak insert lesson baru).

DO $$
DECLARE
  v_course_slug  TEXT := 'n5';
  v_lesson_slug  TEXT := 'assignment-bab-12-te-form';
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
   OFFSET 11 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '111: modul Bab 12 di kursus % tidak ditemukan — skip.', v_course_slug;
    RETURN;
  END IF;

  SELECT id INTO v_lesson_id FROM lessons
   WHERE module_id = v_module_id AND slug = v_lesson_slug;

  IF v_lesson_id IS NULL THEN
    RAISE NOTICE '111: lesson "%" belum ada (migration 100 belum jalan?) — skip.', v_lesson_slug;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_old_total FROM quiz_questions WHERE lesson_id = v_lesson_id;
  RAISE NOTICE '111: menambah もんだい4/5 ke Assignment Bab 12 ("%", sudah ada % soal).', v_module_title, v_old_total;

  -- Bersihkan dokkai/listening lama (kalau migrasi ini di-re-run manual) —
  -- TIDAK menyentuh soal vocabulary/grammar dari migration 100.
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
        'ミナさんは 学校が おわってから、どこへ 行きましたか。',
        'ミナさんは まいにち 学校へ 行きます。学校が おわってから、駅前の 本やへ 行きます。きのう、そこで 新しい 本を かって、六時に うちへ かえりました。うちで ばんごはんを 食べて、シャワーを あびました。それから、かった 本を 読んで、十一時に ねました。',
        NULL,
        'Bacaan menyebut 「学校が おわってから、駅前の 本やへ 行きます」 — setelah sekolah, Mina pergi ke toko buku. Rumah baru didatangi jam 6, setelah dari toko buku.'),
    (52, 'reading', 1,
        'ミナさんは ばんごはんを 食べてから、何を しましたか。',
        'ミナさんは まいにち 学校へ 行きます。学校が おわってから、駅前の 本やへ 行きます。きのう、そこで 新しい 本を かって、六時に うちへ かえりました。うちで ばんごはんを 食べて、シャワーを あびました。それから、かった 本を 読んで、十一時に ねました。',
        NULL,
        'Urutannya 「ばんごはんを 食べて、シャワーを あびました」. Membeli buku dan pulang terjadi SEBELUM makan malam, dan tidur terjadi paling akhir setelah membaca buku.'),
    (53, 'reading', 1,
        'ミナさんは 何時に うちへ かえりましたか。',
        'ミナさんは まいにち 学校へ 行きます。学校が おわってから、駅前の 本やへ 行きます。きのう、そこで 新しい 本を かって、六時に うちへ かえりました。うちで ばんごはんを 食べて、シャワーを あびました。それから、かった 本を 読んで、十一時に ねました。',
        NULL,
        '「六時に うちへ かえりました」. 十一時 adalah jam tidur, bukan jam pulang — jebakan detail angka.'),

    -- ===== もんだい5 聴解 (54-57) — 4 dialog independen =====
    (54, 'listening'::TEXT, 1,
        '二人は どこで あいますか。',
        NULL,
        E'N: 学校で たなかさんと ミナさんが はなします。\nA: たなかさん、これから 何を しますか。\nB: ひるごはんを 食べて、それから 本やへ 行きます。\nA: わたしも 本やへ 行きます。\nB: じゃあ、ごはんを 食べてから、駅の まえで まちます。',
        'Tanaka bilang 「ごはんを 食べてから、駅の まえで まちます」 — mereka bertemu di depan stasiun. 本や memang tujuan keduanya, tapi itu tempat SETELAH bertemu, bukan tempat bertemunya.'),
    (55, 'listening', 1,
        'ミナさんは あさ 何を しましたか。',
        NULL,
        E'N: ミナさんと たなかさんが はなします。\nA: にちようび、何を しましたか。\nB: あさ うちで さらを あらって、ひるから 駅前の 本やへ 行きました。\nA: そうですか。わたしは あさ およいで、それから 魚を 食べました。\nB: いいですね。',
        'Yang berenang pagi hari adalah Mina (「わたしは あさ およいで…」). Mencuci piring dan pergi ke toko buku itu kegiatan Tanaka.'),
    (56, 'listening', 1,
        'たなかさんは 何と こたえますか。',
        NULL,
        E'N: ミナさんが たなかさんに しつもんします。\nA: きのう、うちへ かえってから 何を しましたか。',
        'Pertanyaannya menanyakan kegiatan setelah pulang kemarin, jadi jawaban harus rangkaian aksi bentuk lampau (本を 読んで、ねました).'),
    (57, 'listening', 1,
        'ミナさんは 何と こたえますか。',
        NULL,
        E'N: たなかさんが ミナさんに しつもんします。\nA: 先週の にちようび、何を しましたか。',
        'Ditanya kegiatan hari Minggu lalu, jawabannya bentuk lampau berurutan dengan 〜て、〜 (電車で 東の 駅へ 行って、魚を 食べました).')
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
    (51, 0, '本や', TRUE), (51, 1, '学校', FALSE), (51, 2, 'うち', FALSE), (51, 3, 'レストラン', FALSE),
    (52, 0, 'シャワーを あびました。', TRUE), (52, 1, '本を かいました。', FALSE), (52, 2, 'うちへ かえりました。', FALSE), (52, 3, 'すぐ ねました。', FALSE),
    (53, 0, '六時', TRUE), (53, 1, '五時', FALSE), (53, 2, '七時', FALSE), (53, 3, '十一時', FALSE),

    (54, 0, '駅の まえ', TRUE), (54, 1, '学校の まえ', FALSE), (54, 2, '本や', FALSE), (54, 3, 'うち', FALSE),
    (55, 0, 'およぎました。', TRUE), (55, 1, 'さらを あらいました。', FALSE), (55, 2, '本やへ 行きました。', FALSE), (55, 3, '魚を かいました。', FALSE),
    (56, 0, '本を 読んで、ねました。', TRUE), (56, 1, 'はい、うちに います。', FALSE), (56, 2, 'あした 学校へ 行きます。', FALSE), (56, 3, 'みずを 飲みます。', FALSE),
    (57, 0, '電車で 東の 駅へ 行って、魚を 食べました。', TRUE), (57, 1, 'まいにち およぎます。', FALSE), (57, 2, 'はい、行きます。', FALSE), (57, 3, 'あさ 六時に おきます。', FALSE)
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
    RAISE EXCEPTION '111: total soal lesson bukan 57 (dapat %)',
      (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id);
  END IF;

  IF (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id AND question_category = 'reading') <> 3
     OR (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = v_lesson_id AND question_category = 'listening') <> 4 THEN
    RAISE EXCEPTION '111: jumlah soal reading/listening baru tidak sesuai (harap 3/4)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
      LEFT JOIN quiz_options qo ON qo.question_id = qq.id
     WHERE qq.lesson_id = v_lesson_id
     GROUP BY qq.id
    HAVING COUNT(qo.id) <> 4 OR COUNT(*) FILTER (WHERE qo.is_correct) <> 1
  ) THEN
    RAISE EXCEPTION '111: ada soal yang opsinya bukan 4 atau kuncinya bukan tepat 1';
  END IF;

  -- Pagar kanji: `question` (existing, dari 100) + `passage` + `audio_script`
  -- (kolom baru — makna kalimat sesungguhnya ada di sini, bukan di `question`
  -- yang cuma kalimat tanya pendek).
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id
       AND regexp_replace(regexp_replace(question, '<u>[^<]*</u>', '', 'g'),
             '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '111: ada kanji di luar daftar taught pada question';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND passage IS NOT NULL
       AND regexp_replace(passage, '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '111: ada kanji di luar daftar taught pada passage';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND audio_script IS NOT NULL
       AND regexp_replace(audio_script, '[' || v_kanji_ok || ']', '', 'g') ~ '[一-龯]'
  ) THEN
    RAISE EXCEPTION '111: ada kanji di luar daftar taught pada audio_script';
  END IF;

  -- Rantai の: sekarang juga dicek pada passage + audio_script.
  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '111: ada rantai の pada question';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND passage IS NOT NULL AND passage ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '111: ada rantai の pada passage';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND audio_script IS NOT NULL AND audio_script ~ 'の[^。]*の'
  ) THEN
    RAISE EXCEPTION '111: ada rantai の pada audio_script';
  END IF;

  -- Format audio_script: tiap baris wajib "SPEAKER: teks" dengan SPEAKER
  -- hanya N/A/B (subset SPEAKER_RE di backend/src/routes/tts.js).
  IF EXISTS (
    SELECT 1 FROM quiz_questions qq
     WHERE qq.lesson_id = v_lesson_id AND qq.audio_script IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM unnest(string_to_array(qq.audio_script, E'\n')) AS line
          WHERE line !~ '^(N|A|B):\s*\S'
       )
  ) THEN
    RAISE EXCEPTION '111: ada baris audio_script yang tidak berformat "N/A/B: teks"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'reading' AND (passage IS NULL OR passage = '')
  ) THEN
    RAISE EXCEPTION '111: ada soal reading tanpa passage';
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_questions
     WHERE lesson_id = v_lesson_id AND question_category = 'listening' AND (audio_script IS NULL OR audio_script = '')
  ) THEN
    RAISE EXCEPTION '111: ada soal listening tanpa audio_script';
  END IF;

  RAISE NOTICE '111: selesai — Assignment Bab 12 sekarang 57 soal (vocabulary 30, grammar 20, reading 3, listening 4). questions_per_attempt di-update ke 57.';
END $$;
