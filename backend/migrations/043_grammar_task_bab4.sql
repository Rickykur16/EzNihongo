-- 043_grammar_task_bab4.sql — Tugas Bunpou Bab 4: Benda di Sekitar.
--
-- Sama seperti 039-042: kurikulum tidak disimpan di repo (module_grammar /
-- lesson_grammar_task_items = 0 baris di seluruh migrasi lain), jadi konten
-- di bawah ditarik dari Notion N5-B4 "Benda di Sekitar", modul KEEMPAT
-- kursus n5 (ordinal — lanjutan OFFSET 0/1/2 di 039/040/041/042).
--
-- 5 pola grammar (GRM-18, GRM-19, GRM-20, GRM-21, GRM-227):
--   これ／それ／あれは〜です・〜の〜(penjelas)・この／その／あの／どの+名詞・
--   だれの〜ですか・そうです／そうじゃありません.
-- Kosakata Bab 4 (46 kata Notion) semua benda sehari-hari (本・ペン・かばん・
-- じしょ・けいたい dst) — dipakai sebagai objek contoh, tanpa verifikasi mesin
-- seketat kuis karena tugas ini dinilai AI atas kalimat bebas siswa, bukan
-- pilihan ganda berkunci.
--
-- ATURAN LEVEL (pelajaran keras dari migration 041→042, ditegakkan lagi di
-- sini): instruksi & contoh 100% pola Bab 1-4 saja — TANPA kata sifat (contoh
-- asli Notion「この本は面白いです」memakai 面白い, kata sifat Bab 6-7, jadi
-- diganti), tanpa kata kerja, tanpa menyinggung materi setelah Bab 4.
--
-- BANK module_grammar: FIND-OR-CREATE per pola (bukan blind insert). Tidak
-- ada unique constraint di module_grammar selain id, dan tidak diketahui
-- apakah admin sudah authoring sebagian pola Bab 4 lewat UI (seperti yang
-- terjadi di Bab 3) — jadi tiap pola dicari dulu by (module_id, pattern)
-- exact match, baru INSERT kalau belum ada. Ini mencegah bank kembar baik
-- saat re-run migrasi maupun kalau sebagian sudah ada di produksi.
--
-- POPUP: lessons.popup_after_lesson_id SENGAJA tidak diisi — tidak diketahui
-- slug lesson pemicu yang valid di produksi Bab 4, dan field ini admin-
-- editable kapan saja lewat form tanpa perlu migrasi baru.
--
-- PERINGATAN RE-RUN: DELETE FROM lesson_grammar_task_items di bawah tanpa
-- syarat — kalau admin sudah menambah pola manual ke tugas ini, re-run
-- migrasi ini manual akan menghapus wiring itu (bank module_grammar sendiri
-- TIDAK terhapus, cuma wiring-nya). Runner (migrations/run.js) sendiri cuma
-- menjalankan file ini SEKALI per DB (tercatat di schema_migrations).
--
-- Idempotent: lesson di-upsert per (module_id, slug), wiring lama dihapus lalu
-- di-insert ulang, bank module_grammar find-or-create; no-op aman kalau
-- modul target belum ada.

DO $$
DECLARE
  v_course_slug  TEXT := 'n5';
  v_lesson_slug  TEXT := 'tugas-bunpou-bab-4-benda-sekitar';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson_id    UUID;
  v_g1 UUID; -- これ／それ／あれは〜です
  v_g2 UUID; -- 〜の〜 (penjelas)
  v_g3 UUID; -- この／その／あの／どの + 名詞
  v_g4 UUID; -- だれの〜ですか
  v_g5 UUID; -- そうです／そうじゃありません
BEGIN
  -- Bab 4 = modul KEEMPAT kelas N5 menurut sort_order (posisi, bukan title —
  -- konsisten dengan 039/040/041/042).
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 3 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '043: modul Bab 4 di kursus % tidak ditemukan — skip seed tugas bunpou.', v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* '(benda|sekitar)' THEN
    RAISE NOTICE '043: modul Bab 4 terbaca "%" — kalau ternyata bukan Bab Benda di Sekitar, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).', v_module_title;
  END IF;

  RAISE NOTICE '043: seed Tugas Bunpou Bab 4 ke modul "%".', v_module_title;

  -- ===== Bank module_grammar: find-or-create per pola =====

  SELECT id INTO v_g1 FROM module_grammar
   WHERE module_id = v_module_id AND pattern = 'これ／それ／あれは〜です';
  IF v_g1 IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, 'これ／それ／あれは〜です', 'ini/itu/itu adalah ~', 'これは ほんです。',
      'これ dipakai untuk benda dekat pembicara, それ dekat lawan bicara, あれ jauh dari keduanya.'
    ) RETURNING id INTO v_g1;
  END IF;

  SELECT id INTO v_g2 FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜の〜 (penjelas)';
  IF v_g2 IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜の〜 (penjelas)', 'penjelas: jenis, kategori, atau punya siapa', 'にほんごの ほんです。',
      'Beda dari の kepemilikan Bab 3 (わたしの なまえ): di sini kata benda pertama menerangkan kata benda kedua, bisa jenis/bahasa/asal, bukan cuma kepunyaan orang.'
    ) RETURNING id INTO v_g2;
  END IF;

  SELECT id INTO v_g3 FROM module_grammar
   WHERE module_id = v_module_id AND pattern = 'この／その／あの／どの + 名詞';
  IF v_g3 IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, 'この／その／あの／どの + 名詞', 'demonstratif sebelum kata benda (ini/itu/itu/yang mana + benda)', 'この ペンは わたしのです。',
      'Selalu diikuti kata benda langsung (この ペン), beda dari これ／それ／あれ／どれ yang berdiri sendiri tanpa kata benda.'
    ) RETURNING id INTO v_g3;
  END IF;

  SELECT id INTO v_g4 FROM module_grammar
   WHERE module_id = v_module_id AND pattern = 'だれの〜ですか';
  IF v_g4 IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, 'だれの〜ですか', 'punya siapa ~?', 'これは だれの ほんですか。',
      'Menanyakan pemilik sebuah benda. Dijawab dengan pola の kepemilikan, mis. わたしのです.'
    ) RETURNING id INTO v_g4;
  END IF;

  SELECT id INTO v_g5 FROM module_grammar
   WHERE module_id = v_module_id AND pattern = 'そうです／そうじゃありません';
  IF v_g5 IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, 'そうです／そうじゃありません', 'iya, benar / bukan, salah', 'はい、そうです。',
      'Dipakai untuk membenarkan atau membantah pernyataan lawan bicara tanpa mengulang seluruh kalimat.'
    ) RETURNING id INTO v_g5;
  END IF;

  IF v_g1 IS NULL OR v_g2 IS NULL OR v_g3 IS NULL OR v_g4 IS NULL OR v_g5 IS NULL THEN
    RAISE EXCEPTION '043: gagal resolve salah satu dari 5 pola grammar Bab 4 (v_g1=% v_g2=% v_g3=% v_g4=% v_g5=%)',
      v_g1, v_g2, v_g3, v_g4, v_g5;
  END IF;

  -- ===== Lesson grammar_task (upsert) =====

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, cooldown_hours
  ) VALUES (
    v_module_id, v_lesson_slug, 'Tugas Bunpou Bab 4 — Benda di Sekitar', 'grammar_task',
    'Buat kalimat pakai 5 pola grammar Bab 4 (これ／それ／あれは〜です, 〜の〜, この／その／あの／どの+名詞, だれの〜ですか, そうです／そうじゃありません), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
    15, 100, 70, 12
  )
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    type = EXCLUDED.type,
    content = EXCLUDED.content,
    duration_minutes = EXCLUDED.duration_minutes,
    updated_at = NOW()
  RETURNING id INTO v_lesson_id;

  -- Re-seed wiring bersih (bank module_grammar TIDAK ikut terhapus).
  DELETE FROM lesson_grammar_task_items WHERE lesson_id = v_lesson_id;

  INSERT INTO lesson_grammar_task_items (lesson_id, grammar_id, sort_order, instruction, required_count) VALUES
    (v_lesson_id, v_g1, 1, 'Tunjuk salah satu benda di dekatmu (buku, pulpen, HP, dst), lalu buat kalimat pakai これ, それ, atau あれ.', 2),
    (v_lesson_id, v_g2, 2, 'Buat kalimat yang menjelaskan sebuah benda pakai 〜の〜, misalnya jenis bahasanya atau benda itu punya siapa (contoh: にほんごの ほん).', 2),
    (v_lesson_id, v_g3, 3, 'Buat kalimat pakai この, その, atau あの diikuti langsung nama bendanya (contoh: この ペン).', 2),
    (v_lesson_id, v_g4, 4, 'Buat kalimat tanya untuk menanyakan sebuah benda itu punya siapa, pakai だれの〜ですか.', 2),
    (v_lesson_id, v_g5, 5, 'Buat kalimat jawaban yang memakai そうです atau そうじゃありません.', 1);

  -- Assertion — pola sama dengan 041/042: verifikasi bentuk sebelum migrasi
  -- dianggap sukses, bukan diam-diam mengirim tugas rusak ke produksi.
  IF (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson_id) <> 5 THEN
    RAISE EXCEPTION '043: jumlah pola ter-wire bukan 5 (dapat %)',
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM lesson_grammar_task_items
     WHERE lesson_id = v_lesson_id AND (instruction IS NULL OR required_count < 1)
  ) THEN
    RAISE EXCEPTION '043: ada wiring tanpa instruction atau required_count < 1';
  END IF;

  RAISE NOTICE '043: selesai — 5 pola ter-wire (total % kalimat wajib).',
    (SELECT SUM(required_count) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson_id);
END $$;
