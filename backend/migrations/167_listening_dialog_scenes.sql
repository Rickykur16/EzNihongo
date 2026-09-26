-- Listening reuses the grammar-dialogue scene schema and explicit voice map.
-- Snapshots include this server-only field through SELECT q.*; existing
-- attempts keep the scene (or legacy fallback) they originally received.
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS audio_scene JSONB;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quiz_questions_audio_scene_object' AND conrelid = 'quiz_questions'::regclass) THEN
    ALTER TABLE quiz_questions ADD CONSTRAINT quiz_questions_audio_scene_object
      CHECK (audio_scene IS NULL OR jsonb_typeof(audio_scene) = 'object');
  END IF;
END $$;
