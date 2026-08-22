-- 054_grammar_task_bab8.sql — Dua Tugas Bunpou Bab 8: Ada & Di Mana, Posisi Relatif.
--
-- Melanjutkan pola tugas bunpou Bab 3-7 (043/046/048/052). Konten dari
-- Notion N5-B8 "Lokasi & Tempat"; modul di-resolve ordinal (OFFSET 7,
-- lanjutan OFFSET 0-6 di 039-053).
--
-- PERUBAHAN BESAR: Bab 8 memperkenalkan あります／います (kata kerja
-- eksistensi) dan partikel に untuk pertama kalinya — keduanya SENGAJA
-- dilarang total di semua assignment kuis Bab 1-7 (lihat komentar di
-- 039-053, "kata kerja masih dilarang total ... あります／います —
-- existence verb baru diajarkan di Bab 8"). Migrasi ini TIDAK menyentuh
-- pagar assignment manapun — grammar_task tidak punya assertion SQL untuk
-- kosakata/partikel (beda dari quiz_questions). Kalau nanti dibuat
-- assignment kuis Bab 8, pagar kata-kerja & partikel di 042/045/047/051/053
-- WAJIB direvisi eksplisit saat itu (di luar cakupan migrasi ini).
--
-- Hanya 4 pola grammar Bab 8 (Notion Grammar DB, filter Lesson=Bab8) —
-- lebih sedikit dari Bab 6/7 (6 pola), jadi dibagi 2+2 ke dua tugas
-- (pola sama dengan Bab 5/046 yang juga 4 pola → 2+2), di posisi sidebar
-- yang SAMA seperti Bab 6/7 (urutan 5 dan 7 — konvensi sesi ini):
--   Tugas 1 — Ada & Di Mana (urutan 5): 〜に〜があります／います
--     (menyatakan keberadaan) / どこに〜がありますか (menanyakan lokasi).
--   Tugas 2 — Posisi Relatif (urutan 7): 〜は〜にあります／います (topik
--     dulu, kebalikan urutan Tugas 1) / [noun]の[position] (posisi
--     relatif: atas/bawah/dalam/luar/dst, disambung dengan の).
-- required_count = 1 per pola, konsisten dengan tugas bunpou Bab 3-7.
--
-- 9 kanji resmi Bab 8 (下前外間右中左後上, dikonfirmasi dari kanji_items
-- production DAN Notion Kanji DB) TIDAK dipakai di contoh module_grammar —
-- examples tetap 100% kana, mengikuti pola 048/052 (instructional content,
-- bukan quiz_questions ber-pagar-kanji).
--
-- POSISI: pola PENOMORAN ULANG deterministik yang sama seperti 048/052
-- (BUKAN geser-relatif) karena menyisip DUA lesson sekaligus.
--     lesson lama ke-1..4  → sort_order 1..4
--     Tugas 1 (Ada & Di Mana)  → sort_order 5
--     lesson lama ke-5     → sort_order 6
--     Tugas 2 (Posisi Relatif) → sort_order 7
--     lesson lama ke-6..n  → sort_order 8..n+2
-- Fallback aman: kalau modul Bab 8 punya < 5 lesson lain, penomoran
-- dilewati dan kedua tugas ditaruh di akhir modul dengan NOTICE.
--
-- Bank module_grammar tetap FIND-OR-CREATE per pola, sama seperti 043/046/
-- 048/052.
--
-- POPUP: lessons.popup_after_lesson_id sengaja tidak diisi.
--
-- PERINGATAN RE-RUN: DELETE FROM lesson_grammar_task_items di bawah tanpa
-- syarat — re-run migrasi ini manual akan menghapus wiring admin yang
-- ditambah manual (bank module_grammar sendiri TIDAK terhapus). Runner
-- (migrations/run.js) menjalankan file ini SEKALI per DB.
--
-- Idempotent: lesson di-upsert per (module_id, slug), wiring lama dihapus
-- lalu di-insert ulang, bank find-or-create, penomoran deterministik;
-- no-op aman kalau modul target belum ada.

DO $$
DECLARE
  v_course_slug TEXT := 'n5';
  v_slug1       TEXT := 'tugas-bunpou-bab-8-ada-di-mana';
  v_slug2       TEXT := 'tugas-bunpou-bab-8-posisi-relatif';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson1_id   UUID;
  v_lesson2_id   UUID;
  v_other_count  INT;
  v_pos1         INT;
  v_pos2         INT;
  v_g_ada        UUID; -- 〜に〜があります／います
  v_g_dokoni     UUID; -- どこに〜がありますか
  v_g_topik      UUID; -- 〜は〜にあります／います
  v_g_posisi     UUID; -- [noun]の[position]
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 7 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '054: modul Bab 8 di kursus % tidak ditemukan — skip seed tugas bunpou.', v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* '(lokasi|tempat|posisi|location)' THEN
    RAISE NOTICE '054: modul Bab 8 terbaca "%" — kalau ternyata bukan Bab Lokasi & Tempat, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).', v_module_title;
  END IF;

  RAISE NOTICE '054: seed 2 Tugas Bunpou Bab 8 ke modul "%".', v_module_title;

  -- ===== Bank module_grammar: find-or-create per pola =====

  SELECT id INTO v_g_ada FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜に〜があります／います';
  IF v_g_ada IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜に〜があります／います', 'menyatakan keberadaan: ada ~ di ~', 'つくえの うえに ほんが あります。',
      'あります dipakai untuk benda mati (buku, meja, dst), います dipakai untuk makhluk hidup (orang, hewan). Urutan: [tempat]に [benda/orang]が あります／います.'
    ) RETURNING id INTO v_g_ada;
  END IF;

  SELECT id INTO v_g_dokoni FROM module_grammar
   WHERE module_id = v_module_id AND pattern = 'どこに〜がありますか';
  IF v_g_dokoni IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, 'どこに〜がありますか', 'menanyakan lokasi: di mana ada ~', 'としょかんは どこに ありますか。',
      'どこに menanyakan tempat, diikuti が + あります／います. Bisa juga dipasangkan dengan は di depan kalau bendanya sudah jadi topik (としょかんは どこに ありますか).'
    ) RETURNING id INTO v_g_dokoni;
  END IF;

  SELECT id INTO v_g_topik FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜は〜にあります／います';
  IF v_g_topik IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜は〜にあります／います', 'topik dulu: ~ ada di ~ (kebalikan urutan 〜に〜があります)', 'ほんは つくえの うえに あります。',
      'Kalau bendanya sudah diketahui (topik), pakai は di depan lalu に menandai lokasi: [benda/orang]は [tempat]に あります／います. Urutan kebalikan dari pola pertama.'
    ) RETURNING id INTO v_g_topik;
  END IF;

  SELECT id INTO v_g_posisi FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '[noun]の[position]';
  IF v_g_posisi IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '[noun]の[position]', 'posisi relatif (atas/bawah/dalam/luar/dst)', 'つくえの うえ',
      'Kata posisi (うえ/した/なか/そと/まえ/うしろ/みぎ/ひだり/あいだ dst) disambung ke kata benda dengan の, membentuk satu frasa lokasi: [kata benda]の[posisi]. Frasa ini lalu dipakai bersama に di pola-pola lain (つくえの うえに).'
    ) RETURNING id INTO v_g_posisi;
  END IF;

  IF v_g_ada IS NULL OR v_g_dokoni IS NULL OR v_g_topik IS NULL OR v_g_posisi IS NULL THEN
    RAISE EXCEPTION '054: gagal resolve salah satu dari 4 pola grammar Bab 8';
  END IF;

  -- ===== Dua lesson grammar_task (upsert) =====

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, cooldown_hours
  ) VALUES (
    v_module_id, v_slug1, 'Tugas Bunpou Bab 8 — Ada & Di Mana', 'grammar_task',
    'Buat kalimat pakai 2 pola dasar keberadaan Bab 8 (menyatakan sesuatu ada di suatu tempat, dan menanyakan di mana sesuatu berada), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
    15, 100, 70, 12
  )
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title, type = EXCLUDED.type, content = EXCLUDED.content,
    duration_minutes = EXCLUDED.duration_minutes, updated_at = NOW()
  RETURNING id INTO v_lesson1_id;

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, cooldown_hours
  ) VALUES (
    v_module_id, v_slug2, 'Tugas Bunpou Bab 8 — Posisi Relatif', 'grammar_task',
    'Buat kalimat pakai 2 pola lanjutan Bab 8 (kalimat dengan topik di depan, dan menyatakan posisi relatif seperti atas/bawah/dalam/luar), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
    15, 101, 70, 12
  )
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title, type = EXCLUDED.type, content = EXCLUDED.content,
    duration_minutes = EXCLUDED.duration_minutes, updated_at = NOW()
  RETURNING id INTO v_lesson2_id;

  -- ===== Wiring pola ke tiap tugas =====

  DELETE FROM lesson_grammar_task_items WHERE lesson_id IN (v_lesson1_id, v_lesson2_id);

  INSERT INTO lesson_grammar_task_items (lesson_id, grammar_id, sort_order, instruction, required_count) VALUES
    (v_lesson1_id, v_g_ada,    1, 'Buat satu kalimat memakai pola 〜に〜があります／います untuk menyatakan sesuatu ada di suatu tempat — ingat あります untuk benda mati, います untuk makhluk hidup.', 1),
    (v_lesson1_id, v_g_dokoni, 2, 'Buat satu kalimat tanya memakai pola どこに〜がありますか untuk menanyakan di mana sesuatu berada.', 1),
    (v_lesson2_id, v_g_topik,  1, 'Buat satu kalimat memakai pola 〜は〜にあります／います, dengan bendanya diletakkan sebagai topik di depan kalimat.', 1),
    (v_lesson2_id, v_g_posisi, 2, 'Buat satu kalimat yang memakai kata posisi (contoh: うえ/した/なか/そと) disambung dengan の ke kata benda untuk menjelaskan lokasi sesuatu.', 1);

  -- ===== Penomoran ulang supaya tugas jatuh di urutan 5 dan 7 =====

  SELECT COUNT(*) INTO v_other_count
    FROM lessons
   WHERE module_id = v_module_id AND id <> v_lesson1_id AND id <> v_lesson2_id;

  IF v_other_count < 5 THEN
    RAISE NOTICE '054: modul "%" cuma punya % lesson lain (< 5) — urutan 5 dan 7 tidak bisa dibentuk, kedua tugas ditaruh di akhir modul. Geser manual lewat admin kalau perlu.',
      v_module_title, v_other_count;
  ELSE
    WITH ordered AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order ASC, created_at ASC) AS rn
        FROM lessons
       WHERE module_id = v_module_id
         AND id <> v_lesson1_id AND id <> v_lesson2_id
    ), target AS (
      SELECT id,
             (CASE WHEN rn <= 4 THEN rn
                   WHEN rn = 5  THEN 6
                   ELSE rn + 2
              END)::INT AS new_sort
        FROM ordered
    )
    UPDATE lessons l
       SET sort_order = t.new_sort, updated_at = NOW()
      FROM target t
     WHERE l.id = t.id AND l.sort_order IS DISTINCT FROM t.new_sort;

    UPDATE lessons SET sort_order = 5, updated_at = NOW()
     WHERE id = v_lesson1_id AND sort_order IS DISTINCT FROM 5;
    UPDATE lessons SET sort_order = 7, updated_at = NOW()
     WHERE id = v_lesson2_id AND sort_order IS DISTINCT FROM 7;
  END IF;

  -- ===== Assertion =====

  IF (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson1_id) <> 2
     OR (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson2_id) <> 2 THEN
    RAISE EXCEPTION '054: tiap tugas harus punya tepat 2 pola (dapat % dan %)',
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson1_id),
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson2_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM lesson_grammar_task_items
     WHERE lesson_id IN (v_lesson1_id, v_lesson2_id)
       AND (instruction IS NULL OR required_count <> 1)
  ) THEN
    RAISE EXCEPTION '054: ada wiring tanpa instruction atau required_count bukan 1';
  END IF;

  IF v_other_count >= 5 THEN
    SELECT rn INTO v_pos1 FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order ASC, created_at ASC) AS rn
        FROM lessons WHERE module_id = v_module_id
    ) x WHERE x.id = v_lesson1_id;
    SELECT rn INTO v_pos2 FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order ASC, created_at ASC) AS rn
        FROM lessons WHERE module_id = v_module_id
    ) x WHERE x.id = v_lesson2_id;

    IF v_pos1 <> 5 OR v_pos2 <> 7 THEN
      RAISE EXCEPTION '054: posisi final tugas bukan 5 dan 7 (dapat % dan %)', v_pos1, v_pos2;
    END IF;

    IF EXISTS (
      SELECT sort_order FROM lessons WHERE module_id = v_module_id
       GROUP BY sort_order HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION '054: ada sort_order kembar di modul setelah penomoran ulang';
    END IF;

    RAISE NOTICE '054: selesai — Tugas Ada & Di Mana di urutan %, Tugas Posisi Relatif di urutan % (4 kalimat wajib total).', v_pos1, v_pos2;
  ELSE
    RAISE NOTICE '054: selesai — 2 tugas ter-wire (4 kalimat wajib total), posisi menyusul diatur manual.';
  END IF;
END $$;
