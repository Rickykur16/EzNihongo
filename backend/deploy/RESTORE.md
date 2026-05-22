# RESTORE — Rebuild EzNihongo dari nol (VPS rusak / pindah server)

Panduan restore lengkap kalau VPS hilang/rusak dan harus pindah ke server baru.
Backup hidup di **3 sumber yang tahan VPS rusak** — restore = nyusun ulang dari
ketiganya:

| Sumber | Isi |
|---|---|
| **GitHub** (`Rickykur16/EzNihongo`) | Semua kode + frontend statis (HTML, `app/` PWA, `styles/`, `courses/`, dll) |
| **Cloudflare R2** (`r2:eznihongo-backups`) | Arsip harian: `db.dump` + `globals.sql` + `uploads/` |
| **Password manager** | `backend/.env` (DB password, JWT, Midtrans, Notion, ElevenLabs) + passphrase/kredensial R2 |

> Arsip R2 dibikin `backend/deploy/backup.sh` (cron harian 03:00): satu
> `eznihongo-<ts>.tar.gz` berisi `db.dump` (pg_dump database), `globals.sql`
> (pg_dumpall role+grant), dan folder `uploads/`.

---

## 0. Prasyarat di server baru

Ubuntu fresh. Install software dasar:
```bash
sudo apt update && sudo apt install -y postgresql nodejs npm nginx unzip
```

Install rclone (binary resmi, BUKAN apt/snap — versi apt lawas ada bug R2):
```bash
cd /tmp
curl -O https://downloads.rclone.org/rclone-current-linux-amd64.zip
unzip -o rclone-current-linux-amd64.zip
sudo cp rclone-*-linux-amd64/rclone /usr/bin/rclone && sudo chmod 755 /usr/bin/rclone
```

---

## 1. Ambil arsip backup dari R2

Config rclone ke R2 (kredensial dari password manager). Penting:
**`provider=Cloudflare`, `region=auto`, `no_check_bucket=true`** (tanpa ini upload/list
bisa kena 403 CreateBucket):
```bash
sudo rclone config        # type=s3, provider=Cloudflare, env_auth=1,
                          # access_key_id + secret_access_key, region=auto,
                          # endpoint=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
sudo rclone config update r2 no_check_bucket true
```

Tarik arsip terbaru lalu ekstrak:
```bash
sudo rclone lsf r2:eznihongo-backups        # lihat daftar, pilih yang terbaru
rclone copy r2:eznihongo-backups/eznihongo-YYYYMMDD-HHMMSS.tar.gz /tmp/
cd /tmp && tar -xzf eznihongo-*.tar.gz       # keluar: db.dump, globals.sql, uploads/
```

---

## 2. Restore kode + frontend (dari GitHub)

Ini sekaligus restore **semua HTML/frontend** (root: `index.html`, `welcome.html`,
`admin.html`, login/register/dll; PWA Kanji: `app/`; aset: `styles/`, `courses/`,
`data/`):
```bash
sudo git clone https://github.com/Rickykur16/EzNihongo /var/www/eznihongo
cd /var/www/eznihongo/backend && npm ci --omit=dev
```

---

## 3. Restore secret (`.env`)

```bash
sudo nano /var/www/eznihongo/backend/.env     # tempel isi dari password manager
sudo chmod 600 /var/www/eznihongo/backend/.env
```

---

## 4. Restore database

Urutan penting: roles dulu, set password, bikin DB, baru restore data.
```bash
# a. role + grant (eznihongo_app dibuat di sini). globals di-dump tanpa password.
sudo -u postgres psql -f /tmp/globals.sql

# b. set password role app — HARUS sama dengan password di DATABASE_URL (.env)
sudo -u postgres psql -c "ALTER ROLE eznihongo_app WITH PASSWORD 'PASSWORD_SAMA_DGN_ENV';"

# c. database kosong, owner = eznihongo_app
sudo -u postgres createdb -O eznihongo_app eznihongo

# d. restore data — connect SEBAGAI eznihongo_app supaya ownership tabel bener
pg_restore -d "postgresql://eznihongo_app:PASSWORD_SAMA_DGN_ENV@localhost:5432/eznihongo" /tmp/db.dump
```
Ini mengembalikan semua konten: lessons, modules, kanji_items, quiz, vocab/deck,
users, progress, subscriptions, cache (tts/notion), dst.

---

## 5. Restore gambar upload

```bash
sudo mkdir -p /var/www/eznihongo/uploads
sudo cp -a /tmp/uploads/. /var/www/eznihongo/uploads/
sudo chown -R www-data:www-data /var/www/eznihongo/uploads
```

---

## 6. systemd (backend API)

```bash
sudo cp /var/www/eznihongo/backend/deploy/eznihongo-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now eznihongo-api
curl -fsS http://127.0.0.1:3001/api/health    # harus OK
```

---

## 7. nginx (sajikan HTML + proxy API)

Snippet API/uploads ada di repo (`backend/deploy/nginx-api.conf`), tapi **server
block utama tidak ada di repo** — rekonstruksi. Contoh `/etc/nginx/sites-available/eznihongo`:

```nginx
# Main site — eznihongo.com (HTML statis dari root repo)
server {
    server_name eznihongo.com www.eznihongo.com;
    root /var/www/eznihongo;
    index index.html;

    location / { try_files $uri $uri/ =404; }

    # --- API + uploads: isi dari backend/deploy/nginx-api.conf ---
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 10m;
    }
    location /uploads/ {
        alias /var/www/eznihongo/uploads/;
        expires 30d;
        try_files $uri =404;
    }
    listen 80;
}

# Kanji PWA — app.eznihongo.com (folder app/)
server {
    server_name app.eznihongo.com;
    root /var/www/eznihongo/app;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
    location /api/ { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; }
    listen 80;
}
```
```bash
sudo ln -s /etc/nginx/sites-available/eznihongo /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 8. DNS + SSL

1. Arahkan DNS `eznihongo.com`, `www.eznihongo.com`, `app.eznihongo.com` ke IP server baru.
2. SSL via certbot:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d eznihongo.com -d www.eznihongo.com -d app.eznihongo.com
   ```
3. Pasang ulang cron backup di server baru:
   ```bash
   sudo cp /var/www/eznihongo/backend/deploy/eznihongo-backup.cron /etc/cron.d/eznihongo-backup
   sudo chmod 644 /etc/cron.d/eznihongo-backup && sudo touch /var/log/eznihongo-backup.log
   ```

---

## Gotchas (yang paling sering bikin gagal pas hari-H)

- **Password role ≠ `.env`** → app gagal connect DB. Pastikan langkah 4b == DATABASE_URL.
- **Lupa `globals.sql` duluan** → `pg_restore` error "role eznihongo_app does not exist".
- **rclone dari apt/snap** → 403 / config path beda. Pakai binary resmi + `no_check_bucket=true`.
- **nginx server block tidak di repo** → harus direkonstruksi (lihat langkah 7).
- **Notion**: isi DB Notion ada di akun Notion, bukan di arsip ini. Tapi vocab yang
  sudah di-import (`module_vocabulary` + `notion_vocab_cache`) ikut `db.dump`, jadi
  website tetap jalan penuh tanpa Notion.

## Tes restore berkala

Backup belum "beneran" sampai pernah di-restore. Minimal 1x/bulan, coba langkah 1 + 4
ke Postgres staging/container — biar masalah ketemu pas santai, bukan pas darurat.
