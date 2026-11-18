-- Empty-save guard + "restore a list to an old revision" (SUPABASE_CHANGES.md, 18 Nov PENDING block) on a THROWAWAY local
-- Postgres. NEVER run against the live project. Run it with tests/sql/run-list-guard.sh, which cuts the three grey boxes out
-- of SUPABASE_CHANGES.md word for word into :dir (stage3.sql, guard.sql, restore.sql minus its "CHANGE THIS LINE" line).
-- Last line when everything passes: ALL LIST GUARD CHECKS PASSED
\set ON_ERROR_STOP 1
set client_min_messages = notice;

-- ---------- what Supabase already has: the API roles and the planner record (lists switched on) ----------
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
create table production_planner(id text primary key, orders jsonb, nid int, settings jsonb, version bigint not null default 1);
insert into production_planner(id, orders, nid, settings) values ('main', '[]', 1, '{"listStore":"v2"}');

-- ---------- the Stage 3 block exactly as in SUPABASE_CHANGES.md (what live runs today) ----------
\set f :dir '/stage3.sql'
\i :f
-- the 2 Nov function exactly as live has it, to compare with what the Undo box puts back
create table t_src as select prosrc, proargnames, proargtypes from pg_proc where proname = 'save_list_revision';

-- a pass / fail helper: a failed check stops the run (ON_ERROR_STOP) with its name
create function t_ok(n text, c boolean, d text default null) returns void language plpgsql as $$
begin if c is distinct from true then raise exception 'FAIL %  %', n, coalesce(d, ''); end if; raise notice 'PASS %', n; end $$;
create function t_live(l text) returns int language sql as $$ select count(*)::int from list_lines where list_id = l and removed_rev is null $$;
create function t_ver(l text) returns int language sql as $$ select version from lists where id = l $$;

-- BEFORE the guard: the old function lets a save take every row away (this is what the guard closes)
insert into projects(id, name) values ('P1', 'Aderrig');
select save_list_revision('{"id":"L0","name":"Before","project_id":"P1","wos":["WO-0"]}',
  '[{"id":"L0:1","seq":1,"kind":"saw","part":"Side","qty":"2","length_mm":720,"width_mm":560,"material":"MFC White"}]', null, 'Op', null);
select save_list_revision('{"id":"L0"}', '[]', t_ver('L0'), 'Op', 'oops');
select t_ok('0 before the guard: an empty save takes every row away (the hole being closed)', t_live('L0') = 0);

-- ---------- the read-only check box (Garry's step 1) ----------
\set f :dir '/check.sql'
\i :f
select t_ok('C1 read-only check before the guard: exactly one row "p_list jsonb, p_lines jsonb, p_expect integer, p_by text, p_reason text"',
  (select count(*) = 1 and min(pg_get_function_identity_arguments(oid)) = 'p_list jsonb, p_lines jsonb, p_expect integer, p_by text, p_reason text' from pg_proc where proname = 'save_list_revision'));

-- ---------- the new block, run TWICE (safe to run twice) ----------
\set f :dir '/guard.sql'
\i :f
\i :f
select t_ok('1a after running twice there is exactly ONE save_list_revision',
  (select count(*) from pg_proc where proname = 'save_list_revision') = 1);
select t_ok('1b it takes 6 settings, the 6th (p_empty_ok) has a default',
  (select pronargs = 6 and pronargdefaults = 1 from pg_proc where proname = 'save_list_revision'));
select t_ok('1c anon, authenticated and service_role may call it',
  has_function_privilege('anon', 'save_list_revision(jsonb,jsonb,int,text,text,boolean)', 'execute')
  and has_function_privilege('authenticated', 'save_list_revision(jsonb,jsonb,int,text,text,boolean)', 'execute')
  and has_function_privilege('service_role', 'save_list_revision(jsonb,jsonb,int,text,text,boolean)', 'execute'));

-- ---------- 2. normal saves, as the OLD live screen and the new app send them ----------
-- a new list (5 settings by name, as PostgREST sends the app's {p_list,p_lines,p_expect,p_by,p_reason})
select save_list_revision(p_list := '{"id":"L1","name":"House 1","project_id":"P1","wos":["WO-1"]}',
  p_lines := '[{"id":"L1:1","seq":1,"kind":"saw","part":"Side","qty":"2","length_mm":720,"width_mm":560,"material":"MFC White"},
               {"id":"L1:2","seq":2,"kind":"saw","part":"Top","qty":"1","length_mm":1200,"width_mm":560,"material":"MFC White"},
               {"id":"L1:3","seq":3,"kind":"fit","part":"Hinge","qty":"8","material":"Blum"}]',
  p_expect := null, p_by := 'Op', p_reason := null);
select t_ok('2a a new list saved with the old 5 settings by name', t_live('L1') = 3 and t_ver('L1') >= 1);
-- an edit, 5 settings in order (positional)
select save_list_revision('{"id":"L1"}',
  '[{"id":"L1:1","seq":1,"kind":"saw","part":"Side","qty":"3","length_mm":720,"width_mm":560,"material":"MFC White","reset":true},
    {"id":"L1:2","seq":2,"kind":"saw","part":"Top","qty":"1","length_mm":1200,"width_mm":560,"material":"MFC White"},
    {"id":"L1:3","seq":3,"kind":"fit","part":"Hinge","qty":"8","material":"Blum"}]', t_ver('L1'), 'Op', 'qty');
select t_ok('2b an edit with the old 5 settings in order works', (select qty from list_lines where id = 'L1:1') = '3' and t_live('L1') = 3);
-- an edit taking SOME rows away (not all) is not the guard's business
select save_list_revision(p_list := '{"id":"L1"}', p_lines :=
  '[{"id":"L1:1","seq":1,"kind":"saw","part":"Side","qty":"3","length_mm":720,"width_mm":560,"material":"MFC White"}]',
  p_expect := t_ver('L1'), p_by := 'Op', p_reason := 'two gone');
select t_ok('2c a save taking 2 of 3 rows away is not refused', t_live('L1') = 1);
-- put them back for the next checks (removed rows come back by id)
select save_list_revision('{"id":"L1"}',
  '[{"id":"L1:1","seq":1,"kind":"saw","part":"Side","qty":"3","length_mm":720,"width_mm":560,"material":"MFC White"},
    {"id":"L1:2","seq":2,"kind":"saw","part":"Top","qty":"1","length_mm":1200,"width_mm":560,"material":"MFC White"},
    {"id":"L1:3","seq":3,"kind":"fit","part":"Hinge","qty":"8","material":"Blum"}]', t_ver('L1'), 'Op', 'back');
select t_ok('2d removed rows brought back', t_live('L1') = 3);

-- ---------- 3. a save that leaves NO rows is refused without the flag, and changes nothing ----------
do $$ declare v int := t_ver('L1'); m text; h text; begin
  begin
    perform save_list_revision('{"id":"L1"}', '[]', v, 'Op', 'opened empty');
    raise exception 'FAIL 3a the empty save was NOT refused';
  exception when others then get stacked diagnostics m = message_text, h = pg_exception_hint;
    if m like 'FAIL%' then raise; end if;
  end;
  perform t_ok('3a refused with a clear message', m = 'empty save refused: this save would take away all 3 rows of "House 1"', m);
  perform t_ok('3b the refusal is marked (hint empty-refused) so the app can explain it', h = 'empty-refused', h);
  perform t_ok('3c nothing changed: still 3 rows, same version', t_live('L1') = 3 and t_ver('L1') = v);
end $$;
do $$ declare v int := t_ver('L1'); m text; begin
  begin perform save_list_revision(p_list := '{"id":"L1"}', p_lines := '[]', p_expect := v, p_by := 'Op', p_reason := null, p_empty_ok := false);
    raise exception 'FAIL 3d not refused';
  exception when others then get stacked diagnostics m = message_text; if m like 'FAIL%' then raise; end if; end;
  perform t_ok('3d p_empty_ok = false: refused too', m like 'empty save refused:%' and t_live('L1') = 3, m);
  begin perform save_list_revision('{"id":"L1"}', null, v, 'Op', null);
    raise exception 'FAIL 3e not refused';
  exception when others then get stacked diagnostics m = message_text; if m like 'FAIL%' then raise; end if; end;
  perform t_ok('3e no lines at all (null): refused too', m like 'empty save refused:%' and t_live('L1') = 3, m);
end $$;

-- ---------- 4. with the flag (the person pressed OK to "This save TAKES AWAY 3 of the 3 rows") it works ----------
select save_list_revision(p_list := '{"id":"L1"}', p_lines := '[]', p_expect := t_ver('L1'), p_by := 'Op', p_reason := 'cancelled job', p_empty_ok := true);
select t_ok('4a with p_empty_ok the rows are taken away', t_live('L1') = 0);
select t_ok('4b ... marked removed, never deleted', (select count(*) from list_lines where list_id = 'L1') = 3);
select t_ok('4c the history says the person confirmed',
  (select log->-1->>'what' = 'List edited' and log->-1->>'why' = 'cancelled job · all 3 rows taken away (the person confirmed)' from lists where id = 'L1'),
  (select (log->-1)::text from lists where id = 'L1'));
-- a list that is ALREADY empty, saved empty again: nothing to protect → not refused
select save_list_revision('{"id":"L1","name":"House 1 (empty)"}', '[]', t_ver('L1'), 'Op', null);
select t_ok('4d an empty list saved empty again is not refused', (select name from lists where id = 'L1') = 'House 1 (empty)');
-- a brand-new list with no rows (e.g. a heading-less "no cutting" list) is not refused
select save_list_revision('{"id":"L9","name":"Nothing yet","project_id":"P1","wos":[]}', '[]', null, 'Op', null);
select t_ok('4e a new list with no rows is not refused', exists (select 1 from lists where id = 'L9'));
-- a stale editor is still refused as stale first (the guard does not change that order)
do $$ declare m text; begin
  begin perform save_list_revision('{"id":"L0"}', '[]', 999, 'Op', null); raise exception 'FAIL 4f';
  exception when others then get stacked diagnostics m = message_text; if m like 'FAIL%' then raise; end if; end;
  perform t_ok('4f an out-of-date editor still gets "stale"', m like 'stale:%', m);
end $$;

-- ---------- 5. restore a locked list to an old revision (the restore box, as Garry pastes it) ----------
-- L2: a template (keeps a copy at every save). Rev 1 = 3 rows; Rev 2 = Top changed + Hinge gone; Rev 3 = emptied (confirmed).
select save_list_revision('{"id":"L2","name":"T2 LH","project_id":"P1","is_template":true,"list_type":"kitchen","wos":[]}',
  '[{"id":"L2:1","seq":1,"kind":"saw","part":"Side","qty":"2","length_mm":720,"width_mm":560,"material":"MFC White"},
    {"id":"L2:2","seq":2,"kind":"saw","part":"Top","qty":"1","length_mm":1200,"width_mm":560,"material":"MFC White","note":"scribe"},
    {"id":"L2:3","seq":3,"kind":"fit","part":"Hinge","qty":"8","material":"Blum"}]', null, 'Op', null);
-- a tick on Side (a template is never ticked on the floor, but the restore must keep ticks on unchanged rows of any list)
update list_lines set status = 'cut', status_by = 'Saw' where id = 'L2:1';
update list_lines set status = 'cut', status_by = 'Saw' where id = 'L2:2';
select save_list_revision('{"id":"L2"}',
  '[{"id":"L2:1","seq":1,"kind":"saw","part":"Side","qty":"2","length_mm":720,"width_mm":560,"material":"MFC White"},
    {"id":"L2:2","seq":2,"kind":"saw","part":"Top","qty":"1","length_mm":1000,"width_mm":560,"material":"MFC White","note":"scribe","reset":true}]',
  t_ver('L2'), 'Op', 'drawing changed');
update list_lines set status = 'cut', status_by = 'Saw' where id = 'L2:2';   -- the new 1000 Top was cut too
select save_list_revision(p_list := '{"id":"L2"}', p_lines := '[]', p_expect := t_ver('L2'), p_by := 'Op', p_reason := 'oops', p_empty_ok := true);
select t_ok('5a set-up: T2 LH is at Rev 3 with no rows; copies of Rev 1 and Rev 2 kept',
  (select rev from lists where id = 'L2') = 3 and t_live('L2') = 0 and (select array_agg(rev order by rev) from list_revisions where list_id = 'L2') = '{1,2}');
create temp table t_before as select count(*) as n_lines, (select count(*) from list_revisions) as n_revs from list_lines;

-- restore to Rev 1
select set_config('wpf.restore_list', 'L2', false), set_config('wpf.restore_rev', '1', false);
\set f :dir '/restore.sql'
\i :f
select t_ok('5b restore made a NEW revision (Rev 4)', (select rev from lists where id = 'L2') = 4);
select t_ok('5c ... with exactly Rev 1''s rows', (select string_agg(part || ' ' || coalesce(qty, '') || ' ' || coalesce(length_mm::text, '') || ' ' || coalesce(note, ''), ', ' order by seq)
  from list_lines where list_id = 'L2' and removed_rev is null) = 'Side 2 720 , Top 1 1200 scribe, Hinge 8  ',
  (select string_agg(part || ' ' || coalesce(qty, '') || ' ' || coalesce(length_mm::text, '') || ' ' || coalesce(note, ''), ', ' order by seq) from list_lines where list_id = 'L2' and removed_rev is null));
select t_ok('5d the unchanged row keeps its tick (Side still cut)', (select status from list_lines where id = 'L2:1') = 'cut');
select t_ok('5e the row whose size changed back has its tick cleared (Top 1200 is not the 1000 that was cut)', (select status from list_lines where id = 'L2:2') = 'todo');
select t_ok('5f nothing deleted: same number of row records, one more kept copy (the emptied Rev 3)',
  (select count(*) from list_lines) = (select n_lines from t_before) and (select count(*) from list_revisions) = (select n_revs from t_before) + 1
  and exists (select 1 from list_revisions where list_id = 'L2' and rev = 3));
select t_ok('5g the history says "Revision 4 — Restored to Rev 1"',
  (select log->-1->>'what' = 'Revision 4' and log->-1->>'why' = 'Restored to Rev 1' from lists where id = 'L2'));
select t_ok('5h counts on the list are right (2 saw, 1 stores)', (select n_saw = 2 and n_fit = 1 from lists where id = 'L2'));

-- restore to a revision that was never kept → a clear refusal, nothing changes
select set_config('wpf.restore_list', 'L2', false), set_config('wpf.restore_rev', '7', false);
\set ON_ERROR_STOP 0
\echo -- expected next: ERROR  No copy of Rev 7 is kept for "T2 LH" — copies kept: Rev 1, Rev 2, Rev 3 ...
\i :f
\set ON_ERROR_STOP 1
select t_ok('5i Rev 7 (never kept): refused, the list is unchanged (still Rev 4, 3 rows)', (select rev from lists where id = 'L2') = 4 and t_live('L2') = 3);
-- a list id that does not exist
select set_config('wpf.restore_list', 'NOPE', false), set_config('wpf.restore_rev', '1', false);
\set ON_ERROR_STOP 0
\echo -- expected next: ERROR  There is no list with the id "NOPE" ...
\i :f
\set ON_ERROR_STOP 1
select t_ok('5j unknown list id: refused, nothing made', not exists (select 1 from lists where id = 'NOPE'));

-- restoring again to Rev 3 (the emptied one) is allowed — the restore says it on purpose (p_empty_ok)
select set_config('wpf.restore_list', 'L2', false), set_config('wpf.restore_rev', '3', false);
\i :f
select t_ok('5k restore to an EMPTY revision works (it was asked for by name), Rev 5, no rows', (select rev from lists where id = 'L2') = 5 and t_live('L2') = 0);
-- and back to Rev 4 (the restored one) brings the rows back again
select set_config('wpf.restore_list', 'L2', false), set_config('wpf.restore_rev', '4', false);
\i :f
select t_ok('5l restore to Rev 4 → Rev 6 with the 3 rows', (select rev from lists where id = 'L2') = 6 and t_live('L2') = 3);

-- an unlocked, non-template list cannot be "restored" (it has no copies and would not get a new revision)
select set_config('wpf.restore_list', 'L1', false), set_config('wpf.restore_rev', '1', false);
\set ON_ERROR_STOP 0
\echo -- expected next: ERROR  No copy of Rev 1 is kept for "House 1 (empty)" — copies kept: none ...
\i :f
\set ON_ERROR_STOP 1
select t_ok('5m a plain unlocked list: refused, unchanged', t_live('L1') = 0 and (select rev from lists where id = 'L1') = 1);

select t_ok('C2 read-only check after the guard: exactly one row, now ending "p_empty_ok boolean"',
  (select count(*) = 1 and min(pg_get_function_identity_arguments(oid)) = 'p_list jsonb, p_lines jsonb, p_expect integer, p_by text, p_reason text, p_empty_ok boolean' from pg_proc where proname = 'save_list_revision'));

-- ---------- 6. the UNDO box, run TWICE: back to the 2 Nov function exactly ----------
\set f :dir '/undo.sql'
\i :f
\i :f
select t_ok('6a after Undo (run twice): exactly ONE save_list_revision, read-only check shows the 5-setting one',
  (select count(*) = 1 and min(pg_get_function_identity_arguments(oid)) = 'p_list jsonb, p_lines jsonb, p_expect integer, p_by text, p_reason text' from pg_proc where proname = 'save_list_revision'));
select t_ok('6b it is the 2 Nov function byte for byte (same body, names and types as the Stage 3 block made)',
  (select p.prosrc = t.prosrc and p.proargnames = t.proargnames and p.proargtypes::text = t.proargtypes::text from pg_proc p, t_src t where p.proname = 'save_list_revision'));
select t_ok('6c anon, authenticated and service_role may call it again',
  has_function_privilege('anon', 'save_list_revision(jsonb,jsonb,int,text,text)', 'execute')
  and has_function_privilege('authenticated', 'save_list_revision(jsonb,jsonb,int,text,text)', 'execute')
  and has_function_privilege('service_role', 'save_list_revision(jsonb,jsonb,int,text,text)', 'execute'));
select save_list_revision('{"id":"L5","name":"After undo","project_id":"P1","wos":[]}',
  '[{"id":"L5:1","seq":1,"kind":"saw","part":"Side","qty":"2","length_mm":720,"width_mm":560,"material":"MFC White"}]', null, 'Op', null);
select save_list_revision(p_list := '{"id":"L5"}', p_lines := '[]', p_expect := t_ver('L5'), p_by := 'Op', p_reason := 'old behaviour');
select t_ok('6d after Undo the old behaviour is back: an empty save is not refused (5 settings by name, as the app sends)', t_live('L5') = 0);
-- and the guard can be put on again after an Undo
\set f :dir '/guard.sql'
\i :f
select save_list_revision('{"id":"L5"}', '[{"id":"L5:1","seq":1,"kind":"saw","part":"Side","qty":"2","length_mm":720,"width_mm":560,"material":"MFC White"}]', t_ver('L5'), 'Op', 'back');
do $$ declare m text; begin
  begin perform save_list_revision('{"id":"L5"}', '[]', t_ver('L5'), 'Op', null); raise exception 'FAIL 6e';
  exception when others then get stacked diagnostics m = message_text; if m like 'FAIL%' then raise; end if; end;
  perform t_ok('6e guard run again after the Undo: refuses again, one function', m like 'empty save refused:%' and (select count(*) = 1 from pg_proc where proname = 'save_list_revision'), m);
end $$;

\echo ALL LIST GUARD CHECKS PASSED
