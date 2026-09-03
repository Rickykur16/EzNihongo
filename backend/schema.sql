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
  -- Nullable, no default, deliberately: a course sitting at NULL is blocked
  -- from BOTH self-enroll and order purchase until an admin explicitly
  -- classifies it (see admin.html course form + migration 121).
  is_free BOOLEAN,
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
  title_en TEXT,
  scenario TEXT,
  section_name TEXT,
  cando_statements JSONB NOT NULL DEFAULT '[]'::jsonb,
  skill_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  quiz_spec JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(course_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_modules_course ON modules(course_id, sort_order);

-- Satu sumber video dapat dipakai oleh beberapa pelajaran. Saat ini provider
-- yang didukung adalah YouTube; external_id menyimpan YouTube video ID, bukan
-- URL embed, supaya URL yang dipaste admin bisa dinormalisasi di API.
CREATE TABLE IF NOT EXISTS video_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'youtube' CHECK (provider IN ('youtube')),
  external_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  title TEXT,
  duration_seconds INT CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_video_sources_provider_external
  ON video_sources(provider, external_id);

CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('video','quiz','text','deck','kanji','grammar_task','kana')),
  content TEXT,
  -- Legacy direct/Bunny iframe URL. New YouTube video lessons should use the
  -- reusable video_source_id plus the segment timestamps below.
  video_url TEXT,
  -- A source with lesson segments cannot be deleted accidentally; otherwise
  -- SET NULL would leave orphaned start/end timestamps behind.
  video_source_id UUID REFERENCES video_sources(id) ON DELETE RESTRICT,
  video_start_seconds INT CHECK (video_start_seconds IS NULL OR video_start_seconds >= 0),
  video_end_seconds INT CHECK (video_end_seconds IS NULL OR video_end_seconds > 0),
  duration_minutes INT,
  sort_order INT DEFAULT 0,
  passing_score_pct INT NOT NULL DEFAULT 70,
  questions_per_attempt INT,
  cooldown_hours INT NOT NULL DEFAULT 12,
  popup_after_lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (video_source_id IS NOT NULL OR (video_start_seconds IS NULL AND video_end_seconds IS NULL)),
  CHECK (video_end_seconds IS NULL OR video_start_seconds IS NULL OR video_end_seconds > video_start_seconds),
  UNIQUE(module_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_lessons_module ON lessons(module_id, sort_order);

CREATE TABLE IF NOT EXISTS module_vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  japanese TEXT NOT NULL,
  reading TEXT,
  romaji TEXT,
  indonesian TEXT,
  category TEXT,
  note TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vocab_module ON module_vocabulary(module_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_vocab_lesson ON module_vocabulary(lesson_id, sort_order);

CREATE TABLE IF NOT EXISTS vocabulary_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vocabulary_id UUID NOT NULL REFERENCES module_vocabulary(id) ON DELETE CASCADE,
  japanese TEXT NOT NULL,
  reading TEXT,
  highlight TEXT,
  indonesian TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vocab_examples_vocab ON vocabulary_examples(vocabulary_id, sort_order);

CREATE TABLE IF NOT EXISTS lesson_deck_items (
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  vocabulary_id UUID NOT NULL REFERENCES module_vocabulary(id) ON DELETE CASCADE,
  sort_order INT DEFAULT 0,
  accent_color TEXT,
  PRIMARY KEY (lesson_id, vocabulary_id)
);

CREATE INDEX IF NOT EXISTS idx_deck_items_lesson ON lesson_deck_items(lesson_id, sort_order);

-- Kana (hiragana/katakana) — bank karakter global + join ke pelajaran 'kana'
-- + contoh kata. Lihat migration 037. Mirror struktur deck (bank + join + examples).
CREATE TABLE IF NOT EXISTS kana_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('hiragana', 'katakana')),
  romaji TEXT NOT NULL,
  mnemonic TEXT,
  group_label TEXT,
  variant_type TEXT NOT NULL DEFAULT 'base'
    CHECK (variant_type IN ('base', 'dakuten', 'handakuten', 'youon', 'special')),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kind, character)
);

CREATE TABLE IF NOT EXISTS lesson_kana_items (
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  kana_id UUID NOT NULL REFERENCES kana_items(id) ON DELETE CASCADE,
  sort_order INT DEFAULT 0,
  PRIMARY KEY (lesson_id, kana_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_kana_items_lesson ON lesson_kana_items(lesson_id, sort_order);

CREATE TABLE IF NOT EXISTS kana_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kana_id UUID NOT NULL REFERENCES kana_items(id) ON DELETE CASCADE,
  japanese TEXT NOT NULL,
  reading TEXT,
  highlight TEXT,
  indonesian TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kana_examples_kana ON kana_examples(kana_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_deck_items_vocab ON lesson_deck_items(vocabulary_id);

CREATE TABLE IF NOT EXISTS module_grammar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  pattern TEXT NOT NULL,
  meaning TEXT,
  example TEXT,
  notes TEXT,
  example_dialog TEXT,
  example_dialog_id TEXT,
  -- Pengecoh Step 1 Tugas Bunpou, satu per baris (migration 124). Diisi lewat
  -- tombol "✨ Pengecoh" di admin (draft AI, di-review admin). NULL = pakai
  -- penurunan lama, yaitu arti pola lain di bab yang sama sebagai pengecoh.
  recognition_distractors TEXT,
  -- Pengecoh Step 2 Tugas Bunpou, satu per baris (migration 125). NULL = pakai
  -- pengecoh turunan aturan. Lihat catatan di migrasinya soal kenapa disimpan
  -- per-pola, bukan per-contoh kalimat.
  controlled_distractors TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grammar_module ON module_grammar(module_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_grammar_lesson ON module_grammar(lesson_id, sort_order);

-- Multi contoh kalimat per pola grammar (mirror vocabulary_examples).
-- Lihat migration 031.
CREATE TABLE IF NOT EXISTS grammar_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grammar_id UUID NOT NULL REFERENCES module_grammar(id) ON DELETE CASCADE,
  japanese TEXT NOT NULL,
  highlight TEXT,
  indonesian TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grammar_examples_grammar
  ON grammar_examples(grammar_id, sort_order);

-- Grammar picked into a 'grammar_task' lesson (reused from the module bank).
-- instruction = admin task prompt per pattern; required_count = sentences the
-- student must complete for that pattern.
CREATE TABLE IF NOT EXISTS lesson_grammar_task_items (
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  grammar_id UUID NOT NULL REFERENCES module_grammar(id) ON DELETE CASCADE,
  sort_order INT DEFAULT 0,
  instruction TEXT,
  required_count INT NOT NULL DEFAULT 1,
  PRIMARY KEY (lesson_id, grammar_id)
);

CREATE INDEX IF NOT EXISTS idx_grammar_task_items_lesson ON lesson_grammar_task_items(lesson_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_grammar_task_items_grammar ON lesson_grammar_task_items(grammar_id);

-- AI grammar-task evaluation cache (identical sentences skip the AI call)
CREATE TABLE IF NOT EXISTS grammar_eval_cache (
  eval_hash TEXT PRIMARY KEY,
  grammar_id UUID,
  sentence TEXT NOT NULL,
  result JSONB NOT NULL,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Satu baris per kalimat siswa yang dinilai di Tugas Bunpou (migration 122).
-- Sebelum ini verdict AI dibuang setelah dirender — grammar_eval_cache di atas
-- global/anonim (hemat biaya AI, bukan sinyal belajar). Tabel inilah yang bikin
-- sistem bisa menjawab "pola grammar MANA yang siswa ini belum kuasai".
-- Klasifikasi error bersifat penjelas; model mastery digerakkan oleh `passed`.
CREATE TABLE IF NOT EXISTS grammar_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grammar_id UUID NOT NULL REFERENCES module_grammar(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'production'
    CHECK (source IN ('production', 'controlled', 'recognition')),
  input_mode TEXT NOT NULL DEFAULT 'text'
    CHECK (input_mode IN ('speech', 'text')),
  sentence TEXT NOT NULL,
  correct BOOLEAN NOT NULL,
  uses_pattern BOOLEAN NOT NULL,
  passed BOOLEAN NOT NULL,
  grammar_score SMALLINT CHECK (grammar_score IS NULL OR (grammar_score BETWEEN 0 AND 100)),
  primary_error TEXT,
  error_types TEXT[] NOT NULL DEFAULT '{}',
  severity TEXT,
  concept_signal TEXT,
  feedback TEXT,
  correction TEXT,
  eval_source TEXT NOT NULL DEFAULT 'ai' CHECK (eval_source IN ('ai', 'cache', 'smart_review')),
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grammar_attempts_user_grammar
  ON grammar_attempts (user_id, grammar_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_grammar_attempts_user_created
  ON grammar_attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_grammar_attempts_lesson
  ON grammar_attempts (lesson_id);

-- Editable app settings (e.g. the AI grammar-eval prompt template)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cache catatan coaching AI (belajar adaptif) per weakness signature — pola
-- sama seperti grammar_eval_cache. Lihat migration 027.
CREATE TABLE IF NOT EXISTS coaching_note_cache (
  note_hash TEXT PRIMARY KEY,
  note TEXT NOT NULL,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cache gambar AI per kosakata (spike "Generate gambar" di Kelola Deck).
-- Lihat migration 030.
CREATE TABLE IF NOT EXISTS vocab_image_cache (
  vocabulary_id UUID PRIMARY KEY REFERENCES module_vocabulary(id) ON DELETE CASCADE,
  image_bytes BYTEA NOT NULL,
  mime TEXT NOT NULL DEFAULT 'image/png',
  model TEXT,
  prompt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  question_category TEXT NOT NULL DEFAULT 'vocabulary' CHECK (question_category IN ('vocabulary','grammar','listening','reading','custom')),
  -- Tautan opsional ke pola grammar di bank modul (migration 122). NULL =
  -- soal tidak diatribusikan ke satu konsep (semua soal Bab 1-20 yang sudah
  -- ada). Terisi = soal ikut mengisi mastery per-konsep, dinilai deterministik.
  grammar_id UUID REFERENCES module_grammar(id) ON DELETE SET NULL,
  section_number INT NOT NULL DEFAULT 1,
  section_label TEXT NOT NULL DEFAULT 'Section 1',
  section_instruction TEXT,
  audio_script TEXT,
  passage TEXT,
  image_url TEXT,
  correct_answer TEXT,
  explanation TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_lesson ON quiz_questions(lesson_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_lesson_category ON quiz_questions(lesson_id, question_category, section_number, sort_order);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_grammar
  ON quiz_questions(grammar_id) WHERE grammar_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS quiz_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  image_url TEXT,
  sort_order INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_quiz_options_question ON quiz_options(question_id, sort_order);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  score INT,
  total_questions INT,
  attempt_token UUID DEFAULT gen_random_uuid(),
  sampled_question_ids JSONB,
  started_at TIMESTAMPTZ,
  -- NULL = attempt sedang berjalan, belum disubmit. Penanda ini yang dipakai
  -- pengaman anti double-submit di /quiz-attempt (WHERE completed_at IS NULL)
  -- dan oleh lessonAttemptStatus (ORDER BY ... NULLS LAST). Sempat salah
  -- dideklarasikan NOT NULL DEFAULT NOW() — lihat migration 123.
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_lesson ON quiz_attempts(user_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_lesson_completed
  ON quiz_attempts (user_id, lesson_id, completed_at DESC);

-- Hasil per-soal tiap submit (benar/salah + kategori di-snapshot) untuk
-- deteksi kelemahan per kategori (belajar adaptif). Lihat migration 027.
CREATE TABLE IF NOT EXISTS quiz_question_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  question_id UUID NOT NULL,
  question_category TEXT NOT NULL,
  -- Snapshot konsep grammar soal (migration 122), pola sama dgn kategori di
  -- atas: analisis historis tidak berubah kalau admin menautkan ulang soalnya.
  grammar_id UUID,
  is_correct BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qqr_user_cat_created
  ON quiz_question_results (user_id, question_category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qqr_attempt ON quiz_question_results (attempt_id);
CREATE INDEX IF NOT EXISTS idx_qqr_user_grammar
  ON quiz_question_results (user_id, grammar_id, created_at DESC) WHERE grammar_id IS NOT NULL;

-- ===== USER DATA =====

-- Doubles as the course entitlement record (Phase 1 — course access
-- foundation): status/expires_at/source/revoked_at let admin grants be
-- revoked or time-boxed without losing the enrollment row (and the progress
-- tied to it). 'expired' is computed at read time (status='active' AND
-- expires_at < NOW()), not stored. See migration 120.
-- ===== COURSE ORDERS (Phase 2 — manual bank transfer, provider-agnostic) =====
-- Purchase intent, separate from the Kanji PWA's Midtrans-driven
-- `subscriptions` table (different identity realm — kanji_users, not
-- users). See migration 121 for the full design rationale.
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

CREATE TABLE IF NOT EXISTS user_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  expires_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'self_enroll' CHECK (source IN ('self_enroll', 'admin_grant', 'purchase')),
  revoked_at TIMESTAMPTZ,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_user ON user_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_user_active
  ON user_enrollments (user_id, course_id) WHERE status = 'active';

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

-- Smart Review session metadata is intentionally short lived.  It only keeps
-- server-generated questions/replay protection; authoritative evidence stays
-- in user_practice_state/practice_attempts and grammar_attempts.
CREATE TABLE IF NOT EXISTS smart_review_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('mixed', 'kana', 'vocabulary', 'kanji', 'grammar')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_smart_review_sessions_user_expiry
  ON smart_review_sessions(user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS smart_review_session_items (
  session_id UUID NOT NULL REFERENCES smart_review_sessions(id) ON DELETE CASCADE,
  question_index INT NOT NULL CHECK (question_index >= 0),
  item_type TEXT NOT NULL CHECK (item_type IN ('kana', 'vocabulary', 'kanji', 'grammar')),
  item_id UUID NOT NULL,
  skill TEXT NOT NULL,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  payload JSONB NOT NULL,
  answered_at TIMESTAMPTZ,
  PRIMARY KEY (session_id, question_index)
);
CREATE INDEX IF NOT EXISTS idx_smart_review_session_items_item
  ON smart_review_session_items(item_type, item_id);

-- Blob progres main site (peta "lesson selesai" + skor kuis) untuk sync
-- lintas device. Frontend merge local+cloud lalu tulis balik union.
CREATE TABLE IF NOT EXISTS user_learning_state (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  quiz_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

-- ===== KANJI PWA AUTH (app.eznihongo.com) =====
-- Separate identity realm for the Kanji PWA product. Accounts here are
-- independent from the main eznihongo.com course platform so that a single
-- Google user signing in on app.eznihongo.com creates a fresh kanji_users row
-- (with its own display name) and their progress/subscription data never
-- touches the main `users` table.

CREATE TABLE IF NOT EXISTS kanji_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  google_name TEXT,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kanji_users_email ON kanji_users(email);
CREATE INDEX IF NOT EXISTS idx_kanji_users_google ON kanji_users(google_id);

CREATE TABLE IF NOT EXISTS kanji_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES kanji_users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kanji_sessions_user ON kanji_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_kanji_sessions_hash ON kanji_sessions(refresh_token_hash);

-- ===== SUBSCRIPTIONS (Kanji PWA Midtrans) =====

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES kanji_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','failed','expired','cancelled')),
  plan TEXT NOT NULL CHECK (plan IN ('monthly','yearly','lifetime')),
  amount_idr INT NOT NULL,
  midtrans_order_id TEXT UNIQUE NOT NULL,
  midtrans_txn_id TEXT,
  payment_method TEXT,
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  raw_webhook JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_order ON subscriptions(midtrans_order_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(user_id, status, expires_at);

-- Kanji PWA cloud-sync blob — one row per kanji_user, holds known_kanji + FSRS state.
CREATE TABLE IF NOT EXISTS kanji_progress (
  user_id UUID PRIMARY KEY REFERENCES kanji_users(id) ON DELETE CASCADE,
  known_kanji JSONB NOT NULL DEFAULT '[]'::jsonb,
  fsrs_data JSONB NOT NULL DEFAULT '{}'::jsonb,
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

-- ===== TTS CACHE (ElevenLabs) =====

CREATE TABLE IF NOT EXISTS tts_cache (
  text_hash TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'elevenlabs',
  voice TEXT,
  model TEXT,
  audio BYTEA NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'audio/mpeg',
  byte_size INT,
  settings_version TEXT,
  alignment JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tts_cache_settings_version
  ON tts_cache (settings_version);

-- Admin TTS tag library — shortcut tag yang admin save untuk reuse
-- antar device. Insert ke audio_script sebagai [tagname]. Tag yg ga
-- match official ElevenLabs list akan di-ignore model, tapi tetap
-- berguna sebagai shortcut entry.
CREATE TABLE IF NOT EXISTS tts_tag_library (
  tag TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===== KANJI ITEMS (Daftar Kanji di main site) =====
-- Terpisah dari PWA app/kanji.html (yang punya KD[] hardcoded + tabel
-- kanji_users/kanji_progress di realm sendiri). Tabel ini source of truth
-- buat fitur Daftar Kanji di welcome.html (admin CRUD-able).

CREATE TABLE IF NOT EXISTS kanji_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  character TEXT NOT NULL,
  jlpt_level TEXT NOT NULL,
  on_reading TEXT,
  kun_reading TEXT,
  meaning_id TEXT,
  mnemonic TEXT,
  compounds JSONB NOT NULL DEFAULT '[]'::jsonb,
  stroke_count INT,
  bab_kode TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS kanji_items_level_sort_idx ON kanji_items (jlpt_level, sort_order);
CREATE INDEX IF NOT EXISTS kanji_items_bab_idx ON kanji_items (bab_kode) WHERE bab_kode IS NOT NULL;
CREATE INDEX IF NOT EXISTS kanji_items_lesson_idx ON kanji_items (lesson_id, sort_order) WHERE lesson_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS kanji_items_character_level_lesson_uniq ON kanji_items (character, jlpt_level, lesson_id);

-- ===== updated_at trigger =====

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS live_classes_updated_at ON live_classes;
CREATE TRIGGER live_classes_updated_at BEFORE UPDATE ON live_classes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===== LEARNING DATA FOUNDATIONS =====
-- Main-course Kana/Vocabulary/Kanji practice is relational.  Grammar keeps
-- using grammar_attempts because its mastery evidence is intentionally richer
-- than generic correct/total counters.
CREATE TABLE IF NOT EXISTS user_practice_state (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Grammar references are reserved for its existing rich evidence model;
  -- generic correct/total state is not used to calculate Grammar mastery.
  item_type TEXT NOT NULL CHECK (item_type IN ('kana', 'vocabulary', 'kanji', 'grammar')),
  item_id UUID NOT NULL,
  skill TEXT NOT NULL CHECK (char_length(skill) BETWEEN 1 AND 200),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  correct INTEGER NOT NULL DEFAULT 0 CHECK (correct >= 0 AND correct <= attempts),
  streak INTEGER NOT NULL DEFAULT 0 CHECK (streak >= 0),
  last_seen_at TIMESTAMPTZ,
  last_reviewed_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ,
  mastery_state TEXT NOT NULL DEFAULT 'new' CHECK (mastery_state IN ('new', 'learning', 'mastered')),
  -- FSRS-5 memory state (backend/src/fsrs.js).  next_review_at doubles as the
  -- card's `due` and last_reviewed_at as its `lastReview`, so only the five
  -- values below are extra.  Nullable: a row written before migration 137 is
  -- still valid and is treated as a fresh card on its next answer.
  fsrs_stability DOUBLE PRECISION,
  fsrs_difficulty DOUBLE PRECISION,
  fsrs_state TEXT CHECK (fsrs_state IN ('new', 'learning', 'review', 'relearning')),
  fsrs_reps INTEGER,
  fsrs_lapses INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, item_type, item_id, skill)
);
CREATE INDEX IF NOT EXISTS idx_user_practice_state_due ON user_practice_state (user_id, next_review_at);
CREATE INDEX IF NOT EXISTS idx_user_practice_state_item ON user_practice_state (item_type, item_id);

CREATE TABLE IF NOT EXISTS practice_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('kana', 'vocabulary', 'kanji', 'grammar')),
  item_id UUID NOT NULL,
  skill TEXT NOT NULL CHECK (char_length(skill) BETWEEN 1 AND 200),
  is_correct BOOLEAN NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('lesson_drill', 'smart_review', 'quiz', 'grammar_task')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_user_created ON practice_attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_user_item ON practice_attempts (user_id, item_type, item_id, skill, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_lesson ON practice_attempts (lesson_id, created_at DESC) WHERE lesson_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_practice_legacy_imports (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source = 'welcome_local_mastery_v1'),
  item_type TEXT NOT NULL CHECK (item_type IN ('kana', 'vocabulary', 'kanji', 'grammar')),
  legacy_key TEXT NOT NULL,
  item_id UUID NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, source, item_type, legacy_key)
);
CREATE INDEX IF NOT EXISTS idx_practice_legacy_imports_item ON user_practice_legacy_imports (item_type, item_id);

CREATE OR REPLACE FUNCTION validate_practice_item_reference() RETURNS TRIGGER AS $$
DECLARE exists_item BOOLEAN := FALSE;
BEGIN
  CASE NEW.item_type
    WHEN 'kana' THEN SELECT EXISTS (SELECT 1 FROM kana_items WHERE id = NEW.item_id) INTO exists_item;
    WHEN 'vocabulary' THEN SELECT EXISTS (SELECT 1 FROM module_vocabulary WHERE id = NEW.item_id) INTO exists_item;
    WHEN 'kanji' THEN SELECT EXISTS (SELECT 1 FROM kanji_items WHERE id = NEW.item_id) INTO exists_item;
    WHEN 'grammar' THEN SELECT EXISTS (SELECT 1 FROM module_grammar WHERE id = NEW.item_id) INTO exists_item;
  END CASE;
  IF NOT exists_item THEN
    RAISE EXCEPTION 'Unknown % practice item %', NEW.item_type, NEW.item_id USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_practice_state_item_reference ON user_practice_state;
CREATE TRIGGER user_practice_state_item_reference
  BEFORE INSERT OR UPDATE OF item_type, item_id ON user_practice_state
  FOR EACH ROW EXECUTE FUNCTION validate_practice_item_reference();
DROP TRIGGER IF EXISTS practice_attempts_item_reference ON practice_attempts;
CREATE TRIGGER practice_attempts_item_reference
  BEFORE INSERT OR UPDATE OF item_type, item_id ON practice_attempts
  FOR EACH ROW EXECUTE FUNCTION validate_practice_item_reference();
DROP TRIGGER IF EXISTS user_practice_state_updated_at ON user_practice_state;
CREATE TRIGGER user_practice_state_updated_at
  BEFORE UPDATE ON user_practice_state FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'video_sources_updated_at') THEN
    CREATE TRIGGER video_sources_updated_at BEFORE UPDATE ON video_sources
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
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
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'vocabulary_examples_updated_at') THEN
    CREATE TRIGGER vocabulary_examples_updated_at BEFORE UPDATE ON vocabulary_examples
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'kanji_users_updated_at') THEN
    CREATE TRIGGER kanji_users_updated_at BEFORE UPDATE ON kanji_users
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'subscriptions_updated_at') THEN
    CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'kanji_progress_updated_at') THEN
    CREATE TRIGGER kanji_progress_updated_at BEFORE UPDATE ON kanji_progress
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'kanji_items_updated_at') THEN
    CREATE TRIGGER kanji_items_updated_at BEFORE UPDATE ON kanji_items
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
