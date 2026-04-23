-- 007_drop_module_estimated_hours.sql
-- Durasi modul sekarang selalu dihitung dari SUM(lessons.duration_minutes) saat query.
-- Single source of truth: duration per lesson. Modul tidak punya field sendiri lagi.

ALTER TABLE modules
  DROP COLUMN IF EXISTS estimated_hours;
