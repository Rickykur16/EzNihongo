-- Bunny sources use external_id = library ID / video UUID. Existing source IDs,
-- lesson ranges and YouTube content remain intact while videos are replaced.
ALTER TABLE video_sources DROP CONSTRAINT IF EXISTS video_sources_provider_check;
ALTER TABLE video_sources ADD CONSTRAINT video_sources_provider_check
  CHECK (provider IN ('youtube', 'bunny'));
ALTER TABLE video_sources ALTER COLUMN provider SET DEFAULT 'bunny';
