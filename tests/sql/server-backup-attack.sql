-- Tester attack on the 23 Nov nightly server backup job (run by tests/sql/run-server-backup-attack.sh). THROWAWAY database only.
\set ON_ERROR_STOP 1
set client_min_messages = warning;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
  -- stand-in for Supabase's "postgres" role: NOT a superuser, no BYPASSRLS, owns the tables (as when made in the SQL editor)
  if not exists (select 1 from pg_roles where rolname = 'wpf_owner') then create role wpf_owner nologin nosuperuser nobypassrls; end if;
end $$;
create table production_planner(id text primary key, orders jsonb, nid int, settings jsonb);
\set f :dir '/stage1.sql'
\i :f
\set f :dir '/job.sql'
\i :f
set client_min_messages = notice;
create function t_ok(n text, c boolean, d text default null) returns void language plpgsql as $$
begin if c is distinct from true then raise exception 'FAIL %  %', n, coalesce(d, ''); end if; raise notice 'PASS %', n; end $$;
create function t_day0() returns timestamptz language sql as $$ select date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' $$;
create table t_cmd as select command from cron.job where jobname = 'planner-nightly-backup';
grant select on t_cmd to public;

-- X1: the only backup with today's date is broken (orders not a list): no nightly copy (one a day) and NOTHING pruned
insert into production_planner values ('main', '[{"wo":"WO-1"}]', 2, '{"appRel":"r"}');
insert into planner_backups(taken_at, reason, orders_count, payload) values
 (now() - interval '45 days', 'daily · Ann [office]', 1, '{"orders":[{"wo":"OLD45"}],"nid":1,"settings":{}}'),
 (t_day0() + interval '1 second', 'broken', 0, '{"orders":null}');
select command from t_cmd \gexec
select t_ok('X1 today''s only backup is broken: the 45-day-old copy is KEPT', exists (select 1 from planner_backups where payload->'orders'->0->>'wo' = 'OLD45'));
delete from planner_backups where reason = 'broken';

-- X2: a backup at exactly 00:00:00.000 UTC today counts as today (no second copy); 23:59:59.999 yesterday does not
insert into planner_backups(taken_at, reason, orders_count, payload) values (t_day0(), 'daily · Ann [office]', 1, '{"orders":[{"wo":"WO-1"}],"nid":2,"settings":{}}');
select command from t_cmd \gexec
select t_ok('X2a backup at 00:00:00 UTC today: job takes no copy', (select count(*) from planner_backups where reason = 'nightly · server') = 0);
update planner_backups set taken_at = t_day0() - interval '1 millisecond' where taken_at = t_day0();
select command from t_cmd \gexec
select t_ok('X2b backup at 23:59:59.999 UTC yesterday: job takes one', (select count(*) from planner_backups where reason = 'nightly · server') = 1);
select t_ok('X2c ...and the 45-day-old copy is pruned now that a good copy exists', not exists (select 1 from planner_backups where payload->'orders'->0->>'wo' = 'OLD45'));
delete from planner_backups;

-- X3: 2,500-job board with awkward text: copied exactly, count right
update production_planner set orders = (select jsonb_agg(jsonb_build_object('wo', 'WO-' || g, 'title', 'O''Grady <script>x</script> € 1,234 😀 ' || g, 'value', g * 1.5)) from generate_series(1, 2500) g) where id = 'main';
select command from t_cmd \gexec
select t_ok('X3 2,500 jobs: orders_count 2500 and payload orders identical to the record',
  (select orders_count = 2500 and payload->'orders' = (select orders from production_planner where id = 'main') from planner_backups where reason = 'nightly · server'));
delete from planner_backups;

-- X4: orders double-encoded as a JSON string (a bad save): no copy, no prune, no error
insert into planner_backups(taken_at, reason, orders_count, payload) values (now() - interval '50 days', 'daily', 1, '{"orders":[{"wo":"OLD50"}],"nid":1,"settings":{}}');
update production_planner set orders = to_jsonb('[{"wo":"WO-1"}]'::text) where id = 'main';
select command from t_cmd \gexec
select t_ok('X4 orders saved as a text string: no copy, 50-day copy kept', (select count(*) from planner_backups) = 1);
update production_planner set orders = '[{"wo":"WO-1"}]' where id = 'main';

-- X5: run as a table OWNER that is not superuser and has no BYPASSRLS (Supabase's postgres role making the job in the SQL editor):
--     RLS on planner_backups must not block it. Then with FORCE ROW LEVEL SECURITY it would — shown for information.
reset client_min_messages;
alter table production_planner owner to wpf_owner; alter table planner_backups owner to wpf_owner;
alter table production_planner enable row level security;
set client_min_messages = notice;
set role wpf_owner;
select command from t_cmd \gexec
reset role;
select t_ok('X5 owner role, RLS on both tables, not superuser: copy taken and 50-day copy pruned',
  (select count(*) from planner_backups where reason = 'nightly · server') = 1 and not exists (select 1 from planner_backups where payload->'orders'->0->>'wo' = 'OLD50'));

-- X6: nothing outside planner_backups changed by any run
select t_ok('X6 production_planner still one row, orders intact', (select count(*) from production_planner) = 1 and (select orders = '[{"wo":"WO-1"}]' from production_planner));
\echo ALL SERVER BACKUP ATTACK CHECKS PASSED
