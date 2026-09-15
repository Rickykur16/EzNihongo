-- Additive migration: legacy dialogue text remains available.
CREATE TABLE grammar_dialogue_drafts (
  grammar_id UUID PRIMARY KEY REFERENCES module_grammar(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE grammar_dialogue_versions (
  id UUID PRIMARY KEY,
  grammar_id UUID NOT NULL REFERENCES module_grammar(id) ON DELETE CASCADE,
  draft_revision INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  engine TEXT NOT NULL CHECK (engine IN ('dialogue-v3', 'turns-v2')),
  model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed')),
  audio BYTEA,
  alignment JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (grammar_id, content_hash),
  UNIQUE (grammar_id, id),
  CHECK (status <> 'ready' OR (audio IS NOT NULL AND alignment IS NOT NULL))
);
CREATE INDEX grammar_dialogue_versions_recent ON grammar_dialogue_versions(grammar_id, created_at DESC);

CREATE TABLE grammar_dialogue_publications (
  grammar_id UUID PRIMARY KEY REFERENCES module_grammar(id) ON DELETE CASCADE,
  version_id UUID NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (grammar_id, version_id) REFERENCES grammar_dialogue_versions(grammar_id, id) ON DELETE CASCADE
);

CREATE TABLE grammar_dialogue_reports (
  id UUID PRIMARY KEY,
  grammar_id UUID NOT NULL,
  version_id UUID NOT NULL,
  turn_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('pronunciation', 'expression', 'timing', 'other')),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  FOREIGN KEY (grammar_id, version_id) REFERENCES grammar_dialogue_versions(grammar_id, id) ON DELETE CASCADE
);
CREATE INDEX grammar_dialogue_reports_open ON grammar_dialogue_reports(grammar_id) WHERE resolved_at IS NULL;
