-- The first two placements assess only kana patterns in their preceding lessons.
-- Keep question/option IDs for completed-attempt audit; reset only unfinished
-- attempts that sampled changed questions so no one submits a stale prompt.

CREATE TEMP TABLE kana_scope_replacements ON COMMIT DROP AS
SELECT * FROM (VALUES
  ('assignment-bab-1-hiragana', 45, 'わたしは がっこうへ いきます。', 'がっこう きょう',
   'gakkou kyou', 'gakou kyou', 'gakkoo kyou', 'gakkou kiyou',
   'がっこう: っ menggandakan k dan う tetap ditulis u. きょう: ょ kecil membentuk kyo, lalu う ditulis u.'),
  ('assignment-bab-1-hiragana', 46, 'これを ください。', 'これ ください',
   'kore kudasai', 'kore kutasai', 'kore kudazai', 'kore kudashi',
   'こ=ko、れ=re、く=ku、だ=da、さ=sa、い=i. Perhatikan dakuten pada だ.'),
  ('assignment-bab-1-hiragana', 47, 'きょうは いい てんきですね。', 'きょう てんき',
   'kyou tenki', 'kiyou tenki', 'kyoo tenki', 'kyou denki',
   'きょ adalah kyo karena ょ kecil; う tetap ditulis u. て tanpa dakuten adalah te.'),
  ('assignment-bab-1-hiragana', 48, 'えきの まえで まって います。', 'えき まって',
   'eki matte', 'egi matte', 'eki mate', 'eki matsute',
   'えき = eki. Pada まって, っ kecil menggandakan t: matte.'),
  ('assignment-bab-1-hiragana', 49, 'にほんごの べんきょうは たのしいです。', 'にほんご べんきょう',
   'nihongo benkyou', 'nihonko benkyou', 'nihongo benkiyou', 'nihongo benkyoo',
   'ご memakai dakuten. きょ dengan ょ kecil adalah kyo, diikuti う: benkyou.'),
  ('assignment-bab-1-hiragana', 50, 'おおきい びょういんへ いきました。', 'おおきい びょういん',
   'ookii byouin', 'oukii byouin', 'ookii biyouin', 'ookii byuoin',
   'おお ditulis oo; びょ dengan ょ kecil adalah byo, diikuti う: byou.'),
  ('assignment-bab-2-katakana', 41, 'ソファ', 'キャップ',
   'kyappu', 'kiyappu', 'kyapu', 'kyabbu',
   'キャ dengan ャ kecil adalah kya; ッ menggandakan p; プ memakai handakuten.'),
  ('assignment-bab-2-katakana', 42, 'フィルム', 'ショート',
   'shooto', 'shiyooto', 'shoto', 'sooto',
   'ショ dengan ョ kecil adalah sho; ー mengulang vokal o: shoo.'),
  ('assignment-bab-2-katakana', 43, 'カフェ', 'ジュース',
   'juusu', 'jiyuusu', 'jusu', 'shuusu',
   'ジュ dengan ュ kecil adalah ju; ー memanjangkan u: juu.'),
  ('assignment-bab-2-katakana', 44, 'フォーク', 'チョッキ',
   'chokki', 'chiyokki', 'choki', 'shokki',
   'チョ dengan ョ kecil adalah cho; ッ menggandakan k.'),
  ('assignment-bab-2-katakana', 45, 'パーティー', 'ビョーキ',
   'byooki', 'biyooki', 'byoki', 'pyooki',
   'ビョ dengan ョ kecil adalah byo; ー memanjangkan o. ビ memakai dakuten.'),
  ('assignment-bab-2-katakana', 46, 'ディスク', 'ピュッタ',
   'pyutta', 'piyutta', 'pyuta', 'byutta',
   'ピュ dengan ュ kecil adalah pyu; ッ menggandakan t. Arti rangkaian kana tidak dinilai.'),
  ('assignment-bab-2-katakana', 47, 'チェック', 'ギャップ',
   'gyappu', 'giyappu', 'gyapu', 'kyappu',
   'ギャ dengan ャ kecil adalah gya; ッ menggandakan p.'),
  ('assignment-bab-2-katakana', 48, 'シェフ', 'シャープ',
   'shaapu', 'shiyaapu', 'shapu', 'shaabu',
   'シャ dengan ャ kecil adalah sha; ー memanjangkan a; プ memakai handakuten.'),
  ('assignment-bab-2-katakana', 49, 'ウェブ', 'リュック',
   'ryukku', 'riyukku', 'ryuku', 'ryukko',
   'リュ dengan ュ kecil adalah ryu; ッ menggandakan k.'),
  ('assignment-bab-2-katakana', 50, 'ヴァイオリン', 'チャーハン',
   'chaahan', 'chiyaahan', 'chahan', 'shaahan',
   'チャ dengan ャ kecil adalah cha; ー memanjangkan a; ン tetap ditulis n.')
) AS v(lesson_slug, sort_order, old_question, question,
       correct, wrong_1, wrong_2, wrong_3, explanation);

CREATE TEMP TABLE kana_scope_targets ON COMMIT DROP AS
SELECT q.id AS question_id, l.id AS lesson_id, r.*
  FROM kana_scope_replacements r
  JOIN lessons l ON l.slug = r.lesson_slug
  JOIN modules m ON m.id = l.module_id
  JOIN courses c ON c.id = m.course_id AND c.slug = 'n5'
  JOIN quiz_questions q ON q.lesson_id = l.id
   AND q.sort_order = r.sort_order AND q.question = r.old_question
 WHERE q.section_number = CASE WHEN r.lesson_slug = 'assignment-bab-1-hiragana' THEN 7 ELSE 6 END;

DELETE FROM quiz_attempts qa
 USING kana_scope_targets t
 WHERE qa.lesson_id = t.lesson_id
   AND qa.completed_at IS NULL
   AND qa.sampled_question_ids ? t.question_id::text;

UPDATE quiz_questions q
   SET question = t.question,
       correct_answer = t.correct,
       explanation = t.explanation,
       section_label = CASE WHEN t.lesson_slug = 'assignment-bab-1-hiragana'
         THEN 'Bagian G — Gabungan Bacaan' ELSE 'Bagian F — Gabungan Kana' END,
       section_instruction = CASE WHEN t.lesson_slug = 'assignment-bab-1-hiragana'
         THEN 'Baca dua kelompok kana. Ketik romaji pada isian atau pilih bacaan yang tepat. Spasi bebas; tidak ada aturan partikel.'
         ELSE 'Baca gabungan kana yang sudah dipelajari: ャ・ュ・ョ kecil, ッ, dakuten, dan ー. Arti kata tidak dinilai.' END,
       updated_at = NOW()
  FROM kana_scope_targets t
 WHERE q.id = t.question_id;

UPDATE quiz_options o
   SET option_text = CASE o.sort_order
         WHEN 0 THEN t.correct WHEN 1 THEN t.wrong_1
         WHEN 2 THEN t.wrong_2 WHEN 3 THEN t.wrong_3 END
  FROM kana_scope_targets t
 WHERE o.question_id = t.question_id AND o.sort_order BETWEEN 0 AND 3;

-- These old distractors are legitimate romaji variants accepted by typed
-- grading, so they must not remain marked wrong in multiple choice.
CREATE TEMP TABLE kana_scope_option_fixes ON COMMIT DROP AS
SELECT * FROM (VALUES
  ('assignment-bab-1-hiragana', 6, 'maturi', 'matsure',
   'ま=ma、つ=tsu/tu、り=ri. Perhatikan vokal akhir り=i, bukan れ=e.'),
  ('assignment-bab-1-hiragana', 18, 'enpitu', 'enpichi',
   'ぴ=pi dengan handakuten; つ=tsu/tu, bukan ち=chi.'),
  ('assignment-bab-1-hiragana', 21, 'shasin', 'shachin',
   'しゃ dengan ゃ kecil adalah sha; し=shi/si, bukan ち=chi.'),
  ('assignment-bab-1-hiragana', 33, 'mittu', 'mitto',
   'っ menggandakan t; つ=tsu/tu, bukan と=to.'),
  ('assignment-bab-2-katakana', 6, 'sohuto', 'sokuto',
   'ソ=so, フ=fu/hu, ト=to. ク=ku adalah huruf berbeda.'),
  ('assignment-bab-2-katakana', 8, 'naihu', 'naisu',
   'ナ=na、イ=i、フ=fu/hu; ス=su adalah huruf berbeda.'),
  ('assignment-bab-2-katakana', 13, 'doitu', 'doichi',
   'ド=do memakai dakuten; ツ=tsu/tu, bukan チ=chi.'),
  ('assignment-bab-2-katakana', 21, 'shatu', 'shachi',
   'シャ dengan ャ kecil adalah sha; ツ=tsu/tu, bukan チ=chi.'),
  ('assignment-bab-2-katakana', 24, 'kyabetu', 'kyabesu',
   'キャ dengan ャ kecil adalah kya; ベ memakai dakuten; ツ=tsu/tu, bukan ス=su.')
) AS v(lesson_slug, sort_order, old_option, option_text, explanation);

UPDATE quiz_options o
   SET option_text = f.option_text
  FROM quiz_questions q
  JOIN lessons l ON l.id = q.lesson_id
  JOIN modules m ON m.id = l.module_id
  JOIN courses c ON c.id = m.course_id AND c.slug = 'n5'
  JOIN kana_scope_option_fixes f ON f.lesson_slug = l.slug AND f.sort_order = q.sort_order
 WHERE o.question_id = q.id AND o.option_text = f.old_option AND o.is_correct = FALSE;

UPDATE quiz_questions q
   SET explanation = f.explanation, updated_at = NOW()
  FROM lessons l
  JOIN modules m ON m.id = l.module_id
  JOIN courses c ON c.id = m.course_id AND c.slug = 'n5'
  JOIN kana_scope_option_fixes f ON f.lesson_slug = l.slug
 WHERE q.lesson_id = l.id AND q.sort_order = f.sort_order
   AND EXISTS (
     SELECT 1 FROM quiz_options o
      WHERE o.question_id = q.id AND o.option_text = f.option_text AND o.is_correct = FALSE
   );

UPDATE quiz_questions q
   SET explanation = 'ち=chi/ti, bukan し=shi. ら=ra, bukan る=ru.', updated_at = NOW()
  FROM lessons l
  JOIN modules m ON m.id = l.module_id
  JOIN courses c ON c.id = m.course_id AND c.slug = 'n5'
 WHERE q.lesson_id = l.id AND l.slug = 'assignment-bab-1-hiragana'
   AND q.sort_order = 5 AND q.question = 'ちから';
