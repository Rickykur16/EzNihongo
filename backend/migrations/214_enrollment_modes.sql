-- One curriculum, two ways to enroll. Existing access keeps its expiry and
-- Bootcamp privileges; the one-year term applies to new registrations only.
ALTER TABLE courses
  ADD COLUMN bootcamp_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN self_learning_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN self_learning_price_idr integer NOT NULL DEFAULT 249000
    CHECK (self_learning_price_idr > 0);

UPDATE courses SET self_learning_enabled = true WHERE slug = 'n5';

ALTER TABLE orders
  ADD COLUMN learning_mode text NOT NULL DEFAULT 'bootcamp'
    CHECK (learning_mode IN ('self_learning', 'bootcamp'));
ALTER TABLE user_enrollments
  ADD COLUMN learning_mode text NOT NULL DEFAULT 'bootcamp'
    CHECK (learning_mode IN ('self_learning', 'bootcamp'));
