-- 138_user_marketing_profile.sql
--
-- User (bukan tebakan saya, hasil beberapa putaran koreksi langsung): perlu
-- data siswa yang lengkap untuk klasifikasi pengembangan marketing, sekaligus
-- untuk keperluan operasional (mengarahkan ke lokasi ujian terdekat, koordinasi
-- via WhatsApp). Field ini WAJIB diisi persis saat siswa enroll/checkout kursus
-- (courses/detail.html) — bukan saat daftar akun Google, bukan opsional.
--
-- Tabel terpisah dari `users`, mengikuti pola yang sudah konsisten dipakai di
-- repo ini (user_stats/user_enrollments/user_progress semua per-user terpisah,
-- bukan kolom ditumpuk ke `users`).
--
-- Tidak ada kolom status: baris ADA = sudah lengkap (semua field NOT NULL,
-- endpoint tulis selalu mensyaratkan semuanya sekaligus), baris TIDAK ADA =
-- belum pernah diminta. courses/detail.html mengecek keberadaan baris ini
-- untuk memutuskan menampilkan field wajib atau tidak — sekali diisi (di
-- enrollment pertama), tidak ditanya lagi di enrollment berikutnya.

CREATE TABLE IF NOT EXISTS user_marketing_profile (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  birth_date DATE NOT NULL,
  province TEXT NOT NULL,
  city TEXT NOT NULL,
  phone TEXT NOT NULL,
  -- kerja_jepang ↔ tier "Kelas SSW / Tokutei Ginou" yang sudah ada di landing
  -- page (index.html), jlpt ↔ tier N5/N4.
  learning_goal TEXT NOT NULL CHECK (learning_goal IN ('jlpt', 'kerja_jepang', 'hobi', 'kuliah', 'lainnya')),
  referral_source TEXT NOT NULL CHECK (referral_source IN ('instagram', 'tiktok', 'youtube', 'google', 'teman_keluarga', 'lainnya')),
  -- Dasar hukum pengumpulan data ini (UU PDP) — kapan persetujuan diberikan.
  -- Selalu di-set ulang ke NOW() setiap kali baris ini ditulis (endpoint PUT
  -- mensyaratkan consent:true tiap kali, tidak ada jalur update tanpa itu).
  consented_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dipakai filter tab Pengguna admin (provinsi/tujuan belajar/referral).
CREATE INDEX IF NOT EXISTS idx_user_marketing_profile_province ON user_marketing_profile(province);
CREATE INDEX IF NOT EXISTS idx_user_marketing_profile_learning_goal ON user_marketing_profile(learning_goal);
CREATE INDEX IF NOT EXISTS idx_user_marketing_profile_referral_source ON user_marketing_profile(referral_source);

DROP TRIGGER IF EXISTS user_marketing_profile_updated_at ON user_marketing_profile;
CREATE TRIGGER user_marketing_profile_updated_at BEFORE UPDATE ON user_marketing_profile
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
