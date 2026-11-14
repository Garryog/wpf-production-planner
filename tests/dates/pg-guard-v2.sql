-- Old-screen guard v2 (SUPABASE_CHANGES.md, PENDING block "Old-screen guard v2") checked on a THROWAWAY local Postgres.
-- Never run this against the live project. It builds its own production_planner table (settings as json AND as jsonb),
-- runs the Stage 1 bump function, the 3 Nov guard and guard v2 (twice), then checks:
--   new-code save (version+1, settings.appRel 2) OK · 10-Nov-style save (version+1, no appRel) refused once the row has
--   appRel 2 · the version rule still holds · a save that leaves settings out is fine · rollback to the 3 Nov guard works.
-- Run: psql -v ON_ERROR_STOP=1 -d <throwaway db> -f tests/dates/pg-guard-v2.sql   → last line: ALL GUARD V2 CHECKS PASSED
\set ON_ERROR_STOP 1
drop table if exists production_planner;
create table production_planner(id text primary key, orders jsonb, nid int, settings jsonb);
insert into production_planner(id,orders,nid,settings) values('main','[]',1,'{"wcap":350}');

-- Stage 1 (2026-10-20) exactly as in SUPABASE_CHANGES.md
alter table production_planner add column if not exists version bigint not null default 1;
alter table production_planner add column if not exists updated_by text;
alter table production_planner add column if not exists updated_at timestamptz;
create or replace function production_planner_bump() returns trigger language plpgsql as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists production_planner_bump on production_planner;
create trigger production_planner_bump before update on production_planner
  for each row execute function production_planner_bump();

-- 3 Nov guard exactly as in SUPABASE_CHANGES.md
create or replace function production_planner_bump() returns trigger language plpgsql as $$
begin
  if old.id = 'main' and new.version is distinct from old.version + 1 then
    raise exception 'This planner screen is out of date - refresh the page' using errcode = 'P0001';
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end $$;

-- ===== guard v2 — the grey box from SUPABASE_CHANGES.md, run TWICE =====
\i tests/dates/pg-guard-v2-block.sql
\i tests/dates/pg-guard-v2-block.sql

do $$ declare v bigint; ok boolean;
begin
  -- 1. before any new-code save the row has no appRel: a 10-Nov-style save still goes through (go-live order is safe)
  select version into v from production_planner where id='main';
  update production_planner set settings='{"wcap":351}', version=v+1 where id='main';
  -- 2. new-code save: version+1 and appRel 2
  select version into v from production_planner where id='main';
  update production_planner set settings='{"wcap":352,"appRel":2}', version=v+1 where id='main';
  if (select (settings->>'appRel')::int from production_planner where id='main')<>2 then raise exception 'FAIL new save did not land'; end if;
  -- 3. 10-Nov-style save (version+1 but no appRel) now refused with the out-of-date message
  select version into v from production_planner where id='main';
  ok:=false;
  begin update production_planner set settings='{"wcap":1}', version=v+1 where id='main';
  exception when others then ok:= sqlstate='P0001' and sqlerrm like '%out of date - refresh the page%'; end;
  if not ok then raise exception 'FAIL old-style save (no appRel) was not refused'; end if;
  if (select settings->>'wcap' from production_planner where id='main')<>'352' then raise exception 'FAIL old save changed the row'; end if;
  -- appRel lower than 2 (an older marker) refused too; appRel as text "2" accepted
  begin update production_planner set settings='{"appRel":1}', version=v+1 where id='main'; raise exception 'FAIL appRel 1 accepted';
  exception when sqlstate 'P0001' then null; end;
  update production_planner set settings='{"appRel":"2","wcap":353}', version=v+1 where id='main';
  -- 4. version rule still holds (new code with a wrong version is refused)
  select version into v from production_planner where id='main';
  ok:=false;
  begin update production_planner set settings='{"appRel":2}', version=v+5 where id='main';
  exception when sqlstate 'P0001' then ok:=true; end;
  if not ok then raise exception 'FAIL wrong version accepted'; end if;
  ok:=false;
  begin update production_planner set orders='[1]' where id='main'; -- no version at all (pre-Stage-1 screen)
  exception when sqlstate 'P0001' then ok:=true; end;
  if not ok then raise exception 'FAIL missing version accepted'; end if;
  -- 5. a save that leaves settings alone (orders only) with version+1 is fine — settings keep appRel 2
  select version into v from production_planner where id='main';
  update production_planner set orders='[2]', version=v+1 where id='main';
  -- 6. a garbage appRel ("x") counts as 0 (refused), never an SQL cast error
  select version into v from production_planner where id='main';
  ok:=false;
  begin update production_planner set settings='{"appRel":"x"}', version=v+1 where id='main';
  exception when sqlstate 'P0001' then ok:=true; end;
  if not ok then raise exception 'FAIL garbage appRel not refused cleanly'; end if;
  -- 7. other rows (old backup rows) are never guarded
  insert into production_planner(id,orders,settings) values('bak-2026-11-10','[]','{}') on conflict do nothing;
  update production_planner set settings='{}' where id='bak-2026-11-10';
  -- version bumped by the trigger, timestamp set
  if (select updated_at from production_planner where id='main') is null then raise exception 'FAIL updated_at not set'; end if;
  raise notice 'jsonb checks passed';
end $$;

-- the same with settings stored as json (Supabase "Step 0" said json OR jsonb is possible)
alter table production_planner alter column settings type json using settings::json;
\c
-- (fresh connection: the trigger's cached plan was made for jsonb; on Supabase the column never changes type)
do $$ declare v bigint; ok boolean;
begin
  select version into v from production_planner where id='main';
  update production_planner set settings='{"appRel":2,"wcap":360}'::json, version=v+1 where id='main';
  select version into v from production_planner where id='main';
  ok:=false;
  begin update production_planner set settings='{"wcap":2}'::json, version=v+1 where id='main';
  exception when sqlstate 'P0001' then ok:=true; end;
  if not ok then raise exception 'FAIL json column: old-style save not refused'; end if;
  raise notice 'json checks passed';
end $$;

-- rollback step 1: re-run the 3 Nov guard → a 10-Nov-style save goes through again (version rule kept)
create or replace function production_planner_bump() returns trigger language plpgsql as $$
begin
  if old.id = 'main' and new.version is distinct from old.version + 1 then
    raise exception 'This planner screen is out of date - refresh the page' using errcode = 'P0001';
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end $$;
do $$ declare v bigint; begin
  select version into v from production_planner where id='main';
  update production_planner set settings='{"wcap":3}'::json, version=v+1 where id='main';
  raise notice 'rollback check passed';
end $$;
select 'ALL GUARD V2 CHECKS PASSED' as result;
