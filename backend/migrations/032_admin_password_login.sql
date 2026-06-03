-- 032_admin_password_login.sql
-- Email+password login untuk admin. Authz admin TETAP via ADMIN_EMAILS env;
-- migration ini hanya:
--   (a) menambah kolom password_hash (bcrypt) ke users,
--   (b) membuat google_id nullable supaya bisa ada admin password-only tanpa
--       akun Google,
--   (c) menjamin tiap user punya minimal satu metode auth (Google ATAU password).
-- Tabel `users` dimiliki role app (bukan termasuk tabel kanji_* yang ownership-nya
-- berbeda — lihat catatan migration 008), jadi ALTER TABLE di sini aman.

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- DROP NOT NULL idempotent (no-op kalau sudah nullable). UNIQUE pada google_id
-- tetap; Postgres memperlakukan banyak NULL sebagai distinct, jadi banyak user
-- password-only (google_id NULL) tidak saling bentrok.
ALTER TABLE users ALTER COLUMN google_id DROP NOT NULL;

-- Constraint: minimal satu metode auth. Gate via pg_constraint agar idempotent
-- (ADD CONSTRAINT akan error kalau sudah ada).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_auth_method_chk') THEN
    ALTER TABLE users
      ADD CONSTRAINT users_auth_method_chk
      CHECK (google_id IS NOT NULL OR password_hash IS NOT NULL);
  END IF;
END$$;
