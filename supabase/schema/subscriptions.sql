-- ─────────────────────────────────────────────────────────────────────────────
-- EzNihongo — subscriptions table
-- Tracks premium status per user for Midtrans recurring payments
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending','active','expired','cancelled','failed')),
  plan          text not null default 'yearly' check (plan in ('monthly','yearly','lifetime')),
  amount_idr    integer not null,
  started_at    timestamptz,
  expires_at    timestamptz,
  midtrans_order_id text unique,
  midtrans_txn_id   text,
  payment_method    text,
  raw_webhook   jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_subscriptions_user on public.subscriptions(user_id);
create index if not exists idx_subscriptions_status on public.subscriptions(status);
create index if not exists idx_subscriptions_order on public.subscriptions(midtrans_order_id);

-- Auto-update updated_at on row changes
create or replace function public.touch_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_subscriptions_updated on public.subscriptions;
create trigger trg_subscriptions_updated
before update on public.subscriptions
for each row execute function public.touch_updated_at();

-- Row Level Security: users can read only their own rows; webhooks use service_role (bypasses RLS)
alter table public.subscriptions enable row level security;

drop policy if exists "users_read_own_subs" on public.subscriptions;
create policy "users_read_own_subs" on public.subscriptions
  for select using (auth.uid() = user_id);

-- Helper view: is current user premium right now?
create or replace view public.me_is_premium as
select
  auth.uid() as user_id,
  exists (
    select 1 from public.subscriptions s
    where s.user_id = auth.uid()
      and s.status = 'active'
      and (s.expires_at is null or s.expires_at > now())
  ) as is_premium;

grant select on public.me_is_premium to anon, authenticated;
