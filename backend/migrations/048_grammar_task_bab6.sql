-- 048_grammar_task_bab6.sql — Dua Tugas Bunpou Bab 6: Bentuk Dasar dan Lanjutan.
--
-- Melanjutkan pola tugas bunpou Bab 3-5 (043/046). Konten dari Notion N5-B6
-- "Mendeskripsikan (い)"; modul di-resolve ordinal (OFFSET 5, lanjutan
-- OFFSET 0/1/2/3/4 di 039-047).
--
-- 6 pola grammar Bab 6 (GRM-26..30, GRM-224), dibagi ke DUA tugas per posisi
-- di sidebar yang diminta user (urutan 5 dan 7 — sama pola dua-lesson-materi
-- seperti Bab 5/046):
--   Tugas 1 — Bentuk Dasar (urutan 5): 〜は[い-adj]です / 〜は[い-adj]くないです
--     / [い-adj]+ noun — present tense afirmatif/negatif + modifikasi noun.
--   Tugas 2 — Lanjutan (urutan 7): とても／あまり / 〜はどうですか /
--     〜かったです／〜くなかったです — intensifier, tanya pendapat, bentuk
--     lampau. GRM-224 (lampau) SENGAJA dipisah dari present tense di Tugas 1
--     — catatan Notion-nya eksplisit: "Pasangan dengan POLA 01-04 BAB 6
--     (present tense)", jadi disatukan di Tugas 1 hanya akan membuat siswa
--     mengulang pola yang sama dua kali tanpa variasi baru.
-- required_count = 1 per pola, konsisten dengan tugas bunpou Bab 3-5.
--
-- POSISI (permintaan user: "buat tugas bunpou di urutan 5 dan 7"): pola
-- PENOMORAN ULANG deterministik yang sama seperti 046 (BUKAN geser-relatif
-- seperti 044) karena menyisip DUA lesson sekaligus — nomor urut saling
-- menggeser kalau dipakai pendekatan relatif satu-per-satu.
--     lesson lama ke-1..4  → sort_order 1..4
--     Tugas 1 (Bentuk Dasar)   → sort_order 5
--     lesson lama ke-5     → sort_order 6
--     Tugas 2 (Lanjutan)       → sort_order 7
--     lesson lama ke-6..n  → sort_order 8..n+2
-- Urutan relatif lesson lain tidak berubah, cuma nomornya dirapikan.
-- Idempoten karena targetnya nilai absolut, bukan increment.
--
-- Fallback aman: kalau modul Bab 6 punya < 5 lesson lain (struktur belum
-- sesuai asumsi), penomoran dilewati dan kedua tugas ditaruh di akhir modul
-- dengan NOTICE — bukan RAISE EXCEPTION yang menjatuhkan deploy.
--
-- Bank module_grammar tetap FIND-OR-CREATE per pola (bukan blind insert),
-- sama seperti 043/046 — tidak ada unique constraint di module_grammar
-- selain id, dan tidak diketahui apakah admin sudah authoring sebagian pola
-- Bab 6 lewat UI.
--
-- POPUP: lessons.popup_after_lesson_id sengaja tidak diisi — admin-editable
-- kapan saja lewat form tanpa perlu migrasi baru.
--
-- PERINGATAN RE-RUN: DELETE FROM lesson_grammar_task_items di bawah tanpa
-- syarat — kalau admin sudah menambah pola manual ke salah satu tugas ini,
-- re-run migrasi ini manual akan menghapus wiring itu (bank module_grammar
-- sendiri TIDAK terhapus). Runner (migrations/run.js) menjalankan file ini
-- SEKALI per DB (tercatat di schema_migrations).
--
-- Idempotent: lesson di-upsert per (module_id, slug), wiring lama dihapus
-- lalu di-insert ulang, bank find-or-create, penomoran deterministik;
-- no-op aman kalau modul target belum ada.

DO $$
DECLARE
  v_course_slug TEXT := 'n5';
  v_slug1       TEXT := 'tugas-bunpou-bab-6-bentuk-dasar';
  v_slug2       TEXT := 'tugas-bunpou-bab-6-lanjutan';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson1_id   UUID;
  v_lesson2_id   UUID;
  v_other_count  INT;
  v_pos1         INT;
  v_pos2         INT;
  v_g_afirmatif  UUID; -- 〜は[い-adj]です
  v_g_negatif    UUID; -- 〜は[い-adj]くないです
  v_g_modifikasi UUID; -- [い-adj]+ noun
  v_g_intensif   UUID; -- とても／あまり
  v_g_douka      UUID; -- 〜はどうですか
  v_g_lampau     UUID; -- 〜かったです／〜くなかったです
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 5 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '048: modul Bab 6 di kursus % tidak ditemukan — skip seed tugas bunpou.', v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* '(deskripsi|sifat|adjective|adjektiva)' THEN
    RAISE NOTICE '048: modul Bab 6 terbaca "%" — kalau ternyata bukan Bab Mendeskripsikan (い), pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).', v_module_title;
  END IF;

  RAISE NOTICE '048: seed 2 Tugas Bunpou Bab 6 ke modul "%".', v_module_title;

  -- ===== Bank module_grammar: find-or-create per pola =====

  SELECT id INTO v_g_afirmatif FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜は[い-adj]です';
  IF v_g_afirmatif IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜は[い-adj]です', 'subjek + kata sifat (bentuk kini, afirmatif)', 'この りょうりは おいしいです。',
      'Kata sifat い langsung diikuti です, tidak butuh だ seperti kata benda. こ の りょうりは おいしいです artinya masakan ini enak.'
    ) RETURNING id INTO v_g_afirmatif;
  END IF;

  SELECT id INTO v_g_negatif FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜は[い-adj]くないです';
  IF v_g_negatif IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜は[い-adj]くないです', 'bentuk negatif kata sifat い (bentuk kini)', 'たかくないです。',
      'Akhiran い diganti くない sebelum です: たかい → たかくないです (tidak mahal).'
    ) RETURNING id INTO v_g_negatif;
  END IF;

  SELECT id INTO v_g_modifikasi FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '[い-adj]+ 名詞';
  IF v_g_modifikasi IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '[い-adj]+ 名詞', 'kata sifat い menerangkan kata benda langsung', 'あたらしい みせ。',
      'Kata sifat い ditempel langsung di depan kata benda tanpa partikel: あたらしい みせ (toko baru).'
    ) RETURNING id INTO v_g_modifikasi;
  END IF;

  SELECT id INTO v_g_intensif FROM module_grammar
   WHERE module_id = v_module_id AND pattern = 'とても／あまり';
  IF v_g_intensif IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, 'とても／あまり', 'penguat: sangat / (tidak) terlalu', 'とても おいしいです。',
      'とても dipakai di kalimat afirmatif (sangat). あまり HANYA dipakai bersama bentuk negatif: あまり たかくないです (tidak terlalu mahal).'
    ) RETURNING id INTO v_g_intensif;
  END IF;

  SELECT id INTO v_g_douka FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜はどうですか';
  IF v_g_douka IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜はどうですか', 'menanyakan pendapat: bagaimana ~?', 'にほんは どうですか。',
      'Dipakai menanyakan kesan atau pendapat tentang sesuatu, dijawab dengan kata sifat.'
    ) RETURNING id INTO v_g_douka;
  END IF;

  SELECT id INTO v_g_lampau FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜かったです／〜くなかったです';
  IF v_g_lampau IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜かったです／〜くなかったです', 'bentuk lampau kata sifat い (afirmatif/negatif)', 'りょこうは たのしかったです。',
      'い → かった (afirmatif lampau) atau くなかった (negatif lampau), selalu dipasangkan dengan です. Pasangan bentuk kini dari Tugas Bentuk Dasar.'
    ) RETURNING id INTO v_g_lampau;
  END IF;

  IF v_g_afirmatif IS NULL OR v_g_negatif IS NULL OR v_g_modifikasi IS NULL
     OR v_g_intensif IS NULL OR v_g_douka IS NULL OR v_g_lampau IS NULL THEN
    RAISE EXCEPTION '048: gagal resolve salah satu dari 6 pola grammar Bab 6';
  END IF;

  -- ===== Dua lesson grammar_task (upsert) =====

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, cooldown_hours
  ) VALUES (
    v_module_id, v_slug1, 'Tugas Bunpou Bab 6 — Bentuk Dasar', 'grammar_task',
    'Buat kalimat pakai 3 pola bentuk dasar kata sifat い Bab 6 (afirmatif です, negatif くないです, dan menerangkan kata benda langsung), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
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
    v_module_id, v_slug2, 'Tugas Bunpou Bab 6 — Lanjutan', 'grammar_task',
    'Buat kalimat pakai 3 pola lanjutan Bab 6 (penguat とても／あまり, tanya pendapat 〜はどうですか, dan bentuk lampau kata sifat い), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
    15, 101, 70, 12
  )
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title, type = EXCLUDED.type, content = EXCLUDED.content,
    duration_minutes = EXCLUDED.duration_minutes, updated_at = NOW()
  RETURNING id INTO v_lesson2_id;

  -- ===== Wiring pola ke tiap tugas =====

  DELETE FROM lesson_grammar_task_items WHERE lesson_id IN (v_lesson1_id, v_lesson2_id);

  INSERT INTO lesson_grammar_task_items (lesson_id, grammar_id, sort_order, instruction, required_count) VALUES
    (v_lesson1_id, v_g_afirmatif,  1, 'Buat satu kalimat memakai kata sifat い bentuk kini afirmatif (〜は[い-adj]です), misalnya menceritakan sesuatu yang mahal, murah, baru, atau lama.', 1),
    (v_lesson1_id, v_g_negatif,    2, 'Buat satu kalimat memakai bentuk negatif kata sifat い (〜は[い-adj]くないです).', 1),
    (v_lesson1_id, v_g_modifikasi, 3, 'Buat satu kalimat yang memakai kata sifat い untuk menerangkan kata benda secara langsung (contoh: あたらしい ほん).', 1),
    (v_lesson2_id, v_g_intensif,   1, 'Buat satu kalimat memakai とても atau あまり (ingat: あまり cuma dipakai bersama bentuk negatif).', 1),
    (v_lesson2_id, v_g_douka,      2, 'Buat satu kalimat tanya yang memakai 〜はどうですか untuk menanyakan pendapat tentang sesuatu.', 1),
    (v_lesson2_id, v_g_lampau,     3, 'Buat satu kalimat memakai bentuk lampau kata sifat い (〜かったです atau 〜くなかったです).', 1);

  -- ===== Penomoran ulang supaya tugas jatuh di urutan 5 dan 7 =====

  SELECT COUNT(*) INTO v_other_count
    FROM lessons
   WHERE module_id = v_module_id AND id <> v_lesson1_id AND id <> v_lesson2_id;

  IF v_other_count < 5 THEN
    RAISE NOTICE '048: modul "%" cuma punya % lesson lain (< 5) — urutan 5 dan 7 tidak bisa dibentuk, kedua tugas ditaruh di akhir modul. Geser manual lewat admin kalau perlu.',
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
    RAISE EXCEPTION '048: tiap tugas harus punya tepat 3 pola (dapat % dan %)',
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson1_id),
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson2_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM lesson_grammar_task_items
     WHERE lesson_id IN (v_lesson1_id, v_lesson2_id)
       AND (instruction IS NULL OR required_count <> 1)
  ) THEN
    RAISE EXCEPTION '048: ada wiring tanpa instruction atau required_count bukan 1';
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
      RAISE EXCEPTION '048: posisi final tugas bukan 5 dan 7 (dapat % dan %)', v_pos1, v_pos2;
    END IF;

    IF EXISTS (
      SELECT sort_order FROM lessons WHERE module_id = v_module_id
       GROUP BY sort_order HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION '048: ada sort_order kembar di modul setelah penomoran ulang';
    END IF;

    RAISE NOTICE '048: selesai — Tugas Bentuk Dasar di urutan %, Tugas Lanjutan di urutan % (6 kalimat wajib total).', v_pos1, v_pos2;
  ELSE
    RAISE NOTICE '048: selesai — 2 tugas ter-wire (6 kalimat wajib total), posisi menyusul diatur manual.';
  END IF;
END $$;
