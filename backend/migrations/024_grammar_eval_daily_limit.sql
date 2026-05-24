-- Batas percobaan penilaian AI per siswa per hari (lindungi kuota Anthropic).
-- Cuma menghitung panggilan AI nyata (cache hit gratis & tidak dihitung).
-- Tanpa FK ke users — sekadar counter, orphan row aman & kecil.

CREATE TABLE IF NOT EXISTS grammar_eval_usage (
  user_id UUID NOT NULL,
  day DATE NOT NULL,
  count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
