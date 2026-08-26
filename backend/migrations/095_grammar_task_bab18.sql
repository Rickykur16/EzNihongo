-- 095_grammar_task_bab18.sql — Dua Tugas Bunpou Bab 18: Membandingkan Dua
-- Hal, Bertanya Perbandingan & Superlatif.
--
-- Melanjutkan pola tugas bunpou Bab 3-17 (043/046/048/052/054/056/058/060/
-- 062/065/090/091/092/093/094). Mengisi slot sort_order 5 dan 7 yang
-- sengaja disisakan kosong oleh 087_bunpou_bab18.sql (materi Tata Bahasa
-- Bab 18 di sort_order 4 dan 6) — lihat file itu untuk konteks lengkap
-- kurikulum Bab 18.
--
-- 4 pola grammar Bab 18, dibagi 2+2 (SAMA PERSIS split pelajaran Tata
-- Bahasa di 087):
--   Tugas 1 — Membandingkan Dua Hal (urutan 5, 2 pola): AはBより〜です
--     (menyorot A), AよりBのほうが〜 (menyorot B).
--   Tugas 2 — Bertanya Perbandingan & Superlatif (urutan 7, 2 pola):
--     AとBとどちらが〜 (bertanya pilihan dua hal), 〜の中で〜が一番〜
--     (superlatif dalam kelompok).
-- required_count = 1 per pola, konsisten dengan tugas bunpou Bab 3-17.
--
-- Bank module_grammar FIND-OR-CREATE per pola dengan pattern string PERSIS
-- SAMA dengan 087_bunpou_bab18.sql (find akan selalu hit karena 087 sudah
-- membuat baris ini; INSERT fallback isinya disalin identik dari 087 kalau
-- baris itu ternyata sudah terhapus).
--
-- POSISI: pola penomoran ulang berbasis ROW_NUMBER (bukan sort_order
-- literal) yang sama seperti 090-094, aman dijalankan apa pun kondisi
-- sort_order modul saat ini:
--     lesson lama ke-1..4  → sort_order 1..4
--     Tugas 1 (Membandingkan Dua Hal) → sort_order 5
--     lesson lama ke-5     → sort_order 6
--     Tugas 2 (Bertanya Perbandingan & Superlatif) → sort_order 7
--     lesson lama ke-6..n  → sort_order 8..n+2
-- Fallback aman: kalau modul Bab 18 punya < 5 lesson lain, penomoran
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
  v_bab_no      INT  := 18;
  v_title_re    TEXT := '(perbandingan|banding)';
  v_slug1       TEXT := 'tugas-bunpou-bab-18-membandingkan-dua-hal';
  v_slug2       TEXT := 'tugas-bunpou-bab-18-bertanya-perbandingan-superlatif';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson1_id   UUID;
  v_lesson2_id   UUID;
  v_other_count  INT;
  v_pos1         INT;
  v_pos2         INT;
  v_g_yori     UUID; -- AはBより〜です
  v_g_nohouga  UUID; -- AよりBのほうが〜
  v_g_dochira  UUID; -- AとBとどちらが〜
  v_g_ichiban  UUID; -- 〜の中で〜が一番〜
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET (v_bab_no - 1) LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '095: modul Bab % di kursus % tidak ditemukan — skip seed tugas bunpou.', v_bab_no, v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* v_title_re THEN
    RAISE NOTICE '095: modul Bab % terbaca "%" — kalau ternyata bukan bab yang dimaksud, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).',
      v_bab_no, v_module_title;
  END IF;

  RAISE NOTICE '095: seed 2 Tugas Bunpou Bab % ke modul "%".', v_bab_no, v_module_title;

  -- ===== Bank module_grammar: find-or-create per pola (persis 087) =====

  SELECT id INTO v_g_yori FROM module_grammar
   WHERE module_id = v_module_id AND pattern = 'AはBより〜です';
  IF v_g_yori IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, 'AはBより〜です', 'A lebih ~ daripada B', 'とうきょうは おおさかより 大きいです。',
      'より menempel di belakang pembanding (B). Urutannya: [A]は [B]より [sifat]です. Bagian [B]より boleh dipindah ke depan kalimat untuk penekanan, dan より sendiri tidak pernah diikuti です.'
    ) RETURNING id INTO v_g_yori;
  END IF;

  SELECT id INTO v_g_nohouga FROM module_grammar
   WHERE module_id = v_module_id AND pattern = 'AよりBのほうが〜';
  IF v_g_nohouga IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, 'AよりBのほうが〜', 'B lebih ~ daripada A', 'バスより 電車のほうが はやいです。',
      'Menyorot B sebagai yang unggul, jadi susunannya kebalikan dari pola sebelumnya: [A]より [B]のほうが [sifat]です. のほう secara harfiah berarti "pihak/sisi", jadi kalimatnya berbunyi "pihak B yang lebih ~".'
    ) RETURNING id INTO v_g_nohouga;
  END IF;

  SELECT id INTO v_g_dochira FROM module_grammar
   WHERE module_id = v_module_id AND pattern = 'AとBとどちらが〜';
  IF v_g_dochira IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, 'AとBとどちらが〜', 'mana yang lebih ~, A atau B?', 'コーヒーと おちゃと どちらが すきですか。',
      'Pertanyaan pilihan antara DUA hal; jawabannya memakai 〜のほうが〜です. Di percakapan santai どちら sering dipendekkan jadi どっち. Jangan pakai どれ — どれ untuk tiga pilihan atau lebih.'
    ) RETURNING id INTO v_g_dochira;
  END IF;

  SELECT id INTO v_g_ichiban FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜の中で〜が一番〜';
  IF v_g_ichiban IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜の中で〜が一番〜', 'paling ~ di antara ~', 'くだものの 中で りんごが いちばん すきです。',
      'Menyatakan yang PALING di dalam satu kelompok. Kalau kelompoknya berupa rentang waktu atau tempat, pakai 〜で saja tanpa 中 (一年で 八月が いちばん あついです). Kata tanya untuk kelompok: なにが／だれが／どこが いちばん〜.'
    ) RETURNING id INTO v_g_ichiban;
  END IF;

  IF v_g_yori IS NULL OR v_g_nohouga IS NULL OR v_g_dochira IS NULL OR v_g_ichiban IS NULL THEN
    RAISE EXCEPTION '095: gagal resolve salah satu dari 4 pola grammar Bab 18';
  END IF;

  -- ===== Dua lesson grammar_task (upsert) =====

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, cooldown_hours
  ) VALUES (
    v_module_id, v_slug1, 'Tugas Bunpou Bab 18: Membandingkan Dua Hal', 'grammar_task',
    'Buat kalimat pakai 2 pola Bab 18 (membandingkan dua hal dengan menyorot A lewat AはBより〜です, dan menyorot B lewat AよりBのほうが〜), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
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
    v_module_id, v_slug2, 'Tugas Bunpou Bab 18: Bertanya Perbandingan & Superlatif', 'grammar_task',
    'Buat kalimat pakai 2 pola Bab 18 (bertanya mana yang lebih unggul di antara dua hal dengan AとBとどちらが〜, dan menyatakan yang paling unggul di dalam satu kelompok dengan 〜の中で〜が一番〜), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
    15, 101, 70, 12
  )
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title, type = EXCLUDED.type, content = EXCLUDED.content,
    duration_minutes = EXCLUDED.duration_minutes, updated_at = NOW()
  RETURNING id INTO v_lesson2_id;

  -- ===== Wiring pola ke tiap tugas =====

  DELETE FROM lesson_grammar_task_items WHERE lesson_id IN (v_lesson1_id, v_lesson2_id);

  INSERT INTO lesson_grammar_task_items (lesson_id, grammar_id, sort_order, instruction, required_count) VALUES
    (v_lesson1_id, v_g_yori,    1, 'Buat satu kalimat memakai pola AはBより〜です untuk membandingkan dua hal, menyorot A.', 1),
    (v_lesson1_id, v_g_nohouga, 2, 'Buat satu kalimat memakai pola AよりBのほうが〜 untuk membandingkan dua hal, menyorot B.', 1),
    (v_lesson2_id, v_g_dochira, 1, 'Buat satu kalimat tanya memakai pola AとBとどちらが〜 untuk menanyakan mana yang lebih ~ di antara dua hal.', 1),
    (v_lesson2_id, v_g_ichiban, 2, 'Buat satu kalimat memakai pola 〜の中で〜が一番〜 untuk menyatakan yang paling ~ di antara sekelompok hal.', 1);

  -- ===== Penomoran ulang supaya tugas jatuh di urutan 5 dan 7 =====

  SELECT COUNT(*) INTO v_other_count
    FROM lessons
   WHERE module_id = v_module_id AND id <> v_lesson1_id AND id <> v_lesson2_id;

  IF v_other_count < 5 THEN
    RAISE NOTICE '095: modul "%" cuma punya % lesson lain (< 5) — urutan 5 dan 7 tidak bisa dibentuk, kedua tugas ditaruh di akhir modul. Geser manual lewat admin kalau perlu.',
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
    RAISE EXCEPTION '095: tiap tugas harus punya tepat 2 pola (dapat % dan %)',
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson1_id),
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson2_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM lesson_grammar_task_items
     WHERE lesson_id IN (v_lesson1_id, v_lesson2_id)
       AND (instruction IS NULL OR required_count <> 1)
  ) THEN
    RAISE EXCEPTION '095: ada wiring tanpa instruction atau required_count bukan 1';
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
      RAISE EXCEPTION '095: posisi final tugas bukan 5 dan 7 (dapat % dan %)', v_pos1, v_pos2;
    END IF;

    IF EXISTS (
      SELECT sort_order FROM lessons WHERE module_id = v_module_id
       GROUP BY sort_order HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION '095: ada sort_order kembar di modul setelah penomoran ulang';
    END IF;

    RAISE NOTICE '095: selesai — Tugas Membandingkan Dua Hal di urutan %, Tugas Bertanya Perbandingan & Superlatif di urutan % (4 kalimat wajib total).', v_pos1, v_pos2;
  ELSE
    RAISE NOTICE '095: selesai — 2 tugas ter-wire (4 kalimat wajib total), posisi menyusul diatur manual.';
  END IF;
END $$;
