# EzNihongo — Midtrans Setup (Express + VPS)

Panduan deploy paywall premium (Rp 99.000/tahun). Backend-nya ada di
`backend/src/routes/subscription.js` (di-mount ke `/api/subscription/*` oleh
`server.js`). Dokumen `supabase/MIDTRANS_SETUP.md` yang lama sudah tidak
berlaku — Edge Function sudah dipindah ke Express.

## Endpoint

| Method | Path | Auth | Fungsi |
| ------ | ---- | ---- | ------ |
| `POST` | `/api/subscription/create-tx` | Bearer (refresh cookie) | Bikin Snap token |
| `POST` | `/api/subscription/webhook` | SHA512 signature | Midtrans → kita |
| `GET`  | `/api/subscription/status` | Bearer | `{isPremium,plan,expiresAt}` |

Lihat `backend/src/routes/subscription.js` untuk detail (rate-limit, SHA512
verification, plan → interval mapping).

## 1. Dapatkan kredensial Midtrans

Dashboard Midtrans → **Settings → Access Keys**. Kamu akan dapat 4 key:

| Environment | Client Key              | Server Key              |
| ----------- | ----------------------- | ----------------------- |
| Sandbox     | `SB-Mid-client-xxxxxx`  | `SB-Mid-server-xxxxxx`  |
| Production  | `Mid-client-xxxxxx`     | `Mid-server-xxxxxx`     |

Server key = RAHASIA, hanya masuk ke env VPS. Client key = public, di-inject
ke `kanji.html`.

## 2. Set env vars di VPS

Edit `/var/www/eznihongo/backend/.env`:

```bash
# --- Midtrans ---
MIDTRANS_BASE=https://app.sandbox.midtrans.com   # production: https://app.midtrans.com
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxx         # dipakai saat render kanji.html
APP_URL=https://app.eznihongo.com
```

Reload service: `sudo systemctl restart eznihongo-api`.

## 3. Pastikan nginx forward `/api/*` ke backend

Sudah ada template di `backend/deploy/nginx-api.conf` — pastikan blok
`location /api/ { proxy_pass http://127.0.0.1:3001; ... }` aktif di
`/etc/nginx/sites-available/eznihongo`. Reload nginx setelah edit:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Verifikasi webhook reachable dari luar:

```bash
curl -i -X POST https://app.eznihongo.com/api/subscription/webhook \
  -H 'Content-Type: application/json' -d '{}'
# Harus balas 400 "missing_fields" — artinya request masuk & diproses.
```

## 4. Update Client Key di `kanji.html`

Buka `app/kanji.html`, cari `MIDTRANS_CLIENT_KEY`:

```js
const MIDTRANS_CLIENT_KEY = window.MIDTRANS_CLIENT_KEY || 'SB-Mid-client-REPLACE_ME';
const MIDTRANS_SNAP_URL   = window.MIDTRANS_SNAP_URL   || 'https://app.sandbox.midtrans.com/snap/snap.js';
```

**Sandbox:** ganti `'SB-Mid-client-REPLACE_ME'` ke sandbox client key kamu.
**Production:** ganti juga `MIDTRANS_SNAP_URL` ke `https://app.midtrans.com/snap/snap.js`.

> Setelah ganti, bump `app/sw.js` `CACHE` version (mis. `eznihongo-app-v9` →
> `v10`) supaya user yang sudah install PWA dapat versi baru.

## 5. Daftarkan webhook URL di dashboard Midtrans

Dashboard Midtrans → **Settings → Configuration → Payment Notification URL**:

```
https://app.eznihongo.com/api/subscription/webhook
```

Klik **Test** — expect HTTP 403 "bad_signature" (karena test tidak kirim
signature valid). Itu artinya endpoint reachable & signature check jalan. ✅

## 6. Test end-to-end (sandbox)

1. Login ke `app.eznihongo.com` pakai akun test.
2. Klik **N4** (atau level locked mana pun) → modal upgrade → **Upgrade Sekarang**.
3. Snap popup → pilih **Credit Card** → isi test card:
   - Nomor: `4811 1111 1111 1114`
   - CVV: `123`, Exp: `12/25`
   - OTP/3DS: `112233`
4. Setelah `onSuccess`, page reload otomatis. Cek:
   ```sql
   SELECT status, expires_at FROM subscriptions
   WHERE user_id = (SELECT id FROM kanji_users WHERE email='...')
   ORDER BY created_at DESC LIMIT 1;
   -- status='active', expires_at = +1 tahun
   ```
5. UI: level N4–N1 harusnya unlocked, flashcard "Semua Level" bisa dibuka.

## 7. Siapkan dummy account untuk review Midtrans

Pilih salah satu:

**A. Test-flow sandbox** (direkomendasikan — reviewer lihat flow asli):
1. Bikin user `dummy@eznihongo.com` via form register.
2. Login → Upgrade → bayar pakai test card (langkah #6).
3. Setelah sukses, kasih kredensial (email + password) ke reviewer.

**B. Preload manual premium** (kalau reviewer tidak mau/boleh bayar):
1. Bikin user via register.
2. Jalankan:
   ```bash
   psql "$DATABASE_URL" -v email="'dummy@eznihongo.com'" \
     -f backend/scripts/grant-premium.sql
   ```
   (lihat `backend/scripts/grant-premium.sql`).

## 8. Go-live checklist

- [ ] KYC Midtrans approved (production mode aktif di dashboard)
- [ ] Switch `MIDTRANS_BASE` → `https://app.midtrans.com` di `.env`
- [ ] Switch `MIDTRANS_SERVER_KEY` → production key
- [ ] Switch `MIDTRANS_CLIENT_KEY` + `MIDTRANS_SNAP_URL` di `app/kanji.html`
- [ ] Bump `app/sw.js` cache version
- [ ] `sudo systemctl restart eznihongo-api`
- [ ] Update Notification URL di dashboard Midtrans (path sama, cuma ganti env)
- [ ] Test dengan kartu real Rp 1.000 → refund sendiri via dashboard
- [ ] Monitor tabel `subscriptions` & log journal 24 jam pertama:
      `journalctl -u eznihongo-api -f`

## 9. Monitoring

```sql
-- Subs aktif sekarang
SELECT COUNT(*) FROM subscriptions
WHERE status='active' AND (expires_at IS NULL OR expires_at > NOW());

-- Revenue bulan ini
SELECT SUM(amount_idr) FROM subscriptions
WHERE status='active' AND started_at > DATE_TRUNC('month', NOW());

-- User bilang "sudah bayar tapi locked"
SELECT * FROM subscriptions WHERE midtrans_order_id='EZN-xxx';
-- Kalau status='pending', webhook belum sampai. Cek log & signature, atau
-- flip manual:
--   UPDATE subscriptions SET status='active', started_at=NOW(),
--     expires_at=NOW() + INTERVAL '1 year'
--   WHERE midtrans_order_id='EZN-xxx';
```

## 10. Cron: expire subscription kadaluarsa

Tambahkan ke `/etc/cron.d/eznihongo`:

```
0 2 * * * www-data psql "$DATABASE_URL" -f /var/www/eznihongo/backend/scripts/expire-subscriptions.sql
```

Script ada di `backend/scripts/expire-subscriptions.sql` — flip
`status='active' → 'expired'` kalau `expires_at < NOW()`.

## 11. Arsitektur ringkas

```
USER (browser)              NGINX @ VPS          BACKEND (Node 3001)         MIDTRANS
──────────────────────────────────────────────────────────────────────────────────────
1. Klik Upgrade     ───POST /api/subscription/create-tx──┐
                                                         │
                                         INSERT sub      │
                                         (status=pending)│
                                                         ├──POST /snap/v1/transactions──┐
                                                         │                              │
                                                         │<──────snap_token─────────────┘
   snap.pay(token)  <──────snap_token────────────────────│
2. User bayar       ────────────────────────────────────────────────────────→ MIDTRANS
3. Midtrans POST    ────POST /api/subscription/webhook (SHA512)──────────────┘
                                         UPDATE sub
                                         (status=active)
4. Reload page      ────GET /api/subscription/status────→ {isPremium:true}
                                                         → UI unlock
```
