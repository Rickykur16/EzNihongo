# EzNihongo — Midtrans + Supabase Setup

Panduan deploy paywall premium (Rp 99.000/tahun) end-to-end.

## 1. Buat akun Midtrans

1. Daftar di <https://midtrans.com> — pakai email Ricky.
2. Masuk dashboard → **Settings → Access Keys**.
3. Catat 4 kredensial (2 untuk sandbox, 2 untuk production):
   - `Client Key` (dipasang di frontend, public)
   - `Server Key` (SECRET — dipasang di Supabase env)

> Gunakan **sandbox** dulu untuk testing. Switch ke production setelah verifikasi KYC Midtrans selesai (biasanya 1-3 hari kerja).

## 2. Apply schema ke Supabase

```bash
# Di folder repo:
supabase db push        # atau copy-paste supabase/schema/subscriptions.sql ke SQL Editor Supabase
```

Atau manual: buka Supabase Dashboard → **SQL Editor** → paste isi `supabase/schema/subscriptions.sql` → **Run**.

Verifikasi:
```sql
select * from public.subscriptions limit 1;   -- harus OK (kosong)
select * from public.me_is_premium;           -- harus return { is_premium: false }
```

## 3. Deploy Edge Functions

Install Supabase CLI jika belum: <https://supabase.com/docs/guides/cli>

```bash
supabase login
supabase link --project-ref bawgehtwhxhydgoztbhp
supabase functions deploy midtrans-create-tx --no-verify-jwt=false
supabase functions deploy midtrans-webhook   --no-verify-jwt=true
```

> **Penting:** `midtrans-webhook` harus `--no-verify-jwt=true` karena Midtrans tidak kirim JWT, verifikasi dilakukan via signature SHA512 di dalam function.

## 4. Set environment variables di Supabase

Dashboard → **Project Settings → Edge Functions → Secrets** → tambahkan:

| Key | Sandbox value | Production value |
| --- | --- | --- |
| `MIDTRANS_SERVER_KEY` | `SB-Mid-server-xxx` | `Mid-server-xxx` |
| `MIDTRANS_BASE` | `https://app.sandbox.midtrans.com` | `https://app.midtrans.com` |
| `APP_URL` | `http://localhost:3737/app` | `https://app.eznihongo.com` |

`SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` sudah tersedia by default di Edge Function runtime — tidak perlu di-set.

## 5. Konfigurasi webhook di Midtrans dashboard

Midtrans dashboard → **Settings → Configuration → Payment Notification URL**:

```
https://bawgehtwhxhydgoztbhp.functions.supabase.co/midtrans-webhook
```

Klik **Test** — harus balas HTTP 200 dengan body "ok".

## 6. Isi Client Key di frontend

Buka `app/kanji.html`, cari:

```js
const MIDTRANS_CLIENT_KEY = window.MIDTRANS_CLIENT_KEY || 'SB-Mid-client-REPLACE_ME';
const MIDTRANS_SNAP_URL = window.MIDTRANS_SNAP_URL || 'https://app.sandbox.midtrans.com/snap/snap.js';
```

**Sandbox:**
```js
const MIDTRANS_CLIENT_KEY = 'SB-Mid-client-xxx';
const MIDTRANS_SNAP_URL   = 'https://app.sandbox.midtrans.com/snap/snap.js';
```

**Production:**
```js
const MIDTRANS_CLIENT_KEY = 'Mid-client-xxx';
const MIDTRANS_SNAP_URL   = 'https://app.midtrans.com/snap/snap.js';
```

> Setelah ganti key, bump `sw.js` cache (`eznihongo-app-v3` → `v4`) agar user yang sudah install PWA dapat versi baru.

## 7. Test end-to-end (sandbox)

1. Login ke app dengan akun Google test.
2. Klik **N4** atau **Semua Level** → modal upgrade muncul → klik **Upgrade Sekarang**.
3. Midtrans Snap popup muncul → pilih **Credit Card** → isi nomor test card Midtrans:
   - Card: `4811 1111 1111 1114`
   - CVV: `123`, Exp: `12/25`
   - OTP: `112233`
4. Setelah sukses, cek Supabase:
   ```sql
   select * from public.subscriptions order by created_at desc limit 1;
   -- status: 'active', expires_at: +1 tahun
   ```
5. Refresh halaman → N4 sekarang unlocked, badge "Premium Aktif" muncul di Pengaturan.

## 8. Go-live checklist

- [ ] KYC Midtrans approved (production mode aktif)
- [ ] Switch `MIDTRANS_BASE` ke `https://app.midtrans.com` di Supabase secrets
- [ ] Switch `MIDTRANS_SERVER_KEY` ke production key
- [ ] Switch `MIDTRANS_CLIENT_KEY` + `MIDTRANS_SNAP_URL` di `app/kanji.html`
- [ ] Update Notification URL di Midtrans dashboard (bisa pakai URL yang sama)
- [ ] Bump `sw.js` cache version
- [ ] Test dengan kartu real Rp 1.000 (refund sendiri via dashboard)
- [ ] Monitor `subscriptions` table & webhook logs selama 24 jam pertama

## 9. Monitoring & support

- **Subs aktif bulan ini:** `select count(*) from subscriptions where status='active' and expires_at > now();`
- **Revenue bulan ini:** `select sum(amount_idr) from subscriptions where status='active' and started_at > date_trunc('month', now());`
- **Webhook failures:** Supabase Dashboard → Edge Functions → **midtrans-webhook** → Logs.
- **User complain "sudah bayar tapi masih locked":** cek `subscriptions` table → jika `status=pending`, kemungkinan webhook belum sampai, trigger manual dengan:
  ```sql
  update subscriptions
  set status='active', started_at=now(), expires_at=now() + interval '1 year'
  where midtrans_order_id='EZN-xxx';
  ```

## 10. Arsitektur ringkas

```
USER (browser)                                       SUPABASE                      MIDTRANS
─────────────────────────────────────────────────────────────────────────────────────────────
1. Klik "Upgrade"    ────────POST /functions/v1/midtrans-create-tx────┐
                                                                     │
                                                    INSERT sub       │
                                                    (status=pending) │
                                                                     ├─POST /snap/v1/transactions───┐
                                                                     │                              │
                                                                     │<─────snap_token──────────────┘
   snap.pay(token)   <─────snap_token──────────────────────────────  │
2. User bayar        ───────────────────────────────────────────────────→  MIDTRANS
3. Midtrans POST     ←───POST /functions/v1/midtrans-webhook (SHA512)─────┘
                                                    UPDATE sub
                                                    (status=active)
4. Reload page       ────SELECT me_is_premium────→  returns true
                                                    → UI unlock
```

Dokumen ini ada di `supabase/MIDTRANS_SETUP.md`. Update kalau ada perubahan flow.
