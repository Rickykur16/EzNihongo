-- 060_grammar_task_bab11.sql — Dua Tugas Bunpou Bab 11: Counter & ください,
-- Tanya Jumlah & Hitung Asli.
--
-- Melanjutkan pola tugas bunpou Bab 3-10 (043/046/048/052/054/056/058).
-- Konten dari Notion N5-B11 "Counter (Penghitung)"; modul di-resolve
-- ordinal (OFFSET 10, lanjutan OFFSET 0-9 di 039-059).
--
-- 4 pola grammar Bab 11 (GRM-48..51), dibagi 2+2 (pola sama dengan Bab 5/
-- 8/9 yang juga 4 pola), di posisi sidebar 5 dan 7 (konvensi sejak Bab 6):
--   Tugas 1 — Counter & ください (urutan 5): 〜を[counter]+[verb]
--     (objek + kata bantu bilangan + kata kerja, biasanya ください) /
--     [counter]+ あります／います (menyatakan jumlah yang ada).
--   Tugas 2 — Tanya Jumlah & Hitung Asli (urutan 7): いくつ／何人／何枚
--     (menanyakan jumlah) / Native counters (ひとつ・ふたつ・みっつ…とお,
--     WAJIB hafal per catatan Notion — bilangan asli Jepang untuk benda
--     umum, dipakai kalau tidak ada kata bantu bilangan khusus).
-- required_count = 1 per pola, konsisten dengan tugas bunpou Bab 3-10.
--
-- KANJI: 8 kanji "First Lesson"=Bab11 di Notion Kanji DB (年百午半週万千毎)
-- SEBAGIAN BESAR sudah taught sebagai counter Bab 5 (年百午半万千) —
-- hanya 週 (minggu) dan 毎 (setiap, sudah dipakai kata まいにち/まいあさ/
-- まいばん di Bab 10 tapi selalu ditulis kana) yang genuinely BARU. Tidak
-- dipakai di contoh module_grammar (examples tetap 100% kana, pola
-- 048/052/054/056/058 — instructional content, bukan quiz_questions
-- ber-pagar-kanji).
--
-- POSISI: pola PENOMORAN ULANG deterministik yang sama seperti 048/052/
-- 054/056/058 (BUKAN geser-relatif) karena menyisip DUA lesson sekaligus.
--     lesson lama ke-1..4  → sort_order 1..4
--     Tugas 1 (Counter & ください) → sort_order 5
--     lesson lama ke-5     → sort_order 6
--     Tugas 2 (Tanya Jumlah & Hitung Asli) → sort_order 7
--     lesson lama ke-6..n  → sort_order 8..n+2
-- Fallback aman: kalau modul Bab 11 punya < 5 lesson lain, penomoran
-- dilewati dan kedua tugas ditaruh di akhir modul dengan NOTICE.
--
-- Bank module_grammar tetap FIND-OR-CREATE per pola, sama seperti 043/046/
-- 048/052/054/056/058.
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
  v_slug1       TEXT := 'tugas-bunpou-bab-11-counter-kudasai';
  v_slug2       TEXT := 'tugas-bunpou-bab-11-tanya-jumlah-hitung-asli';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson1_id   UUID;
  v_lesson2_id   UUID;
  v_other_count  INT;
  v_pos1         INT;
  v_pos2         INT;
  v_g_wocounter  UUID; -- 〜を[counter]+[verb]
  v_g_arimasu    UUID; -- [counter]+ あります／います
  v_g_ikutsu     UUID; -- いくつ／何人／何枚
  v_g_native     UUID; -- Native counters
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 10 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '060: modul Bab 11 di kursus % tidak ditemukan — skip seed tugas bunpou.', v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* '(counter|penghitung|hitung)' THEN
    RAISE NOTICE '060: modul Bab 11 terbaca "%" — kalau ternyata bukan Bab Counter/Penghitung, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).', v_module_title;
  END IF;

  RAISE NOTICE '060: seed 2 Tugas Bunpou Bab 11 ke modul "%".', v_module_title;

  -- ===== Bank module_grammar: find-or-create per pola =====

  SELECT id INTO v_g_wocounter FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜を[counter]+[verb]';
  IF v_g_wocounter IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜を[counter]+[verb]', 'objek + kata bantu bilangan + kata kerja', 'ビールを にほん ください。',
      'Urutan: [benda]を [jumlah+kata bantu bilangan] [kata kerja]. Kata bantu bilangan (counter) dipilih sesuai jenis benda — ほん untuk benda panjang seperti botol, まい untuk benda pipih, こ untuk benda kecil umum, dst.'
    ) RETURNING id INTO v_g_wocounter;
  END IF;

  SELECT id INTO v_g_arimasu FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '[counter]+ あります／います';
  IF v_g_arimasu IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '[counter]+ あります／います', 'menyatakan jumlah yang ada', 'テーブルが みっつ あります。',
      'Sama seperti pola あります／います Bab 8, tapi ditambah kata bantu bilangan sebelum kata kerja untuk menyebutkan JUMLAHnya: [benda]が [jumlah+counter] あります／います.'
    ) RETURNING id INTO v_g_arimasu;
  END IF;

  SELECT id INTO v_g_ikutsu FROM module_grammar
   WHERE module_id = v_module_id AND pattern = 'いくつ／何人／何枚';
  IF v_g_ikutsu IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, 'いくつ／何人／何枚', 'menanyakan jumlah', 'なんにんですか。',
      'いくつ menanyakan jumlah benda secara umum (pakai native counter), sedangkan 何〜 (何人／何枚／何本 dst) menanyakan jumlah dengan kata bantu bilangan spesifik sesuai jenis benda.'
    ) RETURNING id INTO v_g_ikutsu;
  END IF;

  SELECT id INTO v_g_native FROM module_grammar
   WHERE module_id = v_module_id AND pattern = 'Native counters';
  IF v_g_native IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, 'Native counters', 'ひとつ ふたつ みっつ … とお (WAJIB hafal)', 'りんごを みっつ ください。',
      'Bilangan asli Jepang (ひとつ〜とお, 1-10) dipakai untuk menghitung benda umum kalau tidak ada kata bantu bilangan khusus yang cocok. WAJIB dihafal — beda total dari cara baca angka biasa (いち/に/さん dst).'
    ) RETURNING id INTO v_g_native;
  END IF;

  IF v_g_wocounter IS NULL OR v_g_arimasu IS NULL OR v_g_ikutsu IS NULL OR v_g_native IS NULL THEN
    RAISE EXCEPTION '060: gagal resolve salah satu dari 4 pola grammar Bab 11';
  END IF;

  -- ===== Dua lesson grammar_task (upsert) =====

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, cooldown_hours
  ) VALUES (
    v_module_id, v_slug1, 'Tugas Bunpou Bab 11 — Counter & ください', 'grammar_task',
    'Buat kalimat pakai 2 pola dasar Bab 11 (memesan/meminta sesuatu dengan jumlah dan kata bantu bilangan yang tepat, dan menyatakan jumlah benda yang ada), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
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
    v_module_id, v_slug2, 'Tugas Bunpou Bab 11 — Tanya Jumlah & Hitung Asli', 'grammar_task',
    'Buat kalimat pakai 2 pola lanjutan Bab 11 (menanyakan jumlah sesuatu, dan menggunakan bilangan asli Jepang ひとつ／ふたつ／みっつ dst), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
    15, 101, 70, 12
  )
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title, type = EXCLUDED.type, content = EXCLUDED.content,
    duration_minutes = EXCLUDED.duration_minutes, updated_at = NOW()
  RETURNING id INTO v_lesson2_id;

  -- ===== Wiring pola ke tiap tugas =====

  DELETE FROM lesson_grammar_task_items WHERE lesson_id IN (v_lesson1_id, v_lesson2_id);

  INSERT INTO lesson_grammar_task_items (lesson_id, grammar_id, sort_order, instruction, required_count) VALUES
    (v_lesson1_id, v_g_wocounter, 1, 'Buat satu kalimat memakai pola 〜を[counter]+[verb] untuk memesan atau meminta sesuatu dengan jumlah dan kata bantu bilangan yang sesuai jenis bendanya.', 1),
    (v_lesson1_id, v_g_arimasu,   2, 'Buat satu kalimat memakai pola [counter]+ あります／います untuk menyatakan berapa banyak sesuatu yang ada.', 1),
    (v_lesson2_id, v_g_ikutsu,    1, 'Buat satu kalimat tanya memakai いくつ atau 何〜 (何人／何枚／何本 dst) untuk menanyakan jumlah sesuatu.', 1),
    (v_lesson2_id, v_g_native,    2, 'Buat satu kalimat memakai salah satu bilangan asli Jepang (ひとつ／ふたつ／みっつ dst) untuk menghitung benda.', 1);

  -- ===== Penomoran ulang supaya tugas jatuh di urutan 5 dan 7 =====

  SELECT COUNT(*) INTO v_other_count
    FROM lessons
   WHERE module_id = v_module_id AND id <> v_lesson1_id AND id <> v_lesson2_id;

  IF v_other_count < 5 THEN
    RAISE NOTICE '060: modul "%" cuma punya % lesson lain (< 5) — urutan 5 dan 7 tidak bisa dibentuk, kedua tugas ditaruh di akhir modul. Geser manual lewat admin kalau perlu.',
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
    RAISE EXCEPTION '060: tiap tugas harus punya tepat 2 pola (dapat % dan %)',
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson1_id),
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson2_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM lesson_grammar_task_items
     WHERE lesson_id IN (v_lesson1_id, v_lesson2_id)
       AND (instruction IS NULL OR required_count <> 1)
  ) THEN
    RAISE EXCEPTION '060: ada wiring tanpa instruction atau required_count bukan 1';
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
      RAISE EXCEPTION '060: posisi final tugas bukan 5 dan 7 (dapat % dan %)', v_pos1, v_pos2;
    END IF;

    IF EXISTS (
      SELECT sort_order FROM lessons WHERE module_id = v_module_id
       GROUP BY sort_order HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION '060: ada sort_order kembar di modul setelah penomoran ulang';
    END IF;

    RAISE NOTICE '060: selesai — Tugas Counter & ください di urutan %, Tugas Tanya Jumlah & Hitung Asli di urutan % (4 kalimat wajib total).', v_pos1, v_pos2;
  ELSE
    RAISE NOTICE '060: selesai — 2 tugas ter-wire (4 kalimat wajib total), posisi menyusul diatur manual.';
  END IF;
END $$;
