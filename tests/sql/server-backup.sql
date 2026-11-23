-- Nightly server backup (SUPABASE_CHANGES.md, 23 Nov PENDING block) on a THROWAWAY local Postgres. NEVER run against the live
-- project. Run it with tests/sql/run-server-backup.sh, which cuts the grey boxes out of SUPABASE_CHANGES.md word for word into
-- :dir (stage1.sql, check.sql, job.sql — its "create extension pg_cron" line swapped for pg-cron-stub.sql — jobcheck.sql,
-- latest.sql, runs.sql, undo.sql; and check / jobcheck / latest again as "create temp table … as <box>" so their rows can be checked).
-- Last line when everything passes: ALL SERVER BACKUP CHECKS PASSED
\set ON_ERROR_STOP 1
set client_min_messages = warning;

-- ---------- what Supabase already has: the API roles, the Stage 1 block (planner_backups), the planner record ----------
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
create table production_planner(id text primary key, orders jsonb, nid int, settings jsonb);
\set f :dir '/stage1.sql'
\i :f
insert into production_planner(id, orders, nid, settings) values
 ('main', '[{"wo":"WO-1","title":"Kitchen 1","week":"2026-W48"},{"wo":"WO-2","title":"Robe 2","notes":"it''s \"quoted\" · ünïcode"}]', 7,
  '{"appRel":"r1","weekCaps":{"2026-W48":40},"staff":[{"id":"S1","n":"Ann","r":["driver"]}],"saveIds":["a1"],"listStore":"v2","listStoreAt":"2026-11-02T10:00:00Z"}'),
 ('bak-2026-11-09', '[{"wo":"OLD"}]', 1, '{}');
set client_min_messages = notice;

create function t_ok(n text, c boolean, d text default null) returns void language plpgsql as $$
begin if c is distinct from true then raise exception 'FAIL %  %', n, coalesce(d, ''); end if; raise notice 'PASS %', n; end $$;
create function t_day0() returns timestamptz language sql as $$ select date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' $$;
create function t_nightly() returns int language sql as $$ select count(*)::int from planner_backups where reason = 'nightly · server' $$;
create function t_today() returns int language sql as $$ select count(*)::int from planner_backups where taken_at >= t_day0() $$;
create table t_main as select * from production_planner;
create table t_ver as select version from production_planner where id = 'main';

-- ---------- 1. the read-only check (Garry's step 2) ----------
\set f :dir '/check.sql'
\i :f
\set f :dir '/check_as_t_chk.sql'
\i :f
select t_ok('1 read-only check: backups_table = true, main_record = 1 (pg_cron_available is 0 here — no pg_cron locally; 1 on Supabase)',
  (select backups_table and main_record = 1 and pg_cron_available in (0, 1) from t_chk));

-- ---------- 2. the job block, run TWICE (safe to run twice) ----------
\set f :dir '/job.sql'
\i :f
\i :f
select t_ok('2a after running twice there is exactly ONE job planner-nightly-backup', (select count(*) from cron.job) = 1);
select t_ok('2b it runs at 00:20 UTC every day and is active', (select schedule = '20 0 * * *' and active from cron.job));
select t_ok('2c making the job changed no data (no backup taken yet, planner record untouched)',
  (select count(*) from planner_backups) = 0 and (select orders = (select orders from t_main where id = 'main') from production_planner where id = 'main'));
\set f :dir '/jobcheck.sql'
\i :f
\set f :dir '/jobcheck_as_t_jc.sql'
\i :f
select t_ok('2d Garry''s check box (step 4): one row, right_copy = true', (select count(*) = 1 and bool_and(right_copy) from t_jc));

-- ---------- 3. the first night: one copy, same shape as the app's backupNow(), 30-day prune ----------
insert into planner_backups(taken_at, reason, orders_count, payload) values
 (now() - interval '31 days',               'daily · Ann [office]',  1, '{"orders":[{"wo":"A31"}],"nid":1,"settings":{}}'),
 (now() - interval '30 days' + interval '1 hour', 'daily · Ann [office]', 1, '{"orders":[{"wo":"B30"}],"nid":1,"settings":{}}'),
 (now() - interval '29 days',               'before Clear Week · Bob [office]', 1, '{"orders":[{"wo":"C29"}],"nid":1,"settings":{}}'),
 (t_day0() - interval '1 second',           'daily · Ann [office]',  1, '{"orders":[{"wo":"Dyest"}],"nid":1,"settings":{}}');
select command from cron.job where jobname = 'planner-nightly-backup' \gexec
select t_ok('3a one nightly copy taken (reason "nightly · server", taken now)',
  t_nightly() = 1 and (select taken_at > now() - interval '1 minute' from planner_backups where reason = 'nightly · server'));
select t_ok('3b orders_count = the jobs on the board = the jobs in the copy (2)',
  (select orders_count = 2 and jsonb_array_length(payload->'orders') = 2 from planner_backups where reason = 'nightly · server'));
select t_ok('3c payload has exactly the keys backupNow() writes: orders, nid, settings',
  (select array_agg(k order by k) = array['nid','orders','settings'] from planner_backups b, jsonb_object_keys(b.payload) k where reason = 'nightly · server'));
select t_ok('3d payload.orders is the planner record''s orders exactly (quotes, apostrophes, unicode kept)',
  (select payload->'orders' = (select orders from t_main where id = 'main') from planner_backups where reason = 'nightly · server'));
select t_ok('3e payload.nid is the record''s nid (a number, as the app sends it)',
  (select payload->'nid' = '7'::jsonb from planner_backups where reason = 'nightly · server'));
select t_ok('3f payload.settings = the record''s settings without the lists switch (listStore, listStoreAt) — like bakSettings()',
  (select payload->'settings' = (select settings - 'listStore' - 'listStoreAt' from t_main where id = 'main')
     and not (payload->'settings' ? 'listStore') and not (payload->'settings' ? 'listStoreAt')
     and payload->'settings'->'saveIds' = '["a1"]' and payload->'settings'->'staff'->0->>'n' = 'Ann'
   from planner_backups where reason = 'nightly · server'));
select t_ok('3g copied from id main only (the old bak-2026-11-09 row is not what was copied)',
  (select not (payload::text like '%"OLD"%') from planner_backups where reason = 'nightly · server'));
select t_ok('3h the copy older than 30 days is gone', not exists (select 1 from planner_backups where payload->'orders'->0->>'wo' = 'A31'));
select t_ok('3i copies newer than 30 days are all kept (30 days minus 1 hour, 29 days, yesterday 23:59:59 UTC)',
  (select count(*) from planner_backups where payload->'orders'->0->>'wo' in ('B30','C29','Dyest')) = 3);
select t_ok('3j the planner record was not changed (orders, nid, settings incl. the lists switch, version)',
  (select p.orders = t.orders and p.nid = t.nid and p.settings = t.settings and p.version = (select version from t_ver)
     from production_planner p join t_main t using (id) where p.id = 'main'));
select t_ok('3k the bak-2026-11-09 row in production_planner is untouched', (select orders = '[{"wo":"OLD"}]' from production_planner where id = 'bak-2026-11-09'));
-- what the app's Settings line reads (lastBackup: newest taken_at + orders_count) and what backupNow() checks on read-back
select t_ok('3l the newest backup is the nightly one, and orders_count matches its payload (the app''s read-back rule)',
  (select reason = 'nightly · server' and orders_count = jsonb_array_length(payload->'orders') from planner_backups order by taken_at desc limit 1));

-- ---------- 4. one a day: running again, or after a screen's copy, adds nothing ----------
select command from cron.job where jobname = 'planner-nightly-backup' \gexec
select t_ok('4a run again the same day: still ONE nightly copy', t_nightly() = 1);
delete from planner_backups where reason = 'nightly · server';  -- (throwaway test database only)
insert into planner_backups(taken_at, reason, orders_count, payload) values
 (t_day0() + interval '1 second', 'daily · Ann [office]', 2, '{"orders":[{"wo":"WO-1"},{"wo":"WO-2"}],"nid":7,"settings":{}}');
select command from cron.job where jobname = 'planner-nightly-backup' \gexec
select t_ok('4b an office screen already took today''s copy: the job takes none', t_nightly() = 0 and t_today() = 1);
delete from planner_backups where taken_at >= t_day0();
select command from cron.job where jobname = 'planner-nightly-backup' \gexec
select t_ok('4c a copy from yesterday 23:59:59 UTC does not count as today: the job takes one', t_nightly() = 1);

-- ---------- 5. nothing good to copy: no copy, and nothing is pruned ----------
delete from planner_backups where taken_at >= t_day0();
insert into planner_backups(taken_at, reason, orders_count, payload) values (now() - interval '40 days', 'daily · Ann [office]', 1, '{"orders":[{"wo":"E40"}],"nid":1,"settings":{}}');
update production_planner set orders = null where id = 'main';
select command from cron.job where jobname = 'planner-nightly-backup' \gexec
select t_ok('5a orders missing on the record: no copy taken (no error either)', t_today() = 0);
select t_ok('5b ...and the 40-day-old copy is KEPT (only pruned when today''s copy is good)', exists (select 1 from planner_backups where payload->'orders'->0->>'wo' = 'E40'));
update production_planner set orders = '{"not":"a list"}' where id = 'main';
select command from cron.job where jobname = 'planner-nightly-backup' \gexec
select t_ok('5c orders not a list: no copy, old copy kept', t_today() = 0 and exists (select 1 from planner_backups where payload->'orders'->0->>'wo' = 'E40'));
update production_planner set id = 'main-moved' where id = 'main';
select command from cron.job where jobname = 'planner-nightly-backup' \gexec
select t_ok('5d no main record at all: no copy, old copy kept', t_today() = 0 and exists (select 1 from planner_backups where payload->'orders'->0->>'wo' = 'E40'));
update production_planner set id = 'main', orders = (select orders from t_main where id = 'main') where id = 'main-moved';

-- ---------- 6. columns stored as json (not jsonb), settings missing — still the same shape ----------
alter table production_planner alter column orders type json using orders::json, alter column settings type json using settings::json;
select command from cron.job where jobname = 'planner-nightly-backup' \gexec
select t_ok('6a json columns: copy taken, same orders, settings without the switch',
  (select orders_count = 2 and payload->'orders' = (select orders from t_main where id = 'main')
     and payload->'settings' = (select settings - 'listStore' - 'listStoreAt' from t_main where id = 'main')
   from planner_backups where reason = 'nightly · server'));
select t_ok('6b ...and now the 40-day-old copy is pruned', not exists (select 1 from planner_backups where payload->'orders'->0->>'wo' = 'E40'));
delete from planner_backups where reason = 'nightly · server';
update production_planner set settings = null where id = 'main';
select command from cron.job where jobname = 'planner-nightly-backup' \gexec
select t_ok('6c settings missing: copy taken with settings {}', (select payload->'settings' = '{}'::jsonb from planner_backups where reason = 'nightly · server'));

-- ---------- 7. Garry's look-up boxes run (steps 5 and 6) ----------
\set f :dir '/latest.sql'
\i :f
\set f :dir '/latest_as_t_lat.sql'
\i :f
select t_ok('7a "latest backups" box: newest row is the nightly copy, orders_count = jobs_in_copy',
  (select reason = 'nightly · server' and orders_count = jobs_in_copy from t_lat order by taken_at desc limit 1));
\set f :dir '/runs.sql'
\i :f
select t_ok('7b "job runs" box runs', true);

-- ---------- 8. Undo (twice), then the block again ----------
\set f :dir '/undo.sql'
\i :f
\i :f
select t_ok('8a undo run twice: no job left, no error', (select count(*) from cron.job) = 0);
select t_ok('8b undo kept every backup', (select count(*) from planner_backups) >= 4);
\set f :dir '/job.sql'
\i :f
select t_ok('8c the block can be run again after undo: one job', (select count(*) from cron.job where jobname = 'planner-nightly-backup') = 1);

\echo ALL SERVER BACKUP CHECKS PASSED
