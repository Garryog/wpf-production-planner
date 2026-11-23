#!/bin/bash
# Tester attack (health check 23 Nov 2026) on the nightly server backup job. THROWAWAY local Postgres only — never live.
# Takes the Stage 1 box and the 23 Nov job box word for word from SUPABASE_CHANGES.md (pg_cron line swapped for
# tests/sql/pg-cron-stub.sql, as run-server-backup.sh does) and runs tests/sql/server-backup-attack.sql.
# Usage: tests/sql/run-server-backup-attack.sh [db name]   Last line when all pass: ALL SERVER BACKUP ATTACK CHECKS PASSED
set -e
cd "$(dirname "$0")/../.."
DB=${1:-wpf_serverbackup_attack}
OUT=$(mktemp -d)
box(){ awk -v h="$1" -v n="$2" 'index($0,"## ")==1&&index($0,h){on=1;k=0;next} on&&index($0,"## ")==1{on=0}
    on&&$0=="```sql"{k++;if(k==n){p=1;next}} p&&$0=="```"{exit} p{print}' SUPABASE_CHANGES.md; }
box '2026-10-20 — Stage 1' 1 > "$OUT/stage1.sql"
box '2026-11-23 — Nightly server backup' 2 > "$OUT/job.raw.sql"
grep -q "cron.schedule('planner-nightly-backup'" "$OUT/job.raw.sql" || { echo "job box not found"; exit 1; }
awk -v stub=tests/sql/pg-cron-stub.sql '$0=="create extension if not exists pg_cron;"{while((getline l < stub)>0)print l;next}{print}' "$OUT/job.raw.sql" > "$OUT/job.sql"
cp tests/sql/server-backup-attack.sql "$OUT/test.sql"; chmod -R a+rX "$OUT"
if [ "$(id -u)" = 0 ]; then RUN(){ su postgres -c "$*"; }; else RUN(){ bash -c "$*"; }; fi
RUN "dropdb --if-exists $DB" && RUN "createdb -E UTF8 -T template0 $DB"
RUN "PGTZ=America/Los_Angeles psql -X -q -v ON_ERROR_STOP=1 -d $DB -v dir=$OUT -f $OUT/test.sql"
RUN "dropdb $DB"; rm -rf "$OUT"
