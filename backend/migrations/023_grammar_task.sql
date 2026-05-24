-- Grammar-task lessons: siswa membuat kalimat memakai pola grammar lalu
-- mengucapkannya. STT (ElevenLabs Scribe) mentranskrip ucapan; kalimat dinilai
-- AI (Anthropic). New lesson type 'grammar_task'; grammar items dari bank modul
-- (module_grammar) dipilih ke tugas via lesson_grammar_task_items (reusable).
-- Idempotent: gated CREATE INDEX per konvensi repo (lihat 009 / 015).

-- 1. Allow lesson type 'grammar_task'
ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_type_check;
ALTER TABLE lessons ADD CONSTRAINT lessons_type_check
  CHECK (type IN ('video', 'quiz', 'text', 'deck', 'kanji', 'grammar_task'));

-- 2. Grammar dipilih ke sebuah grammar-task lesson (join ke module_grammar)
CREATE TABLE IF NOT EXISTS lesson_grammar_task_items (
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  grammar_id UUID NOT NULL REFERENCES module_grammar(id) ON DELETE CASCADE,
  sort_order INT DEFAULT 0,
  PRIMARY KEY (lesson_id, grammar_id)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_grammar_task_items_lesson') THEN
    EXECUTE 'CREATE INDEX idx_grammar_task_items_lesson ON lesson_grammar_task_items(lesson_id, sort_order)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_grammar_task_items_grammar') THEN
    EXECUTE 'CREATE INDEX idx_grammar_task_items_grammar ON lesson_grammar_task_items(grammar_id)';
  END IF;
END $$;

-- 3. Cache hasil penilaian AI (lindungi kuota — kalimat identik di-skip).
CREATE TABLE IF NOT EXISTS grammar_eval_cache (
  eval_hash TEXT PRIMARY KEY,
  grammar_id UUID,
  sentence TEXT NOT NULL,
  result JSONB NOT NULL,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Pengaturan aplikasi editable admin (mulai dari prompt koreksi AI).
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed prompt default. Placeholder {{pattern}}/{{meaning}}/{{example}}/{{sentence}}
-- diisi backend per evaluasi. Admin bisa edit lewat panel.
INSERT INTO app_settings (key, value) VALUES (
  'grammar_eval_prompt',
  'Kamu adalah guru bahasa Jepang yang menilai kalimat buatan siswa.

Pola grammar target: {{pattern}}
Arti pola: {{meaning}}
Contoh: {{example}}

Kalimat siswa: {{sentence}}

Nilai apakah kalimat siswa (1) gramatikal/benar sebagai bahasa Jepang, dan
(2) benar-benar memakai pola grammar target. Beri umpan balik singkat dalam
bahasa Indonesia yang membangun, dan kalau perlu beri versi koreksi kalimatnya
dalam bahasa Jepang.

Jawab HANYA dengan JSON valid (tanpa teks lain) berbentuk:
{"correct": boolean, "usesPattern": boolean, "feedback": "string Indonesia", "correction": "string Jepang atau kosong"}'
) ON CONFLICT (key) DO NOTHING;
