-- 050_diagnose_kanji_items_v2.sql — Diagnostic dump kanji_items (READ-ONLY,
-- ZERO WRITES). Semua output lewat RAISE NOTICE saja.
--
-- Konteks: user melaporkan kanji yang sudah di-import dari Notion ke materi
-- Bab 6 "hilang". Dugaan root cause (dari pembacaan kode
-- backend/src/routes/admin.js, endpoint import-notion-kanji-bab):
--   - CREATE UNIQUE INDEX kanji_items_character_level_uniq ON kanji_items
--     (character, jlpt_level) — TANPA lesson_id di scope-nya.
--   - Upsert import mencari existing row via
--     `SELECT id FROM kanji_items WHERE character = $1 AND jlpt_level = $2`
--     (global per level, BUKAN per lesson), lalu `UPDATE ... SET lesson_id
--     = $2` tanpa syarat — artinya meng-import karakter yang SAMA untuk Bab
--     LAIN akan diam-diam memindahkan (mencuri) kepemilikan lesson kanji
--     itu dari Bab asalnya.
--
-- Migrasi ini TIDAK memperbaiki apa pun — cuma mengonfirmasi/membantah teori
-- di atas terhadap data production sungguhan, karena tidak ada akses
-- DB/SSH langsung. `npm run migrate` di pipeline deploy (.github/workflows/
-- deploy.yml) jalan lewat SSH step yang outputnya masuk ke job log GitHub
-- Actions — jadi NOTICE di bawah ini bisa dibaca dari log itu.
--
-- Aman untuk production: tidak ada INSERT/UPDATE/DELETE/CREATE/ALTER sama
-- sekali, murni SELECT + RAISE NOTICE di dalam DO block. Tetap tercatat
-- sekali di schema_migrations seperti migrasi lain (runner tidak
-- membedakan "diagnostic" vs "schema change").
--
-- KENAPA DUPLIKAT DARI 049: 049 sudah jalan di production (deploy sukses,
-- "Applied 2 migration(s)."), TAPI isi RAISE NOTICE-nya tidak pernah nongol
-- di job log GitHub Actions — ternyata migrations/run.js pakai node-postgres
-- `Client` tanpa listener untuk event 'notice', jadi semua NOTICE (bukan
-- cuma dari 049 — SEMUA migrasi 039+ yang punya RAISE NOTICE status) selama
-- ini dibuang begitu saja oleh node-postgres, bukan diteruskan ke console.
-- run.js sudah ditambal (client.on('notice', ...) → console.log) di commit
-- yang sama dengan file ini. Karena 049 sudah tercatat applied dan runner
-- tidak akan menjalankannya ulang, migrasi bernomor baru ini menjalankan
-- query yang PERSIS SAMA supaya hasilnya benar-benar ter-capture kali ini.

DO $$
DECLARE
  r RECORD;
  v_course_id UUID;
  v_bab6_chars TEXT[] := ARRAY['高','安','新','古','長','白'];
  v_total INT;
  v_orphan INT;
  v_ch TEXT;
BEGIN
  SELECT id INTO v_course_id FROM courses WHERE slug = 'n5';
  IF v_course_id IS NULL THEN
    RAISE NOTICE '050: course n5 tidak ditemukan — skip diagnostic.';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_total FROM kanji_items WHERE jlpt_level = 'N5';
  SELECT COUNT(*) INTO v_orphan FROM kanji_items WHERE jlpt_level = 'N5' AND lesson_id IS NULL;
  RAISE NOTICE '050: total kanji_items N5 = %, orphan (lesson_id NULL) = %', v_total, v_orphan;

  RAISE NOTICE '050: ==== modul n5, urutan ordinal (Bab 1 = OFFSET 0, dst) ====';
  FOR r IN
    SELECT ROW_NUMBER() OVER (ORDER BY m.sort_order ASC, m.created_at ASC) AS bab_no,
           m.id, m.slug, m.title
      FROM modules m WHERE m.course_id = v_course_id
     ORDER BY m.sort_order ASC, m.created_at ASC
  LOOP
    RAISE NOTICE '050: Bab % -> module_id=% slug=% title=%', r.bab_no, r.id, r.slug, r.title;
  END LOOP;

  RAISE NOTICE '050: ==== 6 kanji resmi Bab 6 (高安新古長白) — status saat ini ====';
  FOREACH v_ch IN ARRAY v_bab6_chars LOOP
    IF NOT EXISTS (SELECT 1 FROM kanji_items WHERE character = v_ch AND jlpt_level = 'N5') THEN
      RAISE NOTICE '050: !! kanji % TIDAK ADA SAMA SEKALI di kanji_items (N5) !!', v_ch;
    END IF;
  END LOOP;

  FOR r IN
    SELECT ki.character, ki.jlpt_level, ki.lesson_id, ki.bab_kode, ki.sort_order,
           ki.updated_at, ki.created_at,
           l.slug AS lesson_slug, l.title AS lesson_title,
           m.slug AS module_slug, m.title AS module_title,
           (SELECT COUNT(*) FROM modules m2 WHERE m2.course_id = v_course_id
              AND (m2.sort_order, m2.created_at) <= (m.sort_order, m.created_at)) AS bab_no
      FROM kanji_items ki
      LEFT JOIN lessons l ON l.id = ki.lesson_id
      LEFT JOIN modules m ON m.id = l.module_id
     WHERE ki.character = ANY(v_bab6_chars) AND ki.jlpt_level = 'N5'
     ORDER BY ki.character
  LOOP
    RAISE NOTICE '050: kanji=% -> Bab % (module=%/%) lesson=%/% lesson_id=% bab_kode=% sort=% created_at=% updated_at=%',
      r.character, COALESCE(r.bab_no::TEXT, 'NULL'), r.module_slug, r.module_title,
      r.lesson_slug, r.lesson_title, r.lesson_id, r.bab_kode, r.sort_order,
      r.created_at, r.updated_at;
  END LOOP;

  RAISE NOTICE '050: ==== seluruh kanji_items N5, dikelompokkan per Bab aktual (ordinal modul) ====';
  FOR r IN
    SELECT (SELECT COUNT(*) FROM modules m2 WHERE m2.course_id = v_course_id
              AND (m2.sort_order, m2.created_at) <= (m.sort_order, m.created_at)) AS bab_no,
           m.slug AS module_slug, ki.character, ki.bab_kode, ki.lesson_id, ki.updated_at
      FROM kanji_items ki
      JOIN lessons l ON l.id = ki.lesson_id
      JOIN modules m ON m.id = l.module_id
     WHERE ki.jlpt_level = 'N5' AND m.course_id = v_course_id
     ORDER BY bab_no, ki.sort_order, ki.character
  LOOP
    RAISE NOTICE '050: Bab % (%) kanji=% bab_kode=% lesson_id=% updated_at=%',
      r.bab_no, r.module_slug, r.character, r.bab_kode, r.lesson_id, r.updated_at;
  END LOOP;

  RAISE NOTICE '050: ==== bab_kode yang kanji-nya SEKARANG tersebar di > 1 modul (indikasi tercuri) ====';
  FOR r IN
    SELECT ki.bab_kode, COUNT(DISTINCT m.id) AS n_modul,
           STRING_AGG(DISTINCT m.slug, ', ') AS moduls,
           STRING_AGG(ki.character || '@' || m.slug, ', ' ORDER BY ki.character) AS detail
      FROM kanji_items ki
      JOIN lessons l ON l.id = ki.lesson_id
      JOIN modules m ON m.id = l.module_id
     WHERE ki.jlpt_level = 'N5' AND m.course_id = v_course_id
       AND ki.bab_kode IS NOT NULL
     GROUP BY ki.bab_kode
    HAVING COUNT(DISTINCT m.id) > 1
     ORDER BY ki.bab_kode
  LOOP
    RAISE NOTICE '050: !! bab_kode=% tersebar di % modul (%) — detail: %',
      r.bab_kode, r.n_modul, r.moduls, r.detail;
  END LOOP;

  RAISE NOTICE '050: selesai — diagnostic read-only, tidak ada perubahan data.';
END $$;
