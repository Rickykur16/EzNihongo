-- Reusable YouTube sources + start/end ranges per lesson.
-- Existing video_url values are deliberately left untouched: those are legacy
-- Bunny/direct embeds and must continue to work while courses are migrated.

CREATE TABLE IF NOT EXISTS video_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'youtube' CHECK (provider IN ('youtube')),
  external_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  title TEXT,
  duration_seconds INT CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_video_sources_provider_external
  ON video_sources(provider, external_id);

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS video_source_id UUID,
  ADD COLUMN IF NOT EXISTS video_start_seconds INT,
  ADD COLUMN IF NOT EXISTS video_end_seconds INT;

DO $$
BEGIN
  -- RESTRICT intentionally: SET NULL would violate the segment-source check
  -- and silently discard the identity of a source still used by lessons.
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lessons_video_source_id_fkey') THEN
    ALTER TABLE lessons DROP CONSTRAINT lessons_video_source_id_fkey;
  END IF;
  ALTER TABLE lessons ADD CONSTRAINT lessons_video_source_id_fkey
    FOREIGN KEY (video_source_id) REFERENCES video_sources(id) ON DELETE RESTRICT;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'video_sources_updated_at') THEN
    CREATE TRIGGER video_sources_updated_at BEFORE UPDATE ON video_sources
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lessons_video_start_nonnegative'
  ) THEN
    ALTER TABLE lessons ADD CONSTRAINT lessons_video_start_nonnegative
      CHECK (video_start_seconds IS NULL OR video_start_seconds >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lessons_video_end_positive'
  ) THEN
    ALTER TABLE lessons ADD CONSTRAINT lessons_video_end_positive
      CHECK (video_end_seconds IS NULL OR video_end_seconds > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lessons_video_segment_source'
  ) THEN
    ALTER TABLE lessons ADD CONSTRAINT lessons_video_segment_source
      CHECK (video_source_id IS NOT NULL OR (video_start_seconds IS NULL AND video_end_seconds IS NULL));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lessons_video_segment_range'
  ) THEN
    ALTER TABLE lessons ADD CONSTRAINT lessons_video_segment_range
      CHECK (video_end_seconds IS NULL OR video_start_seconds IS NULL OR video_end_seconds > video_start_seconds);
  END IF;
END $$;
