-- Pengecoh Step 2 (latihan bentuk) yang dikurasi admin — pelengkap 124.
--
-- MASALAH YANG DITUTUP: pengecoh Step 2 diturunkan aturan (lihat
-- grammar-drills.js). Audit atas 46 pola Bab 12-20 sudah membereskan pengecoh
-- yang BUKAN bahasa Jepang, tapi menyisakan satu kelas yang tidak bisa
-- diselesaikan secara mekanis: pengecoh yang KEBETULAN JUGA BENAR di kalimatnya.
--
--   あした 学校へ ＿＿＿。
--     ✔ 行かなくてもいいです
--       行かない            ← ini juga kalimat yang benar
--
-- Menentukan ini butuh pemahaman makna, bukan pencocokan pola. Jadi sama
-- seperti Step 1: sediakan tempat untuk pengecoh yang dikurasi admin, dengan
-- draft AI + review, dan biarkan penurunan aturan jadi cadangan.
--
-- Satu kolom di module_grammar (bukan di grammar_examples) karena satu pola
-- menghasilkan TEPAT SATU soal Step 2 — contoh pertama yang punya highlight
-- terpakai. Menyimpannya per-contoh berarti dua pertiga barisnya tidak pernah
-- dipakai. Konsekuensinya: kalau admin mengganti/mengurutkan ulang contoh
-- kalimatnya, pengecoh yang tersimpan bisa jadi tidak lagi cocok — modal admin
-- menampilkan kalimat + jawabannya supaya ketidakcocokan itu langsung terlihat.
--
-- TEXT satu pengecoh per baris, sama seperti 124: admin mengeditnya di textarea
-- dan teks per baris tidak bisa rusak karena salah tanda kurung/koma.
--
-- Nullable tanpa backfill: pola yang belum diisi tetap memakai penurunan
-- aturan, jadi Tugas Bunpou yang sudah live tidak berubah perilakunya.
ALTER TABLE module_grammar
  ADD COLUMN IF NOT EXISTS controlled_distractors TEXT;

DO $$
BEGIN
  RAISE NOTICE 'module_grammar.controlled_distractors siap (nullable, tanpa backfill).';
END $$;
