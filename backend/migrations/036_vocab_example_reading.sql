-- 036_vocab_example_reading.sql — Bacaan kana untuk contoh kalimat kosakata.
--
-- vocabulary_examples sebelumnya cuma japanese / highlight / indonesian, jadi
-- contoh kalimat yang mengandung kanji tidak punya cara baca. Tambah kolom
-- `reading` (kana penuh: semua kanji diganti hiragana/katakana) supaya siswa
-- bisa membaca kalimat contoh di modal deck.
--
-- Nullable, tanpa backfill — contoh lama tetap valid (frontend sembunyikan
-- baris kana kalau kosong). Admin isi manual lewat editor Contoh, atau lewat
-- "Generate contoh (AI)" yang sekarang ikut mengisi reading.

ALTER TABLE vocabulary_examples ADD COLUMN IF NOT EXISTS reading TEXT;
