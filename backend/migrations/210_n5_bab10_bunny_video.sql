-- Owner-supplied Bunny Stream source for N5 Bab 10.
-- Preserve lesson IDs, ranges, quizzes, progress, and shared old sources.
CREATE TABLE IF NOT EXISTS bunny_bab10_video_backup_210 (
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
   WHERE c.slug = 'n5' AND m.slug = 'n5-b10'
   LIMIT 1;
  IF chapter_id IS NULL THEN
    RAISE NOTICE '210: N5 n5-b10 chapter missing; no lesson changed.';
    RETURN;
  END IF;

  INSERT INTO bunny_bab10_video_backup_210
    (lesson_id, video_source_id, video_url, video_start_seconds, video_end_seconds)
  SELECT id, video_source_id, video_url, video_start_seconds, video_end_seconds
    FROM lessons WHERE module_id = chapter_id AND type IN ('video', 'kana')
  ON CONFLICT (lesson_id) DO NOTHING;

  INSERT INTO video_sources (provider, external_id, source_url, title)
  VALUES ('bunny', '770041/7bc00772-2a2f-41c2-a5d9-df5274f533c3',
    'https://player.mediadelivery.net/embed/770041/7bc00772-2a2f-41c2-a5d9-df5274f533c3',
    'N5 Bab 10')
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
  RAISE NOTICE '210: Linked % N5 Bab 10 video/kana lessons to Bunny.', changed_count;
END $$;
