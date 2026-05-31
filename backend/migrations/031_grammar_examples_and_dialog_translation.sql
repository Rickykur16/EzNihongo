-- 031_grammar_examples_and_dialog_translation.sql
--
-- 1) Tabel grammar_examples — mirror vocabulary_examples. Sebelumnya
--    module_grammar hanya punya 1 kolom `example` (single string).
--    Sekarang admin bisa kelola multi contoh per pola grammar, masing-masing
--    dgn terjemahan Indonesia. Kolom `example` di module_grammar dipertahankan
--    untuk legacy compat (frontend fallback ke kolom itu kalau examples[] kosong).
--
-- 2) module_grammar.example_dialog_id — terjemahan Indonesia dari dialog,
--    formatnya parallel dgn example_dialog (N: / A: / B: per baris). Frontend
--    parse keduanya dan render terjemahan kecil di bawah tiap baris karaoke.
--
-- Backfill: tiap module_grammar yg punya `example` non-empty → 1 baris di
-- grammar_examples (sort_order 0). Tidak menghapus kolom `example` (legacy).

CREATE TABLE IF NOT EXISTS grammar_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grammar_id UUID NOT NULL REFERENCES module_grammar(id) ON DELETE CASCADE,
  japanese TEXT NOT NULL,
  highlight TEXT,
  indonesian TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grammar_examples_grammar
  ON grammar_examples(grammar_id, sort_order);

ALTER TABLE module_grammar ADD COLUMN IF NOT EXISTS example_dialog_id TEXT;

-- Backfill: salin module_grammar.example -> grammar_examples (1 baris) untuk
-- grammar yg belum punya example di tabel baru. Idempoten via NOT EXISTS guard.
INSERT INTO grammar_examples (grammar_id, japanese, sort_order)
SELECT g.id, g.example, 0
  FROM module_grammar g
 WHERE g.example IS NOT NULL
   AND TRIM(g.example) <> ''
   AND NOT EXISTS (SELECT 1 FROM grammar_examples e WHERE e.grammar_id = g.id);
