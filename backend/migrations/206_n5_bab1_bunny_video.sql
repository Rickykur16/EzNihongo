-- Owner-supplied Bunny Stream video for N5 Bab 1 (Hiragana).
-- Copy the new source onto this chapter's video/kana lessons only; never edit
-- the old shared source, since other chapters can reference it. Keep existing
-- timestamps, lesson IDs, quizzes, and student progress.
CREATE TABLE IF NOT EXISTS bunny_bab1_video_backup_206 (
  lesson_id UUID PRIMARY KEY REFERENCES lessons(id) ON DELETE CASCADE,
  video_source_id UUID,
  video_url TEXT,
  video_start_seconds INT,
  video_end_seconds INT,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
DECLARE
  chapter_id UUID;
  source_id UUID;
BEGIN
  SELECT m.id INTO chapter_id
    FROM modules m JOIN courses c ON c.id = m.course_id
   WHERE c.slug = 'n5' AND m.slug = 'hiragana-katakana'
   LIMIT 1;
  IF chapter_id IS NULL THEN
    RAISE NOTICE '206: N5 Hiragana chapter missing; no lesson changed.';
    RETURN;
  END IF;

  INSERT INTO bunny_bab1_video_backup_206
    (lesson_id, video_source_id, video_url, video_start_seconds, video_end_seconds)
  SELECT id, video_source_id, video_url, video_start_seconds, video_end_seconds
    FROM lessons WHERE module_id = chapter_id AND type IN ('video', 'kana')
  ON CONFLICT (lesson_id) DO NOTHING;

  INSERT INTO video_sources (provider, external_id, source_url, title)
  VALUES ('bunny', '770041/0495cf1c-2e6b-4306-b94e-fa08ce239e2a',
    'https://player.mediadelivery.net/embed/770041/0495cf1c-2e6b-4306-b94e-fa08ce239e2a',
    'N5 Bab 1 - Hiragana')
  ON CONFLICT (provider, external_id) DO UPDATE
    SET source_url = EXCLUDED.source_url
  RETURNING id INTO source_id;

  UPDATE lessons
     SET video_source_id = source_id,
         video_start_seconds = COALESCE(video_start_seconds, 0),
         video_url = NULL,
         updated_at = NOW()
   WHERE module_id = chapter_id AND type IN ('video', 'kana');
END $$;
