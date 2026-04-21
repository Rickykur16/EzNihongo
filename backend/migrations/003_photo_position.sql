-- Allow admin to control where the photo is anchored when cropped by
-- object-fit: cover. Stored as a CSS `object-position` value, e.g.
-- "center center", "center top", "50% 20%". NULL = default (center).

ALTER TABLE sensei        ADD COLUMN IF NOT EXISTS photo_position TEXT;
ALTER TABLE testimonials  ADD COLUMN IF NOT EXISTS photo_position TEXT;
