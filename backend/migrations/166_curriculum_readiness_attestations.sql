-- PR9d: passive owner attestations only. This table does not enable enforce.
-- actor_digest is a hash of the authenticated owner UUID, not a users FK;
-- the erasure path removes matching rows when present.
CREATE TABLE curriculum_readiness_attestations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL,
  module_id UUID NOT NULL,
  actor_digest TEXT NOT NULL CHECK (actor_digest ~ '^sha256:[0-9a-f]{64}$'),
  claim JSONB NOT NULL CHECK (jsonb_typeof(claim) = 'object'),
  claim_digest TEXT NOT NULL CHECK (claim_digest ~ '^sha256:[0-9a-f]{64}$'),
  observed_mode TEXT NOT NULL CHECK (observed_mode IN ('off','audit','warn','enforce')),
  observed_mode_revision TEXT NOT NULL,
  observed_config_revision TEXT NOT NULL,
  observed_boundary_fingerprint TEXT NOT NULL,
  observed_commit_sha TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status = 'unverified'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX curriculum_readiness_attestations_scope_time_idx
  ON curriculum_readiness_attestations(course_id,module_id,created_at DESC,id DESC);

-- Published attestations are append-only. Account erasure may DELETE the
-- pseudonymous actor's rows; no API exposes update or delete.
CREATE FUNCTION curriculum_readiness_attestation_no_update() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'curriculum_readiness_attestation_immutable' USING ERRCODE = '23514';
END $$;
CREATE TRIGGER curriculum_readiness_attestation_no_update
  BEFORE UPDATE ON curriculum_readiness_attestations FOR EACH ROW
  EXECUTE FUNCTION curriculum_readiness_attestation_no_update();
