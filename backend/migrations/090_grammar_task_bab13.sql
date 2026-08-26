-- 090_grammar_task_bab13.sql — Dua Tugas Bunpou Bab 13: Progresif & Permintaan,
-- Izin & Larangan.
--
-- Melanjutkan pola tugas bunpou Bab 3-12 (043/046/048/052/054/056/058/060/
-- 062/065). Mengisi slot sort_order 5 dan 7 yang sengaja disisakan kosong
-- oleh 082_bunpou_bab13.sql (materi Tata Bahasa Bab 13 di sort_order 4 dan
-- 6) — lihat file itu untuk konteks lengkap kurikulum Bab 13.
--
-- 5 pola grammar Bab 13, dibagi 3+2 (SAMA PERSIS split pelajaran Tata Bahasa
-- di 082, supaya siswa langsung praktik pola dari pelajaran yang baru
-- dibaca):
--   Tugas 1 — Progresif & Permintaan (urutan 5, 3 pola): 〜ています (sedang/
--     kondisi/kebiasaan/profesi), 〜てください (permintaan sopan),
--     〜てくれませんか (permintaan halus).
--   Tugas 2 — Izin & Larangan (urutan 7, 2 pola): 〜てもいいですか (minta
--     izin), 〜てはいけません (larangan tegas).
-- required_count = 1 per pola, konsisten dengan tugas bunpou Bab 3-12.
--
-- Bank module_grammar FIND-OR-CREATE per pola dengan pattern string PERSIS
-- SAMA dengan 082_bunpou_bab13.sql (find akan selalu hit karena 082 sudah
-- membuat baris ini; INSERT fallback isinya disalin identik dari 082 kalau
-- baris itu ternyata sudah terhapus).
--
-- POSISI: berbeda dari 062/065 (Bab 12, waktu itu belum ada gap), di sini
-- 082 sudah menyisakan slot 5 dan 7 kosong — tapi logika penomoran ulang
-- tetap dipakai (sama seperti 048/052/054/056/058/060/062/065, berbasis
-- ROW_NUMBER atas urutan RELATIF, bukan nilai sort_order literal) supaya
-- migrasi ini aman dijalankan apa pun kondisi sort_order modul saat ini:
--     lesson lama ke-1..4  → sort_order 1..4
--     Tugas 1 (Progresif & Permintaan) → sort_order 5
--     lesson lama ke-5     → sort_order 6
--     Tugas 2 (Izin & Larangan) → sort_order 7
--     lesson lama ke-6..n  → sort_order 8..n+2
-- Fallback aman: kalau modul Bab 13 punya < 5 lesson lain, penomoran
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
  v_bab_no      INT  := 13;
  v_title_re    TEXT := '(te.?form|progresif|aplikasi|ています)';
  v_slug1       TEXT := 'tugas-bunpou-bab-13-progresif-permintaan';
  v_slug2       TEXT := 'tugas-bunpou-bab-13-izin-larangan';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson1_id   UUID;
  v_lesson2_id   UUID;
  v_other_count  INT;
  v_pos1         INT;
  v_pos2         INT;
  v_g_teimasu  UUID; -- 〜ています
  v_g_kudasai  UUID; -- 〜てください
  v_g_kuremasenka UUID; -- 〜てくれませんか
  v_g_iidesuka UUID; -- 〜てもいいですか
  v_g_ikemasen UUID; -- 〜てはいけません
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET (v_bab_no - 1) LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '090: modul Bab % di kursus % tidak ditemukan — skip seed tugas bunpou.', v_bab_no, v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* v_title_re THEN
    RAISE NOTICE '090: modul Bab % terbaca "%" — kalau ternyata bukan bab yang dimaksud, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).',
      v_bab_no, v_module_title;
  END IF;

  RAISE NOTICE '090: seed 2 Tugas Bunpou Bab % ke modul "%".', v_bab_no, v_module_title;

  -- ===== Bank module_grammar: find-or-create per pola (persis 082) =====

  SELECT id INTO v_g_teimasu FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜ています';
  IF v_g_teimasu IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜ています', 'sedang / kondisi / kebiasaan / profesi', 'いま ごはんを たべています。',
      'Bentuk te + います punya empat fungsi: (1) aksi yang SEDANG berlangsung (いま〜ています), (2) KONDISI hasil aksi yang masih bertahan (けっこんしています＝sudah menikah), (3) KEBIASAAN yang diulang (まいあさ〜ています), (4) PROFESI (ぎんこうで はたらいています). Konteks kalimat yang menentukan artinya.'
    ) RETURNING id INTO v_g_teimasu;
  END IF;

  SELECT id INTO v_g_kudasai FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜てください';
  IF v_g_kudasai IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜てください', 'tolong lakukan ~ (permintaan sopan)', 'ここに 名前を かいてください。',
      'Bentuk te + ください = permintaan atau instruksi yang sopan. Dipakai guru ke murid, petugas ke tamu, atau saat menolong orang. Untuk permintaan yang lebih halus ke orang yang lebih tinggi, pakai 〜てくれませんか.'
    ) RETURNING id INTO v_g_kudasai;
  END IF;

  SELECT id INTO v_g_kuremasenka FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜てくれませんか';
  IF v_g_kuremasenka IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜てくれませんか', 'bisa tolong ~? (permintaan halus)', 'ちょっと まってくれませんか。',
      'Lebih halus daripada 〜てください karena berbentuk pertanyaan negatif — penutur MENANYAKAN kesediaan lawan bicara, bukan menyuruh. Versi lebih sopan lagi: 〜てくださいませんか.'
    ) RETURNING id INTO v_g_kuremasenka;
  END IF;

  SELECT id INTO v_g_iidesuka FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜てもいいですか';
  IF v_g_iidesuka IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜てもいいですか', 'boleh ~? (meminta izin)', 'ここで たべてもいいですか。',
      'Bentuk te + もいいですか untuk MEMINTA izin. Jawaban mengizinkan: はい、いいですよ／どうぞ. Jawaban menolak jarang langsung "tidak boleh", biasanya すみません、ちょっと…. Tanpa か (〜てもいいです) artinya MEMBERI izin.'
    ) RETURNING id INTO v_g_iidesuka;
  END IF;

  SELECT id INTO v_g_ikemasen FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜てはいけません';
  IF v_g_ikemasen IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜てはいけません', 'tidak boleh ~ (larangan)', 'ここで たばこを すってはいけません。',
      'Larangan tegas — dipakai untuk aturan sekolah, rumah sakit, dan tempat umum. Kebalikan dari 〜てもいいです. Bentuk kasualnya 〜ちゃだめ. Untuk larangan yang lebih lembut, pakai 〜ないでください (Bab 14).'
    ) RETURNING id INTO v_g_ikemasen;
  END IF;

  IF v_g_teimasu IS NULL OR v_g_kudasai IS NULL OR v_g_kuremasenka IS NULL
     OR v_g_iidesuka IS NULL OR v_g_ikemasen IS NULL THEN
    RAISE EXCEPTION '090: gagal resolve salah satu dari 5 pola grammar Bab 13';
  END IF;

  -- ===== Dua lesson grammar_task (upsert) =====

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, cooldown_hours
  ) VALUES (
    v_module_id, v_slug1, 'Tugas Bunpou Bab 13: Progresif & Permintaan', 'grammar_task',
    'Buat kalimat pakai 3 pola Bab 13 (menyatakan aksi sedang berlangsung/kondisi/kebiasaan/profesi dengan 〜ています, meminta tolong dengan sopan lewat 〜てください, dan meminta tolong lebih halus lewat 〜てくれませんか), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
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
    v_module_id, v_slug2, 'Tugas Bunpou Bab 13: Izin & Larangan', 'grammar_task',
    'Buat kalimat pakai 2 pola Bab 13 (meminta izin dengan 〜てもいいですか, dan menyatakan larangan tegas dengan 〜てはいけません), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
    15, 101, 70, 12
  )
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title, type = EXCLUDED.type, content = EXCLUDED.content,
    duration_minutes = EXCLUDED.duration_minutes, updated_at = NOW()
  RETURNING id INTO v_lesson2_id;

  -- ===== Wiring pola ke tiap tugas =====

  DELETE FROM lesson_grammar_task_items WHERE lesson_id IN (v_lesson1_id, v_lesson2_id);

  INSERT INTO lesson_grammar_task_items (lesson_id, grammar_id, sort_order, instruction, required_count) VALUES
    (v_lesson1_id, v_g_teimasu,      1, 'Buat satu kalimat memakai pola 〜ています untuk menyatakan aksi yang sedang berlangsung, kondisi, kebiasaan, atau profesi.', 1),
    (v_lesson1_id, v_g_kudasai,      2, 'Buat satu kalimat memakai pola 〜てください untuk meminta atau menyuruh sesuatu dengan sopan.', 1),
    (v_lesson1_id, v_g_kuremasenka,  3, 'Buat satu kalimat memakai pola 〜てくれませんか untuk meminta tolong dengan lebih halus.', 1),
    (v_lesson2_id, v_g_iidesuka,     1, 'Buat satu kalimat memakai pola 〜てもいいですか untuk meminta izin melakukan sesuatu.', 1),
    (v_lesson2_id, v_g_ikemasen,     2, 'Buat satu kalimat memakai pola 〜てはいけません untuk menyatakan sesuatu tidak boleh dilakukan.', 1);

  -- ===== Penomoran ulang supaya tugas jatuh di urutan 5 dan 7 =====

  SELECT COUNT(*) INTO v_other_count
    FROM lessons
   WHERE module_id = v_module_id AND id <> v_lesson1_id AND id <> v_lesson2_id;

  IF v_other_count < 5 THEN
    RAISE NOTICE '090: modul "%" cuma punya % lesson lain (< 5) — urutan 5 dan 7 tidak bisa dibentuk, kedua tugas ditaruh di akhir modul. Geser manual lewat admin kalau perlu.',
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
     OR (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson2_id) <> 2 THEN
    RAISE EXCEPTION '090: Tugas 1 harus punya tepat 3 pola dan Tugas 2 tepat 2 pola (dapat % dan %)',
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson1_id),
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson2_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM lesson_grammar_task_items
     WHERE lesson_id IN (v_lesson1_id, v_lesson2_id)
       AND (instruction IS NULL OR required_count <> 1)
  ) THEN
    RAISE EXCEPTION '090: ada wiring tanpa instruction atau required_count bukan 1';
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
      RAISE EXCEPTION '090: posisi final tugas bukan 5 dan 7 (dapat % dan %)', v_pos1, v_pos2;
    END IF;

    IF EXISTS (
      SELECT sort_order FROM lessons WHERE module_id = v_module_id
       GROUP BY sort_order HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION '090: ada sort_order kembar di modul setelah penomoran ulang';
    END IF;

    RAISE NOTICE '090: selesai — Tugas Progresif & Permintaan di urutan %, Tugas Izin & Larangan di urutan % (5 kalimat wajib total).', v_pos1, v_pos2;
  ELSE
    RAISE NOTICE '090: selesai — 2 tugas ter-wire (5 kalimat wajib total), posisi menyusul diatur manual.';
  END IF;
END $$;
