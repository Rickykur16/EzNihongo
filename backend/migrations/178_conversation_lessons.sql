-- Percakapan becomes a real lesson (type 'conversation') instead of a view
-- the student page derived from a grammar lesson's dialogues. The dialogues
-- stay where they are (module_grammar rows of the source lesson), so audio,
-- dialogue questions, scenes, furigana and expressions keep working
-- unchanged; the lesson only points at its source.
--
-- One Percakapan lesson per source; deleting the source removes it (it has
-- nothing to show without the source's dialogues). The source must be a
-- text/video lesson in the same module.

ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_type_check;
ALTER TABLE lessons ADD CONSTRAINT lessons_type_check
  CHECK (type IN ('video','quiz','text','deck','kanji','grammar_task','kana','conversation'));

ALTER TABLE lessons ADD COLUMN IF NOT EXISTS conversation_source_lesson_id UUID
  REFERENCES lessons(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS lessons_conversation_source_uniq
  ON lessons(conversation_source_lesson_id)
  WHERE conversation_source_lesson_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lessons_conversation_source_chk') THEN
    ALTER TABLE lessons ADD CONSTRAINT lessons_conversation_source_chk
      CHECK ((type = 'conversation') = (conversation_source_lesson_id IS NOT NULL));
  END IF;
END $$;

-- Same module, text/video source. A trigger rather than app code alone, so a
-- stray SQL edit cannot point a Percakapan at another chapter's grammar.
CREATE OR REPLACE FUNCTION lessons_conversation_source_guard() RETURNS trigger AS $$
DECLARE
  src RECORD;
BEGIN
  IF NEW.conversation_source_lesson_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT module_id, type INTO src FROM lessons WHERE id = NEW.conversation_source_lesson_id;
  IF NOT FOUND OR src.module_id <> NEW.module_id OR src.type NOT IN ('text','video') THEN
    RAISE EXCEPTION 'conversation_source_invalid'
      USING HINT = 'Sumber Percakapan harus pelajaran teks/video di bab yang sama.';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lessons_conversation_source_guard ON lessons;
CREATE TRIGGER lessons_conversation_source_guard
  BEFORE INSERT OR UPDATE OF conversation_source_lesson_id, module_id ON lessons
  FOR EACH ROW EXECUTE FUNCTION lessons_conversation_source_guard();

-- A source that still has a Percakapan must stay a text/video lesson.
CREATE OR REPLACE FUNCTION lessons_conversation_source_type_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.type NOT IN ('text','video') AND EXISTS (
       SELECT 1 FROM lessons c WHERE c.conversation_source_lesson_id = NEW.id) THEN
    RAISE EXCEPTION 'conversation_source_in_use'
      USING HINT = 'Hapus pelajaran Percakapan-nya dulu sebelum mengganti jenis pelajaran ini.';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lessons_conversation_source_type_guard ON lessons;
CREATE TRIGGER lessons_conversation_source_type_guard
  BEFORE UPDATE OF type ON lessons
  FOR EACH ROW WHEN (OLD.type IS DISTINCT FROM NEW.type)
  EXECUTE FUNCTION lessons_conversation_source_type_guard();

-- Every text/video lesson that already has a dialogue gets its Percakapan,
-- placed directly after it (later lessons shift down by one). Idempotent:
-- a source that already has one is skipped.
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
     WHERE l.type IN ('text','video')
       AND EXISTS (SELECT 1 FROM module_grammar g
                    WHERE g.lesson_id = l.id AND btrim(coalesce(g.example_dialog, '')) <> '')
       AND NOT EXISTS (SELECT 1 FROM lessons c WHERE c.conversation_source_lesson_id = l.id)
     ORDER BY m.course_id, m.sort_order, l.sort_order, l.created_at
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
      WHEN s.title ~* '^\s*tata\s+bahasa[^:]*:\s*\S'
        THEN regexp_replace(s.title, '^\s*[Tt]ata\s+[Bb]ahasa[^:]*:\s*', 'Percakapan: ')
      ELSE 'Percakapan: ' || s.title
    END;
    UPDATE lessons SET sort_order = sort_order + 1
     WHERE module_id = s.module_id AND sort_order > v_sort;
    INSERT INTO lessons (module_id, slug, title, type, sort_order, conversation_source_lesson_id)
    VALUES (s.module_id, v_slug, v_title, 'conversation', v_sort + 1, s.id);
    created := created + 1;
    RAISE NOTICE '178: % → % (%)', s.title, v_title, v_slug;
  END LOOP;
  RAISE NOTICE '178: % pelajaran Percakapan dibuat', created;
END $$;
