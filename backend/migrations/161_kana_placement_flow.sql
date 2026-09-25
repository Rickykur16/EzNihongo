-- Turn the active N5 kana assignments into real placement assessments.
-- Each attempt draws exactly four questions per section: three typed romaji
-- answers and one multiple-choice check. Existing completed attempts remain
-- valid; only unfinished attempts are reset because their answer format changes.

WITH assessment_lessons AS (
  SELECT l.id, l.slug
    FROM lessons l
    JOIN modules m ON m.id = l.module_id
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = 'n5'
     AND l.slug IN ('assignment-bab-1-hiragana', 'assignment-bab-2-katakana')
), ranked_questions AS (
  SELECT q.id,
         ROW_NUMBER() OVER (
           PARTITION BY q.lesson_id, q.section_number
           ORDER BY q.sort_order, q.id
         ) AS section_rank
    FROM quiz_questions q
    JOIN assessment_lessons a ON a.id = q.lesson_id
)
UPDATE quiz_questions q
   SET correct_answer = (
         SELECT o.option_text
           FROM quiz_options o
          WHERE o.question_id = q.id AND o.is_correct = TRUE
          ORDER BY o.sort_order, o.id
          LIMIT 1
       ),
       question_type = CASE
         WHEN MOD(r.section_rank - 1, 4) = 0 THEN 'multiple_choice'
         ELSE 'fill_blank'
       END,
       section_instruction = 'Baca kana dengan teliti. Ketik romaji pada soal isian; pada soal pilihan, pilih bacaan yang tepat. Arti kata tidak dinilai.',
       updated_at = NOW()
  FROM ranked_questions r
 WHERE q.id = r.id;

UPDATE lessons l
   SET questions_per_attempt = CASE
         WHEN l.slug = 'assignment-bab-1-hiragana' THEN 28
         WHEN l.slug = 'assignment-bab-2-katakana' THEN 32
       END,
       passing_score_pct = 85,
       cooldown_hours = 0,
       content = CASE
         WHEN l.slug = 'assignment-bab-1-hiragana' THEN
           E'Tes penempatan membaca Hiragana: 28 soal, empat soal dari setiap bagian. Sebagian besar jawaban diketik dalam romaji. Lulus jika nilai total minimal 85% dan sedikitnya 3 dari 4 soal benar pada setiap bagian. Arti kata tidak dinilai.\n\nRomaji yang diterima: shi/si, chi/ti, tsu/tu, fu/hu, dan ji/zi. Spasi serta huruf besar-kecil tidak memengaruhi nilai. Vokal panjang tetap harus mengikuti kana, misalnya こう=kou dan とお=too.'
         ELSE
           E'Tes penempatan membaca Katakana: 32 soal, empat soal dari setiap bagian. Sebagian besar jawaban diketik dalam romaji. Lulus jika nilai total minimal 85% dan sedikitnya 3 dari 4 soal benar pada setiap bagian. Arti kata tidak dinilai.\n\nRomaji yang diterima: shi/si, chi/ti, tsu/tu, fu/hu, dan ji/zi. Spasi serta huruf besar-kecil tidak memengaruhi nilai. Tanda ー tetap ditulis sebagai vokal panjang, misalnya コーヒー=koohii.'
       END,
       updated_at = NOW()
  FROM modules m
  JOIN courses c ON c.id = m.course_id
 WHERE l.module_id = m.id
   AND c.slug = 'n5'
   AND l.slug IN ('assignment-bab-1-hiragana', 'assignment-bab-2-katakana');

DELETE FROM quiz_attempts qa
 USING lessons l, modules m, courses c
 WHERE qa.lesson_id = l.id
   AND l.module_id = m.id
   AND m.course_id = c.id
   AND c.slug = 'n5'
   AND l.slug IN ('assignment-bab-1-hiragana', 'assignment-bab-2-katakana')
   AND qa.completed_at IS NULL;
