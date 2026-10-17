import crypto from 'node:crypto';
import { query, withTransaction, withAdvisoryLock } from './db.js';

const fail = (code, status = 502) => Object.assign(new Error(code), { status });

// Separate merchant account from the Kanji PWA. Never fall back to its keys.
export function courseMidtransConfig() {
  const serverKey = process.env.COURSE_MIDTRANS_SERVER_KEY;
  const snapBase = process.env.COURSE_MIDTRANS_BASE || 'https://app.sandbox.midtrans.com';
  if (!serverKey) throw fail('course_midtrans_not_configured', 503);
  if (!['https://app.sandbox.midtrans.com', 'https://app.midtrans.com'].includes(snapBase)) throw fail('course_midtrans_invalid_config', 503);
  let site;
  try { site = new URL(process.env.COURSE_APP_URL || 'https://eznihongo.com'); } catch { throw fail('course_midtrans_invalid_config', 503); }
  if (site.protocol !== 'https:' || site.username || site.password || site.search || site.hash || site.pathname !== '/') throw fail('course_midtrans_invalid_config', 503);
  return { serverKey, snapBase, apiBase: snapBase.includes('sandbox') ? 'https://api.sandbox.midtrans.com' : 'https://api.midtrans.com', site: site.origin };
}

export function validCourseMidtransSignature(payload, key) {
  if (!payload || !['order_id', 'status_code', 'gross_amount', 'signature_key'].every(k => typeof payload[k] === 'string')) return false;
  if (!/^[a-f\d]{128}$/i.test(payload.signature_key)) return false;
  const expected = crypto.createHash('sha512').update(payload.order_id + payload.status_code + payload.gross_amount + key).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(payload.signature_key, 'hex'));
}

export function courseMidtransState(status, order) {
  if (status.order_id !== order.order_number || !/^\d+(?:\.0{1,2})?$/.test(String(status.gross_amount)) || Number(status.gross_amount) !== order.amount_idr || (status.currency && status.currency !== 'IDR')) throw fail('midtrans_amount_or_order_mismatch');
  if (typeof status.transaction_id !== 'string' || !status.transaction_id || status.transaction_id.length > 200) throw fail('midtrans_invalid_status');
  const state = String(status.transaction_status || '').toLowerCase();
  const paid = (state === 'capture' && status.fraud_status === 'accept') || (state === 'settlement' && (!status.fraud_status || status.fraud_status === 'accept'));
  return { state, paid, failed: ['deny', 'cancel', 'expire', 'failure'].includes(state), refunded: ['refund', 'chargeback'].includes(state) };
}

async function midtransRequest(url, config, options = {}) {
  let response, data;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000), headers: {
      Accept: 'application/json', 'Content-Type': 'application/json',
      Authorization: 'Basic ' + Buffer.from(config.serverKey + ':').toString('base64'), ...options.headers,
    } });
    data = await response.json();
  } catch { throw fail('course_midtrans_unavailable'); }
  if (response.status === 404 || String(data.status_code) === '404') return null;
  if (!response.ok) throw fail('course_midtrans_unavailable');
  return data;
}

export async function createCourseMidtransCheckout(orderId, userId) {
  const config = courseMidtransConfig();
  return withAdvisoryLock('course-midtrans:' + orderId, async client => {
    const order = (await client.query(`SELECT o.*, u.email, u.full_name FROM orders o
      JOIN users u ON u.id=o.user_id WHERE o.id=$1 FOR UPDATE OF o`, [orderId])).rows[0];
    if (!order) throw fail('order_not_found', 404);
    if (order.user_id !== userId) throw fail('not_order_owner', 403);
    if (order.payment_provider !== 'midtrans' || order.learning_mode !== 'self_learning') throw fail('midtrans_order_required', 409);
    if (order.status !== 'pending_payment' || new Date(order.expires_at) <= new Date()) throw fail('order_not_open', 409);
    if (order.midtrans_checkout_url) return { redirectUrl: order.midtrans_checkout_url };
    const remaining = Math.floor((new Date(order.expires_at) - Date.now()) / 60000);
    if (remaining < 5) throw fail('order_not_open', 409);
    const snap = await midtransRequest(config.snapBase + '/snap/v1/transactions', config, {
      method: 'POST', headers: { 'X-Override-Notification': config.site + '/api/course-payments/webhook' },
      body: JSON.stringify({
        transaction_details: { order_id: order.order_number, gross_amount: order.amount_idr },
        item_details: [{ id: order.course_id, price: order.amount_idr, quantity: 1, name: order.course_title_snapshot.slice(0, 50) }],
        customer_details: { first_name: (order.full_name || 'Peserta').slice(0, 50), email: order.email },
        credit_card: { secure: true },
        callbacks: { finish: config.site + '/courses/order.html?id=' + encodeURIComponent(order.id) },
        expiry: { start_time: new Date().toISOString().slice(0, 19).replace('T', ' ') + ' +0000', duration: remaining, unit: 'minutes' },
        page_expiry: { duration: remaining, unit: 'minutes' },
      }),
    });
    let redirect;
    try { redirect = new URL(snap?.redirect_url); } catch { throw fail('course_midtrans_unavailable'); }
    if (redirect.origin !== config.snapBase || !redirect.pathname.startsWith('/snap/') || redirect.username || redirect.password) throw fail('course_midtrans_unavailable');
    await client.query('UPDATE orders SET midtrans_checkout_url=$2, updated_at=NOW() WHERE id=$1', [order.id, redirect.href]);
    return { redirectUrl: redirect.href };
  });
}

// GET Status is authoritative. A redirect, client callback, or a signed
// notification with its (unsigned) transaction_status changed cannot grant access.
export async function syncCourseMidtransOrder(orderNumber) {
  const config = courseMidtransConfig();
  const found = (await query(`SELECT * FROM orders WHERE order_number=$1 AND payment_provider='midtrans' AND learning_mode='self_learning'`, [orderNumber])).rows[0];
  if (!found) throw fail('order_not_found', 404);
  const status = await midtransRequest(config.apiBase + '/v2/' + encodeURIComponent(orderNumber) + '/status', config);
  if (!status) return { status: found.status };
  const result = courseMidtransState(status, found);
  return withTransaction(async client => {
    const order = (await client.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [found.id])).rows[0];
    if (!order) throw fail('order_not_found', 404);
    // Repeated/out-of-order notifications never restart the one-year term or
    // undo a completed refund. Failed/pending events cannot undo paid access.
    if (['refund', 'chargeback'].includes(order.midtrans_status) || (order.status === 'approved' && !result.refunded)) return { status: order.status };
    const safePayload = { order_id: status.order_id, transaction_id: status.transaction_id,
      transaction_status: result.state, gross_amount: status.gross_amount,
      payment_type: status.payment_type || null, fraud_status: status.fraud_status || null };
    await client.query(`UPDATE orders SET midtrans_transaction_id=$2, midtrans_status=$3,
      status=CASE WHEN $4 THEN 'approved' WHEN $5 THEN 'cancelled' ELSE status END,
      approved_at=CASE WHEN $4 THEN COALESCE(approved_at,NOW()) ELSE approved_at END, updated_at=NOW() WHERE id=$1`,
    [order.id, status.transaction_id, result.state, result.paid, result.failed]);
    await client.query(`INSERT INTO order_payments(order_id,provider,status,external_reference,raw_payload,submitted_by,reviewed_at)
      VALUES ($1,'midtrans',$2,$3,$4,$5,NOW())
      ON CONFLICT (order_id) WHERE provider='midtrans' DO UPDATE SET
        status=EXCLUDED.status, raw_payload=EXCLUDED.raw_payload, external_reference=EXCLUDED.external_reference, reviewed_at=NOW()`,
    [order.id, result.paid ? 'approved' : result.failed || result.refunded ? 'rejected' : 'pending', status.transaction_id, JSON.stringify(safePayload), order.user_id]);
    if (result.paid) await client.query(`INSERT INTO user_enrollments(user_id,course_id,status,source,order_id,learning_mode,expires_at)
      VALUES ($1,$2,'active','purchase',$3,'self_learning',NOW()+INTERVAL '1 year')
      ON CONFLICT (user_id,course_id) DO UPDATE SET status='active',source='purchase',order_id=$3,
        learning_mode='self_learning',expires_at=EXCLUDED.expires_at,revoked_at=NULL,enrolled_at=NOW()
      WHERE NOT (user_enrollments.status='active' AND user_enrollments.learning_mode='bootcamp'
        AND (user_enrollments.expires_at IS NULL OR user_enrollments.expires_at>NOW()))`, [order.user_id, order.course_id, order.id]);
    if (result.refunded) await client.query(`UPDATE user_enrollments SET status='revoked', revoked_at=NOW()
      WHERE order_id=$1 AND source='purchase' AND status='active'`, [order.id]);
    return { status: result.paid ? 'approved' : result.failed ? 'cancelled' : order.status };
  });
}
