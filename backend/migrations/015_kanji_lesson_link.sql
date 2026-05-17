-- Kanji jadi jenis pelajaran (lesson.type = 'kanji'), bukan tab admin
-- global. Per-pelajaran admin tinggal klik "Kelola Kanji" (mirror pola
-- "Kelola Deck"). Tabel kanji_items dapet kolom lesson_id supaya bisa
-- di-scope; bab_kode dipertahankan sebagai label informasi (opsional).

-- Drop & re-add CHECK karena PostgreSQL ga punya ALTER ... CHECK ADD value.
ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_type_check;
ALTER TABLE lessons ADD CONSTRAINT lessons_type_check
  CHECK (type IN ('video', 'quiz', 'text', 'deck', 'kanji'));

ALTER TABLE kanji_items
  ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'kanji_items_lesson_idx') THEN
    CREATE INDEX kanji_items_lesson_idx ON kanji_items (lesson_id, sort_order)
      WHERE lesson_id IS NOT NULL;
  END IF;
END $$;
