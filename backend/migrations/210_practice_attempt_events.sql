-- Durable retry receipts; timestamps and learning evidence remain server-owned.
-- Keep receipts for as long as their user exists, including after browser retries.
CREATE TABLE IF NOT EXISTS practice_attempt_events (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL,
  request JSONB NOT NULL,
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, event_id)
);
