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

CREATE INDEX IF NOT EXISTS idx_kanji_users_email ON kanji_users(email);
CREATE INDEX IF NOT EXISTS idx_kanji_users_google ON kanji_users(google_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'kanji_users_updated_at') THEN
    CREATE TRIGGER kanji_users_updated_at BEFORE UPDATE ON kanji_users
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
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

CREATE INDEX IF NOT EXISTS idx_kanji_sessions_user ON kanji_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_kanji_sessions_hash ON kanji_sessions(refresh_token_hash);

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

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_order ON subscriptions(midtrans_order_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(user_id, status, expires_at);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'subscriptions_updated_at') THEN
    CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
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
    CREATE TRIGGER kanji_progress_updated_at BEFORE UPDATE ON kanji_progress
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
