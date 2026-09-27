-- Approved chapter/sublesson labels only. No curriculum, media, assessment,
-- task requirements, slugs, IDs, ordering or learner progress is rewritten.
CREATE TABLE IF NOT EXISTS n5_title_backup_170 (
  entity TEXT NOT NULL,
  id UUID NOT NULL,
  before_title TEXT NOT NULL,
  after_title TEXT NOT NULL,
  PRIMARY KEY (entity, id)
);

DO $titles$
DECLARE
  chapter JSONB;
  target UUID;
  matches INT;
  plan JSONB := $plan$[
    {"bab":8,"slug":"bunpou1-n5-b8","title":"Keberadaan, Lokasi & Posisi"},
    {"bab":11,"slug":"bunpou1-n5-b11","title":"Jumlah & Kata Bantu Bilangan"},
    {"bab":12,"slug":"tata-bahasa-bab-12-konjugasi-te-form","title":"Bentuk Te: Konjugasi & Urutan Tindakan"},
    {"bab":13,"slug":"tata-bahasa-bab-13-progresif-permintaan","title":"Bentuk Te: Permintaan, Keadaan, Izin & Larangan"},
    {"bab":14,"slug":"tata-bahasa-bab-14-bentuk-nai-kewajiban","title":"Bentuk Biasa Kata Kerja & Kewajiban"},
    {"bab":15,"slug":"tata-bahasa-bab-15-bahasa-pelayanan","title":"Pelayanan, Pilihan & Perubahan"},
    {"bab":16,"slug":"tata-bahasa-bab-16-partikel-waktu-tanggal","title":"Waktu, Tanggal & Jadwal"},
    {"bab":17,"slug":"tata-bahasa-bab-17-suka-mahir","title":"Hobi & Kemampuan"},
    {"bab":20,"slug":"tata-bahasa-bab-20-pengalaman","title":"Pengalaman, Alasan & Penghubung Kalimat"}
  ]$plan$::jsonb;
BEGIN
  IF EXISTS (SELECT 1 FROM n5_title_backup_170) THEN
    RAISE NOTICE '170: already applied; preserving subsequent admin edits';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM courses WHERE slug = 'n5') THEN RETURN; END IF;

  FOR chapter IN SELECT value FROM jsonb_array_elements(plan) LOOP
    SELECT count(*), (array_agg(m.id))[1] INTO matches, target
      FROM modules m JOIN courses c ON c.id = m.course_id
      JOIN lessons l ON l.module_id = m.id
      WHERE c.slug = 'n5' AND l.slug = chapter->>'slug'
        AND m.title ~* ('^BAB\s*' || (chapter->>'bab') || '\s*[:：]');
    IF matches <> 1 THEN
      RAISE EXCEPTION '170: missing/ambiguous Bab %', chapter->>'bab';
    END IF;

    INSERT INTO n5_title_backup_170
      SELECT 'module', id, title, 'BAB ' || (chapter->>'bab') || ' : ' || (chapter->>'title')
      FROM modules WHERE id = target;

    -- Align the visible introduction and assignment labels too; their bodies
    -- and historical attempts remain untouched, as explicitly requested.
    INSERT INTO n5_title_backup_170
      SELECT 'lesson', id, title,
        CASE WHEN slug IN ('intro', 'pelajaran-1-pengantar') THEN 'Pengantar: '
          ELSE 'Assignment Bab ' || (chapter->>'bab') || ': ' END || (chapter->>'title')
      FROM lessons WHERE module_id = target AND
        (slug IN ('intro', 'pelajaran-1-pengantar') OR
         (type = 'quiz' AND slug LIKE 'assignment-bab-' || (chapter->>'bab') || '-%'));
    GET DIAGNOSTICS matches = ROW_COUNT;
    IF matches <> 2 THEN
      RAISE EXCEPTION '170: expected introduction and assignment for Bab %', chapter->>'bab';
    END IF;

    IF (chapter->>'bab')::INT = 17 THEN
      INSERT INTO n5_title_backup_170
        SELECT 'lesson', l.id, l.title, v.title
        FROM lessons l JOIN (VALUES
          ('tata-bahasa-bab-17-suka-mahir', 'Ulasan Kesukaan & Kemahiran (が好き／嫌い・が上手／下手)'),
          ('tata-bahasa-bab-17-kemampuan-bertanya-jenis', 'Kemampuan & Tanya Jenis (〜ができます・どんな〜)'),
          ('tugas-bunpou-bab-17-suka-mahir', 'Tugas Bunpou Bab 17: Ulasan Kesukaan & Kemahiran'),
          ('tugas-bunpou-bab-17-kemampuan-bertanya-jenis', 'Tugas Bunpou Bab 17: Kemampuan & Tanya Jenis')
        ) v(slug, title) ON v.slug = l.slug WHERE l.module_id = target;
      GET DIAGNOSTICS matches = ROW_COUNT;
      IF matches <> 4 THEN RAISE EXCEPTION '170: expected four Bab 17 bunpou lessons'; END IF;
    END IF;
  END LOOP;

  UPDATE modules m SET title = b.after_title, updated_at = NOW()
    FROM n5_title_backup_170 b WHERE b.entity = 'module' AND b.id = m.id;
  UPDATE lessons l SET title = b.after_title, updated_at = NOW()
    FROM n5_title_backup_170 b WHERE b.entity = 'lesson' AND b.id = l.id;
END;
$titles$;
