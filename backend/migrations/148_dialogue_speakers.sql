-- 148_dialogue_speakers.sql — named-speaker registry for grammar dialogues,
-- so the admin dialogue editor can assign a real character name (アンナ,
-- ハディ, ...) instead of the bare TTS routing code (A/B) that
-- `voiceForSpeaker()` (backend/src/routes/tts.js) has used until now, AND
-- assign that character a REAL ElevenLabs voice (voice_id) picked from
-- ElevenLabs' own catalog — not a binary female/male bucket mapped to only
-- 2 env-configured voices.
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
--
-- `voice_id` = the ElevenLabs voice_id verbatim (e.g. picked from
-- GET /v1/voices via the new admin endpoint) — the actual sound identity.
-- `voice_name` = that voice's own display name at ElevenLabs (e.g.
-- "Rachel"), stored alongside purely so the admin UI can show "アンナ →
-- Rachel" without re-fetching the whole catalog on every page load; it is
-- never used for TTS routing (voice_id alone decides that) and is allowed
-- to go stale if a voice is later renamed upstream.
--
-- No seed data: unlike a role ('female'/'male'), a real voice_id cannot be
-- guessed or invented — it only exists inside a specific ElevenLabs
-- account's catalog, which this migration has no way to see. The registry
-- starts empty; an admin populates it live from the fetched catalog the
-- first time they use the per-turn dialogue editor's speaker picker.
CREATE TABLE IF NOT EXISTS dialogue_speakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  voice_id TEXT NOT NULL,
  voice_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
