# Supabase changes

Newest at the top. Each block must be run in Supabase BEFORE the matching code goes live on GitHub Pages.

---

## 2026-11-10 — PM sequence & pre-production (Job B part 2) — PENDING, NOT YET RUN — Garry runs this AFTER the Stage 3 and Project details blocks and BEFORE merging `feature/project-details-v2`

**What it does (plain English):**
- Adds **one or more Project Managers** (a project can have two or three — Garry, 10 Nov) and the optional **date rules**
  (robes = kitchen + 5 working days, …) to each project. Adding or removing a project's PMs is written to the history by
  the database. (The old single `pm` column from Stage 3 is kept and no longer used — nothing is dropped.)
- New table `project_seq`: each project's **sequence** — one row per work order (or future work order "waiting for a WO
  number" from the Cienapps upload file) in the order the site needs them. The DATABASE keeps the rules: loading the same
  file again adds nothing (two identical lines in one house — e.g. two wardrobes — are kept as two rows, Garry 10 Nov, and a
  re-load still adds nothing), a WO number can only be on one row, the order only changes through one controlled step that
  logs who moved what from where to where, and rows are never deleted (only marked removed).
- New table `seq_requests`: **change requests** for jobs in the fixed two-week window. A request needs a reason; it can be
  decided only once (two Production Managers can't both approve); a refusal needs a reason; nothing in it can be rewritten.
- New table `seq_pre`: **Johnny's pre-production pool** — his own order and his "Processed" tick (who / when, stamped by the
  database). Reading his spreadsheet later can tick, but never un-tick what he ticked by hand.
- **(Job B part 3, added 10 Nov) The matching key:** the database works out, for every sequence row, which house it is for
  (`house_key` = floor + unit, typed any way: "T09" = "t9 " = "Block T09", "Apt 07" = "No. 7" = "7", "GF" = "Ground" = "0") with
  exactly the same rule as the planner (`seq_key_txt`, `seq_key_code`, `seq_floor_key`, `seq_unit_key`, `seq_house_key`;
  `seq_line_key` now uses them). Loading the Cienapps file after "Start the sequence" no longer adds a second row for a house
  that already has its work order (the file's kitchen line is matched to that house's kitchen row). A floor that could be a
  level OR a block ("G", "L1") is never treated as the same as the level by the database — a person decides.
- Every add / match / move / date / request / tick is written to `project_events` (the history table from the Project details
  block) by the database. The app can read it, never write it.
- Writes only while the lists are switched on (same rule as snags, materials and the spec sheet). No DELETE for the app.
  Every new table has its own GRANT lines (30 Oct rule). The planner record and existing tables are untouched.

**If you deploy the code without running this first:** the Sequence tab, PM assignment, change requests and the
Pre-production view simply don't appear (the screens check once per page load). Everything else works as before.

**Tested:** run twice on a throwaway Postgres set up like Supabase (after the Stage 1, Stage 3, Stores dockets and Project
details blocks, each twice); `tests/seq/pg-check.sql` checks every rule above — ALL SEQ PG CHECKS PASSED (10 Nov). Re-checked
after the matching key was added (10 Nov, later): the block run twice on two fresh throwaway databases, ALL SEQ PG CHECKS PASSED
both times (60 key pairs + 8 line keys from `tests/seq/b0-pairs.json`, the claim rule); also run over the earlier version of
this block with a row in it — the row's keys were put right, nothing written to the history.

### Steps for Garry
1. Supabase → WPF project → **SQL Editor** → **New query**. Copy everything in the grey box below, paste, **Run**.
2. Expected result: **"Success. No rows returned"**. A red error: stop and send a screenshot — do not merge.
3. Check: **Table Editor** shows `project_seq`, `seq_requests` and `seq_pre` (all empty).
4. Safe to run twice (nothing is duplicated, no data touched).

```sql
-- ===================== PM SEQUENCE & PRE-PRODUCTION — project_seq, seq_requests, seq_pre =====================
-- Runs AFTER the Stage 3 block and the Project details block (needs projects, lists_touch, lists_writable, project_events).
-- Safe to run twice. Nothing is deleted: the app gets NO delete permission on any of these tables.

-- Projects: the Project Managers (one or more names; empty = Unassigned) and the per-project date rules.
-- (The single `pm` column made by Stage 3 is kept, unused by the new screens — never dropped.)
alter table projects add column if not exists pm text;
alter table projects add column if not exists pms text[] not null default '{}'::text[];
alter table projects add column if not exists seq_rules jsonb not null default '{}'::jsonb;

-- Adding / removing a project's PMs is written to the history by the database.
create or replace function projects_pm_log() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.pms is distinct from old.pms then
    insert into project_events(project_id,entity,entity_id,act,old,new,by)
    values(new.id,'project',new.id,'pm',jsonb_build_object('pms',to_jsonb(old.pms)),jsonb_build_object('pms',to_jsonb(new.pms)),coalesce(new.updated_by,'?'));
  end if;
  if new.seq_rules is distinct from old.seq_rules then
    insert into project_events(project_id,entity,entity_id,act,old,new,by)
    values(new.id,'project',new.id,'rules',jsonb_build_object('seq_rules',old.seq_rules),jsonb_build_object('seq_rules',new.seq_rules),coalesce(new.updated_by,'?'));
  end if;
  return null;
end $$;
drop trigger if exists projects_pm_log on projects;
create trigger projects_pm_log after update on projects for each row execute function projects_pm_log();

-- Tidy a text the way Cienapps exports need it: full-width letters / no-break spaces normalised, spaces collapsed, trimmed.
create or replace function seq_txt(v text) returns text language sql immutable as $$
 select nullif(btrim(regexp_replace(normalize(coalesce(v,''),NFKC),'\s+',' ','g')),'')
$$;
-- The matching key (B0, Job B part 3) — the SAME rule as the planner's keyNorm / keyTxt / keyTxtD / keyCode / keyFloor /
-- keyUnit / keyHouseStr / keyLineStr (index.html, b0key block); tests/seq/b0-pairs.json is checked against both. Same project +
-- same floor + same unit = the same house: "T09" = "t9 " = "Block T09" = "T09 Block"; "Apt 07" = "No. 7" = "7" = "7 (Type B)";
-- "GF" = "Ground" = "0"; "-1" = "Basement" (never "1"). A floor that could be a level OR a block ("G", "L1") is kept apart from
-- the level, and a placeholder (TBC, N/A, a bare "Apt" or "Block") counts as blank — the database never treats them as the
-- same house; a person decides.
-- Text: superscript digits kept apart ("7²" ≠ 72), NFKC, zero-width characters out, accented letters → base letters from a
-- fixed list (no extension needed), ß → ss. Case and punctuation are kept here.
create or replace function seq_key_norm(s text) returns text language sql immutable as $$
 select replace(translate(regexp_replace(normalize(regexp_replace(coalesce(s,''),'[\u00B2\u00B3\u00B9\u2070-\u2079\u2080-\u2089]',' \&','g'),NFKC),
   '[\u00AD\u180E\u200B-\u200F\u2060\uFEFF]','','g'),
   'ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÝýÿŸ'||U&'\2010\2011\2012\2013\2014\2015\2212\FE58',
   'AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOOooooooUUUUuuuuYyyY--------'),'ß','ss')
$$;
-- (round 3) a floor / unit holding a superscript ("7²") or a letter outside the fixed accent list (Ł, Œ, İ …) can't be keyed
-- safely: it counts as blank, so the database never treats it as the same house as anything.
create or replace function seq_key_odd(s text) returns boolean language sql immutable as $$
 select coalesce(s,'') ~ '[\u00B2\u00B3\u00B9\u2070-\u2079\u2080-\u2089]' or seq_key_norm(s) ~ '[^\x01-\x7F]'
$$;
-- Every run of anything but A-Z / 0-9 → one space, trimmed, upper case.
create or replace function seq_key_txt(s text) returns text language sql immutable as $$
 select upper(btrim(regexp_replace(seq_key_norm(s),'[^A-Za-z0-9]+',' ','g')))
$$;
-- The same, but a dot BETWEEN two digits is kept (units such as "2.05").
create or replace function seq_key_txtd(s text) returns text language sql immutable as $$
 select upper(replace(btrim(regexp_replace(regexp_replace(replace(seq_key_norm(s),'#',' '),'([0-9])\.(?=[0-9])','\1#','g'),'[^A-Za-z0-9#]+',' ','g')),'#','.'))
$$;
-- A code of text that is already tidied: letter runs and digit runs (a dotted number is one run) joined with "-", leading
-- zeros off each number ("T 09" = "T09" = "T9" → T-9).
create or replace function seq_key_code2(x text) returns text language sql immutable as $$
 select coalesce(string_agg(case when y.m[1] ~ '^[0-9]' then regexp_replace(y.m[1],'^0+(?=[0-9])','') else y.m[1] end,'-' order by y.o),'')
 from regexp_matches(coalesce(x,''),'[A-Z]+|[0-9]+(?:\.[0-9]+)?','g') with ordinality as y(m,o)
$$;
create or replace function seq_key_code(t text) returns text language sql immutable as $$ select seq_key_code2(seq_key_txt(t)) $$;
-- A floor: a level is "#n" (GF / Ground / 0 / 00 → #0, 1st / First / Level 1 / 01 → #1, Basement / -1 / Level -1 → #-1); a
-- block or code is its code (Block T09 / T09 Block → T-9); "G" and "L1" / "F1" / "FL1" stay as their code (never equal to a
-- level). '' = blank (also TBC / N/A / a bare "Block").
create or replace function seq_floor_key(s text) returns text language plpgsql immutable as $$
declare x text; y text; m text[]; i int;
  nn text := '^(T ?B ?[CAD]( .*)?|TO BE (CONFIRMED|ADVISED|DECIDED)( .*)?|N ?A|NONE|NIL|UNKNOWN|NOT KNOWN|XX+)$';
begin
  if seq_key_odd(s) then return ''; end if;
  m := regexp_match(seq_key_norm(s),'^\s*(?:(?:LEVEL|FLOOR|LVL|FLR|STOREY)\s*)?-\s*([0-9]+)\s*$','i'); -- -1, —1, Level -1: below ground
  if m is not null then y := regexp_replace(m[1],'^0+(?=[0-9])',''); return '#'||case when y='0' then '0' else '-'||y end; end if;
  m := regexp_match(seq_key_norm(s),'^\s*(?:BLOCK|BLK)\s*-\s*([0-9]+)\s*$','i'); -- "Block -1" is not "Block 1"
  if m is not null then return '-'||regexp_replace(m[1],'^0+(?=[0-9])',''); end if;
  x := seq_key_txt(s);
  if x='' or x ~ nn or x ~ '^(BLOCK|BLK|FLOOR|FLR|LEVEL|LVL|STOREY)$' then return ''; end if;
  m := regexp_match(x,'^(BLOCK|BLK) (.+)$'); if m is null then m := regexp_match(x,'^(BLOCK|BLK)([0-9].*)$'); end if;
  if m is not null then return case when m[2] ~ nn then '' else seq_key_code(m[2]) end; end if;
  m := regexp_match(x,'^(.+) (BLOCK|BLK)$');
  if m is not null then return case when m[1] ~ nn then '' else seq_key_code(m[1]) end; end if;
  for i in 1..5 loop
    m := regexp_match(x,'^(FLOOR|FLR|LEVEL|LVL|STOREY) (.+)$'); if m is null then m := regexp_match(x,'^(FLOOR|FLR|LEVEL|LVL|STOREY)([0-9].*)$'); end if;
    if m is not null then y := m[2];
    else m := regexp_match(x,'^(.+) (FLOOR|FLR|LEVEL|LVL|STOREY)$'); y := case when m is null then x else m[1] end; end if;
    exit when y=x; x := y;
  end loop;
  if x ~ nn then return ''; end if;
  if x ~ '^(G ?F|GRD|GND|GRND|GROUND|0+)$' then return '#0'; end if;
  if x ~ '^[0-9]+$' then return '#'||regexp_replace(x,'^0+(?=[0-9])',''); end if;
  m := regexp_match(x,'^([0-9]+) ?(ST|ND|RD|TH)$'); if m is not null then return '#'||regexp_replace(m[1],'^0+(?=[0-9])',''); end if;
  y := case x when 'FIRST' then '1' when 'SECOND' then '2' when 'THIRD' then '3' when 'FOURTH' then '4' when 'FIFTH' then '5'
    when 'SIXTH' then '6' when 'SEVENTH' then '7' when 'EIGHTH' then '8' when 'NINTH' then '9' when 'TENTH' then '10' end;
  if y is not null then return '#'||y; end if;
  if x='BASEMENT' then return '#-1'; end if;
  return seq_key_code(x);
end $$;
-- A unit: a bracketed house type taken off ("7 (Type B)" → 7); APT / APARTMENT / UNIT / NO / NR / NUMBER / HOUSE / HSE / PLOT /
-- POS / POSITION in front taken off (also "APT07"); then 7 / 7A / 2.05 (leading zeros off, "7 a" = 7A), else its code
-- ("12-14" → 12-14). '' = blank (also TBC / N/A / a bare "Apt").
create or replace function seq_unit_key(s text) returns text language plpgsql immutable as $$
declare x text := seq_key_txtd(regexp_replace(seq_key_norm(s),'\(\s*TYPE[^)]*\)',' ','gi')); m text[]; i int;
begin
  if seq_key_odd(s) then return ''; end if;
  for i in 1..5 loop
    m := regexp_match(x,'^(APARTMENT|APT|UNIT|NUMBER|NO|NR|HOUSE|HSE|PLOT|POSITION|POS) (.+)$');
    if m is null then m := regexp_match(x,'^(APARTMENT|APT|UNIT|NUMBER|NO|NR|HOUSE|HSE|PLOT|POSITION|POS)([0-9].*)$'); end if;
    exit when m is null; x := m[2];
  end loop;
  if x='' or x ~ '^(T ?B ?[CAD]( .*)?|TO BE (CONFIRMED|ADVISED|DECIDED)( .*)?|N ?A|NONE|NIL|UNKNOWN|NOT KNOWN|XX+)$' or x ~ '^(APARTMENT|APT|UNIT|NUMBER|NO|NR|HOUSE|HSE|PLOT|POSITION|POS)$' then return ''; end if;
  m := regexp_match(x,'^([0-9]+)(\.[0-9]+)? ?([A-Z]{0,2})$');
  if m is not null then return regexp_replace(m[1],'^0+(?=[0-9])','')||coalesce(m[2],'')||coalesce(m[3],''); end if;
  return seq_key_code2(x);
end $$;
-- The house: floor|unit, null when either is blank (then nothing is ever treated as the same house automatically).
create or replace function seq_house_key(f text, u text) returns text language sql immutable as $$
 select case when seq_floor_key(f)='' or seq_unit_key(u)='' then null else seq_floor_key(f)||'|'||seq_unit_key(u) end
$$;
-- The "same work" key: floor|unit|product|name, the same normalising (Garry: never add the same work twice). Null when the
-- line has no product and no name.
create or replace function seq_line_key(f text, u text, p text, n text) returns text language sql immutable as $$
 select case when seq_key_txt(p)='' and seq_key_txt(n)='' then null
   else concat_ws('|',seq_floor_key(f),seq_unit_key(u),seq_key_txt(p),seq_key_txt(n)) end
$$;

-- One row per work order (or future work order, "waiting for WO number") in the PM's required order.
create table if not exists project_seq(id text primary key, project_id text not null references projects(id),
  pos int not null default 0,
  state text not null default 'waiting' check(state in('waiting','matched','removed')),
  wo text, floor text, unit text, product text, name text, descr text,
  kind text not null default 'kitchen' check(kind in('kitchen','utility','quartz','robes','other')),
  children jsonb not null default '[]'::jsonb, line_key text,
  req_date date, own_date boolean not null default false, is_new boolean not null default false,
  src text check(src in('upload','import','manual','start')), upload_id text, line_no int,
  matched_at timestamptz, matched_by text, match_how text check(match_how in('auto','confirmed','start','import')),
  why text, version int not null default 1, created_at timestamptz not null default now(), created_by text,
  updated_at timestamptz not null default now(), updated_by text);
create unique index if not exists ps_wo_uq on project_seq(upper(wo)) where wo is not null and state<>'removed';
-- (Garry 10 Nov) two identical lines in one house are two rows: no unique "same line" index — seq_insert counts instead
drop index if exists ps_line_uq;
create index if not exists ps_line_ix on project_seq(project_id, line_key) where line_key is not null and state<>'removed';
-- (Job B part 3) the house each row is for (floor|unit, worked out by the database — see seq_house_key)
alter table project_seq add column if not exists house_key text;
create index if not exists ps_house_ix on project_seq(project_id, house_key, kind) where house_key is not null and state<>'removed';
create index if not exists ps_proj_pos on project_seq(project_id, pos);
create index if not exists ps_upd on project_seq(updated_at);

-- The sequence rules, kept by the database so an old or out-of-date screen can't break them.
create or replace function ps_rules() returns trigger language plpgsql as $$
declare rpc boolean := coalesce(current_setting('wpf.seq',true),'')='rpc';
begin
  new.wo := upper(seq_txt(new.wo)); new.floor := seq_txt(new.floor); new.unit := seq_txt(new.unit);
  new.product := seq_txt(new.product); new.name := seq_txt(new.name); new.descr := seq_txt(new.descr);
  new.why := seq_txt(new.why);
  new.line_key := seq_line_key(new.floor,new.unit,new.product,new.name);
  new.house_key := seq_house_key(new.floor,new.unit);
  if tg_op='INSERT' then
    perform pg_advisory_xact_lock(hashtext('seq:'||new.project_id));
    select coalesce(max(pos),0)+1 into new.pos from project_seq where project_id=new.project_id and state<>'removed';
    if new.state='removed' then raise exception 'seq: a new row cannot be removed'; end if;
    new.state := case when new.wo is not null then 'matched' else 'waiting' end;
    if new.wo is not null then new.matched_at := coalesce(new.matched_at, now()); new.matched_by := coalesce(new.matched_by, new.created_by, new.updated_by); end if;
    new.created_at := now(); new.created_by := coalesce(new.created_by, new.updated_by);
    return new;
  end if;
  if new.project_id<>old.project_id then raise exception 'seq: a row cannot change project'; end if;
  if not rpc then
    -- positions, states and WO numbers only change through the seq_* functions (they lock the project and log the move)
    if new.pos<>old.pos then raise exception 'seq: use seq_move to change the order'; end if;
    if new.state<>old.state then raise exception 'seq: use seq_match / seq_unmatch / seq_remove / seq_restore'; end if;
    if new.wo is distinct from old.wo then raise exception 'seq: use seq_match to set a WO number'; end if;
    new.matched_at := old.matched_at; new.matched_by := old.matched_by; new.match_how := old.match_how;
    new.created_at := old.created_at; new.created_by := old.created_by;
  end if;
  if new.state='removed' and old.state='removed' and (new.req_date is distinct from old.req_date) then
    raise exception 'seq: row is removed';
  end if;
  return new;
end $$;
drop trigger if exists ps_rules on project_seq;
create trigger ps_rules before insert or update on project_seq for each row execute function ps_rules();
drop trigger if exists project_seq_touch on project_seq;
create trigger project_seq_touch before update on project_seq for each row execute function lists_touch();
-- Rows saved before the matching key (an earlier run of this block): work their keys out again. Only rows whose keys
-- changed are touched (their version goes up; nothing is written to the history); a second run touches nothing.
update project_seq set updated_by=coalesce(updated_by,'(key update)')
 where line_key is distinct from seq_line_key(floor,unit,product,name) or house_key is distinct from seq_house_key(floor,unit);

create or replace function ps_log() returns trigger language plpgsql security definer set search_path=public as $$
declare a text;
begin
  if tg_op='INSERT' then a := 'add';
  elsif new.state='removed' and old.state<>'removed' then a := 'remove';
  elsif old.state='removed' and new.state<>'removed' then a := 'restore';
  elsif new.wo is not null and old.wo is null then a := 'match';
  elsif new.wo is null and old.wo is not null then a := 'unmatch';
  elsif new.req_date is distinct from old.req_date then a := 'date';
  elsif row(new.floor,new.unit,new.product,new.name,new.descr,new.kind,new.own_date,new.children)
        is distinct from row(old.floor,old.unit,old.product,old.name,old.descr,old.kind,old.own_date,old.children) then a := 'edit';
  else return null; -- position-only changes are logged by seq_move; flags (is_new) are not history
  end if;
  insert into project_events(project_id,entity,entity_id,act,old,new,by)
  values(new.project_id,'seq',new.id,a,
    case when tg_op='UPDATE' then jsonb_build_object('wo',old.wo,'state',old.state,'req_date',old.req_date,'pos',old.pos,
      'floor',old.floor,'unit',old.unit,'product',old.product,'name',old.name) end,
    jsonb_build_object('wo',new.wo,'state',new.state,'req_date',new.req_date,'pos',new.pos,'floor',new.floor,'unit',new.unit,
      'product',new.product,'name',new.name,'why',new.why,'how',new.match_how),
    coalesce(new.updated_by,new.created_by,'?'));
  return null;
end $$;
drop trigger if exists ps_log on project_seq;
create trigger ps_log after insert or update on project_seq for each row execute function ps_log();

-- Renumber a project's live rows 1..n in the order given (internal; callers hold the project lock).
create or replace function seq_renumber(p_project text, p_order text[]) returns void language plpgsql security definer set search_path=public as $$
begin
  perform set_config('wpf.seq','rpc',true);
  update project_seq s set pos=o.n from unnest(p_order) with ordinality o(id,n)
   where s.id=o.id and s.project_id=p_project and s.pos<>o.n;
  perform set_config('wpf.seq','',true);
end $$;

-- Move a block of rows (in the order given) to just under p_after (null = to the top). Refused as 'stale' when any row
-- changed since the screen read it — the anchor row too (p_after_ver = the anchor's version the screen read; null = not
-- checked). Every move is logged with who, old position and new position.
-- (10 Nov, Tester round 1: p_after_ver added. The old 5-argument version is dropped first so the block stays re-runnable.)
drop function if exists seq_move(text[],text,int[],text,text);
create or replace function seq_move(p_ids text[], p_after text, p_expect int[], p_after_ver int, p_by text, p_why text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare pj text; x text; n int; ord text[]; rest text[]; i int; before jsonb; r record; moved jsonb := '[]'::jsonb;
begin
  if not lists_writable() then raise exception 'seq: lists are not switched on'; end if;
  if coalesce(array_length(p_ids,1),0)=0 then return jsonb_build_object('ok',false,'err','nothing to move'); end if;
  select project_id into pj from project_seq where id=p_ids[1];
  if pj is null then return jsonb_build_object('ok',false,'err','not found'); end if;
  perform pg_advisory_xact_lock(hashtext('seq:'||pj));
  select count(*) into n from project_seq where id=any(p_ids) and project_id=pj and state<>'removed';
  if n<>array_length(p_ids,1) then return jsonb_build_object('ok',false,'err','rows not in one project'); end if;
  if p_expect is not null then
    for i in 1..array_length(p_ids,1) loop
      if not exists(select 1 from project_seq where id=p_ids[i] and version=p_expect[i]) then
        return jsonb_build_object('ok',false,'err','stale'); end if;
    end loop;
  end if;
  if p_after is not null and (p_after=any(p_ids) or not exists(select 1 from project_seq where id=p_after and project_id=pj and state<>'removed')) then
    return jsonb_build_object('ok',false,'err','bad anchor'); end if;
  if p_after is not null and p_after_ver is not null and not exists(select 1 from project_seq where id=p_after and version=p_after_ver) then
    return jsonb_build_object('ok',false,'err','stale'); end if;
  select jsonb_object_agg(id,pos) into before from project_seq where project_id=pj and state<>'removed';
  select array_agg(id order by pos,created_at,id) into rest from project_seq where project_id=pj and state<>'removed' and id<>all(p_ids);
  rest := coalesce(rest,'{}');
  if p_after is null then ord := p_ids || rest;
  else
    ord := '{}';
    foreach x in array rest loop ord := ord || x; if x=p_after then ord := ord || p_ids; end if; end loop;
  end if;
  perform seq_renumber(pj, ord);
  perform set_config('wpf.seq','rpc',true);
  update project_seq set is_new=false, updated_by=coalesce(p_by,updated_by) where id=any(p_ids);
  perform set_config('wpf.seq','',true);
  for r in select id,pos from project_seq where id=any(p_ids) loop
    if (before->>r.id)::int<>r.pos then
      insert into project_events(project_id,entity,entity_id,act,old,new,by)
      values(pj,'seq',r.id,'move',jsonb_build_object('pos',(before->>r.id)::int),jsonb_build_object('pos',r.pos,'why',p_why),coalesce(p_by,'?'));
      moved := moved || jsonb_build_object('id',r.id,'from',(before->>r.id)::int,'to',r.pos);
    end if;
  end loop;
  return jsonb_build_object('ok',true,'moved',moved);
end $$;

-- Add rows (Cienapps upload lines, new WOs from an import, "start the sequence") in the order given, at the bottom or
-- under p_after. The claim rule (Job B part 3, the same in the planner): lines in the order given each CLAIM the first
-- unclaimed live row with the same line key (floor + unit + product + name); a line with no WO that finds none claims the first
-- unclaimed live row with NO line key in the same house (house_key) and of the same kind (an island line only an island row) —
-- a row made by "Start the sequence" (Manager condition 1), or a line with no product / name loaded before. A line that claims a row is SKIPPED (and listed). So a file with two identical
-- "W2 BED 2" lines adds 2 the first time and 0 when loaded again (a file with three adds 1 more).
-- A WO already on a live row is SKIPPED too — never added twice.
create or replace function seq_insert(p_project text, p_rows jsonb, p_after text, p_by text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare e jsonb; k text; w text; ex text; added text[] := '{}'; skipped jsonb := '[]'::jsonb; ord text[]; rest text[]; x text;
  claimed text[] := '{}'; hk text; kd text; how text; isl boolean;
begin
  if not lists_writable() then raise exception 'seq: lists are not switched on'; end if;
  if not exists(select 1 from projects where id=p_project) then return jsonb_build_object('ok',false,'err','no project'); end if;
  perform pg_advisory_xact_lock(hashtext('seq:'||p_project));
  for e in select * from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) loop
    k := seq_line_key(e->>'floor',e->>'unit',e->>'product',e->>'name');
    w := upper(seq_txt(e->>'wo'));
    hk := seq_house_key(e->>'floor',e->>'unit'); kd := coalesce(e->>'kind','kitchen');
    isl := seq_key_txt(concat_ws(' ',e->>'name',e->>'product',e->>'descr')) ~ '(^| )ISLAND( |$)';
    ex := null; how := 'line';
    if k is not null then
      select id into ex from project_seq where project_id=p_project and line_key=k and state<>'removed'
        and id<>all(added) and id<>all(claimed) order by pos,created_at,id limit 1;
    end if;
    -- no row with this line: a line with no WO claims a row with NO line key in the same house, of the same kind, and an
    -- island only an island (a Start-the-sequence row; also a line with no product / name loaded before — same file twice)
    if ex is null and w is null and hk is not null then how := 'house';
      select id into ex from project_seq s where s.project_id=p_project and s.line_key is null and s.house_key=hk and s.kind=kd
        and (seq_key_txt(concat_ws(' ',s.descr,s.name,s.product)) ~ '(^| )ISLAND( |$)')=isl
        and s.state<>'removed' and s.id<>all(added) and s.id<>all(claimed) order by s.pos,s.created_at,s.id limit 1;
    end if;
    if ex is not null then claimed := claimed || ex;
      skipped := skipped || jsonb_build_object('line_no',e->'line_no','line_key',k,'existing_id',ex,'why','already in the sequence','by',how);
      continue; end if;
    if w is not null then select id into ex from project_seq where upper(wo)=w and state<>'removed'; end if;
    if ex is not null then
      skipped := skipped || jsonb_build_object('line_no',e->'line_no','wo',w,'existing_id',ex,'why','WO already in a sequence');
      continue; end if;
    if exists(select 1 from project_seq where id=e->>'id') then
      skipped := skipped || jsonb_build_object('line_no',e->'line_no','existing_id',e->>'id','why','already saved');
      continue; end if;
    insert into project_seq(id,project_id,wo,floor,unit,product,name,descr,kind,children,req_date,own_date,is_new,src,upload_id,
      line_no,match_how,why,created_by,updated_by)
    values(e->>'id',p_project,w,e->>'floor',e->>'unit',e->>'product',e->>'name',e->>'descr',coalesce(e->>'kind','kitchen'),
      coalesce(e->'children','[]'::jsonb),(e->>'req_date')::date,coalesce((e->>'own_date')::boolean,false),
      coalesce((e->>'is_new')::boolean,false),coalesce(e->>'src','manual'),e->>'upload_id',(e->>'line_no')::int,
      case when w is not null then coalesce(e->>'match_how','import') end,e->>'why',p_by,p_by);
    added := added || (e->>'id');
  end loop;
  if p_after is not null and array_length(added,1)>0
     and exists(select 1 from project_seq where id=p_after and project_id=p_project and state<>'removed') and p_after<>all(added) then
    select array_agg(id order by pos,created_at,id) into rest from project_seq where project_id=p_project and state<>'removed' and id<>all(added);
    ord := '{}';
    foreach x in array rest loop ord := ord || x; if x=p_after then ord := ord || added; end if; end loop;
    perform seq_renumber(p_project, ord);
  end if;
  return jsonb_build_object('ok',true,'added',to_jsonb(added),'skipped',skipped);
end $$;

-- A waiting row takes a Cienapps WO number (auto match or the PM's one-tap confirm). Refused when the WO is already on
-- another live row, or the row is no longer waiting, or it changed since the screen read it.
create or replace function seq_match(p_id text, p_wo text, p_expect int, p_how text, p_by text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r record; w text := upper(seq_txt(p_wo)); o text;
begin
  if not lists_writable() then raise exception 'seq: lists are not switched on'; end if;
  select * into r from project_seq where id=p_id;
  if r.id is null then return jsonb_build_object('ok',false,'err','not found'); end if;
  perform pg_advisory_xact_lock(hashtext('seq:'||r.project_id));
  select * into r from project_seq where id=p_id;
  if r.state<>'waiting' then return jsonb_build_object('ok',false,'err','not waiting','wo',r.wo); end if;
  if p_expect is not null and r.version<>p_expect then return jsonb_build_object('ok',false,'err','stale'); end if;
  if w is null then return jsonb_build_object('ok',false,'err','no WO'); end if;
  select id into o from project_seq where upper(wo)=w and state<>'removed';
  if o is not null then return jsonb_build_object('ok',false,'err','WO already in a sequence','existing_id',o); end if;
  perform set_config('wpf.seq','rpc',true);
  update project_seq set wo=w, state='matched', matched_at=now(), matched_by=p_by,
    match_how=case when p_how in('auto','confirmed','start','import') then p_how else 'confirmed' end, is_new=false, updated_by=p_by, why=null
   where id=p_id;
  perform set_config('wpf.seq','',true);
  return jsonb_build_object('ok',true);
end $$;

create or replace function seq_unmatch(p_id text, p_expect int, p_by text, p_why text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r record;
begin
  if not lists_writable() then raise exception 'seq: lists are not switched on'; end if;
  if seq_txt(p_why) is null then return jsonb_build_object('ok',false,'err','reason needed'); end if;
  select * into r from project_seq where id=p_id;
  if r.id is null then return jsonb_build_object('ok',false,'err','not matched'); end if;
  perform pg_advisory_xact_lock(hashtext('seq:'||r.project_id));
  select * into r from project_seq where id=p_id; -- re-read under the project lock
  if r.state<>'matched' then return jsonb_build_object('ok',false,'err','not matched'); end if;
  if p_expect is not null and r.version<>p_expect then return jsonb_build_object('ok',false,'err','stale'); end if;
  perform set_config('wpf.seq','rpc',true);
  update project_seq set wo=null, state='waiting', matched_at=null, matched_by=null, match_how=null, updated_by=p_by, why=p_why where id=p_id;
  perform set_config('wpf.seq','',true);
  return jsonb_build_object('ok',true);
end $$;

-- Take a row out of the sequence (kept, marked removed — never deleted) / put it back at the bottom.
create or replace function seq_remove(p_id text, p_expect int, p_by text, p_why text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r record; ord text[];
begin
  if not lists_writable() then raise exception 'seq: lists are not switched on'; end if;
  if seq_txt(p_why) is null then return jsonb_build_object('ok',false,'err','reason needed'); end if;
  select * into r from project_seq where id=p_id;
  if r.id is null then return jsonb_build_object('ok',false,'err','not live'); end if;
  perform pg_advisory_xact_lock(hashtext('seq:'||r.project_id));
  select * into r from project_seq where id=p_id; -- re-read under the project lock
  if r.state='removed' then return jsonb_build_object('ok',false,'err','not live'); end if;
  if p_expect is not null and r.version<>p_expect then return jsonb_build_object('ok',false,'err','stale'); end if;
  perform set_config('wpf.seq','rpc',true);
  update project_seq set state='removed', updated_by=p_by, why=p_why where id=p_id;
  perform set_config('wpf.seq','',true);
  select array_agg(id order by pos,created_at,id) into ord from project_seq where project_id=r.project_id and state<>'removed';
  if ord is not null then perform seq_renumber(r.project_id, ord); end if;
  return jsonb_build_object('ok',true);
end $$;

create or replace function seq_restore(p_id text, p_expect int, p_by text, p_why text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r record; np int;
begin
  if not lists_writable() then raise exception 'seq: lists are not switched on'; end if;
  select * into r from project_seq where id=p_id;
  if r.id is null then return jsonb_build_object('ok',false,'err','not removed'); end if;
  perform pg_advisory_xact_lock(hashtext('seq:'||r.project_id));
  select * into r from project_seq where id=p_id; -- re-read under the project lock
  if r.state<>'removed' then return jsonb_build_object('ok',false,'err','not removed'); end if;
  if p_expect is not null and r.version<>p_expect then return jsonb_build_object('ok',false,'err','stale'); end if;
  if r.wo is not null and exists(select 1 from project_seq where upper(wo)=upper(r.wo) and state<>'removed') then
    return jsonb_build_object('ok',false,'err','WO already in a sequence'); end if;
  -- (Garry 10 Nov) the same line may be there twice (two wardrobes), so a removed line can always come back
  select coalesce(max(pos),0)+1 into np from project_seq where project_id=r.project_id and state<>'removed';
  perform set_config('wpf.seq','rpc',true);
  update project_seq set state=case when wo is not null then 'matched' else 'waiting' end, pos=np, updated_by=p_by, why=p_why where id=p_id;
  perform set_config('wpf.seq','',true);
  return jsonb_build_object('ok',true,'pos',np);
end $$;

-- Change requests for the fixed two-week window (PM asks, Production Manager approves or refuses).
create table if not exists seq_requests(id text primary key, project_id text not null references projects(id),
  kind text not null check(kind in('date','move')), seq_ids text[] not null, wos text[] not null default '{}',
  change jsonb not null, preview jsonb, why text not null, note text,
  status text not null default 'open' check(status in('open','approved','refused','withdrawn','direct')),
  asked_by text not null, asked_at timestamptz not null default now(),
  decided_by text, decided_at timestamptz, answer text, applied jsonb, applied_at timestamptz, seen_at timestamptz,
  version int not null default 1, updated_at timestamptz not null default now(), updated_by text);
create index if not exists sr_proj on seq_requests(project_id, status);
create index if not exists sr_upd on seq_requests(updated_at);

create or replace function sr_rules() returns trigger language plpgsql as $$
begin
  if tg_op='INSERT' then
    if new.status not in('open','direct') then raise exception 'req: a new request is open (or a direct change)'; end if;
    if seq_txt(new.why) is null then raise exception 'req: reason needed'; end if;
    if seq_txt(new.asked_by) is null then raise exception 'req: who is asking'; end if;
    if coalesce(array_length(new.seq_ids,1),0)=0 then raise exception 'req: no rows'; end if;
    new.asked_at := now();
    if new.status='direct' then new.decided_by := new.asked_by; new.decided_at := now();
    else new.decided_by := null; new.decided_at := null; new.answer := null; new.applied := null; new.applied_at := null;
      perform pg_advisory_xact_lock(hashtext('seq:'||new.project_id));
      if exists(select 1 from seq_requests where status='open' and project_id=new.project_id and seq_ids && new.seq_ids) then
        raise exception 'req: open request exists for one of these rows'; end if;
    end if;
    return new;
  end if;
  if row(new.id,new.project_id,new.kind,new.seq_ids,new.change,new.why,new.asked_by,new.asked_at)
     is distinct from row(old.id,old.project_id,old.kind,old.seq_ids,old.change,old.why,old.asked_by,old.asked_at) then
    raise exception 'req: a request cannot be rewritten (withdraw it and ask again)'; end if;
  if old.status='open' then
    if new.status not in('open','approved','refused','withdrawn') then raise exception 'req: bad status'; end if;
    if new.status<>'open' then
      if seq_txt(new.decided_by) is null then raise exception 'req: who decided'; end if;
      if new.status='refused' and seq_txt(new.answer) is null then raise exception 'req: a refusal needs a reason'; end if;
      new.decided_at := now();
    else new.decided_by := null; new.decided_at := null; new.answer := null;
    end if;
    if new.status<>'approved' then new.applied := null; new.applied_at := null;
    elsif new.applied is not null then new.applied_at := now(); end if;
  else
    if new.status<>old.status or new.decided_by is distinct from old.decided_by or new.answer is distinct from old.answer then
      raise exception 'req: already decided by %', old.decided_by; end if;
    new.decided_at := old.decided_at;
    if old.applied is not null then new.applied := old.applied; new.applied_at := old.applied_at;
    elsif new.applied is not null then
      if old.status not in('approved','direct') then raise exception 'req: only an approved request is applied'; end if;
      new.applied_at := now();
    end if;
  end if;
  return new;
end $$;
drop trigger if exists sr_rules on seq_requests;
create trigger sr_rules before insert or update on seq_requests for each row execute function sr_rules();
drop trigger if exists seq_requests_touch on seq_requests;
create trigger seq_requests_touch before update on seq_requests for each row execute function lists_touch();

create or replace function sr_log() returns trigger language plpgsql security definer set search_path=public as $$
declare a text;
begin
  if tg_op='INSERT' then a := case when new.status='direct' then 'direct' else 'ask' end;
  elsif new.status<>old.status then a := new.status;
  elsif new.applied is not null and old.applied is null then a := 'applied';
  else return null; end if;
  insert into project_events(project_id,entity,entity_id,act,old,new,by)
  values(new.project_id,'req',new.id,a,
    case when tg_op='UPDATE' then jsonb_build_object('status',old.status) end,
    jsonb_build_object('status',new.status,'kind',new.kind,'wos',new.wos,'change',new.change,'why',new.why,'answer',new.answer),
    coalesce(case when tg_op='INSERT' then new.asked_by else coalesce(new.decided_by,new.updated_by) end,'?'));
  return null;
end $$;
drop trigger if exists sr_log on seq_requests;
create trigger sr_log after insert or update on seq_requests for each row execute function sr_log();

-- Johnny's pre-production pool: his own order and his PROCESSED tick (= CNC files done), per sequence row.
create table if not exists seq_pre(seq_id text primary key references project_seq(id), wo text,
  pre_key double precision, processed boolean not null default false,
  processed_at timestamptz, processed_by text, processed_src text check(processed_src in('tick','sheet')), note text,
  version int not null default 1, updated_at timestamptz not null default now(), updated_by text);
create index if not exists sp_upd on seq_pre(updated_at);

create or replace function sp_rules() returns trigger language plpgsql as $$
begin
  if tg_op='UPDATE' and old.processed and not new.processed and coalesce(new.processed_src,'')='sheet' and old.processed_src='tick' then
    -- reading Johnny's sheet never clears a tick he made by hand
    new.processed := true; new.processed_src := old.processed_src; new.processed_at := old.processed_at; new.processed_by := old.processed_by;
  end if;
  if new.processed then
    if tg_op='INSERT' or not old.processed then
      new.processed_at := now(); new.processed_by := coalesce(seq_txt(new.processed_by), new.updated_by, '?');
      new.processed_src := coalesce(new.processed_src,'tick');
    else new.processed_at := old.processed_at; new.processed_by := old.processed_by; new.processed_src := old.processed_src;
    end if;
  else new.processed_at := null; new.processed_by := null; new.processed_src := null;
  end if;
  return new;
end $$;
drop trigger if exists sp_rules on seq_pre;
create trigger sp_rules before insert or update on seq_pre for each row execute function sp_rules();
drop trigger if exists seq_pre_touch on seq_pre;
create trigger seq_pre_touch before update on seq_pre for each row execute function lists_touch();

create or replace function sp_log() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if (tg_op='INSERT' and new.processed) or (tg_op='UPDATE' and new.processed<>old.processed) then
    insert into project_events(project_id,entity,entity_id,act,old,new,by)
    values((select project_id from project_seq where id=new.seq_id),'pre',new.seq_id,
      case when new.processed then 'processed' else 'unprocessed' end, null,
      jsonb_build_object('wo',new.wo,'src',new.processed_src), coalesce(new.updated_by,'?'));
  end if;
  return null;
end $$;
drop trigger if exists sp_log on seq_pre;
create trigger sp_log after insert or update on seq_pre for each row execute function sp_log();

-- Row level security: everyone using the app can read; add and change only while the lists are on the new store. Nobody deletes.
alter table project_seq enable row level security;
drop policy if exists "project_seq read" on project_seq;
create policy "project_seq read" on project_seq for select to anon, authenticated using (true);
drop policy if exists "project_seq add" on project_seq;
create policy "project_seq add" on project_seq for insert to anon, authenticated with check (lists_writable());
drop policy if exists "project_seq edit" on project_seq;
create policy "project_seq edit" on project_seq for update to anon, authenticated using (lists_writable()) with check (lists_writable());
alter table seq_requests enable row level security;
drop policy if exists "seq_requests read" on seq_requests;
create policy "seq_requests read" on seq_requests for select to anon, authenticated using (true);
drop policy if exists "seq_requests add" on seq_requests;
create policy "seq_requests add" on seq_requests for insert to anon, authenticated with check (lists_writable());
drop policy if exists "seq_requests edit" on seq_requests;
create policy "seq_requests edit" on seq_requests for update to anon, authenticated using (lists_writable()) with check (lists_writable());
alter table seq_pre enable row level security;
drop policy if exists "seq_pre read" on seq_pre;
create policy "seq_pre read" on seq_pre for select to anon, authenticated using (true);
drop policy if exists "seq_pre add" on seq_pre;
create policy "seq_pre add" on seq_pre for insert to anon, authenticated with check (lists_writable());
drop policy if exists "seq_pre edit" on seq_pre;
create policy "seq_pre edit" on seq_pre for update to anon, authenticated using (lists_writable()) with check (lists_writable());

-- Grants (30 Oct rule). No DELETE / TRUNCATE for anyone using the app.
grant select, insert, update on project_seq, seq_requests, seq_pre to anon, authenticated;
revoke delete, truncate on project_seq, seq_requests, seq_pre from anon, authenticated;
grant all on project_seq, seq_requests, seq_pre to service_role;
grant execute on function seq_txt(text), seq_line_key(text,text,text,text), seq_key_norm(text), seq_key_odd(text), seq_key_txt(text), seq_key_txtd(text),
  seq_key_code2(text), seq_key_code(text), seq_floor_key(text), seq_unit_key(text), seq_house_key(text,text) to anon, authenticated, service_role;
grant execute on function seq_move(text[],text,int[],int,text,text), seq_insert(text,jsonb,text,text), seq_match(text,text,int,text,text),
  seq_unmatch(text,int,text,text), seq_remove(text,int,text,text), seq_restore(text,int,text,text) to anon, authenticated, service_role;
revoke execute on function seq_renumber(text,text[]) from public, anon, authenticated;
```

---

## 2026-11-10 — Old-screen guard v2 — PENDING, NOT YET RUN — proposal for Garry: run on the dates-and-deliveries go-live day AFTER the new code is live

**Garry decides yes or no.** Not needed for the 10 Nov release.

**Why (plain English):** the 3 Nov guard only refuses screens from before Stage 1. A screen still running the **10 Nov version** after
dates-and-deliveries goes live can still save. Its "Clear Week — Start Fresh" button would take every week's bookings off the vans,
and its drivers' screens show next week's Tuesday as this Tuesday. The new code now writes a marker inside the planner settings
(`appRel` = 2) on every save. The 10 Nov code doesn't know that setting and drops it, so its saves arrive without it.
This SQL makes the database refuse those saves once the new code has saved once. The old screen shows "Save failed".
Whoever is using it refreshes the page and gets the new version. Anything typed on that old screen since its last good save is lost
and has to be typed again — better than it silently wiping the vans.

**What it changes:** only the `production_planner_bump` function (the same one the 3 Nov guard replaced). It keeps the 3 Nov rule (a save must
ask for exactly the next version number) and adds the marker rule. No table, no column, no data is touched, so no GRANT lines.
Works whether `settings` is stored as json or jsonb. A missing or unreadable marker counts as 0.

**Order matters:**
1. The dates-and-deliveries code is live (check in an incognito window: week tabs on Deliveries, "Synced").
2. Make one normal save from that new screen (e.g. type a note on a job). That writes the marker.
3. Run this SQL (below).
4. Close and reopen every PC, saw, stores, floor screen and driver's phone anyway.
**Never run it before the new code is live**: until a new screen has saved, nothing is refused (step 2 is what switches it on). But if
the website is then rolled back, every screen is refused (see Rollback).

### Steps for Garry
1. Supabase → WPF project → **SQL Editor** → **New query**. Copy everything in the grey box below, paste, **Run**.
2. Expected result: **"Success. No rows returned"**. A red error: stop and send a screenshot.
3. Check straight away: on the new site, type a note on a job, refresh the page, the note is still there ("Synced").
4. If an old screen is still open somewhere, it will now show "Save failed" when it saves — refresh it.
5. Safe to run twice (it only replaces the function).

```sql
-- Same as the 3 Nov guard (a save must ask for exactly the next version) PLUS: once the planner record has been saved by
-- the dates-and-deliveries code (settings.appRel 2 or more), a save without that marker (an older screen still open) is refused.
create or replace function production_planner_bump() returns trigger language plpgsql as $$
declare
  old_rel int := 0;
  new_rel int := 0;
  t text;
begin
  if old.id = 'main' and new.version is distinct from old.version + 1 then
    raise exception 'This planner screen is out of date - refresh the page' using errcode = 'P0001';
  end if;
  if old.id = 'main' then
    t := to_jsonb(old.settings)->>'appRel'; if t ~ '^[0-9]{1,6}$' then old_rel := t::int; end if;
    t := to_jsonb(new.settings)->>'appRel'; if t ~ '^[0-9]{1,6}$' then new_rel := t::int; end if;
    if old_rel >= 2 and new_rel < 2 then
      raise exception 'This planner screen is out of date - refresh the page' using errcode = 'P0001';
    end if;
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end $$;
```

**Rollback order (important):** if the website ever has to go back to an older version, FIRST undo this guard by running the
**3 Nov guard** grey box (below, "2026-11-03 — Old-screen guard") again — that removes only the marker rule and keeps the 3 Nov rule —
THEN put the older code back. The other way round, no screen can save.

**Tested:** on a throwaway local Postgres (`tests/dates/pg-guard-v2.sql`, run twice, json and jsonb settings): a new-code save
goes through; a 10-Nov-style save (next version, no marker) is refused with "This planner screen is out of date - refresh the page"
once the record has the marker; before any new-code save nothing is refused; a wrong or missing version is still refused; a save that
leaves settings alone is fine; rolling back to the 3 Nov guard lets the older code save again. The app shows "NOT SAVED — the database
refused this screen because it is out of date. Refresh the page" when refused (`tests/dates/c9-guard-v2.test.js`).
**Also try it once on a Supabase TEST project before going live.**

---

## 2026-11-11 — Project details (spec sheets) — PENDING, NOT YET RUN — Garry runs this AFTER the Stage 3 block and BEFORE merging `feature/project-details`

**What it does (plain English):**
- Makes a new table `project_specs`: a project's named spec sheets. A project can have several (Garry, 11 Nov), e.g.
  "Kitchens", "Kitchen Type B", "Robes". A spec can be marked "not used any more"; it is never deleted.
- Makes a new table `project_spec_items`: one row per item on a spec sheet ("Project details": Carcass Material,
  Hinges, Worktop Colour …) with its value, its status (Not specified / Proposed / Signed off) and who signed it off and when.
- The DATABASE keeps the rules, so an old or out-of-date screen can't break them: a blank or "TBC" value is always "Not
  specified" and can never be signed off; changing a signed-off value drops it back to "Proposed" and clears the signer;
  a sign-off can't be re-dated or re-named afterwards. One row per item per spec (two PCs can't make two).
- Makes a history table `project_events`: every add / change / sign-off is written there BY THE DATABASE (who, when, old
  value, new value). The app can read it but never write, change or delete it.
- Nothing is deleted: the app gets NO delete permission on either table. Writes are only taken while the lists are switched
  on (the same rule as snags and materials). The existing planner record and tables are untouched.
- Every new table has its own GRANT lines (30 Oct rule).

**If you deploy the code without running this first:** the "📝 Project details" buttons and the red "SPEC NOT SIGNED OFF"
chips simply don't appear (the screens check once per page load and hide them quietly). Everything else in the release —
materials for PMs / office, editing Floor / Unit / Title / Customer — works without it.

**Tested:** run twice on a throwaway Postgres set up like Supabase (after the Stage 1, Stage 3 and Stores dockets blocks);
`tests/project-details/pg-check.sql` checks every rule above — ALL PG CHECKS PASSED (11 Nov, with the several-specs change).

### Steps for Garry
1. Supabase → WPF project → **SQL Editor** → **New query**. Copy everything in the grey box below, paste, **Run**.
2. Expected result: **"Success. No rows returned"**. A red error: stop and send a screenshot — do not merge.
3. Check: **Table Editor** shows `project_specs`, `project_spec_items` and `project_events` (all empty). **Database → Triggers** shows
   `pspec_rules` and `project_specs_touch` on `project_specs`, and
   `psi_rules`, `psi_log` and `project_spec_items_touch` on `project_spec_items`.
4. Safe to run twice (nothing is duplicated, no data touched).

```sql
-- ===================== PROJECT DETAILS (spec sheets) — project_specs + project_spec_items + project_events =====================
-- Runs AFTER the Stage 3 block (it needs projects, project_materials, lists_touch and lists_writable). Safe to run twice.
-- A project can have several specs (Garry, 11 Nov): e.g. "Kitchens", "Kitchen Type B", "Robes". Retired, never deleted.
create table if not exists project_specs(id text primary key, project_id text not null references projects(id),
  name text not null, spec_type text not null default 'kitchens' check(spec_type in('kitchens','robes','schools')),
  sort int not null default 0, active boolean not null default true,
  version int not null default 1, updated_at timestamptz not null default now(), updated_by text);
create unique index if not exists pspec_uq on project_specs(project_id, lower(trim(name)));
create or replace function pspec_rules() returns trigger language plpgsql as $$
begin
  new.name := btrim(regexp_replace(normalize(coalesce(new.name,''),NFKC),'\s+',' ','g'));
  if new.name='' then raise exception 'a spec needs a name'; end if;
  if tg_op='UPDATE' and new.project_id<>old.project_id then raise exception 'a spec stays on its project'; end if;
  return new;
end $$;
drop trigger if exists pspec_rules on project_specs;
create trigger pspec_rules before insert or update on project_specs for each row execute function pspec_rules();
drop trigger if exists project_specs_touch on project_specs;
create trigger project_specs_touch before update on project_specs for each row execute function lists_touch();

create table if not exists project_spec_items(id text primary key, project_id text not null references projects(id),
  spec_id text not null references project_specs(id),
  item text not null, sort int not null default 0, is_extra boolean not null default false,
  value text, material_id text references project_materials(id),
  status text not null default 'not-specified' check(status in('not-specified','proposed','signed-off')),
  signed_by text, signed_at timestamptz, note text,
  version int not null default 1, updated_at timestamptz not null default now(), updated_by text);
alter table project_spec_items drop constraint if exists psi_signed_needs_value;
-- TBC, T.B.C., TBA, "to be confirmed / advised" = not signed off (pasted no-break spaces, tabs and full-width letters count too)
create or replace function psi_tbc(v text) returns boolean language sql immutable as $$
 select coalesce(upper(btrim(regexp_replace(normalize(coalesce(v,''),NFKC),'\s+',' ','g'))),'')
   ~ '^(|T\.? ?B\.? ?C\.?|T\.? ?B\.? ?A\.?|TO BE (CONFIRMED|ADVISED))$'
$$;
alter table project_spec_items add constraint psi_signed_needs_value check(status<>'signed-off' or not psi_tbc(value));
create unique index if not exists psi_uq on project_spec_items(spec_id, lower(trim(item)));


-- Who changed what on a project, written ONLY by the database (the app can read it, never write or change it)
create table if not exists project_events(id bigserial primary key, project_id text, entity text, entity_id text,
  act text, old jsonb, new jsonb, by text, at timestamptz default now());
create index if not exists pe_entity on project_events(entity_id);

-- The spec rules, kept by the database so an old or out-of-date screen can't break them:
--   blank or TBC = not specified (never signed off) · any other value = proposed · signed off records who and when ·
--   changing a signed-off value drops it back to proposed.
create or replace function psi_rules() returns trigger language plpgsql as $$
begin
  new.value := nullif(regexp_replace(normalize(coalesce(new.value,''),NFKC),'^\s+|\s+$','','g'),'');
  new.item := btrim(regexp_replace(normalize(new.item,NFKC),'\s+',' ','g'));
  if tg_op='UPDATE' then new.spec_id := old.spec_id; end if;                         -- an item stays on its spec
  select s.project_id into new.project_id from project_specs s where s.id=new.spec_id; -- and on that spec's project
  if psi_tbc(new.value) then
    new.status := 'not-specified';
  elsif tg_op='UPDATE' and old.status='signed-off' and new.status='signed-off' and new.value is distinct from old.value then
    new.status := 'proposed';
  elsif new.status='not-specified' then
    new.status := 'proposed';
  end if;
  if new.status<>'signed-off' then new.signed_by := null; new.signed_at := null;
  elsif tg_op='INSERT' or old.status<>'signed-off' then
    new.signed_at := now(); new.signed_by := coalesce(nullif(btrim(coalesce(new.signed_by,'')),''), new.updated_by, '?');
  else new.signed_at := old.signed_at; new.signed_by := old.signed_by; -- a sign-off can't be re-dated or re-named
  end if;
  return new;
end $$;
drop trigger if exists psi_rules on project_spec_items;
create trigger psi_rules before insert or update on project_spec_items for each row execute function psi_rules();
drop trigger if exists project_spec_items_touch on project_spec_items;
create trigger project_spec_items_touch before update on project_spec_items for each row execute function lists_touch();

create or replace function psi_log() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='UPDATE' and new.value is not distinct from old.value and new.status=old.status and new.item=old.item then return null; end if;
  insert into project_events(project_id,entity,entity_id,act,old,new,by)
  values(new.project_id,'spec',new.id,
    case when tg_op='INSERT' then 'add' when new.status='signed-off' and old.status<>'signed-off' then 'sign-off'
         when old.status='signed-off' and new.status<>'signed-off' then 'unsign' else 'edit' end,
    case when tg_op='UPDATE' then jsonb_build_object('value',old.value,'status',old.status,'item',old.item) end,
    jsonb_build_object('value',new.value,'status',new.status,'item',new.item,'signed_by',new.signed_by),
    coalesce(new.updated_by,'?'));
  return null;
end $$;
drop trigger if exists psi_log on project_spec_items;
create trigger psi_log after insert or update on project_spec_items for each row execute function psi_log();

-- Row level security: everyone using the app can read; add and change only while the lists are on the new store
-- (the same rule as snags and materials). Nobody can delete.
alter table project_specs enable row level security;
drop policy if exists "project_specs read" on project_specs;
create policy "project_specs read" on project_specs for select to anon, authenticated using (true);
drop policy if exists "project_specs add" on project_specs;
create policy "project_specs add" on project_specs for insert to anon, authenticated with check (lists_writable());
drop policy if exists "project_specs edit" on project_specs;
create policy "project_specs edit" on project_specs for update to anon, authenticated using (lists_writable()) with check (lists_writable());
alter table project_spec_items enable row level security;
drop policy if exists "project_spec_items read" on project_spec_items;
create policy "project_spec_items read" on project_spec_items for select to anon, authenticated using (true);
drop policy if exists "project_spec_items add" on project_spec_items;
create policy "project_spec_items add" on project_spec_items for insert to anon, authenticated with check (lists_writable());
drop policy if exists "project_spec_items edit" on project_spec_items;
create policy "project_spec_items edit" on project_spec_items for update to anon, authenticated using (lists_writable()) with check (lists_writable());
alter table project_events enable row level security;
drop policy if exists "project_events read" on project_events;
create policy "project_events read" on project_events for select to anon, authenticated using (true);

-- Grants (30 Oct rule). No DELETE for anyone using the app. project_events: read only (the database writes it).
grant select, insert, update on project_specs, project_spec_items to anon, authenticated;
grant select on project_events to anon, authenticated;
grant execute on function psi_tbc(text) to anon, authenticated, service_role;
grant all on project_specs, project_spec_items, project_events to service_role;
grant usage, select on sequence project_events_id_seq to service_role;
```


---

## 2026-11-04 — Photo of a list (Storage bucket `list-photos`) — PENDING, NOT YET RUN — Garry runs this BEFORE merging `feature/stores-dockets`

**What it does (plain English):**
- Makes a new photo store (a Storage "bucket") called `list-photos`, the same kind as the drivers' `pod` proof-of-delivery photos. The office puts a photo (or PDF) of a paper cutting list there with "📷 Attach photo of list"; the saw and stores open it.
- Anyone using the app can ADD a photo and VIEW photos. Nobody using the app can change or delete one (no update / delete rules). Photos are up to 15 MB, and only JPG, PNG or PDF.
- The job only keeps a link to each photo, inside the planner record it already has (`listPhotos`). No new table, so no GRANT lines are needed.
- **Public for now**, like `pod`: anyone with a photo's exact link can open it (the links are long and random, and not listed anywhere public). **Stage 4 (logins) makes this bucket private** — then only signed-in staff can open the photos.
- Removing a photo in the planner only takes the link off the job; the file stays in the bucket (nothing is ever deleted).

**If you deploy the code without running this first:** "📷 Attach photo of list" says "the photo store isn't set up yet" and nothing is attached. Nothing else changes. Run this first anyway.

### Steps for Garry
1. Supabase → WPF project → **SQL Editor** → **New query**. Copy everything in the grey box below, paste, **Run**.
2. Expected result: **"Success. No rows returned"**. A red error: stop and send a screenshot — do not merge.
3. Check: **Storage** (left menu) shows a bucket `list-photos` marked **Public**.
4. Safe to run twice (nothing is duplicated, no data touched).

```sql
-- ===================== PHOTO OF A LIST — Storage bucket 'list-photos' =====================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('list-photos', 'list-photos', true, 15728640, array['image/jpeg','image/png','application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
-- view: anyone using the app (public for now, like 'pod'; Stage 4 makes it private)
drop policy if exists "list-photos read" on storage.objects;
create policy "list-photos read" on storage.objects for select to anon, authenticated using (bucket_id = 'list-photos');
-- add: anyone using the app. No update and no delete policy: a photo can never be changed or deleted from the app.
drop policy if exists "list-photos add" on storage.objects;
create policy "list-photos add" on storage.objects for insert to anon, authenticated with check (bucket_id = 'list-photos');
```

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
- **Added 3 Nov 2026 (list editor):** `list_lines` has a `unit_qty` column — the quantity for ONE unit when a line sits in a unit block ("Side panel 2 per unit × 3 units"). The line's `qty` is still the TOTAL to cut, so the saw, sheet calculator and labels read it exactly as before. A unit heading is a heading line whose `qty` is the number of units. If this block was already run on a test project, the `alter table list_lines add column if not exists unit_qty text;` line below adds the column (safe to run twice). No new table, so no new GRANT lines — the existing `list_lines` grants cover it. Include it in the migration rehearsal.
- **Added 3 Nov 2026 (Tester round 2 — one live list per work order):** two PCs issuing a list for the same work order at the same moment could each make one, and the saw would cut it twice. The database now refuses the second one. A new helper `lists_one_per_wo` makes the two take turns (a lock per work order) and refuses a second live list (not archived, not a template) for that work order. It is used only by the cutting-list flow — ✓ Confirm, "✓ Use" an Excel upload, and "Create & attach" from a template — so an office can still deliberately put two lists of different kinds (kitchen + wardrobes) on one work order from the editor or "+ WO". A second helper, `lists_one_replacement`, stops "Make new list from this" on two PCs making two replacements of the same old list. `list_attach` gains one optional setting (`p_one`), so the old version is dropped first (only the function, never any data). The new helpers have their own GRANT lines.
- **Added 3 Nov 2026 (Manager review — "Make new list from this"):** `save_list_revision` now archives the OLD list in the same step that saves the new one, so a lost reply or a closed browser can never leave both lists on the saw. If the old list was changed on another screen after it was copied, the save stops and the person is asked first ("archive it anyway" or "leave it with the saw"). Only the function changes — no table, no data. Safe to run twice. A part in a unit block that is a FIXED total (it doesn't divide by the units) is saved with `unit_qty` = `fixed` (the column is text already — no change needed).
- **Added 4 Nov 2026 (simple lists for standard production — Aspect / O'Malleys):**
  - **"Bought in" lines.** A line can now be a fourth kind, `buy` (besides `saw`, `fit` and `hdr`): a panel or item with sizes that is bought in, never cut. The saw, the stores pick list, the sheet calculator, the combined list and the labels only ever read `saw` / `fit` lines, so a bought-in line can never reach them; the office list and print show it as "Bought in". Only the `list_lines` kind check changes (dropped and added again — safe to run twice). No data is touched.
  - **"Checked by" before the saw.** `lists` gets three columns: `check_req` (this list must be checked before the saw sees it), `checked_by`, `checked_at`. Only used when the Settings switch **"Lists must be checked before the saw"** is ON (it is OFF for the initial roll-out, Garry 4 Nov): the app then sends `check_req` = true and a list made or saved through the app starts as "Waiting for check"; with the switch OFF the app sends false and lists reach the saw exactly as before. Editing a list (a new revision too) clears the check; `list_set_done` has a new mode `check` (on = checked, off = check taken away) that writes the history line; a list confirmed from a template counts as checked only if the template itself is checked (same revision). Lists moved over by "Migrate lists" and snag lists keep `check_req` = false (they reach the saw as before). No new table or function, so no new GRANT lines. Safe to run twice (`add column if not exists`).
- **Added 4 Nov 2026 (two edging columns, Garry):** `list_lines` gets an `edging2` column — the second, optional edging on a piece ("Edging 1" stays in `edging`). The saw, prints and labels show both ("L1LE 1mm / L4S 2mm"). `save_list_revision` writes it, and changing it counts as a change to the line (like Edging 1). If this block was already run on a test project, the `alter table list_lines add column if not exists edging2 text;` line adds the column (safe to run twice). No new table, so no new GRANT lines — the existing `list_lines` grants cover it.
- **The app does not use any of this until Garry presses "Migrate lists" (Admin PIN, Settings).** Until then it runs exactly as today, and makes no calls to these tables. So running this early is harmless.

**If you deploy the code without running this first:** nothing changes on the floor (the switch is off). But "Migrate lists" would fail — so run this first anyway.

### Steps for Garry
1. Go to https://supabase.com/dashboard and open the WPF project (`klyropbsupqfmtjjwlfa`).
2. In the left menu click **SQL Editor**, then **New query**.
3. **Step 0 — check first.** Paste just this one line and click **Run**:
   ```sql
   select data_type from information_schema.columns where table_schema='public' and table_name='production_planner' and column_name='settings';
   ```
   It should say **json** or **jsonb** (both are fine). If it says anything else (e.g. text) or nothing, stop and send a screenshot.
   The Stage 1 block (further down this file, 2026-10-20) must already have been run: `production_planner` must have a `version` column.
4. Clear the editor, copy everything in the grey box below, paste it and click **Run**.
5. Expected result: **"Success. No rows returned"**. If you see a red error, stop and send a screenshot — do not merge.
6. **Straight away, check the planner still saves.** This SQL adds a trigger to the planner record itself, so: make one normal save on the live site (e.g. type a note on a job), refresh the page, and check the note stuck. If saving fails, the new trigger is at fault: stop and send a screenshot.
7. Check: **Table Editor** shows the new tables `projects`, `project_materials`, `lists`, `list_lines`, `list_revisions`, `list_events`, `snags` (all empty).
8. Check: **Database → Functions** shows these 14: the five the app calls — `apply_line_changes`, `list_attach`, `list_set_done`, `save_list_revision`, `snags_to_list` — and nine helpers — `lists_switch_on`, `lists_writable`, `lists_touch`, `lists_one_per_wo`, `lists_one_replacement`, `pm_key`, `pm_no_clash`, `production_planner_keep_switch`, `snag_line_done`. There must be only ONE `list_attach` (if you see two, the `drop function` line didn't run — send a screenshot). And **Database → Triggers** shows these 8: `projects_touch`, `project_materials_touch`, `lists_touch`, `list_lines_touch`, `snags_touch` (each on the table of the same name), `pm_no_clash` (on `project_materials`), `list_lines_snag` (on `list_lines`) and `production_planner_keep_switch` (on `production_planner`).
9. The whole grey box is safe to run twice (e.g. if the first Run was interrupted, or it was already run on a test project): nothing is duplicated and no data is touched. You should not need to delete or change any line.

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
-- A name or other spelling (alias) can belong to only one material per project — ignoring case and extra spaces
create or replace function pm_key(t text) returns text language sql immutable as
$$ select lower(btrim(regexp_replace(normalize(coalesce(t,''),NFKC),'\s+',' ','g'))) $$;
create or replace function pm_no_clash() returns trigger language plpgsql as $$
declare mine text[];
begin
  perform pg_advisory_xact_lock(hashtext('pm:'||new.project_id)); -- two screens adding at once take turns
  select array_agg(pm_key(x)) into mine from unnest(array[new.name]||coalesce(new.aliases,'{}')) x where pm_key(x)<>'';
  if exists(select 1 from project_materials o, unnest(array[o.name]||coalesce(o.aliases,'{}')) y
            where o.project_id=new.project_id and o.id<>new.id and pm_key(y)=any(mine)) then
    raise exception 'that material name or other spelling is already used on this project' using errcode='23505';
  end if;
  return new;
end $$;
drop trigger if exists pm_no_clash on project_materials;
create trigger pm_no_clash before insert or update on project_materials for each row execute function pm_no_clash();
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
-- 4 Nov: "Checked by" — a list with check_req = true reaches the saw only once checked (Drawing office / PM / Admin)
alter table lists add column if not exists check_req boolean not null default false;
alter table lists add column if not exists checked_by text;
alter table lists add column if not exists checked_at timestamptz;
create index if not exists lists_upd on lists(updated_at);
create index if not exists lists_wos on lists using gin(wos);

create table if not exists list_lines(id text primary key, list_id text not null references lists(id), seq int not null,
  kind text not null check(kind in('saw','fit','hdr','buy')), section text, part text,
  length_mm numeric, width_mm numeric, qty text, unit_qty text, material text, material_other boolean not null default false,
  edging text, edging2 text, note text,
  status text not null default 'todo' check(status in('todo','cut','got-out','waiting','na')),
  status_by text, status_at timestamptz, released_at timestamptz, released_by text,
  added_rev int, changed_rev int, removed_rev int, src_line_id text,
  mig_sig text,                                                         -- fingerprint of the old-format tick / N/A copied at migration
  version int not null default 1, updated_at timestamptz not null default now());
alter table list_lines add column if not exists mig_sig text;
alter table list_lines add column if not exists unit_qty text;    -- list editor (3 Nov): per-unit quantity in a unit block; qty stays the total
alter table list_lines add column if not exists edging2 text;     -- (4 Nov) a second, optional edging per piece (Edging 1 = edging)
-- 4 Nov: a 'buy' line = bought in (has sizes, never cut, never picked): only the office list shows it
alter table list_lines drop constraint if exists list_lines_kind_check;
alter table list_lines add constraint list_lines_kind_check check(kind in('saw','fit','hdr','buy'));
create index if not exists ll_list on list_lines(list_id);
create index if not exists ll_upd on list_lines(updated_at);

create table if not exists list_revisions(id bigserial primary key, list_id text not null references lists(id),
  rev int not null, lines jsonb not null, meta jsonb, reason text, made_by text, made_at timestamptz default now(),
  unique(list_id,rev));
create table if not exists list_events(id bigserial primary key, list_id text, line_id text, act text not null,
  from_status text, to_status text, n int default 1, by text, at timestamptz default now(), client_at timestamptz, note text,
  cid text,                                                             -- the device's id for one tap: a resend is recognised, never applied twice
  v_after int);                                                         -- the line's version right after this tap (what a resend reports back)
alter table list_events add column if not exists cid text;
alter table list_events add column if not exists v_after int;
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
-- Supabase gives new tables every right by default: take away delete / truncate, and edits to the history tables
revoke delete, truncate on projects, project_materials, lists, list_lines, list_revisions, list_events from anon, authenticated;
revoke update on list_revisions, list_events from anon, authenticated;

-- The new tables only take writes while the lists are on the new store ('v2') or being migrated ('migrating'): a screen
-- that missed a Switch back can't add snags, materials or lines to tables nobody reads. (Reads are always allowed.)
create or replace function lists_writable() returns boolean language sql stable security definer set search_path=public as $$
 select coalesce((select settings->>'listStore' from production_planner where id='main'),'') in ('v2','migrating')
$$;
grant execute on function lists_writable() to anon, authenticated, service_role;

do $$ declare t text; begin foreach t in array array['projects','project_materials','lists','list_lines','list_revisions','list_events'] loop
  execute format('alter table %1$s enable row level security;
    drop policy if exists "%1$s read" on %1$s; create policy "%1$s read" on %1$s for select to anon, authenticated using (true);
    drop policy if exists "%1$s add" on %1$s; create policy "%1$s add" on %1$s for insert to anon, authenticated with check (lists_writable());',t);
end loop;
foreach t in array array['projects','project_materials','lists','list_lines'] loop
  execute format('drop policy if exists "%1$s edit" on %1$s; create policy "%1$s edit" on %1$s for update to anon, authenticated using (lists_writable()) with check (lists_writable());',t);
end loop; end $$;

-- Realtime: ready for later; the app polls for now. Adds each table only if it isn't in the publication already,
-- and skips quietly if this project has no supabase_realtime publication — so the whole block is safe to run twice.
do $$ declare t text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  foreach t in array array['lists','list_lines'] loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
    execute format('alter publication supabase_realtime add table public.%I',t);
   end if;
  end loop;
 end if;
end $$;

-- Every list function refuses while the lists are switched back to the old store: a device that missed the switch
-- (offline at the time) then puts its change into the old lists instead of into tables nobody is reading.
-- 'for share': a Switch back first saves listStore='switching', which has to wait for every list change already running —
-- so nothing can land in the tables after the switch back has read them.
create or replace function lists_switch_on() returns void language plpgsql as $$
declare s text;
begin
 select settings->>'listStore' into s from production_planner where id='main' for share;
 if coalesce(s,'') <> 'v2' then
  raise exception 'switched off: the cutting lists are on the old store' using errcode='P0001';
 end if;
end $$;
grant execute on function lists_switch_on() to anon, authenticated, service_role;

-- One status change per line, with the "done wins" rules applied by the database.
-- Each change: {id, status | act:'release', v (line version the screen saw — needed to untick), rev (list rev the screen
-- showed), cid (device id for this tap), from, at, sa / ra (for a release: the line's status_at / released_at the screen saw)}. Reply per change: {id, cid, ok, why, status, v, by, at, rel, relby, dup, va = for a resend, the version that tap produced}.
-- why: missing | removed | changed (a newer revision changed the line) | not-needed | wrong-kind | done (already cut/got out)
--      | stale (someone changed the line since this screen saw it) | not-waiting | bad
create or replace function apply_line_changes(p_changes jsonb, p_by text) returns jsonb language plpgsql as $$
declare c jsonb; l list_lines%rowtype; w text; a text; ok boolean; noop boolean; why text; res jsonb:='[]';
begin
 perform lists_switch_on();
 -- Lock order is ALWAYS list first, then its lines (save_list_revision does the same): every list this batch touches is
 -- locked up front, in id order, so a tick and a list edit at the same moment take turns instead of deadlocking.
 perform 1 from lists where id in (select x.list_id from list_lines x
   where x.id in (select y->>'id' from jsonb_array_elements(p_changes) y)) order by id for update;
 for c in select * from jsonb_array_elements(p_changes) loop
  -- then lock the line: a resend racing the original waits here until the original has committed its event,
  -- then sees it below as "already applied" (instead of failing on the unique cid)
  select * into l from list_lines where id=c->>'id' for update;
  if not found then res:=res||jsonb_build_object('id',c->>'id','cid',c->>'cid','ok',false,'why','missing'); continue; end if;
  -- the same tap sent again (the first reply was lost): report the line as it is now, change nothing
  if c->>'cid' is not null and exists(select 1 from list_events e where e.cid=c->>'cid') then
   res:=res||jsonb_build_object('id',c->>'id','cid',c->>'cid','ok',true,'dup',true,'va',(select e.v_after from list_events e where e.cid=c->>'cid' limit 1),'status',l.status,'v',l.version,'by',l.status_by,'at',l.status_at,'rel',l.released_at,'relby',l.released_by);
   continue;
  end if;
  a:=coalesce(c->>'act','status'); w:=c->>'status'; noop:=false; why:=null; ok:=false;
  if l.removed_rev is not null then why:='removed';
  elsif a='release' then
   -- a release only counts if the line is still the same wait the screen saw (a late offline 'Release all' can't release
   -- a line that was let go and parked again since). An office edit (note, order) doesn't count as a new wait.
   if l.status='waiting' and (case when c ? 'sa' then l.status_at is not distinct from (c->>'sa')::timestamptz
        and (not c ? 'ra' or l.released_at is not distinct from (c->>'ra')::timestamptz)
        else (c->>'v' is null or l.version=(c->>'v')::int) end) then ok:=true;
   elsif l.status='waiting' then why:='stale';
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
   insert into list_events(list_id,line_id,act,from_status,to_status,by,client_at,cid,v_after)
     values(l.list_id,l.id,a,c->>'from',l.status,p_by,(c->>'at')::timestamptz,c->>'cid',l.version);
  end if;
  res:=res||jsonb_build_object('id',l.id,'cid',c->>'cid','ok',ok,'why',why,'status',l.status,'v',l.version,'by',l.status_by,'at',l.status_at,'rel',l.released_at,'relby',l.released_by);
 end loop; return res; end $$;
grant execute on function apply_line_changes(jsonb,text) to anon, authenticated, service_role;

-- One live list per work order (added 3 Nov 2026, Tester round 2). Two PCs issuing a list for the same WO at the same
-- moment: each takes a lock per WO (in WO order, so two never wait on each other), then looks for another live list (not
-- archived, not a template) tagged to it. The second one waits for the first to finish, sees its list, and is refused:
--   'one list per WO: <wo> already has the live list "<name>"'  (detail = that list's id, hint = the WO)
-- p_skip: list ids that don't count (the list being attached). Used ONLY by the cutting-list flow (✓ Confirm, "✓ Use" an
-- Excel upload, template "Create & attach"); the editor and "+ WO" can still put two lists of different kinds on one WO.
create or replace function lists_one_per_wo(p_wos text[], p_skip text[]) returns void language plpgsql as $$
declare w text; x lists%rowtype;
begin
 for w in select distinct u from unnest(coalesce(p_wos,'{}')) u where coalesce(u,'')<>'' order by 1 loop
  perform pg_advisory_xact_lock(hashtext('wo:'||w));
 end loop;
 for w in select distinct u from unnest(coalesce(p_wos,'{}')) u where coalesce(u,'')<>'' order by 1 loop
  select * into x from lists where wos @> array[w] and not archived and not is_template
    and not (id = any(coalesce(p_skip,'{}'))) order by created_at, id limit 1;
  if found then
   raise exception 'one list per WO: % already has the live list "%"', w, x.name using errcode='P0001', detail=x.id, hint=w;
  end if;
 end loop;
end $$;
grant execute on function lists_one_per_wo(text[],text[]) to anon, authenticated, service_role;

-- "Make new list from this" on two PCs at once: only ONE live replacement of an old list. The replacement's "List created"
-- history line carries {"replaces": <old list id>} (save_list_revision writes it); a second one is refused.
create or replace function lists_one_replacement(p_old text, p_wo text) returns void language plpgsql as $$
declare x lists%rowtype;
begin
 perform pg_advisory_xact_lock(hashtext('repl:'||p_old));
 select * into x from lists where not archived and not is_template
   and log @> jsonb_build_array(jsonb_build_object('replaces',p_old)) order by created_at, id limit 1;
 if found then
  raise exception 'one list per WO: the old list % has already been replaced by "%"', p_old, x.name using errcode='P0001', detail=x.id, hint=coalesce(p_wo,'');
 end if;
end $$;
grant execute on function lists_one_replacement(text,text) to anon, authenticated, service_role;

-- Add or remove ONE work order on a list in one step (race-safe), with a history line and an event.
-- p_cid: the device's id for this tap — the same tap sent again (reply lost) changes nothing and adds no history.
-- p_one (3 Nov): the cutting-list flow's "✓ Use" — refused if the WO already has another live list (lists_one_per_wo).
-- The 5-setting version is dropped first so there is only one list_attach (dropping a function never touches data).
drop function if exists list_attach(text,text,boolean,text,text);
create or replace function list_attach(p_list text, p_wo text, p_on boolean, p_by text, p_cid text default null, p_one boolean default false) returns jsonb language plpgsql as $$
declare r lists%rowtype; had boolean;
begin
 perform lists_switch_on();
 select * into r from lists where id=p_list for update;
 if not found then raise exception 'missing list %', p_list; end if;
 if p_cid is not null and exists(select 1 from list_events e where e.cid=p_cid) then return to_jsonb(r); end if;
 had:= p_wo = any(r.wos);
 if p_on and not had and coalesce(p_one,false) then perform lists_one_per_wo(array[p_wo], array[p_list]); end if;
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
grant execute on function list_attach(text,text,boolean,text,text,boolean) to anon, authenticated, service_role;

-- Sign-offs and flags (build note g). p_mode: 'saw' | 'fit' (sign-off; off = send back / undo) | 'no_cut' | 'no_fit'
-- | 'send' (Send to saw: locks the list) | 'archive' (Delete on the Lists tab — the list is hidden, never deleted)
-- | 'check' (4 Nov: on = "Checked" by p_by now — the saw sees the list; off = the check taken away). The database writes the history line, never the browser.
-- p_cid: the device's id for this tap — the same tap sent again (reply lost) changes nothing and adds no history.
create or replace function list_set_done(p_list text, p_mode text, p_on boolean, p_by text, p_why text default null, p_cid text default null) returns jsonb language plpgsql as $$
declare r lists%rowtype; what text;
begin
 perform lists_switch_on();
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
 elsif p_mode='check' then
  update lists set checked_by=case when p_on then p_by end, checked_at=case when p_on then now() end, updated_by=p_by,
    log=log||jsonb_build_array(jsonb_build_object('at',now(),'by',p_by,'what',case when p_on then 'Checked' else 'Check taken away' end,'why',p_why)) where id=p_list returning * into r;
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
-- p_lines: every line the list should now have ({id, seq, kind, section, part, length_mm, width_mm, qty, unit_qty, material,
--          material_other, edging, edging2, note, snag_id, src_line_id, reset}); reset:true = content changed, so the tick resets.
-- p_expect: the list version the editor started from (null = a brand-new list).
-- A brand-new list (3 Nov): p_list.one_per_wo = true → refused if any of its WOs already has a live list (lists_one_per_wo);
-- p_list.replaces = <old list id> ("Make new list from this") → refused if that old list already has a live replacement.
-- (3 Nov, Manager review) …and the OLD list is archived in this same step, so the saw never has both, even if the reply is
-- lost. p_list.replaces_lines = the old list's lines as they were when it was copied ({line id: [kind, section, part,
-- length_mm, width_mm, qty, unit_qty, material, edging, note, edging2]} — content only, ticks don't count): if the old list's lines
-- differ now (changed on another screen), the save is refused with 'replaced list changed' unless
-- p_list.replaces_force = true (the person said "archive it anyway") or p_list.replaces_keep = true (leave it with the saw).
-- The answer says what happened to the old list: retired = 'archived' | 'already' (archived before) | 'missing' | 'kept'.
-- (4 Nov) "Checked by" — only when the app sends p_list.check_req = true (the Settings switch "Lists must be checked before
-- the saw" is ON; missing or false = no check needed, the list reaches the saw as before): a new list starts as waiting for
-- its check — except a list made from a template (source 'template') at the template's current revision when that template
-- is checked: it is checked by the template's checker. Saving an existing list (an edit or a new revision) always clears
-- the check, and sets check_req to what the app sent (ON: it must be checked again; OFF: no check needed).
create or replace function save_list_revision(p_list jsonb, p_lines jsonb, p_expect int, p_by text, p_reason text) returns jsonb language plpgsql as $$
declare r lists%rowtype; e jsonb; nrev int; ids text[]:='{}'; ex list_lines%rowtype; isnew boolean:=false; o lists%rowtype; retired text; now_lines jsonb; t lists%rowtype;
 chk boolean:=coalesce((p_list->>'check_req')::boolean,false);
begin
 perform lists_switch_on();
 select * into r from lists where id=p_list->>'id' for update;
 if not found then
  if p_expect is not null then raise exception 'stale: list % is missing', p_list->>'id'; end if;
  if coalesce((p_list->>'one_per_wo')::boolean,false) then
   perform lists_one_per_wo(array(select jsonb_array_elements_text(coalesce(p_list->'wos','[]'))), array[p_list->>'id']); end if;
  if coalesce(p_list->>'replaces','')<>'' then
   perform lists_one_replacement(p_list->>'replaces',p_list->'wos'->>0);
   select * into o from lists where id=p_list->>'replaces' for update;
   if not found then retired:='missing';
   elsif o.archived then retired:='already';
   elsif coalesce((p_list->>'replaces_keep')::boolean,false) then retired:='kept';
   else
    select coalesce(jsonb_object_agg(x.id,jsonb_build_array(x.kind,x.section,x.part,x.length_mm,x.width_mm,x.qty,x.unit_qty,x.material,x.edging,x.note,x.edging2)),'{}'::jsonb)
      into now_lines from list_lines x where x.list_id=o.id and x.removed_rev is null;
    if jsonb_typeof(p_list->'replaces_lines')='object' and not coalesce((p_list->>'replaces_force')::boolean,false) and now_lines<>p_list->'replaces_lines' then
     raise exception 'replaced list changed: "%" was changed on another screen after it was copied', o.name using errcode='P0001', detail=o.id, hint='replaced-changed';
    end if;
    update lists set archived=true, updated_by=p_by,
      log=log||jsonb_build_array(jsonb_build_object('at',now(),'by',p_by,'what','Archived','why','Replaced by "'||coalesce(p_list->>'name','(no name)')||'"')) where id=o.id;
    insert into list_events(list_id,act,by,note) values(o.id,'archive-on',p_by,'Replaced by "'||coalesce(p_list->>'name','(no name)')||'"');
    retired:='archived';
   end if;
  end if;
  -- (4 Nov) with the check switched on, a new list waits for its check; a copy of a CHECKED template (at that template's
  -- revision) is checked by the template's checker
  select * into t from lists where chk and id=p_list->>'template_id' and is_template and checked_at is not null
    and coalesce(p_list->>'source','')='template' and rev=(p_list->>'template_rev')::int;
  insert into lists(id,project_id,name,list_type,type_name,is_template,template_id,template_rev,wos,no_cut,no_fit,source,sdate,created_by,updated_by,check_req,checked_by,checked_at,log)
   values(p_list->>'id',p_list->>'project_id',coalesce(p_list->>'name','(no name)'),coalesce(p_list->>'list_type','house'),p_list->>'type_name',
     coalesce((p_list->>'is_template')::boolean,false),p_list->>'template_id',(p_list->>'template_rev')::int,
     coalesce(array(select jsonb_array_elements_text(p_list->'wos')),'{}'),coalesce((p_list->>'no_cut')::boolean,false),coalesce((p_list->>'no_fit')::boolean,false),
     coalesce(p_list->>'source','manual'),(p_list->>'sdate')::date,p_by,p_by,
     chk,t.checked_by,case when t.id is not null then now() end,
     jsonb_build_array(jsonb_build_object('at',now(),'by',p_by,'what','List created','why',p_reason)
       || case when coalesce(p_list->>'replaces','')<>'' then jsonb_build_object('replaces',p_list->>'replaces') else '{}'::jsonb end)
     || case when t.id is not null then jsonb_build_array(jsonb_build_object('at',now(),'by',p_by,'what','Checked',
          'why','from template "'||t.name||'" rev '||t.rev||', checked by '||coalesce(t.checked_by,'?'))) else '[]'::jsonb end)
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
     length_mm=(e->>'length_mm')::numeric, width_mm=(e->>'width_mm')::numeric, qty=e->>'qty', unit_qty=e->>'unit_qty', material=e->>'material',
     material_other=coalesce((e->>'material_other')::boolean,false), edging=e->>'edging', edging2=e->>'edging2', note=e->>'note',
     snag_id=coalesce(e->>'snag_id',snag_id), removed_rev=null,
     status=case when (e->>'reset')::boolean then 'todo' else status end,
     status_by=case when (e->>'reset')::boolean then null else status_by end,
     status_at=case when (e->>'reset')::boolean then null else status_at end,
     released_at=case when (e->>'reset')::boolean then null else released_at end,
     changed_rev=case when (e->>'reset')::boolean then nrev else changed_rev end
    where id=ex.id   -- an unchanged line is left alone (its version and time don't move — other editors can tell what changed)
      and (coalesce((e->>'reset')::boolean,false) or ex.removed_rev is not null
        or row(ex.seq,ex.kind,ex.section,ex.part,ex.length_mm,ex.width_mm,ex.qty,ex.unit_qty,ex.material,ex.material_other,ex.edging,ex.edging2,ex.note)
           is distinct from row(coalesce((e->>'seq')::int,ex.seq),coalesce(e->>'kind',ex.kind),e->>'section',e->>'part',(e->>'length_mm')::numeric,
             (e->>'width_mm')::numeric,e->>'qty',e->>'unit_qty',e->>'material',coalesce((e->>'material_other')::boolean,false),e->>'edging',e->>'edging2',e->>'note')
        or (e->>'snag_id' is not null and e->>'snag_id' is distinct from ex.snag_id));
  else
   -- 3. new lines
   insert into list_lines(id,list_id,seq,kind,section,part,length_mm,width_mm,qty,unit_qty,material,material_other,edging,edging2,note,snag_id,src_line_id,added_rev)
    values(e->>'id',r.id,coalesce((e->>'seq')::int,0),e->>'kind',e->>'section',e->>'part',(e->>'length_mm')::numeric,(e->>'width_mm')::numeric,
     e->>'qty',e->>'unit_qty',e->>'material',coalesce((e->>'material_other')::boolean,false),e->>'edging',e->>'edging2',e->>'note',e->>'snag_id',e->>'src_line_id',nrev);
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
   check_req=case when isnew then check_req else chk end,                  -- (4 Nov) switch ON: an edit must be checked again
   checked_by=case when isnew then checked_by else null end, checked_at=case when isnew then checked_at else null end,
   log=case when isnew then log else log||jsonb_build_array(jsonb_build_object('at',now(),'by',p_by,
     'what',case when nrev>r.rev then 'Revision '||nrev else 'List edited' end,'why',p_reason)) end
  where id=r.id returning * into r;
 return jsonb_build_object('list',to_jsonb(r),'lines',(select coalesce(jsonb_agg(to_jsonb(x) order by x.seq),'[]') from list_lines x where x.list_id=r.id),'retired',retired);
end $$;
grant execute on function save_list_revision(jsonb,jsonb,int,text,text) to anon, authenticated, service_role;

-- The lists switch lives in the planner record's settings (listStore / listStoreAt). A tab still running OLD code saves
-- its whole settings object without those keys, which would quietly switch every screen back to the old lists. This
-- trigger keeps the switch whenever a save leaves it out, and only lets it move the way Migrate and Switch back move it:
--   off/'v1' -> 'migrating' -> 'v2' (or back to 'v1' if the migration stops);  'v2' -> 'switching' -> 'v1' (or back to 'v2').
-- Any other change (an old backup pasted back, an old tab's copy) keeps the stored switch.
-- Works whether the settings column is json or jsonb (Step 0 shows which): it compares as jsonb and writes back the same type.
create or replace function production_planner_keep_switch() returns trigger language plpgsql as $$
declare o jsonb := old.settings::jsonb; n jsonb := new.settings::jsonb; m jsonb;
  os text := coalesce(nullif(old.settings::jsonb->>'listStore',''),'v1');
  ns text := coalesce(nullif(new.settings::jsonb->>'listStore',''),'v1');
begin
 -- keep the stored switch when a save leaves it out, OR when the move is not one Migrate / Switch back makes
 if (o is not null and o ? 'listStore' and (n is null or not (n ? 'listStore')))
    or (n is not null and n ? 'listStore' and ns<>os and not (
         (os='v1' and ns='migrating') or (os='migrating' and ns in ('v2','v1'))
      or (os='v2' and ns='switching') or (os='switching' and ns in ('v1','v2')))) then
  m := (coalesce(n,'{}'::jsonb) - 'listStore' - 'listStoreAt')
    || case when o ? 'listStore' then jsonb_build_object('listStore',o->'listStore') else '{}'::jsonb end
    || case when o ? 'listStoreAt' then jsonb_build_object('listStoreAt',o->'listStoreAt') else '{}'::jsonb end;
  if pg_typeof(new.settings) = 'jsonb'::regtype then new.settings := m;
  else new.settings := m::json; end if;
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
drop policy if exists "snags add" on snags; create policy "snags add" on snags for insert to anon, authenticated with check (lists_writable());
drop policy if exists "snags edit" on snags; create policy "snags edit" on snags for update to anon, authenticated using (lists_writable()) with check (lists_writable());
-- Grants (30 Oct rule). No DELETE: a snag is cancelled, never deleted.
grant select, insert, update on snags to anon, authenticated;
grant all on snags to service_role;
revoke delete, truncate on snags from anon, authenticated;

-- Ticked snags → one snag list per project (type 'snag', deliver_by set), one line per snag.
-- Refuses the WHOLE transfer if any snag isn't 'raised', so two people can't transfer the same snag twice.
create or replace function snags_to_list(p_ids text[], p_deliver_by date, p_by text) returns jsonb language plpgsql as $$
declare s record; pid text; lid text; seq int; out jsonb:='[]'; bad text; lnid text; pname text;
begin
 perform lists_switch_on();
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
 elsif new.snag_id is not null and old.status in('cut','got-out') and new.status not in('cut','got-out') then
  -- unticked (a mis-tap): the snag goes back to "on a list"
  update snags set status='on-list', status_by=new.status_by, status_at=now() where id=new.snag_id and status='cut';
 end if;
 return new;
end $$;
drop trigger if exists list_lines_snag on list_lines;
create trigger list_lines_snag after update of status on list_lines for each row execute function snag_line_done();
```

---

## 2026-11-04 — Stores dockets + "Items sent" — PENDING, NOT YET RUN — Garry runs this AFTER the Stage 3 block above and BEFORE merging `feature/stores-dockets`

**What it does (plain English):**
- Adds a **Site address** to each project (`projects.site_address`). It is the default "deliver to" address on that project's dockets; each docket can change it.
- Creates two new tables: `stores_dockets` (one row per docket: number D26-0001…, project, customer, site address, delivery instructions, who made it and when, delivered / received by / date / signed name, or cancelled with a reason) and `stores_docket_items` (what went on each docket: WO, floor, unit, title, item, quantity, spec — the docket keeps its own copy, so a later list change never changes a docket).
- **Part quantities (Garry, 4 Nov):** each docket line records how many went (e.g. 10 of 20 taps). The database adds up what has been sent on live dockets, refuses to send more than the line's quantity, and only marks a stores line "got out" once the full quantity has been sent.
- Three database functions hold the rules (the app can only READ the docket tables; it can't add, change or delete rows itself):
  - `make_docket` — checks every item first and refuses the whole docket (nothing saved) if a line is waiting (release it first), not needed, already got out, already fully sent, or asked for more than is left. Two PCs sending the same taps at the same moment: the second one waits, then is told they're already on the first docket. Takes the next number for the year — two PCs never get the same number. A resend after a lost reply gives back the docket already made (no second docket). Free-typed items (e.g. spare handles not on any list) work whether the new cutting lists are switched on or not; items picked from cutting lists only work with the lists switched on.
  - `docket_delivered` — the signed docket came back: who received it on site (print name), the date, the name signed.
  - `docket_cancel` — a wrong docket is cancelled with a reason; it stays on record, marked CANCELLED. A delivered docket can't be cancelled. **Stores is asked "Did these items leave stores?" (Garry, 4 Nov):**
    - **Yes** — only the docket is voided: the items stay "got out" and still count as sent (they really left), and the "Items sent" report still lists them, marked "docket cancelled".
    - **No** — the items are still in stores: their quantities can be sent again, and a stores line this docket had marked "got out" goes back to "to pick".
    - (Added 4 Nov: `docket_cancel` gets a fourth setting `p_left` and `stores_dockets` a `cancel_left` column. If this block was already run on a test project, running it again drops the old three-setting `docket_cancel` and adds the column — safe to run twice.)
- Nothing is deleted. No DELETE permission for anyone using the app.
- Depends on the Stage 3 block (it uses `lists_touch()`, `lists_switch_on()` and the `projects`, `lists`, `list_lines`, `list_events` tables) — run that first.

**If you deploy the code without running this first:** the Stores screen's "Send to site", "Dockets" and "Items sent" buttons show "the docket tables aren't set up yet". Nothing else changes. Run this first anyway.

### Steps for Garry
1. Make sure the Stage 3 block above has been run (Table Editor shows `lists` and `list_lines`).
2. Supabase → WPF project → **SQL Editor** → **New query**. Copy everything in the grey box below, paste, **Run**.
3. Expected result: **"Success. No rows returned"**. A red error: stop and send a screenshot — do not merge.
4. Check: **Table Editor** shows `stores_dockets` and `stores_docket_items` (both empty), and `projects` has a `site_address` column.
5. Check: **Database → Functions** shows `make_docket`, `docket_delivered`, `docket_cancel`; **Database → Triggers** shows `stores_dockets_touch` on `stores_dockets`.
6. Safe to run twice (nothing is duplicated, no data touched). Tested twice in a row on a throwaway Postgres set up like Supabase, then the checks in `tests/stores-docket/pg-check.sql` (part quantities, two PCs at once, numbering, cancel, delivered, switch off) all passed. Re-tested 4 Nov after the cancel change ("Did these items leave stores?"): run twice on a fresh database, and once on top of the earlier version of this block — both passed.

```sql
-- ===================== STORES DOCKETS — runs AFTER the Stage 3 block =====================
-- Each project's site address: the default "deliver to" on its dockets (each docket can change it)
alter table projects add column if not exists site_address text;

-- One row per docket. Never deleted: a wrong docket is cancelled with a reason and stays on record.
-- project_id is blank when the cutting lists are still on the old store (free-typed dockets only): project_name is the
-- project / customer name as it was when the docket was made, so the docket prints the same even if a project is renamed.
create table if not exists stores_dockets(id text primary key, docket_no text not null unique,
  yr int not null, seq int not null,
  project_id text references projects(id), project_name text not null, customer text,
  site_address text, delivery_instructions text, note text,
  made_at timestamptz not null default now(), made_by text not null,
  status text not null default 'made' check(status in('made','delivered','cancelled')),
  delivered_at timestamptz, delivered_by text, received_by text, received_at date, signature_name text,
  cancelled_at timestamptz, cancelled_by text, cancel_why text,
  cancel_left boolean,                                                 -- (4 Nov) cancelled: did the items leave stores? true = only the docket was voided
  cid text,                                                            -- the PC's id for this "Make docket" tap: a resend is recognised
  version int not null default 1, updated_at timestamptz not null default now(), updated_by text,
  unique(yr,seq));
alter table stores_dockets add column if not exists cancel_left boolean;
create unique index if not exists sd_cid on stores_dockets(cid) where cid is not null;
create index if not exists sd_proj on stores_dockets(project_id, made_at);
create index if not exists sd_pname on stores_dockets(lower(project_name), made_at);
create index if not exists sd_upd on stores_dockets(updated_at);

-- One row per item on a docket. The docket keeps its own copy of the text (WO, floor, unit, item, spec), so a later list
-- revision never changes a docket. qty = how many of the line went on this docket (part quantities: 10 of 20);
-- a line's "sent so far" = the sum of qty on its ACTIVE items (a cancelled docket's items are made inactive).
create table if not exists stores_docket_items(id bigserial primary key,
  docket_id text not null references stores_dockets(id), seq int not null default 0,
  line_id text references list_lines(id), list_id text,
  kind text not null check(kind in('fit','buy','free')),
  wo text, floor text, unit text, title text, item text not null,
  qty numeric check(qty is null or qty>0), qty_text text, spec text,
  active boolean not null default true,
  got_out_at timestamptz);                                             -- set when THIS docket finished the line (marked it got out)
create index if not exists sdi_docket on stores_docket_items(docket_id);
create index if not exists sdi_line on stores_docket_items(line_id) where line_id is not null;

drop trigger if exists stores_dockets_touch on stores_dockets;
create trigger stores_dockets_touch before update on stores_dockets for each row execute function lists_touch();

-- Row level security: everyone using the app can READ dockets. Nobody using the app can add, change or delete rows
-- directly — dockets are only ever written by the three functions below, which hold the rules.
alter table stores_dockets enable row level security;
alter table stores_docket_items enable row level security;
drop policy if exists "stores_dockets read" on stores_dockets;
create policy "stores_dockets read" on stores_dockets for select to anon, authenticated using (true);
drop policy if exists "stores_docket_items read" on stores_docket_items;
create policy "stores_docket_items read" on stores_docket_items for select to anon, authenticated using (true);

-- Grants (30 Oct rule). Read only for the app; no DELETE for anyone using the app (a docket is cancelled, never deleted).
grant select on stores_dockets, stores_docket_items to anon, authenticated;
revoke insert, update, delete, truncate on stores_dockets, stores_docket_items from anon, authenticated;
grant all on stores_dockets, stores_docket_items to service_role;
revoke all on sequence stores_docket_items_id_seq from anon, authenticated;
grant usage, select on sequence stores_docket_items_id_seq to service_role;

-- make_docket: makes one docket in one step.
--  p_docket: {project_id (blank on the old store), project_name, customer, site_address, delivery_instructions, note, cid}
--  p_items:  [{line_id, qty, wo, floor, unit, title}]  — a stores / bought-in line from a cutting list (switch ON only)
--         or [{item, qty, wo, floor, unit, title, spec}] — a free-typed item (works with the switch ON or OFF)
--  Refuses the WHOLE docket (writes nothing) if any line is: missing, removed, on an archived list or a template, on
--  another project, not a stores / bought-in line, not needed, waiting (release it first), already got out, already
--  fully sent, or asked for more than is left to send. Reply: {ok:false, refused:[{line_id, why, left, dockets}]}.
--  Otherwise takes the next number for the year (D26-0001 …; two PCs never get the same one), saves the docket and its
--  items, and marks a stores line "got out" once its full quantity has been sent. Reply: {ok:true, id, docket_no, made_at}.
--  The same cid sent again (a reply lost in bad signal) returns the docket already made: {ok:true, dup:true, …}.
create or replace function make_docket(p_docket jsonb, p_items jsonb, p_by text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare it jsonb; l record; v_id text; v_yr int; v_seq int; v_no text; v_at timestamptz; bad jsonb:='[]';
  tot numeric; sent numeric; nsent int; want numeric; lids text[]; pid text; pname text; pcust text; v_cid text;
  dks text; k int:=0; got timestamptz; qt text; d stores_dockets%rowtype;
begin
 if coalesce(btrim(p_by),'')='' then raise exception 'say who is sending the docket'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then
  raise exception 'a docket needs at least one item'; end if;
 v_cid:=nullif(btrim(p_docket->>'cid'),'');
 if v_cid is not null then
  perform pg_advisory_xact_lock(hashtext('docket-cid:'||v_cid));        -- a resend waits for the first to finish …
  select * into d from stores_dockets where cid=v_cid;
  if found then return jsonb_build_object('ok',true,'dup',true,'id',d.id,'docket_no',d.docket_no,'made_at',d.made_at); end if;
 end if;
 pid:=nullif(btrim(p_docket->>'project_id'),'');
 pname:=nullif(btrim(p_docket->>'project_name'),'');
 pcust:=nullif(btrim(p_docket->>'customer'),'');
 if pid is not null then
  select name, coalesce(pcust,customer) into pname, pcust from projects where id=pid;
  if not found then raise exception 'that project is not in the database'; end if;
 end if;
 if pname is null then raise exception 'pick the project first'; end if;
 select array_agg(distinct x->>'line_id' order by x->>'line_id') into lids
  from jsonb_array_elements(p_items) x where nullif(x->>'line_id','') is not null;
 if lids is not null then
  perform lists_switch_on();                                            -- list lines only while the lists are on the new store
  if (select count(*) from jsonb_array_elements(p_items) x where nullif(x->>'line_id','') is not null)<>array_length(lids,1) then
   raise exception 'the same line is on this docket twice'; end if;
  -- lock order as apply_line_changes: the lists (id order), then the lines (id order). A second PC sending the same
  -- lines waits here until the first docket is saved, then sees those lines as sent.
  perform 1 from lists where id in (select x.list_id from list_lines x where x.id=any(lids)) order by id for update;
  perform 1 from list_lines where id=any(lids) order by id for update;
 end if;
 -- check every item before writing anything
 for it in select * from jsonb_array_elements(p_items) loop
  if nullif(it->>'line_id','') is null then
   if coalesce(btrim(it->>'item'),'')='' then bad:=bad||jsonb_build_object('line_id',null,'why','no-item');
   elsif coalesce(btrim(it->>'qty'),'')='' then bad:=bad||jsonb_build_object('line_id',null,'item',it->>'item','why','no-qty'); end if;
   continue;
  end if;
  select x.*, li.project_id as lpid, li.archived as larch, li.is_template as ltpl into l
   from list_lines x join lists li on li.id=x.list_id where x.id=it->>'line_id';
  if not found then bad:=bad||jsonb_build_object('line_id',it->>'line_id','why','missing'); continue; end if;
  select coalesce(sum(i.qty),0), count(*), string_agg(distinct dk.docket_no,', ') into sent, nsent, dks
   from stores_docket_items i join stores_dockets dk on dk.id=i.docket_id where i.line_id=l.id and i.active;
  tot:=case when btrim(coalesce(l.qty,'')) ~ '^\d+(\.\d+)?$' then btrim(l.qty)::numeric end;
  want:=case when btrim(coalesce(it->>'qty','')) ~ '^\d+(\.\d+)?$' then btrim(it->>'qty')::numeric end;
  if l.removed_rev is not null then bad:=bad||jsonb_build_object('line_id',l.id,'why','removed');
  elsif l.larch or l.ltpl then bad:=bad||jsonb_build_object('line_id',l.id,'why','not-live');
  elsif pid is not null and l.lpid is distinct from pid then bad:=bad||jsonb_build_object('line_id',l.id,'why','other-project');
  elsif l.kind not in('fit','buy') then bad:=bad||jsonb_build_object('line_id',l.id,'why','wrong-kind');
  elsif l.status='na' then bad:=bad||jsonb_build_object('line_id',l.id,'why','not-needed');
  elsif l.status='waiting' then bad:=bad||jsonb_build_object('line_id',l.id,'why','waiting');
  elsif l.status='got-out' then bad:=bad||jsonb_build_object('line_id',l.id,'why','got-out','dockets',dks);
  elsif tot is null then                                                -- "2x2", blank …: the whole line goes on one docket
   if nsent>0 then bad:=bad||jsonb_build_object('line_id',l.id,'why','sent','left',0,'dockets',dks); end if;
  elsif sent>=tot then bad:=bad||jsonb_build_object('line_id',l.id,'why','sent','left',0,'dockets',dks);
  elsif want is null or want<=0 then bad:=bad||jsonb_build_object('line_id',l.id,'why','bad-qty','left',tot-sent);
  elsif want>tot-sent then bad:=bad||jsonb_build_object('line_id',l.id,'why','too-many','left',tot-sent,'dockets',dks);
  end if;
 end loop;
 if jsonb_array_length(bad)>0 then return jsonb_build_object('ok',false,'refused',bad); end if;
 -- the next number for this year (Irish time): one PC at a time, so two PCs never get the same number
 perform pg_advisory_xact_lock(hashtext('stores_docket_no'));
 v_yr:=extract(year from (now() at time zone 'Europe/Dublin'))::int;
 select coalesce(max(seq),0)+1 into v_seq from stores_dockets where yr=v_yr;
 v_no:='D'||lpad((v_yr%100)::text,2,'0')||'-'||lpad(v_seq::text,4,'0');
 v_id:='DK'||replace(gen_random_uuid()::text,'-','');
 insert into stores_dockets(id,docket_no,yr,seq,project_id,project_name,customer,site_address,delivery_instructions,note,made_by,cid,updated_by)
  values(v_id,v_no,v_yr,v_seq,pid,pname,pcust,nullif(btrim(p_docket->>'site_address'),''),
   nullif(btrim(p_docket->>'delivery_instructions'),''),nullif(btrim(p_docket->>'note'),''),btrim(p_by),v_cid,btrim(p_by))
  returning made_at into v_at;
 for it in select * from jsonb_array_elements(p_items) loop
  k:=k+1; got:=null;
  if nullif(it->>'line_id','') is null then
   qt:=btrim(it->>'qty');
   insert into stores_docket_items(docket_id,seq,kind,wo,floor,unit,title,item,qty,qty_text,spec)
    values(v_id,k,'free',nullif(btrim(it->>'wo'),''),nullif(btrim(it->>'floor'),''),nullif(btrim(it->>'unit'),''),
     nullif(btrim(it->>'title'),''),btrim(it->>'item'),case when qt ~ '^\d+(\.\d+)?$' and qt::numeric>0 then qt::numeric end,qt,nullif(btrim(it->>'spec'),''));
   continue;
  end if;
  select * into l from list_lines where id=it->>'line_id';
  tot:=case when btrim(coalesce(l.qty,'')) ~ '^\d+(\.\d+)?$' then btrim(l.qty)::numeric end;
  want:=case when tot is null then null else btrim(it->>'qty')::numeric end;
  select coalesce(sum(i.qty),0) into sent from stores_docket_items i where i.line_id=l.id and i.active;
  -- a stores line that is still to pick becomes "got out" once its full quantity has been sent (bought-in lines keep
  -- their status: the docket item is their record)
  if l.kind='fit' and l.status='todo' and (tot is null or sent+want>=tot) then
   update list_lines set status='got-out',status_by=btrim(p_by),status_at=now() where id=l.id returning * into l;
   got:=l.status_at;
   update lists set locked=true, updated_by=btrim(p_by) where id=l.list_id and not locked;
  end if;
  insert into stores_docket_items(docket_id,seq,line_id,list_id,kind,wo,floor,unit,title,item,qty,qty_text,spec,got_out_at)
   values(v_id,k,l.id,l.list_id,l.kind,nullif(btrim(it->>'wo'),''),nullif(btrim(it->>'floor'),''),nullif(btrim(it->>'unit'),''),
    nullif(btrim(it->>'title'),''),coalesce(nullif(btrim(l.part),''),'(no name)'),want,coalesce(want::text,nullif(btrim(l.qty),'')),
    nullif(concat_ws(' · ',nullif(btrim(l.material),''),nullif(btrim(l.note),'')),''),got);
  insert into list_events(list_id,line_id,act,from_status,to_status,by,note,v_after)
   values(l.list_id,l.id,'docket',case when got is null then l.status else 'todo' end,l.status,btrim(p_by),
    v_no||' · '||coalesce(want::text,coalesce(l.qty,''))||case when tot is null then '' else ' of '||tot::text end,l.version);
 end loop;
 return jsonb_build_object('ok',true,'id',v_id,'docket_no',v_no,'made_at',v_at);
end $$;
revoke execute on function make_docket(jsonb,jsonb,text) from public;
grant execute on function make_docket(jsonb,jsonb,text) to anon, authenticated, service_role;

-- docket_delivered: the signed docket came back. Records who received it on site (print name), the date and the name
-- signed. A cancelled docket can't be marked delivered. Marking it twice changes nothing ({ok:true, dup:true}).
create or replace function docket_delivered(p_id text, p_received_by text, p_received_at date, p_signature_name text, p_by text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare d stores_dockets%rowtype;
begin
 if coalesce(btrim(p_by),'')='' then raise exception 'say who is marking the docket delivered'; end if;
 if coalesce(btrim(p_received_by),'')='' then raise exception 'type who received it on site'; end if;
 select * into d from stores_dockets where id=p_id for update;
 if not found then raise exception 'missing docket'; end if;
 if d.status='cancelled' then return jsonb_build_object('ok',false,'why','cancelled','docket_no',d.docket_no); end if;
 if d.status='delivered' then return jsonb_build_object('ok',true,'dup',true,'docket_no',d.docket_no,'received_by',d.received_by); end if;
 update stores_dockets set status='delivered',delivered_at=now(),delivered_by=btrim(p_by),received_by=btrim(p_received_by),
  received_at=coalesce(p_received_at,(now() at time zone 'Europe/Dublin')::date),signature_name=nullif(btrim(p_signature_name),''),
  updated_by=btrim(p_by) where id=p_id;
 return jsonb_build_object('ok',true,'docket_no',d.docket_no);
end $$;
revoke execute on function docket_delivered(text,text,date,text,text) from public;
grant execute on function docket_delivered(text,text,date,text,text) to anon, authenticated, service_role;

-- docket_cancel: a wrong docket is cancelled with a reason (never deleted). A delivered docket can't be cancelled; cancelling
-- twice changes nothing. Stores is asked "Did these items leave stores?" (Garry, 4 Nov) — p_left:
--  true  = they left: only the docket is voided. Its items stay active (they still count as sent, so the same taps can't be
--          sent twice) and every line keeps its status ("got out" stays got out). The report shows them as "docket cancelled".
--  false = still in stores: its items stop counting as sent, so their quantity can go on another docket; a stores line this
--          docket marked "got out" goes back to "to pick" (unless someone ticked it again since).
-- (4 Nov: the old three-setting version is dropped first, so running this block again is safe.)
drop function if exists docket_cancel(text,text,text);
create or replace function docket_cancel(p_id text, p_why text, p_by text, p_left boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
declare d stores_dockets%rowtype; lids text[]; l list_lines%rowtype; v_note text;
begin
 if coalesce(btrim(p_by),'')='' then raise exception 'say who is cancelling the docket'; end if;
 if coalesce(btrim(p_why),'')='' then raise exception 'give the reason for cancelling'; end if;
 if p_left is null then raise exception 'say whether the items left stores'; end if;
 select array_agg(distinct line_id order by line_id) into lids from stores_docket_items where docket_id=p_id and line_id is not null;
 if lids is not null then
  perform lists_switch_on();
  perform 1 from lists where id in (select x.list_id from list_lines x where x.id=any(lids)) order by id for update;
  perform 1 from list_lines where id=any(lids) order by id for update;
 end if;
 select * into d from stores_dockets where id=p_id for update;
 if not found then raise exception 'missing docket'; end if;
 if d.status='cancelled' then return jsonb_build_object('ok',true,'dup',true,'docket_no',d.docket_no,'left',d.cancel_left); end if;
 if d.status='delivered' then return jsonb_build_object('ok',false,'why','delivered','docket_no',d.docket_no); end if;
 update stores_dockets set status='cancelled',cancelled_at=now(),cancelled_by=btrim(p_by),cancel_why=btrim(p_why),cancel_left=p_left,
  updated_by=btrim(p_by) where id=p_id;
 v_note:=d.docket_no||' cancelled'||case when p_left then ' (items left stores)' else ' (items still in stores)' end||': '||btrim(p_why);
 if not p_left then update stores_docket_items set active=false where docket_id=p_id; end if;
 for l in select * from list_lines where id=any(coalesce(lids,'{}')) order by id loop
  if not p_left and l.status='got-out' and exists(select 1 from stores_docket_items i where i.line_id=l.id and i.got_out_at is not null
       and i.got_out_at=l.status_at) then
   update list_lines set status='todo',status_by=btrim(p_by),status_at=now() where id=l.id returning * into l;
   insert into list_events(list_id,line_id,act,from_status,to_status,by,note,v_after)
    values(l.list_id,l.id,'docket-cancel','got-out','todo',btrim(p_by),v_note,l.version);
  else
   insert into list_events(list_id,line_id,act,from_status,to_status,by,note,v_after)
    values(l.list_id,l.id,'docket-cancel',l.status,l.status,btrim(p_by),v_note,l.version);
  end if;
 end loop;
 return jsonb_build_object('ok',true,'docket_no',d.docket_no,'left',p_left);
end $$;
revoke execute on function docket_cancel(text,text,text,boolean) from public;
grant execute on function docket_cancel(text,text,text,boolean) to anon, authenticated, service_role;
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
3. Check one screen saves (incognito window).
4. **Within minutes, run the old-screen guard below** (approved by Garry 3 Nov 2026).
5. **Close and reopen every planner tab and phone** (office PCs, saw, stores, drivers, PMs, floor screen). After that, everything is on the new code.
Before step 1: key every planned week move into Cienapps, so the Export Changes list can start empty. Nobody moves weeks or presses "Mark as applied" between steps 2 and 4.

## 2026-11-03 — Old-screen guard — APPROVED by Garry, run on go-live day AFTER the new code is live (step 4 above)
PENDING. Never run it before the new code is deployed — every screen on today's code would get "Save failed". Try it once on a Supabase TEST project first. Full explanation: docs/PROPOSAL-old-tab-guard.md.
```sql
create or replace function production_planner_bump() returns trigger language plpgsql as $$
begin
  if old.id = 'main' and new.version is distinct from old.version + 1 then
    raise exception 'This planner screen is out of date - refresh the page' using errcode = 'P0001';
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end $$;
```
**Rollback order (important):** if the website ever has to go back to the old version, FIRST undo this guard (run the original Stage 1 `production_planner_bump` function above again), THEN put main back. The other way round, no screen can save.

Note: Stage 4 tightens the anon grants and policies above (the app will stop having open delete access).
