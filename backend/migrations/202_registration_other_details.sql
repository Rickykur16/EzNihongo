-- Add optional storage without rewriting legacy answers or changing strategy v2.
-- The application requests missing details only when their parent choice needs it.
ALTER TABLE user_marketing_profile
  ADD COLUMN IF NOT EXISTS internship_field TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS internship_field_other TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS background_other TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS learning_goal_other TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS primary_problem_other TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS referral_source_other TEXT NOT NULL DEFAULT '';

ALTER TABLE user_marketing_profile DROP CONSTRAINT IF EXISTS user_marketing_profile_other_details_check;
ALTER TABLE user_marketing_profile ADD CONSTRAINT user_marketing_profile_other_details_check CHECK (
  internship_field IN ('', 'hospitality', 'manufacturing', 'construction', 'agriculture', 'caregiving', 'fisheries', 'other')
  AND char_length(internship_field_other) <= 160
  AND char_length(background_other) <= 160
  AND char_length(learning_goal_other) <= 160
  AND char_length(primary_problem_other) <= 160
  AND char_length(referral_source_other) <= 160
);
