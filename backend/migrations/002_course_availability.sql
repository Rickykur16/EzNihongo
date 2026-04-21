-- 002: "Coming soon" state for courses.
-- is_published controls whether the card shows on the landing page at all.
-- is_available controls whether that card can actually be purchased.
-- Together they give three states: Draft (hidden) / Segera Hadir / Live.
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT TRUE;
