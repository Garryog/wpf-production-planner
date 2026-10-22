# Plan: Cutting lists and Stage 3 data foundation (22 Oct 2026)

## Goal
Each cutting or fittings list gets its own records in the database instead of being stored inside the one big planner record. Every line keeps a permanent ID, so ticks stop moving or doubling up. On top of that, the Production Manager and design office keep templates and material lists for each project. The office makes a live list from a template and attaches it to work orders in four or five taps. Once the saw has a list it is locked, and any change creates a new revision.

## How this is phased
- **Planned:** Stage 3 lists tables, both plans below, and the tests.
- **Designed but not built:** deliveries and snags tables. Snags will point at `list_lines.id`.
- **Nothing reaches live data until Garry merges to `main` and presses "Migrate lists" himself.** The code is built so it runs exactly as today until that button is pressed.

---

# PLAN A â Data foundation

## Supabase SQL (run before deploying; Coder copies it into SUPABASE_CHANGES.md)
```sql
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

create table if not exists lists(id text primary key, project_id text references projects(id), name text not null,
  list_type text not null default 'house' check(list_type in('kitchen','house','room','other')), type_name text,
  is_template boolean not null default false, template_id text references lists(id), template_rev int,
  rev int not null default 1, locked boolean not null default false, sent_at timestamptz,
  wos text[] not null default '{}', no_cut boolean not null default false, no_fit boolean not null default false,
  saw_done_at timestamptz, saw_done_by text, fit_done_at timestamptz, fit_done_by text,
  source text not null default 'manual' check(source in('excel','manual','template','migrated')),
  sdate date, archived boolean not null default false, log jsonb not null default '[]',
  version int not null default 1, created_at timestamptz not null default now(), created_by text,
  updated_at timestamptz not null default now(), updated_by text);
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
  from_status text, to_status text, n int default 1, by text, at timestamptz default now(), client_at timestamptz, note text);

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

-- One status change per line, with the "done wins" rules applied by the database
create or replace function apply_line_changes(p_changes jsonb, p_by text) returns jsonb language plpgsql as $$
declare c jsonb; l list_lines%rowtype; w text; ok boolean; res jsonb:='[]';
begin
 for c in select * from jsonb_array_elements(p_changes) loop
  select * into l from list_lines where id=c->>'id' for update;
  if not found then res:=res||jsonb_build_object('id',c->>'id','ok',false,'why','missing'); continue; end if;
  w:=c->>'status';
  ok:= l.removed_rev is null and case
    when c->>'act'='release' then l.status='waiting'
    when w='cut' then l.kind='saw' and l.status<>'na'
    when w='got-out' then l.kind='fit' and l.status<>'na'
    when w='waiting' then l.status='todo'
    when w='todo' then l.version=(c->>'v')::int
    when w='na' then l.status in('todo','waiting')
    else false end;
  if ok then
   if c->>'act'='release' then update list_lines set status='todo',released_at=now(),released_by=p_by where id=l.id returning * into l;
   else update list_lines set status=w,status_by=p_by,status_at=now(),
        released_at=case when w='todo' then null else released_at end where id=l.id returning * into l; end if;
   insert into list_events(list_id,line_id,act,from_status,to_status,by,client_at)
     values(l.list_id,l.id,coalesce(c->>'act','status'),c->>'from',l.status,p_by,(c->>'at')::timestamptz);
  end if;
  res:=res||jsonb_build_object('id',l.id,'ok',ok,'status',l.status,'v',l.version,'by',l.status_by,'at',l.status_at);
 end loop; return res; end $$;
grant execute on function apply_line_changes(jsonb,text) to anon, authenticated, service_role;
```

The Coder writes three more functions into the same SQL block. These rules are fixed:
- **`list_attach(p_list text, p_wo text, p_on bool, p_by text)`** adds or removes one work order in one step, so two people attaching at the same moment can't wipe each other's work. It also writes a `list_events` row.
- **`list_set_done(p_list text, p_mode text, p_on bool, p_by text)`** sets or clears the saw or stores sign-off.
- **`save_list_revision(p_list jsonb, p_lines jsonb, p_expect int, p_by text, p_reason text)`** saves an edit or new revision, all in one go:
  1. If the list's version number isn't the one the editor started from, it stops with an error ("stale"). The app then reloads and redoes the comparison.
  2. If the list is locked or is a template, it saves a copy of the current lines into `list_revisions` and increases `rev` by 1.
  3. It adds new lines with `added_rev` set.
  4. It updates the content of existing lines. It only resets status to todo (and sets `changed_rev`) where the line is marked `reset:true`. **It never writes status otherwise**, so a tick that lands mid-edit can't be undone.
  5. Lines that have gone get `removed_rev` set. They are never deleted.

## Line statuses
| Status | Meaning |
|---|---|
| `todo` | Still to do. If `released_at` is set, it shows "MATERIAL IN â DO NOW" |
| `cut` | Done at the saw |
| `got-out` | Done at stores |
| `waiting` | The bench tapped N/A (material not in) |
| `na` | Not needed (marked by the office or PM only). Left out of counts and sheet totals |

"Got-out wins over N/A" is enforced by the database. A screen that's out of date can't park a line that's already done. Unticking only works if nobody has touched the line since. Header rows are stored as `kind='hdr'`, and `section` holds the heading the line falls under.

## Migration: one hard cut-over, reversible
I chose not to allow a mixed state. Running half the lists one way and half the other would make every screen check both stores.

The switch is a setting called `settings.listStore`:
- **Missing:** today's code runs unchanged.
- **`'v2'`:** everything uses the new tables.

The "Migrate lists" button (Admin PIN, Settings screen) does this:
1. Puts a full copy of the planner record into `planner_backups` with reason `pre-lists-v2`, and downloads a JSON copy to the PC.
2. Creates projects from the project names already in use (ignoring case and extra spaces). The customer comes from the work orders tagged to each list.
3. Copies each list using its existing ID. Lines get fixed IDs in the form `listId:seq`, so running it twice gives the same result. Each line's status comes from the old records:
   - ticked â cut or got-out
   - parked â waiting
   - released â todo with `released_at` set
   - both ticked and parked â done
   
   Old column F (`note`) goes into `edging`. Sign-off dates, no-cut/no-fittings flags, history and tagged work orders are copied onto the list.
4. Copies the old waiting history (`holdLog`) into `list_events`, matched to lists by name and project.
5. **Checks the counts:** lines, done and waiting per list must match exactly between old and new. If any differ, it stops and shows the report, and the switch is not set.
6. Sets `listStore='v2'` and `listStoreAt`. The old list data stays in the planner record untouched, as a frozen copy that is never written to again.

**Ticks from tabs left open on old code:** after the switch, the new code checks whether any old-format ticks or holds are newer than `listStoreAt`. If so, it copies them into the new tables (done still wins).

**Undo:** a "Switch back to old lists" button (Admin PIN) rebuilds the old-format data from the new tables, including lists created since the switch, then removes the switch. Templates and revisions stay in the tables.

## Saving lines
- Each tick, N/A or release joins a queue stored on that device (`wpfLineQ`) and shows on screen straight away with a small "not sent" dot.
- The queue is sent to `apply_line_changes` within 2 seconds, retried every 10 seconds, and sent again when the connection comes back. Closing the tab with unsent changes triggers a warning.
- If the database refuses a change, the app reloads that line and says why ("already cut by SeÃ¡n 10:42").
- List actions no longer call `sched()`. The main record's saving (Stage 1) is untouched.

## Keeping screens up to date
- I chose polling (asking the database every few seconds) rather than a live Realtime connection. Polling needs no new library and gets through factory firewalls.
- Saw, stores and the Lists screen ask every 10 seconds; other screens every 60 seconds.
- Each check asks only for records changed since the last one (`updated_at > last time minus 30 seconds`). The 30-second overlap catches stragglers, and records already held are skipped by comparing version numbers.
- On start-up the app loads every list's details, but lines only for lists that aren't finished. Lines for finished lists load when someone opens them.

## Saw and stores screens: minimal change
The existing helpers keep the same names and return the same shapes, so the screen code itself barely changes:
- `lists()` and `listRows()` read from the new data held in memory.
- `rowKey(r)` returns `r.id` when the line has one.
- `r.note` shows edging and note joined together.
- `rowTicks`, `holdsOf`, `listDone` read the line statuses.
- `setRowTick`, `holdRows`, `releaseHolds`, `dropHold`, `clearReleased`, `clearRowTicks`, `markListDone` now add to the line queue.

`listTableHTML`, `combineLists`, `sheetNeed`, `printLabels`, `workListFor` and `woReady` don't change, apart from showing the revision number.

---

# PLAN B â Cutting and fittings list system

## Who can do what
- The Production Manager view gets a **Lists** tab.
- A new **Design office** role (its own PIN) opens straight onto Lists.
- **Only Production Manager, Design office or Admin** can edit templates and project material lists.
- **The office** can import Excel files, type one-off lists, make lists from templates and attach them.

## Lists home
- **Search** across name, house, work order, customer and type.
- **Filters:** project, type, template or live, revision (any / revised), state (draft / live / done / archived).
- Lists are grouped by project.
- Each project has a header with: **Templates**, **Materials**, **+ New list**, **Import Excel**.
- The existing "Cutting lists needed" panel and the waiting-on-material panel stay at the top.

## Creating a list
- **Typed lists:** the improved editor (`openListEditor`) gets:
  - a Project picker
  - a Type field
  - a separate Edging field
  - material as a dropdown of the project's sheet materials, with **no free typing**
  - fittings spec picked from the project's "other" items, or "Otherâ¦" typed (the line gets an amber flag)
- **Excel import:** `parseListWorkbook` stays as it is. Column F now goes into Edging.
  - Material names not on the project list are shown for matching to a project material. The match is remembered as an alternative name (alias).
  - Anything left unmatched is saved with a "material not on project list" flag and counted on the Production Manager view. The saw still gets the list.

## Templates
- A template is a list marked `is_template`, with a type (kitchen, house or room) and a type name (for example "Type B 3-bed").
- Every save increases the template's revision number and keeps a copy in `list_revisions`.
- **Copy from another project:** pick the project, then the template. The copy gets new line IDs and belongs to this project. Any materials not on this project's list must be matched or added before saving.

## From template to live list
- From a work order in "Lists needed", tap Attach. Templates for the project matching the customer appear as buttons.
- Tapping one opens a preview with the work order already ticked. Other suggested work orders can be added with a tap.
- Then **Create & attach** and pick a name.
- The live list records which template and template revision it came from. Later template changes **never** change live copies. The list only shows "template is now rev 5 (this copy rev 3)" for information.
- **Missing-part check:** when saving a live list made from a template, the app warns about any template line that has been left out or has a lower quantity, and lists them. "Save anyway" asks for a reason, which goes in the list's history. The check runs again on every later edit.

## Locking and revisions
A live list locks the first time any of these happens:
- someone taps "Send to saw"
- any line is ticked or marked N/A
- its cut-by date falls today or on the next working day

Editing a locked list creates revision n+1 (reasons offered: drawing changed / site measure / error / other). The comparison (`diffLines`, a pure function the tests can check on its own) works in this order:
1. Lines where part, L, W, qty, material, edging and kind are all identical keep their ID and status.
2. Leftover lines with the same kind, part and section are paired in order. They count as **changed**: status resets to todo, and they're flagged CHANGED.
3. Lines only in the new version are **added** (NEW badge).
4. Lines only in the old version are **removed**. They're hidden from the saw unless already cut, in which case they show greyed as "REMOVED â part already cut, keep aside".

A change to the note only keeps the tick but is flagged. The saw card shows "REV 3 â 2 changed, 1 added, 1 removed". Printouts and labels carry "Rev n".

**The saw never cuts from an old revision:** screens only ever show the current lines, and a tick on a line changed by a new revision is refused by the database.

Re-uploading an Excel workbook for a locked list uses the same comparison.

## "Waiting for list" on the saw screen
A strip at the top shows each planned job with no list:
- work order and customer
- cut-by date
- **list due by** = the working day before the cut-by date, so the saw sees it a day ahead
- **owner** = the project's list owner (default "Production Manager")

Anything overdue is red.

## Tap targets
| Task | Taps |
|---|---|
| Make a list from a template and attach it | Attach â template â Create & attach â name = **4** |
| Attach an existing list to another work order | + WO â suggested WO = **2** |
| Copy a template from another project | Templates â Copy from â project â template â Copy = **5** (plus material matching if needed) |
| Revise a locked list | Edit â (changes) â Save revision â reason â name = **4** |
| Add a project material | Materials â + Add â name/kind â Save = **4** |

## What must NOT change
- Red/amber/green board status
- The saw seeing tomorrow's lists
- WAITING / N/A / Release all
- The sheets panel
- A4 labels, combined tables, print today / 3 days
- Re-cut with a reason
- Export Changes and Cienapps columns
- Orders and settings saving (Stage 1)

## Acceptance checks
1. Migrating a copy of the live data: every list's line, done and waiting counts match. Running it twice adds no duplicates.
2. Two identical lines: ticking one leaves the other unticked.
3. Phone marks a line N/A while the PC marks it cut (both offline, then reconnected): the line ends up cut.
4. A stale untick after someone else ticks the line is refused, with a message.
5. Saw tablet offline for 10 ticks, back online: all 10 reach the database exactly once.
6. Revising a locked list (change 1 line, add 1, remove 1 that was already cut): unchanged lines keep their ticks, the changed one resets with a CHANGED flag, the removed one shows "keep aside", and the rev number shows on screen, prints and labels.
7. Editing a template after making a live list from it leaves the live list unchanged.
8. Leaving out 2 template lines triggers the missing-part warning listing both.
9. The office can't free-type a sheet material. An unknown material in an Excel import gets flagged.
10. A job planned with no list appears on the saw strip with owner and due-by date.
11. Switching back to old lists gives the same ticks and holds as the new tables.
12. The full existing test suite passes (apart from items on ACCEPTED-FAILURES). The "identical lines share one record" failure is now fixed.
13. Main planner record size doesn't grow after the switch.
14. Checked in Chrome on Android, and on the Windows saw PC.

## Risks
- Tabs on old code after the switch: their ticks are rescued (see Migration). Still close every tab, as on Stage 1 go-live day.
- More database calls: they're small, and polling every 10 seconds on about 5 bench screens is fine.
- Wrong pairing in the revision comparison would wrongly reset or keep a tick. That's why it's a pure function with heavy tests.
- Material matching could slow down the first import of each project.
- PINs are convenience, not security, until Stage 4 brings proper logins.
- Safari on iPhone is still unsupported.

## Build steps (each one testable on its own)
1. SQL into SUPABASE_CHANGES.md. Extend the test mock (`tests/stage1/srv.js`) with the new tables and functions.
2. In-memory store, loading, and the "changed since" polling.
3. Line queue plus `apply_line_changes`.
4. The `listStore` switch and the adapter helpers; saw and stores tests run in both modes.
5. Migration with count check, then switch-back.
6. Projects and materials screens.
7. Lists home (search and filters).
8. Editor upgrade and Excel import to the new tables.
9. Templates and copy-from-project.
10. Create-from-template, attach, missing-part check.
11. Locking, `diffLines`, `save_list_revision`, revision banners and rev on prints/labels.
12. "Waiting for list" strip.
13. Design office role and the Lists tab for the Production Manager.
14. Full test run and attack tests.

## Decisions I made (for Garry to review on 3 Nov)
1. **Hard cut-over with a switch, not a mixed state:** simpler, and it can be undone.
2. **Polling instead of a live Realtime connection:** no new library, gets through firewalls. Realtime is switched on in the database for later.
3. **`na` means "not needed"** (office/PM only). The bench's N/A button sets `waiting`, as it does today.
4. **Column F is Edging**, and Note is a separate new field.
5. **A note-only change keeps the tick** but is flagged.
6. **A list locks** when it's sent, when anything is ticked, or when it reaches the saw's window.
7. **Imports with unknown materials are saved but flagged**, not blocked, so the saw is never held up.
8. **Template editing needs a Production Manager, Design office or Admin PIN**; Design office gets a new role.
9. **Old list data stays frozen in the planner record.** Archiving it is Garry's call later.
10. **No delete permission on the new tables.** Removed lines are marked, never erased.

---
