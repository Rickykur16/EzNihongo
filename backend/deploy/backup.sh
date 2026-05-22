#!/bin/bash
# Backup lengkap eznihongo. Dijalankan harian via cron sebagai root.
#
# Satu arsip per hari (eznihongo-<ts>.tar.gz) berisi:
#   db.dump      pg_dump -F c (data database eznihongo, compressed)
#   globals.sql  pg_dumpall --globals-only (role + grant cluster-wide)
#   uploads/     seluruh isi UPLOAD_DIR (gambar sensei/testimonial)
# Tiga komponen ini yang TIDAK ada di Git, jadi inilah yang nyelametin data
# kalau VPS hilang. Kode app sendiri aman di GitHub.
#
# Install di VPS:
#   sudo cp /var/www/eznihongo/backend/deploy/backup.sh /var/www/eznihongo/backend/deploy/backup.sh
#   sudo chmod +x /var/www/eznihongo/backend/deploy/backup.sh
#   sudo cp /var/www/eznihongo/backend/deploy/eznihongo-backup.cron /etc/cron.d/eznihongo-backup
#   sudo chmod 644 /etc/cron.d/eznihongo-backup
#   sudo touch /var/log/eznihongo-backup.log
#
# Test manual:
#   sudo /var/www/eznihongo/backend/deploy/backup.sh
#
# Offsite (optional): set RCLONE_REMOTE di backend/.env ke nama remote rclone +
# bucket, contoh: RCLONE_REMOTE=r2:eznihongo-backups. Kalau kosong, backup
# tetap jalan tapi cuma lokal — siap di-upload manual atau di-pull dari luar.

set -euo pipefail

ENV_FILE=/var/www/eznihongo/backend/.env
DEST=/var/backups/eznihongo
RETENTION_DAYS=14

if [ ! -f "$ENV_FILE" ]; then
  echo "FATAL: $ENV_FILE tidak ada"
  exit 1
fi

# Source .env tanpa nge-leak ke shell parent. set -a auto-export var, set +a balik normal.
set -a
# shellcheck source=/dev/null
. "$ENV_FILE"
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "FATAL: DATABASE_URL kosong di $ENV_FILE"
  exit 1
fi

# Default sama dengan src/routes/uploads.js — bisa di-override via .env.
UPLOAD_DIR="${UPLOAD_DIR:-/var/www/eznihongo/uploads}"

mkdir -p "$DEST"
TS=$(date +%Y%m%d-%H%M%S)
ARCHIVE="$DEST/eznihongo-$TS.tar.gz"

# Staging dir buat ngumpulin dump sebelum di-bundle. Dibersihin via trap supaya
# nggak ninggalin sampah walau gagal di tengah.
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT

echo "[$(date -Is)] Dumping database ke $STAGE/db.dump"
# -F c = custom format (compressed, restore granular). pg_dump accepts URI via -d.
pg_dump -d "$DATABASE_URL" -F c -f "$STAGE/db.dump"

echo "[$(date -Is)] Dumping globals (role + grant) ke $STAGE/globals.sql"
# --no-role-passwords: eznihongo_app bukan superuser, jadi nggak bisa baca
# pg_authid. Role + grant tetap ke-dump; password di-set manual saat restore.
pg_dumpall --globals-only --no-role-passwords -d "$DATABASE_URL" > "$STAGE/globals.sql"

# Bundle: db.dump + globals.sql (dari STAGE) + uploads/ (dari parent UPLOAD_DIR).
# tar GNU memproses tiap -C berurutan.
if [ -d "$UPLOAD_DIR" ]; then
  echo "[$(date -Is)] Bundling db + globals + uploads dari $UPLOAD_DIR"
  tar -czf "$ARCHIVE" \
    -C "$STAGE" db.dump globals.sql \
    -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"
else
  echo "[$(date -Is)] WARNING: $UPLOAD_DIR tidak ada — bundle tanpa uploads"
  tar -czf "$ARCHIVE" -C "$STAGE" db.dump globals.sql
fi

# Retention lokal: hapus arsip lebih tua dari N hari.
find "$DEST" -name 'eznihongo-*.tar.gz' -mtime +"$RETENTION_DAYS" -delete

# Offsite (kalau remote dikonfigurasi). rclone pakai config di /root/.config/rclone/rclone.conf
# atau RCLONE_CONFIG= env. Lewati kalau RCLONE_REMOTE belum diset di .env.
if [ -n "${RCLONE_REMOTE:-}" ]; then
  echo "[$(date -Is)] Upload ke $RCLONE_REMOTE"
  rclone copy "$ARCHIVE" "$RCLONE_REMOTE/" --quiet
else
  echo "[$(date -Is)] RCLONE_REMOTE kosong — skip offsite, backup hanya lokal"
fi

SIZE=$(stat -c%s "$ARCHIVE")
echo "[$(date -Is)] OK: $ARCHIVE ($SIZE bytes)"
