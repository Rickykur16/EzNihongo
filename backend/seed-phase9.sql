-- Phase 9 seed — pricing for existing courses + sensei + testimonials
-- Idempotent: safe to re-run.

-- ================= COURSES PRICING =================
-- Assumes courses with slugs n5, n4, n3, n2, ssw already exist (seed-n5.sql creates n5).
-- UPSERT-style: only update if course exists; create minimal row if missing.

INSERT INTO courses (slug, title, description, level, sort_order, is_published,
  price_idr, price_label, period_label, tagline, features, cta_label, is_featured)
VALUES
  ('n5', 'Kelas N5', 'Dari nol — hiragana & dasar', 'N5', 1, TRUE,
   349000, 'Rp 349rb', '/ bulan', 'Dari nol — hiragana & dasar',
   '["Akses modul N5 self-paced","2 sesi live class / minggu","Latihan kuis tak terbatas","Komunitas Discord siswa"]'::jsonb,
   'Pilih Kelas N5', FALSE),
  ('n4', 'Kelas N4', 'Lanjut dari dasar', 'N4', 2, TRUE,
   449000, 'Rp 449rb', '/ bulan', 'Lanjut dari dasar',
   '["Akses modul N4 self-paced","2 sesi live class / minggu","Latihan kuis & try-out N4","Akses rekaman live class"]'::jsonb,
   'Pilih Kelas N4', FALSE),
  ('n3', 'Kelas N3', 'Menengah — kerja siap', 'N3', 3, TRUE,
   549000, 'Rp 549rb', '/ bulan', 'Menengah — kerja siap',
   '["Akses modul N3 self-paced","2 sesi live class / minggu","Sesi kaiwa mingguan","Try-out JLPT N3"]'::jsonb,
   'Pilih Kelas N3', FALSE),
  ('n2', 'Kelas N2', 'Mahir — bisnis-ready', 'N2', 4, TRUE,
   649000, 'Rp 649rb', '/ bulan', 'Mahir — bisnis-ready',
   '["Akses modul N2 self-paced","2 sesi live class / minggu","Modul keigo & business Japanese","Try-out JLPT N2"]'::jsonb,
   'Pilih Kelas N2', FALSE),
  ('ssw', 'Kelas SSW', 'Paling populer — jalur kerja Jepang', 'Tokutei Ginou', 5, TRUE,
   699000, 'Rp 699rb', '/ bulan', 'Paling populer — jalur kerja Jepang',
   '["Modul khusus SSW / Tokutei Ginou","Simulasi ujian SSW lengkap","Mock interview 1-on-1","Bahasa industri (kaigo, manufaktur, F&B)","Jaringan agensi penyalur mitra"]'::jsonb,
   'Pilih Kelas SSW', TRUE)
ON CONFLICT (slug) DO UPDATE SET
  price_idr     = EXCLUDED.price_idr,
  price_label   = EXCLUDED.price_label,
  period_label  = EXCLUDED.period_label,
  tagline       = EXCLUDED.tagline,
  features      = EXCLUDED.features,
  cta_label     = EXCLUDED.cta_label,
  is_featured   = EXCLUDED.is_featured,
  updated_at    = NOW();

-- ================= SENSEI =================
-- Only seed if table empty, so admin edits aren't overwritten.
INSERT INTO sensei (name, title, bio, tags, sort_order, is_published)
SELECT * FROM (VALUES
  ('Hiroshi Tanaka', 'Lead Sensei · Native',
   '15 tahun mengajar bahasa Jepang untuk pelajar asing. Mantan instruktur di Naganuma School, Tokyo.',
   '["JLPT","SSW","Business"]'::jsonb, 1, TRUE),
  ('Sari Kusuma', 'Senior Sensei · N1',
   'Alumni Waseda University. 8 tahun tinggal dan bekerja di Jepang. Spesialisasi persiapan wawancara kerja.',
   '["Kaiwa","Interview","Academic"]'::jsonb, 2, TRUE),
  ('Aiko Yamamoto', 'Sensei Kaiwa · Native',
   'Mantan staff HR di perusahaan manufaktur besar Jepang. Fokus pada business etiquette dan keigo.',
   '["Keigo","Business","Culture"]'::jsonb, 3, TRUE),
  ('Budi Hartono', 'Sensei · N1, ex-SSW',
   'Sukses melalui jalur SSW ke bidang keperawatan. Sekarang mentor bagi ratusan pekerja Indonesia di Jepang.',
   '["SSW","Kaigo","Mentoring"]'::jsonb, 4, TRUE)
) AS v(name, title, bio, tags, sort_order, is_published)
WHERE NOT EXISTS (SELECT 1 FROM sensei);

-- ================= TESTIMONIALS =================
-- Starter set — admin will replace with real student photos.
INSERT INTO testimonials (name, location, occupation, quote, course_slug, sort_order, is_published)
SELECT * FROM (VALUES
  ('Rizky Pratama', 'Osaka, Jepang', 'Kaigo Worker — Nursing Home Sakura',
   'Dari nol sampai bisa kerja di Osaka butuh 9 bulan. Kelas SSW EzNihongo langsung nyambung ke agensi penyalur. Sekarang gaji bulanan ¥230.000.',
   'ssw', 1, TRUE),
  ('Dewi Anggraini', 'Tokyo, Jepang', 'Mahasiswi — Waseda University',
   'Lulus N3 setelah 7 bulan belajar sambil kerja. Sekarang kuliah jurusan International Liberal Studies di Waseda berkat beasiswa MEXT.',
   'n3', 2, TRUE),
  ('Fajar Nugraha', 'Nagoya, Jepang', 'Teknisi — Toyota Manufacturing',
   'Sempat ragu karena umur 29 tahun, tapi sensei-sensei di EzNihongo sangat supportive. Sekarang bekerja di line produksi Toyota.',
   'ssw', 3, TRUE)
) AS v(name, location, occupation, quote, course_slug, sort_order, is_published)
WHERE NOT EXISTS (SELECT 1 FROM testimonials);
