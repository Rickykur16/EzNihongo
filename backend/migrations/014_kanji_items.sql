-- "Daftar Kanji" di main site (welcome.html) — pola mirror "Daftar
-- Kosakata". Source of truth = tabel ini (admin CRUD); Notion import
-- opsional sebagai bulk shortcut. Terpisah dari KD[] hardcoded di PWA
-- app/kanji.html (yg juga punya tabel kanji_users/kanji_progress
-- terpisah realm).

CREATE TABLE IF NOT EXISTS kanji_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character TEXT NOT NULL,
  jlpt_level TEXT NOT NULL,
  on_reading TEXT,
  kun_reading TEXT,
  meaning_id TEXT,
  mnemonic TEXT,
  stroke_count INT,
  bab_kode TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Gated index creation supaya migration aman di prod (ownership mismatch
-- bisa bikin ALTER INDEX gagal — ikutin pattern dari migration 008).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'kanji_items_level_sort_idx') THEN
    CREATE INDEX kanji_items_level_sort_idx ON kanji_items (jlpt_level, sort_order);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'kanji_items_bab_idx') THEN
    CREATE INDEX kanji_items_bab_idx ON kanji_items (bab_kode) WHERE bab_kode IS NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'kanji_items_character_level_uniq') THEN
    CREATE UNIQUE INDEX kanji_items_character_level_uniq ON kanji_items (character, jlpt_level);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'kanji_items_updated_at') THEN
    CREATE TRIGGER kanji_items_updated_at BEFORE UPDATE ON kanji_items
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
