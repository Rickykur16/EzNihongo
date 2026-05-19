-- Seed: 8 soal listening JLPT-style (cewe/cowo dialog) untuk testing
-- fitur listening + ElevenLabs 2-speaker.
--
-- Run: psql -U eznihongo_app -h localhost -d eznihongo -f seed-listening-jlpt.sql
--
-- Idempotent: drop & re-insert lesson "Listening JLPT-style (sample)"
-- di modul "Persiapan JLPT N5" kelas N5. Bisa di-run berulang aman.
-- Kalau modul/course belum ada, script create stub. Soal dihapus
-- dulu via FK cascade lalu insert ulang.

BEGIN;

-- Pastikan course N5 + modul persiapan ada (idempotent dengan seed-n5).
INSERT INTO courses (slug, title, description, level, sort_order, is_published)
VALUES ('n5', 'Kelas N5', 'Dari nol — hiragana, katakana, dan dasar percakapan menuju JLPT N5.', 'N5', 1, TRUE)
ON CONFLICT (slug) DO NOTHING;

WITH c AS (SELECT id FROM courses WHERE slug = 'n5')
INSERT INTO modules (course_id, slug, title, description, sort_order)
SELECT c.id, 'persiapan-jlpt-n5', 'Persiapan JLPT N5', 'Try-out & review menyeluruh', 5
FROM c
ON CONFLICT (course_id, slug) DO NOTHING;

-- Drop & re-create lesson kuis listening "Listening JLPT-style (sample)".
-- CASCADE delete buat quiz_questions + quiz_attempts row terkait.
DO $$
DECLARE
  v_module_id UUID;
  v_lesson_id UUID;
  v_section_label TEXT := '聴解 (Listening JLPT)';
  v_section_instruction TEXT := '問題：会話を 聞いて、いちばん いい 答えを 1・2・3・4から ひとつ えらんで ください。';
BEGIN
  SELECT m.id INTO v_module_id
    FROM modules m JOIN courses c ON c.id = m.course_id
   WHERE c.slug = 'n5' AND m.slug = 'persiapan-jlpt-n5'
   LIMIT 1;
  IF v_module_id IS NULL THEN
    RAISE EXCEPTION 'Module n5/persiapan-jlpt-n5 not found';
  END IF;

  -- Cari lesson yang udah ada, atau create baru.
  SELECT id INTO v_lesson_id
    FROM lessons WHERE module_id = v_module_id AND slug = 'listening-jlpt-sample'
    LIMIT 1;
  IF v_lesson_id IS NOT NULL THEN
    -- Cleanup soal lama supaya idempotent. quiz_attempts cascade.
    DELETE FROM quiz_questions WHERE lesson_id = v_lesson_id;
    UPDATE lessons SET
      type = 'quiz',
      title = 'Listening JLPT (Sample 8 soal)',
      content = 'Sample pool listening 2-speaker (cewe/cowo) buat test fitur audio dialog ElevenLabs. 8 soal pool, 5 sample per attempt.',
      duration_minutes = 12,
      sort_order = 99,
      passing_score_pct = 60,
      questions_per_attempt = 5,
      cooldown_hours = 12
    WHERE id = v_lesson_id;
  ELSE
    INSERT INTO lessons (
      module_id, slug, title, type, content, duration_minutes, sort_order,
      passing_score_pct, questions_per_attempt, cooldown_hours
    )
    VALUES (
      v_module_id, 'listening-jlpt-sample', 'Listening JLPT (Sample 8 soal)', 'quiz',
      'Sample pool listening 2-speaker (cewe/cowo) buat test fitur audio dialog ElevenLabs. 8 soal pool, 5 sample per attempt.',
      12, 99, 60, 5, 12
    )
    RETURNING id INTO v_lesson_id;
  END IF;

  -- Insert 8 soal — semua category=listening, section_number=1.
  -- Tiap soal: question text + audio_script (dialog A:cewe / B:cowo) +
  -- explanation + 4 opsi (1 benar).
  -- ────────────────────────────────────────────────────────

  -- Soal 1: Asal negara
  INSERT INTO quiz_questions (
    lesson_id, question, question_type, question_category,
    section_number, section_label, section_instruction, audio_script,
    explanation, sort_order
  ) VALUES (
    v_lesson_id,
    '男の人と女の人が話しています。女の人はどこから来ましたか。',
    'multiple_choice', 'listening', 1, v_section_label, v_section_instruction,
    E'N: 男の人と女の人が話しています。女の人はどこから来ましたか。\nB: お国は どちらですか。\nA: インドネシアです。\nB: 大きな町から 来ましたか。\nA: いいえ、小さい町から 来ました。バンドンの 近くです。',
    'Cewe bilang "小さい町から 来ました" — datang dari kota kecil dekat Bandung.',
    1
  );
  WITH q AS (SELECT id FROM quiz_questions WHERE lesson_id = v_lesson_id AND sort_order = 1)
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT q.id, opt.text, opt.is_correct, opt.ord FROM q, (VALUES
    ('1. 大きな町', FALSE, 0),
    ('2. 小さい町', TRUE, 1),
    ('3. バンドンの 中心', FALSE, 2),
    ('4. 日本', FALSE, 3)
  ) AS opt(text, is_correct, ord);

  -- Soal 2: Tempat tinggal
  INSERT INTO quiz_questions (
    lesson_id, question, question_type, question_category,
    section_number, section_label, section_instruction, audio_script,
    explanation, sort_order
  ) VALUES (
    v_lesson_id,
    '女の人は どこに 住んでいますか。',
    'multiple_choice', 'listening', 1, v_section_label, v_section_instruction,
    E'N: 男の人と女の人が話しています。女の人は どこに 住んでいますか。\nB: 田中さん、今 どこに 住んでいますか。\nA: 渋谷の マンションです。\nB: いいですね。駅から 近いですか。\nA: はい、歩いて 5分です。',
    '渋谷の マンション + 駅から 歩いて 5分.',
    2
  );
  WITH q AS (SELECT id FROM quiz_questions WHERE lesson_id = v_lesson_id AND sort_order = 2)
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT q.id, opt.text, opt.is_correct, opt.ord FROM q, (VALUES
    ('1. 渋谷駅から 歩いて 5分の マンション', TRUE, 0),
    ('2. 渋谷駅の 近くの アパート', FALSE, 1),
    ('3. 新宿の マンション', FALSE, 2),
    ('4. 駅から 遠い 場所', FALSE, 3)
  ) AS opt(text, is_correct, ord);

  -- Soal 3: Belanja
  INSERT INTO quiz_questions (
    lesson_id, question, question_type, question_category,
    section_number, section_label, section_instruction, audio_script,
    explanation, sort_order
  ) VALUES (
    v_lesson_id,
    '女の人は 何を 買いましたか。',
    'multiple_choice', 'listening', 1, v_section_label, v_section_instruction,
    E'N: お店で 女の人と 店員が 話しています。女の人は 何を 買いましたか。\nA: すみません、りんごは いくらですか。\nB: 一つ 150円です。\nA: じゃあ、三つ ください。それから、バナナも 二本 ください。\nB: はい、全部で 650円です。',
    'りんご 三つ + バナナ 二本.',
    3
  );
  WITH q AS (SELECT id FROM quiz_questions WHERE lesson_id = v_lesson_id AND sort_order = 3)
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT q.id, opt.text, opt.is_correct, opt.ord FROM q, (VALUES
    ('1. りんご 二つと バナナ 三本', FALSE, 0),
    ('2. りんご 三つと バナナ 二本', TRUE, 1),
    ('3. りんご 一つだけ', FALSE, 2),
    ('4. バナナ 三本だけ', FALSE, 3)
  ) AS opt(text, is_correct, ord);

  -- Soal 4: Janji ketemu
  INSERT INTO quiz_questions (
    lesson_id, question, question_type, question_category,
    section_number, section_label, section_instruction, audio_script,
    explanation, sort_order
  ) VALUES (
    v_lesson_id,
    '二人は いつ 会いますか。',
    'multiple_choice', 'listening', 1, v_section_label, v_section_instruction,
    E'N: 男の人と 女の人が 話しています。二人は いつ 会いますか。\nB: 土曜日 映画を 見に 行きませんか。\nA: 土曜日は ちょっと… 日曜日は どうですか。\nB: 日曜日も いいですよ。何時に 会いましょうか。\nA: 午後 2時、駅の 前で どうですか。',
    'Cewe tolak Sabtu, propose Minggu jam 2 siang.',
    4
  );
  WITH q AS (SELECT id FROM quiz_questions WHERE lesson_id = v_lesson_id AND sort_order = 4)
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT q.id, opt.text, opt.is_correct, opt.ord FROM q, (VALUES
    ('1. 土曜日の 朝', FALSE, 0),
    ('2. 土曜日の 午後 2時', FALSE, 1),
    ('3. 日曜日の 午後 2時', TRUE, 2),
    ('4. 日曜日の 朝', FALSE, 3)
  ) AS opt(text, is_correct, ord);

  -- Soal 5: Cuaca
  INSERT INTO quiz_questions (
    lesson_id, question, question_type, question_category,
    section_number, section_label, section_instruction, audio_script,
    explanation, sort_order
  ) VALUES (
    v_lesson_id,
    '明日の 天気は どうですか。',
    'multiple_choice', 'listening', 1, v_section_label, v_section_instruction,
    E'N: 女の人と 男の人が 話しています。明日の 天気は どうですか。\nA: 明日 海に 行きたいですね。\nB: でも、天気が 心配です。\nA: ニュースを 見ましたか。\nB: はい、午前中は 雨ですが、午後は 晴れるそうです。',
    '午前中は 雨、午後は 晴れる.',
    5
  );
  WITH q AS (SELECT id FROM quiz_questions WHERE lesson_id = v_lesson_id AND sort_order = 5)
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT q.id, opt.text, opt.is_correct, opt.ord FROM q, (VALUES
    ('1. 一日中 雨', FALSE, 0),
    ('2. 一日中 晴れ', FALSE, 1),
    ('3. 午前 雨、午後 晴れ', TRUE, 2),
    ('4. 午前 晴れ、午後 雨', FALSE, 3)
  ) AS opt(text, is_correct, ord);

  -- Soal 6: Telepon (alasan terlambat)
  INSERT INTO quiz_questions (
    lesson_id, question, question_type, question_category,
    section_number, section_label, section_instruction, audio_script,
    explanation, sort_order
  ) VALUES (
    v_lesson_id,
    '男の人は どうして 遅れますか。',
    'multiple_choice', 'listening', 1, v_section_label, v_section_instruction,
    E'N: 男の人が 電話で 話しています。男の人は どうして 遅れますか。\nB: もしもし、田中です。すみません、ちょっと 遅れます。\nA: あ、田中さん。どうしたんですか。\nB: 電車が 事故で 止まっているんです。\nA: そうですか。じゃあ、何時ごろ 着きますか。\nB: たぶん 30分ぐらい 遅れます。すみません。',
    '電車が 事故で 止まっている — kereta berhenti karena kecelakaan.',
    6
  );
  WITH q AS (SELECT id FROM quiz_questions WHERE lesson_id = v_lesson_id AND sort_order = 6)
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT q.id, opt.text, opt.is_correct, opt.ord FROM q, (VALUES
    ('1. 道が 混んでいるから', FALSE, 0),
    ('2. 電車が 事故で 止まっているから', TRUE, 1),
    ('3. 寝坊したから', FALSE, 2),
    ('4. 雨が 強いから', FALSE, 3)
  ) AS opt(text, is_correct, ord);

  -- Soal 7: Di kantor (lupa bawa apa)
  INSERT INTO quiz_questions (
    lesson_id, question, question_type, question_category,
    section_number, section_label, section_instruction, audio_script,
    explanation, sort_order
  ) VALUES (
    v_lesson_id,
    '女の人は 何を 忘れましたか。',
    'multiple_choice', 'listening', 1, v_section_label, v_section_instruction,
    E'N: 会社で 男の人と 女の人が 話しています。女の人は 何を 忘れましたか。\nB: 山田さん、会議の 資料 持ってきましたか。\nA: あ、すみません、机の 上に 置いて きてしまいました。\nB: えっ、本当ですか。会議は あと 10分ですよ。\nA: 今 取りに 戻ります。',
    'Lupa bawa 会議の 資料 (dokumen rapat).',
    7
  );
  WITH q AS (SELECT id FROM quiz_questions WHERE lesson_id = v_lesson_id AND sort_order = 7)
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT q.id, opt.text, opt.is_correct, opt.ord FROM q, (VALUES
    ('1. 会議の 時間', FALSE, 0),
    ('2. 会議の 場所', FALSE, 1),
    ('3. 会議の 資料', TRUE, 2),
    ('4. ノートパソコン', FALSE, 3)
  ) AS opt(text, is_correct, ord);

  -- Soal 8: Restoran
  INSERT INTO quiz_questions (
    lesson_id, question, question_type, question_category,
    section_number, section_label, section_instruction, audio_script,
    explanation, sort_order
  ) VALUES (
    v_lesson_id,
    '女の人は 何を 注文しましたか。',
    'multiple_choice', 'listening', 1, v_section_label, v_section_instruction,
    E'N: レストランで 男の人と 女の人が 話しています。女の人は 何を 注文しましたか。\nB: 何に しますか。\nA: そうですね… ラーメンは ちょっと 重いから、うどんに します。\nB: 飲み物は？\nA: 温かい お茶を ください。\nB: 私は ラーメンと コーラに します。',
    'Cewe pilih うどん + 温かい お茶. Yang ラーメン itu cowo-nya.',
    8
  );
  WITH q AS (SELECT id FROM quiz_questions WHERE lesson_id = v_lesson_id AND sort_order = 8)
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT q.id, opt.text, opt.is_correct, opt.ord FROM q, (VALUES
    ('1. ラーメンと コーラ', FALSE, 0),
    ('2. ラーメンと 温かい お茶', FALSE, 1),
    ('3. うどんと コーラ', FALSE, 2),
    ('4. うどんと 温かい お茶', TRUE, 3)
  ) AS opt(text, is_correct, ord);

  RAISE NOTICE 'Listening JLPT sample seeded: lesson_id = %', v_lesson_id;
END $$;

COMMIT;
