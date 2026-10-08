-- Owner-supplied Bunny Stream source for N5 Bab 2 (Katakana).
-- Preserve lesson IDs, ranges, quizzes, student progress, and the old source.
CREATE TABLE IF NOT EXISTS bunny_bab2_video_backup_208 (
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
  changed_count INT;
BEGIN
  SELECT m.id INTO chapter_id
    FROM modules m JOIN courses c ON c.id = m.course_id
   WHERE c.slug = 'n5' AND m.slug = 'n5-b2'
   LIMIT 1;
  IF chapter_id IS NULL THEN
    RAISE NOTICE '208: N5 n5-b2 chapter missing; no lesson changed.';
    RETURN;
  END IF;

  INSERT INTO bunny_bab2_video_backup_208
    (lesson_id, video_source_id, video_url, video_start_seconds, video_end_seconds)
  SELECT id, video_source_id, video_url, video_start_seconds, video_end_seconds
    FROM lessons WHERE module_id = chapter_id AND type IN ('video', 'kana')
  ON CONFLICT (lesson_id) DO NOTHING;

  INSERT INTO video_sources (provider, external_id, source_url, title)
  VALUES ('bunny', '770041/69a9a519-d9c2-4430-a9b8-f887cbb4bd88',
    'https://player.mediadelivery.net/embed/770041/69a9a519-d9c2-4430-a9b8-f887cbb4bd88',
    'N5 Bab 2 - Katakana')
  ON CONFLICT (provider, external_id) DO UPDATE
    SET source_url = EXCLUDED.source_url
  RETURNING id INTO source_id;

  UPDATE lessons
     SET video_source_id = source_id,
         video_start_seconds = COALESCE(video_start_seconds, 0),
         video_url = NULL,
         updated_at = NOW()
   WHERE module_id = chapter_id AND type IN ('video', 'kana');
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  RAISE NOTICE '208: Linked % N5 Bab 2 video/kana lessons to Bunny.', changed_count;
END $$;
