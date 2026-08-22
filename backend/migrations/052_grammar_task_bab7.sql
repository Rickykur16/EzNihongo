-- 052_grammar_task_bab7.sql — Dua Tugas Bunpou Bab 7: Bentuk Dasar dan Lanjutan.
--
-- Melanjutkan pola tugas bunpou Bab 3-6 (043/046/048). Konten dari Notion
-- N5-B7 "Mendeskripsikan (な)"; modul di-resolve ordinal (OFFSET 6,
-- lanjutan OFFSET 0-5 di 039-048/051).
--
-- 6 pola grammar Bab 7 (Notion Grammar DB, filter Lesson=Bab7), dibagi ke
-- DUA tugas di posisi sidebar yang SAMA seperti Bab 6 (urutan 5 dan 7 —
-- permintaan eksplisit user: "no urut jg sama utuk tugas grammar"):
--   Tugas 1 — Bentuk Dasar (urutan 5): 〜は[な-adj]です /
--     [な-adj]じゃありません / [な-adj]+な+名詞 — afirmatif/negatif bentuk
--     kini + modifikasi kata benda (wajib pakai な, beda dari kata sifat い
--     yang langsung menempel).
--   Tugas 2 — Lanjutan (urutan 7): 〜くて／〜で (penghubung sepolaritas) /
--     〜でした／〜じゃありませんでした (lampau) / 〜が好き (pengenalan
--     singkat konstruksi な-adj + が, sesuai catatan Notion "TEASER ONLY —
--     variasi lengkap 嫌い/上手/下手 didalami di Bab 17, jangan ajarkan
--     semua varian di sini").
-- required_count = 1 per pola, konsisten dengan tugas bunpou Bab 3-6.
--
-- CATATAN pola 6 (好き): satu-satunya pola di sini yang memakai partikel
-- が — beda dari pola 1-5 yang semuanya は/の. Ini instructional content
-- (grammar_task, dinilai AI via prompt admin-editable), BUKAN quiz_questions
-- ber-assertion-SQL seperti assignment — jadi tidak ada pagar partikel di
-- level migrasi ini (pola sama dengan 043/046/048, yang juga tidak
-- membatasi partikel di module_grammar/lesson content). Kalau nanti dibuat
-- assignment kuis Bab 7, keputusan soal が boleh dipakai atau tidak harus
-- diambil eksplisit saat itu (belum diputuskan di migrasi ini).
--
-- POSISI (permintaan user, sama seperti 048): pola PENOMORAN ULANG
-- deterministik (BUKAN geser-relatif) karena menyisip DUA lesson sekaligus.
--     lesson lama ke-1..4  → sort_order 1..4
--     Tugas 1 (Bentuk Dasar)   → sort_order 5
--     lesson lama ke-5     → sort_order 6
--     Tugas 2 (Lanjutan)       → sort_order 7
--     lesson lama ke-6..n  → sort_order 8..n+2
-- Fallback aman: kalau modul Bab 7 punya < 5 lesson lain, penomoran
-- dilewati dan kedua tugas ditaruh di akhir modul dengan NOTICE.
--
-- Bank module_grammar tetap FIND-OR-CREATE per pola (bukan blind insert),
-- sama seperti 043/046/048.
--
-- POPUP: lessons.popup_after_lesson_id sengaja tidak diisi — admin-editable
-- kapan saja lewat form tanpa perlu migrasi baru.
--
-- PERINGATAN RE-RUN: DELETE FROM lesson_grammar_task_items di bawah tanpa
-- syarat — kalau admin sudah menambah pola manual, re-run migrasi ini
-- manual akan menghapus wiring itu (bank module_grammar sendiri TIDAK
-- terhapus). Runner (migrations/run.js) menjalankan file ini SEKALI per DB.
--
-- Idempotent: lesson di-upsert per (module_id, slug), wiring lama dihapus
-- lalu di-insert ulang, bank find-or-create, penomoran deterministik;
-- no-op aman kalau modul target belum ada.

DO $$
DECLARE
  v_course_slug TEXT := 'n5';
  v_slug1       TEXT := 'tugas-bunpou-bab-7-bentuk-dasar';
  v_slug2       TEXT := 'tugas-bunpou-bab-7-lanjutan';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson1_id   UUID;
  v_lesson2_id   UUID;
  v_other_count  INT;
  v_pos1         INT;
  v_pos2         INT;
  v_g_afirmatif  UUID; -- 〜は[な-adj]です
  v_g_negatif    UUID; -- [な-adj]じゃありません
  v_g_modifikasi UUID; -- [な-adj]+な+名詞
  v_g_penghubung UUID; -- 〜くて／〜で
  v_g_lampau     UUID; -- 〜でした／〜じゃありませんでした
  v_g_suki       UUID; -- 〜が好き
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 6 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '052: modul Bab 7 di kursus % tidak ditemukan — skip seed tugas bunpou.', v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* '(deskripsi|sifat|adjective|adjektiva)' THEN
    RAISE NOTICE '052: modul Bab 7 terbaca "%" — kalau ternyata bukan Bab Mendeskripsikan (な), pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).', v_module_title;
  END IF;

  RAISE NOTICE '052: seed 2 Tugas Bunpou Bab 7 ke modul "%".', v_module_title;

  -- ===== Bank module_grammar: find-or-create per pola =====

  SELECT id INTO v_g_afirmatif FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜は[な-adj]です';
  IF v_g_afirmatif IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜は[な-adj]です', 'subjek + kata sifat な (bentuk kini, afirmatif)', 'この へやは しずかです。',
      'Kata sifat な kehilangan な sebelum です — beda dari saat menerangkan kata benda langsung (perlu な). しずか + です = しずかです (bukan しずかなです).'
    ) RETURNING id INTO v_g_afirmatif;
  END IF;

  SELECT id INTO v_g_negatif FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '[な-adj]じゃありません';
  IF v_g_negatif IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '[な-adj]じゃありません', 'bentuk negatif kata sifat な (bentuk kini)', 'この みちは べんりじゃありません。',
      'Kata sifat な + じゃありません (kasual, paling umum dipakai sehari-hari). Variasi formal ではありません juga benar tapi jarang dipakai percakapan santai.'
    ) RETURNING id INTO v_g_negatif;
  END IF;

  SELECT id INTO v_g_modifikasi FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '[な-adj]+な+名詞';
  IF v_g_modifikasi IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '[な-adj]+な+名詞', 'kata sifat な menerangkan kata benda (wajib pakai な)', 'しずかな へやです。',
      'Beda dari kata sifat い yang langsung menempel ke kata benda, kata sifat な WAJIB disisipi な sebelum kata benda: しずか + な + へや = しずかな へや (bukan しずか へや).'
    ) RETURNING id INTO v_g_modifikasi;
  END IF;

  SELECT id INTO v_g_penghubung FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜くて／〜で';
  IF v_g_penghubung IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜くて／〜で', 'penghubung kata sifat (dan)', 'この へやは しずかで おおきいです。',
      'Menyambung dua kata sifat yang sepolaritas (sama-sama positif atau sama-sama negatif). Kata sifat い berubah jadi くて (たのしい→たのしくて), kata sifat な/kata benda tambah で (しずか→しずかで).'
    ) RETURNING id INTO v_g_penghubung;
  END IF;

  SELECT id INTO v_g_lampau FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜でした／〜じゃありませんでした';
  IF v_g_lampau IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜でした／〜じゃありませんでした', 'bentuk lampau kata sifat な (afirmatif/negatif)', 'きょねんは げんきでした。',
      'Kata sifat な + でした (lampau afirmatif) atau + じゃありませんでした (lampau negatif) — polanya sama persis dengan kata benda (です→でした), beda dari kata sifat い yang punya konjugasi sendiri (かった／くなかった).'
    ) RETURNING id INTO v_g_lampau;
  END IF;

  SELECT id INTO v_g_suki FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜が好き／嫌い／上手／下手';
  IF v_g_suki IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜が好き／嫌い／上手／下手', 'konstruksi な-adj khusus dengan partikel が (suka/benci/mahir/tidak mahir)', 'すしが すきです。',
      'PENGENALAN SINGKAT: partikel が menandai objek yang disukai/dibenci/dikuasai, beda dari partikel は yang menandai topik. Variasi lengkap (嫌い／上手／下手／できる) baru didalami di Bab 17 (Suka & Mahir) — di sini cukup kenalkan pola dasarnya lewat 好き.'
    ) RETURNING id INTO v_g_suki;
  END IF;

  IF v_g_afirmatif IS NULL OR v_g_negatif IS NULL OR v_g_modifikasi IS NULL
     OR v_g_penghubung IS NULL OR v_g_lampau IS NULL OR v_g_suki IS NULL THEN
    RAISE EXCEPTION '052: gagal resolve salah satu dari 6 pola grammar Bab 7';
  END IF;

  -- ===== Dua lesson grammar_task (upsert) =====

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, cooldown_hours
  ) VALUES (
    v_module_id, v_slug1, 'Tugas Bunpou Bab 7 — Bentuk Dasar', 'grammar_task',
    'Buat kalimat pakai 3 pola bentuk dasar kata sifat な Bab 7 (afirmatif です, negatif じゃありません, dan menerangkan kata benda dengan な), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
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
    v_module_id, v_slug2, 'Tugas Bunpou Bab 7 — Lanjutan', 'grammar_task',
    'Buat kalimat pakai 3 pola lanjutan Bab 7 (penghubung くて／で, bentuk lampau でした／じゃありませんでした, dan pengenalan singkat 〜が好きです), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
    15, 101, 70, 12
  )
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title, type = EXCLUDED.type, content = EXCLUDED.content,
    duration_minutes = EXCLUDED.duration_minutes, updated_at = NOW()
  RETURNING id INTO v_lesson2_id;

  -- ===== Wiring pola ke tiap tugas =====

  DELETE FROM lesson_grammar_task_items WHERE lesson_id IN (v_lesson1_id, v_lesson2_id);

  INSERT INTO lesson_grammar_task_items (lesson_id, grammar_id, sort_order, instruction, required_count) VALUES
    (v_lesson1_id, v_g_afirmatif,  1, 'Buat satu kalimat memakai kata sifat な bentuk kini afirmatif (〜は[な-adj]です) — ingat な hilang sebelum です, misalnya menceritakan suasana tempat yang tenang, ramai, atau bersemangat.', 1),
    (v_lesson1_id, v_g_negatif,    2, 'Buat satu kalimat memakai bentuk negatif kata sifat な ([な-adj]じゃありません).', 1),
    (v_lesson1_id, v_g_modifikasi, 3, 'Buat satu kalimat yang memakai kata sifat な untuk menerangkan kata benda — ingat WAJIB pakai な sebelum kata bendanya (contoh: しずかな へや).', 1),
    (v_lesson2_id, v_g_penghubung, 1, 'Buat satu kalimat yang menyambung dua kata sifat sepolaritas memakai くて atau で.', 1),
    (v_lesson2_id, v_g_lampau,     2, 'Buat satu kalimat memakai bentuk lampau kata sifat な (でした atau じゃありませんでした).', 1),
    (v_lesson2_id, v_g_suki,       3, 'Buat satu kalimat sederhana memakai pola 〜が好きです untuk menyatakan sesuatu yang kamu suka.', 1);

  -- ===== Penomoran ulang supaya tugas jatuh di urutan 5 dan 7 =====

  SELECT COUNT(*) INTO v_other_count
    FROM lessons
   WHERE module_id = v_module_id AND id <> v_lesson1_id AND id <> v_lesson2_id;

  IF v_other_count < 5 THEN
    RAISE NOTICE '052: modul "%" cuma punya % lesson lain (< 5) — urutan 5 dan 7 tidak bisa dibentuk, kedua tugas ditaruh di akhir modul. Geser manual lewat admin kalau perlu.',
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
     OR (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson2_id) <> 3 THEN
    RAISE EXCEPTION '052: tiap tugas harus punya tepat 3 pola (dapat % dan %)',
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson1_id),
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson2_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM lesson_grammar_task_items
     WHERE lesson_id IN (v_lesson1_id, v_lesson2_id)
       AND (instruction IS NULL OR required_count <> 1)
  ) THEN
    RAISE EXCEPTION '052: ada wiring tanpa instruction atau required_count bukan 1';
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
      RAISE EXCEPTION '052: posisi final tugas bukan 5 dan 7 (dapat % dan %)', v_pos1, v_pos2;
    END IF;

    IF EXISTS (
      SELECT sort_order FROM lessons WHERE module_id = v_module_id
       GROUP BY sort_order HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION '052: ada sort_order kembar di modul setelah penomoran ulang';
    END IF;

    RAISE NOTICE '052: selesai — Tugas Bentuk Dasar di urutan %, Tugas Lanjutan di urutan % (6 kalimat wajib total).', v_pos1, v_pos2;
  ELSE
    RAISE NOTICE '052: selesai — 2 tugas ter-wire (6 kalimat wajib total), posisi menyusul diatur manual.';
  END IF;
END $$;
