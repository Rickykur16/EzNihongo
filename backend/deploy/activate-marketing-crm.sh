#!/usr/bin/env bash
set -euo pipefail

expected_sha=${1:-}
if [[ ! "$expected_sha" =~ ^[0-9a-f]{40}$ ]] || [ "$(id -u)" -ne 0 ]; then
  echo 'FATAL: full release SHA and root are required' >&2
  exit 1
fi

cd /var/www/eznihongo
if [ "$(git rev-parse HEAD)" != "$expected_sha" ] || ! git diff --quiet || ! git diff --cached --quiet; then
  echo 'FATAL: deployed checkout differs from the reviewed release' >&2
  exit 1
fi
if [ "$(systemctl is-active eznihongo-api)" != active ]; then
  echo 'FATAL: API must be healthy before CRM activation' >&2
  exit 1
fi

exec 9>/var/lock/eznihongo-marketing-crm.lock
if ! flock -n 9; then
  echo 'FATAL: another CRM activation is running' >&2
  exit 1
fi

env_file=/var/www/eznihongo/backend/.env
backup_dir=/var/backups/eznihongo
test -f "$env_file"
test -d "$backup_dir"
set -a
. "$env_file"
set +a
test -n "${DATABASE_URL:-}"

database_bytes=$(psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc 'SELECT pg_database_size(current_database())')
available_bytes=$(df -PB1 "$backup_dir" | awk 'NR==2 {print $4}')
if ! [[ "$database_bytes" =~ ^[0-9]+$ && "$available_bytes" =~ ^[0-9]+$ ]] || (( available_bytes < database_bytes * 3 + 1073741824 )); then
  echo 'FATAL: insufficient free disk space for backup and restore drill' >&2
  exit 1
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)-$$"
dump="$backup_dir/crm-preactivate-${expected_sha:0:12}-$stamp.dump"
env_backup="$backup_dir/crm-preactivate-${expected_sha:0:12}-$stamp.env"
drill_db="ez_crm_drill_$(date +%s)_$$"
drill_created=0
drill_dump=
cleanup(){
  if [ "$drill_created" = 1 ]; then
    runuser -u postgres -- dropdb --if-exists "$drill_db" || echo 'WARNING: disposable restore database needs manual cleanup' >&2
  fi
  if [ -n "$drill_dump" ]; then rm -f -- "$drill_dump"; fi
}
trap cleanup EXIT

umask 077
pg_dump -d "$DATABASE_URL" -F c -f "$dump"
pg_restore --list "$dump" > /dev/null
drill_dump=$(mktemp /tmp/ez-crm-restore.XXXXXX)
install -m 0600 -o postgres -g postgres "$dump" "$drill_dump"
runuser -u postgres -- createdb --template=template0 "$drill_db"
drill_created=1
runuser -u postgres -- pg_restore --exit-on-error --no-owner --no-acl --dbname="$drill_db" "$drill_dump"
runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -Atqc 'SELECT count(*) FROM users' "$drill_db" > /dev/null
runuser -u postgres -- dropdb "$drill_db"
drill_created=0
rm -f -- "$drill_dump"
drill_dump=
echo 'Fresh PostgreSQL backup restored successfully into a disposable database'

# Both opt-in migrations use the just-reviewed production target explicitly.
COMPANY_DATABASE_URL="$DATABASE_URL" node backend/company-migrations/run.js --apply --ack-compatible-cleanup
CRM_DATABASE_URL="$DATABASE_URL" node backend/crm-migrations/run.js --apply
ledger=$(psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc "SELECT (SELECT count(*) FROM company_schema_migrations)::text || ':' || (SELECT count(*) FROM crm_schema_migrations)::text")
if [ "$ledger" != '2:2' ]; then
  echo "FATAL: migration ledgers incomplete ($ledger)" >&2
  exit 1
fi
if [ "$(git rev-parse HEAD)" != "$expected_sha" ]; then
  echo 'FATAL: deployed SHA changed during activation' >&2
  exit 1
fi

install -m 0600 "$env_file" "$env_backup"
node backend/deploy/set-marketing-crm-flags.mjs --enable "$env_file"
healthy=0
if systemctl restart eznihongo-api; then
  for attempt in 1 2 3 4 5 6; do
    if curl -fsS http://127.0.0.1:3001/api/health > /dev/null; then healthy=1; break; fi
    sleep 2
  done
fi
if [ "$healthy" = 1 ]; then
  if ! company_status=$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/api/company/access) || [ "$company_status" != 401 ]; then healthy=0; fi
fi
if [ "$healthy" != 1 ]; then
  echo 'FATAL: API health check failed; restoring prior flags' >&2
  node backend/deploy/set-marketing-crm-flags.mjs --restore "$env_file" "$env_backup"
  systemctl restart eznihongo-api
  exit 1
fi
echo "Marketing CRM active on release $expected_sha; Company staff access remains unchanged"
