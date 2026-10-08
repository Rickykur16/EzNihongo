-- First-party website visit counter (landing, course detail, login, legal pages).
-- Cookieless by design: no user id, no IP, no full URL, no query string.
-- `visitor` is a hash of IP + user agent with a random salt that lives only in
-- server memory and rotates every Jakarta day, so it can count unique visitors
-- per day but cannot be linked across days or reversed to an IP.
-- Rows older than 400 days are deleted by the API (site-analytics.js).
CREATE TABLE IF NOT EXISTS site_events (
  id           BIGSERIAL PRIMARY KEY,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  kind         TEXT NOT NULL CHECK (kind IN ('pageview', 'consult_open', 'wa_click')),
  page         TEXT NOT NULL CHECK (page IN ('home', 'course', 'login', 'privacy', 'terms')),
  detail       TEXT NOT NULL DEFAULT '' CHECK (length(detail) <= 80),
  referrer     TEXT NOT NULL DEFAULT '' CHECK (length(referrer) <= 100),
  utm_source   TEXT NOT NULL DEFAULT '' CHECK (length(utm_source) <= 60),
  utm_medium   TEXT NOT NULL DEFAULT '' CHECK (length(utm_medium) <= 60),
  utm_campaign TEXT NOT NULL DEFAULT '' CHECK (length(utm_campaign) <= 60),
  device       TEXT NOT NULL CHECK (device IN ('mobile', 'tablet', 'desktop')),
  visitor      TEXT NOT NULL CHECK (visitor ~ '^[0-9a-f]{16}$')
);

CREATE INDEX IF NOT EXISTS site_events_occurred_at_idx ON site_events (occurred_at);
