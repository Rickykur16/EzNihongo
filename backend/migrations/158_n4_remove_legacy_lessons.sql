-- Remove the legacy lessons observed in the N4 editor on 20 September 2026.
-- Keep the 190 lessons from 156, all 24 modules, kanji and vocabulary banks.
-- Snapshot affected rows, including transitive FK dependents, before deletion.
-- The archive is database-only; it is not exposed through the content API.
CREATE TABLE IF NOT EXISTS curriculum_cleanup_archive (
  cleanup_key TEXT NOT NULL,
  table_name TEXT NOT NULL,
  row_hash TEXT NOT NULL,
  row_data JSONB NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cleanup_key, table_name, row_hash)
);

DO $cleanup$
DECLARE
  v_course UUID;
  v_count INT;
  v_added INT;
  v_total_added INT;
  v_join TEXT;
  r RECORD;
BEGIN
  SELECT id INTO STRICT v_course FROM courses WHERE slug = 'n4';
  LOCK TABLE lessons, module_grammar IN SHARE ROW EXCLUSIVE MODE;

  CREATE TEMP TABLE _n4_legacy_lessons ON COMMIT DROP AS
    SELECT l.id FROM lessons l JOIN modules m ON m.id = l.module_id
     WHERE m.course_id = v_course
       AND m.slug ~ '^n4-b(0[1-9]|1[0-9]|2[0-2])-'
       AND (
         (l.slug = 'intro' AND l.type = 'text' AND l.title LIKE 'Intro — %') OR
         (l.slug = 'quiz' AND l.type = 'quiz' AND l.title LIKE 'Kuis — %') OR
         (l.slug LIKE 'vocab-%' AND l.type = 'text' AND l.title LIKE 'Kosakata — %') OR
         (l.slug LIKE 'grammar-%' AND l.type = 'text' AND l.title LIKE 'Grammar — %')
       );
  SELECT count(*) INTO v_count FROM _n4_legacy_lessons;
  IF v_count = 0 THEN
    RAISE NOTICE '158: no matching legacy N4 lessons; no deletion';
    RETURN;
  END IF;
  IF v_count <> 253 THEN
    RAISE EXCEPTION '158: expected the 253 reviewed legacy lessons, found %; review current curriculum', v_count;
  END IF;

  -- Require the replacement curriculum to be complete before removing anything.
  IF (SELECT count(*) FROM lessons l JOIN modules m ON m.id=l.module_id
       WHERE m.course_id=v_course AND (
         l.slug IN ('pelajaran-1-pengantar','pelajaran-2-kosakata','pelajaran-3-kanji',
                    'tata-bahasa-1','tugas-bunpou-1','tata-bahasa-2','tugas-bunpou-2')
         OR l.slug = 'assignment-bab-' || m.sort_order::text)) <> 190 THEN
    RAISE EXCEPTION '158: replacement N4 curriculum must contain 190 lessons';
  END IF;

  CREATE TEMP TABLE _n4_legacy_grammar ON COMMIT DROP AS
    SELECT id FROM module_grammar WHERE lesson_id IN (SELECT id FROM _n4_legacy_lessons);
  IF (SELECT count(*) FROM _n4_legacy_grammar) <> 123 THEN
    RAISE EXCEPTION '158: expected 123 legacy grammar rows; review current curriculum';
  END IF;
  IF EXISTS (SELECT 1 FROM lesson_grammar_task_items
              WHERE grammar_id IN (SELECT id FROM _n4_legacy_grammar)
                AND lesson_id NOT IN (SELECT id FROM _n4_legacy_lessons))
     OR EXISTS (SELECT 1 FROM quiz_questions
                 WHERE grammar_id IN (SELECT id FROM _n4_legacy_grammar)
                   AND lesson_id NOT IN (SELECT id FROM _n4_legacy_lessons)) THEN
    RAISE EXCEPTION '158: legacy grammar is referenced by retained lessons; review before deleting';
  END IF;

  CREATE TEMP TABLE _n4_cleanup_snapshot (
    relation OID NOT NULL,
    row_hash TEXT NOT NULL,
    row_data JSONB NOT NULL,
    PRIMARY KEY (relation, row_hash)
  ) ON COMMIT DROP;
  INSERT INTO _n4_cleanup_snapshot
    SELECT 'lessons'::regclass, md5(to_jsonb(l)::text), to_jsonb(l)
      FROM lessons l WHERE id IN (SELECT id FROM _n4_legacy_lessons)
    UNION ALL
    SELECT 'module_grammar'::regclass, md5(to_jsonb(g)::text), to_jsonb(g)
      FROM module_grammar g WHERE id IN (SELECT id FROM _n4_legacy_grammar);

  -- Follow incoming FKs, including SET NULL links and composite-key tables.
  -- This captures quiz options/results, attempts and progress before cascades.
  LOOP
    v_total_added := 0;
    FOR r IN SELECT conrelid, confrelid, conkey, confkey FROM pg_constraint
              WHERE contype = 'f' AND confrelid IN (SELECT relation FROM _n4_cleanup_snapshot)
    LOOP
      SELECT string_agg(format('to_jsonb(child)->>%L = parent.row_data->>%L', ca.attname, pa.attname), ' AND ' ORDER BY k.n)
        INTO v_join
        FROM unnest(r.conkey, r.confkey) WITH ORDINALITY AS k(child_att, parent_att, n)
        JOIN pg_attribute ca ON ca.attrelid=r.conrelid AND ca.attnum=k.child_att
        JOIN pg_attribute pa ON pa.attrelid=r.confrelid AND pa.attnum=k.parent_att;
      EXECUTE format(
        'INSERT INTO _n4_cleanup_snapshot SELECT DISTINCT %s::oid, md5(to_jsonb(child)::text), to_jsonb(child)
           FROM %s child JOIN _n4_cleanup_snapshot parent ON parent.relation=%s::oid AND %s
         ON CONFLICT DO NOTHING', r.conrelid, r.conrelid::regclass, r.confrelid, v_join);
      GET DIAGNOSTICS v_added = ROW_COUNT;
      v_total_added := v_total_added + v_added;
    END LOOP;
    EXIT WHEN v_total_added = 0;
  END LOOP;

  INSERT INTO curriculum_cleanup_archive (cleanup_key, table_name, row_hash, row_data)
    SELECT '158-n4-legacy', relation::regclass::text, row_hash, row_data FROM _n4_cleanup_snapshot
    ON CONFLICT DO NOTHING;

  DELETE FROM module_grammar WHERE id IN (SELECT id FROM _n4_legacy_grammar);
  DELETE FROM lessons WHERE id IN (SELECT id FROM _n4_legacy_lessons);
  IF (SELECT count(*) FROM lessons l JOIN modules m ON m.id=l.module_id WHERE m.course_id=v_course) <> 190 THEN
    RAISE EXCEPTION '158: remaining N4 lessons differ from the reviewed 190; transaction rolled back';
  END IF;
  RAISE NOTICE '158: removed 253 legacy N4 lessons and 123 linked grammar rows; 190 lessons retained; recovery snapshots saved';
END $cleanup$;
