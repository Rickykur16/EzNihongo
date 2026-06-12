-- 035_admin_emails.sql
-- Admin bisa ditambah dari panel admin tanpa edit .env: tabel admin_emails
-- dicek isAdminEmail() (backend/src/auth.js) DI SAMPING env ADMIN_EMAILS.
-- Env tetap jadi bootstrap/fallback — admin env tidak bisa dihapus dari UI,
-- jadi tidak mungkin terkunci total walau tabel ini dikosongkan.
-- Tabel baru dibuat oleh role app → tidak kena masalah ownership (lihat
-- catatan migration 008).

CREATE TABLE IF NOT EXISTS admin_emails (
  email      TEXT PRIMARY KEY,
  added_by   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
