-- 148_dialogue_speakers.sql — named-speaker registry for grammar dialogues,
-- so the admin dialogue editor can assign a real character name (アンナ,
-- ハディ, ...) instead of the bare TTS routing code (A/B) that
-- `voiceForSpeaker()` (backend/src/routes/tts.js) has used until now.
--
-- Deliberately ONE small lookup table, not a content pipeline: this is not
-- a repeat of the reverted "Bacaan & audio" feature (migration 142, dropped
-- by 146) — no draft/version/publish state, no new public endpoint, and the
-- existing `module_grammar.example_dialog`/`example_dialog_id` storage
-- format (plain "PREFIX: text" lines) is UNCHANGED. A named speaker is just
-- a different valid PREFIX value alongside the existing N/A/B/gender-word
-- ones `parseDialog()` already accepts — parseDialog itself is widened in
-- application code (this migration only adds the registry it can consult).
--
-- Narrator is intentionally NOT a speaker row here: it stays the fixed "N"
-- code (matched by NARRATOR_PATTERNS in tts.js) — a narrator doesn't have a
-- character name to pick, only the two dialogue participants do.
CREATE TABLE IF NOT EXISTS dialogue_speakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  voice_role TEXT NOT NULL CHECK (voice_role IN ('female', 'male')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed with the cast already used (as bare A/B codes) across Bab 3's six
-- grammar dialogues (migrations 143-145) — the first real content an admin
-- will likely re-edit with the new picker. Roles are read from context, not
-- guessed from the A/B code: three of these currently get the WRONG voice
-- gender under the old code-based routing (B always maps to the male voice
-- regardless of who's actually speaking) — サリ, ミナ and ハディ are cases
-- in point (Sari/Mina are female speakers coded B; Hadi is a male speaker
-- coded A). Re-saving those dialogues with named speakers fixes this as a
-- side effect; this migration only seeds names, it does not touch
-- module_grammar content.
INSERT INTO dialogue_speakers (name, voice_role) VALUES
  ('アンナ', 'female'),
  ('ハディ', 'male'),
  ('リナ', 'female'),
  ('ケビン', 'male'),
  ('マリア', 'female'),
  ('リョウ', 'male'),
  ('デウィ', 'female'),
  ('サリ', 'female'),
  ('ミナ', 'female'),
  ('ユウト', 'male')
ON CONFLICT (name) DO NOTHING;
