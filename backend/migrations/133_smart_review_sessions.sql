-- Smart Review stores only short-lived server-authorized question sessions.
-- Learning evidence remains user_practice_state/practice_attempts and the
-- existing grammar_attempts model; these rows prevent replaying an answer.
CREATE TABLE IF NOT EXISTS smart_review_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('mixed', 'kana', 'vocabulary', 'kanji', 'grammar')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_smart_review_sessions_user_expiry
  ON smart_review_sessions(user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS smart_review_session_items (
  session_id UUID NOT NULL REFERENCES smart_review_sessions(id) ON DELETE CASCADE,
  question_index INT NOT NULL CHECK (question_index >= 0),
  item_type TEXT NOT NULL CHECK (item_type IN ('kana', 'vocabulary', 'kanji', 'grammar')),
  item_id UUID NOT NULL,
  skill TEXT NOT NULL,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  payload JSONB NOT NULL,
  answered_at TIMESTAMPTZ,
  PRIMARY KEY (session_id, question_index)
);

CREATE INDEX IF NOT EXISTS idx_smart_review_session_items_item
  ON smart_review_session_items(item_type, item_id);

-- Grammar continues to use grammar_attempts.  Preserve its source semantics
-- (recognition/controlled) and mark the presentation origin in eval_source.
ALTER TABLE grammar_attempts DROP CONSTRAINT IF EXISTS grammar_attempts_eval_source_check;
ALTER TABLE grammar_attempts ADD CONSTRAINT grammar_attempts_eval_source_check
  CHECK (eval_source IN ('ai', 'cache', 'smart_review'));
