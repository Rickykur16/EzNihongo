-- 092_grammar_task_bab15.sql — Dua Tugas Bunpou Bab 15: Bahasa Pelayanan,
-- Memutuskan & Perubahan.
--
-- Melanjutkan pola tugas bunpou Bab 3-14 (043/046/048/052/054/056/058/060/
-- 062/065/090/091). Mengisi slot sort_order 5 dan 7 yang sengaja disisakan
-- kosong oleh 084_bunpou_bab15.sql (materi Tata Bahasa Bab 15 di sort_order
-- 4 dan 6) — lihat file itu untuk konteks lengkap kurikulum Bab 15.
--
-- 6 pola grammar Bab 15, dibagi 4+2 (SAMA PERSIS split pelajaran Tata
-- Bahasa di 084):
--   Tugas 1 — Bahasa Pelayanan (urutan 5, 4 pola): 〜を[counter]お願いします
--     (memesan/meminta), 〜はいかがですか (menawarkan sopan), 〜になります
--     (keigo — menyebut total/hasil), お〜ください (mempersilakan hormat).
--   Tugas 2 — Memutuskan & Perubahan (urutan 7, 2 pola): 〜にします
--     (memutuskan pilihan), 〜くなります／〜になります (perubahan keadaan).
-- required_count = 1 per pola, konsisten dengan tugas bunpou Bab 3-14.
--
-- Bank module_grammar FIND-OR-CREATE per pola dengan pattern string PERSIS
-- SAMA dengan 084_bunpou_bab15.sql (find akan selalu hit karena 084 sudah
-- membuat baris ini; INSERT fallback isinya disalin identik dari 084 kalau
-- baris itu ternyata sudah terhapus).
--
-- POSISI: pola penomoran ulang berbasis ROW_NUMBER (bukan sort_order
-- literal) yang sama seperti 090/091, aman dijalankan apa pun kondisi
-- sort_order modul saat ini:
--     lesson lama ke-1..4  → sort_order 1..4
--     Tugas 1 (Bahasa Pelayanan) → sort_order 5
--     lesson lama ke-5     → sort_order 6
--     Tugas 2 (Memutuskan & Perubahan) → sort_order 7
--     lesson lama ke-6..n  → sort_order 8..n+2
-- Fallback aman: kalau modul Bab 15 punya < 5 lesson lain, penomoran
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
  v_bab_no      INT  := 15;
  v_title_re    TEXT := '(pelayanan|komunikasi|service)';
  v_slug1       TEXT := 'tugas-bunpou-bab-15-bahasa-pelayanan';
  v_slug2       TEXT := 'tugas-bunpou-bab-15-memutuskan-perubahan';
  v_module_id    UUID;
  v_module_title TEXT;
  v_lesson1_id   UUID;
  v_lesson2_id   UUID;
  v_other_count  INT;
  v_pos1         INT;
  v_pos2         INT;
  v_g_onegai   UUID; -- 〜を[counter]お願いします
  v_g_ikaga    UUID; -- 〜はいかがですか
  v_g_narimasu UUID; -- 〜になります (keigo)
  v_g_okudasai UUID; -- お〜ください
  v_g_nishimasu UUID; -- 〜にします
  v_g_kunarimasu UUID; -- 〜くなります／〜になります
BEGIN
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET (v_bab_no - 1) LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE '092: modul Bab % di kursus % tidak ditemukan — skip seed tugas bunpou.', v_bab_no, v_course_slug;
    RETURN;
  END IF;

  IF v_module_title !~* v_title_re THEN
    RAISE NOTICE '092: modul Bab % terbaca "%" — kalau ternyata bukan bab yang dimaksud, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).',
      v_bab_no, v_module_title;
  END IF;

  RAISE NOTICE '092: seed 2 Tugas Bunpou Bab % ke modul "%".', v_bab_no, v_module_title;

  -- ===== Bank module_grammar: find-or-create per pola (persis 084) =====

  SELECT id INTO v_g_onegai FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜を[counter]お願いします';
  IF v_g_onegai IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜を[counter]お願いします', 'memesan / meminta sesuatu dengan sopan', 'コーヒーを 二つ おねがいします。',
      'Pola standar saat memesan di restoran, toko, atau meminta layanan. Urutan: [benda]を [jumlah + kata bantu bilangan] おねがいします. Boleh juga tanpa jumlah: [benda]を おねがいします.'
    ) RETURNING id INTO v_g_onegai;
  END IF;

  SELECT id INTO v_g_ikaga FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜はいかがですか';
  IF v_g_ikaga IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜はいかがですか', 'bagaimana dengan ~ (menawarkan dengan sopan)', 'コーヒーは いかがですか。',
      'Versi sopan dari 〜はどうですか, dipakai pelayan atau tuan rumah untuk MENAWARKAN. Menerima tawaran: はい、おねがいします. Menolak dengan sopan: いいえ、けっこうです.'
    ) RETURNING id INTO v_g_ikaga;
  END IF;

  SELECT id INTO v_g_narimasu FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜になります (keigo)';
  IF v_g_narimasu IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜になります (keigo)', 'jadinya ~ / totalnya ~ (bahasa pelayanan)', '千円に なります。',
      'Dipakai petugas toko atau restoran untuk menyebut total harga dan hasil. Secara harfiah berarti "menjadi", tapi fungsinya menghaluskan pernyataan です. Jangan dipakai saat kamu berada di posisi pelanggan.'
    ) RETURNING id INTO v_g_narimasu;
  END IF;

  SELECT id INTO v_g_okudasai FROM module_grammar
   WHERE module_id = v_module_id AND pattern = 'お〜ください';
  IF v_g_okudasai IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, 'お〜ください', 'silakan ~ (bentuk hormat)', 'しょうしょう おまちください。',
      'Bentuk hormat: お + [batang kata kerja bentuk ます] + ください. Dipakai petugas kepada tamu. Untuk kata kerja する, polanya ご + [kata benda] + ください (ごりようください).'
    ) RETURNING id INTO v_g_okudasai;
  END IF;

  SELECT id INTO v_g_nishimasu FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜にします';
  IF v_g_nishimasu IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜にします', 'memutuskan memilih ~', 'わたしは コーヒーに します。',
      'Menyatakan PILIHAN saat memesan atau memutuskan sesuatu. Beda dari 〜になります yang menyatakan perubahan yang terjadi dengan sendirinya — 〜にします adalah keputusan yang diambil orangnya.'
    ) RETURNING id INTO v_g_nishimasu;
  END IF;

  SELECT id INTO v_g_kunarimasu FROM module_grammar
   WHERE module_id = v_module_id AND pattern = '〜くなります／〜になります';
  IF v_g_kunarimasu IS NULL THEN
    INSERT INTO module_grammar (module_id, pattern, meaning, example, notes)
    VALUES (
      v_module_id, '〜くなります／〜になります', 'menjadi ~ (perubahan keadaan)', 'さむく なりました。',
      'Menyatakan PERUBAHAN. Kata sifat い: buang い ganti く + なります (たかい→たかくなります). Kata sifat な dan kata benda: + に + なります (しずかになります／学生になります). Bentuk lampau なりました berarti "sudah menjadi".'
    ) RETURNING id INTO v_g_kunarimasu;
  END IF;

  IF v_g_onegai IS NULL OR v_g_ikaga IS NULL OR v_g_narimasu IS NULL
     OR v_g_okudasai IS NULL OR v_g_nishimasu IS NULL OR v_g_kunarimasu IS NULL THEN
    RAISE EXCEPTION '092: gagal resolve salah satu dari 6 pola grammar Bab 15';
  END IF;

  -- ===== Dua lesson grammar_task (upsert) =====

  INSERT INTO lessons (
    module_id, slug, title, type, content, duration_minutes, sort_order,
    passing_score_pct, cooldown_hours
  ) VALUES (
    v_module_id, v_slug1, 'Tugas Bunpou Bab 15 — Bahasa Pelayanan', 'grammar_task',
    'Buat kalimat pakai 4 pola Bab 15 (memesan/meminta dengan 〜を[counter]お願いします, menawarkan dengan 〜はいかがですか, menyebut total/hasil ala petugas dengan 〜になります, dan mempersilakan dengan hormat lewat お〜ください), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
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
    v_module_id, v_slug2, 'Tugas Bunpou Bab 15 — Memutuskan & Perubahan', 'grammar_task',
    'Buat kalimat pakai 2 pola Bab 15 (menyatakan pilihan yang diambil dengan 〜にします, dan menyatakan perubahan keadaan dengan 〜くなります atau 〜になります), lalu ucapkan. Kalimatmu direkam dan dinilai otomatis — selesaikan semua kalimat yang diminta tiap pola untuk menandai tugas ini selesai.',
    15, 101, 70, 12
  )
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title, type = EXCLUDED.type, content = EXCLUDED.content,
    duration_minutes = EXCLUDED.duration_minutes, updated_at = NOW()
  RETURNING id INTO v_lesson2_id;

  -- ===== Wiring pola ke tiap tugas =====

  DELETE FROM lesson_grammar_task_items WHERE lesson_id IN (v_lesson1_id, v_lesson2_id);

  INSERT INTO lesson_grammar_task_items (lesson_id, grammar_id, sort_order, instruction, required_count) VALUES
    (v_lesson1_id, v_g_onegai,     1, 'Buat satu kalimat memakai pola 〜を[counter]お願いします untuk memesan atau meminta sesuatu dengan sopan.', 1),
    (v_lesson1_id, v_g_ikaga,      2, 'Buat satu kalimat memakai pola 〜はいかがですか untuk menawarkan sesuatu dengan sopan.', 1),
    (v_lesson1_id, v_g_narimasu,   3, 'Buat satu kalimat memakai pola 〜になります (gaya bahasa pelayanan) untuk menyebut total atau hasil.', 1),
    (v_lesson1_id, v_g_okudasai,   4, 'Buat satu kalimat memakai pola お〜ください untuk mempersilakan seseorang dengan hormat.', 1),
    (v_lesson2_id, v_g_nishimasu,  1, 'Buat satu kalimat memakai pola 〜にします untuk menyatakan pilihan yang kamu ambil.', 1),
    (v_lesson2_id, v_g_kunarimasu, 2, 'Buat satu kalimat memakai pola 〜くなります atau 〜になります untuk menyatakan perubahan keadaan.', 1);

  -- ===== Penomoran ulang supaya tugas jatuh di urutan 5 dan 7 =====

  SELECT COUNT(*) INTO v_other_count
    FROM lessons
   WHERE module_id = v_module_id AND id <> v_lesson1_id AND id <> v_lesson2_id;

  IF v_other_count < 5 THEN
    RAISE NOTICE '092: modul "%" cuma punya % lesson lain (< 5) — urutan 5 dan 7 tidak bisa dibentuk, kedua tugas ditaruh di akhir modul. Geser manual lewat admin kalau perlu.',
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
     OR (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson2_id) <> 2 THEN
    RAISE EXCEPTION '092: Tugas 1 harus punya tepat 4 pola dan Tugas 2 tepat 2 pola (dapat % dan %)',
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson1_id),
      (SELECT COUNT(*) FROM lesson_grammar_task_items WHERE lesson_id = v_lesson2_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM lesson_grammar_task_items
     WHERE lesson_id IN (v_lesson1_id, v_lesson2_id)
       AND (instruction IS NULL OR required_count <> 1)
  ) THEN
    RAISE EXCEPTION '092: ada wiring tanpa instruction atau required_count bukan 1';
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
      RAISE EXCEPTION '092: posisi final tugas bukan 5 dan 7 (dapat % dan %)', v_pos1, v_pos2;
    END IF;

    IF EXISTS (
      SELECT sort_order FROM lessons WHERE module_id = v_module_id
       GROUP BY sort_order HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION '092: ada sort_order kembar di modul setelah penomoran ulang';
    END IF;

    RAISE NOTICE '092: selesai — Tugas Bahasa Pelayanan di urutan %, Tugas Memutuskan & Perubahan di urutan % (6 kalimat wajib total).', v_pos1, v_pos2;
  ELSE
    RAISE NOTICE '092: selesai — 2 tugas ter-wire (6 kalimat wajib total), posisi menyusul diatur manual.';
  END IF;
END $$;
