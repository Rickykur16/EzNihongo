-- 058_grammar_task_bab10.sql — Dua Tugas Bunpou Bab 10: Bentuk Kini,
-- Bentuk Lampau & Frekuensi.
--
-- Melanjutkan pola tugas bunpou Bab 3-9 (043/046/048/052/054/056). Konten
-- dari Notion N5-B10 "Aktivitas Harian" (Daily Activities); modul
-- di-resolve ordinal (OFFSET 9, lanjutan OFFSET 0-8 di 039-057).
--
-- BAB PALING BESAR SEJAUH INI — Bab 10 memperkenalkan paradigma konjugasi
-- kata kerja LENGKAP (kini afirmatif/negatif, lampau afirmatif/negatif)
-- DAN partikel を (objek langsung) untuk PERTAMA KALINYA. Sebelumnya kata
-- kerja aktif dilarang total di semua assignment kuis (kecuali
-- あります／います sejak Bab 8, 行く／来る／帰る sejak Bab 9) — sekarang
-- kata kerja transitif umum (食べる/飲む/見る/読む/書く dst) resmi
-- diajarkan lewat 5 pola berikut:
--   Tugas 1 — Bentuk Kini (urutan 5): 〜を[verb]ます (kalimat afirmatif
--     dengan objek langsung + partikel を) / [verb]ません (negatif kini).
--   Tugas 2 — Bentuk Lampau & Frekuensi (urutan 7): [verb]ました (lampau
--     afirmatif) / [verb]ませんでした (lampau negatif) / 毎日／いつも／
--     時々 (kata keterangan frekuensi, bisa dipasangkan dengan tense
--     manapun).
-- required_count = 1 per pola, konsisten dengan tugas bunpou Bab 3-9.
--
-- 3 kanji resmi Bab 10 (見読書, dikonfirmasi dari Notion Kanji DB filter
-- "First Lesson"=Bab10 — LEBIH SEDIKIT dari 8 kandidat yang disebut di
-- catatan Notion "Kanji Bab 10", pola sama seperti Bab lain yang kandidat
-- > kanji resmi ter-link) TIDAK dipakai di contoh module_grammar —
-- examples tetap 100% kana, mengikuti pola 048/052/054/056 (instructional
-- content, bukan quiz_questions ber-pagar-kanji).
--
-- POSISI: pola PENOMORAN ULANG deterministik yang sama seperti 048/052/
-- 054/056 (BUKAN geser-relatif) karena menyisip DUA lesson sekaligus.
--     lesson lama ke-1..4  → sort_order 1..4
--     Tugas 1 (Bentuk Kini)          → sort_order 5
--     lesson lama ke-5     → sort_order 6
--     Tugas 2 (Bentuk Lampau & Frekuensi) → sort_order 7
--     lesson lama ke-6..n  → sort_order 8..n+2
-- Fallback aman: kalau modul Bab 10 punya < 5 lesson lain, penomoran
-- dilewati dan kedua tugas ditaruh di akhir modul dengan NOTICE.
--
-- Bank module_grammar tetap FIND-OR-CREATE per pola, sama seperti 043/046/
-- 048/052/054/056.
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
  v_slug1       TEXT := 'tugas-bunpou-bab-10-bentuk-kini';
  v_slug2       TEXT := 'tugas-bunpou-bab-10-bentuk-lampau-frekuensi';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson1_id   UUID;
  v_lesson2_id   UUID;
  v_other_count  INT;
  v_pos1         INT;
  v_pos2         INT;
  v_g_wo         UUID; -- 〜を[verb]ます
  v_g_masen      UUID; -- [verb]ません
  v_g_mashita    UUID; -- [verb]ました
  v_g_masendeshita UUID; -- [verb]ませんでした
  v_g_freq       UUID; -- 毎日／いつも／時々
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 9 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '058: modul Bab 10 di kursus % tidak ditemukan — skip seed tugas bunpou.', v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* '(aktivitas|harian|daily|kegiatan)' THEN
    RAISE NOTICE '058: modul Bab 10 terbaca "%" — kalau ternyata bukan Bab Aktivitas Harian, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).', v_module_title;
  END IF;

  RAISE NOTICE '058: seed 2 Tugas Bunpou Bab 10 ke modul "%".', v_module_title;

  -- ===== Bank module_grammar: find-or-create per pola =====

  SELECT id INTO v_g_wo FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜を[verb]ます';
  IF v_g_wo IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜を[verb]ます', 'kalimat afirmatif dengan objek langsung', 'ごはんを たべます。',
      'を menandai objek langsung dari kata kerja (apa yang di-〜kan). Urutan: [objek]を [kata kerja]ます. Beda dari partikel lokasi/waktu yang sudah dipelajari — を khusus untuk objek yang kena tindakan.'
    ) RETURNING id INTO v_g_wo;
  END IF;

  SELECT id INTO v_g_masen FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '[verb]ません';
  IF v_g_masen IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '[verb]ません', 'negatif kini', 'きょう はたらきません。',
      'ません mengubah kata kerja ます-form jadi negatif kini (tidak melakukan). Ganti akhiran ます→ません.'
    ) RETURNING id INTO v_g_masen;
  END IF;

  SELECT id INTO v_g_mashita FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '[verb]ました';
  IF v_g_mashita IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '[verb]ました', 'lampau afirmatif', 'きのう べんきょうしました。',
      'ました mengubah kata kerja ます-form jadi lampau afirmatif (sudah melakukan). Ganti akhiran ます→ました.'
    ) RETURNING id INTO v_g_mashita;
  END IF;

  SELECT id INTO v_g_masendeshita FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '[verb]ませんでした';
  IF v_g_masendeshita IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '[verb]ませんでした', 'lampau negatif', 'きのう たべませんでした。',
      'ませんでした mengubah kata kerja ます-form jadi lampau negatif (tidak melakukan, di masa lalu). Ganti akhiran ます→ませんでした.'
    ) RETURNING id INTO v_g_masendeshita;
  END IF;

  SELECT id INTO v_g_freq FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '毎日／いつも／時々';
  IF v_g_freq IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '毎日／いつも／時々', 'kata keterangan frekuensi', 'まいにち コーヒーを のみます。',
      'Kata keterangan frekuensi (まいにち＝setiap hari, いつも＝selalu, ときどき＝kadang-kadang) diletakkan di awal kalimat, bisa dipasangkan dengan bentuk kini maupun lampau.'
    ) RETURNING id INTO v_g_freq;
  END IF;

  IF v_g_wo IS NULL OR v_g_masen IS NULL OR v_g_mashita IS NULL OR v_g_masendeshita IS NULL OR v_g_freq IS NULL THEN
    RAISE EXCEPTION '058: gagal resolve salah satu dari 5 pola grammar Bab 10';
  END IF;

  -- ===== Dua lesson grammar_task (upsert) =====

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, cooldown_hours
  ) VALUES (
    v_module_id, v_slug1, 'Tugas Bunpou Bab 10 — Bentuk Kini', 'grammar_task',
    'Buat kalimat pakai 2 pola dasar Bab 10 (kalimat afirmatif dengan objek langsung memakai partikel を, dan bentuk negatif kini), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
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
    v_module_id, v_slug2, 'Tugas Bunpou Bab 10 — Bentuk Lampau & Frekuensi', 'grammar_task',
    'Buat kalimat pakai 3 pola lanjutan Bab 10 (bentuk lampau afirmatif, bentuk lampau negatif, dan kata keterangan frekuensi), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
    15, 101, 70, 12
  )
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title, type = EXCLUDED.type, content = EXCLUDED.content,
    duration_minutes = EXCLUDED.duration_minutes, updated_at = NOW()
  RETURNING id INTO v_lesson2_id;

  -- ===== Wiring pola ke tiap tugas =====

  DELETE FROM lesson_grammar_task_items WHERE lesson_id IN (v_lesson1_id, v_lesson2_id);

  INSERT INTO lesson_grammar_task_items (lesson_id, grammar_id, sort_order, instruction, required_count) VALUES
    (v_lesson1_id, v_g_wo,             1, 'Buat satu kalimat memakai pola 〜を[verb]ます untuk menyatakan sesuatu yang kamu lakukan pada suatu objek (mis. makan nasi, membaca buku).', 1),
    (v_lesson1_id, v_g_masen,          2, 'Buat satu kalimat memakai pola [verb]ません untuk menyatakan sesuatu yang TIDAK kamu lakukan hari ini.', 1),
    (v_lesson2_id, v_g_mashita,        1, 'Buat satu kalimat memakai pola [verb]ました untuk menyatakan sesuatu yang SUDAH kamu lakukan kemarin.', 1),
    (v_lesson2_id, v_g_masendeshita,   2, 'Buat satu kalimat memakai pola [verb]ませんでした untuk menyatakan sesuatu yang TIDAK kamu lakukan kemarin.', 1),
    (v_lesson2_id, v_g_freq,           3, 'Buat satu kalimat memakai salah satu kata keterangan frekuensi (まいにち／いつも／ときどき).', 1);

  -- ===== Penomoran ulang supaya tugas jatuh di urutan 5 dan 7 =====

  SELECT COUNT(*) INTO v_other_count
    FROM lessons
   WHERE module_id = v_module_id AND id <> v_lesson1_id AND id <> v_lesson2_id;

  IF v_other_count < 5 THEN
    RAISE NOTICE '058: modul "%" cuma punya % lesson lain (< 5) — urutan 5 dan 7 tidak bisa dibentuk, kedua tugas ditaruh di akhir modul. Geser manual lewat admin kalau perlu.',
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
    RAISE EXCEPTION '058: Tugas 1 harus punya tepat 2 pola dan Tugas 2 tepat 3 pola (dapat % dan %)',
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson1_id),
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson2_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM lesson_grammar_task_items
     WHERE lesson_id IN (v_lesson1_id, v_lesson2_id)
       AND (instruction IS NULL OR required_count <> 1)
  ) THEN
    RAISE EXCEPTION '058: ada wiring tanpa instruction atau required_count bukan 1';
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
      RAISE EXCEPTION '058: posisi final tugas bukan 5 dan 7 (dapat % dan %)', v_pos1, v_pos2;
    END IF;

    IF EXISTS (
      SELECT sort_order FROM lessons WHERE module_id = v_module_id
       GROUP BY sort_order HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION '058: ada sort_order kembar di modul setelah penomoran ulang';
    END IF;

    RAISE NOTICE '058: selesai — Tugas Bentuk Kini di urutan %, Tugas Bentuk Lampau & Frekuensi di urutan % (5 kalimat wajib total).', v_pos1, v_pos2;
  ELSE
    RAISE NOTICE '058: selesai — 2 tugas ter-wire (5 kalimat wajib total), posisi menyusul diatur manual.';
  END IF;
END $$;
