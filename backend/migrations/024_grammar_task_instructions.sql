-- Model tugas: admin menentukan instruksi tugas + jumlah kalimat per pola
-- grammar. Siswa harus menyelesaikan semua kalimat yang diminta. Kolom di join
-- table (per lesson+grammar) — pola sama bisa punya instruksi/jumlah beda di
-- tugas berbeda.

ALTER TABLE lesson_grammar_task_items
  ADD COLUMN IF NOT EXISTS instruction TEXT,
  ADD COLUMN IF NOT EXISTS required_count INT NOT NULL DEFAULT 1;
