#!/bin/bash
# Runs tests/sql/server-backup.sql on a THROWAWAY local Postgres database (never the live project). The SQL under test is taken
# word for word from SUPABASE_CHANGES.md (the 2026-10-20 Stage 1 box that makes planner_backups, and the 23 Nov boxes: check,
# job, job check, latest backups, job runs, undo). Local Postgres has no pg_cron, so the job box's one line
# "create extension if not exists pg_cron;" is swapped for tests/sql/pg-cron-stub.sql (same cron.* names).
# Usage: tests/sql/run-server-backup.sh [db name, default wpf_serverbackup_test]  (needs psql + createdb)
set -e
cd "$(dirname "$0")/../.."
DB=${1:-wpf_serverbackup_test}
OUT=$(mktemp -d)
box(){ # $1 = heading text, $2 = which ```sql box under it (1 = first)
  awk -v h="$1" -v n="$2" 'index($0,"## ")==1&&index($0,h){on=1;k=0;next} on&&index($0,"## ")==1{on=0}
    on&&$0=="```sql"{k++;if(k==n){p=1;next}} p&&$0=="```"{exit} p{print}' SUPABASE_CHANGES.md; }
H='2026-11-23 — Nightly server backup'
box '2026-10-20 — Stage 1' 1 > "$OUT/stage1.sql"
box "$H" 1 > "$OUT/check.sql"
box "$H" 2 > "$OUT/job.raw.sql"
box "$H" 3 > "$OUT/jobcheck.sql"
box "$H" 4 > "$OUT/latest.sql"
box "$H" 5 > "$OUT/runs.sql"
box "$H" 6 > "$OUT/undo.sql"
for f in stage1 check job.raw jobcheck latest runs undo; do [ -s "$OUT/$f.sql" ] || { echo "could not find the $f box in SUPABASE_CHANGES.md"; exit 1; }; done
grep -q "create table if not exists planner_backups" "$OUT/stage1.sql" && grep -q "pg_cron_available" "$OUT/check.sql" \
  && grep -q "cron.schedule('planner-nightly-backup'" "$OUT/job.raw.sql" && grep -q "right_copy" "$OUT/jobcheck.sql" \
  && grep -q "jobs_in_copy" "$OUT/latest.sql" && grep -q "job_run_details" "$OUT/runs.sql" && grep -q "UNDO THE NIGHTLY SERVER BACKUP" "$OUT/undo.sql" \
  || { echo "the 23 Nov boxes are not in the expected order (check, job, job check, latest, runs, undo)"; exit 1; }
[ "$(grep -c -x 'create extension if not exists pg_cron;' "$OUT/job.raw.sql")" = 1 ] || { echo "the job box must have the line 'create extension if not exists pg_cron;' exactly once"; exit 1; }
awk -v stub=tests/sql/pg-cron-stub.sql '$0=="create extension if not exists pg_cron;"{while((getline l < stub)>0)print l;next}{print}' "$OUT/job.raw.sql" > "$OUT/job.sql"
# the boxes whose rows are checked, again as "create temp table … as <box>" (box text unchanged, last ";" moved outside)
wrap(){ { printf 'create temp table %s as\n' "$2"; sed '$ s/;[[:space:]]*$//' "$OUT/$1.sql"; echo ';'; } > "$OUT/$1_as_$2.sql"; }
wrap check t_chk; wrap jobcheck t_jc; wrap latest t_lat
if [ "$(id -u)" = 0 ]; then RUN(){ su postgres -c "$*"; }; else RUN(){ bash -c "$*"; }; fi
RUN "dropdb --if-exists $DB" && RUN "createdb -E UTF8 -T template0 $DB"
cp tests/sql/server-backup.sql "$OUT/test.sql"  # (a copy, so the postgres user can read it wherever the repo is)
chmod -R a+rX "$OUT"
# session clock set far from UTC (UTC+13) on purpose: "today" must still mean the UTC date, like the app
RUN "PGTZ=Pacific/Auckland psql -X -q -v ON_ERROR_STOP=1 -d $DB -v dir=$OUT -f $OUT/test.sql"
RUN "dropdb $DB"
rm -rf "$OUT"
