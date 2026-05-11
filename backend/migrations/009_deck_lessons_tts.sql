-- Deck lessons (interactive vocab decks) + ElevenLabs TTS cache.
-- New lesson type 'deck'; vocab items reused as a bank, linked into decks via
-- lesson_deck_items; each vocab item can carry example sentences. TTS audio is
-- cached in Postgres so it survives `git reset --hard` deploys and is picked up
-- by backup.sh. Idempotent: gated CREATE INDEX/CREATE TRIGGER per repo convention.

-- 1. Allow lesson type 'deck'
ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_type_check;
ALTER TABLE lessons ADD CONSTRAINT lessons_type_check
  CHECK (type IN ('video', 'quiz', 'text', 'deck'));

-- 2. Romaji column on the vocab bank (kana stays in `reading`)
ALTER TABLE module_vocabulary ADD COLUMN IF NOT EXISTS romaji TEXT;

-- 3. Example sentences per vocab item (stored plain; highlight = substring to mark)
CREATE TABLE IF NOT EXISTS vocabulary_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vocabulary_id UUID NOT NULL REFERENCES module_vocabulary(id) ON DELETE CASCADE,
  japanese TEXT NOT NULL,
  highlight TEXT,
  indonesian TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_vocab_examples_vocab') THEN
    EXECUTE 'CREATE INDEX idx_vocab_examples_vocab ON vocabulary_examples(vocabulary_id, sort_order)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'vocabulary_examples_updated_at') THEN
    EXECUTE 'CREATE TRIGGER vocabulary_examples_updated_at BEFORE UPDATE ON vocabulary_examples
             FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
  END IF;
END $$;

-- 4. Which vocab items belong to which deck (lesson)
CREATE TABLE IF NOT EXISTS lesson_deck_items (
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  vocabulary_id UUID NOT NULL REFERENCES module_vocabulary(id) ON DELETE CASCADE,
  sort_order INT DEFAULT 0,
  accent_color TEXT,
  PRIMARY KEY (lesson_id, vocabulary_id)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_deck_items_lesson') THEN
    EXECUTE 'CREATE INDEX idx_deck_items_lesson ON lesson_deck_items(lesson_id, sort_order)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_deck_items_vocab') THEN
    EXECUTE 'CREATE INDEX idx_deck_items_vocab ON lesson_deck_items(vocabulary_id)';
  END IF;
END $$;

-- 5. TTS audio cache (bytea — included in pg_dump, survives redeploys)
CREATE TABLE IF NOT EXISTS tts_cache (
  text_hash TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'elevenlabs',
  voice TEXT,
  model TEXT,
  audio BYTEA NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'audio/mpeg',
  byte_size INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
