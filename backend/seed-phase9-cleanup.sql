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

-- Wipe every module across every course so no placeholder structure
-- (from seed-n5.sql or any earlier manual inserts) lingers in N4/N3/N2/SSW.
-- ON DELETE CASCADE on lessons / quiz_questions / quiz_options handles cleanup.
-- Admin rebuilds modules + lessons per course via the panel.
DELETE FROM modules;
