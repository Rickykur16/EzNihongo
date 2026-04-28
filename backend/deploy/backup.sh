#!/bin/bash
# Postgres backup untuk eznihongo. Dijalankan harian via cron sebagai root.
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

mkdir -p "$DEST"
TS=$(date +%Y%m%d-%H%M%S)
DUMP="$DEST/eznihongo-$TS.dump"

echo "[$(date -Is)] Dumping ke $DUMP"
# -F c = custom format (compressed, restore granular). pg_dump accepts URI via -d.
pg_dump -d "$DATABASE_URL" -F c -f "$DUMP"

# Retention lokal: hapus dump lebih tua dari N hari.
find "$DEST" -name 'eznihongo-*.dump' -mtime +"$RETENTION_DAYS" -delete

# Offsite (kalau remote dikonfigurasi). rclone pakai config di /root/.config/rclone/rclone.conf
# atau RCLONE_CONFIG= env. Lewati kalau RCLONE_REMOTE belum diset di .env.
if [ -n "${RCLONE_REMOTE:-}" ]; then
  echo "[$(date -Is)] Upload ke $RCLONE_REMOTE"
  rclone copy "$DUMP" "$RCLONE_REMOTE/" --quiet
else
  echo "[$(date -Is)] RCLONE_REMOTE kosong — skip offsite, backup hanya lokal"
fi

SIZE=$(stat -c%s "$DUMP")
echo "[$(date -Is)] OK: $DUMP ($SIZE bytes)"
