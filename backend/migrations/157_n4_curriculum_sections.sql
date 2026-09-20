-- Group the N4 chapters from 155/156 in the existing section accordion.
-- Preserve section names already assigned by an editor.
DO $$
DECLARE
  v_course UUID;
  v_chapter INT;
  v_module UUID;
  v_section TEXT;
BEGIN
  SELECT id INTO v_course FROM courses WHERE slug = 'n4';
  IF v_course IS NULL THEN
    RAISE EXCEPTION '157: course n4 is required; apply migrations 155 and 156 first';
  END IF;

  FOR v_chapter IN 1..24 LOOP
    SELECT id INTO STRICT v_module FROM modules
     WHERE course_id = v_course
       AND slug LIKE 'n4-b' || lpad(v_chapter::text, 2, '0') || '-%';

    v_section := CASE
      WHEN v_chapter <= 4 THEN 'Penjelasan, Waktu & Kemampuan'
      WHEN v_chapter <= 9 THEN 'Tindakan, Keadaan & Perubahan'
      WHEN v_chapter <= 14 THEN 'Alasan, Dugaan & Pengandaian'
      WHEN v_chapter <= 18 THEN 'Tujuan, Instruksi & Interaksi'
      WHEN v_chapter <= 20 THEN 'Informasi, Perbandingan & Kondisi'
      WHEN v_chapter <= 22 THEN 'Pasif & Kausatif'
      ELSE 'Bahasa Hormat & Merendah'
    END;

    UPDATE modules SET section_name = v_section, updated_at = NOW()
     WHERE id = v_module AND nullif(btrim(section_name), '') IS NULL;
  END LOOP;

  RAISE NOTICE '157: section grouping completed for 24 N4 chapters; existing editor labels preserved';
END $$;
