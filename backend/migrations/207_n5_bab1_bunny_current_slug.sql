-- Production uses n5-b1 for Hiragana. Migration 206 handled the legacy slug
-- only, so apply the same owner-supplied source to the current chapter.
-- Keep the original backup and existing lesson ranges/progress.
DO $$
DECLARE
  chapter_id UUID;
  source_id UUID;
  changed_count INT;
BEGIN
  SELECT m.id INTO chapter_id
    FROM modules m JOIN courses c ON c.id = m.course_id
   WHERE c.slug = 'n5' AND m.slug = 'n5-b1'
   LIMIT 1;
  IF chapter_id IS NULL THEN
    RAISE NOTICE '207: N5 n5-b1 chapter missing; no lesson changed.';
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
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  RAISE NOTICE '207: Linked % N5 Bab 1 video/kana lessons to Bunny.', changed_count;
END $$;
