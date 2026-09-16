-- 147_bunpou_flow_pilot.sql — Bunpou Flow pilot (Paket 1): a companion
-- content envelope on lessons, a narrow session store for Tugas Bunpou
-- Step 1/2 (recognition/controlled) so progress survives a refresh, and
-- evidence metadata on grammar_attempts so a later mastery/review policy
-- (Paket 2/3, NOT this migration) can tell an independent answer from one
-- served after a hint or a revealed key.
--
-- Purely additive: no existing column, table, row, or enum value is
-- changed. In particular grammar_attempts.eval_source keeps its existing
-- CHECK ('ai','cache','smart_review') untouched — the new evaluation_kind
-- column records "deterministic vs ai" instead of overloading that enum.
-- Nothing here changes what a student sees by itself: exposure is gated at
-- the application layer by app_settings.bunpou_flow_pilot_enabled /
-- bunpou_flow_pilot_lesson_id, both absent (= disabled) until an admin sets
-- them. See backend/src/bunpou-flow-service.js and
-- backend/src/routes/grammar-task-sessions.js.
--
-- Companion envelope shape (JSONB, both bunpou_flow_draft and
-- bunpou_flow_published use it — draft is editor-only, published is the
-- frozen snapshot the pilot lesson page and session API read):
--   {
--     schemaVersion: 1,
--     objective: "one sentence, optional",
--     directions: { "<grammarId>": "arahan menyimak, optional" },
--     overlays: {
--       "<grammarId>": {
--         step1: { hint, explanation },
--         step2: { hint, explanation }
--       }
--     },
--     sourceFingerprint: "sha256 of the pattern/meaning/examples/instruction
--                          text this envelope was checked against",
--     editor: { email, at },       -- draft only
--     publishedBy: { email, at }   -- published only
--   }
-- See backend/src/bunpou-flow-service.js for the reader/validator — this
-- migration only opens the storage, it does not interpret the JSON.

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS bunpou_flow_draft JSONB,
  ADD COLUMN IF NOT EXISTS bunpou_flow_published JSONB;

-- One row per in-progress (or recently finished) Tugas Bunpou Step 1/2
-- attempt at a source lesson's paired task. Mirrors the
-- smart_review_sessions / smart_review_session_items shape (migration 133):
-- short-lived, server-authorized, no stored "status" column (a row is
-- simply active while expires_at is in the future, same convention as
-- smart_review_sessions and user_enrollments). This is NOT a second
-- learning engine — it only lets the existing Step 1/2 flow survive a
-- refresh; authoritative evidence still lands in grammar_attempts exactly
-- as before.
CREATE TABLE IF NOT EXISTS grammar_task_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  task_lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  -- Fingerprint of the exact rows the items below were derived from (see
  -- bunpou-flow-service.js#contentRevisionId). A session whose revision no
  -- longer matches the live content is treated as stale on next resume —
  -- graded against its own frozen item snapshots, never against new ones.
  content_revision_id TEXT NOT NULL,
  -- Optimistic locking for concurrent submits from two tabs (T11 in the
  -- implementation plan). Bumped on every item mutation.
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_grammar_task_sessions_resume
  ON grammar_task_sessions(user_id, task_lesson_id, expires_at DESC);

-- item_id is opaque and server-generated (default), never client-supplied —
-- the only identifier a browser ever sees for a given question. `snapshot`
-- stores the FULL derived drill (grammar-drills.js deriveDrills() output —
-- correctIndex/answer/japanese included) so an answer is always graded
-- against exactly what was shown, even if an admin edits the source example
-- while the session is open (T12). `wrong_count` is scoped to this one
-- session item, so — unlike the legacy POST /grammar-task/drill-answer,
-- which scans the last 30 minutes of grammar_attempts — it needs no lookback
-- window: a fresh session always starts every item's counter at zero.
CREATE TABLE IF NOT EXISTS grammar_task_session_items (
  session_id UUID NOT NULL REFERENCES grammar_task_sessions(id) ON DELETE CASCADE,
  item_id UUID NOT NULL DEFAULT gen_random_uuid(),
  grammar_id UUID NOT NULL REFERENCES module_grammar(id) ON DELETE CASCADE,
  step SMALLINT NOT NULL CHECK (step IN (1, 2)),
  question_fingerprint TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  wrong_count INT NOT NULL DEFAULT 0 CHECK (wrong_count >= 0),
  passed BOOLEAN,
  answered_at TIMESTAMPTZ,
  hint_served_at TIMESTAMPTZ,
  revealed_at TIMESTAMPTZ,
  -- Together these let a retried submit be told apart from a genuinely new
  -- one reusing the same id (T09): same id + same hash replays the stored
  -- result, same id + a different hash is rejected as a conflict instead of
  -- silently regrading over the first answer.
  last_request_id TEXT,
  last_request_payload_hash TEXT,
  PRIMARY KEY (session_id, item_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_grammar_task_session_items_slot
  ON grammar_task_session_items(session_id, grammar_id, step);

-- Evidence metadata for the pilot session flow, all nullable. Legacy rows
-- and legacy callers (POST /grammar-task/drill-answer, POST
-- /grammar-task/evaluate — neither one touched by this migration) simply
-- never populate these; grammar-mastery.js#loadMastery selects an explicit
-- column list (grammar_id, passed, created_at, source, primary_error), so it
-- is unaffected either way and needs no change.
ALTER TABLE grammar_attempts
  ADD COLUMN IF NOT EXISTS practice_session_id UUID REFERENCES grammar_task_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS practice_item_id UUID,
  ADD COLUMN IF NOT EXISTS content_revision_id TEXT,
  ADD COLUMN IF NOT EXISTS question_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS request_id TEXT,
  ADD COLUMN IF NOT EXISTS request_payload_hash TEXT,
  ADD COLUMN IF NOT EXISTS attempt_ordinal INT,
  ADD COLUMN IF NOT EXISTS assistance_state TEXT
    CHECK (assistance_state IS NULL OR assistance_state IN ('none_observed', 'hint_served', 'answer_served', 'correction_served', 'unknown')),
  ADD COLUMN IF NOT EXISTS independent_eligible BOOLEAN,
  ADD COLUMN IF NOT EXISTS evaluation_kind TEXT
    CHECK (evaluation_kind IS NULL OR evaluation_kind IN ('deterministic', 'ai')),
  ADD COLUMN IF NOT EXISTS evidence_schema_version SMALLINT;

-- Idempotent submit (T08/T09): a request_id is only unique when present, so
-- every legacy insert (which never sets it) is never constrained by this
-- index, and two concurrent requests carrying the same request_id for the
-- same user collide here instead of double-recording an attempt.
CREATE UNIQUE INDEX IF NOT EXISTS idx_grammar_attempts_user_request
  ON grammar_attempts(user_id, request_id) WHERE request_id IS NOT NULL;

-- Lets a later attempt on the same question recognise "this exact question
-- was already answer-revealed to this student", even from inside a brand
-- new session (see bunpou-flow-service.js#taintedFingerprint).
CREATE INDEX IF NOT EXISTS idx_grammar_attempts_question_fingerprint
  ON grammar_attempts(user_id, question_fingerprint) WHERE question_fingerprint IS NOT NULL;
