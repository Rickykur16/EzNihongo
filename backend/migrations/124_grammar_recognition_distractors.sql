-- Pengecoh Step 1 (pengenalan fungsi) yang dikurasi per pola grammar.
--
-- MASALAH YANG DITUTUP: soal Step 1 menanyakan "Apa fungsi <pola>?" dan
-- pengecohnya diturunkan dari arti pola LAIN di bab yang sama (lihat
-- grammar-drills.js). Akibatnya soal jadi terlalu mudah: untuk 〜の〜,
-- pengecohnya bicara soal も dan ね/よ — siswa cukup tahu "ini bukan soal も"
-- untuk mengeliminasi, tanpa memahami fungsi の sama sekali.
--
-- Kolom ini menampung pengecoh yang benar-benar menguji: fungsi yang SALAH
-- untuk pola ITU SENDIRI (mis. untuk 〜の〜: "menandai objek kalimat",
-- "menyatakan tempat kegiatan"). Di-generate AI sekali per pola lewat tombol
-- admin, di-review/di-edit admin, lalu dipakai apa adanya — TIDAK ada panggilan
-- AI saat siswa mengerjakan soal.
--
-- TEXT satu pengecoh per baris, bukan JSONB: admin mengeditnya di textarea, dan
-- teks per baris tidak bisa rusak karena salah tanda kurung/koma seperti JSON.
--
-- Nullable tanpa backfill: pola yang belum di-generate tetap memakai penurunan
-- lama (arti pola lain sebagai pengecoh), jadi Tugas Bunpou Bab 3-20 yang sudah
-- live tidak berubah perilakunya sampai admin mengisinya.
ALTER TABLE module_grammar
  ADD COLUMN IF NOT EXISTS recognition_distractors TEXT;

DO $$
BEGIN
  RAISE NOTICE 'module_grammar.recognition_distractors siap (nullable, tanpa backfill).';
END $$;
