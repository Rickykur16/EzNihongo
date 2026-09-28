-- 177_dialogue_character_art.sql — character art uploaded from the admin,
-- replacing the bundled image and adding per-character expressions.
--
-- One row per (character, expression). expression_key 'base' replaces the
-- bundled assets/dialogue/<asset>.webp (+ its mask); any other key is an
-- expression the dialogue editor can pick per turn (dialog_scene.expressions).
-- Deleting 'base' falls back to the bundled image; deleting an expression makes
-- turns that used it show the base image again. Nothing references this table,
-- so there is no draft/publish state: an upload is live on the next page load.
--
-- Uploads are transparent PNG/WebP (the stage draws them without a mask). The
-- bytes live here, like vocab_image_cache and order proofs, so they are in the
-- nightly pg_dump. No user reference is stored, which keeps this table out of
-- user-erasure's per-user sweep (assertUserTablesCovered).
CREATE TABLE IF NOT EXISTS dialogue_character_art (
  character_key  TEXT NOT NULL,
  expression_key TEXT NOT NULL CHECK (expression_key ~ '^[a-z0-9][a-z0-9-]{0,31}$'),
  label          TEXT NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 40),
  image          BYTEA NOT NULL,
  mime           TEXT NOT NULL CHECK (mime IN ('image/png', 'image/webp')),
  width          INTEGER NOT NULL CHECK (width BETWEEN 1 AND 4096),
  height         INTEGER NOT NULL CHECK (height BETWEEN 1 AND 4096),
  version        INTEGER NOT NULL DEFAULT 1,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_key, expression_key)
);
