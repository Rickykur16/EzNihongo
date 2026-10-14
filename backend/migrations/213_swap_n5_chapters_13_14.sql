-- Exchange the two complete chapters without moving/recreating their content.
-- UUIDs and slugs are stable identities, not the current displayed chapter
-- number. Existing lesson links, progress, sessions and assessment snapshots
-- therefore continue to refer to exactly the same material.
CREATE TABLE IF NOT EXISTS n5_chapter_swap_backup_213 (
  entity TEXT NOT NULL,
  id UUID NOT NULL,
  before_data JSONB NOT NULL,
  after_data JSONB NOT NULL,
  PRIMARY KEY (entity, id)
);

DO $swap$
DECLARE
  course UUID;
  te_module modules%ROWTYPE;
  plain_module modules%ROWTYPE;
  next_order INTEGER;
  forms_section TEXT;
BEGIN
  SELECT id INTO course FROM courses WHERE slug = 'n5';
  IF course IS NULL THEN RETURN; END IF;
  -- Match the editor's topology/content lock order.
  PERFORM pg_advisory_xact_lock(hashtext('curriculum-boundary:graph'));
  PERFORM pg_advisory_xact_lock(hashtext('curriculum-boundary:' || course::text));
  IF EXISTS (SELECT 1 FROM n5_chapter_swap_backup_213
             WHERE entity = 'migration' AND id = course
               AND after_data->>'status' = 'applied') THEN
    RAISE NOTICE '213: already applied; preserving subsequent editor changes';
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM n5_chapter_swap_backup_213) THEN
    RAISE EXCEPTION '213: incomplete chapter swap backup';
  END IF;

  SELECT * INTO STRICT te_module FROM modules
    WHERE course_id = course AND slug = 'n5-b13' FOR UPDATE;
  SELECT * INTO STRICT plain_module FROM modules
    WHERE course_id = course AND slug = 'n5-b14' FOR UPDATE;
  IF te_module.sort_order IS DISTINCT FROM 13 OR plain_module.sort_order IS DISTINCT FROM 14
     OR te_module.title IS NULL OR te_module.title !~* '^BAB\s*13\s*[:：]'
     OR plain_module.title IS NULL OR plain_module.title !~* '^BAB\s*14\s*[:：]'
     OR (SELECT count(*) FROM modules WHERE course_id = course AND sort_order IN (13, 14)) <> 2 THEN
    RAISE EXCEPTION '213: expected original N5 chapters 13 and 14';
  END IF;

  -- Section boundaries keep their ordinal positions: 12/13 cover verb forms,
  -- while the new 14 joins the existing permission/prohibition/service section.
  forms_section := CASE
    WHEN te_module.section_name ~* '^(Section|Bagian)\s*6\s*[:：]'
      THEN 'Section 6 : Bentuk Kata Kerja'
    ELSE te_module.section_name END;

  INSERT INTO n5_chapter_swap_backup_213
    SELECT 'module', m.id, to_jsonb(m), '{}'::jsonb FROM modules m
    WHERE m.id IN (te_module.id, plain_module.id)
       OR (m.course_id = course AND m.slug = 'n5-b12'
           AND m.section_name IS NOT DISTINCT FROM te_module.section_name);
  INSERT INTO n5_chapter_swap_backup_213
    SELECT 'lesson', l.id, to_jsonb(l), '{}'::jsonb FROM lessons l
    WHERE l.module_id IN (te_module.id, plain_module.id);
  INSERT INTO n5_chapter_swap_backup_213
    SELECT 'kanji', k.id, to_jsonb(k), '{}'::jsonb FROM kanji_items k
    JOIN lessons l ON l.id = k.lesson_id
    WHERE l.module_id IN (te_module.id, plain_module.id);

  -- Also works with an immediate UNIQUE(course_id, sort_order) constraint.
  SELECT max(sort_order) + 1 INTO next_order FROM modules WHERE course_id = course;
  UPDATE modules SET sort_order = next_order WHERE id = te_module.id;
  UPDATE modules SET sort_order = 13,
    title = regexp_replace(title, '^BAB\s*14\s*[:：]', 'BAB 13 :', 'i'),
    section_name = forms_section, updated_at = NOW() WHERE id = plain_module.id;
  UPDATE modules SET sort_order = 14,
    title = regexp_replace(title, '^BAB\s*13\s*[:：]', 'BAB 14 :', 'i'),
    section_name = plain_module.section_name, updated_at = NOW() WHERE id = te_module.id;
  UPDATE modules SET section_name = forms_section, updated_at = NOW()
    WHERE course_id = course AND slug = 'n5-b12'
      AND section_name IS NOT DISTINCT FROM te_module.section_name
      AND section_name IS DISTINCT FROM forms_section;

  UPDATE lessons SET
    title = regexp_replace(title, '\mBab\s*13\M', 'Bab 14', 'gi'), updated_at = NOW()
    WHERE module_id = te_module.id AND title ~* '\mBab\s*13\M';
  UPDATE lessons SET
    title = regexp_replace(title, '\mBab\s*14\M', 'Bab 13', 'gi'), updated_at = NOW()
    WHERE module_id = plain_module.id AND title ~* '\mBab\s*14\M';
  UPDATE kanji_items k SET bab_kode = CASE l.module_id
      WHEN te_module.id THEN 'N5-B14' ELSE 'N5-B13' END
    FROM lessons l WHERE l.id = k.lesson_id
      AND ((l.module_id = te_module.id AND k.bab_kode = 'N5-B13')
        OR (l.module_id = plain_module.id AND k.bab_kode = 'N5-B14'));

  UPDATE n5_chapter_swap_backup_213 b SET after_data = to_jsonb(m)
    FROM modules m WHERE b.entity = 'module' AND b.id = m.id;
  UPDATE n5_chapter_swap_backup_213 b SET after_data = to_jsonb(l)
    FROM lessons l WHERE b.entity = 'lesson' AND b.id = l.id;
  UPDATE n5_chapter_swap_backup_213 b SET after_data = to_jsonb(k)
    FROM kanji_items k WHERE b.entity = 'kanji' AND b.id = k.id;
  INSERT INTO n5_chapter_swap_backup_213 VALUES
    ('migration', course, '{}'::jsonb, '{"status":"applied"}'::jsonb);
END;
$swap$;
