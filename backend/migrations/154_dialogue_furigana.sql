-- Reading annotations are independent of scene/voice snapshots and TTS text.
ALTER TABLE module_grammar ADD COLUMN IF NOT EXISTS dialog_furigana JSONB;
