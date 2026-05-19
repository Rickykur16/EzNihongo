-- Track settings_version per row di tts_cache supaya orphan cleanup
-- deterministic: hapus row dengan version != current, bukan based on
-- last_used_at (yg false-positive utk soal jarang dimaikan).
--
-- Existing rows (pre-migration) settings_version = NULL, by definition
-- orphan (gak ada way to retroactively tag). Cleanup query handle NULL
-- sebagai orphan.

ALTER TABLE tts_cache
  ADD COLUMN IF NOT EXISTS settings_version TEXT;

CREATE INDEX IF NOT EXISTS idx_tts_cache_settings_version
  ON tts_cache (settings_version);
