-- A self-assessment supplied by the student, not a certificate or test result.
-- Empty historical values preserve existing answers until the next checkout.
ALTER TABLE user_marketing_profile
  ADD COLUMN IF NOT EXISTS japanese_level TEXT NOT NULL DEFAULT '';

ALTER TABLE user_marketing_profile DROP CONSTRAINT IF EXISTS user_marketing_profile_japanese_level_check;
ALTER TABLE user_marketing_profile ADD CONSTRAINT user_marketing_profile_japanese_level_check CHECK (
  japanese_level IN ('', 'new_to_japanese', 'basics', 'n5', 'n4', 'n3_plus', 'unsure')
);
