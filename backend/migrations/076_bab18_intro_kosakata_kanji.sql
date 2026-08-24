-- 076_bab18_intro_kosakata_kanji.sql — Struktur dasar Bab 18
-- (Perbandingan): Pelajaran 1 Pengantar (video), Pelajaran 2
-- Kosakata 語彙 (deck), Pelajaran 3 Kanji 漢字 (kanji).
--
-- Kembaran migration 061 (Bab 12) — lihat file itu untuk penjelasan lengkap
-- pola resolusi modul, semantik upsert, dan alasan konten di-hardcode dari
-- Notion. Ringkasnya:
--   * modul di-resolve ordinal (OFFSET 17, sama seperti 039-065); judul yang
--     tidak cocok cuma memicu NOTICE, bukan skip. Kalau ordinalnya memang
--     tidak ada → cari by judul → baru dibuat, lengkap dengan metadata
--     kurikulum (CEFR / JF topic / skenario / can-do) yang cuma diisi kalau
--     masih kosong;
--   * tiga pelajaran menempati sort_order 1/2/3, pelajaran lain di modul
--     yang sama digeser ke 4..n dengan urutan relatif tetap;
--   * kosakata: deck dibuat KOSONG — isi lewat Kelola Deck → "↻ Import
--     Bab dari Notion" (N5-B18, 24 kata di Notion);
--   * kanji: 4 karakter baru (大・小・多・少);
--   * kanji di-scope per pelajaran (character + jlpt_level + lesson_id,
--     sesuai migration 064) — baris kanji milik Bab lain tidak diambil alih;
--   * video_url dibiarkan NULL (admin isi URL Bunny Stream lewat form);
--     duration_minutes estimasi awal 10/30/20 menit, tidak menimpa nilai
--     yang sudah ada.
--
-- Idempotent: aman di-run ulang, aman kalau kursus n5 belum ada.

DO $$
DECLARE
  v_course_slug   TEXT := 'n5';
  v_bab_no        INT  := 18;
  v_kode          TEXT := 'N5-B18';
  v_mod_slug      TEXT := 'perbandingan';
  v_mod_title     TEXT := 'Perbandingan';
  v_mod_title_en  TEXT := 'Comparison';
  v_mod_cefr      TEXT := 'A2';
  v_mod_topic     TEXT := 'Daily Life';
  v_mod_scenario  TEXT := 'Membandingkan pilihan dan memberi rekomendasi: harga, kualitas, ukuran.';
  v_mod_cando     JSONB := '["Membandingkan dua atau lebih hal", "Memberi rekomendasi dengan alasan", "Menyatakan preferensi dan memilih"]'::jsonb;
  -- Dua regex: yang longgar cuma memverifikasi modul hasil ordinal, yang
  -- ketat dipakai saat mencari modul by judul (biar tidak nyasar ke bab
  -- lain yang judulnya mirip).
  v_title_re      TEXT := '(perbandingan|banding)';
  v_title_strict  TEXT := '(perbandingan|banding)';
  v_course_id     UUID;
  v_module_id     UUID;
  v_module_title  TEXT;
  v_l_intro       UUID;
  v_l_kosakata    UUID;
  v_l_kanji       UUID;
  v_n_vocab       INT;
  v_n_kanji       INT;
BEGIN
  SELECT id INTO v_course_id FROM courses WHERE slug = v_course_slug;
  IF v_course_id IS NULL THEN
    RAISE NOTICE '076: kursus % tidak ditemukan — skip Bab %.', v_course_slug, v_bab_no;
    RETURN;
  END IF;

  -- === 1. Modul ===========================================================
  SELECT m.id, m.title INTO v_module_id, v_module_title
    FROM modules m
   WHERE m.course_id = v_course_id
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET (v_bab_no - 1) LIMIT 1;

  -- Judul modul di produksi tidak selalu sama dengan judul Notion (mis.
  -- "BAB 12: Bentuk Te : Konjugasi & Permintaan"), jadi ketidakcocokan judul
  -- cuma jadi PERINGATAN — ordinal tetap dipercaya, sama seperti migrasi
  -- 039-065. Modul baru hanya dibuat kalau ordinalnya memang tidak ada.
  IF v_module_id IS NOT NULL AND v_module_title !~* v_title_re THEN
    RAISE NOTICE '076: modul Bab % terbaca "%" — kalau ternyata bukan bab yang dimaksud, pindahkan pelajarannya lewat admin (tidak perlu migrasi baru).',
      v_bab_no, v_module_title;
  END IF;

  IF v_module_id IS NULL THEN
    SELECT m.id, m.title INTO v_module_id, v_module_title
      FROM modules m
     WHERE m.course_id = v_course_id
       AND (m.title ~* v_title_strict OR m.slug = v_mod_slug)
     ORDER BY m.sort_order ASC, m.created_at ASC
     LIMIT 1;
  END IF;

  IF v_module_id IS NULL THEN
    INSERT INTO modules (course_id, slug, title, description, sort_order,
                         title_en, cefr_level, jf_topic, scenario, cando_statements)
    VALUES (v_course_id, v_mod_slug, v_mod_title, v_mod_scenario, v_bab_no,
            v_mod_title_en, v_mod_cefr, v_mod_topic, v_mod_scenario, v_mod_cando)
    RETURNING id INTO v_module_id;
    RAISE NOTICE '076: modul Bab % belum ada — dibuat (slug %, sort_order %).',
      v_bab_no, v_mod_slug, v_bab_no;
  ELSE
    -- Modul sudah ada: lengkapi metadata yang masih kosong saja.
    UPDATE modules SET
      title_en         = COALESCE(NULLIF(title_en, ''), v_mod_title_en),
      cefr_level       = COALESCE(NULLIF(cefr_level, ''), v_mod_cefr),
      jf_topic         = COALESCE(NULLIF(jf_topic, ''), v_mod_topic),
      scenario         = COALESCE(NULLIF(scenario, ''), v_mod_scenario),
      cando_statements = CASE WHEN cando_statements = '[]'::jsonb THEN v_mod_cando ELSE cando_statements END,
      updated_at       = NOW()
    WHERE id = v_module_id;
    RAISE NOTICE '076: pakai modul "%" untuk Bab %.', v_module_title, v_bab_no;
  END IF;

  -- === 2. Tiga pelajaran ==================================================
  INSERT INTO lessons (module_id, slug, title, type, content, sort_order, duration_minutes)
  VALUES (v_module_id, 'pelajaran-1-pengantar', 'Pelajaran 1: Pengantar', 'video',
          $html$<p>Pengantar Bab 18 — Perbandingan. Tonton video pembuka, lalu lanjut ke Kosakata dan Kanji.</p>
<p><strong>Struktur bab:</strong> Pengantar → Kosakata → Kanji → Tata Bahasa → Latihan → Kuis.</p>$html$, 1, 10)
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title            = EXCLUDED.title,
    type             = EXCLUDED.type,
    content          = COALESCE(NULLIF(lessons.content, ''), EXCLUDED.content),
    duration_minutes = COALESCE(lessons.duration_minutes, EXCLUDED.duration_minutes),
    sort_order       = EXCLUDED.sort_order,
    updated_at       = NOW()
  RETURNING id INTO v_l_intro;

  INSERT INTO lessons (module_id, slug, title, type, sort_order, duration_minutes)
  VALUES (v_module_id, 'pelajaran-2-kosakata', 'Pelajaran 2: Kosakata 語彙', 'deck', 2, 30)
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title            = EXCLUDED.title,
    type             = EXCLUDED.type,
    duration_minutes = COALESCE(lessons.duration_minutes, EXCLUDED.duration_minutes),
    sort_order       = EXCLUDED.sort_order,
    updated_at       = NOW()
  RETURNING id INTO v_l_kosakata;

  INSERT INTO lessons (module_id, slug, title, type, sort_order, duration_minutes)
  VALUES (v_module_id, 'pelajaran-3-kanji', 'Pelajaran 3: Kanji 漢字', 'kanji', 3, 20)
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title            = EXCLUDED.title,
    type             = EXCLUDED.type,
    duration_minutes = COALESCE(lessons.duration_minutes, EXCLUDED.duration_minutes),
    sort_order       = EXCLUDED.sort_order,
    updated_at       = NOW()
  RETURNING id INTO v_l_kanji;

  -- Pelajaran lain di modul ini digeser ke 4..n, urutan relatifnya dijaga.
  WITH lain AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order ASC, created_at ASC) AS rn
      FROM lessons
     WHERE module_id = v_module_id
       AND id NOT IN (v_l_intro, v_l_kosakata, v_l_kanji)
  )
  UPDATE lessons l SET sort_order = lain.rn + 3, updated_at = NOW()
    FROM lain
   WHERE l.id = lain.id AND l.sort_order IS DISTINCT FROM lain.rn + 3;

  -- === 3. Kosakata (bank modul + deck) ====================================
  -- Daftar kosakata bab ini belum di-hardcode (kuota query Notion habis
  -- saat migrasi ini ditulis). Pelajaran deck-nya tetap dibuat supaya
  -- struktur bab konsisten; isinya satu klik: Kelola Deck → "↻ Import Bab
  -- dari Notion" → pilih N5-B18. Upsert tombol itu identik dengan
  -- yang dipakai migrasi 061-065, jadi hasilnya sama.
  SELECT COUNT(*) INTO v_n_vocab FROM lesson_deck_items WHERE lesson_id = v_l_kosakata;

  -- === 4. Kanji ===========================================================
  CREATE TEMP TABLE _b18_kanji (character TEXT, on_reading TEXT, kun_reading TEXT, meaning_id TEXT, stroke_count INT, mnemonic TEXT, ord INT) ON COMMIT DROP;
  INSERT INTO _b18_kanji VALUES
    ('大', 'ダイ、タイ', 'おお(きい)', 'besar', 3,
     'Piktogram orang yang merentangkan tangan dan kaki lebar-lebar untuk menunjukkan ukuran besar. Garis horizontal melintang di atas adalah lengan terbuka, dua garis bawah adalah kaki yang melangkah lebar.', 1),
    ('小', 'ショウ', 'ちい(さい)、こ', 'kecil', 3,
     NULL, 2),
    ('多', 'タ', 'おお(い)', 'banyak', 6,
     'Gabungan dua kanji 夕 (malam/sore) yang ditumpuk. Banyak malam yang menumpuk = waktu yang panjang dan jumlah yang berlipat = banyak.', 3),
    ('少', 'ショウ', 'すく(ない)、すこ(し)', 'sedikit', 4,
     NULL, 4);

  -- Scope per pelajaran, bukan per (character, jlpt_level): sejak migration
  -- 064 satu karakter boleh punya baris sendiri di tiap Bab, dan baris milik
  -- Bab lain TIDAK boleh diambil alih. Update-lalu-insert (bukan ON CONFLICT)
  -- supaya tidak terikat ke nama index tertentu.
  UPDATE kanji_items ki SET
    on_reading   = COALESCE(NULLIF(ki.on_reading, ''), k.on_reading),
    kun_reading  = COALESCE(NULLIF(ki.kun_reading, ''), k.kun_reading),
    meaning_id   = COALESCE(NULLIF(ki.meaning_id, ''), k.meaning_id),
    mnemonic     = COALESCE(NULLIF(ki.mnemonic, ''), k.mnemonic),
    stroke_count = COALESCE(ki.stroke_count, k.stroke_count),
    bab_kode     = COALESCE(NULLIF(ki.bab_kode, ''), v_kode),
    updated_at   = NOW()
  FROM _b18_kanji k
  WHERE ki.lesson_id = v_l_kanji AND ki.jlpt_level = 'N5' AND ki.character = k.character;

  INSERT INTO kanji_items (character, jlpt_level, on_reading, kun_reading, meaning_id, mnemonic, stroke_count, bab_kode, lesson_id, sort_order)
  SELECT k.character, 'N5', k.on_reading, k.kun_reading, k.meaning_id, k.mnemonic, k.stroke_count, v_kode, v_l_kanji, k.ord
    FROM _b18_kanji k
   WHERE NOT EXISTS (
     SELECT 1 FROM kanji_items ki
      WHERE ki.lesson_id = v_l_kanji AND ki.jlpt_level = 'N5' AND ki.character = k.character
   );

  SELECT COUNT(*) INTO v_n_kanji FROM kanji_items WHERE lesson_id = v_l_kanji;

  RAISE NOTICE '076: Bab % siap — Pengantar (video) + Kosakata (% kata) + Kanji (% karakter).',
    v_bab_no, v_n_vocab, v_n_kanji;
END $$;
