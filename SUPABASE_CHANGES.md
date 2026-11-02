# Supabase changes

Newest at the top. Each block must be run in Supabase BEFORE the matching code goes live on GitHub Pages.

---

## 2026-11-02 — Stage 3 cutting lists + snags — PENDING, NOT YET RUN — Garry runs this BEFORE merging `feature/cutting-lists`

**What it does (plain English):**
- Creates new tables so every cutting / fittings list, and every line on it, is its own record with a permanent ID: `projects`, `project_materials`, `lists`, `list_lines`, `list_revisions` (old copies of a list each time it's revised) and `list_events` (who ticked / parked / released what, and when).
- Creates the `snags` table (one row per snag a PM raises) and lets the Production Manager turn ticked snags into a cutting list in one step.
- Adds five database "functions" the app calls. They hold the rules, so two screens can't undo each other's work:
  - `apply_line_changes` — ticks, N/A (waiting) and releases. Done always wins over N/A; an untick from an out-of-date screen is refused; a tick on a line that a newer revision changed is refused; the same tick sent twice (a reply lost in bad signal) only counts once. The first tick locks the list.
  - `list_attach` — adds or removes one work order on a list in one step (two people attaching at once can't wipe each other's tag).
  - `list_set_done` — the saw / stores sign-off, "send back", and the no-cutting / no-fittings flags. The database writes the list's history, never the browser.
  - `save_list_revision` — saves an edited list. Refuses with "stale" if someone changed the list since the editor opened it; keeps a copy of the old version when the list is locked; never touches a line's tick unless that line really changed; removed lines are marked, never deleted.
  - `snags_to_list` — makes one snag list per project; refuses any snag already transferred, so two people can't transfer the same snag twice.
- A trigger moves a snag to "cut" when its line is cut or got out.
- A trigger on the planner record keeps the lists switch: a planner tab left open on old code can't switch the floor back to the old lists by saving.
- Nothing is deleted. The app gets NO delete permission on any new table. The existing planner record is untouched.
- **The app does not use any of this until Garry presses "Migrate lists" (Admin PIN, Settings).** Until then it runs exactly as today, and makes no calls to these tables. So running this early is harmless.

**If you deploy the code without running this first:** nothing changes on the floor (the switch is off). But "Migrate lists" would fail — so run this first anyway.

### Steps for Garry
1. Go to https://supabase.com/dashboard and open the WPF project (`klyropbsupqfmtjjwlfa`).
2. In the left menu click **SQL Editor**, then **New query**.
3. Copy everything in the grey box below, paste it into the editor and click **Run**.
4. Expected result: **"Success. No rows returned"**. If you see a red error, stop and send a screenshot — do not merge.
5. Check: **Table Editor** shows the new tables `projects`, `project_materials`, `lists`, `list_lines`, `list_revisions`, `list_events`, `snags` (all empty).
6. Check: **Database → Functions** shows `apply_line_changes`, `list_attach`, `list_set_done`, `save_list_revision`, `snags_to_list`.
7. If the line `alter publication supabase_realtime ...` gives an error saying the table is already in the publication, that's fine — delete that one line and Run again.

```sql
-- ===================== PLAN A — lists data foundation =====================
create or replace function lists_touch() returns trigger language plpgsql as $$
begin new.updated_at:=now(); new.version:=old.version+1; return new; end $$;

create table if not exists projects(id text primary key, name text not null, customer text,
  list_owner text, active boolean not null default true, version int not null default 1,
  updated_at timestamptz not null default now(), updated_by text);
create unique index if not exists projects_name_uq on projects(lower(name));

create table if not exists project_materials(id text primary key, project_id text not null references projects(id),
  name text not null, kind text not null check(kind in('sheet','other')), aliases text[] not null default '{}',
  active boolean not null default true, sort int not null default 0, version int not null default 1,
  updated_at timestamptz not null default now(), updated_by text);
create unique index if not exists pm_uq on project_materials(project_id, lower(name));
create index if not exists pm_upd on project_materials(updated_at);
create index if not exists projects_upd on projects(updated_at);

create table if not exists lists(id text primary key, project_id text references projects(id), name text not null,
  list_type text not null default 'house' check(list_type in('kitchen','house','room','other')), type_name text,
  is_template boolean not null default false, template_id text references lists(id), template_rev int,
  rev int not null default 1, locked boolean not null default false, sent_at timestamptz,
  wos text[] not null default '{}', no_cut boolean not null default false, no_fit boolean not null default false,
  saw_done_at timestamptz, saw_done_by text, fit_done_at timestamptz, fit_done_by text,
  source text not null default 'manual' check(source in('excel','manual','template','migrated')),
  sdate date, archived boolean not null default false, log jsonb not null default '[]',
  n_saw int not null default 0, n_fit int not null default 0,          -- build note d: line counts (finished lists' lines aren't loaded at start-up)
  version int not null default 1, created_at timestamptz not null default now(), created_by text,
  updated_at timestamptz not null default now(), updated_by text);
alter table lists add column if not exists n_saw int not null default 0;
alter table lists add column if not exists n_fit int not null default 0;
create index if not exists lists_upd on lists(updated_at);
create index if not exists lists_wos on lists using gin(wos);

create table if not exists list_lines(id text primary key, list_id text not null references lists(id), seq int not null,
  kind text not null check(kind in('saw','fit','hdr')), section text, part text,
  length_mm numeric, width_mm numeric, qty text, material text, material_other boolean not null default false,
  edging text, note text,
  status text not null default 'todo' check(status in('todo','cut','got-out','waiting','na')),
  status_by text, status_at timestamptz, released_at timestamptz, released_by text,
  added_rev int, changed_rev int, removed_rev int, src_line_id text,
  version int not null default 1, updated_at timestamptz not null default now());
create index if not exists ll_list on list_lines(list_id);
create index if not exists ll_upd on list_lines(updated_at);

create table if not exists list_revisions(id bigserial primary key, list_id text not null references lists(id),
  rev int not null, lines jsonb not null, meta jsonb, reason text, made_by text, made_at timestamptz default now(),
  unique(list_id,rev));
create table if not exists list_events(id bigserial primary key, list_id text, line_id text, act text not null,
  from_status text, to_status text, n int default 1, by text, at timestamptz default now(), client_at timestamptz, note text,
  cid text);                                                            -- the device's id for one tap: a resend is recognised, never applied twice
alter table list_events add column if not exists cid text;
create unique index if not exists le_cid on list_events(cid) where cid is not null;
create index if not exists le_list on list_events(list_id);

do $$ declare t text; begin foreach t in array array['projects','project_materials','lists','list_lines'] loop
  execute format('drop trigger if exists %1$s_touch on %1$s; create trigger %1$s_touch before update on %1$s for each row execute function lists_touch();',t);
end loop; end $$;

-- Grants (30 Oct rule). No DELETE for anyone using the app: we never delete production data.
grant select, insert, update on projects, project_materials, lists, list_lines to anon, authenticated;
grant select, insert on list_revisions, list_events to anon, authenticated;
grant usage, select on sequence list_revisions_id_seq, list_events_id_seq to anon, authenticated;
grant all on projects, project_materials, lists, list_lines, list_revisions, list_events to service_role;
grant usage, select on sequence list_revisions_id_seq, list_events_id_seq to service_role;

do $$ declare t text; begin foreach t in array array['projects','project_materials','lists','list_lines','list_revisions','list_events'] loop
  execute format('alter table %1$s enable row level security;
    drop policy if exists "%1$s read" on %1$s; create policy "%1$s read" on %1$s for select to anon, authenticated using (true);
    drop policy if exists "%1$s add" on %1$s; create policy "%1$s add" on %1$s for insert to anon, authenticated with check (true);',t);
end loop;
foreach t in array array['projects','project_materials','lists','list_lines'] loop
  execute format('drop policy if exists "%1$s edit" on %1$s; create policy "%1$s edit" on %1$s for update to anon, authenticated using (true) with check (true);',t);
end loop; end $$;

alter publication supabase_realtime add table lists, list_lines; -- ready for later; the app polls for now

-- One status change per line, with the "done wins" rules applied by the database.
-- Each change: {id, status | act:'release', v (line version the screen saw — needed to untick), rev (list rev the screen
-- showed), cid (device id for this tap), from, at}. Reply per change: {id, cid, ok, why, status, v, by, at, rel, relby, dup}.
-- why: missing | removed | changed (a newer revision changed the line) | not-needed | wrong-kind | done (already cut/got out)
--      | stale (someone changed the line since this screen saw it) | not-waiting | bad
create or replace function apply_line_changes(p_changes jsonb, p_by text) returns jsonb language plpgsql as $$
declare c jsonb; l list_lines%rowtype; w text; a text; ok boolean; noop boolean; why text; res jsonb:='[]';
begin
 for c in select * from jsonb_array_elements(p_changes) loop
  -- lock the line FIRST: a resend racing the original waits here until the original has committed its event,
  -- then sees it below as "already applied" (instead of failing on the unique cid)
  select * into l from list_lines where id=c->>'id' for update;
  if not found then res:=res||jsonb_build_object('id',c->>'id','cid',c->>'cid','ok',false,'why','missing'); continue; end if;
  -- the same tap sent again (the first reply was lost): report the line as it is now, change nothing
  if c->>'cid' is not null and exists(select 1 from list_events e where e.cid=c->>'cid') then
   res:=res||jsonb_build_object('id',c->>'id','cid',c->>'cid','ok',true,'dup',true,'status',l.status,'v',l.version,'by',l.status_by,'at',l.status_at,'rel',l.released_at,'relby',l.released_by);
   continue;
  end if;
  a:=coalesce(c->>'act','status'); w:=c->>'status'; noop:=false; why:=null; ok:=false;
  if l.removed_rev is not null then why:='removed';
  elsif a='release' then
   if l.status='waiting' then ok:=true;
   elsif l.status in('cut','got-out') then ok:=true; noop:=true;      -- already done: releasing only clears the wait
   else why:='not-waiting'; end if;
  elsif w in('cut','got-out') then
   if l.kind<>(case w when 'cut' then 'saw' else 'fit' end) then why:='wrong-kind';
   elsif l.status='na' then why:='not-needed';
   elsif coalesce(l.changed_rev,0)>coalesce((c->>'rev')::int,0) then why:='changed';   -- build note f
   elsif l.status=w then ok:=true; noop:=true;                         -- done wins: already done, keep who did it first
   else ok:=true; end if;
  elsif w='waiting' then
   if l.status='todo' then ok:=true;
   elsif l.status='waiting' then ok:=true; noop:=true;
   elsif l.status in('cut','got-out') then why:='done';               -- got-out wins over N/A
   else why:='not-needed'; end if;
  elsif w='todo' then                                                  -- untick / un-park: only if nobody touched the line since
   if l.version=(c->>'v')::int then ok:=true; noop:=(l.status='todo'); else why:='stale'; end if;
  elsif w='na' then
   if l.status in('todo','waiting') then ok:=true; else why:='done'; end if;
  else why:='bad'; end if;
  if ok and not noop then
   if a='release' then update list_lines set status='todo',released_at=now(),released_by=p_by where id=l.id returning * into l;
   else update list_lines set status=w,status_by=p_by,status_at=now(),
        released_at=case when w='todo' then null else released_at end where id=l.id returning * into l; end if;
   update lists set locked=true, updated_by=p_by where id=l.list_id and not locked;  -- build note f: first accepted change locks the list
  end if;
  if ok then
   insert into list_events(list_id,line_id,act,from_status,to_status,by,client_at,cid)
     values(l.list_id,l.id,a,c->>'from',l.status,p_by,(c->>'at')::timestamptz,c->>'cid');
  end if;
  res:=res||jsonb_build_object('id',l.id,'cid',c->>'cid','ok',ok,'why',why,'status',l.status,'v',l.version,'by',l.status_by,'at',l.status_at,'rel',l.released_at,'relby',l.released_by);
 end loop; return res; end $$;
grant execute on function apply_line_changes(jsonb,text) to anon, authenticated, service_role;

-- Add or remove ONE work order on a list in one step (race-safe), with a history line and an event.
-- p_cid: the device's id for this tap — the same tap sent again (reply lost) changes nothing and adds no history.
create or replace function list_attach(p_list text, p_wo text, p_on boolean, p_by text, p_cid text default null) returns jsonb language plpgsql as $$
declare r lists%rowtype; had boolean;
begin
 select * into r from lists where id=p_list for update;
 if not found then raise exception 'missing list %', p_list; end if;
 if p_cid is not null and exists(select 1 from list_events e where e.cid=p_cid) then return to_jsonb(r); end if;
 had:= p_wo = any(r.wos);
 if p_on and not had then
  update lists set wos=array_append(wos,p_wo), updated_by=p_by,
    log=log||jsonb_build_array(jsonb_build_object('at',now(),'by',p_by,'what','Work order '||p_wo||' attached')) where id=p_list returning * into r;
 elsif not p_on and had then
  update lists set wos=array_remove(wos,p_wo), updated_by=p_by,
    log=log||jsonb_build_array(jsonb_build_object('at',now(),'by',p_by,'what','Work order '||p_wo||' taken off')) where id=p_list returning * into r;
 end if;
 if p_on<>had then insert into list_events(list_id,act,by,note,cid) values(p_list,case when p_on then 'attach' else 'detach' end,p_by,p_wo,p_cid); end if;
 return to_jsonb(r);
end $$;
grant execute on function list_attach(text,text,boolean,text,text) to anon, authenticated, service_role;

-- Sign-offs and flags (build note g). p_mode: 'saw' | 'fit' (sign-off; off = send back / undo) | 'no_cut' | 'no_fit'
-- | 'send' (Send to saw: locks the list) | 'archive' (Delete on the Lists tab — the list is hidden, never deleted). The database writes the history line, never the browser.
-- p_cid: the device's id for this tap — the same tap sent again (reply lost) changes nothing and adds no history.
create or replace function list_set_done(p_list text, p_mode text, p_on boolean, p_by text, p_why text default null, p_cid text default null) returns jsonb language plpgsql as $$
declare r lists%rowtype; what text;
begin
 select * into r from lists where id=p_list for update;
 if not found then raise exception 'missing list %', p_list; end if;
 if p_cid is not null and exists(select 1 from list_events e where e.cid=p_cid) then return to_jsonb(r); end if;
 if p_mode='saw' then
  what:=case when p_on then 'Cut complete' else 'Sent back for re-cutting'||coalesce(' (was done '||to_char(r.saw_done_at,'DD/MM/YYYY')||coalesce(' by '||r.saw_done_by,'')||')','') end;
  update lists set saw_done_at=case when p_on then now() end, saw_done_by=case when p_on then p_by end, updated_by=p_by,
    log=log||jsonb_build_array(jsonb_build_object('at',now(),'by',p_by,'what',what,'why',p_why)) where id=p_list returning * into r;
 elsif p_mode='fit' then
  what:=case when p_on then 'Fittings picked' else 'Sent back for re-picking'||coalesce(' (was done '||to_char(r.fit_done_at,'DD/MM/YYYY')||coalesce(' by '||r.fit_done_by,'')||')','') end;
  update lists set fit_done_at=case when p_on then now() end, fit_done_by=case when p_on then p_by end, updated_by=p_by,
    log=log||jsonb_build_array(jsonb_build_object('at',now(),'by',p_by,'what',what,'why',p_why)) where id=p_list returning * into r;
 elsif p_mode='no_cut' then
  update lists set no_cut=p_on, updated_by=p_by,
    log=log||jsonb_build_array(jsonb_build_object('at',now(),'by',p_by,'what','No cutting'||case when p_on then ' ticked' else ' unticked' end,'why',p_why)) where id=p_list returning * into r;
 elsif p_mode='no_fit' then
  update lists set no_fit=p_on, updated_by=p_by,
    log=log||jsonb_build_array(jsonb_build_object('at',now(),'by',p_by,'what','No fittings'||case when p_on then ' ticked' else ' unticked' end,'why',p_why)) where id=p_list returning * into r;
 elsif p_mode='send' then -- 'Send to saw': the list locks; later edits are revisions
  update lists set sent_at=coalesce(sent_at,now()), locked=true, updated_by=p_by,
    log=log||jsonb_build_array(jsonb_build_object('at',now(),'by',p_by,'what','Sent to the saw','why',p_why)) where id=p_list returning * into r;
 elsif p_mode='archive' then
  update lists set archived=p_on, updated_by=p_by,
    log=log||jsonb_build_array(jsonb_build_object('at',now(),'by',p_by,'what',case when p_on then 'Archived' else 'Brought back from the archive' end,'why',p_why)) where id=p_list returning * into r;
 else raise exception 'bad mode %', p_mode; end if;
 insert into list_events(list_id,act,by,note,cid) values(p_list,p_mode||case when p_on then '-on' else '-off' end,p_by,p_why,p_cid);
 return to_jsonb(r);
end $$;
grant execute on function list_set_done(text,text,boolean,text,text,text) to anon, authenticated, service_role;

-- Save an edit or a new revision in one go.
-- p_list: the list's fields ({id, name, project_id, ...}; missing keys are left as they are).
-- p_lines: every line the list should now have ({id, seq, kind, section, part, length_mm, width_mm, qty, material,
--          material_other, edging, note, snag_id, src_line_id, reset}); reset:true = content changed, so the tick resets.
-- p_expect: the list version the editor started from (null = a brand-new list).
create or replace function save_list_revision(p_list jsonb, p_lines jsonb, p_expect int, p_by text, p_reason text) returns jsonb language plpgsql as $$
declare r lists%rowtype; e jsonb; nrev int; ids text[]:='{}'; ex list_lines%rowtype; isnew boolean:=false;
begin
 select * into r from lists where id=p_list->>'id' for update;
 if not found then
  if p_expect is not null then raise exception 'stale: list % is missing', p_list->>'id'; end if;
  insert into lists(id,project_id,name,list_type,type_name,is_template,template_id,template_rev,wos,no_cut,no_fit,source,sdate,created_by,updated_by,log)
   values(p_list->>'id',p_list->>'project_id',coalesce(p_list->>'name','(no name)'),coalesce(p_list->>'list_type','house'),p_list->>'type_name',
     coalesce((p_list->>'is_template')::boolean,false),p_list->>'template_id',(p_list->>'template_rev')::int,
     coalesce(array(select jsonb_array_elements_text(p_list->'wos')),'{}'),coalesce((p_list->>'no_cut')::boolean,false),coalesce((p_list->>'no_fit')::boolean,false),
     coalesce(p_list->>'source','manual'),(p_list->>'sdate')::date,p_by,p_by,
     jsonb_build_array(jsonb_build_object('at',now(),'by',p_by,'what','List created','why',p_reason)))
   returning * into r;
  isnew:=true; nrev:=1;
 else
  -- 1. someone changed the list since this editor opened it: stop — the app reloads and compares again
  if p_expect is null or r.version<>p_expect then raise exception 'stale: list % is at version %, editor had %', r.id, r.version, p_expect; end if;
  nrev:=r.rev;
  -- 2. a locked list or a template keeps a copy of what it was, and goes up one revision. p_list.lock = the app's date rule
  --    (cut-by today or the next working day) — the list counts as locked from this save on.
  if r.locked or r.is_template or coalesce((p_list->>'lock')::boolean,false) then
   insert into list_revisions(list_id,rev,lines,meta,reason,made_by)
    values(r.id,r.rev,coalesce((select jsonb_agg(to_jsonb(x) order by x.seq) from list_lines x where x.list_id=r.id and x.removed_rev is null),'[]'),to_jsonb(r),p_reason,p_by);
   nrev:=r.rev+1;
  end if;
 end if;
 for e in select * from jsonb_array_elements(p_lines) loop
  ids:=ids||(e->>'id');
  select * into ex from list_lines where id=e->>'id' and list_id=r.id for update;
  if found then
   -- 4. content only; status is NEVER written here unless the line really changed (reset) — a tick landing mid-edit survives
   update list_lines set seq=coalesce((e->>'seq')::int,seq), kind=coalesce(e->>'kind',kind), section=e->>'section', part=e->>'part',
     length_mm=(e->>'length_mm')::numeric, width_mm=(e->>'width_mm')::numeric, qty=e->>'qty', material=e->>'material',
     material_other=coalesce((e->>'material_other')::boolean,false), edging=e->>'edging', note=e->>'note',
     snag_id=coalesce(e->>'snag_id',snag_id), removed_rev=null,
     status=case when (e->>'reset')::boolean then 'todo' else status end,
     status_by=case when (e->>'reset')::boolean then null else status_by end,
     status_at=case when (e->>'reset')::boolean then null else status_at end,
     released_at=case when (e->>'reset')::boolean then null else released_at end,
     changed_rev=case when (e->>'reset')::boolean then nrev else changed_rev end
    where id=ex.id;
  else
   -- 3. new lines
   insert into list_lines(id,list_id,seq,kind,section,part,length_mm,width_mm,qty,material,material_other,edging,note,snag_id,src_line_id,added_rev)
    values(e->>'id',r.id,coalesce((e->>'seq')::int,0),e->>'kind',e->>'section',e->>'part',(e->>'length_mm')::numeric,(e->>'width_mm')::numeric,
     e->>'qty',e->>'material',coalesce((e->>'material_other')::boolean,false),e->>'edging',e->>'note',e->>'snag_id',e->>'src_line_id',nrev);
  end if;
 end loop;
 -- 5. lines that have gone are marked removed, never deleted
 update list_lines set removed_rev=nrev where list_id=r.id and removed_rev is null and not (id = any(ids));
 update lists set rev=nrev, updated_by=p_by,
   locked=case when is_template then locked else locked or coalesce((p_list->>'lock')::boolean,false) end,
   name=coalesce(p_list->>'name',name), project_id=case when p_list ? 'project_id' then p_list->>'project_id' else project_id end,
   list_type=coalesce(p_list->>'list_type',list_type), source=coalesce(p_list->>'source',source), type_name=case when p_list ? 'type_name' then p_list->>'type_name' else type_name end,
   no_cut=coalesce((p_list->>'no_cut')::boolean,no_cut), no_fit=coalesce((p_list->>'no_fit')::boolean,no_fit),
   sdate=case when p_list ? 'sdate' then (p_list->>'sdate')::date else sdate end,
   deliver_by=case when p_list ? 'deliver_by' then (p_list->>'deliver_by')::date else deliver_by end,
   n_saw=(select count(*) from list_lines x where x.list_id=r.id and x.removed_rev is null and x.kind='saw'),
   n_fit=(select count(*) from list_lines x where x.list_id=r.id and x.removed_rev is null and x.kind='fit'),
   log=case when isnew then log else log||jsonb_build_array(jsonb_build_object('at',now(),'by',p_by,
     'what',case when nrev>r.rev then 'Revision '||nrev else 'List edited' end,'why',p_reason)) end
  where id=r.id returning * into r;
 return jsonb_build_object('list',to_jsonb(r),'lines',(select coalesce(jsonb_agg(to_jsonb(x) order by x.seq),'[]') from list_lines x where x.list_id=r.id));
end $$;
grant execute on function save_list_revision(jsonb,jsonb,int,text,text) to anon, authenticated, service_role;

-- The lists switch lives in the planner record's settings (listStore / listStoreAt). A tab still running OLD code saves
-- its whole settings object without those keys, which would quietly switch every screen back to the old lists. This
-- trigger keeps the switch whenever a save leaves it out; only a save that names it (Switch back writes 'v1') changes it.
create or replace function production_planner_keep_switch() returns trigger language plpgsql as $$
begin
 if old.settings is not null and old.settings ? 'listStore' and (new.settings is null or not (new.settings ? 'listStore')) then
  new.settings := coalesce(new.settings,'{}'::jsonb) || jsonb_build_object('listStore',old.settings->'listStore')
    || case when old.settings ? 'listStoreAt' then jsonb_build_object('listStoreAt',old.settings->'listStoreAt') else '{}'::jsonb end;
 end if;
 return new;
end $$;
drop trigger if exists production_planner_keep_switch on production_planner;
create trigger production_planner_keep_switch before update on production_planner for each row execute function production_planner_keep_switch();

-- ===================== PROJECTS HUB (snags part) — runs AFTER Plan A =====================
alter table projects add column if not exists project_type text not null default 'kitchens'
  check(project_type in('kitchens','robes','schools','other'));
alter table projects add column if not exists pm text;
alter table projects add column if not exists cien_names text[] not null default '{}';
alter table projects add column if not exists order_nos text[] not null default '{}';
alter table projects add column if not exists setup_done boolean not null default false;
alter table lists add column if not exists deliver_by date;
alter table lists drop constraint if exists lists_list_type_check;
alter table lists add constraint lists_list_type_check check(list_type in('kitchen','house','room','other','snag'));
alter table list_lines add column if not exists snag_id text;

-- location_id has no link to a locations table yet: locations come with Hub step H1 (decision 6: free-text "where" for now)
create table if not exists snags(id text primary key, project_id text not null references projects(id),
  location_id text, where_text text,
  raised_by text not null, raised_at timestamptz not null default now(),
  kind text not null check(kind in('saw','fit')), item text not null,
  material_id text references project_materials(id), material_text text,
  qty numeric not null default 1, length_mm numeric, width_mm numeric, edging text, note text,
  status text not null default 'raised' check(status in('raised','on-list','cut','on-van','delivered',
    'placed','couldnt-place','closed','cancelled')),
  status_by text, status_at timestamptz, list_id text references lists(id), list_line_id text references list_lines(id),
  delivery_item_id text, photo_path text, handed_to text, couldnt_reason text, cien_wo text,
  version int not null default 1, updated_at timestamptz not null default now(), updated_by text);
create index if not exists snags_open on snags(project_id) where status not in('closed','cancelled');
create index if not exists snags_upd on snags(updated_at);
drop trigger if exists snags_touch on snags;
create trigger snags_touch before update on snags for each row execute function lists_touch();
alter table snags enable row level security;
drop policy if exists "snags read" on snags; create policy "snags read" on snags for select to anon, authenticated using (true);
drop policy if exists "snags add" on snags; create policy "snags add" on snags for insert to anon, authenticated with check (true);
drop policy if exists "snags edit" on snags; create policy "snags edit" on snags for update to anon, authenticated using (true) with check (true);
-- Grants (30 Oct rule). No DELETE: a snag is cancelled, never deleted.
grant select, insert, update on snags to anon, authenticated;
grant all on snags to service_role;

-- Ticked snags → one snag list per project (type 'snag', deliver_by set), one line per snag.
-- Refuses the WHOLE transfer if any snag isn't 'raised', so two people can't transfer the same snag twice.
create or replace function snags_to_list(p_ids text[], p_deliver_by date, p_by text) returns jsonb language plpgsql as $$
declare s record; pid text; lid text; seq int; out jsonb:='[]'; bad text; lnid text; pname text;
begin
 perform 1 from snags where id = any(p_ids) for update;
 select string_agg(id||' ('||status||')',', ') into bad from snags where id = any(p_ids) and status<>'raised';
 if bad is not null then raise exception 'not raised: %', bad; end if;
 if (select count(*) from snags where id = any(p_ids)) <> coalesce(array_length(p_ids,1),0) then raise exception 'missing snag'; end if;
 for pid in select distinct project_id from snags where id = any(p_ids) order by 1 loop
  select name into pname from projects where id=pid;
  lid:='LS'||replace(gen_random_uuid()::text,'-','');
  insert into lists(id,project_id,name,list_type,source,deliver_by,created_by,updated_by,log)
   values(lid,pid,'Snags '||coalesce(pname,pid)||' '||to_char(p_deliver_by,'DD Mon'),'snag','manual',p_deliver_by,p_by,p_by,
     jsonb_build_array(jsonb_build_object('at',now(),'by',p_by,'what','Snag list created from '||(select count(*) from snags where id = any(p_ids) and project_id=pid)||' snags')));
  seq:=0;
  for s in select x.*, m.name as mname from snags x left join project_materials m on m.id=x.material_id
           where x.id = any(p_ids) and x.project_id=pid order by x.raised_at, x.id loop
   seq:=seq+1; lnid:=lid||':'||seq;
   insert into list_lines(id,list_id,seq,kind,part,length_mm,width_mm,qty,material,material_other,edging,note,snag_id,added_rev)
    values(lnid,lid,seq,s.kind,s.item,s.length_mm,s.width_mm,s.qty::text,coalesce(s.mname,s.material_text),
      s.material_id is null and coalesce(s.material_text,'')<>'',s.edging,
      nullif(concat_ws(' — ',nullif(s.where_text,''),nullif(s.note,'')),''),s.id,1);
   update snags set status='on-list',status_by=p_by,status_at=now(),list_id=lid,list_line_id=lnid,updated_by=p_by where id=s.id;
  end loop;
  update lists set n_saw=(select count(*) from list_lines where list_id=lid and kind='saw'),
                   n_fit=(select count(*) from list_lines where list_id=lid and kind='fit') where id=lid;
  out:=out||to_jsonb(lid);
 end loop;
 return out;
end $$;
grant execute on function snags_to_list(text[],date,text) to anon, authenticated, service_role;

-- A snag's line cut (saw) or got out (stores) → the snag moves on-list → cut.
create or replace function snag_line_done() returns trigger language plpgsql as $$
begin
 if new.snag_id is not null and new.status in('cut','got-out') and old.status is distinct from new.status then
  update snags set status='cut', status_by=new.status_by, status_at=now() where id=new.snag_id and status='on-list';
 end if;
 return new;
end $$;
drop trigger if exists list_lines_snag on list_lines;
create trigger list_lines_snag after update of status on list_lines for each row execute function snag_line_done();
```

---

## 2026-10-20 — Stage 1 "Stop the data loss" — run BEFORE deploying

**What it does (plain English):**
- Adds a `version` number to the planner record, so two PCs saving at the same moment can no longer silently overwrite each other.
- Adds `updated_by` and `updated_at` so we can see who saved last and when.
- Adds a database trigger that bumps `version` on EVERY save — including saves from an old planner tab that was left open from before the update. That's what lets new tabs notice an old tab's save and merge it instead of overwriting it.
- Creates a separate `planner_backups` table for the daily safety copy (30 days kept), and gives the app permission to use it.
- Nothing is deleted. Existing data is untouched.

**If you deploy the code without running this first:** the app keeps working the old way (no clash protection, no backups table) and prints a warning in the browser console. So the wrong order can't break the floor — but run this first anyway.

### Steps for Garry
1. Go to https://supabase.com/dashboard and open the WPF project (`klyropbsupqfmtjjwlfa`).
2. In the left menu click **SQL Editor**.
3. Click **New query** (top left).
4. Copy everything in the grey box below and paste it into the editor.
5. Click **Run** (bottom right, or Ctrl+Enter).
6. Expected result: **"Success. No rows returned"**. If you see a red error, stop and send a screenshot — do not deploy.
7. Check: left menu **Database → Triggers** → you should see `production_planner_bump` on `production_planner`.
8. Check: left menu **Table Editor** → you should now see a table called `planner_backups` (empty), and `production_planner` should have three new columns: `version` (all rows = 1), `updated_by` (blank) and `updated_at` (blank).

```sql
-- 1. Clash protection on the main planner record
alter table production_planner add column if not exists version bigint not null default 1;
alter table production_planner add column if not exists updated_by text;
alter table production_planner add column if not exists updated_at timestamptz;

-- Every save (new app, old app, or a manual edit) gets the next version number and a timestamp.
-- The new app also asks for version+1 itself, so this never double-bumps.
create or replace function production_planner_bump() returns trigger language plpgsql as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists production_planner_bump on production_planner;
create trigger production_planner_bump before update on production_planner
  for each row execute function production_planner_bump();

-- 2. Daily backups table
create table if not exists planner_backups(id bigserial primary key, taken_at timestamptz default now(),
  reason text, orders_count int, payload jsonb not null);

-- 3. Data API access (from 30 Oct 2026 Supabase no longer grants this automatically on new tables).
--    The app currently uses the anon (publishable) key for everything.
--    Stage 4 will tighten these anon grants.
grant select, insert, delete on public.planner_backups to anon;
grant usage, select on sequence public.planner_backups_id_seq to anon;
grant select, insert, update, delete on public.planner_backups to authenticated, service_role;
grant usage, select on sequence public.planner_backups_id_seq to authenticated, service_role;

-- 4. Row Level Security: on, with the same open-to-the-app access the planner record has today.
--    (No UPDATE policy for anon: backups are written once, never edited.)
--    Stage 4 replaces these with locked-down policies.
alter table planner_backups enable row level security;
drop policy if exists "planner_backups anon read"   on planner_backups;
drop policy if exists "planner_backups anon insert" on planner_backups;
drop policy if exists "planner_backups anon delete" on planner_backups;
create policy "planner_backups anon read"   on planner_backups for select to anon, authenticated using (true);
create policy "planner_backups anon insert" on planner_backups for insert to anon, authenticated with check (true);
create policy "planner_backups anon delete" on planner_backups for delete to anon, authenticated using (true);
```

### Go-live day (important)
Planner tabs opened BEFORE the update keep running the old code until they're reloaded. Old tabs still save the old way (whole plan, no clash check). The trigger means new tabs will notice and merge those saves, but an old tab can still overwrite a new tab's work. So on deploy day:
1. Run the SQL above.
2. Deploy.
3. **Close and reopen every planner tab and phone** (office PCs, saw, stores, drivers, PMs, floor screen). After that, everything is on the new code.

Note: Stage 4 tightens the anon grants and policies above (the app will stop having open delete access).
