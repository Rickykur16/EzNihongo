-- Opt-in company extension. Never loaded by the legacy migration runner.
CREATE TABLE company_work_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_key TEXT NOT NULL CHECK (division_key IN ('technology','academic','marketing','operations','finance')),
  kind TEXT NOT NULL CHECK (kind IN ('task','case','campaign','content','release')),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 6000),
  status TEXT NOT NULL DEFAULT 'draft',
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent','high','normal','low')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  source_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  source_discussion_id UUID REFERENCES discussions(id) ON DELETE SET NULL,
  link_url TEXT NOT NULL DEFAULT '',
  published_url TEXT NOT NULL DEFAULT '',
  release_sha TEXT NOT NULL DEFAULT '',
  scheduled_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (source_order_id IS NULL OR (kind = 'case' AND division_key = 'finance')),
  CHECK (source_discussion_id IS NULL OR (kind = 'case' AND division_key = 'operations')),
  CHECK (source_order_id IS NULL OR source_discussion_id IS NULL)
);
CREATE INDEX company_work_queue_idx ON company_work_items(division_key, status, updated_at DESC);
CREATE INDEX company_work_created_by_idx ON company_work_items(created_by);
CREATE INDEX company_work_assigned_idx ON company_work_items(assigned_to);
CREATE UNIQUE INDEX company_case_order_unique ON company_work_items(source_order_id) WHERE source_order_id IS NOT NULL;
CREATE UNIQUE INDEX company_case_discussion_unique ON company_work_items(source_discussion_id) WHERE source_discussion_id IS NOT NULL;

CREATE TABLE company_work_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES company_work_items(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_key TEXT NOT NULL CHECK (event_key IN ('created','updated','transitioned','erased')),
  item_version INTEGER NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX company_events_item_idx ON company_work_events(item_id, occurred_at);
CREATE INDEX company_events_actor_idx ON company_work_events(actor_user_id);

CREATE TABLE company_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES company_work_items(id) ON DELETE CASCADE,
  item_version INTEGER NOT NULL,
  event_key TEXT NOT NULL CHECK (event_key = 'work.scheduled'),
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','leased','sent','failed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL,
  lease_token UUID,
  lease_until TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(item_id, item_version, event_key)
);
CREATE INDEX company_outbox_due_idx ON company_outbox(state, available_at);
