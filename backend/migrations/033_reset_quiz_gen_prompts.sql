-- 033_reset_quiz_gen_prompts.sql — Hapus prompt generator custom yang membeku.
--
-- Jebakan UX lama: textarea "Prompt Generator AI (lanjutan)" di admin.html
-- selalu terisi default server, jadi sekali admin klik "Simpan Prompt",
-- default LAMA itu tersimpan sebagai custom di app_settings dan semua
-- perbaikan prompt default berikutnya (format dialog JLPT, contoh JSON
-- listening, aturan N/A/B) tidak pernah kepakai — hasil generate listening
-- tetap rusak walau kode sudah di-update.
--
-- Reset sekali: hapus nilai tersimpan → backend jatuh ke default terbaru di
-- kode. Admin yang BENERAN mau custom bisa simpan ulang lewat UI (yang
-- sekarang hanya memuat nilai custom, bukan default, jadi jebakannya hilang).

DELETE FROM app_settings WHERE key IN ('quiz_gen_prompt', 'listening_gen_prompt');
