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

  -- ────────────────────────────────────────────────────────
  -- BATCH 2: 10 soal tambahan (sort_order 9-18) — topik:
  -- transportasi, hobi, keluarga, sakit, bandara, pakaian,
  -- perpustakaan, ultah, olahraga, sekolah.
  -- ────────────────────────────────────────────────────────

  -- Soal 9: Transportasi
  INSERT INTO quiz_questions (
    lesson_id, question, question_type, question_category,
    section_number, section_label, section_instruction, audio_script,
    explanation, sort_order
  ) VALUES (
    v_lesson_id,
    '男の人は きょう どうやって 駅まで 行きますか。',
    'multiple_choice', 'listening', 1, v_section_label, v_section_instruction,
    E'N: 男の人と 女の人が 話しています。男の人は きょう どうやって 駅まで 行きますか。\nA: 駅まで どうやって 行きますか。\nB: 普段は バスですが、今日は 雨だから タクシーに します。\nA: そうですね、いい考えです。\nB: バス停まで 歩きたくないんです。',
    'Cowo bilang "今日は 雨だから タクシーに します" — hari ini hujan jadi naik taksi.',
    9
  );
  WITH q AS (SELECT id FROM quiz_questions WHERE lesson_id = v_lesson_id AND sort_order = 9)
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT q.id, opt.text, opt.is_correct, opt.ord FROM q, (VALUES
    ('1. バス', FALSE, 0),
    ('2. 電車', FALSE, 1),
    ('3. タクシー', TRUE, 2),
    ('4. 自転車', FALSE, 3)
  ) AS opt(text, is_correct, ord);

  -- Soal 10: Hobi
  INSERT INTO quiz_questions (
    lesson_id, question, question_type, question_category,
    section_number, section_label, section_instruction, audio_script,
    explanation, sort_order
  ) VALUES (
    v_lesson_id,
    '女の人の 趣味は 何ですか。',
    'multiple_choice', 'listening', 1, v_section_label, v_section_instruction,
    E'N: 女の人と 男の人が 話しています。女の人の 趣味は 何ですか。\nA: 週末は 何を しますか。\nB: 私は 友達と サッカーを します。あなたは？\nA: 本を 読んだり、映画を 見たり します。特に 日本の 映画が 好きです。\nB: いいですね。',
    'Cewe (A) bilang dia baca buku & nonton film, suka film Jepang. Cowo yang sepak bola.',
    10
  );
  WITH q AS (SELECT id FROM quiz_questions WHERE lesson_id = v_lesson_id AND sort_order = 10)
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT q.id, opt.text, opt.is_correct, opt.ord FROM q, (VALUES
    ('1. サッカー', FALSE, 0),
    ('2. 読書と 映画', TRUE, 1),
    ('3. 旅行', FALSE, 2),
    ('4. 料理', FALSE, 3)
  ) AS opt(text, is_correct, ord);

  -- Soal 11: Keluarga
  INSERT INTO quiz_questions (
    lesson_id, question, question_type, question_category,
    section_number, section_label, section_instruction, audio_script,
    explanation, sort_order
  ) VALUES (
    v_lesson_id,
    '男の人の 家族は 何人ですか。',
    'multiple_choice', 'listening', 1, v_section_label, v_section_instruction,
    E'N: 女の人が 男の人に 家族について 聞いています。男の人の 家族は 何人ですか。\nA: ご家族は 何人ですか。\nB: 5人です。父、母、姉、弟、そして 私です。\nA: 大きい 家族ですね。お姉さんは おいくつですか。\nB: 25歳です。看護師です。',
    'Cowo sebutin 5 orang: ayah, ibu, kakak cewe, adik cowo, dan dia sendiri.',
    11
  );
  WITH q AS (SELECT id FROM quiz_questions WHERE lesson_id = v_lesson_id AND sort_order = 11)
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT q.id, opt.text, opt.is_correct, opt.ord FROM q, (VALUES
    ('1. 3人', FALSE, 0),
    ('2. 4人', FALSE, 1),
    ('3. 5人', TRUE, 2),
    ('4. 6人', FALSE, 3)
  ) AS opt(text, is_correct, ord);

  -- Soal 12: Di dokter
  INSERT INTO quiz_questions (
    lesson_id, question, question_type, question_category,
    section_number, section_label, section_instruction, audio_script,
    explanation, sort_order
  ) VALUES (
    v_lesson_id,
    '患者は どこが 痛いですか。',
    'multiple_choice', 'listening', 1, v_section_label, v_section_instruction,
    E'N: 病院で 医者と 患者が 話しています。患者は どこが 痛いですか。\nA: どうしましたか。\nB: 昨日から 頭が ずきずきして、熱も あります。\nA: のどは どうですか。\nB: のども 少し 痛いです。',
    'Pasien (cowo) bilang "頭が ずきずき" + "のども 少し 痛い" — kepala + tenggorokan sakit.',
    12
  );
  WITH q AS (SELECT id FROM quiz_questions WHERE lesson_id = v_lesson_id AND sort_order = 12)
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT q.id, opt.text, opt.is_correct, opt.ord FROM q, (VALUES
    ('1. お腹だけ', FALSE, 0),
    ('2. 頭と のど', TRUE, 1),
    ('3. 足', FALSE, 2),
    ('4. 目', FALSE, 3)
  ) AS opt(text, is_correct, ord);

  -- Soal 13: Bandara
  INSERT INTO quiz_questions (
    lesson_id, question, question_type, question_category,
    section_number, section_label, section_instruction, audio_script,
    explanation, sort_order
  ) VALUES (
    v_lesson_id,
    '飛行機は 何時に 出発しますか。',
    'multiple_choice', 'listening', 1, v_section_label, v_section_instruction,
    E'N: 空港で 女の人と 男の人が 話しています。飛行機は 何時に 出発しますか。\nA: すみません、東京行きの 飛行機は 何時ですか。\nB: 14時 30分です。\nA: 今、12時ですから、まだ 時間が ありますね。\nB: はい、2時間半 待ちます。',
    'Cowo bilang "14時 30分です" — jam 14:30.',
    13
  );
  WITH q AS (SELECT id FROM quiz_questions WHERE lesson_id = v_lesson_id AND sort_order = 13)
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT q.id, opt.text, opt.is_correct, opt.ord FROM q, (VALUES
    ('1. 12時', FALSE, 0),
    ('2. 14時', FALSE, 1),
    ('3. 14時 30分', TRUE, 2),
    ('4. 16時 30分', FALSE, 3)
  ) AS opt(text, is_correct, ord);

  -- Soal 14: Belanja baju
  INSERT INTO quiz_questions (
    lesson_id, question, question_type, question_category,
    section_number, section_label, section_instruction, audio_script,
    explanation, sort_order
  ) VALUES (
    v_lesson_id,
    '女の人は どんな 服を 探していますか。',
    'multiple_choice', 'listening', 1, v_section_label, v_section_instruction,
    E'N: 店で 女の人と 店員が 話しています。女の人は どんな 服を 探していますか。\nA: いらっしゃいませ。\nB: あの、白い シャツを 探しています。\nA: サイズは？\nB: Mサイズで お願いします。長袖が いいです。\nA: こちらは どうですか。',
    'Cewe nyari "白い シャツ" + "Mサイズ" + "長袖" — kemeja putih lengan panjang M.',
    14
  );
  WITH q AS (SELECT id FROM quiz_questions WHERE lesson_id = v_lesson_id AND sort_order = 14)
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT q.id, opt.text, opt.is_correct, opt.ord FROM q, (VALUES
    ('1. 黒い 半袖 シャツ', FALSE, 0),
    ('2. 白い 長袖 シャツ', TRUE, 1),
    ('3. 青い T シャツ', FALSE, 2),
    ('4. 赤い ワンピース', FALSE, 3)
  ) AS opt(text, is_correct, ord);

  -- Soal 15: Perpustakaan
  INSERT INTO quiz_questions (
    lesson_id, question, question_type, question_category,
    section_number, section_label, section_instruction, audio_script,
    explanation, sort_order
  ) VALUES (
    v_lesson_id,
    '日本語の 本は 何階に ありますか。',
    'multiple_choice', 'listening', 1, v_section_label, v_section_instruction,
    E'N: 男の人と 女の人が 図書館で 話しています。日本語の 本は 何階に ありますか。\nA: すみません、日本語の 本は 何階に ありますか。\nB: 3階です。雑誌は 2階ですよ。\nA: わかりました。\nB: 漫画は 4階に あります。',
    'Pegawai (B/cowo) bilang "日本語の 本は 3階". Majalah lt 2, manga lt 4.',
    15
  );
  WITH q AS (SELECT id FROM quiz_questions WHERE lesson_id = v_lesson_id AND sort_order = 15)
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT q.id, opt.text, opt.is_correct, opt.ord FROM q, (VALUES
    ('1. 2階', FALSE, 0),
    ('2. 3階', TRUE, 1),
    ('3. 4階', FALSE, 2),
    ('4. 5階', FALSE, 3)
  ) AS opt(text, is_correct, ord);

  -- Soal 16: Ulang tahun
  INSERT INTO quiz_questions (
    lesson_id, question, question_type, question_category,
    section_number, section_label, section_instruction, audio_script,
    explanation, sort_order
  ) VALUES (
    v_lesson_id,
    '誕生日 パーティーは 何曜日ですか。',
    'multiple_choice', 'listening', 1, v_section_label, v_section_instruction,
    E'N: 二人が パーティーについて 話しています。誕生日 パーティーは 何曜日ですか。\nA: 来週、太郎さんの 誕生日 パーティーですね。\nB: ええ、土曜日です。何を プレゼントしますか。\nA: 私は 本に します。\nB: 私は ケーキを 作ります。',
    'Cowo bilang "土曜日です" — hari Sabtu.',
    16
  );
  WITH q AS (SELECT id FROM quiz_questions WHERE lesson_id = v_lesson_id AND sort_order = 16)
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT q.id, opt.text, opt.is_correct, opt.ord FROM q, (VALUES
    ('1. 月曜日', FALSE, 0),
    ('2. 水曜日', FALSE, 1),
    ('3. 金曜日', FALSE, 2),
    ('4. 土曜日', TRUE, 3)
  ) AS opt(text, is_correct, ord);

  -- Soal 17: Olahraga
  INSERT INTO quiz_questions (
    lesson_id, question, question_type, question_category,
    section_number, section_label, section_instruction, audio_script,
    explanation, sort_order
  ) VALUES (
    v_lesson_id,
    '男の人は 週末 何を しますか。',
    'multiple_choice', 'listening', 1, v_section_label, v_section_instruction,
    E'N: 二人が 話しています。男の人は 週末 何を しますか。\nA: 週末は 何を しますか。\nB: 朝 ジョギングを して、午後 友達と テニスを します。\nA: 健康的ですね。私は 家で 寝ます。\nB: たまには 運動しましょう。',
    'Cowo (B) bilang "ジョギング" + "テニス" — joging pagi + tenis sore.',
    17
  );
  WITH q AS (SELECT id FROM quiz_questions WHERE lesson_id = v_lesson_id AND sort_order = 17)
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT q.id, opt.text, opt.is_correct, opt.ord FROM q, (VALUES
    ('1. 家で 寝る', FALSE, 0),
    ('2. ジョギングと テニス', TRUE, 1),
    ('3. サッカー', FALSE, 2),
    ('4. 料理', FALSE, 3)
  ) AS opt(text, is_correct, ord);

  -- Soal 18: Sekolah (telat)
  INSERT INTO quiz_questions (
    lesson_id, question, question_type, question_category,
    section_number, section_label, section_instruction, audio_script,
    explanation, sort_order
  ) VALUES (
    v_lesson_id,
    '学生は どうして 遅れましたか。',
    'multiple_choice', 'listening', 1, v_section_label, v_section_instruction,
    E'N: 学生が 先生に 話しています。学生は どうして 遅れましたか。\nA: すみません、遅れました。\nB: どうしましたか。\nA: バスが 来なかったので、歩いて 来ました。\nB: そうですか。次は タクシーを 呼んで くださいね。',
    'Siswa (A/cewe) bilang "バスが 来なかったので" — bus tidak datang, jadi jalan kaki.',
    18
  );
  WITH q AS (SELECT id FROM quiz_questions WHERE lesson_id = v_lesson_id AND sort_order = 18)
  INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
  SELECT q.id, opt.text, opt.is_correct, opt.ord FROM q, (VALUES
    ('1. 寝坊した', FALSE, 0),
    ('2. バスが 来なかった', TRUE, 1),
    ('3. 雨が 強かった', FALSE, 2),
    ('4. 道に 迷った', FALSE, 3)
  ) AS opt(text, is_correct, ord);

  -- Update lesson questions_per_attempt jadi 5 dari pool 18 = 3.6× ratio.
  UPDATE lessons SET questions_per_attempt = 5 WHERE id = v_lesson_id;

  RAISE NOTICE 'Listening JLPT seeded: lesson_id = %, 18 soal pool (3.6× sample)', v_lesson_id;
END $$;

COMMIT;
