-- Persistent cache for the public "Daftar Kosakata" auto-sync. One row per
-- level slug (n5, n4, …); each sync UPSERT-replaces the payload so the table
-- never grows. Restored on server boot before any in-memory cache exists, so
-- a Notion outage right after a restart can still serve the last good data.

CREATE TABLE IF NOT EXISTS notion_vocab_cache (
  slug TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
