-- EzNihongo database schema
-- Run as: psql -U eznihongo_app -h localhost -d eznihongo -f schema.sql

-- ===== AUTH =====

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  google_name TEXT,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  user_agent TEXT,
  ip_address INET
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(refresh_token_hash);

-- ===== CONTENT =====

CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  level TEXT,
  thumbnail_url TEXT,
  sort_order INT DEFAULT 0,
  is_published BOOLEAN DEFAULT FALSE,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  price_idr INT,
  price_label TEXT,
  period_label TEXT,
  tagline TEXT,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  cta_label TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INT DEFAULT 0,
  jf_topic TEXT,
  cefr_level TEXT,
  estimated_hours NUMERIC(5,2),
  title_en TEXT,
  scenario TEXT,
  cando_statements JSONB NOT NULL DEFAULT '[]'::jsonb,
  skill_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  quiz_spec JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(course_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_modules_course ON modules(course_id, sort_order);

CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'intro' CHECK (type IN ('intro','kosakata','kanji','grammar','praktik','review','video','text')),
  content TEXT,
  video_url TEXT,
  duration_minutes INT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(module_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_lessons_module ON lessons(module_id, sort_order);

CREATE TABLE IF NOT EXISTS module_vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  japanese TEXT NOT NULL,
  reading TEXT,
  indonesian TEXT,
  category TEXT,
  note TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vocab_module ON module_vocabulary(module_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_vocab_lesson ON module_vocabulary(lesson_id, sort_order);

CREATE TABLE IF NOT EXISTS module_grammar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  pattern TEXT NOT NULL,
  meaning TEXT,
  example TEXT,
  notes TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grammar_module ON module_grammar(module_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_grammar_lesson ON module_grammar(lesson_id, sort_order);

-- ===== SENSEI & TESTIMONIALS =====

CREATE TABLE IF NOT EXISTS sensei (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  title TEXT,
  bio TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  photo_url TEXT,
  photo_position TEXT,
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
  photo_position TEXT,
  quote TEXT,
  course_slug TEXT REFERENCES courses(slug) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_testimonials_order ON testimonials(sort_order);

-- ===== QUIZ =====

CREATE TABLE IF NOT EXISTS quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice','fill_blank')),
  correct_answer TEXT,
  explanation TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_lesson ON quiz_questions(lesson_id, sort_order);

CREATE TABLE IF NOT EXISTS quiz_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_quiz_options_question ON quiz_options(question_id, sort_order);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  score INT,
  total_questions INT,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_lesson ON quiz_attempts(user_id, lesson_id);

-- ===== USER DATA =====

CREATE TABLE IF NOT EXISTS user_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_user ON user_enrollments(user_id);

CREATE TABLE IF NOT EXISTS user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_lesson ON user_progress(lesson_id);

CREATE TABLE IF NOT EXISTS user_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  xp INT DEFAULT 0,
  level INT DEFAULT 1,
  streak_days INT DEFAULT 0,
  last_active_date DATE,
  total_lessons_completed INT DEFAULT 0,
  total_minutes_learned INT DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===== DISCUSSIONS =====

CREATE TABLE IF NOT EXISTS discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES discussions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_admin_reply BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discussions_lesson ON discussions(lesson_id, created_at);
CREATE INDEX IF NOT EXISTS idx_discussions_parent ON discussions(parent_id);
CREATE INDEX IF NOT EXISTS idx_discussions_user ON discussions(user_id);

-- ===== updated_at trigger =====

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'users_updated_at') THEN
    CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'courses_updated_at') THEN
    CREATE TRIGGER courses_updated_at BEFORE UPDATE ON courses
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'modules_updated_at') THEN
    CREATE TRIGGER modules_updated_at BEFORE UPDATE ON modules
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'lessons_updated_at') THEN
    CREATE TRIGGER lessons_updated_at BEFORE UPDATE ON lessons
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'quiz_questions_updated_at') THEN
    CREATE TRIGGER quiz_questions_updated_at BEFORE UPDATE ON quiz_questions
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'user_progress_updated_at') THEN
    CREATE TRIGGER user_progress_updated_at BEFORE UPDATE ON user_progress
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'user_stats_updated_at') THEN
    CREATE TRIGGER user_stats_updated_at BEFORE UPDATE ON user_stats
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'discussions_updated_at') THEN
    CREATE TRIGGER discussions_updated_at BEFORE UPDATE ON discussions
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'module_vocabulary_updated_at') THEN
    CREATE TRIGGER module_vocabulary_updated_at BEFORE UPDATE ON module_vocabulary
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'module_grammar_updated_at') THEN
    CREATE TRIGGER module_grammar_updated_at BEFORE UPDATE ON module_grammar
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
