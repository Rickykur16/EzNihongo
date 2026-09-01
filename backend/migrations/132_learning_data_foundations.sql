-- 132_learning_data_foundations.sql
--
-- Relational foundations for course completion reconciliation and the main
-- site's Kana/Vocabulary/Kanji practice.  This deliberately does not replace
-- grammar_attempts: Grammar mastery has richer, source-specific evidence.

CREATE TABLE IF NOT EXISTS user_practice_state (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Grammar is reserved for canonical references only; its authoritative
  -- mastery remains grammar_attempts + grammar-mastery.js, not these counters.
  item_type TEXT NOT NULL CHECK (item_type IN ('kana', 'vocabulary', 'kanji', 'grammar')),
  item_id UUID NOT NULL,
  skill TEXT NOT NULL CHECK (char_length(skill) BETWEEN 1 AND 200),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  correct INTEGER NOT NULL DEFAULT 0 CHECK (correct >= 0 AND correct <= attempts),
  streak INTEGER NOT NULL DEFAULT 0 CHECK (streak >= 0),
  last_seen_at TIMESTAMPTZ,
  last_reviewed_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ,
  mastery_state TEXT NOT NULL DEFAULT 'new'
    CHECK (mastery_state IN ('new', 'learning', 'mastered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, item_type, item_id, skill)
);

CREATE INDEX IF NOT EXISTS idx_user_practice_state_due
  ON user_practice_state (user_id, next_review_at);
CREATE INDEX IF NOT EXISTS idx_user_practice_state_item
  ON user_practice_state (item_type, item_id);

CREATE TABLE IF NOT EXISTS practice_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('kana', 'vocabulary', 'kanji', 'grammar')),
  item_id UUID NOT NULL,
  skill TEXT NOT NULL CHECK (char_length(skill) BETWEEN 1 AND 200),
  is_correct BOOLEAN NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('lesson_drill', 'smart_review', 'quiz', 'grammar_task')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_practice_attempts_user_created
  ON practice_attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_user_item
  ON practice_attempts (user_id, item_type, item_id, skill, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_lesson
  ON practice_attempts (lesson_id, created_at DESC) WHERE lesson_id IS NOT NULL;

-- A ledger per legacy identity makes retries safe without summing an already
-- imported aggregate.  It also allows a later import to pick up identities
-- that were inaccessible when a student first signed in.
CREATE TABLE IF NOT EXISTS user_practice_legacy_imports (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source = 'welcome_local_mastery_v1'),
  item_type TEXT NOT NULL CHECK (item_type IN ('kana', 'vocabulary', 'kanji', 'grammar')),
  legacy_key TEXT NOT NULL,
  item_id UUID NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, source, item_type, legacy_key)
);

CREATE INDEX IF NOT EXISTS idx_practice_legacy_imports_item
  ON user_practice_legacy_imports (item_type, item_id);

-- item_id is intentionally polymorphic, so PostgreSQL cannot express this as
-- a normal FK.  Validate it in one trigger instead of introducing duplicate
-- Kana/Vocabulary/Kanji content tables just for practice state.
CREATE OR REPLACE FUNCTION validate_practice_item_reference() RETURNS TRIGGER AS $$
DECLARE
  exists_item BOOLEAN := FALSE;
BEGIN
  CASE NEW.item_type
    WHEN 'kana' THEN
      SELECT EXISTS (SELECT 1 FROM kana_items WHERE id = NEW.item_id) INTO exists_item;
    WHEN 'vocabulary' THEN
      SELECT EXISTS (SELECT 1 FROM module_vocabulary WHERE id = NEW.item_id) INTO exists_item;
    WHEN 'kanji' THEN
      SELECT EXISTS (SELECT 1 FROM kanji_items WHERE id = NEW.item_id) INTO exists_item;
    WHEN 'grammar' THEN
      SELECT EXISTS (SELECT 1 FROM module_grammar WHERE id = NEW.item_id) INTO exists_item;
  END CASE;

  IF NOT exists_item THEN
    RAISE EXCEPTION 'Unknown % practice item %', NEW.item_type, NEW.item_id
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_practice_state_item_reference ON user_practice_state;
CREATE TRIGGER user_practice_state_item_reference
  BEFORE INSERT OR UPDATE OF item_type, item_id ON user_practice_state
  FOR EACH ROW EXECUTE FUNCTION validate_practice_item_reference();

DROP TRIGGER IF EXISTS practice_attempts_item_reference ON practice_attempts;
CREATE TRIGGER practice_attempts_item_reference
  BEFORE INSERT OR UPDATE OF item_type, item_id ON practice_attempts
  FOR EACH ROW EXECUTE FUNCTION validate_practice_item_reference();

DROP TRIGGER IF EXISTS user_practice_state_updated_at ON user_practice_state;
CREATE TRIGGER user_practice_state_updated_at
  BEFORE UPDATE ON user_practice_state
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
