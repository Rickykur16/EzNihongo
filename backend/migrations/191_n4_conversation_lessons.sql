-- 191_n4_conversation_lessons.sql
-- N4 follows the N5 structure: Tata Bahasa is a video-type lesson and its
-- dialogues live in their own Percakapan lesson (type 'conversation',
-- migration 178) placed directly after it. Migration 190 left the 47 dialogues
-- inline in the grammar lessons; the dialogues themselves stay on the grammar
-- rows (module_grammar.example_dialog*), so audio, scenes, furigana and the
-- N4 self-checks keep working — the new lesson only points at its source.
--
-- Scoped to the N4 course. Idempotent: a source that already has a Percakapan
-- is skipped; a grammar lesson still typed 'text' is moved to 'video'.
-- Student progress rows are untouched (new lessons simply start incomplete).

DO $migration$
DECLARE
  v_course UUID;
  s RECORD;
  v_sort INTEGER;
  v_slug TEXT;
  v_title TEXT;
  v_n INTEGER;
  created INTEGER := 0;
BEGIN
  SELECT id INTO v_course FROM courses WHERE slug = 'n4';
  IF v_course IS NULL THEN
    RAISE NOTICE '191: kursus n4 tidak ada, dilewati';
    RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('curriculum-boundary:graph'));
  PERFORM pg_advisory_xact_lock(hashtext('curriculum-boundary:' || v_course::text));

  UPDATE lessons l SET type = 'video', updated_at = now()
   FROM modules m
   WHERE m.id = l.module_id AND m.course_id = v_course
     AND l.type = 'text' AND l.slug LIKE 'tata-bahasa-%'
     AND NOT EXISTS (SELECT 1 FROM lessons c WHERE c.conversation_source_lesson_id = l.id);

  FOR s IN
    SELECT l.id, l.module_id, l.slug, l.title
      FROM lessons l
      JOIN modules m ON m.id = l.module_id
     WHERE m.course_id = v_course
       AND l.type IN ('text','video')
       AND EXISTS (SELECT 1 FROM module_grammar g
                    WHERE g.lesson_id = l.id AND btrim(coalesce(g.example_dialog, '')) <> '')
       AND NOT EXISTS (SELECT 1 FROM lessons c WHERE c.conversation_source_lesson_id = l.id)
     ORDER BY m.sort_order, l.sort_order, l.created_at
  LOOP
    SELECT coalesce(sort_order, 0) INTO v_sort FROM lessons WHERE id = s.id;
    v_slug := s.slug || '-percakapan';
    v_n := 2;
    WHILE EXISTS (SELECT 1 FROM lessons WHERE module_id = s.module_id AND slug = v_slug) LOOP
      v_slug := s.slug || '-percakapan-' || v_n;
      v_n := v_n + 1;
    END LOOP;
    v_title := CASE
      WHEN s.title ~* '^\s*tata\s+bahasa[^:]*:\s*\S'
        THEN regexp_replace(s.title, '^\s*[Tt]ata\s+[Bb]ahasa[^:]*:\s*', 'Percakapan: ')
      ELSE 'Percakapan: ' || s.title
    END;
    UPDATE lessons SET sort_order = sort_order + 1
     WHERE module_id = s.module_id AND sort_order > v_sort;
    INSERT INTO lessons (module_id, slug, title, type, sort_order, conversation_source_lesson_id)
    VALUES (s.module_id, v_slug, v_title, 'conversation', v_sort + 1, s.id);
    created := created + 1;
  END LOOP;
  RAISE NOTICE '191: % pelajaran Percakapan N4 dibuat', created;
END
$migration$;
