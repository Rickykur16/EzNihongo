-- 094_grammar_task_bab17.sql — Dua Tugas Bunpou Bab 17: Suka & Mahir,
-- Kemampuan & Bertanya Jenis.
--
-- Melanjutkan pola tugas bunpou Bab 3-16 (043/046/048/052/054/056/058/060/
-- 062/065/090/091/092/093). Mengisi slot sort_order 5 dan 7 yang sengaja
-- disisakan kosong oleh 086_bunpou_bab17.sql (materi Tata Bahasa Bab 17 di
-- sort_order 4 dan 6) — lihat file itu untuk konteks lengkap kurikulum
-- Bab 17.
--
-- 4 pola grammar Bab 17, dibagi 2+2 (SAMA PERSIS split pelajaran Tata
-- Bahasa di 086):
--   Tugas 1 — Suka & Mahir (urutan 5, 2 pola): 〜が好きです／嫌いです (suka/
--     tidak suka), 〜が上手です／下手です (mahir/tidak mahir).
--   Tugas 2 — Kemampuan & Bertanya Jenis (urutan 7, 2 pola): 〜ができます
--     (kemampuan), どんな〜 (bertanya jenis/sifat).
-- required_count = 1 per pola, konsisten dengan tugas bunpou Bab 3-16.
--
-- Bank module_grammar FIND-OR-CREATE per pola dengan pattern string PERSIS
-- SAMA dengan 086_bunpou_bab17.sql (find akan selalu hit karena 086 sudah
-- membuat baris ini; INSERT fallback isinya disalin identik dari 086 kalau
-- baris itu ternyata sudah terhapus).
--
-- POSISI: pola penomoran ulang berbasis ROW_NUMBER (bukan sort_order
-- literal) yang sama seperti 090-093, aman dijalankan apa pun kondisi
-- sort_order modul saat ini:
--     lesson lama ke-1..4  → sort_order 1..4
--     Tugas 1 (Suka & Mahir) → sort_order 5
--     lesson lama ke-5     → sort_order 6
--     Tugas 2 (Kemampuan & Bertanya Jenis) → sort_order 7
--     lesson lama ke-6..n  → sort_order 8..n+2
-- Fallback aman: kalau modul Bab 17 punya < 5 lesson lain, penomoran
-- dilewati dan kedua tugas ditaruh di akhir modul dengan NOTICE.
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
  v_bab_no      INT  := 17;
  v_title_re    TEXT := '(suka|mahir|hobi)';
  v_slug1       TEXT := 'tugas-bunpou-bab-17-suka-mahir';
  v_slug2       TEXT := 'tugas-bunpou-bab-17-kemampuan-bertanya-jenis';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson1_id   UUID;
  v_lesson2_id   UUID;
  v_other_count  INT;
  v_pos1         INT;
  v_pos2         INT;
  v_g_suki    UUID; -- 〜が好きです／嫌いです
  v_g_jouzu   UUID; -- 〜が上手です／下手です
  v_g_dekimasu UUID; -- 〜ができます
  v_g_donna   UUID; -- どんな〜
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET (v_bab_no - 1) LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '094: modul Bab % di kursus % tidak ditemukan — skip seed tugas bunpou.', v_bab_no, v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* v_title_re THEN
    RAISE NOTICE '094: modul Bab % terbaca "%" — kalau ternyata bukan bab yang dimaksud, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).',
      v_bab_no, v_module_title;
  END IF;

  RAISE NOTICE '094: seed 2 Tugas Bunpou Bab % ke modul "%".', v_bab_no, v_module_title;

  -- ===== Bank module_grammar: find-or-create per pola (persis 086) =====

  SELECT id INTO v_g_suki FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜が好きです／嫌いです';
  IF v_g_suki IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜が好きです／嫌いです', 'suka / tidak suka', 'わたしは ねこが すきです。',
      'Objek yang disukai ditandai が, BUKAN を — karena すき dan きらい adalah kata sifat な, bukan kata kerja. Penguatnya だいすき (sangat suka) dan だいきらい (sangat benci). Bentuk negatifnya mengikuti kata sifat な: すきじゃありません.'
    ) RETURNING id INTO v_g_suki;
  END IF;

  SELECT id INTO v_g_jouzu FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜が上手です／下手です';
  IF v_g_jouzu IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜が上手です／下手です', 'mahir / tidak mahir', 'あねは りょうりが 上手です。',
      'Sama seperti すき, kemampuan ditandai が. じょうず dipakai untuk MEMUJI orang lain — memuji diri sendiri dengan じょうず terdengar sombong, untuk itu pakai とくいです. Lawannya へた (tidak mahir).'
    ) RETURNING id INTO v_g_jouzu;
  END IF;

  SELECT id INTO v_g_dekimasu FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜ができます';
  IF v_g_dekimasu IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜ができます', 'bisa ~ (kemampuan)', 'わたしは 日本語が できます。',
      'できます menyatakan KEMAMPUAN atau kemungkinan, dan objeknya ditandai が. Dipakai untuk bahasa, keterampilan, dan olahraga (日本語が できます、うんてんが できます). Untuk kata kerja lain, N4 memakai pola 〜ことができる.'
    ) RETURNING id INTO v_g_dekimasu;
  END IF;

  SELECT id INTO v_g_donna FROM module_grammar
   WHERE module_id = v_module_id AND pattern = 'どんな〜';
  IF v_g_donna IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, 'どんな〜', '~ yang seperti apa', 'どんな たべものが すきですか。',
      'どんな SELALU diikuti kata benda (どんな 人、どんな 本). Beda dari どう yang berdiri sendiri (どうですか＝bagaimana). Jawabannya berupa sifat atau jenis, bukan ya/tidak.'
    ) RETURNING id INTO v_g_donna;
  END IF;

  IF v_g_suki IS NULL OR v_g_jouzu IS NULL OR v_g_dekimasu IS NULL OR v_g_donna IS NULL THEN
    RAISE EXCEPTION '094: gagal resolve salah satu dari 4 pola grammar Bab 17';
  END IF;

  -- ===== Dua lesson grammar_task (upsert) =====

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, cooldown_hours
  ) VALUES (
    v_module_id, v_slug1, 'Tugas Bunpou Bab 17: Suka & Mahir', 'grammar_task',
    'Buat kalimat pakai 2 pola Bab 17 (menyatakan suka/tidak suka dengan 〜が好きです／嫌いです, dan menyatakan mahir/tidak mahir dengan 〜が上手です／下手です), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
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
    v_module_id, v_slug2, 'Tugas Bunpou Bab 17: Kemampuan & Bertanya Jenis', 'grammar_task',
    'Buat kalimat pakai 2 pola Bab 17 (menyatakan kemampuan dengan 〜ができます, dan bertanya jenis/sifat sesuatu dengan どんな〜), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
    15, 101, 70, 12
  )
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title, type = EXCLUDED.type, content = EXCLUDED.content,
    duration_minutes = EXCLUDED.duration_minutes, updated_at = NOW()
  RETURNING id INTO v_lesson2_id;

  -- ===== Wiring pola ke tiap tugas =====

  DELETE FROM lesson_grammar_task_items WHERE lesson_id IN (v_lesson1_id, v_lesson2_id);

  INSERT INTO lesson_grammar_task_items (lesson_id, grammar_id, sort_order, instruction, required_count) VALUES
    (v_lesson1_id, v_g_suki,     1, 'Buat satu kalimat memakai pola 〜が好きです atau 〜が嫌いです untuk menyatakan suka atau tidak suka pada sesuatu.', 1),
    (v_lesson1_id, v_g_jouzu,    2, 'Buat satu kalimat memakai pola 〜が上手です atau 〜が下手です untuk menyatakan mahir atau tidak mahir dalam sesuatu.', 1),
    (v_lesson2_id, v_g_dekimasu, 1, 'Buat satu kalimat memakai pola 〜ができます untuk menyatakan kemampuan melakukan sesuatu.', 1),
    (v_lesson2_id, v_g_donna,    2, 'Buat satu kalimat tanya memakai どんな untuk menanyakan jenis atau sifat sesuatu.', 1);

  -- ===== Penomoran ulang supaya tugas jatuh di urutan 5 dan 7 =====

  SELECT COUNT(*) INTO v_other_count
    FROM lessons
   WHERE module_id = v_module_id AND id <> v_lesson1_id AND id <> v_lesson2_id;

  IF v_other_count < 5 THEN
    RAISE NOTICE '094: modul "%" cuma punya % lesson lain (< 5) — urutan 5 dan 7 tidak bisa dibentuk, kedua tugas ditaruh di akhir modul. Geser manual lewat admin kalau perlu.',
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
    RAISE EXCEPTION '094: tiap tugas harus punya tepat 2 pola (dapat % dan %)',
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson1_id),
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson2_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM lesson_grammar_task_items
     WHERE lesson_id IN (v_lesson1_id, v_lesson2_id)
       AND (instruction IS NULL OR required_count <> 1)
  ) THEN
    RAISE EXCEPTION '094: ada wiring tanpa instruction atau required_count bukan 1';
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
      RAISE EXCEPTION '094: posisi final tugas bukan 5 dan 7 (dapat % dan %)', v_pos1, v_pos2;
    END IF;

    IF EXISTS (
      SELECT sort_order FROM lessons WHERE module_id = v_module_id
       GROUP BY sort_order HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION '094: ada sort_order kembar di modul setelah penomoran ulang';
    END IF;

    RAISE NOTICE '094: selesai — Tugas Suka & Mahir di urutan %, Tugas Kemampuan & Bertanya Jenis di urutan % (4 kalimat wajib total).', v_pos1, v_pos2;
  ELSE
    RAISE NOTICE '094: selesai — 2 tugas ter-wire (4 kalimat wajib total), posisi menyusul diatur manual.';
  END IF;
END $$;
