-- backend/scripts/grant-premium.sql
-- Grant 1-year premium to a user by email. Used to prepare the dummy account
-- we hand to the Midtrans reviewer (so the reviewer can log in and see premium
-- content without running a real payment flow).
--
-- Usage:
--   psql "$DATABASE_URL" \
--     -v email="'dummy@eznihongo.com'" \
--     -f backend/scripts/grant-premium.sql
--
-- To revoke:
--   UPDATE subscriptions SET status='cancelled'
--   WHERE user_id = (SELECT id FROM kanji_users WHERE email='dummy@eznihongo.com');

INSERT INTO subscriptions (user_id, plan, status, amount_idr, started_at, expires_at, midtrans_order_id)
SELECT
  id,
  'yearly',
  'active',
  99000,
  NOW(),
  NOW() + INTERVAL '1 year',
  'MANUAL-' || substr(id::text, 1, 8) || '-' || extract(epoch from now())::bigint
FROM kanji_users
WHERE email = :email
ON CONFLICT DO NOTHING;

SELECT u.email, s.plan, s.status, s.expires_at
FROM kanji_users u
JOIN subscriptions s ON s.user_id = u.id
WHERE u.email = :email
ORDER BY s.created_at DESC
LIMIT 1;
