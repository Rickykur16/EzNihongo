-- Manual compound vocabulary for each kanji item.
-- Shape: [{ japanese, reading, indonesian }]

ALTER TABLE kanji_items
  ADD COLUMN IF NOT EXISTS compounds JSONB NOT NULL DEFAULT '[]'::jsonb;
