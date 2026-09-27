-- Correct default legacy voice routing for the explicitly identified Bab 3 characters.
-- A/F are female; M/B are male. Dialogue text, question content and options are unchanged.
-- Match only the exact reviewed v2 scripts. An admin-edited script or audio_scene wins.
-- Existing attempt snapshots retain their original frozen audio and are never updated.
WITH corrections(item_key, old_script, new_script) AS (
  VALUES
    ('b03-a-l01', $old$A: はじめまして。わたしは マリアです。かいしゃいんです。
B: はじめまして。わたしは ユキです。せんせいです。$old$, $new$A: はじめまして。わたしは マリアです。かいしゃいんです。
F: はじめまして。わたしは ユキです。せんせいです。$new$),
    ('b03-a-l02', $old$A: はじめまして。ケンです。いしゃです。
B: ケンさんは かんごしですか。$old$, $new$M: はじめまして。ケンです。いしゃです。
F: ケンさんは かんごしですか。$new$),
    ('b03-a-l03', $old$A: わたしは デウィです。がくせいです。サリさんも がくせいですか。
B: はい、わたしも がくせいです。$old$, $new$A: わたしは デウィです。がくせいです。サリさんも がくせいですか。
F: はい、わたしも がくせいです。$new$),
    ('b03-b-l02', $old$A: はじめまして。レオです。ちちは アメリカじんです。わたしは アメリカじんじゃありません。ははも アメリカじんじゃありません。$old$, $new$M: はじめまして。レオです。ちちは アメリカじんです。わたしは アメリカじんじゃありません。ははも アメリカじんじゃありません。$new$),
    ('b03-b-l04', $old$A: ミナさんは せんせいですね。
B: はい、せんせいです。$old$, $new$A: ミナさんは せんせいですね。
F: はい、せんせいです。$new$)
)
UPDATE quiz_questions AS q
SET audio_script = c.new_script
FROM corrections AS c
WHERE q.assessment_meta->>'key' = c.item_key
  AND q.assessment_meta->>'version' = 'n5-assessment-v2'
  AND q.question_category = 'listening'
  AND q.audio_script = c.old_script
  AND q.audio_scene IS NULL;
