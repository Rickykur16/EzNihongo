CREATE TABLE marketing_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE RESTRICT,
  full_name TEXT NOT NULL CHECK (length(full_name) BETWEEN 1 AND 160),
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL CHECK (source IN ('referral','instagram','tiktok','whatsapp','website','event','other')),
  source_detail TEXT NOT NULL DEFAULT '',
  goal TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT 'new' CHECK (stage IN ('new','contacted','consulting','offered','won','lost')),
  offered_price BIGINT CHECK (offered_price BETWEEN 0 AND 1000000000000),
  lost_reason TEXT NOT NULL DEFAULT '',
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  next_follow_up TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (phone <> '' OR email <> ''),
  CHECK (stage <> 'lost' OR length(trim(lost_reason)) > 0),
  CHECK (stage NOT IN ('won','lost') OR next_follow_up IS NULL)
);
CREATE UNIQUE INDEX marketing_leads_phone_course ON marketing_leads(COALESCE(course_id,'00000000-0000-0000-0000-000000000000'::uuid),phone) WHERE phone <> '';
CREATE UNIQUE INDEX marketing_leads_email_course ON marketing_leads(COALESCE(course_id,'00000000-0000-0000-0000-000000000000'::uuid),email) WHERE email <> '';
CREATE INDEX marketing_leads_queue ON marketing_leads(course_id,stage,next_follow_up);
CREATE INDEX marketing_leads_updated ON marketing_leads(updated_at DESC,id DESC);
CREATE TABLE marketing_lead_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES marketing_leads(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_key TEXT NOT NULL CHECK (event_key IN ('created','updated','stage_changed','note')),
  stage TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  lead_version INTEGER NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(lead_id,lead_version)
);
CREATE INDEX marketing_lead_events_history ON marketing_lead_events(lead_id,occurred_at DESC,id DESC);
