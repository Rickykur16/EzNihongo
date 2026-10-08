-- Owner-supplied Bunny Stream chapter videos for N5 Bab 3-9.
-- Preserve lesson ranges and progress; never change a shared old source.
CREATE TABLE IF NOT EXISTS bunny_bab3_9_video_backup_209 (
  lesson_id UUID PRIMARY KEY REFERENCES lessons(id) ON DELETE CASCADE,
  video_source_id UUID,
  video_url TEXT,
  video_start_seconds INT,
  video_end_seconds INT,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
DECLARE
  chapter RECORD;
  chapter_id UUID;
  source_id UUID;
  changed_count INT;
BEGIN
  FOR chapter IN SELECT * FROM (VALUES
    (3, '20d7ff66-f606-4de0-8225-3c26fcf909b8'),
    (4, '3f389515-d086-4467-9238-43bace8a6d8c'),
    (5, '5a849ce6-ea38-4b4f-bcd9-087a668dafbd'),
    (6, '57d00353-1f07-4b5c-b142-c19584b2eb1f'),
    (7, '194c12a4-8d66-495f-be92-d7baf50566d5'),
    (8, '78a336c3-8150-43cd-8890-6871434ebe1b'),
    (9, '2b746361-5ba3-4c08-9281-d6c503d74449')
  ) AS chapters(number, video_id)
  LOOP
    SELECT m.id INTO chapter_id
      FROM modules m JOIN courses c ON c.id = m.course_id
     WHERE c.slug = 'n5' AND m.slug = 'n5-b' || chapter.number
     LIMIT 1;
    IF chapter_id IS NULL THEN
      RAISE NOTICE '209: N5 Bab % missing; no lesson changed.', chapter.number;
      CONTINUE;
    END IF;

    INSERT INTO bunny_bab3_9_video_backup_209
      (lesson_id, video_source_id, video_url, video_start_seconds, video_end_seconds)
    SELECT id, video_source_id, video_url, video_start_seconds, video_end_seconds
      FROM lessons WHERE module_id = chapter_id AND type IN ('video', 'kana')
    ON CONFLICT (lesson_id) DO NOTHING;

    INSERT INTO video_sources (provider, external_id, source_url, title)
    VALUES ('bunny', '770041/' || chapter.video_id,
      'https://player.mediadelivery.net/embed/770041/' || chapter.video_id,
      'N5 Bab ' || chapter.number)
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
    RAISE NOTICE '209: Linked % N5 Bab % video/kana lessons to Bunny.', changed_count, chapter.number;
  END LOOP;
END $$;
