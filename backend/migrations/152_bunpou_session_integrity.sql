-- Additive request ledger and production-slot snapshots. No student history
-- or pilot flags are rewritten; user/session deletion cascades as before.
ALTER TABLE grammar_task_sessions
  ADD COLUMN IF NOT EXISTS production_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS grammar_task_requests (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  session_id UUID NOT NULL REFERENCES grammar_task_sessions(id) ON DELETE CASCADE,
  payload_hash TEXT NOT NULL,
  operation TEXT NOT NULL,
  grammar_id UUID REFERENCES module_grammar(id) ON DELETE CASCADE,
  production_slot INT,
  response JSONB,
  reservation_token UUID,
  reserved_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, request_id)
);
CREATE INDEX IF NOT EXISTS idx_grammar_task_pending_production
  ON grammar_task_requests(session_id, grammar_id, production_slot)
  WHERE operation = 'production' AND response IS NULL;

CREATE TABLE IF NOT EXISTS grammar_task_productions (
  session_id UUID NOT NULL REFERENCES grammar_task_sessions(id) ON DELETE CASCADE,
  grammar_id UUID NOT NULL REFERENCES module_grammar(id) ON DELETE CASCADE,
  slot INT NOT NULL CHECK (slot >= 0),
  sentence TEXT NOT NULL,
  input_mode TEXT NOT NULL CHECK (input_mode IN ('speech', 'text')),
  result JSONB NOT NULL,
  request_id TEXT NOT NULL,
  assistance_state TEXT NOT NULL CHECK (assistance_state IN ('none_observed', 'correction_served', 'unknown')),
  passed BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, grammar_id, slot)
);
CREATE INDEX IF NOT EXISTS idx_grammar_task_item_exposure
  ON grammar_task_session_items(question_fingerprint, session_id)
  WHERE revealed_at IS NOT NULL OR hint_served_at IS NOT NULL OR passed = TRUE;
