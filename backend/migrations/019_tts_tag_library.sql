-- Tag library shared antar admin browser untuk insert shortcut TTS.
-- Tiap tag = string lowercase alphanumeric/underscore. Admin CRUD via
-- /admin/tts/tags endpoint. localStorage tetap dipakai sebagai cache
-- + offline fallback, tapi source of truth ada di DB.
--
-- Note: tag DI-INSERT ke audio_script sebagai [tagname]. ElevenLabs cuma
-- interpret tag built-in (questioning/excited/dll); tag custom yang ga
-- ke-kenal model akan dibaca literal atau ignore. Library ini cuma
-- shortcut entry untuk admin productivity, bukan custom emotion engine.

CREATE TABLE IF NOT EXISTS tts_tag_library (
  tag TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
