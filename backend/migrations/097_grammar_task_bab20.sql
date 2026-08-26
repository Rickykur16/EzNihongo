-- 097_grammar_task_bab20.sql — Dua Tugas Bunpou Bab 20: Pengalaman,
-- Penghubung Kalimat.
--
-- Melanjutkan pola tugas bunpou Bab 3-19 (043/046/048/052/054/056/058/060/
-- 062/065/090-096). Mengisi slot sort_order 5 dan 7 yang sengaja disisakan
-- kosong oleh 089_bunpou_bab20.sql (materi Tata Bahasa Bab 20 di sort_order
-- 4 dan 6) — lihat file itu untuk konteks lengkap kurikulum Bab 20. Ini
-- adalah migrasi TERAKHIR dalam seri Tugas Bunpou Bab 3-20.
--
-- 5 pola grammar Bab 20, dibagi 2+3 (SAMA PERSIS split pelajaran Tata
-- Bahasa di 089):
--   Tugas 1 — Pengalaman (urutan 5, 2 pola): 〜たことがあります (pernah),
--     〜たことがありません (belum pernah).
--   Tugas 2 — Penghubung Kalimat (urutan 7, 3 pola): 〜から (sebab),
--     〜が、〜 (pertentangan), そして／それから／でも (penghubung antar
--     kalimat).
-- required_count = 1 per pola, konsisten dengan tugas bunpou Bab 3-19.
--
-- Bank module_grammar FIND-OR-CREATE per pola dengan pattern string PERSIS
-- SAMA dengan 089_bunpou_bab20.sql (find akan selalu hit karena 089 sudah
-- membuat baris ini; INSERT fallback isinya disalin identik dari 089 kalau
-- baris itu ternyata sudah terhapus).
--
-- POSISI: pola penomoran ulang berbasis ROW_NUMBER (bukan sort_order
-- literal) yang sama seperti 090-096, aman dijalankan apa pun kondisi
-- sort_order modul saat ini:
--     lesson lama ke-1..4  → sort_order 1..4
--     Tugas 1 (Pengalaman) → sort_order 5
--     lesson lama ke-5     → sort_order 6
--     Tugas 2 (Penghubung Kalimat) → sort_order 7
--     lesson lama ke-6..n  → sort_order 8..n+2
-- Fallback aman: kalau modul Bab 20 punya < 5 lesson lain, penomoran
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
  v_bab_no      INT  := 20;
  v_title_re    TEXT := '(pengalaman|penghubung)';
  v_slug1       TEXT := 'tugas-bunpou-bab-20-pengalaman';
  v_slug2       TEXT := 'tugas-bunpou-bab-20-penghubung-kalimat';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson1_id   UUID;
  v_lesson2_id   UUID;
  v_other_count  INT;
  v_pos1         INT;
  v_pos2         INT;
  v_g_koto      UUID; -- 〜たことがあります
  v_g_kotonai   UUID; -- 〜たことがありません
  v_g_kara      UUID; -- 〜から (sebab)
  v_g_ga        UUID; -- 〜が、〜
  v_g_soshite   UUID; -- そして／それから／でも
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET (v_bab_no - 1) LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '097: modul Bab % di kursus % tidak ditemukan — skip seed tugas bunpou.', v_bab_no, v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* v_title_re THEN
    RAISE NOTICE '097: modul Bab % terbaca "%" — kalau ternyata bukan bab yang dimaksud, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).',
      v_bab_no, v_module_title;
  END IF;

  RAISE NOTICE '097: seed 2 Tugas Bunpou Bab % ke modul "%".', v_bab_no, v_module_title;

  -- ===== Bank module_grammar: find-or-create per pola (persis 089) =====

  SELECT id INTO v_g_koto FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜たことがあります';
  IF v_g_koto IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜たことがあります', 'pernah ~ (pengalaman)', '日本へ 行ったことが あります。',
      'Bentuk た + ことが あります menyatakan pengalaman yang PERNAH dialami, bukan kejadian baru-baru ini. Tidak dipakai untuk kejadian kemarin — untuk itu pakai bentuk lampau biasa.'
    ) RETURNING id INTO v_g_koto;
  END IF;

  SELECT id INTO v_g_kotonai FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜たことがありません';
  IF v_g_kotonai IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜たことがありません', 'belum pernah ~', 'ゆきを 見たことが ありません。',
      'Bentuk negatif dari pola sebelumnya: belum pernah mengalami sama sekali. Sering diperkuat dengan いちども (sekali pun tidak): いちども 見たことが ありません.'
    ) RETURNING id INTO v_g_kotonai;
  END IF;

  SELECT id INTO v_g_kara FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜から (sebab)';
  IF v_g_kara IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜から (sebab)', 'karena ~', '雨が ふるから、行きません。',
      'から menempel di BELAKANG alasan: [alasan]から、[akibat]. Bisa dipasang setelah bentuk sopan maupun bentuk plain. Jangan tertukar dengan から yang berarti "dari" (Bab 9) — yang itu menempel pada kata benda.'
    ) RETURNING id INTO v_g_kara;
  END IF;

  SELECT id INTO v_g_ga FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜が、〜';
  IF v_g_ga IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜が、〜', 'tetapi ~', '日本語は むずかしいですが、おもしろいです。',
      'が menyambung dua kalimat yang BERLAWANAN dan diletakkan di akhir kalimat pertama, bukan di awal kalimat kedua seperti でも. Nadanya lebih formal daripada けど. Kadang が juga cuma jadi pengantar sopan tanpa arti "tetapi".'
    ) RETURNING id INTO v_g_ga;
  END IF;

  SELECT id INTO v_g_soshite FROM module_grammar
   WHERE module_id = v_module_id AND pattern = 'そして／それから／でも';
  IF v_g_soshite IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, 'そして／それから／でも', 'penghubung antar kalimat', 'きのう 本を 読みました。それから、ねました。',
      'そして menambahkan (dan / lalu), それから menyatakan urutan berikutnya (setelah itu), dan でも menyatakan pertentangan (tetapi). Ketiganya berdiri di AWAL kalimat baru — berbeda dari が yang menempel di akhir kalimat sebelumnya.'
    ) RETURNING id INTO v_g_soshite;
  END IF;

  IF v_g_koto IS NULL OR v_g_kotonai IS NULL OR v_g_kara IS NULL OR v_g_ga IS NULL OR v_g_soshite IS NULL THEN
    RAISE EXCEPTION '097: gagal resolve salah satu dari 5 pola grammar Bab 20';
  END IF;

  -- ===== Dua lesson grammar_task (upsert) =====

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, cooldown_hours
  ) VALUES (
    v_module_id, v_slug1, 'Tugas Bunpou Bab 20 — Pengalaman', 'grammar_task',
    'Buat kalimat pakai 2 pola Bab 20 (menceritakan pengalaman yang pernah dialami dengan 〜たことがあります, dan menyatakan belum pernah mengalami sesuatu dengan 〜たことがありません), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
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
    v_module_id, v_slug2, 'Tugas Bunpou Bab 20 — Penghubung Kalimat', 'grammar_task',
    'Buat kalimat pakai 3 pola Bab 20 (menyatakan sebab dengan 〜から, mempertentangkan dua hal dengan 〜が、〜, dan menyambung antar kalimat dengan そして／それから／でも), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
    15, 101, 70, 12
  )
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title, type = EXCLUDED.type, content = EXCLUDED.content,
    duration_minutes = EXCLUDED.duration_minutes, updated_at = NOW()
  RETURNING id INTO v_lesson2_id;

  -- ===== Wiring pola ke tiap tugas =====

  DELETE FROM lesson_grammar_task_items WHERE lesson_id IN (v_lesson1_id, v_lesson2_id);

  INSERT INTO lesson_grammar_task_items (lesson_id, grammar_id, sort_order, instruction, required_count) VALUES
    (v_lesson1_id, v_g_koto,     1, 'Buat satu kalimat memakai pola 〜たことがあります untuk menceritakan pengalaman yang pernah dialami.', 1),
    (v_lesson1_id, v_g_kotonai,  2, 'Buat satu kalimat memakai pola 〜たことがありません untuk menyatakan belum pernah mengalami sesuatu.', 1),
    (v_lesson2_id, v_g_kara,     1, 'Buat satu kalimat memakai pola 〜から untuk menyatakan sebab atau alasan.', 1),
    (v_lesson2_id, v_g_ga,       2, 'Buat satu kalimat memakai pola 〜が、〜 untuk mempertentangkan dua hal dalam satu kalimat.', 1),
    (v_lesson2_id, v_g_soshite,  3, 'Buat satu kalimat memakai salah satu penghubung そして, それから, atau でも untuk menyambung dua kalimat.', 1);

  -- ===== Penomoran ulang supaya tugas jatuh di urutan 5 dan 7 =====

  SELECT COUNT(*) INTO v_other_count
    FROM lessons
   WHERE module_id = v_module_id AND id <> v_lesson1_id AND id <> v_lesson2_id;

  IF v_other_count < 5 THEN
    RAISE NOTICE '097: modul "%" cuma punya % lesson lain (< 5) — urutan 5 dan 7 tidak bisa dibentuk, kedua tugas ditaruh di akhir modul. Geser manual lewat admin kalau perlu.',
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
     OR (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson2_id) <> 3 THEN
    RAISE EXCEPTION '097: Tugas 1 harus punya tepat 2 pola dan Tugas 2 tepat 3 pola (dapat % dan %)',
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson1_id),
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson2_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM lesson_grammar_task_items
     WHERE lesson_id IN (v_lesson1_id, v_lesson2_id)
       AND (instruction IS NULL OR required_count <> 1)
  ) THEN
    RAISE EXCEPTION '097: ada wiring tanpa instruction atau required_count bukan 1';
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
      RAISE EXCEPTION '097: posisi final tugas bukan 5 dan 7 (dapat % dan %)', v_pos1, v_pos2;
    END IF;

    IF EXISTS (
      SELECT sort_order FROM lessons WHERE module_id = v_module_id
       GROUP BY sort_order HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION '097: ada sort_order kembar di modul setelah penomoran ulang';
    END IF;

    RAISE NOTICE '097: selesai — Tugas Pengalaman di urutan %, Tugas Penghubung Kalimat di urutan % (5 kalimat wajib total).', v_pos1, v_pos2;
  ELSE
    RAISE NOTICE '097: selesai — 2 tugas ter-wire (5 kalimat wajib total), posisi menyusul diatur manual.';
  END IF;
END $$;
