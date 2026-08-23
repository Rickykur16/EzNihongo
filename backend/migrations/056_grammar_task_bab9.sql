-- 056_grammar_task_bab9.sql — Dua Tugas Bunpou Bab 9: Pergi/Datang/Pulang,
-- Rencana Perjalanan.
--
-- Melanjutkan pola tugas bunpou Bab 3-8 (043/046/048/052/054). Konten dari
-- Notion N5-B9 "Bepergian" (Title EN: "Going Places & Transportation");
-- modul di-resolve ordinal (OFFSET 8, lanjutan OFFSET 0-7 di 039-055).
--
-- Hanya 4 pola grammar Bab 9 (Notion Grammar DB, filter Lesson=Bab9 —
-- GRM-39..42) — sama seperti Bab 5/8 (4 pola juga), jadi dibagi 2+2 ke dua
-- tugas (pola 046/054), di posisi sidebar yang SAMA (urutan 5 dan 7 —
-- konvensi sesi ini sejak Bab 6):
--   Tugas 1 — Pergi, Datang, Pulang (urutan 5): 〜へ行きます／来ます／帰ります
--     (arah tujuan dengan partikel へ + 3 verb gerak) / 〜で行きます
--     (moda transportasi dengan partikel で).
--   Tugas 2 — Rencana Perjalanan (urutan 7): 〜から〜まで (dari-sampai,
--     dipakai untuk TEMPAT di sini — bukan waktu seperti Bab 5, から/まで
--     sendiri sudah diajarkan sejak Bab 5) / いつ／どこへ／だれと
--     (menggabungkan kata tanya kapan/kemana/dengan siapa).
-- required_count = 1 per pola, konsisten dengan tugas bunpou Bab 3-8.
--
-- 9 kanji resmi Bab 9 (車東道駅行西電北南, dikonfirmasi dari Notion Kanji DB
-- filter "First Lesson" = Bab9) TIDAK dipakai di contoh module_grammar —
-- examples tetap 100% kana, mengikuti pola 048/052/054 (instructional
-- content, bukan quiz_questions ber-pagar-kanji).
--
-- POSISI: pola PENOMORAN ULANG deterministik yang sama seperti 048/052/054
-- (BUKAN geser-relatif) karena menyisip DUA lesson sekaligus.
--     lesson lama ke-1..4  → sort_order 1..4
--     Tugas 1 (Pergi/Datang/Pulang) → sort_order 5
--     lesson lama ke-5     → sort_order 6
--     Tugas 2 (Rencana Perjalanan)  → sort_order 7
--     lesson lama ke-6..n  → sort_order 8..n+2
-- Fallback aman: kalau modul Bab 9 punya < 5 lesson lain, penomoran
-- dilewati dan kedua tugas ditaruh di akhir modul dengan NOTICE.
--
-- Bank module_grammar tetap FIND-OR-CREATE per pola, sama seperti 043/046/
-- 048/052/054.
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
  v_slug1       TEXT := 'tugas-bunpou-bab-9-pergi-datang-pulang';
  v_slug2       TEXT := 'tugas-bunpou-bab-9-rencana-perjalanan';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson1_id   UUID;
  v_lesson2_id   UUID;
  v_other_count  INT;
  v_pos1         INT;
  v_pos2         INT;
  v_g_arah       UUID; -- 〜へ行きます／来ます／帰ります
  v_g_moda       UUID; -- 〜で行きます
  v_g_karamade   UUID; -- 〜から〜まで
  v_g_tanya      UUID; -- いつ／どこへ／だれと
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET 8 LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '056: modul Bab 9 di kursus % tidak ditemukan — skip seed tugas bunpou.', v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* '(bepergian|perjalanan|transport|travel)' THEN
    RAISE NOTICE '056: modul Bab 9 terbaca "%" — kalau ternyata bukan Bab Bepergian, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).', v_module_title;
  END IF;

  RAISE NOTICE '056: seed 2 Tugas Bunpou Bab 9 ke modul "%".', v_module_title;

  -- ===== Bank module_grammar: find-or-create per pola =====

  SELECT id INTO v_g_arah FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜へ行きます／来ます／帰ります';
  IF v_g_arah IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜へ行きます／来ます／帰ります', 'verb arah: pergi/datang/pulang ke ~', 'がっこうへ いきます。',
      'へ (dibaca "e") menandai arah tujuan, diikuti salah satu dari 3 verb gerak: いきます(pergi)／きます(datang)／かえります(pulang). Urutan: [tempat tujuan]へ いきます／きます／かえります.'
    ) RETURNING id INTO v_g_arah;
  END IF;

  SELECT id INTO v_g_moda FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜で行きます';
  IF v_g_moda IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜で行きます', 'moda transportasi: pergi naik/dengan ~', 'でんしゃで いきます。',
      'で menandai alat/moda transportasi yang dipakai (kereta, bus, mobil, sepeda, dst), diikuti verb gerak. Bisa digabung dengan pola へ: [tempat]へ [moda]で いきます.'
    ) RETURNING id INTO v_g_moda;
  END IF;

  SELECT id INTO v_g_karamade FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜から〜まで';
  IF v_g_karamade IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜から〜まで', 'dari ~ sampai ~ (untuk tempat)', 'いえから えきまで あるきます。',
      'から/まで sudah diajarkan sejak Bab 5 untuk rentang waktu (jam) — di Bab 9 pola yang sama dipakai untuk rentang TEMPAT (dari satu lokasi sampai lokasi lain): [tempat awal]から [tempat akhir]まで.'
    ) RETURNING id INTO v_g_karamade;
  END IF;

  SELECT id INTO v_g_tanya FROM module_grammar
   WHERE module_id = v_module_id AND pattern = 'いつ／どこへ／だれと';
  IF v_g_tanya IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, 'いつ／どこへ／だれと', 'kata tanya: kapan／ke mana／dengan siapa', 'あした どこへ いきますか。',
      'Menggabungkan 3 kata tanya yang sudah dikenal (いつ=kapan, どこへ=ke mana, だれと=dengan siapa) ke dalam kalimat tanya seputar rencana bepergian. Boleh dipakai satu per kalimat atau digabung.'
    ) RETURNING id INTO v_g_tanya;
  END IF;

  IF v_g_arah IS NULL OR v_g_moda IS NULL OR v_g_karamade IS NULL OR v_g_tanya IS NULL THEN
    RAISE EXCEPTION '056: gagal resolve salah satu dari 4 pola grammar Bab 9';
  END IF;

  -- ===== Dua lesson grammar_task (upsert) =====

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, cooldown_hours
  ) VALUES (
    v_module_id, v_slug1, 'Tugas Bunpou Bab 9 — Pergi, Datang, Pulang', 'grammar_task',
    'Buat kalimat pakai 2 pola dasar bepergian Bab 9 (menyatakan arah tujuan dengan salah satu dari 3 verb gerak, dan menyebutkan moda transportasi yang dipakai), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
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
    v_module_id, v_slug2, 'Tugas Bunpou Bab 9 — Rencana Perjalanan', 'grammar_task',
    'Buat kalimat pakai 2 pola lanjutan Bab 9 (menyatakan rentang dari satu tempat sampai tempat lain, dan bertanya tentang rencana bepergian pakai kapan/ke mana/dengan siapa), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
    15, 101, 70, 12
  )
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title, type = EXCLUDED.type, content = EXCLUDED.content,
    duration_minutes = EXCLUDED.duration_minutes, updated_at = NOW()
  RETURNING id INTO v_lesson2_id;

  -- ===== Wiring pola ke tiap tugas =====

  DELETE FROM lesson_grammar_task_items WHERE lesson_id IN (v_lesson1_id, v_lesson2_id);

  INSERT INTO lesson_grammar_task_items (lesson_id, grammar_id, sort_order, instruction, required_count) VALUES
    (v_lesson1_id, v_g_arah,     1, 'Buat satu kalimat memakai pola 〜へ行きます／来ます／帰ります untuk menyatakan pergi/datang/pulang ke suatu tempat — pilih salah satu dari 3 verb gerak.', 1),
    (v_lesson1_id, v_g_moda,     2, 'Buat satu kalimat memakai pola 〜で行きます untuk menyebutkan moda transportasi yang dipakai (kereta, bus, mobil, sepeda, dst).', 1),
    (v_lesson2_id, v_g_karamade, 1, 'Buat satu kalimat memakai pola 〜から〜まで untuk menyatakan rentang dari satu tempat sampai tempat lain.', 1),
    (v_lesson2_id, v_g_tanya,    2, 'Buat satu kalimat tanya memakai salah satu dari いつ／どこへ／だれと seputar rencana bepergian.', 1);

  -- ===== Penomoran ulang supaya tugas jatuh di urutan 5 dan 7 =====

  SELECT COUNT(*) INTO v_other_count
    FROM lessons
   WHERE module_id = v_module_id AND id <> v_lesson1_id AND id <> v_lesson2_id;

  IF v_other_count < 5 THEN
    RAISE NOTICE '056: modul "%" cuma punya % lesson lain (< 5) — urutan 5 dan 7 tidak bisa dibentuk, kedua tugas ditaruh di akhir modul. Geser manual lewat admin kalau perlu.',
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
    RAISE EXCEPTION '056: tiap tugas harus punya tepat 2 pola (dapat % dan %)',
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson1_id),
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson2_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM lesson_grammar_task_items
     WHERE lesson_id IN (v_lesson1_id, v_lesson2_id)
       AND (instruction IS NULL OR required_count <> 1)
  ) THEN
    RAISE EXCEPTION '056: ada wiring tanpa instruction atau required_count bukan 1';
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
      RAISE EXCEPTION '056: posisi final tugas bukan 5 dan 7 (dapat % dan %)', v_pos1, v_pos2;
    END IF;

    IF EXISTS (
      SELECT sort_order FROM lessons WHERE module_id = v_module_id
       GROUP BY sort_order HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION '056: ada sort_order kembar di modul setelah penomoran ulang';
    END IF;

    RAISE NOTICE '056: selesai — Tugas Pergi/Datang/Pulang di urutan %, Tugas Rencana Perjalanan di urutan % (4 kalimat wajib total).', v_pos1, v_pos2;
  ELSE
    RAISE NOTICE '056: selesai — 2 tugas ter-wire (4 kalimat wajib total), posisi menyusul diatur manual.';
  END IF;
END $$;
