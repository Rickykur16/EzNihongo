// ─────────────────────────────────────────────────────────────────────────────
// midtrans-webhook — receive payment notification from Midtrans
// Midtrans POSTs here after user pays. We verify the SHA512 signature, look up
// the pending sub by order_id, and flip it to 'active' with expires_at = +1y.
// Docs: https://docs.midtrans.com/reference/notification-webhooks
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 });

  const payload = await req.json().catch(() => null);
  if (!payload) return new Response('bad_json', { status: 400 });

  const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status, transaction_id, payment_type } = payload;
  if (!order_id || !status_code || !gross_amount || !signature_key) {
    return new Response('missing_fields', { status: 400 });
  }

  // Verify signature: sha512(order_id + status_code + gross_amount + server_key)
  const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY')!;
  const expected = await sha512(order_id + status_code + gross_amount + serverKey);
  if (expected !== signature_key) return new Response('bad_signature', { status: 403 });

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  // Resolve outcome
  const success = (transaction_status === 'capture' && fraud_status === 'accept') ||
                  transaction_status === 'settlement';
  const failed  = ['deny', 'cancel', 'expire', 'failure'].includes(transaction_status);
  const pending = transaction_status === 'pending';

  // Look up sub
  const { data: sub, error: findErr } = await sb
    .from('subscriptions').select('*').eq('midtrans_order_id', order_id).maybeSingle();
  if (findErr || !sub) return new Response('sub_not_found', { status: 404 });

  const update: Record<string, unknown> = {
    midtrans_txn_id: transaction_id,
    payment_method: payment_type,
    raw_webhook: payload,
  };

  if (success) {
    const now = new Date();
    const exp = new Date(now);
    if (sub.plan === 'yearly') exp.setFullYear(exp.getFullYear() + 1);
    else if (sub.plan === 'monthly') exp.setMonth(exp.getMonth() + 1);
    else exp.setFullYear(exp.getFullYear() + 100); // lifetime
    update.status = 'active';
    update.started_at = now.toISOString();
    update.expires_at = exp.toISOString();
  } else if (failed) {
    update.status = 'failed';
  } else if (pending) {
    update.status = 'pending';
  }

  const { error: updErr } = await sb.from('subscriptions').update(update).eq('id', sub.id);
  if (updErr) return new Response('update_failed: ' + updErr.message, { status: 500 });

  return new Response('ok', { status: 200 });
});

async function sha512(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-512', buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
