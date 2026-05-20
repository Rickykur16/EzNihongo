-- Karaoke subtitle: simpan alignment per-karakter (timestamp) bareng audio
-- di tts_cache. Dipakai endpoint /api/tts/aligned buat highlight teks
-- ngikutin audio (Todai-style). NULL = entry audio-only lama (gak aligned).

ALTER TABLE tts_cache
  ADD COLUMN IF NOT EXISTS alignment JSONB;
