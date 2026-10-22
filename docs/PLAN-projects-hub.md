# Plan: Projects hub (extends PLAN-cutting-lists-stage3.md) â 22 Oct 2026

## Goal
Every project gets a home. The PM sets it up at award (locations in delivery order), the design office fills and signs off the spec, and PMs raise snags from their phone. The Production Manager turns ticked snags into a cutting list in one step. Work orders find their apartment almost automatically, and the saw sees a red warning when the spec isn't signed off.

## What changes in Plan A (small)
1. `projects` gets: project type, PM name, the Cienapps customer names / order numbers that belong to it.
2. `lists` gets `deliver_by` (date) and list type `snag`. **`listDueKey` uses the earlier of the WO due date and `deliver_by`.** Without this a snag list (no WO) never reaches the saw.
3. `list_lines` gets `snag_id`.
4. Migration (Plan A step 5) creates projects as before, as type Kitchens, marked "set-up incomplete".
Everything else in Plan A/B stands.

## Key questions (answer 3 Nov)
1. One spec per project, with variations written in "Other information"? **Recommend yes.** A spec per house type can come later.
2. The red flag shows ALL unsigned items, even ones that don't matter at the saw (e.g. Tap Type)? **Recommend yes**: simple, and it pushes sign-off.
3. A WO is never linked to a location without a person tapping confirm? **Recommend yes.** "Confirm all strong matches" is one tap for the batch.
4. Re-sequencing never moves planned weeks or delivery days by itself, only reorders and warns? **Recommend yes.**
5. Until per-person logins (Stage 4), a PM picks their name once per phone? **Recommend yes.**
6. Correct the Robes and Schools checklists below.

## Supabase SQL (same block as Plan A, run before deploy)
```sql
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

create table if not exists project_spec_items(id text primary key, project_id text not null references projects(id),
  item text not null, sort int not null default 0, is_extra boolean not null default false,
  value text, material_id text references project_materials(id),
  status text not null default 'not-specified' check(status in('not-specified','proposed','signed-off')),
  signed_by text, signed_at timestamptz, note text,
  check(status<>'signed-off' or (coalesce(trim(value),'')<>'' and upper(trim(value))<>'TBC')),
  version int not null default 1, updated_at timestamptz not null default now(), updated_by text);
create unique index if not exists psi_uq on project_spec_items(project_id, lower(item));

create table if not exists project_locations(id text primary key, project_id text not null references projects(id),
  block text, floor text, unit text, room text, seq int not null, target_week date, notes text,
  active boolean not null default true, version int not null default 1,
  updated_at timestamptz not null default now(), updated_by text);
create unique index if not exists pl_uq on project_locations(project_id, lower(coalesce(block,'')),
  lower(coalesce(floor,'')), lower(coalesce(unit,'')), lower(coalesce(room,'')));

create table if not exists location_history(id bigserial primary key, location_id text not null, project_id text not null,
  field text not null, old_value text, new_value text, reason text, by text, at timestamptz default now());

create table if not exists wo_locations(wo text not null, location_id text not null references project_locations(id),
  project_id text not null references projects(id), match_score int, how text check(how in('confirmed','picked')),
  active boolean not null default true, confirmed_by text, confirmed_at timestamptz default now(),
  version int not null default 1, updated_at timestamptz not null default now(), primary key(wo, location_id));

create table if not exists snags(id text primary key, project_id text not null references projects(id),
  location_id text references project_locations(id), where_text text,
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

create table if not exists project_events(id bigserial primary key, project_id text, entity text, entity_id text,
  act text, old jsonb, new jsonb, by text, at timestamptz default now());

do $$ declare t text; begin
 foreach t in array array['project_spec_items','project_locations','wo_locations','snags'] loop
  execute format('drop trigger if exists %1$s_touch on %1$s; create trigger %1$s_touch before update on %1$s for each row execute function lists_touch();',t);
 end loop;
 foreach t in array array['project_spec_items','project_locations','wo_locations','snags','location_history','project_events'] loop
  execute format('alter table %1$s enable row level security;
    drop policy if exists "%1$s read" on %1$s; create policy "%1$s read" on %1$s for select to anon, authenticated using (true);
    drop policy if exists "%1$s add" on %1$s; create policy "%1$s add" on %1$s for insert to anon, authenticated with check (true);',t);
 end loop;
 foreach t in array array['project_spec_items','project_locations','wo_locations','snags'] loop
  execute format('drop policy if exists "%1$s edit" on %1$s; create policy "%1$s edit" on %1$s for update to anon, authenticated using (true) with check (true);',t);
 end loop; end $$;

-- Grants (30 Oct rule). No DELETE: never delete production data.
grant select, insert, update on project_spec_items, project_locations, wo_locations, snags to anon, authenticated;
grant select, insert on location_history, project_events to anon, authenticated;
grant usage, select on sequence location_history_id_seq, project_events_id_seq to anon, authenticated;
grant all on project_spec_items, project_locations, wo_locations, snags, location_history, project_events to service_role;
grant usage, select on sequence location_history_id_seq, project_events_id_seq to service_role;
```
The Coder adds three database functions to the same block, each with `grant execute` to anon, authenticated and service_role:
- **`move_location(p_id, p_new_seq, p_target_week, p_expect_version, p_by, p_reason)`**: renumbers that project's sequence in one go, refuses with "stale" if someone else moved it first, and writes oldânew to `location_history`.
- **`snags_to_list(p_ids text[], p_deliver_by date, p_by)`**: makes one list per project (type `snag`, name "Snags <project> <date>", `deliver_by` set), with one line per snag (`snag_id` set), and sets each snag to `on-list` with `list_id`/`list_line_id`. **It refuses any snag that isn't `raised`**, so two people can't transfer the same snag twice.
- **Trigger on `list_lines`**: when a line with `snag_id` becomes `cut` or `got-out`, its snag moves `on-list` â `cut`.

`on-van`/`delivered`/`placed`/`couldnt-place`, `delivery_item_id`, `photo_path` and `handed_to` are filled by Stage 4 deliveries (columns exist now, nothing writes them yet). Spec and snag edits write a `project_events` row.

## Spec checklists (fixed per type, plus "+ Extra item")
- **Kitchens (Garry's 22):** Carcass Material Â· Carcass Edging Â· Exposed Material Â· Plinth on/Built in Â· Door and Drawer Detail Â· Door and Drawer Material Â· Door and Drawer Edging Â· Wall unit door material Â· Hinges Â· Handles Â· Drawer Construction Â· Worktop Style Â· Worktop Colour Â· Sink Type Â· Tap Type Â· Kicker type Â· Kicker Height Â· Appliance Details Â· Oven Details Â· Cornice Â· Kitchen Accessories Â· Other Information.
- **Robes/Wardrobes (DRAFT, Garry to correct):** Carcass Material Â· Carcass Edging Â· Exposed/End Panel Material Â· Door Type (hinged/sliding) Â· Door Material Â· Door Edging Â· Sliding Door System Â· Hinges Â· Handles Â· Internal Layout Â· Hanging Rail Â· Drawer Construction Â· Shelf Material Â· Kicker type Â· Kicker Height Â· Scribes/Infills Â· Bulkhead/Ceiling Detail Â· Mirror Â· Lighting Â· Headboard/Bedside Detail Â· Accessories Â· Other Information.
- **Schools/Fitted furniture (DRAFT):** Carcass Material Â· Carcass Edging Â· Exposed Material Â· Door and Drawer Material Â· Door and Drawer Edging Â· Worktop Material Â· Worktop Edge Profile Â· Hinges Â· Handles Â· Locks & Keying Â· Drawer Construction Â· Shelving (fixed/adjustable) Â· Kicker type Â· Kicker Height Â· Wall Fixing Â· Sinks/Taps Â· Tray Units Â· Fire/Certification Â· Safety (anti-ligature, soft-close) Â· Coat Hooks/Lockers Â· Labels/Signage Â· Other Information.
- The checklist lives in a settings constant. A new project gets one row per item, all "not specified".
- Material items (Carcass/Exposed/Door/Worktop material, Edging) are picked from `project_materials`. "Other information" is free text and never blocks sign-off.
- Rules: blank or "TBC" means not signed off (the database enforces this). Proposed means a value is entered but not signed. Signed off records who and when. Changing a signed-off value drops it back to Proposed.

## The "spec not signed off" flag
- **Computed** in the browser: `specOpen[projectId]` = the items not signed off, rebuilt when spec rows load (60-second poll). A WO finds its project through `projectOf(o)`: first its confirmed location, otherwise `o.customer` in `cien_names`, otherwise `o.orderNo` in `order_nos`. It's a lookup, with no database call per row.
- **Wording:** "SPEC NOT SIGNED OFF: Hinges, Handles, Worktop Colour +2". Red chip, never blocks anything.
- **Shows on:** board row, cutting-list card, saw and stores list headers, PM home, and printed lists as a red banner, with the project spec printed as a one-page block after the list (current values, signed or not).

## Location â WO matching
**Tokeniser** (`titleTokens`, a pure function with heavy tests):
1. Uppercase; change `_ - & /` to spaces; drop project-name words.
2. Read the tokens:
   - BLOCK/BLK X â block (keeps "C1.2").
   - L07 / 1ST FL / FLOOR 2 / GF â floor number (GF = 0, SF = 2, TF = 3).
   - APT/UNIT/NO/HOUSE n â unit.
   - KITCHEN(S)/ROBE(S)/WARDROBE(S)/HEADBOARD(S) â room, and a number straight after a room word is the unit.
   - A bare number after a floor token is the unit.
3. Ignore TYPE n, PART V, HANDED. Strip leading zeros.
4. The floor/unit already split out of the Reference column (`normaliseRow`) wins over the title.

| Title | block | floor | unit | room |
|---|---|---|---|---|
| ADERRIG BLOCK C1.2 _1ST_FL APT_31 PART V KITCHENS | C1.2 | 1 | 31 | kitchen |
| CROWN BLOCK G L07 ROBE 351 | G | 7 | 351 | robe |
| BLK A SF KITCHEN 31 TYPE 1 HANDED | A | 2 | 31 | kitchen |
| KILMURRY WARDROBES & HEADBOARDS L00 06 | â | 0 | 6 | wardrobe |

**Scoring** within the WO's project:
- Unit 50, block 25, floor 15, room 10. A unit mismatch scores 0.
- **Strong** = 60 or more AND at least 15 ahead of the next best.

**Screens:**
- An unlinked WO shows "NEEDS LOCATION". Strong matches show a single button "â Blk C1.2 Â· 1st Â· Apt 31" (**1 tap**), or "Pickâ¦" for the list.
- The project page has a "Needs location (N)" list and "Confirm all strong (N)".
- A WO can be linked to more than one location (titles like "Multiple"). Its sequence position is its earliest location.

**Re-sequencing:**
- The project's Deliveries list and PM home sort by location sequence.
- WOs already given a van or day that are now out of order get an amber "sequence changed" note. Nothing moves by itself.
- If a WO's planned week is after its location's target week: amber "behind programme".

## Screens
- **Project set-up** (PM, Production Manager, Admin): name, customer, type, PM, Cienapps customer names/order numbers (suggested from live WOs).
  - Locations: paste from Excel (columns block/floor/unit/room/target week) or import the programme file. Preview, then save in pasted order.
  - Reorder: drag on PC; on a phone, "Move toâ¦" with a position number (dragging on phones is fiddly).
  - Each location shows its linked WOs and a history.
- **Spec page** (design office, Production Manager): the checklist as a table â item, value (material dropdown or text), status, "Sign off" button (name and time). Shows "14 of 22 signed off". Print button.
- **Materials:** Plan A/B, unchanged.
- **Snags (per project, PM):** the list format â location (remembers the last one), Saw/Fit, item, L, W, qty, material dropdown, edging, note. Status column follows the snag through. A PM can cancel a raised snag (never delete).
- **Production Manager â Snags tab:** all open snags grouped by project, with tick boxes and "Tick all for project". "Create cutting list" asks for the delivery date and runs `snags_to_list` (cut parts go to the saw, fittings to stores, through the list's lines). Also shows: "Needs location" count, "Spec not signed off" projects, and couldn't-place snags.
- **PM home** (replaces `renderPM`; the old deliveries-by-customer stays as a section): own projects only. For each: spec x/22, sequence with linked WOs and stage, open snags by status, deliveries (existing), and a proof-photo placeholder ("photos arrive with Stage 4").

**Tap targets:**

| Task | Taps |
|---|---|
| Add a snag | Snags â + Snag â (type) â Save = **3**, or **4** if the location is changed |
| Transfer 10 snags to a list | Tick all for project â Create cutting list â date â Create = **4** |
| Re-sequence a location | drag (PC) / Move to â number â OK (phone) |
| Confirm a WO location | **1** |

## PMs on phones
- Chrome only, with big tap areas.
- One column on phones; no sideways scrolling in snag entry.
- Numbers use the number keypad; material is a dropdown, never typed.
- Every save shows "Saved" or "Not sent â will retry", using the same device queue as Plan A lines.
- PMs never see Cienapps steps, hours or values; their screen opens on their own projects.

## What must NOT change
- Everything in Plan B's list.
- Board colours and totals.
- Import preview/Apply.
- Snag WOs (WO-S) are still ignored by the import.
- Old `renderPM` deliveries information stays visible.

## Build order (Coder starts at 1 now)
1. Plan A step 1, with this SQL added to the same block, and the test mock extended for the new tables and functions.
2. Plan A steps 2â5 (store, line queue, switch, migration). Then `deliver_by` in `listDueKey`.
3. Plan A step 6 extended: project set-up fields and `projectOf()`.
4. Plan B steps 7â12.
5. Hub H1: locations (paste, sequence, `move_location`, history).
6. H2: `titleTokens` and scoring (pure, tests first), `wo_locations`, Needs location, confirm.
7. H3: spec page, checklists, flag everywhere, spec print.
8. H4: snags, `snags_to_list`, line trigger, Production Manager Snags tab.
9. H5: PM home.
10. Plan B 13â14, full test run plus hub attack tests.
11. Stage 4 (later): deliveries fill on-van â placed.

## Acceptance checks
1. The four example titles give the tokens in the table; "TYPE 1" is never read as a unit.
2. Importing 50 Aderrig WOs: strong matches confirm with one tap each (or one batch tap); the rest show "Needs location".
3. Two PCs reorder the same project at once: the second is told "stale", reloads, and nothing is lost. History shows both.
4. A spec item set to "TBC" can't be signed off; the board, saw card and print all show the red flag; the saw can still tick.
5. Changing a signed-off value drops it to Proposed and the flag returns.
6. Ten snags across two projects become two lists with `deliver_by`, and appear on the saw/stores lists on the day before.
7. Two people transfer the same snags at once: only one list is made.
8. Cutting a snag line moves the snag to "cut" on the PM's phone within 60 seconds.
9. A cancelled snag is kept, not deleted.
10. PM home shows only that PM's projects; works in Chrome on Android.
11. The full existing suite passes (apart from ACCEPTED-FAILURES).

## Risks
- Wrong auto-match: no link without a person confirming; the score is shown.
- Title formats vary per project: the tokeniser is pure and tested, and new formats get added as tests.
- PIN roles mean "own projects" relies on a name picked per phone until Stage 4.
- More polling: spec, locations and snags poll at 60 seconds, changed rows only.
- Snag lists without a WO bypass current saw rules: covered by `deliver_by` and tested.
- Safari on iPhone is unsupported.

## Decisions I made (review 3 Nov)
1. One spec per project; extras allowed.
2. Flag lists all unsigned items, everywhere, and never blocks.
3. Matching suggests only; a person always confirms.
4. A WO can link to several locations; the earliest sets its order.
5. Re-sequencing warns, never moves plans.
6. One snag list per project per transfer; saw and fittings lines in the same list.
7. Snag status "cut" also means "picked" for fittings.
8. Snags are never deleted; "cancelled" instead.
9. Phones use "Move toâ¦" instead of drag.
10. Robes/Schools checklists are drafts until Garry corrects them.
```

---
