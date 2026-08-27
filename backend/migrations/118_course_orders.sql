-- Phase 2 — course purchase system (manual bank transfer, provider-agnostic).
--
-- Reviewed decision, not a blanket default: `is_free` is added NULLABLE with
-- NO default. A course sitting at NULL ("not yet classified") is blocked from
-- BOTH the free self-enroll path AND the paid order path — see progress.js
-- (`is_free IS TRUE`) and orders.js (`is_free IS FALSE`), both of which
-- exclude NULL by construction. Only `n5` is explicitly backfilled here
-- (Phase 2 scope is n5; repo evidence — seed-phase9.sql price_idr=349000,
-- seed-phase9-cleanup.sql's own comment that N5/N4/N3/N2/SSW are real sold
-- products — points to n5 being paid, confirmed against the live courses
-- table before this migration was written). Every other existing course
-- (n4, n3, n2, ssw, anything else) stays NULL until an admin explicitly
-- classifies it via the course edit form (see admin.html — 3-way
-- Belum ditentukan/Gratis/Berbayar selector, mirroring the existing 3-way
-- draft/coming_soon/live status selector). `SET NOT NULL` is a deliberately
-- deferred follow-up migration once every course has been reviewed — not
-- bundled here.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_free BOOLEAN;
UPDATE courses SET is_free = FALSE WHERE slug = 'n5' AND is_free IS NULL;

-- Purchase intent — one row per attempt to buy one course. Amount is always
-- a server-computed snapshot of courses.price_idr at creation time, never
-- client-supplied (price-manipulation defense). course_title_snapshot keeps
-- order history readable even if the course is later renamed.
--
-- Lifecycle: pending_payment -> awaiting_review -> approved | rejected
-- (rejected is NOT terminal — a new proof submission flips the order back
-- to awaiting_review) -> expired | cancelled (terminal dead ends). See
-- orders.js for the guarded state transitions.
CREATE TABLE IF NOT EXISTS orders (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number           TEXT UNIQUE NOT NULL,
  user_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id              UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  course_title_snapshot  TEXT NOT NULL,
  amount_idr             INT NOT NULL,
  currency               TEXT NOT NULL DEFAULT 'IDR',
  payment_provider       TEXT NOT NULL DEFAULT 'manual_transfer'
                            CHECK (payment_provider IN ('manual_transfer', 'midtrans')),
  status                 TEXT NOT NULL DEFAULT 'pending_payment'
                            CHECK (status IN ('pending_payment','awaiting_review','approved','rejected','expired','cancelled')),
  expires_at             TIMESTAMPTZ NOT NULL,
  approved_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_course ON orders(course_id);

-- One row per payment attempt/proof submission against an order — supports
-- resubmission-after-rejection natively (append-only, never deleted, so the
-- full history is the audit trail: no separate log table). Only manual
-- transfer fields are populated today; external_reference/raw_payload exist
-- so a future provider (Midtrans) can reuse this same table via a webhook
-- instead of the proof_image + admin-review path, with zero schema change.
CREATE TABLE IF NOT EXISTS order_payments (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider                TEXT NOT NULL DEFAULT 'manual_transfer',
  status                  TEXT NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','approved','rejected','superseded')),
  proof_image             BYTEA,
  proof_mime              TEXT,
  proof_filename          TEXT,
  claimed_bank_name       TEXT,
  claimed_sender_name     TEXT,
  claimed_amount_idr      INT,
  claimed_transferred_at  TIMESTAMPTZ,
  external_reference      TEXT,
  raw_payload              JSONB,
  submitted_by            UUID NOT NULL REFERENCES users(id),
  submitted_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by             UUID REFERENCES users(id),
  reviewed_at             TIMESTAMPTZ,
  rejection_reason        TEXT
);
CREATE INDEX IF NOT EXISTS idx_order_payments_order ON order_payments(order_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_payments_pending ON order_payments(order_id) WHERE status = 'pending';

-- Traceability link from an entitlement back to the order that paid for it.
-- Nullable — self_enroll/admin_grant entitlements have no order.
ALTER TABLE user_enrollments
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;
