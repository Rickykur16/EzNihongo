-- 030_vocab_image_cache.sql — Cache gambar AI per kosakata.
-- Spike fitur "Generate gambar (AI)" untuk vocab card di Kelola Deck.
-- Bytea disimpan di DB (pola sama seperti tts_cache) — sederhana, ikut
-- pg_dump, tahan git reset --hard. Kalau volume nanti gede (>500 MB) bisa
-- migrate ke object storage (R2/S3) di follow-up.

CREATE TABLE IF NOT EXISTS vocab_image_cache (
  vocabulary_id UUID PRIMARY KEY REFERENCES module_vocabulary(id) ON DELETE CASCADE,
  image_bytes BYTEA NOT NULL,
  mime TEXT NOT NULL DEFAULT 'image/png',
  model TEXT,
  prompt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
