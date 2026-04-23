import { Router } from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { asyncHandler } from '../middleware.js';
import { requireKanjiAuth } from '../kanji-middleware.js';

const router = Router();

// Port of supabase/functions/midtrans-{create-tx,webhook}.
// Server key is never exposed to the client — only the client key goes into
// the PWA (see MIDTRANS_CLIENT_KEY in kanji.html). Webhook verifies a SHA512
// signature that only someone holding the server key can produce.

const PLAN_AMOUNT = {
  yearly: 99000,
  monthly: 15000,
};

function midtransBase() {
  return process.env.MIDTRANS_BASE || 'https://app.sandbox.midtrans.com';
}

function appUrl() {
  return process.env.APP_URL || 'https://app.eznihongo.com';
}

// Rate-limit payment initiation per IP. Abusive clients could spam `pending`
// subscription rows otherwise. Webhook has its own verification so no limit.
const payLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 6,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

// POST /api/subscription/create-tx — authed; ask Midtrans for a Snap token
router.post('/create-tx', payLimiter, requireKanjiAuth, asyncHandler(async (req, res) => {
  const plan = (req.body?.plan || 'yearly').toString();
  const amount = PLAN_AMOUNT[plan];
  if (!amount) return res.status(400).json({ error: 'invalid_plan' });

  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) return res.status(500).json({ error: 'midtrans_not_configured' });

  const orderId = `EZN-${req.user.id.slice(0, 8)}-${Date.now()}`;

  const userRow = await query(
    `SELECT email, full_name FROM kanji_users WHERE id = $1 LIMIT 1`,
    [req.user.id]
  );
  const u = userRow.rows[0] || {};

  await query(
    `INSERT INTO subscriptions (user_id, status, plan, amount_idr, midtrans_order_id)
     VALUES ($1, 'pending', $2, $3, $4)`,
    [req.user.id, plan, amount, orderId]
  );

  const snapResp = await fetch(`${midtransBase()}/snap/v1/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Basic ' + Buffer.from(serverKey + ':').toString('base64'),
    },
    body: JSON.stringify({
      transaction_details: { order_id: orderId, gross_amount: amount },
      item_details: [{ id: plan, price: amount, quantity: 1, name: `EzNihongo Premium (${plan})` }],
      customer_details: {
        first_name: u.full_name || 'Member',
        email: u.email,
      },
      credit_card: { secure: true },
      callbacks: { finish: appUrl() + '/kanji.html?paid=1' },
    }),
  });
  const snap = await snapResp.json().catch(() => ({}));
  if (!snapResp.ok) {
    return res.status(502).json({ error: 'midtrans_failed', detail: snap });
  }

  res.json({
    order_id: orderId,
    snap_token: snap.token,
    redirect_url: snap.redirect_url,
  });
}));

// POST /api/subscription/webhook — Midtrans server → us. No auth; signature-verified.
// Docs: https://docs.midtrans.com/reference/notification-webhooks
router.post('/webhook', asyncHandler(async (req, res) => {
  const p = req.body || {};
  const { order_id, status_code, gross_amount, signature_key,
          transaction_status, fraud_status, transaction_id, payment_type } = p;
  if (!order_id || !status_code || !gross_amount || !signature_key) {
    return res.status(400).send('missing_fields');
  }

  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) return res.status(500).send('not_configured');

  const expected = crypto.createHash('sha512')
    .update(order_id + status_code + gross_amount + serverKey)
    .digest('hex');
  if (expected !== signature_key) return res.status(403).send('bad_signature');

  const success = (transaction_status === 'capture' && fraud_status === 'accept') ||
                  transaction_status === 'settlement';
  const failed  = ['deny', 'cancel', 'expire', 'failure'].includes(transaction_status);
  const pending = transaction_status === 'pending';

  const found = await query(
    `SELECT id, plan FROM subscriptions WHERE midtrans_order_id = $1 LIMIT 1`,
    [order_id]
  );
  if (found.rows.length === 0) return res.status(404).send('sub_not_found');
  const sub = found.rows[0];

  if (success) {
    // Months/years/lifetime from plan. Computed in SQL so the expires_at
    // interval is set atomically with the status flip.
    const interval = sub.plan === 'yearly' ? '1 year'
                   : sub.plan === 'monthly' ? '1 month'
                   : '100 years';
    await query(
      `UPDATE subscriptions
         SET status = 'active',
             started_at = NOW(),
             expires_at = NOW() + $1::interval,
             midtrans_txn_id = $2,
             payment_method = $3,
             raw_webhook = $4
       WHERE id = $5`,
      [interval, transaction_id || null, payment_type || null, p, sub.id]
    );
  } else if (failed) {
    await query(
      `UPDATE subscriptions
         SET status = 'failed',
             midtrans_txn_id = $1,
             payment_method = $2,
             raw_webhook = $3
       WHERE id = $4`,
      [transaction_id || null, payment_type || null, p, sub.id]
    );
  } else if (pending) {
    await query(
      `UPDATE subscriptions
         SET status = 'pending',
             midtrans_txn_id = $1,
             payment_method = $2,
             raw_webhook = $3
       WHERE id = $4`,
      [transaction_id || null, payment_type || null, p, sub.id]
    );
  }

  res.status(200).send('ok');
}));

// GET /api/subscription/status — current user; replaces `me_is_premium` Supabase view.
router.get('/status', requireKanjiAuth, asyncHandler(async (req, res) => {
  const row = await query(
    `SELECT status, plan, expires_at
     FROM subscriptions
     WHERE user_id = $1 AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY expires_at DESC NULLS LAST
     LIMIT 1`,
    [req.user.id]
  );
  const active = row.rows[0] || null;
  res.json({
    isPremium: !!active,
    plan: active?.plan || null,
    expiresAt: active?.expires_at || null,
  });
}));

export default router;
