-- Add evidence fields to the already reviewed prospect record. Existing rows
-- remain intact; missing evidence is reported as missing, never inferred.
ALTER TABLE marketing_leads ADD COLUMN referrer_name TEXT NOT NULL DEFAULT '';
ALTER TABLE marketing_leads ADD COLUMN background TEXT NOT NULL DEFAULT '';
ALTER TABLE marketing_leads ADD COLUMN category_interest TEXT NOT NULL DEFAULT '';
ALTER TABLE marketing_leads ADD COLUMN primary_problem TEXT NOT NULL DEFAULT '';
ALTER TABLE marketing_leads ADD COLUMN target_timeline TEXT NOT NULL DEFAULT '';
ALTER TABLE marketing_leads ADD COLUMN qualification_note TEXT NOT NULL DEFAULT '';
ALTER TABLE marketing_leads ADD COLUMN alternative TEXT NOT NULL DEFAULT '';
ALTER TABLE marketing_leads ADD COLUMN offer_angle TEXT NOT NULL DEFAULT '';
ALTER TABLE marketing_leads ADD COLUMN price_reaction TEXT NOT NULL DEFAULT '';
ALTER TABLE marketing_leads ADD COLUMN willingness_to_pay BIGINT;
ALTER TABLE marketing_leads ADD COLUMN objection TEXT NOT NULL DEFAULT '';
ALTER TABLE marketing_leads ADD COLUMN customer_words TEXT NOT NULL DEFAULT '';
ALTER TABLE marketing_leads ADD COLUMN decision_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE marketing_leads ADD COLUMN next_action TEXT NOT NULL DEFAULT '';
ALTER TABLE marketing_leads ADD COLUMN interviewed_at TIMESTAMPTZ;
UPDATE marketing_leads SET referrer_name=source_detail WHERE source='referral' AND source_detail<>'';
ALTER TABLE marketing_leads DROP CONSTRAINT marketing_leads_stage_check;
ALTER TABLE marketing_leads ADD CONSTRAINT marketing_leads_stage_check
  CHECK (stage IN ('new','contacted','qualified','consulting','offered','won','lost'));
ALTER TABLE marketing_leads ADD CONSTRAINT marketing_leads_background_check
  CHECK (background IN ('','ex_intern_hospitality','ex_intern_other','fresh_graduate','worker','other'));
ALTER TABLE marketing_leads ADD CONSTRAINT marketing_leads_problem_check
  CHECK (primary_problem IN ('','cost','language','jobs','time','trust','other'));
ALTER TABLE marketing_leads ADD CONSTRAINT marketing_leads_angle_check
  CHECK (offer_angle IN ('','cost','career','convenience','other'));
ALTER TABLE marketing_leads ADD CONSTRAINT marketing_leads_price_reaction_check
  CHECK (price_reaction IN ('','cheap','reasonable','somewhat_expensive','expensive','not_relevant'));
ALTER TABLE marketing_leads ADD CONSTRAINT marketing_leads_wtp_check
  CHECK (willingness_to_pay IS NULL OR willingness_to_pay BETWEEN 0 AND 1000000000000);
CREATE INDEX marketing_leads_evidence ON marketing_leads(course_id,created_at,source,offer_angle);

-- One review and one main test per week/course. A global review is possible
-- only for users with global Marketing access. No auto-publish or ad spend.
CREATE TABLE marketing_growth_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE RESTRICT,
  week_start DATE NOT NULL,
  segment_decision TEXT NOT NULL DEFAULT '',
  buyer_language TEXT NOT NULL DEFAULT '',
  top_objection TEXT NOT NULL DEFAULT '',
  decision TEXT NOT NULL DEFAULT '',
  experiment_variable TEXT NOT NULL DEFAULT '' CHECK (experiment_variable IN ('','message','cta','sales_script','price_framing','channel','other')),
  experiment_angle TEXT NOT NULL DEFAULT '' CHECK (experiment_angle IN ('','cost','career','convenience','other')),
  experiment_hypothesis TEXT NOT NULL DEFAULT '',
  success_metric TEXT NOT NULL DEFAULT '',
  experiment_owner UUID REFERENCES users(id) ON DELETE SET NULL,
  experiment_result TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','running','complete')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version>0),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (extract(isodow FROM week_start)=1),
  UNIQUE(week_start,course_id)
);
CREATE UNIQUE INDEX marketing_growth_reviews_global_week
  ON marketing_growth_reviews(week_start) WHERE course_id IS NULL;
CREATE INDEX marketing_growth_reviews_recent ON marketing_growth_reviews(course_id,week_start DESC);

-- Actual acquisition spending entered by a permitted operator. Rows are
-- additive and editable with a version so period CAC can use known spend.
CREATE TABLE marketing_channel_spend (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE RESTRICT,
  week_start DATE NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('referral','instagram','tiktok','whatsapp','website','event','other')),
  amount_idr BIGINT NOT NULL CHECK (amount_idr BETWEEN 0 AND 1000000000000),
  note TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1 CHECK (version>0),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (extract(isodow FROM week_start)=1),
  UNIQUE(course_id,week_start,source)
);
CREATE UNIQUE INDEX marketing_channel_spend_global_week_source
  ON marketing_channel_spend(week_start,source) WHERE course_id IS NULL;
