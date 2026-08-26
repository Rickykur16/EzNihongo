-- 093_grammar_task_bab16.sql — Dua Tugas Bunpou Bab 16: Partikel Waktu &
-- Tanggal, Frekuensi & Bertanya Waktu.
--
-- Melanjutkan pola tugas bunpou Bab 3-15 (043/046/048/052/054/056/058/060/
-- 062/065/090/091/092). Mengisi slot sort_order 5 dan 7 yang sengaja
-- disisakan kosong oleh 085_bunpou_bab16.sql (materi Tata Bahasa Bab 16 di
-- sort_order 4 dan 6) — lihat file itu untuk konteks lengkap kurikulum
-- Bab 16.
--
-- 4 pola grammar Bab 16, dibagi 2+2 (SAMA PERSIS split pelajaran Tata
-- Bahasa di 085):
--   Tugas 1 — Partikel Waktu & Tanggal (urutan 5, 2 pola): 〜に[verb]
--     (partikel waktu), 〜月〜日 (menyatakan tanggal).
--   Tugas 2 — Frekuensi & Bertanya Waktu (urutan 7, 2 pola): 毎週／毎月／
--     毎年 (setiap ~), 何曜日／何月何日／いつ (bertanya hari/tanggal/waktu).
-- required_count = 1 per pola, konsisten dengan tugas bunpou Bab 3-15.
--
-- Bank module_grammar FIND-OR-CREATE per pola dengan pattern string PERSIS
-- SAMA dengan 085_bunpou_bab16.sql (find akan selalu hit karena 085 sudah
-- membuat baris ini; INSERT fallback isinya disalin identik dari 085 kalau
-- baris itu ternyata sudah terhapus).
--
-- POSISI: pola penomoran ulang berbasis ROW_NUMBER (bukan sort_order
-- literal) yang sama seperti 090/091/092, aman dijalankan apa pun kondisi
-- sort_order modul saat ini:
--     lesson lama ke-1..4  → sort_order 1..4
--     Tugas 1 (Partikel Waktu & Tanggal) → sort_order 5
--     lesson lama ke-5     → sort_order 6
--     Tugas 2 (Frekuensi & Bertanya Waktu) → sort_order 7
--     lesson lama ke-6..n  → sort_order 8..n+2
-- Fallback aman: kalau modul Bab 16 punya < 5 lesson lain, penomoran
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
  v_bab_no      INT  := 16;
  v_title_re    TEXT := '(hari|jadwal|tanggal)';
  v_slug1       TEXT := 'tugas-bunpou-bab-16-partikel-waktu-tanggal';
  v_slug2       TEXT := 'tugas-bunpou-bab-16-frekuensi-bertanya-waktu';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson1_id   UUID;
  v_lesson2_id   UUID;
  v_other_count  INT;
  v_pos1         INT;
  v_pos2         INT;
  v_g_ni       UUID; -- 〜に[verb]
  v_g_tanggal  UUID; -- 〜月〜日
  v_g_maishu   UUID; -- 毎週／毎月／毎年
  v_g_itsu     UUID; -- 何曜日／何月何日／いつ
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET (v_bab_no - 1) LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '093: modul Bab % di kursus % tidak ditemukan — skip seed tugas bunpou.', v_bab_no, v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* v_title_re THEN
    RAISE NOTICE '093: modul Bab % terbaca "%" — kalau ternyata bukan bab yang dimaksud, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).',
      v_bab_no, v_module_title;
  END IF;

  RAISE NOTICE '093: seed 2 Tugas Bunpou Bab % ke modul "%".', v_bab_no, v_module_title;

  -- ===== Bank module_grammar: find-or-create per pola (persis 085) =====

  SELECT id INTO v_g_ni FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜に[verb]';
  IF v_g_ni IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜に[verb]', 'partikel waktu (pada ~)', '七時に おきます。',
      'に dipakai untuk waktu yang bisa DIANGKAKAN: jam, tanggal, bulan, tahun, dan nama hari (七時に、三月に、日ようびに). TIDAK dipakai untuk kata waktu relatif — きょう、あした、いま、まいにち、こんしゅう semuanya tanpa に.'
    ) RETURNING id INTO v_g_ni;
  END IF;

  SELECT id INTO v_g_tanggal FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜月〜日';
  IF v_g_tanggal IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜月〜日', 'menyatakan tanggal', '四月十日',
      'Bulan = angka + 月 (いちがつ sampai じゅうにがつ). Tanggal 1-10 serta 14, 20, dan 24 punya bacaan khusus (ついたち、ふつか、みっか … とおか、じゅうよっか、はつか、にじゅうよっか); sisanya angka + にち.'
    ) RETURNING id INTO v_g_tanggal;
  END IF;

  SELECT id INTO v_g_maishu FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '毎週／毎月／毎年';
  IF v_g_maishu IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '毎週／毎月／毎年', 'setiap minggu / bulan / tahun', '毎週 土ようびに べんきょうします。',
      '毎 (まい) + satuan waktu berarti "setiap ~": まいしゅう、まいつき、まいとし／まいねん、まいにち、まいあさ、まいばん. Kata-kata ini TIDAK memakai partikel に.'
    ) RETURNING id INTO v_g_maishu;
  END IF;

  SELECT id INTO v_g_itsu FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '何曜日／何月何日／いつ';
  IF v_g_itsu IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '何曜日／何月何日／いつ', 'bertanya hari, tanggal, dan waktu', 'きょうは 何ようびですか。',
      '何ようび menanyakan hari, 何月何日 menanyakan tanggal, dan いつ menanyakan waktu secara umum (paling luwes, bisa untuk apa saja). Jawaban tanggal dan jam biasanya diikuti です, sedangkan kalimat berkata kerja memakai に.'
    ) RETURNING id INTO v_g_itsu;
  END IF;

  IF v_g_ni IS NULL OR v_g_tanggal IS NULL OR v_g_maishu IS NULL OR v_g_itsu IS NULL THEN
    RAISE EXCEPTION '093: gagal resolve salah satu dari 4 pola grammar Bab 16';
  END IF;

  -- ===== Dua lesson grammar_task (upsert) =====

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, cooldown_hours
  ) VALUES (
    v_module_id, v_slug1, 'Tugas Bunpou Bab 16: Partikel Waktu & Tanggal', 'grammar_task',
    'Buat kalimat pakai 2 pola Bab 16 (memakai partikel waktu 〜に dengan keterangan waktu yang bisa diangkakan, dan menyebutkan tanggal dengan pola 〜月〜日), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
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
    v_module_id, v_slug2, 'Tugas Bunpou Bab 16: Frekuensi & Bertanya Waktu', 'grammar_task',
    'Buat kalimat pakai 2 pola Bab 16 (menyatakan sesuatu yang rutin dengan 毎週／毎月／毎年, dan bertanya hari/tanggal/waktu dengan 何曜日／何月何日／いつ), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
    15, 101, 70, 12
  )
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title, type = EXCLUDED.type, content = EXCLUDED.content,
    duration_minutes = EXCLUDED.duration_minutes, updated_at = NOW()
  RETURNING id INTO v_lesson2_id;

  -- ===== Wiring pola ke tiap tugas =====

  DELETE FROM lesson_grammar_task_items WHERE lesson_id IN (v_lesson1_id, v_lesson2_id);

  INSERT INTO lesson_grammar_task_items (lesson_id, grammar_id, sort_order, instruction, required_count) VALUES
    (v_lesson1_id, v_g_ni,      1, 'Buat satu kalimat memakai partikel waktu に dengan keterangan waktu yang bisa diangkakan (jam, tanggal, bulan, tahun, atau nama hari).', 1),
    (v_lesson1_id, v_g_tanggal, 2, 'Buat satu kalimat yang menyebutkan tanggal memakai pola 〜月〜日.', 1),
    (v_lesson2_id, v_g_maishu,  1, 'Buat satu kalimat memakai salah satu dari 毎週／毎月／毎年 untuk menyatakan sesuatu yang terjadi rutin.', 1),
    (v_lesson2_id, v_g_itsu,    2, 'Buat satu kalimat tanya memakai 何曜日, 何月何日, atau いつ untuk menanyakan hari, tanggal, atau waktu.', 1);

  -- ===== Penomoran ulang supaya tugas jatuh di urutan 5 dan 7 =====

  SELECT COUNT(*) INTO v_other_count
    FROM lessons
   WHERE module_id = v_module_id AND id <> v_lesson1_id AND id <> v_lesson2_id;

  IF v_other_count < 5 THEN
    RAISE NOTICE '093: modul "%" cuma punya % lesson lain (< 5) — urutan 5 dan 7 tidak bisa dibentuk, kedua tugas ditaruh di akhir modul. Geser manual lewat admin kalau perlu.',
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
    RAISE EXCEPTION '093: tiap tugas harus punya tepat 2 pola (dapat % dan %)',
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson1_id),
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson2_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM lesson_grammar_task_items
     WHERE lesson_id IN (v_lesson1_id, v_lesson2_id)
       AND (instruction IS NULL OR required_count <> 1)
  ) THEN
    RAISE EXCEPTION '093: ada wiring tanpa instruction atau required_count bukan 1';
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
      RAISE EXCEPTION '093: posisi final tugas bukan 5 dan 7 (dapat % dan %)', v_pos1, v_pos2;
    END IF;

    IF EXISTS (
      SELECT sort_order FROM lessons WHERE module_id = v_module_id
       GROUP BY sort_order HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION '093: ada sort_order kembar di modul setelah penomoran ulang';
    END IF;

    RAISE NOTICE '093: selesai — Tugas Partikel Waktu & Tanggal di urutan %, Tugas Frekuensi & Bertanya Waktu di urutan % (4 kalimat wajib total).', v_pos1, v_pos2;
  ELSE
    RAISE NOTICE '093: selesai — 2 tugas ter-wire (4 kalimat wajib total), posisi menyusul diatur manual.';
  END IF;
END $$;
