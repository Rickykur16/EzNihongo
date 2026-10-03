-- Preserve legacy answers and request the strategy fields at next checkout.
ALTER TABLE user_marketing_profile
  ADD COLUMN IF NOT EXISTS background TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS japan_goal TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS category_interest TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS primary_problem TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS target_timeline TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS referrer_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_detail TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS strategy_version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE user_marketing_profile
  DROP CONSTRAINT IF EXISTS user_marketing_profile_referral_source_check;
ALTER TABLE user_marketing_profile
  ADD CONSTRAINT user_marketing_profile_referral_source_check CHECK (
    referral_source IN ('instagram', 'tiktok', 'youtube', 'google', 'teman_keluarga', 'lainnya', 'facebook', 'whatsapp', 'website', 'event')
  );

ALTER TABLE user_marketing_profile
  DROP CONSTRAINT IF EXISTS user_marketing_profile_strategy_check;
ALTER TABLE user_marketing_profile
  ADD CONSTRAINT user_marketing_profile_strategy_check CHECK (
    strategy_version >= 0 AND (strategy_version < 2 OR (
      background IN ('ex_intern_hospitality', 'ex_intern_other', 'fresh_graduate', 'worker', 'other')
      AND japan_goal IN ('first_time', 'return', 'study', 'undecided')
      AND char_length(btrim(category_interest)) BETWEEN 1 AND 160
      AND primary_problem IN ('cost', 'language', 'jobs', 'time', 'trust', 'other', 'undecided')
      AND target_timeline IN ('within_3_months', 'within_6_months', 'within_12_months', 'over_12_months', 'undecided')
      AND char_length(referrer_name) <= 160
      AND (referral_source <> 'teman_keluarga' OR char_length(btrim(referrer_name)) > 0)
      AND char_length(source_detail) <= 160
    ))
  );
