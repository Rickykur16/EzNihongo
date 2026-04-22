-- 006_curriculum_richcontent.sql
-- Rich curriculum content: module metadata (can-do, CEFR, JF topic, scenario,
-- skill distribution, quiz spec) + normalized vocabulary and grammar tables.

ALTER TABLE modules
  ADD COLUMN IF NOT EXISTS jf_topic           TEXT,
  ADD COLUMN IF NOT EXISTS cefr_level         TEXT,
  ADD COLUMN IF NOT EXISTS estimated_hours    NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS title_en           TEXT,
  ADD COLUMN IF NOT EXISTS scenario           TEXT,
  ADD COLUMN IF NOT EXISTS cando_statements   JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS skill_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS quiz_spec          JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS module_vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  japanese TEXT NOT NULL,
  reading TEXT,
  indonesian TEXT,
  category TEXT,
  note TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vocab_module ON module_vocabulary(module_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_vocab_lesson ON module_vocabulary(lesson_id, sort_order);

CREATE TABLE IF NOT EXISTS module_grammar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  pattern TEXT NOT NULL,
  meaning TEXT,
  example TEXT,
  notes TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grammar_module ON module_grammar(module_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_grammar_lesson ON module_grammar(lesson_id, sort_order);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'module_vocabulary_updated_at') THEN
    CREATE TRIGGER module_vocabulary_updated_at BEFORE UPDATE ON module_vocabulary
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'module_grammar_updated_at') THEN
    CREATE TRIGGER module_grammar_updated_at BEFORE UPDATE ON module_grammar
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
