-- 046_grammar_task_bab5.sql — Dua Tugas Bunpou Bab 5: Angka, Waktu & Uang.
--
-- Pola sama dengan 043 (tugas bunpou Bab 4): kurikulum tidak disimpan di repo,
-- jadi konten ditarik dari Notion N5-B5 "Angka, Waktu & Uang"; modul di-resolve
-- ordinal (OFFSET 4, lanjutan pola 039-045).
--
-- 4 pola grammar Bab 5 (GRM-22..25) dibagi ke DUA tugas per tema (keputusan
-- user), karena Bab 5 punya dua lesson materi bunpou terpisah:
--   Tugas 1 — Waktu      : 今〜時〜分です / 〜時から〜時まで
--   Tugas 2 — Uang & Umur: これはいくらですか / おいくつですか／何歳ですか
-- required_count = 1 per pola, konsisten dengan tugas bunpou Bab 3 & 4.
--
-- POSISI (permintaan user: "masing-masing pada urutan 6 dan 8 di bab 5"):
-- setelah migrasi ini, di daftar lesson modul Bab 5 yang diurut sort_order,
-- Tugas 1 harus berada di urutan ke-6 dan Tugas 2 di urutan ke-8 — yaitu tepat
-- setelah masing-masing lesson materi bunpou-nya. Karena menyisipkan DUA
-- lesson sekaligus, pendekatan geser-relatif seperti 044 tidak cukup: nomor
-- urut saling menggeser satu sama lain. Jadi seluruh lesson modul DINOMORI
-- ULANG secara deterministik ke urutan final yang diinginkan:
--     lesson lama ke-1..5  → sort_order 1..5
--     Tugas 1              → sort_order 6
--     lesson lama ke-6     → sort_order 7
--     Tugas 2              → sort_order 8
--     lesson lama ke-7..n  → sort_order 9..n+2
-- Urutan relatif lesson lain TIDAK berubah, cuma nomornya dirapikan. Karena
-- targetnya nilai absolut (bukan increment), penomoran ini idempoten — re-run
-- menghasilkan susunan yang persis sama, tidak ada drift.
--
-- Kalau modul Bab 5 punya kurang dari 6 lesson lain (struktur belum sesuai
-- asumsi), penomoran dilewati dan kedua tugas ditaruh di akhir modul dengan
-- NOTICE — admin tinggal geser manual lewat drag-and-drop.
--
-- BANK module_grammar: FIND-OR-CREATE per pola (bukan blind insert), sama
-- seperti 043 — tidak ada unique constraint di module_grammar selain id, dan
-- tidak diketahui apakah admin sudah authoring sebagian pola Bab 5 lewat UI.
--
-- POPUP: lessons.popup_after_lesson_id sengaja tidak diisi — admin-editable
-- kapan saja lewat form tanpa perlu migrasi baru.
--
-- PERINGATAN RE-RUN: DELETE FROM lesson_grammar_task_items di bawah tanpa
-- syarat — kalau admin sudah menambah pola manual ke salah satu tugas ini,
-- re-run manual akan menghapus wiring itu (bank module_grammar sendiri TIDAK
-- terhapus). Runner (migrations/run.js) menjalankan file ini SEKALI per DB.
--
-- Idempotent: lesson di-upsert per (module_id, slug), wiring lama dihapus lalu
-- di-insert ulang, bank find-or-create, penomoran deterministik; no-op aman
-- kalau modul target belum ada.

DO $$
DECLARE
  v_course_slug TEXT := 'n5';
  v_slug1       TEXT := 'tugas-bunpou-bab-5-waktu';
  v_slug2       TEXT := 'tugas-bunpou-bab-5-uang-umur';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson1_id   UUID;
  v_lesson2_id   UUID;
  v_other_count  INT;
  v_pos1         INT;
  v_pos2         INT;
  v_g_jikan  UUID; -- 今〜時〜分です
  v_g_kara   UUID; -- 〜時から〜時まで
  v_g_ikura  UUID; -- これはいくらですか
  v_g_ikutsu UUID; -- おいくつですか／何歳ですか
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 4 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '046: modul Bab 5 di kursus % tidak ditemukan — skip seed tugas bunpou.', v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* '(angka|waktu|uang)' THEN
    RAISE NOTICE '046: modul Bab 5 terbaca "%" — kalau ternyata bukan Bab Angka/Waktu/Uang, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).', v_module_title;
  END IF;

  RAISE NOTICE '046: seed 2 Tugas Bunpou Bab 5 ke modul "%".', v_module_title;

  -- ===== Bank module_grammar: find-or-create per pola =====

  SELECT id INTO v_g_jikan FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '今〜時〜分です';
  IF v_g_jikan IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '今〜時〜分です', 'menyatakan waktu sekarang', '今 9時半です。',
      'Dipakai untuk menyebutkan jam sekarang. 半 (はん) berarti setengah, jadi 9時半 = jam setengah sepuluh (9:30). Perhatikan bacaan 分 yang berubah antara ふん dan ぷん tergantung angkanya.'
    ) RETURNING id INTO v_g_jikan;
  END IF;

  SELECT id INTO v_g_kara FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜時から〜時まで';
  IF v_g_kara IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜時から〜時まで', 'dari jam ~ sampai jam ~', '9時から 5時までです。',
      'から menandai titik awal, まで menandai titik akhir. Bisa dipakai untuk jam kerja, jam sekolah, atau jam buka toko.'
    ) RETURNING id INTO v_g_kara;
  END IF;

  SELECT id INTO v_g_ikura FROM module_grammar
   WHERE module_id = v_module_id AND pattern = 'これはいくらですか';
  IF v_g_ikura IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, 'これはいくらですか', 'berapa harganya', 'これは 300円です。',
      'いくら menanyakan harga. Jawabannya memakai satuan 円 (えん) untuk yen atau ドル untuk dolar.'
    ) RETURNING id INTO v_g_ikura;
  END IF;

  SELECT id INTO v_g_ikutsu FROM module_grammar
   WHERE module_id = v_module_id AND pattern = 'おいくつですか／何歳ですか';
  IF v_g_ikutsu IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, 'おいくつですか／何歳ですか', 'menanyakan umur', '23歳です。',
      'おいくつですか lebih sopan, 何歳ですか lebih santai. Jawabannya memakai satuan 歳 (さい). Perhatikan pengecualian 20 tahun yang dibaca はたち.'
    ) RETURNING id INTO v_g_ikutsu;
  END IF;

  IF v_g_jikan IS NULL OR v_g_kara IS NULL OR v_g_ikura IS NULL OR v_g_ikutsu IS NULL THEN
    RAISE EXCEPTION '046: gagal resolve salah satu dari 4 pola grammar Bab 5';
  END IF;

  -- ===== Dua lesson grammar_task (upsert) =====
  -- sort_order sementara di sini; nilai final ditetapkan saat penomoran ulang.

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, cooldown_hours
  ) VALUES (
    v_module_id, v_slug1, 'Tugas Bunpou Bab 5 — Waktu', 'grammar_task',
    'Buat kalimat pakai 2 pola waktu Bab 5 (今〜時〜分です dan 〜時から〜時まで), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
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
    v_module_id, v_slug2, 'Tugas Bunpou Bab 5 — Uang & Umur', 'grammar_task',
    'Buat kalimat pakai 2 pola Bab 5 tentang harga dan umur (これはいくらですか dan おいくつですか／何歳ですか), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
    15, 101, 70, 12
  )
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title, type = EXCLUDED.type, content = EXCLUDED.content,
    duration_minutes = EXCLUDED.duration_minutes, updated_at = NOW()
  RETURNING id INTO v_lesson2_id;

  -- ===== Wiring pola ke tiap tugas =====

  DELETE FROM lesson_grammar_task_items WHERE lesson_id IN (v_lesson1_id, v_lesson2_id);

  INSERT INTO lesson_grammar_task_items (lesson_id, grammar_id, sort_order, instruction, required_count) VALUES
    (v_lesson1_id, v_g_jikan, 1, 'Lihat jam sekarang, lalu buat satu kalimat yang menyebutkan waktunya pakai 今〜時〜分です. Contoh: いま ７じ３０ぷんです.', 1),
    (v_lesson1_id, v_g_kara,  2, 'Buat satu kalimat tentang rentang waktu pakai 〜時から〜時まで, misalnya jam sekolah, jam kerja, atau jam buka toko. Contoh: ９じから ５じまでです.', 1),
    (v_lesson2_id, v_g_ikura,  1, 'Pilih satu barang di dekatmu, lalu buat satu kalimat tanya harganya pakai いくらですか, atau kalimat yang menyebutkan harganya pakai 〜えんです.', 1),
    (v_lesson2_id, v_g_ikutsu, 2, 'Buat satu kalimat untuk menanyakan umur pakai おいくつですか atau 何歳ですか, atau kalimat yang menyebutkan umur pakai 〜さいです.', 1);

  -- ===== Penomoran ulang supaya tugas jatuh di urutan 6 dan 8 =====

  SELECT COUNT(*) INTO v_other_count
    FROM lessons
   WHERE module_id = v_module_id AND id <> v_lesson1_id AND id <> v_lesson2_id;

  IF v_other_count < 6 THEN
    RAISE NOTICE '046: modul "%" cuma punya % lesson lain (< 6) — urutan 6 dan 8 tidak bisa dibentuk, kedua tugas ditaruh di akhir modul. Geser manual lewat admin kalau perlu.',
      v_module_title, v_other_count;
  ELSE
    WITH ordered AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order ASC, created_at ASC) AS rn
        FROM lessons
       WHERE module_id = v_module_id
         AND id <> v_lesson1_id AND id <> v_lesson2_id
    ), target AS (
      SELECT id,
             (CASE WHEN rn <= 5 THEN rn
                   WHEN rn = 6  THEN 7
                   ELSE rn + 2
              END)::INT AS new_sort
        FROM ordered
    )
    UPDATE lessons l
       SET sort_order = t.new_sort, updated_at = NOW()
      FROM target t
     WHERE l.id = t.id AND l.sort_order IS DISTINCT FROM t.new_sort;

    UPDATE lessons SET sort_order = 6, updated_at = NOW()
     WHERE id = v_lesson1_id AND sort_order IS DISTINCT FROM 6;
    UPDATE lessons SET sort_order = 8, updated_at = NOW()
     WHERE id = v_lesson2_id AND sort_order IS DISTINCT FROM 8;
  END IF;

  -- ===== Assertion =====

  IF (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson1_id) <> 2
     OR (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson2_id) <> 2 THEN
    RAISE EXCEPTION '046: tiap tugas harus punya tepat 2 pola (dapat % dan %)',
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson1_id),
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson2_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM lesson_grammar_task_items
     WHERE lesson_id IN (v_lesson1_id, v_lesson2_id)
       AND (instruction IS NULL OR required_count <> 1)
  ) THEN
    RAISE EXCEPTION '046: ada wiring tanpa instruction atau required_count bukan 1';
  END IF;

  IF v_other_count >= 6 THEN
    SELECT rn INTO v_pos1 FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order ASC, created_at ASC) AS rn
        FROM lessons WHERE module_id = v_module_id
    ) x WHERE x.id = v_lesson1_id;
    SELECT rn INTO v_pos2 FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order ASC, created_at ASC) AS rn
        FROM lessons WHERE module_id = v_module_id
    ) x WHERE x.id = v_lesson2_id;

    IF v_pos1 <> 6 OR v_pos2 <> 8 THEN
      RAISE EXCEPTION '046: posisi final tugas bukan 6 dan 8 (dapat % dan %)', v_pos1, v_pos2;
    END IF;

    IF EXISTS (
      SELECT sort_order FROM lessons WHERE module_id = v_module_id
       GROUP BY sort_order HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION '046: ada sort_order kembar di modul setelah penomoran ulang';
    END IF;

    RAISE NOTICE '046: selesai — Tugas Waktu di urutan %, Tugas Uang & Umur di urutan % (4 kalimat wajib total).', v_pos1, v_pos2;
  ELSE
    RAISE NOTICE '046: selesai — 2 tugas ter-wire (4 kalimat wajib total), posisi menyusul diatur manual.';
  END IF;
END $$;
