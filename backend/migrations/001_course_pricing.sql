-- Add pricing + marketing fields to courses.
-- sensei + testimonials tables live in schema.sql (canonical). This migration
-- used to redefine them here, but that created two sources of truth and
-- drifted (e.g. photo_position was added later via 003). Keep this file
-- scoped to the one thing it actually does: ALTER courses.
-- Idempotent: safe to re-run.

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS price_idr     INT,
  ADD COLUMN IF NOT EXISTS price_label   TEXT,
  ADD COLUMN IF NOT EXISTS period_label  TEXT,
  ADD COLUMN IF NOT EXISTS tagline       TEXT,
  ADD COLUMN IF NOT EXISTS features      JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cta_label     TEXT,
  ADD COLUMN IF NOT EXISTS is_featured   BOOLEAN NOT NULL DEFAULT FALSE;
