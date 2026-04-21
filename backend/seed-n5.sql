-- Seed: Kelas N5 (course + 5 modul)
-- Run: psql -U eznihongo_app -h localhost -d eznihongo -f seed-n5.sql

BEGIN;

INSERT INTO courses (slug, title, description, level, sort_order, is_published)
VALUES ('n5', 'Kelas N5', 'Dari nol — hiragana, katakana, dan dasar percakapan menuju JLPT N5.', 'N5', 1, TRUE)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  level = EXCLUDED.level,
  sort_order = EXCLUDED.sort_order,
  is_published = EXCLUDED.is_published,
  updated_at = NOW();

WITH c AS (SELECT id FROM courses WHERE slug = 'n5')
INSERT INTO modules (course_id, slug, title, description, sort_order)
SELECT c.id, m.slug, m.title, m.description, m.sort_order
FROM c, (VALUES
  ('hiragana-katakana', 'Hiragana & Katakana', 'Baca & tulis aksara dasar (minggu 1–2)', 1),
  ('salam-perkenalan',  'Salam & Perkenalan Diri', 'はじめまして、こんにちは、pola dasar', 2),
  ('kosakata-harian',   'Kosakata Harian', 'Angka, waktu, keluarga, tempat', 3),
  ('pola-kalimat-dasar','Pola Kalimat Dasar', 'です/ます form, partikel は・を・に', 4),
  ('persiapan-jlpt-n5', 'Persiapan JLPT N5', 'Try-out & review menyeluruh', 5)
) AS m(slug, title, description, sort_order)
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

COMMIT;

SELECT c.slug AS course, m.sort_order, m.slug AS module_slug, m.title
FROM courses c
JOIN modules m ON m.course_id = c.id
WHERE c.slug = 'n5'
ORDER BY m.sort_order;
