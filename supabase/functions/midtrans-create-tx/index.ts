// ─────────────────────────────────────────────────────────────────────────────
// midtrans-create-tx — create a Snap transaction for yearly premium (Rp 99.000)
// Deployed as Supabase Edge Function. Client calls with user JWT; we verify the
// user, insert a 'pending' subscription row, then ask Midtrans for a Snap token.
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PLAN_AMOUNT: Record<string, number> = {
  yearly: 99000,
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')   return json({ error: 'method_not_allowed' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

  const { plan = 'yearly' } = await req.json().catch(() => ({}));
  const amount = PLAN_AMOUNT[plan];
  if (!amount) return json({ error: 'invalid_plan' }, 400);

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  // Who is this user?
  const { data: userRes, error: userErr } = await sb.auth.getUser(auth.replace('Bearer ', ''));
  if (userErr || !userRes.user) return json({ error: 'invalid_user' }, 401);
  const user = userRes.user;

  const orderId = `EZN-${user.id.slice(0, 8)}-${Date.now()}`;

  // Insert pending sub
  const { error: insErr } = await sb.from('subscriptions').insert({
    user_id: user.id,
    status: 'pending',
    plan,
    amount_idr: amount,
    midtrans_order_id: orderId,
  });
  if (insErr) return json({ error: 'db_insert_failed', detail: insErr.message }, 500);

  // Call Midtrans Snap API
  const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY')!;
  const base = Deno.env.get('MIDTRANS_BASE') ?? 'https://app.sandbox.midtrans.com'; // use app.midtrans.com in prod
  const resp = await fetch(`${base}/snap/v1/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Basic ' + btoa(serverKey + ':'),
    },
    body: JSON.stringify({
      transaction_details: { order_id: orderId, gross_amount: amount },
      item_details: [{ id: plan, price: amount, quantity: 1, name: `EzNihongo Premium (${plan})` }],
      customer_details: {
        first_name: user.user_metadata?.full_name ?? 'Member',
        email: user.email,
      },
      credit_card: { secure: true },
      callbacks: { finish: Deno.env.get('APP_URL') + '/kanji.html?paid=1' },
    }),
  });
  const snap = await resp.json();
  if (!resp.ok) return json({ error: 'midtrans_failed', detail: snap }, 502);

  return json({ order_id: orderId, snap_token: snap.token, redirect_url: snap.redirect_url });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
