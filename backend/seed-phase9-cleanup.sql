-- Remove placeholder sensei + testimonials + N5 module stubs seeded earlier.
-- Run once on the VPS so the landing page only shows content you actually
-- enter via admin, and the N5 course page starts with no placeholder modules.
--
-- Courses themselves are preserved — N5/N4/N3/N2/SSW are real products being
-- sold and their pricing came straight from the existing landing page.

DELETE FROM sensei
WHERE name IN ('Hiroshi Tanaka', 'Sari Kusuma', 'Aiko Yamamoto', 'Budi Hartono');

DELETE FROM testimonials
WHERE name IN ('Rizky Pratama', 'Dewi Anggraini', 'Fajar Nugraha');

-- N5 module stubs from seed-n5.sql — no real lesson content behind them yet.
-- ON DELETE CASCADE on lessons / quiz_questions / quiz_options handles cleanup.
DELETE FROM modules
WHERE course_id = (SELECT id FROM courses WHERE slug = 'n5')
  AND slug IN (
    'hiragana-katakana',
    'salam-perkenalan',
    'kosakata-harian',
    'pola-kalimat-dasar',
    'persiapan-jlpt-n5'
  );
