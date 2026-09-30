-- The postmigration script computes the application's real fingerprints and
-- validates the refreshed conversation questions before committing this ledger.
CREATE TABLE IF NOT EXISTS n5_b3_support_finalization_182 (
  module_id UUID PRIMARY KEY,
  before_lessons JSONB NOT NULL,
  before_questions JSONB NOT NULL,
  report JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
