CREATE TABLE IF NOT EXISTS live_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(BTRIM(title)) BETWEEN 1 AND 240),
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  meeting_url TEXT,
  recording_url TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_live_classes_course_schedule ON live_classes(course_id, status, starts_at);

CREATE TABLE IF NOT EXISTS live_class_lessons (
  live_class_id UUID NOT NULL REFERENCES live_classes(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (live_class_id, lesson_id)
);
CREATE INDEX IF NOT EXISTS idx_live_class_lessons_lesson ON live_class_lessons(lesson_id);

DROP TRIGGER IF EXISTS live_classes_updated_at ON live_classes;
CREATE TRIGGER live_classes_updated_at BEFORE UPDATE ON live_classes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
