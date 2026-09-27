#!/bin/sh
# Builds a LOCAL database for capturing app screens. Requires a running local
# Postgres and DATABASE_URL pointing at an EMPTY local database.
set -e
case "$DATABASE_URL" in *127.0.0.1*|*localhost*) ;; *) echo "refusing: DATABASE_URL must be local" >&2; exit 1;; esac
HERE=$(cd "$(dirname "$0")" && pwd); BACKEND="$HERE/../../../backend"
psql "$DATABASE_URL" -q -f "$BACKEND/schema.sql"
psql "$DATABASE_URL" -q -f "$BACKEND/seed-n5.sql"
(cd "$BACKEND" && node migrations/run.js) || echo "(migrations after 168 need production-only Bab 3 data; continuing)"
# Replay the real Bab 15 grammar migration against the Bab 15 module of this local DB.
python3 - "$BACKEND/migrations/084_bunpou_bab15.sql" > /tmp/fixture_084.sql <<'PY'
import sys
s = open(sys.argv[1]).read()
s = s.replace("""   WHERE c.slug = v_course_slug
   ORDER BY m.sort_order ASC, m.created_at ASC
   OFFSET (v_bab_no - 1) LIMIT 1;""", """   WHERE c.slug = v_course_slug AND m.slug = 'komunikasi-pelayanan' LIMIT 1;""", 1)
print(s)
PY
psql "$DATABASE_URL" -q -f /tmp/fixture_084.sql
HASH=$(cd "$BACKEND" && node -e "import('bcryptjs').then(b=>console.log(b.default.hashSync('rahasia-contoh-123',10)))")
# psql variables are not interpolated with -c, so feed the statement on stdin
echo "INSERT INTO users (email, google_name, full_name, password_hash) VALUES ('rina.contoh@example.test','Rina Pratiwi','Rina Pratiwi', :'h') ON CONFLICT DO NOTHING;" | psql "$DATABASE_URL" -q -v h="$HASH"
psql "$DATABASE_URL" -q -f "$HERE/fixture.sql"
echo "fixture ready"
