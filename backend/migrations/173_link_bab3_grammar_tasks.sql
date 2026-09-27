-- Link each Bab 3 grammar task to its teaching lesson so Learning Flow v2
-- can open the task as the lesson-completion popup. Refuse to overwrite an
-- existing, different mapping or a source already claimed by another task.

DO $migration$
DECLARE
  v_course_id UUID;
  v_module_id UUID;
  v_source_id UUID;
  v_task_id UUID;
  v_lock_id UUID;
  pair JSONB;
  matches INTEGER;
BEGIN
  SELECT count(*), (array_agg(c.id))[1] INTO matches, v_course_id
    FROM courses c WHERE c.slug = 'n5';
  IF matches = 0 THEN
    RAISE NOTICE '173: no N5 course; nothing to link';
    RETURN;
  END IF;
  IF matches <> 1 THEN
    RAISE EXCEPTION '173: expected exactly one N5 course; found %', matches;
  END IF;

  -- Take the graph lock exclusively before course locks. Live popup writers
  -- currently lock the task owner, which may differ from the source owner;
  -- exclusive graph ownership prevents a cross-course task from claiming a
  -- Bab 3 source between the uniqueness guard and this migration's updates.
  PERFORM pg_advisory_xact_lock(hashtext('curriculum-boundary:graph'));
  FOR v_lock_id IN WITH RECURSIVE required(id) AS (
    SELECT v_course_id
    UNION
    SELECT p.prerequisite_course_id FROM course_prerequisites p
      JOIN required r ON r.id = p.course_id
  ) SELECT id FROM required ORDER BY id::text LOOP
    PERFORM pg_advisory_xact_lock(hashtext('curriculum-boundary:' || v_lock_id::text));
  END LOOP;

  SELECT count(*), (array_agg(m.id))[1] INTO matches, v_module_id
    FROM modules m JOIN courses c ON c.id = m.course_id
    WHERE c.id = v_course_id AND m.slug = 'n5-b3';
  IF matches <> 1 THEN
    RAISE EXCEPTION '173: expected exactly one N5 module n5-b3; found %', matches;
  END IF;

  FOR pair IN SELECT value FROM jsonb_array_elements('[
    {"source":"bunpou-n5-b3","task":"tesbunpou1-n5-b3"},
    {"source":"bunpou2-n5-b3","task":"tesbunpou2-n5-b3"}
  ]'::jsonb) LOOP
    SELECT count(*), (array_agg(l.id))[1] INTO matches, v_source_id
      FROM lessons l WHERE l.module_id = v_module_id
      AND l.slug = pair->>'source' AND l.type IN ('video', 'text');
    IF matches <> 1 THEN
      RAISE EXCEPTION '173: source % is missing or ambiguous', pair->>'source';
    END IF;

    SELECT count(*), (array_agg(l.id))[1] INTO matches, v_task_id
      FROM lessons l WHERE l.module_id = v_module_id
      AND l.slug = pair->>'task' AND l.type = 'grammar_task';
    IF matches <> 1 THEN
      RAISE EXCEPTION '173: task % is missing or ambiguous', pair->>'task';
    END IF;

    IF EXISTS (SELECT 1 FROM lessons l WHERE l.type = 'grammar_task'
      AND l.popup_after_lesson_id = v_source_id AND l.id <> v_task_id) THEN
      RAISE EXCEPTION '173: source % is already linked to another grammar task', pair->>'source';
    END IF;
    IF EXISTS (SELECT 1 FROM lessons l WHERE l.id = v_task_id
      AND l.popup_after_lesson_id IS NOT NULL AND l.popup_after_lesson_id <> v_source_id) THEN
      RAISE EXCEPTION '173: task % already has a different popup source', pair->>'task';
    END IF;

    UPDATE lessons SET popup_after_lesson_id = v_source_id, updated_at = NOW()
      WHERE id = v_task_id AND popup_after_lesson_id IS DISTINCT FROM v_source_id;
    RAISE NOTICE '173: linked % after %', pair->>'task', pair->>'source';
  END LOOP;
END;
$migration$;
