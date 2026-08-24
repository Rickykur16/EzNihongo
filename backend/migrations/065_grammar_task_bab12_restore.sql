-- 065_grammar_task_bab12_restore.sql — Restore 2 Tugas Bunpou Bab 12
-- (Konjugasi Te-form, Menghubungkan Kalimat dengan Te-form) — user
-- melaporkan lesson-nya sudah terhapus (kemungkinan besar tidak sengaja
-- lewat admin) setelah 062 sempat live di production.
--
-- Migration 062 sudah ter-apply & tercatat di schema_migrations, jadi
-- TIDAK bisa dijalankan ulang oleh runner (pola sama seperti 044/063 yang
-- memperbaiki migrasi sebelumnya) — file baru ini menjalankan LOGIKA YANG
-- PERSIS SAMA dengan 062 (idempotent by design: lesson di-upsert per
-- module_id+slug — kalau baris sudah terhapus, INSERT biasa akan
-- membuatnya lagi; bank module_grammar find-or-create; wiring
-- lesson_grammar_task_items dihapus lalu di-insert ulang; penomoran
-- deterministik ke posisi 5 dan 7 dihitung ulang dari kondisi modul
-- SEKARANG), sehingga aman dijalankan baik kalau lesson-nya benar-benar
-- hilang total maupun kalau cuma sebagian (mis. wiring-nya doang) yang
-- hilang.
--
-- Konten SAMA PERSIS dengan 062 — lihat file itu untuk detail rasional
-- 5 pola/split 3+2/posisi 5&7. Tidak ada perubahan desain di sini, murni
-- restore.

DO $$
DECLARE
  v_course_slug TEXT := 'n5';
  v_slug1       TEXT := 'tugas-bunpou-bab-12-konjugasi-te-form';
  v_slug2       TEXT := 'tugas-bunpou-bab-12-menghubungkan-kalimat-te';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson1_id   UUID;
  v_lesson2_id   UUID;
  v_other_count  INT;
  v_pos1         INT;
  v_pos2         INT;
  v_g_grup1   UUID; -- Te-form Grup 1 (u-verbs)
  v_g_grup2   UUID; -- Te-form Grup 2 (ru-verbs)
  v_g_irreg   UUID; -- Te-form Irregular
  v_g_te      UUID; -- 〜て、〜
  v_g_tekara  UUID; -- 〜てから
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 11 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '065: modul Bab 12 di kursus % tidak ditemukan — skip restore.', v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* '(te-?form|konjugasi|penghubung)' THEN
    RAISE NOTICE '065: modul Bab 12 terbaca "%" — kalau ternyata bukan Bab Te-form, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).', v_module_title;
  END IF;

  RAISE NOTICE '065: restore 2 Tugas Bunpou Bab 12 ke modul "%".', v_module_title;

  -- ===== Bank module_grammar: find-or-create per pola =====

  SELECT id INTO v_g_grup1 FROM module_grammar
   WHERE module_id = v_module_id AND pattern = 'Te-form Golongan 1 (u-verbs)';
  IF v_g_grup1 IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, 'Te-form Golongan 1 (u-verbs)', 'konjugasi te-form kata kerja golongan 1', 'のむ→のんで、かく→かいて',
      'Akhiran kamus menentukan bentuk te: う・つ・る→って (かう→かって、まつ→まって、かえる→かえって); ぬ・ぶ・む→んで (しぬ→しんで、よぶ→よんで、のむ→のんで); く→いて (かく→かいて, KECUALI いく→いって); ぐ→いで (およぐ→およいで); す→して (はなす→はなして).'
    ) RETURNING id INTO v_g_grup1;
  END IF;

  SELECT id INTO v_g_grup2 FROM module_grammar
   WHERE module_id = v_module_id AND pattern = 'Te-form Golongan 2 (ru-verbs)';
  IF v_g_grup2 IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, 'Te-form Golongan 2 (ru-verbs)', 'konjugasi te-form kata kerja golongan 2', 'たべる→たべて、みる→みて',
      'Cukup buang る di akhir kata kamus, ganti dengan て. Berlaku untuk semua kata kerja golongan 2 (berakhiran いる／える yang bentuk kamusnya ichidan).'
    ) RETURNING id INTO v_g_grup2;
  END IF;

  SELECT id INTO v_g_irreg FROM module_grammar
   WHERE module_id = v_module_id AND pattern = 'Te-form Tidak Beraturan';
  IF v_g_irreg IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, 'Te-form Tidak Beraturan', 'konjugasi te-form 2 kata kerja tidak beraturan', 'する→して、くる→きて',
      'Hanya 2 kata kerja tidak beraturan di N5: する (melakukan) → して, くる (datang) → きて. Wajib dihafal, tidak mengikuti pola golongan 1 atau 2.'
    ) RETURNING id INTO v_g_irreg;
  END IF;

  SELECT id INTO v_g_te FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜て、〜';
  IF v_g_te IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜て、〜', 'lalu／kemudian (penghubung aksi berurutan)', 'あさおきて、コーヒーをのみます。',
      'Menghubungkan 2 aksi atau lebih yang terjadi berurutan dalam satu kalimat. Semua kata kerja SEBELUM yang terakhir pakai bentuk te, hanya kata kerja TERAKHIR yang pakai bentuk ます／ました.'
    ) RETURNING id INTO v_g_te;
  END IF;

  SELECT id INTO v_g_tekara FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜てから';
  IF v_g_tekara IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜てから', 'setelah ~ (urutan tegas: X selesai dulu baru Y)', 'ごはんをたべてから、でかけます。',
      'Mirip 〜て、〜 tapi menegaskan urutan waktu: aksi pertama HARUS selesai dulu sebelum aksi kedua terjadi. てから lebih tegas daripada 〜て、〜 yang netral soal urutan.'
    ) RETURNING id INTO v_g_tekara;
  END IF;

  IF v_g_grup1 IS NULL OR v_g_grup2 IS NULL OR v_g_irreg IS NULL OR v_g_te IS NULL OR v_g_tekara IS NULL THEN
    RAISE EXCEPTION '065: gagal resolve salah satu dari 5 pola grammar Bab 12';
  END IF;

  -- ===== Dua lesson grammar_task (upsert — INSERT biasa kalau baris sudah terhapus) =====

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, cooldown_hours
  ) VALUES (
    v_module_id, v_slug1, 'Tugas Bunpou Bab 12 — Konjugasi Te-form', 'grammar_task',
    'Buat kalimat pakai 3 pola konjugasi te-form Bab 12 (golongan 1/u-verbs, golongan 2/ru-verbs, dan 2 kata tidak beraturan する／くる), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
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
    v_module_id, v_slug2, 'Tugas Bunpou Bab 12 — Menghubungkan Kalimat dengan Te-form', 'grammar_task',
    'Buat kalimat pakai 2 pola penghubung Bab 12 (menghubungkan aksi berurutan dengan 〜て、〜, dan menegaskan urutan waktu dengan 〜てから), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
    15, 101, 70, 12
  )
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title, type = EXCLUDED.type, content = EXCLUDED.content,
    duration_minutes = EXCLUDED.duration_minutes, updated_at = NOW()
  RETURNING id INTO v_lesson2_id;

  -- ===== Wiring pola ke tiap tugas =====

  DELETE FROM lesson_grammar_task_items WHERE lesson_id IN (v_lesson1_id, v_lesson2_id);

  INSERT INTO lesson_grammar_task_items (lesson_id, grammar_id, sort_order, instruction, required_count) VALUES
    (v_lesson1_id, v_g_grup1,  1, 'Buat satu kalimat memakai kata kerja golongan 1 (u-verbs) dalam bentuk te-form.', 1),
    (v_lesson1_id, v_g_grup2,  2, 'Buat satu kalimat memakai kata kerja golongan 2 (ru-verbs) dalam bentuk te-form.', 1),
    (v_lesson1_id, v_g_irreg,  3, 'Buat satu kalimat memakai する atau くる dalam bentuk te-form (して atau きて).', 1),
    (v_lesson2_id, v_g_te,     1, 'Buat satu kalimat yang menghubungkan 2 aksi berurutan memakai pola 〜て、〜.', 1),
    (v_lesson2_id, v_g_tekara, 2, 'Buat satu kalimat memakai pola 〜てから untuk menegaskan urutan waktu (X selesai dulu, baru Y).', 1);

  -- ===== Penomoran ulang supaya tugas jatuh di urutan 5 dan 7 =====

  SELECT COUNT(*) INTO v_other_count
    FROM lessons
   WHERE module_id = v_module_id AND id <> v_lesson1_id AND id <> v_lesson2_id;

  IF v_other_count < 5 THEN
    RAISE NOTICE '065: modul "%" cuma punya % lesson lain (< 5) — urutan 5 dan 7 tidak bisa dibentuk, kedua tugas ditaruh di akhir modul. Geser manual lewat admin kalau perlu.',
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

  IF (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson1_id) <> 3
     OR (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson2_id) <> 2 THEN
    RAISE EXCEPTION '065: Tugas 1 harus punya tepat 3 pola dan Tugas 2 tepat 2 pola (dapat % dan %)',
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson1_id),
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson2_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM lesson_grammar_task_items
     WHERE lesson_id IN (v_lesson1_id, v_lesson2_id)
       AND (instruction IS NULL OR required_count <> 1)
  ) THEN
    RAISE EXCEPTION '065: ada wiring tanpa instruction atau required_count bukan 1';
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
      RAISE EXCEPTION '065: posisi final tugas bukan 5 dan 7 (dapat % dan %)', v_pos1, v_pos2;
    END IF;

    IF EXISTS (
      SELECT sort_order FROM lessons WHERE module_id = v_module_id
       GROUP BY sort_order HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION '065: ada sort_order kembar di modul setelah penomoran ulang';
    END IF;

    RAISE NOTICE '065: selesai — Tugas Konjugasi Te-form di urutan %, Tugas Menghubungkan Kalimat dengan Te-form di urutan % (5 kalimat wajib total).', v_pos1, v_pos2;
  ELSE
    RAISE NOTICE '065: selesai — 2 tugas ter-wire (5 kalimat wajib total), posisi menyusul diatur manual.';
  END IF;
END $$;
