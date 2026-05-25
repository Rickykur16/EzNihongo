-- Popup otomatis: lesson grammar_task bisa dikaitkan ke "pelajaran pemicu".
-- Saat pelajaran pemicu selesai, tugas muncul sebagai popup di welcome.html,
-- dan lesson tugas disembunyikan dari daftar/sidebar + navigasi.
-- ON DELETE SET NULL: hapus pelajaran pemicu → tautan dilepas, tugas tetap ada.

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS popup_after_lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL;
