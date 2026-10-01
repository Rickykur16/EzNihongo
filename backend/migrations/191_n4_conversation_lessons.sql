-- N4: Percakapan becomes its own lesson, as in N5 (migration 178).
--
-- 178 created a Percakapan lesson for every text/video lesson that had a
-- dialogue AT THAT TIME. The 47 N4 dialogues arrived later (migration 190)
-- and were shown inline inside the grammar lessons instead. This gives each
-- N4 grammar lesson with a dialogue its Percakapan, placed directly after it
-- (later lessons shift down by one), so a chapter reads
--   Tata Bahasa 1 → Percakapan → Tugas Bunpou 1 → Tata Bahasa 2 → ...
-- exactly like N5. The dialogues stay on the source lesson's module_grammar
-- rows: audio, scenes, furigana, expressions and the N4 reading checks
-- (n4-dialogue-support.js) are unchanged; only where they are shown moves.
--
-- Scoped to the N4 course on purpose: a dialogue an admin adds elsewhere
-- later is not turned into a lesson behind their back. Idempotent: a source
-- that already has a Percakapan is skipped. Slugs of existing lessons are not
-- touched (student progress is keyed by slug).
DO $$
DECLARE
  s RECORD;
  v_sort INTEGER;
  v_slug TEXT;
  v_title TEXT;
  v_n INTEGER;
  created INTEGER := 0;
BEGIN
  FOR s IN
    SELECT l.id, l.module_id, l.slug, l.title
      FROM lessons l
      JOIN modules m ON m.id = l.module_id
      JOIN courses c ON c.id = m.course_id
     WHERE c.slug = 'n4'
       AND l.type IN ('text','video')
       AND EXISTS (SELECT 1 FROM module_grammar g
                    WHERE g.lesson_id = l.id AND btrim(coalesce(g.example_dialog, '')) <> '')
       AND NOT EXISTS (SELECT 1 FROM lessons x WHERE x.conversation_source_lesson_id = l.id)
     ORDER BY m.sort_order, l.sort_order, l.created_at
  LOOP
    -- Re-read: an earlier iteration in the same module may have shifted it.
    SELECT coalesce(sort_order, 0) INTO v_sort FROM lessons WHERE id = s.id;
    v_slug := s.slug || '-percakapan';
    v_n := 2;
    WHILE EXISTS (SELECT 1 FROM lessons WHERE module_id = s.module_id AND slug = v_slug) LOOP
      v_slug := s.slug || '-percakapan-' || v_n;
      v_n := v_n + 1;
    END LOOP;
    v_title := CASE
      -- "Tata Bahasa 1: Topik" → "Percakapan: Topik" (same rule as 178)
      WHEN s.title ~* '^\s*tata\s+bahasa[^:]*:\s*\S'
        THEN regexp_replace(s.title, '^\s*[Tt]ata\s+[Bb]ahasa[^:]*:\s*', 'Percakapan: ')
      -- "Tata Bahasa 1" → "Percakapan 1"
      WHEN s.title ~* '^\s*tata\s+bahasa(\s+\d+)?\s*$'
        THEN btrim('Percakapan' || coalesce(substring(s.title from '(\s+\d+)\s*$'), ''))
      ELSE 'Percakapan: ' || s.title
    END;
    UPDATE lessons SET sort_order = sort_order + 1
     WHERE module_id = s.module_id AND sort_order > v_sort;
    INSERT INTO lessons (module_id, slug, title, type, sort_order, conversation_source_lesson_id)
    VALUES (s.module_id, v_slug, v_title, 'conversation', v_sort + 1, s.id);
    created := created + 1;
    RAISE NOTICE '191: % → % (%)', s.title, v_title, v_slug;
  END LOOP;
  RAISE NOTICE '191: % pelajaran Percakapan N4 dibuat', created;
END $$;
