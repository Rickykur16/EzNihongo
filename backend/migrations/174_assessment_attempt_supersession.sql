-- Keep old packets and drafts when a learner explicitly switches to a newer bank.
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS superseded_at timestamptz;
