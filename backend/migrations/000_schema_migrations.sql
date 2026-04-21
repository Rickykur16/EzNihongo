-- Tracks which migration files have been applied. The runner (run.js) reads
-- from this table to skip migrations already applied on the current DB.
-- Idempotent: CREATE TABLE IF NOT EXISTS.
CREATE TABLE IF NOT EXISTS schema_migrations (
  name        TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
