-- Additive operational records; enrollments, progress and payments remain canonical.
CREATE TABLE student_operation_profiles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  onboarding TEXT NOT NULL DEFAULT 'new' CHECK (onboarding IN ('new','contacted','ready')),
  goal TEXT NOT NULL DEFAULT '' CHECK (length(goal)<=2000),
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  next_follow_up TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version>0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(user_id,course_id)
);
CREATE TABLE student_operation_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  category TEXT NOT NULL CHECK (category IN ('onboarding','access','schedule','academic','payment','inactive','other')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','handling','waiting_student','waiting_team','resolved')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','high','urgent')),
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  escalated_to TEXT NOT NULL DEFAULT '' CHECK (escalated_to IN ('','academic','finance','technology')),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description)<=6000),
  resolution TEXT NOT NULL DEFAULT '' CHECK (length(resolution)<=4000),
  due_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  CHECK (status <> 'resolved' OR (length(trim(resolution))>0 AND resolved_at IS NOT NULL)),
  CHECK (status <> 'waiting_team' OR escalated_to <> '')
);
CREATE INDEX student_operations_cases_queue ON student_operation_cases(course_id,status,due_at);
CREATE INDEX student_operations_cases_user ON student_operation_cases(user_id,course_id);
CREATE TABLE student_operation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES student_operation_cases(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_key TEXT NOT NULL CHECK (event_key IN ('created','updated','status_changed','note')),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note)<=4000),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX student_operations_events_case ON student_operation_events(case_id,occurred_at);
CREATE TABLE student_operation_attendance (
  live_class_id UUID NOT NULL REFERENCES live_classes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('present','late','excused','absent')),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note)<=2000),
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  PRIMARY KEY(live_class_id,user_id)
);
