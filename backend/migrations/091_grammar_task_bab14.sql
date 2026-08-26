-- 091_grammar_task_bab14.sql — Dua Tugas Bunpou Bab 14: Bentuk Nai &
-- Kewajiban, Bentuk Plain.
--
-- Melanjutkan pola tugas bunpou Bab 3-13 (043/046/048/052/054/056/058/060/
-- 062/065/090). Mengisi slot sort_order 5 dan 7 yang sengaja disisakan
-- kosong oleh 083_bunpou_bab14.sql (materi Tata Bahasa Bab 14 di sort_order
-- 4 dan 6) — lihat file itu untuk konteks lengkap kurikulum Bab 14.
--
-- 7 pola grammar Bab 14, dibagi 4+3 (SAMA PERSIS split pelajaran Tata
-- Bahasa di 083):
--   Tugas 1 — Bentuk Nai & Kewajiban (urutan 5, 4 pola): konjugasi ない,
--     〜ないでください (larangan halus), 〜なければなりません (kewajiban),
--     〜なくてもいいです (tidak wajib).
--   Tugas 2 — Bentuk Plain (urutan 7, 3 pola): bentuk kamus, bentuk lampau
--     plain 〜た, lampau negatif plain 〜なかった.
-- required_count = 1 per pola, konsisten dengan tugas bunpou Bab 3-13.
--
-- Bank module_grammar FIND-OR-CREATE per pola dengan pattern string PERSIS
-- SAMA dengan 083_bunpou_bab14.sql (find akan selalu hit karena 083 sudah
-- membuat baris ini; INSERT fallback isinya disalin identik dari 083 kalau
-- baris itu ternyata sudah terhapus).
--
-- POSISI: pola penomoran ulang berbasis ROW_NUMBER (bukan sort_order
-- literal) yang sama seperti 090, aman dijalankan apa pun kondisi sort_order
-- modul saat ini:
--     lesson lama ke-1..4  → sort_order 1..4
--     Tugas 1 (Bentuk Nai & Kewajiban) → sort_order 5
--     lesson lama ke-5     → sort_order 6
--     Tugas 2 (Bentuk Plain) → sort_order 7
--     lesson lama ke-6..n  → sort_order 8..n+2
-- Fallback aman: kalau modul Bab 14 punya < 5 lesson lain, penomoran
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
  v_bab_no      INT  := 14;
  v_title_re    TEXT := '(bentuk|verb|kewajiban)';
  v_slug1       TEXT := 'tugas-bunpou-bab-14-bentuk-nai-kewajiban';
  v_slug2       TEXT := 'tugas-bunpou-bab-14-bentuk-plain';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson1_id   UUID;
  v_lesson2_id   UUID;
  v_other_count  INT;
  v_pos1         INT;
  v_pos2         INT;
  v_g_nai      UUID; -- Nai-form (konjugasi)
  v_g_naide    UUID; -- 〜ないでください
  v_g_nakereba UUID; -- 〜なければなりません
  v_g_nakutemo UUID; -- 〜なくてもいいです
  v_g_jisho    UUID; -- [V-jisho] (Bentuk Kamus)
  v_g_ta       UUID; -- [V-ta] (Lampau Plain)
  v_g_nakatta  UUID; -- [V-nakatta]
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET (v_bab_no - 1) LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '091: modul Bab % di kursus % tidak ditemukan — skip seed tugas bunpou.', v_bab_no, v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* v_title_re THEN
    RAISE NOTICE '091: modul Bab % terbaca "%" — kalau ternyata bukan bab yang dimaksud, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).',
      v_bab_no, v_module_title;
  END IF;

  RAISE NOTICE '091: seed 2 Tugas Bunpou Bab % ke modul "%".', v_bab_no, v_module_title;

  -- ===== Bank module_grammar: find-or-create per pola (persis 083) =====

  SELECT id INTO v_g_nai FROM module_grammar
   WHERE module_id = v_module_id AND pattern = 'Nai-form (konjugasi)';
  IF v_g_nai IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, 'Nai-form (konjugasi)', 'konjugasi bentuk negatif plain 〜ない', 'のむ→のまない、たべる→たべない',
      'Golongan 1: ganti bunyi -u terakhir jadi -a lalu tambah ない (のむ→のまない、かく→かかない); kata kerja berakhiran う jadi わ (かう→かわない). Golongan 2: buang る tambah ない (たべる→たべない). Tidak beraturan: する→しない、くる→こない. Kekecualian penting: ある→ない.'
    ) RETURNING id INTO v_g_nai;
  END IF;

  SELECT id INTO v_g_naide FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜ないでください';
  IF v_g_naide IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜ないでください', 'tolong jangan ~', 'ここに はいらないでください。',
      'Bentuk ない (tanpa い) + でください = larangan yang sopan. Lebih lembut daripada 〜てはいけません (Bab 13) yang menyatakan aturan. Sering dipakai di pengumuman dan permintaan pribadi.'
    ) RETURNING id INTO v_g_naide;
  END IF;

  SELECT id INTO v_g_nakereba FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜なければなりません';
  IF v_g_nakereba IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜なければなりません', 'harus ~ (kewajiban)', 'あした はやく おきなければなりません。',
      'Bentuk ない → buang い, tambah ければなりません. Menyatakan kewajiban yang datang dari aturan atau keadaan, bukan dari keinginan sendiri. Bentuk pendek yang lazim di percakapan sehari-hari: 〜なきゃ／〜ないと.'
    ) RETURNING id INTO v_g_nakereba;
  END IF;

  SELECT id INTO v_g_nakutemo FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜なくてもいいです';
  IF v_g_nakutemo IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜なくてもいいです', 'tidak perlu ~', 'あした こなくてもいいです。',
      'Kebalikan dari 〜なければなりません. Bentuk ない → buang い, tambah くてもいいです. Menyatakan sesuatu boleh TIDAK dilakukan alias tidak wajib.'
    ) RETURNING id INTO v_g_nakutemo;
  END IF;

  SELECT id INTO v_g_jisho FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '[V-jisho] (Bentuk Kamus)';
  IF v_g_jisho IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '[V-jisho] (Bentuk Kamus)', 'bentuk dasar kata kerja (plain, non-lampau)', 'たべます→たべる、いきます→いく',
      'Bentuk kamus adalah bentuk yang tertulis di kamus, dipakai dalam percakapan santai sekaligus jadi dasar banyak pola lanjutan (〜ことができる、〜まえに、〜つもり). Golongan 2: ます→る. Golongan 1: bunyi -i terakhir jadi -u (のみます→のむ).'
    ) RETURNING id INTO v_g_jisho;
  END IF;

  SELECT id INTO v_g_ta FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '[V-ta] (Lampau Plain)';
  IF v_g_ta IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '[V-ta] (Lampau Plain)', 'bentuk lampau plain (〜た)', 'たべました→たべた、いきました→いった',
      'Bentuk た dibuat persis seperti bentuk て, tinggal ganti て→た dan で→だ (のんで→のんだ、かいて→かいた、して→した、きて→きた). Dipakai untuk cerita santai dan jadi dasar pola 〜たことがあります (Bab 20) serta 〜たら.'
    ) RETURNING id INTO v_g_ta;
  END IF;

  SELECT id INTO v_g_nakatta FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '[V-nakatta]';
  IF v_g_nakatta IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '[V-nakatta]', 'lampau negatif plain', 'たべませんでした→たべなかった',
      'Dari bentuk ない: buang い, tambah かった (のまない→のまなかった). Persis seperti konjugasi kata sifat い — memang ない sendiri berperilaku sebagai kata sifat い.'
    ) RETURNING id INTO v_g_nakatta;
  END IF;

  IF v_g_nai IS NULL OR v_g_naide IS NULL OR v_g_nakereba IS NULL OR v_g_nakutemo IS NULL
     OR v_g_jisho IS NULL OR v_g_ta IS NULL OR v_g_nakatta IS NULL THEN
    RAISE EXCEPTION '091: gagal resolve salah satu dari 7 pola grammar Bab 14';
  END IF;

  -- ===== Dua lesson grammar_task (upsert) =====

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, cooldown_hours
  ) VALUES (
    v_module_id, v_slug1, 'Tugas Bunpou Bab 14 — Bentuk Nai & Kewajiban', 'grammar_task',
    'Buat kalimat pakai 4 pola Bab 14 (konjugasi ない, melarang dengan sopan lewat 〜ないでください, menyatakan kewajiban lewat 〜なければなりません, dan menyatakan tidak wajib lewat 〜なくてもいいです), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
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
    v_module_id, v_slug2, 'Tugas Bunpou Bab 14 — Bentuk Plain', 'grammar_task',
    'Buat kalimat pakai 3 pola Bab 14 (bentuk kamus, bentuk lampau plain 〜た, dan lampau negatif plain 〜なかった), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
    15, 101, 70, 12
  )
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title, type = EXCLUDED.type, content = EXCLUDED.content,
    duration_minutes = EXCLUDED.duration_minutes, updated_at = NOW()
  RETURNING id INTO v_lesson2_id;

  -- ===== Wiring pola ke tiap tugas =====

  DELETE FROM lesson_grammar_task_items WHERE lesson_id IN (v_lesson1_id, v_lesson2_id);

  INSERT INTO lesson_grammar_task_items (lesson_id, grammar_id, sort_order, instruction, required_count) VALUES
    (v_lesson1_id, v_g_nai,      1, 'Buat satu kalimat memakai kata kerja dalam bentuk ない (nai-form).', 1),
    (v_lesson1_id, v_g_naide,    2, 'Buat satu kalimat memakai pola 〜ないでください untuk melarang sesuatu dengan sopan.', 1),
    (v_lesson1_id, v_g_nakereba, 3, 'Buat satu kalimat memakai pola 〜なければなりません untuk menyatakan kewajiban (harus melakukan sesuatu).', 1),
    (v_lesson1_id, v_g_nakutemo, 4, 'Buat satu kalimat memakai pola 〜なくてもいいです untuk menyatakan sesuatu tidak perlu dilakukan.', 1),
    (v_lesson2_id, v_g_jisho,    1, 'Buat satu kalimat memakai kata kerja dalam bentuk kamus (plain, non-lampau).', 1),
    (v_lesson2_id, v_g_ta,       2, 'Buat satu kalimat memakai kata kerja dalam bentuk lampau plain 〜た.', 1),
    (v_lesson2_id, v_g_nakatta,  3, 'Buat satu kalimat memakai kata kerja dalam bentuk lampau negatif plain 〜なかった.', 1);

  -- ===== Penomoran ulang supaya tugas jatuh di urutan 5 dan 7 =====

  SELECT COUNT(*) INTO v_other_count
    FROM lessons
   WHERE module_id = v_module_id AND id <> v_lesson1_id AND id <> v_lesson2_id;

  IF v_other_count < 5 THEN
    RAISE NOTICE '091: modul "%" cuma punya % lesson lain (< 5) — urutan 5 dan 7 tidak bisa dibentuk, kedua tugas ditaruh di akhir modul. Geser manual lewat admin kalau perlu.',
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

  IF (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson1_id) <> 4
     OR (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson2_id) <> 3 THEN
    RAISE EXCEPTION '091: Tugas 1 harus punya tepat 4 pola dan Tugas 2 tepat 3 pola (dapat % dan %)',
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson1_id),
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson2_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM lesson_grammar_task_items
     WHERE lesson_id IN (v_lesson1_id, v_lesson2_id)
       AND (instruction IS NULL OR required_count <> 1)
  ) THEN
    RAISE EXCEPTION '091: ada wiring tanpa instruction atau required_count bukan 1';
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
      RAISE EXCEPTION '091: posisi final tugas bukan 5 dan 7 (dapat % dan %)', v_pos1, v_pos2;
    END IF;

    IF EXISTS (
      SELECT sort_order FROM lessons WHERE module_id = v_module_id
       GROUP BY sort_order HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION '091: ada sort_order kembar di modul setelah penomoran ulang';
    END IF;

    RAISE NOTICE '091: selesai — Tugas Bentuk Nai & Kewajiban di urutan %, Tugas Bentuk Plain di urutan % (7 kalimat wajib total).', v_pos1, v_pos2;
  ELSE
    RAISE NOTICE '091: selesai — 2 tugas ter-wire (7 kalimat wajib total), posisi menyusul diatur manual.';
  END IF;
END $$;
