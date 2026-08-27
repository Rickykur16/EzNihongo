-- Phase 1 — Course Access Foundation.
--
-- `user_enrollments` already scopes access per (user, course) — N5 vs N4 vs
-- N3 etc. are separate course_id rows, so enrolling in one never implies
-- access to another. What it lacked was lifecycle: every row was implicitly
-- "active forever" with no way to revoke or time-box access. Rather than
-- add a parallel "entitlements" table, this extends the existing enrollment
-- row into the entitlement record — it's already the single source of
-- truth the app reads (see content.js / progress.js / welcome.html).
--
-- 'expired' is intentionally NOT a stored status value: it's computed at
-- authorization time as `status = 'active' AND expires_at < NOW()`, so nothing
-- needs a cron job to flip rows the instant a time-boxed grant lapses.
--
-- `source` records how the row came to exist (self-service today; ready for
-- 'purchase' once Midtrans checkout lands on the main site — not built in
-- this phase). Not used for authorization, informational only.

ALTER TABLE user_enrollments
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked')),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'self_enroll'
    CHECK (source IN ('self_enroll', 'admin_grant', 'purchase')),
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

-- Authorization check (hasCourseAccess) filters on user_id + course_id +
-- status='active' on every gated request — index the hot path.
CREATE INDEX IF NOT EXISTS idx_enrollments_user_active
  ON user_enrollments (user_id, course_id)
  WHERE status = 'active';
