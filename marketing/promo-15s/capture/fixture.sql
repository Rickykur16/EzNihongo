-- LOCAL FIXTURE ONLY (never run against production).
-- Makes a freshly migrated local database look like the production chapter
-- structure for Bab 15, and gives the fictional student some sample data.
-- Run after schema.sql + seed-n5.sql + migrations and fixture_084 (see setup-fixture.sh).

-- Production-style chapter titles (docs/n5-approved-chapter-titles.md)
UPDATE modules m SET title = v.t FROM (VALUES
 ('hiragana-katakana','BAB 1 : Hiragana'),('salam-perkenalan','BAB 2 : Katakana'),('kosakata-harian','BAB 3 : Memperkenalkan Diri'),
 ('pola-kalimat-dasar','BAB 4 : Benda di Sekitar'),('persiapan-jlpt-n5','BAB 5 : Angka, Waktu & Uang'),
 ('te-form-konjugasi-penghubung','BAB 12 : Bentuk Te: Konjugasi & Urutan Tindakan'),('te-form-progresif-aplikasi','BAB 13 : Bentuk Te: Permintaan, Keadaan, Izin & Larangan'),
 ('bentuk-verb-kewajiban','BAB 14 : Bentuk Biasa Kata Kerja & Kewajiban'),('komunikasi-pelayanan','BAB 15 : Pelayanan, Pilihan & Perubahan'),
 ('hari-jadwal','BAB 16 : Waktu, Tanggal & Jadwal'),('suka-mahir','BAB 17 : Hobi & Kemampuan'),('perbandingan','BAB 18 : Perbandingan'),
 ('keinginan-rencana','BAB 19 : Keinginan & Rencana'),('pengalaman-penghubung','BAB 20 : Pengalaman, Alasan & Penghubung Kalimat')
) v(s,t) WHERE m.slug=v.s AND m.course_id=(SELECT id FROM courses WHERE slug='n5');

-- Bab 15 kosakata deck (real vocabulary from migration 073), work-related words first
UPDATE module_vocabulary v SET lesson_id = l.id FROM lessons l, modules m
 WHERE v.module_id=m.id AND l.module_id=m.id AND l.slug='pelajaran-2-kosakata' AND m.slug='komunikasi-pelayanan';
UPDATE lesson_deck_items di SET sort_order = CASE v.japanese WHEN '店員' THEN 1 WHEN 'お客様' THEN 2 WHEN '注文する' THEN 3
  WHEN '受付' THEN 4 WHEN '案内する' THEN 5 WHEN '払う' THEN 6 WHEN 'お会計' THEN 7 WHEN '予約する' THEN 8 ELSE 20 + di.sort_order END
 FROM module_vocabulary v JOIN modules m ON m.id=v.module_id WHERE di.vocabulary_id=v.id AND m.slug='komunikasi-pelayanan';

-- Tata Bahasa Bab 15 is type video in production (migration 099 pattern)
UPDATE lessons SET type='video' WHERE slug IN ('tata-bahasa-bab-15-bahasa-pelayanan','tata-bahasa-bab-15-memutuskan-perubahan');

-- Sample dialogue scene on the real 〜はいかがですか pattern (Anna = staff, Aoi = customer, café)
UPDATE module_grammar SET
  example_dialog = E'A: いらっしゃいませ。コーヒーは いかがですか。\nB: はい、コーヒーを 一つ おねがいします。\nA: かしこまりました。',
  example_dialog_id = E'A: Selamat datang. Mau kopi?\nB: Iya, kopinya satu, ya.\nA: Baik.',
  dialog_scene = '{"schemaVersion":1,"enabled":true,"backgroundKey":"cafe","participants":[{"characterKey":"anna-wijaya","position":"left","speaker":"A","displayName":"アンナ","voiceId":"voiceA","voiceName":"","profileVersion":1},{"characterKey":"aoi-takahashi","position":"right","speaker":"B","displayName":"葵","voiceId":"voiceB","voiceName":"","profileVersion":1}]}'::jsonb
WHERE pattern='〜はいかがですか';

-- Sample live classes
INSERT INTO live_classes (course_id, title, description, starts_at, ends_at, meeting_url, status)
SELECT id, 'Bab 15 · Latihan Bahasa Pelayanan', 'Praktik percakapan menyambut dan melayani tamu bersama sensei.', '2026-09-29 19:30+07', '2026-09-29 21:00+07', 'https://meet.example.test/kelas-n5', 'scheduled' FROM courses WHERE slug='n5';
INSERT INTO live_classes (course_id, title, description, starts_at, ends_at, meeting_url, status)
SELECT id, 'Bab 16 · Waktu, Tanggal & Jadwal', 'Membaca jadwal kerja dan membuat janji.', '2026-10-02 19:30+07', '2026-10-02 21:00+07', 'https://meet.example.test/kelas-n5', 'scheduled' FROM courses WHERE slug='n5';
INSERT INTO live_class_lessons (live_class_id, lesson_id)
SELECT lc.id, l.id FROM live_classes lc, lessons l WHERE lc.title LIKE 'Bab 15%' AND l.slug='tata-bahasa-bab-15-bahasa-pelayanan';

-- Fictional student enrolled in Kelas N5 (password hash inserted by setup-fixture.sh)
INSERT INTO user_stats (user_id) SELECT id FROM users WHERE email='rina.contoh@example.test' ON CONFLICT DO NOTHING;
INSERT INTO user_enrollments (user_id, course_id, status)
SELECT u.id, c.id, 'active' FROM users u, courses c WHERE u.email='rina.contoh@example.test' AND c.slug='n5' ON CONFLICT DO NOTHING;
