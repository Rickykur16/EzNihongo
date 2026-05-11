#!/bin/bash
# Backup repo EzNihongo ke harddisk external (atau path mount mana pun).
# Beda dari backup.sh: ini nge-backup *source code + worktree* (termasuk file
# yang ga ke-track git, mis. backend/.env), bukan dump database produksi.
#
# Pakai:
#   ./backend/deploy/backup-to-external.sh /media/$USER/NamaDisk
#   ./backend/deploy/backup-to-external.sh /Volumes/NamaDisk        # macOS
#
# Cek dulu harddisk-nya ter-mount:
#   Linux : lsblk ; df -h | grep -i media
#   macOS : ls /Volumes
#
# Yang dihasilkan di <dest>/eznihongo/:
#   eznihongo-<tanggal>.bundle        -> git bundle (semua branch + history),
#                                        restore: git clone <file>.bundle eznihongo
#   eznihongo-worktree-<tanggal>.tar.gz -> arsip seluruh folder repo apa adanya
#
# Catatan keamanan: arsip worktree berisi backend/.env (DATABASE_URL, key
# Midtrans, dll). Pakai disk ter-enkripsi, atau enkripsi arsipnya sendiri:
#   gpg --symmetric --cipher-algo AES256 eznihongo-worktree-<tanggal>.tar.gz

set -euo pipefail

DEST=${1:-}
if [ -z "$DEST" ]; then
  echo "Usage: $0 <path-mount-harddisk-external>" >&2
  echo "Contoh: $0 /media/$USER/MyBackup" >&2
  exit 1
fi

if [ ! -d "$DEST" ]; then
  echo "FATAL: '$DEST' bukan direktori / belum ter-mount" >&2
  exit 1
fi
if [ ! -w "$DEST" ]; then
  echo "FATAL: '$DEST' tidak bisa ditulis (cek permission / mount read-only)" >&2
  exit 1
fi

# Akar repo, supaya script bisa dipanggil dari mana saja.
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
REPO_NAME=$(basename "$REPO_ROOT")

OUT="$DEST/eznihongo"
mkdir -p "$OUT"
TS=$(date +%Y%m%d-%H%M%S)

BUNDLE="$OUT/eznihongo-$TS.bundle"
echo "[$(date -Is)] git bundle -> $BUNDLE"
git -C "$REPO_ROOT" bundle create "$BUNDLE" --all
git -C "$REPO_ROOT" bundle verify "$BUNDLE" >/dev/null
echo "[$(date -Is)] bundle OK"

TARBALL="$OUT/eznihongo-worktree-$TS.tar.gz"
echo "[$(date -Is)] tar worktree -> $TARBALL"
tar -czf "$TARBALL" -C "$(dirname "$REPO_ROOT")" "$REPO_NAME"

# Flush ke disk biar aman kalau langsung dicabut.
sync

BSIZE=$(stat -c%s "$BUNDLE" 2>/dev/null || stat -f%z "$BUNDLE")
TSIZE=$(stat -c%s "$TARBALL" 2>/dev/null || stat -f%z "$TARBALL")
echo "[$(date -Is)] DONE"
echo "  $BUNDLE ($BSIZE bytes)"
echo "  $TARBALL ($TSIZE bytes)"
echo
echo "Jangan lupa eject: sudo umount '$DEST'   (macOS: diskutil eject '$DEST')"
