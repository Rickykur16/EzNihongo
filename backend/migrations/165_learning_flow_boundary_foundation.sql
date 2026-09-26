-- PR1 foundation. All existing learning rows retain their contents and behavior.
-- Deploy note: the previous backend's account-erasure guard will reject the
-- new users FK between migration and service restart. It fails closed before
-- anonymization; retry requests after the backend restarts. The new backend
-- handles both pre- and post-migration schemas via optional-table cleanup.
ALTER TABLE courses ADD COLUMN curriculum_boundary_mode TEXT NOT NULL DEFAULT 'off'
  CHECK (curriculum_boundary_mode IN ('off', 'audit', 'warn', 'enforce'));

CREATE TABLE course_prerequisites (
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  prerequisite_course_id UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  PRIMARY KEY (course_id, prerequisite_course_id),
  CHECK (course_id <> prerequisite_course_id)
);
CREATE INDEX course_prerequisites_reverse_idx ON course_prerequisites(prerequisite_course_id);

-- Missing courses are reported, never fabricated. No course mode is activated here.
DO $$
DECLARE n4_id UUID; n5_id UUID;
BEGIN
  SELECT id INTO n4_id FROM courses WHERE slug = 'n4';
  SELECT id INTO n5_id FROM courses WHERE slug = 'n5';
  IF n4_id IS NOT NULL AND n5_id IS NOT NULL THEN
    INSERT INTO course_prerequisites(course_id, prerequisite_course_id)
    VALUES (n4_id, n5_id) ON CONFLICT DO NOTHING;
  ELSE
    RAISE NOTICE 'N4→N5 prerequisite not seeded: n4 or n5 course is missing';
  END IF;
END $$;

ALTER TABLE module_grammar ADD COLUMN communication_goal TEXT;

CREATE FUNCTION grammar_dialog_options_valid(items JSONB) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE option_value JSONB; normalized TEXT; seen TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF jsonb_typeof(items) <> 'array' THEN RETURN FALSE; END IF;
  IF jsonb_array_length(items) NOT BETWEEN 3 AND 4 THEN RETURN FALSE; END IF;
  FOR option_value IN SELECT value FROM jsonb_array_elements(items) LOOP
    IF jsonb_typeof(option_value) <> 'string' THEN RETURN FALSE; END IF;
    -- Collapse ordinary and Japanese full-width whitespace before comparing.
    normalized := lower(btrim(regexp_replace(
      option_value #>> '{}', '[[:space:]　]+', ' ', 'g'
    )));
    IF normalized = '' OR normalized = ANY(seen) THEN RETURN FALSE; END IF;
    seen := array_append(seen, normalized);
  END LOOP;
  RETURN TRUE;
END $$;

CREATE TABLE grammar_dialog_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grammar_id UUID NOT NULL REFERENCES module_grammar(id) ON DELETE RESTRICT,
  source_lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('comprehension', 'transfer')),
  prompt TEXT NOT NULL CHECK (btrim(prompt) <> ''),
  options JSONB NOT NULL CHECK (grammar_dialog_options_valid(options)),
  correct_index INT NOT NULL CHECK (correct_index >= 0 AND correct_index < jsonb_array_length(options)),
  explanation TEXT NOT NULL CHECK (btrim(explanation) <> ''),
  sort_order INT NOT NULL CHECK (sort_order >= 0),
  question_version UUID NOT NULL DEFAULT gen_random_uuid(),
  question_fingerprint TEXT NOT NULL CHECK (btrim(question_fingerprint) <> ''),
  dialogue_fingerprint TEXT NOT NULL CHECK (btrim(dialogue_fingerprint) <> ''),
  evidence JSONB,
  source_kind TEXT CHECK (source_kind IS NULL OR source_kind IN ('manual', 'generated', 'legacy_bunpou')),
  source_key TEXT,
  source_fingerprint TEXT,
  boundary_fingerprint TEXT,
  validator_version TEXT,
  state TEXT NOT NULL DEFAULT 'archived' CHECK (state IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (source_key IS NULL OR (source_kind IS NOT NULL AND btrim(source_key) <> '')),
  CHECK (kind <> 'comprehension' OR state <> 'active' OR evidence IS NOT NULL)
);
CREATE UNIQUE INDEX grammar_dialog_questions_active_slot_idx
  ON grammar_dialog_questions(grammar_id, kind, sort_order) WHERE state = 'active';
CREATE UNIQUE INDEX grammar_dialog_questions_source_idx
  ON grammar_dialog_questions(source_kind, source_key) WHERE source_key IS NOT NULL;
CREATE INDEX grammar_dialog_questions_load_idx
  ON grammar_dialog_questions(grammar_id, state, kind, sort_order);

-- Keep placement coherent with the existing grammar/lesson ownership chain.
-- Legacy grammar without a lesson may use an editor-verified source lesson in
-- the same module; a grammar with a lesson must use that exact lesson.
CREATE FUNCTION grammar_dialog_question_guard() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE owner_module UUID; owner_lesson UUID; source_module UUID;
BEGIN
  SELECT module_id, lesson_id INTO owner_module, owner_lesson
    FROM module_grammar WHERE id = NEW.grammar_id FOR SHARE;
  SELECT module_id INTO source_module FROM lessons
    WHERE id = NEW.source_lesson_id FOR SHARE;
  IF owner_module IS DISTINCT FROM source_module
     OR (owner_lesson IS NOT NULL AND owner_lesson <> NEW.source_lesson_id) THEN
    RAISE EXCEPTION 'grammar_dialog_question_owner_mismatch' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.grammar_id IS DISTINCT FROM OLD.grammar_id
       OR NEW.source_lesson_id IS DISTINCT FROM OLD.source_lesson_id
       OR NEW.kind IS DISTINCT FROM OLD.kind THEN
      RAISE EXCEPTION 'grammar_dialog_question_identity_immutable' USING ERRCODE = '23514';
    END IF;
    IF (NEW.prompt, NEW.options, NEW.correct_index, NEW.explanation,
        NEW.evidence, NEW.dialogue_fingerprint) IS DISTINCT FROM
       (OLD.prompt, OLD.options, OLD.correct_index, OLD.explanation,
        OLD.evidence, OLD.dialogue_fingerprint)
       AND NEW.question_version = OLD.question_version THEN
      RAISE EXCEPTION 'grammar_dialog_question_version_required' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER grammar_dialog_question_guard
  BEFORE INSERT OR UPDATE ON grammar_dialog_questions FOR EACH ROW
  EXECUTE FUNCTION grammar_dialog_question_guard();

CREATE TABLE dialogue_question_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  question_id UUID NOT NULL REFERENCES grammar_dialog_questions(id) ON DELETE RESTRICT,
  grammar_id UUID NOT NULL REFERENCES module_grammar(id) ON DELETE RESTRICT,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
  request_id UUID NOT NULL,
  request_payload_hash TEXT NOT NULL CHECK (btrim(request_payload_hash) <> ''),
  question_version UUID NOT NULL,
  question_fingerprint TEXT NOT NULL,
  dialogue_fingerprint TEXT NOT NULL,
  boundary_fingerprint TEXT,
  question_snapshot JSONB NOT NULL CHECK (jsonb_typeof(question_snapshot) = 'object'),
  selected_index INT NOT NULL CHECK (selected_index >= 0),
  is_correct BOOLEAN NOT NULL,
  response_snapshot JSONB NOT NULL CHECK (jsonb_typeof(response_snapshot) = 'object'),
  activity_type TEXT NOT NULL DEFAULT 'dialogue_comprehension' CHECK (activity_type = 'dialogue_comprehension'),
  placement TEXT NOT NULL DEFAULT 'inline_lesson' CHECK (placement = 'inline_lesson'),
  evidence_policy TEXT NOT NULL DEFAULT 'formative_only' CHECK (evidence_policy = 'formative_only'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, request_id)
);
CREATE INDEX dialogue_question_attempts_user_question_idx
  ON dialogue_question_attempts(user_id, question_id, created_at DESC);
CREATE INDEX dialogue_question_attempts_question_version_idx
  ON dialogue_question_attempts(question_id, question_version);

CREATE TABLE curriculum_boundary_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  module_id UUID REFERENCES modules(id) ON DELETE SET NULL,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  content_type TEXT,
  content_id UUID,
  content_fingerprint TEXT,
  boundary_fingerprint TEXT,
  validator_version TEXT,
  policy_version TEXT,
  operation TEXT NOT NULL CHECK (operation IN ('audit', 'generate', 'live_write', 'publish')),
  mode TEXT NOT NULL CHECK (mode IN ('off', 'audit', 'warn', 'enforce')),
  validation_status TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('allowed', 'allowed_with_warning', 'blocked', 'unavailable')),
  violations JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(violations) = 'array'),
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(warnings) = 'array'),
  usage JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(usage) = 'object'),
  integrity_issues JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(integrity_issues) = 'array'),
  correlation_id TEXT,
  audit_run_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX curriculum_boundary_reports_course_time_idx
  ON curriculum_boundary_reports(course_id, created_at DESC);
CREATE INDEX curriculum_boundary_reports_content_idx
  ON curriculum_boundary_reports(content_type, content_id, content_fingerprint);
CREATE UNIQUE INDEX curriculum_boundary_reports_audit_run_idx
  ON curriculum_boundary_reports(
    audit_run_id,
    COALESCE(content_type, ''),
    COALESCE(content_id, '00000000-0000-0000-0000-000000000000'::UUID),
    COALESCE(content_fingerprint, ''),
    COALESCE(boundary_fingerprint, ''),
    COALESCE(validator_version, ''))
  WHERE audit_run_id IS NOT NULL;

ALTER TABLE grammar_task_sessions ADD COLUMN flow_version SMALLINT NOT NULL DEFAULT 1
  CHECK (flow_version IN (1, 2));

-- Existing app_settings has no flag row; this row is explicitly disabled.
INSERT INTO app_settings(key, value)
VALUES ('learning_flow_communication_v1', '{"enabled":false,"courseIds":[],"moduleIds":[],"lessonIds":[]}')
ON CONFLICT (key) DO NOTHING;
