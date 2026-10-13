-- Remove the 18 intro lessons reviewed in the live N5 sidebar (Bab 3-20).
-- Archive affected rows, including FK dependents, before removing the lessons.
-- Retained lessons keep their IDs, sort order, video sources and progress.
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
  v_count INT;
  v_added INT;
  v_total_added INT;
  v_join TEXT;
  r RECORD;
BEGIN
  LOCK TABLE lessons IN SHARE ROW EXCLUSIVE MODE;
  CREATE TEMP TABLE _n5_intro_lessons_211 ON COMMIT DROP AS
    SELECT l.id, l.module_id FROM lessons l
      JOIN modules m ON m.id = l.module_id
      JOIN courses c ON c.id = m.course_id
     WHERE c.slug = 'n5'
       AND m.slug ~ '^n5-b([3-9]|1[0-9]|20)$'
       AND l.type = 'video'
       AND l.slug IN ('intro', 'intro-' || m.slug, 'pelajaran-1-pengantar');
  SELECT count(*) INTO v_count FROM _n5_intro_lessons_211;
  IF v_count = 0 THEN
    RAISE NOTICE '211: no matching N5 Bab 3-20 intro lessons; no deletion.';
    RETURN;
  END IF;
  IF v_count <> 18 OR (SELECT count(DISTINCT module_id) FROM _n5_intro_lessons_211) <> 18 THEN
    RAISE EXCEPTION '211: expected one reviewed intro per N5 Bab 3-20 (18 total), found %; no deletion.', v_count;
  END IF;

  CREATE TEMP TABLE _n5_intro_snapshot_211 (
    relation OID NOT NULL,
    row_hash TEXT NOT NULL,
    row_data JSONB NOT NULL,
    PRIMARY KEY (relation, row_hash)
  ) ON COMMIT DROP;
  INSERT INTO _n5_intro_snapshot_211
    SELECT 'lessons'::regclass, md5(to_jsonb(l)::text), to_jsonb(l)
      FROM lessons l WHERE id IN (SELECT id FROM _n5_intro_lessons_211);

  -- Follow incoming FKs, including SET NULL links and composite-key tables.
  -- Save progress, quiz attempts/results and any transitive dependents.
  LOOP
    v_total_added := 0;
    FOR r IN SELECT conrelid, confrelid, conkey, confkey FROM pg_constraint
              WHERE contype = 'f' AND confrelid IN (SELECT relation FROM _n5_intro_snapshot_211)
    LOOP
      SELECT string_agg(format('to_jsonb(child)->>%L = parent.row_data->>%L', ca.attname, pa.attname), ' AND ' ORDER BY k.n)
        INTO v_join
        FROM unnest(r.conkey, r.confkey) WITH ORDINALITY AS k(child_att, parent_att, n)
        JOIN pg_attribute ca ON ca.attrelid = r.conrelid AND ca.attnum = k.child_att
        JOIN pg_attribute pa ON pa.attrelid = r.confrelid AND pa.attnum = k.parent_att;
      EXECUTE format(
        'INSERT INTO _n5_intro_snapshot_211 SELECT DISTINCT %s::oid, md5(to_jsonb(child)::text), to_jsonb(child)
           FROM %s child JOIN _n5_intro_snapshot_211 parent ON parent.relation=%s::oid AND %s
         ON CONFLICT DO NOTHING', r.conrelid, r.conrelid::regclass, r.confrelid, v_join);
      GET DIAGNOSTICS v_added = ROW_COUNT;
      v_total_added := v_total_added + v_added;
    END LOOP;
    EXIT WHEN v_total_added = 0;
  END LOOP;

  INSERT INTO curriculum_cleanup_archive (cleanup_key, table_name, row_hash, row_data)
    SELECT '211-n5-bab3-20-intros', relation::regclass::text, row_hash, row_data
      FROM _n5_intro_snapshot_211
    ON CONFLICT DO NOTHING;

  DELETE FROM lessons WHERE id IN (SELECT id FROM _n5_intro_lessons_211);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '211: Removed % N5 Bab 3-20 intro lessons; recovery snapshots saved.', v_count;
END $cleanup$;
