-- Adds an optional grouping label per module. The student dashboard sidebar
-- buckets modules by this name into a section accordion (Notion's curator
-- "Sistem Tulisan & Perkenalan" etc.); admins type the value manually with
-- a datalist suggestion sourced from the Notion vocab cache. Modules with
-- a NULL section_name fall under a "Lainnya" group.
ALTER TABLE modules ADD COLUMN IF NOT EXISTS section_name TEXT;
