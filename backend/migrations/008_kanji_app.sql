-- 008_kanji_app.sql — Kanji PWA (app.eznihongo.com) gets its own isolated
-- auth realm, separate from the main eznihongo.com learning platform.
--
-- Why two realms:
--   The Kanji PWA is sold on Midtrans as a separate product. Accounts there
--   should not automatically carry over to the main course platform (or vice
--   versa). Each side keeps its own users + sessions + progress tables so a
--   breach, export, or deletion on one does not leak into the other.
--
-- Tables created:
--   kanji_users       — account identities for the PWA
--   kanji_sessions    — refresh-token sessions scoped to the PWA
--   subscriptions     — Midtrans yearly/monthly/lifetime subs (FK kanji_users)
--   kanji_progress    — cloud-sync blob for known_kanji + FSRS state
--
-- Ported from supabase/functions/midtrans-{create-tx,webhook} and the
-- Supabase `user_progress` table used by app/kanji.html.
--
-- Idempotency / ownership note:
--   Production may already have these tables from the original
--   `psql -f schema.sql` bootstrap, owned by a different role than the
--   migration runner. PostgreSQL checks ownership BEFORE the IF NOT EXISTS
--   short-circuit on CREATE INDEX / CREATE TRIGGER, so a naive re-run dies
--   with "must be owner of table kanji_users". Every DDL below is gated by an
--   existence check via pg_tables / pg_indexes / pg_trigger so we only issue
--   the privileged statement when the object is actually missing.

CREATE TABLE IF NOT EXISTS kanji_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  google_name TEXT,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kanji_users_email') THEN
    EXECUTE 'CREATE INDEX idx_kanji_users_email ON kanji_users(email)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kanji_users_google') THEN
    EXECUTE 'CREATE INDEX idx_kanji_users_google ON kanji_users(google_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'kanji_users_updated_at') THEN
    EXECUTE 'CREATE TRIGGER kanji_users_updated_at BEFORE UPDATE ON kanji_users
             FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS kanji_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES kanji_users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kanji_sessions_user') THEN
    EXECUTE 'CREATE INDEX idx_kanji_sessions_user ON kanji_sessions(user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kanji_sessions_hash') THEN
    EXECUTE 'CREATE INDEX idx_kanji_sessions_hash ON kanji_sessions(refresh_token_hash)';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES kanji_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','failed','expired','cancelled')),
  plan TEXT NOT NULL CHECK (plan IN ('monthly','yearly','lifetime')),
  amount_idr INT NOT NULL,
  midtrans_order_id TEXT UNIQUE NOT NULL,
  midtrans_txn_id TEXT,
  payment_method TEXT,
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  raw_webhook JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_subscriptions_user') THEN
    EXECUTE 'CREATE INDEX idx_subscriptions_user ON subscriptions(user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_subscriptions_order') THEN
    EXECUTE 'CREATE INDEX idx_subscriptions_order ON subscriptions(midtrans_order_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_subscriptions_active') THEN
    EXECUTE 'CREATE INDEX idx_subscriptions_active ON subscriptions(user_id, status, expires_at)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'subscriptions_updated_at') THEN
    EXECUTE 'CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions
             FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS kanji_progress (
  user_id UUID PRIMARY KEY REFERENCES kanji_users(id) ON DELETE CASCADE,
  known_kanji JSONB NOT NULL DEFAULT '[]'::jsonb,
  fsrs_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'kanji_progress_updated_at') THEN
    EXECUTE 'CREATE TRIGGER kanji_progress_updated_at BEFORE UPDATE ON kanji_progress
             FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
  END IF;
END $$;
