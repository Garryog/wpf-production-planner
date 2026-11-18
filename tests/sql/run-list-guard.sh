#!/bin/bash
# Runs tests/sql/list-guard.sql on a THROWAWAY local Postgres database (never the live project). The SQL under test is taken
# word for word from SUPABASE_CHANGES.md (the Stage 3 block and the 18 Nov boxes: read-only check, guard, restore, undo), so the test can't
# drift from what Garry pastes. Usage: tests/sql/run-list-guard.sh [db name, default wpf_listguard_test]  (needs psql + createdb)
set -e
cd "$(dirname "$0")/../.."
DB=${1:-wpf_listguard_test}
OUT=$(mktemp -d)
box(){ # $1 = heading text, $2 = which ```sql box under it (1 = first)
  awk -v h="$1" -v n="$2" 'index($0,"## ")==1&&index($0,h){on=1;k=0;next} on&&index($0,"## ")==1{on=0}
    on&&$0=="```sql"{k++;if(k==n){p=1;next}} p&&$0=="```"{exit} p{print}' SUPABASE_CHANGES.md; }
box '2026-11-02 — Stage 3 cutting lists' 1 > "$OUT/stage3.sql"
box '2026-11-18 — Empty-save guard' 1 > "$OUT/check.sql"
box '2026-11-18 — Empty-save guard' 2 > "$OUT/guard.sql"
box '2026-11-18 — Empty-save guard' 3 | grep -v '<<< CHANGE THIS LINE' > "$OUT/restore.sql"
box '2026-11-18 — Empty-save guard' 4 > "$OUT/undo.sql"
grep -q "pg_get_function_identity_arguments" "$OUT/check.sql" && grep -q "p_empty_ok boolean default false" "$OUT/guard.sql" && grep -q "UNDO THE EMPTY-SAVE GUARD" "$OUT/undo.sql" || { echo "the 18 Nov boxes are not in the expected order (check, guard, restore, undo)"; exit 1; }
for f in stage3 check guard restore undo; do [ -s "$OUT/$f.sql" ] || { echo "could not find the $f box in SUPABASE_CHANGES.md"; exit 1; }; done
if [ "$(id -u)" = 0 ]; then RUN(){ su postgres -c "$*"; }; else RUN(){ bash -c "$*"; }; fi
RUN "dropdb --if-exists $DB" && RUN "createdb -E UTF8 -T template0 $DB"
chmod -R a+rX "$OUT"
RUN "psql -X -q -v ON_ERROR_STOP=1 -d $DB -v dir=$OUT -f $(pwd)/tests/sql/list-guard.sql"
RUN "dropdb $DB"
rm -rf "$OUT"
