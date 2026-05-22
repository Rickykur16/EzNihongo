-- seed-n5-lessons.sql
-- Kerangka (skeleton) lesson untuk 20 Bab N5, sesuai konvensi "Struktur baku 1 Bab"
-- di CLAUDE.md (model bookend + siklus interleaving):
--   Pengantar (Intro Video)
--   └ siklus per sub-topik (ulang sebanyak ceil(grammar_count / 2)):
--       Kosakata N (deck) → Kanji N (kanji, kalau Bab punya kanji)
--       → Tata Bahasa N (text, 2 pola) → Speaking Test AI N (placeholder)
--   Assignment / Kuis (quiz) — selalu terakhir
--
-- Jumlah siklus & ada/tidaknya kanji diturunkan dari data Notion (📗 Bab):
--   cycles = ceil("Grammar Count (Target)" / 2); has_kanji = jumlah "Kanji First Introduced" > 0.
--   B1/B2 (Hiragana/Katakana) = Bab kana: tanpa siklus grammar, cuma Pengantar + Kosakata + Kuis.
--
-- CATATAN slug modul: ASUMSI slug = n5-b1 .. n5-b20 (lowercase "Kode Bab" Notion).
--   Kalau slug modul di dashboard beda, ganti kolom 'slug' di blok VALUES bawah.
--   Modul yang slug-nya tidak ketemu akan di-SKIP (RAISE NOTICE), bukan error.
--
-- Idempotent: ON CONFLICT (module_id, slug) DO NOTHING — aman dijalankan ulang,
--   tidak menimpa lesson yang sudah diedit admin. Lesson ini HANYA kerangka kosong;
--   isi konten (vocab/kanji/grammar/quiz, judul pola Bunpou) dikerjakan terpisah per Bab.
--
-- Jalankan: psql "$DATABASE_URL" -f backend/seed-n5-lessons.sql

DO $$
DECLARE
  v_course uuid;
  v_module uuid;
  rec record;
  i int;
  so int;
BEGIN
  SELECT id INTO v_course FROM courses WHERE slug = 'n5';
  IF v_course IS NULL THEN
    RAISE NOTICE 'Course n5 tidak ditemukan — batal.';
    RETURN;
  END IF;

  FOR rec IN
    SELECT * FROM (VALUES
      ('n5-b1',  0, false),
      ('n5-b2',  0, false),
      ('n5-b3',  3, true),
      ('n5-b4',  3, true),
      ('n5-b5',  2, true),
      ('n5-b6',  3, true),
      ('n5-b7',  3, true),
      ('n5-b8',  2, true),
      ('n5-b9',  2, true),
      ('n5-b10', 3, true),
      ('n5-b11', 2, true),
      ('n5-b12', 3, true),
      ('n5-b13', 3, false),
      ('n5-b14', 4, true),
      ('n5-b15', 3, true),
      ('n5-b16', 2, true),
      ('n5-b17', 2, true),
      ('n5-b18', 2, true),
      ('n5-b19', 3, true),
      ('n5-b20', 3, true)
    ) AS t(slug, cycles, has_kanji)
  LOOP
    SELECT id INTO v_module FROM modules WHERE course_id = v_course AND slug = rec.slug;
    IF v_module IS NULL THEN
      RAISE NOTICE 'Modul % tidak ditemukan — skip.', rec.slug;
      CONTINUE;
    END IF;

    so := 0;

    -- Pengantar (Intro Video). Lesson pertama bertipe video supaya Module Intro Panel render.
    so := so + 1;
    INSERT INTO lessons (module_id, slug, title, type, sort_order)
    VALUES (v_module, rec.slug || '-intro', 'Pengantar', 'video', so)
    ON CONFLICT (module_id, slug) DO NOTHING;

    IF rec.cycles = 0 THEN
      -- Bab kana (B1/B2): Kosakata (deck kana) saja, tanpa siklus grammar.
      so := so + 1;
      INSERT INTO lessons (module_id, slug, title, type, sort_order)
      VALUES (v_module, rec.slug || '-kosakata', 'Kosakata', 'deck', so)
      ON CONFLICT (module_id, slug) DO NOTHING;
    ELSE
      FOR i IN 1..rec.cycles LOOP
        -- Kosakata N
        so := so + 1;
        INSERT INTO lessons (module_id, slug, title, type, sort_order)
        VALUES (v_module, rec.slug || '-kosakata-' || i, 'Kosakata ' || i, 'deck', so)
        ON CONFLICT (module_id, slug) DO NOTHING;

        -- Kanji N (hanya kalau Bab punya kanji)
        IF rec.has_kanji THEN
          so := so + 1;
          INSERT INTO lessons (module_id, slug, title, type, sort_order)
          VALUES (v_module, rec.slug || '-kanji-' || i, 'Kanji ' || i, 'kanji', so)
          ON CONFLICT (module_id, slug) DO NOTHING;
        END IF;

        -- Tata Bahasa N (2 pola; judul diganti jadi pola sebenarnya saat konten masuk)
        so := so + 1;
        INSERT INTO lessons (module_id, slug, title, type, sort_order)
        VALUES (v_module, rec.slug || '-bunpou-' || i, 'Tata Bahasa ' || i, 'text', so)
        ON CONFLICT (module_id, slug) DO NOTHING;

        -- Speaking Test AI N (placeholder; belum ada tipe lesson 'speaking')
        so := so + 1;
        INSERT INTO lessons (module_id, slug, title, type, sort_order, content)
        VALUES (v_module, rec.slug || '-speaking-' || i, 'Speaking Test AI ' || i, 'text', so,
                '<p>Speaking Test AI — segera hadir.</p>')
        ON CONFLICT (module_id, slug) DO NOTHING;
      END LOOP;
    END IF;

    -- Assignment / Kuis (selalu terakhir)
    so := so + 1;
    INSERT INTO lessons (module_id, slug, title, type, sort_order, passing_score_pct, cooldown_hours)
    VALUES (v_module, rec.slug || '-assignment', 'Assignment / Kuis', 'quiz', so, 70, 12)
    ON CONFLICT (module_id, slug) DO NOTHING;

    RAISE NOTICE 'Modul %: kerangka lesson dibuat (total sort_order=%).', rec.slug, so;
  END LOOP;
END $$;
