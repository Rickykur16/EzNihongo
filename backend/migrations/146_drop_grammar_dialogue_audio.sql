-- 146_drop_grammar_dialogue_audio.sql — cabut infrastruktur audio dialog
-- ter-review yang dibuat migrasi 142.
--
-- KENAPA: fitur "Bacaan & audio" (draft bacaan per kata → generate ElevenLabs
-- → review → publikasikan) dinilai tidak sepadan dengan biayanya dan dihapus.
-- Ringkas alasannya:
--
--   * Player karaoke lama SUDAH memberi audio tiga suara peran, cache
--     permanen di tts_cache (tiap kalimat unik dibayar sekali), terjemahan
--     per baris, kontrol kecepatan, dan highlight PER KATA. Pipeline baru
--     justru hanya menyorot per ucapan utuh, jadi untuk siswa ia lebih
--     miskin di dimensi yang penting untuk belajar membaca.
--   * Nilai tambah utamanya — jaminan bacaan kanji — sudah punya solusi
--     jauh lebih murah yang memang sudah jadi praktik di repo ini: tulis
--     kata yang ambigu langsung dalam kana di teks dialognya. Dialog Bab 3
--     (migrasi 143-145) seluruhnya kana, jadi player lama membacanya benar
--     tanpa satu pun langkah review.
--   * Biayanya ~1.178 baris kode + 4 tabel + alur admin enam langkah per
--     pola untuk 100+ pola, dan dalam sehari menghasilkan empat insiden
--     produksi (MIME .mjs mematikan fitur, draft tersimpan membungkam audio
--     siswa, dialog tidak muncul, endpoint publik tanpa autentikasi).
--
-- Kolom module_grammar.example_dialog dan example_dialog_id TIDAK disentuh —
-- itu milik player karaoke lama, bukan pipeline ini, dan isinya (termasuk
-- dialog Bab 3) tetap dipakai.
--
-- KONSEKUENSI YANG DISADARI: audio yang pernah digenerate tersimpan sebagai
-- BYTEA di grammar_dialogue_versions dan ikut hilang. Itu memang kredit
-- ElevenLabs yang sudah terpakai, tapi sepanjang fitur ini hidup belum ada
-- audio yang pernah lolos sampai tahap publikasi ke siswa.
--
-- Urutan DROP mengikuti arah foreign key: reports dan publications menunjuk
-- versions, versions dan drafts menunjuk module_grammar. IF EXISTS supaya
-- aman di environment yang belum pernah menjalankan 142.

DROP TABLE IF EXISTS grammar_dialogue_reports;
DROP TABLE IF EXISTS grammar_dialogue_publications;
DROP TABLE IF EXISTS grammar_dialogue_versions;
DROP TABLE IF EXISTS grammar_dialogue_drafts;
