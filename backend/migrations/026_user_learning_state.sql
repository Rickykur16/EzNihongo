-- Sinkronisasi progres belajar lintas device (main site).
-- Sebelumnya progres (peta "lesson selesai") + skor kuis hanya disimpan di
-- localStorage browser, jadi tidak ikut akun (beda laptop vs HP). Tabel ini
-- menyimpan satu blob JSONB per user — pola sama seperti kanji_progress.
-- Frontend yang melakukan merge local+cloud lalu menulis balik union.

CREATE TABLE IF NOT EXISTS user_learning_state (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  quiz_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
