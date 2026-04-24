-- backend/scripts/expire-subscriptions.sql
-- Flip any active subscription whose expires_at has passed to status='expired'.
-- Run daily via cron, e.g.:
--   0 2 * * * psql "$DATABASE_URL" -f /var/www/eznihongo/backend/scripts/expire-subscriptions.sql

UPDATE subscriptions
SET status = 'expired'
WHERE status = 'active'
  AND expires_at IS NOT NULL
  AND expires_at < NOW();

SELECT status, COUNT(*) AS n
FROM subscriptions
GROUP BY status
ORDER BY status;
