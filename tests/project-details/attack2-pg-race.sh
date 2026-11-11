#!/bin/bash
# Tester attack 2, round 3: two sessions retire the last two specs of a project at the same moment on a THROWAWAY Postgres
# copy (never live). Usage: bash tests/project-details/attack2-pg-race.sh <throwaway db>   → prints OK or FINDING
DB=${1:?throwaway database name}; P="psql -h /tmp/pgwpf -p 5499 -U postgres -d $DB -Atq"
$P -c "update production_planner set settings=jsonb_build_object('listStore','migrating') where id='main' and coalesce(settings->>'listStore','v1')='v1'; update production_planner set settings=jsonb_build_object('listStore','v2') where id='main' and settings->>'listStore'='migrating';
insert into projects(id,name) values('RC','Race') on conflict do nothing;
insert into project_specs(id,project_id,name) values('RC1','RC','One'),('RC2','RC','Two') on conflict (id) do update set active=true;"
for round in 1 2 3; do
  $P -c "update project_specs set active=true where project_id='RC'"
  # session A: retire RC1 and hold the transaction open; session B: retire RC2 meanwhile; then A commits
  ( $P -c "set role anon; begin; update project_specs set active=false where id='RC1'; select pg_sleep(1.5); commit;" 2>&1 | sed 's/^/A: /' ) &
  sleep 0.4
  ( $P -c "set role anon; begin; update project_specs set active=false where id='RC2'; commit;" 2>&1 | sed 's/^/B: /' ) &
  wait
  n=$($P -c "select count(*) from project_specs where project_id='RC' and active")
  [ "$n" -ge 1 ] && echo "OK round $round: $n spec(s) still in use" || echo "FINDING round $round: no spec in use"
  # reverse timing: B first, A second
  $P -c "update project_specs set active=true where project_id='RC'"
  ( $P -c "set role anon; begin; update project_specs set active=false where id='RC2'; select pg_sleep(1); commit;" 2>&1 | sed 's/^/B: /' ) &
  sleep 0.2
  ( $P -c "set role anon; update project_specs set active=false where id='RC1';" 2>&1 | sed 's/^/A(autocommit): /' ) &
  wait
  n=$($P -c "select count(*) from project_specs where project_id='RC' and active")
  [ "$n" -ge 1 ] && echo "OK round ${round}b: $n spec(s) still in use" || echo "FINDING round ${round}b: no spec in use"
done
# retire a spec while another session saves an item on it (the item check takes no lock)
$P -c "insert into project_specs(id,project_id,name) values('RC3','RC','Three') on conflict (id) do update set active=true; update project_specs set active=true where project_id='RC'"
( $P -c "set role anon; begin; update project_specs set active=false where id='RC3'; select pg_sleep(1.5); commit;" 2>&1 | sed 's/^/A: /' ) &
sleep 0.4
( $P -c "set role anon; insert into project_spec_items(id,project_id,spec_id,item,value,updated_by) values('RCI','RC','RC3','Hinges','Blum','B');" 2>&1 | sed 's/^/B: /' ) &
wait
n=$($P -c "select count(*) from project_spec_items i join project_specs s on s.id=i.spec_id where i.id='RCI' and not s.active")
[ "$n" = 0 ] && echo "OK retire vs item save: nothing ended up on the retired spec" || echo "FINDING retire vs item save at the same moment: the item landed on the spec that was just retired (no lock on the item side)"
