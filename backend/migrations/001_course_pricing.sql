-- Add pricing + marketing fields to courses, plus sensei + testimonials.
-- Idempotent: safe to re-run.

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS price_idr     INT,
  ADD COLUMN IF NOT EXISTS price_label   TEXT,
  ADD COLUMN IF NOT EXISTS period_label  TEXT,
  ADD COLUMN IF NOT EXISTS tagline       TEXT,
  ADD COLUMN IF NOT EXISTS features      JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cta_label     TEXT,
  ADD COLUMN IF NOT EXISTS is_featured   BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS sensei (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  title TEXT,
  bio TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  photo_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sensei_order ON sensei(sort_order);

CREATE TABLE IF NOT EXISTS testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  occupation TEXT,
  photo_url TEXT,
  quote TEXT,
  course_slug TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_testimonials_order ON testimonials(sort_order);
