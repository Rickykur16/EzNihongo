-- Add FK from testimonials.course_slug to courses.slug so admins can't
-- orphan-reference a deleted or typo'd course slug. ON DELETE SET NULL
-- so removing a course doesn't wipe the testimonial, just unlinks it.
--
-- Not idempotent by default (ALTER TABLE ADD CONSTRAINT fails on rerun).
-- Wrap in DO block to make it safe.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'testimonials_course_slug_fkey'
      AND table_name = 'testimonials'
  ) THEN
    -- Clean up any existing orphans first (set to NULL) so the ALTER succeeds.
    UPDATE testimonials t
    SET course_slug = NULL
    WHERE course_slug IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM courses c WHERE c.slug = t.course_slug);

    ALTER TABLE testimonials
      ADD CONSTRAINT testimonials_course_slug_fkey
      FOREIGN KEY (course_slug) REFERENCES courses(slug) ON DELETE SET NULL;
  END IF;
END $$;
