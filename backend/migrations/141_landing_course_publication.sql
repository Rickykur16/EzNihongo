-- Existing prices are deliberately not published on the new landing page.
-- Admin must explicitly confirm them after reviewing the current offer.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS landing_price_published boolean NOT NULL DEFAULT false;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS landing_schedule text NOT NULL DEFAULT '';
