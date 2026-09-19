-- Visual scenes are opt-in. Existing dialogue text and progress stay unchanged.
ALTER TABLE module_grammar ADD COLUMN IF NOT EXISTS dialog_scene JSONB;
ALTER TABLE dialogue_speakers ADD COLUMN IF NOT EXISTS character_key TEXT;
ALTER TABLE dialogue_speakers ADD COLUMN IF NOT EXISTS default_display_name TEXT;
ALTER TABLE dialogue_speakers ADD COLUMN IF NOT EXISTS profile_version INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX IF NOT EXISTS dialogue_speakers_character_key_unique
  ON dialogue_speakers(character_key) WHERE character_key IS NOT NULL;
-- Empty voice strings represent a draft profile, never a guessed provider voice.
INSERT INTO dialogue_speakers(name, voice_id, voice_name, character_key, default_display_name)
VALUES
  ('Anna Wijaya', '', '', 'anna-wijaya', 'アンナ'),
  ('Hadi Pratama', '', '', 'hadi-pratama', 'ハディ'),
  ('Aoi Takahashi', '', '', 'aoi-takahashi', '葵'),
  ('Ren Mori', '', '', 'ren-mori', '蓮'),
  ('Claire Bennett', '', '', 'claire-bennett', 'クレア'),
  ('Daniel Foster', '', '', 'daniel-foster', 'ダニエル')
ON CONFLICT (name) DO UPDATE SET
  character_key = EXCLUDED.character_key,
  default_display_name = COALESCE(dialogue_speakers.default_display_name, EXCLUDED.default_display_name);
