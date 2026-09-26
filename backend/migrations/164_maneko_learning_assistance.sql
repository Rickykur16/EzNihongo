-- Assistance is learning activity, never independent retrieval evidence.
CREATE TABLE IF NOT EXISTS maneko_exposures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  item_type TEXT,
  item_id UUID,
  session_id UUID REFERENCES smart_review_sessions(id) ON DELETE SET NULL,
  question_index INT,
  assistance_type TEXT NOT NULL CHECK (assistance_type IN ('hint', 'explanation', 'answer', 'tutor_chat')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_maneko_exposures_user_time ON maneko_exposures(user_id, expires_at);
ALTER TABLE smart_review_session_items ADD COLUMN IF NOT EXISTS result JSONB;
ALTER TABLE smart_review_session_items ADD COLUMN IF NOT EXISTS assisted_at TIMESTAMPTZ;

-- Serialize evidence timestamps with assistance across endpoints/tabs. NOW()
-- is the transaction start, which could predate a help request while waiting.
CREATE OR REPLACE FUNCTION maneko_stamp_evidence() RETURNS trigger AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('learning-evidence:' || NEW.user_id::text));
  NEW.created_at := clock_timestamp();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS maneko_stamp ON grammar_attempts;
CREATE TRIGGER maneko_stamp BEFORE INSERT ON grammar_attempts FOR EACH ROW EXECUTE FUNCTION maneko_stamp_evidence();
DROP TRIGGER IF EXISTS maneko_stamp ON practice_attempts;
CREATE TRIGGER maneko_stamp BEFORE INSERT ON practice_attempts FOR EACH ROW EXECUTE FUNCTION maneko_stamp_evidence();
DROP TRIGGER IF EXISTS maneko_stamp ON quiz_question_results;
CREATE TRIGGER maneko_stamp BEFORE INSERT ON quiz_question_results FOR EACH ROW EXECUTE FUNCTION maneko_stamp_evidence();
