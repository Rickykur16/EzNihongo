-- VERSIONED OPT-IN CONTRACT, NOT AN AUTOMATIC PRODUCTION MIGRATION.
-- Deliberately outside migrations/. Disposable tests and company-migrations/run.js
-- are the only consumers. Explicit application requires the compatible erasure
-- release plus reviewed backup/restore, RBAC and rollout gates.
-- No role/member seeds, grants, existing-table alterations or business writes.

CREATE TABLE staff_roles (
  role_key TEXT PRIMARY KEY,
  division_key TEXT CHECK (division_key IN ('technology', 'academic', 'marketing', 'operations', 'finance')),
  label TEXT NOT NULL
);

CREATE TABLE staff_permissions (
  permission_key TEXT PRIMARY KEY,
  description TEXT NOT NULL
);

CREATE TABLE staff_role_permissions (
  role_key TEXT NOT NULL REFERENCES staff_roles(role_key) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES staff_permissions(permission_key) ON DELETE CASCADE,
  PRIMARY KEY (role_key, permission_key)
);

CREATE TABLE staff_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_key TEXT NOT NULL REFERENCES staff_roles(role_key) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  revoked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  CHECK ((status = 'active' AND revoked_at IS NULL) OR (status = 'revoked' AND revoked_at IS NOT NULL)),
  UNIQUE (user_id, role_key)
);
CREATE INDEX staff_memberships_granted_by_idx ON staff_memberships(granted_by);
CREATE INDEX staff_memberships_revoked_by_idx ON staff_memberships(revoked_by);

CREATE TABLE staff_membership_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID NOT NULL REFERENCES staff_memberships(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global', 'course')),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  CHECK ((scope_type = 'global' AND course_id IS NULL) OR (scope_type = 'course' AND course_id IS NOT NULL))
);
CREATE UNIQUE INDEX staff_scope_global_unique ON staff_membership_scopes(membership_id) WHERE scope_type = 'global';
CREATE UNIQUE INDEX staff_scope_course_unique ON staff_membership_scopes(membership_id, course_id) WHERE scope_type = 'course';
CREATE INDEX staff_scope_course_idx ON staff_membership_scopes(course_id);

-- Intentionally no JSON payload, email/name snapshot, IP, message text, or
-- arbitrary target ID. Controlled event keys only; no student/payment content.
CREATE TABLE staff_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_key TEXT NOT NULL CHECK (event_key IN ('membership.granted', 'membership.revoked', 'scope.changed', 'access.denied')),
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'denied', 'failure')),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  subject_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_erased_at TIMESTAMPTZ,
  subject_erased_at TIMESTAMPTZ,
  CHECK (actor_erased_at IS NULL OR actor_user_id IS NULL),
  CHECK (subject_erased_at IS NULL OR subject_user_id IS NULL)
);
CREATE INDEX staff_audit_actor_idx ON staff_audit_events(actor_user_id);
CREATE INDEX staff_audit_subject_idx ON staff_audit_events(subject_user_id);
CREATE INDEX staff_audit_occurred_idx ON staff_audit_events(occurred_at);
