# Plan: Project details (spec sheet), job-info edits, Projects & Materials in reach — 9 Nov 2026

Architect plan for Garry's 9 Nov request (he picked all four items). Built on `feature/project-details`, branched from
`feature/list-excel-template`. Everything here is Stage 3 (lists switch ON, `V2()`): with the switch off none of it is
reachable and the app behaves exactly as today. Only the spec sheet needs new database tables; the screens hide it quietly
until the SQL is run (same pattern as the stores-dockets probe).

## Goal
1. Every project has a **Project details** sheet (Garry's spec checklist). Blank or "TBC" = not signed off, shown red.
   The saw, stores and the cutting-list window see a red **SPEC NOT SIGNED OFF: …** chip; the printed list carries the spec.
2. **Floor, Unit, Title, Customer** can be corrected in the cutting-list window. The planner keeps the correction through
   Cienapps imports and lists it in **Export Changes** so Garry types it into Cienapps (Cienapps stays the master).
3. **Projects and Materials are one tap away**: beside the Project picker in the list window, and in plain view on the
   Cutting Lists page.
4. **Project Managers, the office and planning can edit/add materials** themselves (no Production Manager PIN). Saw,
   stores, drivers and the floor screen stay read-only.

## Key questions (built with the recommended answer — Garry can change any of them)
1. **Who can SIGN OFF a spec item?** A) Drawing office, Production Manager and Project Managers sign off directly; the
   office can type values but signing off asks for one of those PINs (**recommended**). B) Anyone who can edit. C) Drawing
   office only.
2. **Projects whose spec has never been filled in** show the red chip with every item (e.g. "SPEC NOT SIGNED OFF: Carcass
   Material, Carcass Edging, Exposed Material +18"). A) Yes, red from day one — that is the push to fill it in
   (**recommended**, matches the 3 Nov "show ALL unsigned items" answer). B) Only once someone has started the sheet.
3. **The Management view** (Garry's dashboard) and materials: A) read-only, like today, with the Admin PIN to edit
   (**recommended** — it's a viewing screen). B) Edit freely like the office.
4. **Changing the Customer of a job** in the list window also changes which project the job belongs to (customer = project).
   A) Allow it, with a warning line under the box (**recommended**). B) Floor, Unit and Title only; Customer stays Cienapps-only.
5. **Robes and Schools checklists** are still Garry's DRAFTS from 22 Oct (in docs/PLAN-projects-hub.md). Built as drafted;
   Garry to correct the lists (a one-line change each).

## Decisions taken (unattended run — reasonable reading, written down)
- D1 One spec per project, variations in "Other Information" (Garry's request). "Other Information" is free text, never
  blocks sign-off and is NOT in the red chip.
- D2 The checklist depends on the project type (Kitchens / Robes / Schools / Other=Kitchens list). Rows are created the
  first time an item is edited (no bulk insert for every project); an untouched item shows as "Not specified".
  "+ Extra item" adds a project-only item.
- D3 Material items (any item whose name has "Material", plus "Worktop Colour") are a drop-down of the project's sheet
  materials + "TBC" + "＋ Add new material…" (opens the Materials window). Edging items ("Edging"/"Edgeing") are a drop-down of
  the edging codes (`lsProjEdges`) + "Other…" (type). Every other item is typed.
- D4 Status rules (enforced in the DATABASE as well, so an old or stale screen can't break them):
  blank or "TBC" → *Not specified*; any other value → *Proposed*; *Signed off* records who and when.
  Changing a signed-off value drops it back to *Proposed* (signer cleared). "TBC"/blank can never be signed off.
- D5 Two PCs: every spec save is version-checked (like materials) — the second one is told "changed on another screen
  meanwhile — showing it as it is now" and nothing is overwritten. Two PCs creating the same item at once: one wins, the
  other is told and shown the saved value. Every change is written to `project_events` by the database (who, when, old,
  new) and shown as History in the sheet.
- D6 Job-info edits (item 2) live on the job in the planner record (no new column): the field itself takes the planner value
  (so it shows everywhere), and `o.pov[field] = {cien, by, at}` remembers Cienapps' value. Import: same value as the
  planner's → the override clears itself (logged); a different value → the planner's value is kept, the preview says
  "planner value kept (Cienapps: …)". Planner WOs (P-numbers) are edited directly, never listed as overrides (they aren't in
  Cienapps yet). "↺ Use Cienapps value" undoes an override. Who may edit: whoever can open the list window today.
- D7 Export Changes gets a second section **"Job details changed in the planner — enter these in Cienapps"** (WO, field,
  Cienapps value, planner value, who, when) and a second sheet "Job details" in the Changes Excel. It empties itself as
  imports catch up; it has no "Mark as applied" (the import is the proof).
- D8 Materials editing (item 4): new `lsMatEditOk()` — Project Managers, Office, Production Manager and Drawing office edit
  without a PIN; Saw, Stores, Drivers and Floor screen get "read-only on this screen"; Management keeps the PIN prompt.
  Templates and projects keep today's `lsEditOk()` rule (not part of this request).

## What changes — screens (wireframes in words)
**A. Project details window** (`lsSpecDlg(pid)`) — opened from the list window, the Cutting Lists page, the PM Projects tab,
the Production Manager / Drawing office Lists tab.
```
📝 Project details — Aderrig Ph2            Kitchens          14 of 21 signed off   [🖨 Print] [🧱 Materials]
┌───────────────────────────┬──────────────────────────────┬─────────────────────┬──────────────────────┐
│ Item                      │ Value                        │ Status              │                      │
│ Carcass Material          │ [18mm MFC White        ▾]    │ ✓ Signed off        │ M. Burke · 9 Nov     │
│ Hinges                    │ [Hettich Stock          ]    │ Proposed            │ [✓ Sign off]         │
│ Worktop Colour            │ [TBC                   ▾]    │ NOT SIGNED OFF (red)│                      │
│ …                         │                              │                     │ [History]            │
│ Other Information         │ [ free text, 3 lines    ]    │ (notes)             │                      │
│ ＋ Extra item  [name    ] [Add]                                                                        │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
```
A value saves when the box loses focus (or a choice is picked). Phones (< 700 px): one card per item, same boxes, big
buttons. Read-only screens show the same sheet without boxes or buttons.

**B. Cutting-list window** (`lsEditor`):
- Top line: red **SPEC NOT SIGNED OFF: Hinges, Handles, Worktop Colour +2** (tap = opens Project details).
- Beside the Project picker: **[✎ Project details] [🧱 Materials]**.
- Floor / Unit / Title / Customer become editable boxes. Changed boxes turn amber with "Planner: 3 · Cienapps: 2 ↺".
  Saving the list saves them (logged on the job: "Title changed in the planner: OLD → NEW (Cienapps: …) by Name").
**C. Saw / Stores list cards**: the red chip in the card header (next to the TBC chip). **Printed saw/stores lists**: red
  banner per list + a "Project details" block per project at the end of the print (all items, signed or not).
**D. Cutting Lists page** (office Lists tab, Production Manager, Drawing office): toolbar shows
  **[🏗 Projects] [🧱 Materials ▾ project] [📝 Project details ▾ project]**; each project group header shows
  "📝 Details 14/21" (red if any open) next to Materials / Templates.
**E. Project Managers view**: a third tab **🏗 Projects** — each active project with "📝 Details x/21" and "🧱 Materials".
**F. Export Changes**: the new "Job details" section and Excel sheet (D7).

## Data
- No change to `production_planner` columns. Jobs get an optional `pov` object (old data without it loads unchanged).
- New table `project_spec_items` + `project_events` (from PLAN-projects-hub.md), with a rules trigger and a history trigger
  — see the PENDING block in SUPABASE_CHANGES.md (runs AFTER the Stage 3 block).
- Polling: spec rows join the existing 10/60-second list poll (changed rows only) once the probe finds the table.

## Cienapps impact
Import: Floor / Unit / Title / Customer respect planner overrides (D6). Export: the new Job details section + sheet.
Week / step export unchanged.

## What must NOT change
Lists switch OFF = today's app. Board, import preview/Apply counts, week/step Export Changes, saw ticking, templates/project
editing rights, materials rules (aliases, active/retired, never deleted, sheet vs fitting), TBC line chips.

## Risks
Two PCs on the same spec item or material (version check); an import racing a planner edit (Apply re-checks the latest job);
an old screen saving a signed-off value (database trigger drops it to Proposed); 360 px phones; red chip everywhere on day
one (Q2); the SQL not yet run (sheet hidden, nothing breaks).

## Acceptance checks
1. A spec item set to blank or TBC can't be signed off (screen AND database); the list window, saw card, stores card and
   print show the red chip; the saw can still tick.
2. Changing a signed-off value drops it to Proposed and the chip returns; History shows who/when/old/new.
3. Two PCs edit the same spec item: the second is refused and shown the first one's value. Two PCs add the same extra item:
   one row.
4. Before the SQL: no spec buttons, no chip, no errors; materials and job-info edits still work.
5. Floor/Unit/Title/Customer edited in the list window show on the board, saw/stores, prints and labels; the job history has
   who/when/old/new; Export Changes lists it; the Excel has a Job details sheet.
6. Re-import with Cienapps' old value: the planner value is kept and the preview says so. Re-import with the planner's value:
   the override disappears from Export Changes.
7. PM, Office, Production Manager, Drawing office add/edit materials with no PIN; Saw/Stores/Driver/Floor can't.
8. 360 px phone: Project details, Materials and the list window header usable, no sideways scroll.
9. Full suite: no new failures outside ACCEPTED-FAILURES.

## Build steps
1. SQL PENDING block + fake database (tests/) for `project_spec_items` / `project_events` with the same rules; check the SQL
   on a throwaway Postgres.
2. `lsMatEditOk()` + PM Projects tab + Projects/Materials buttons on the Lists page and list window (items 3, 4).
3. Job-info overrides: editable boxes, `pov`, history, import rule, Export Changes section + Excel sheet (item 2).
4. Spec: probe, load/poll, `SPEC_LISTS`, `specOpen(pid)`, `lsSpecDlg`, sign-off, History (item 1).
5. Red chip in list window, saw/stores cards, prints; spec block on prints; x/21 on the Lists page and PM tab.
6. Full suite → Tester → fixes → Manager.

---
## Progress log

### 9 Nov 2026 (evening run 1) — all four items built, Tester round 1 fixed, Manager GO WITH CONDITIONS
- **Architect:** this plan. Built with the recommended answer to Q1–Q5 (unattended run) — Garry still to confirm them.
- **Coder** (8581e18, 3df4d16, 6275cf0, 816583e):
  - Pending SQL block "Project details" at the top of SUPABASE_CHANGES.md (`project_spec_items` + `project_events`,
    rules + history triggers, GRANTs, no DELETE). Run twice on a throwaway Postgres; tests/project-details/pg-check.sql
    ALL PG CHECKS PASSED (fresh database and upgrade of the earlier draft). Fake database: tests/project-details/dbp.js / srvp.js.
  - Item 1: Project details window (`lsSpecDlg`), checklist per project type, material / edging drop-downs, sign-off,
    un-sign, extra items, History, Print; red chip on the list window, saw and stores cards, Lists page, PM tab;
    red banner + spec block on printed saw/stores sheets. Hidden quietly until the SQL is run.
  - Item 2: Floor / Unit / Title / Customer editable in the list window (`woInfoEdHTML`, `jobInfoSet`, `o.pov`);
    import keeps the planner value and clears it when Cienapps catches up; job history; Export Changes "Job details"
    section + Excel sheet.
  - Item 3: 🧱 Materials and 📝 Project details on the Lists page toolbar and project headers; ✎ Project details and
    Materials beside the Project picker.
  - Item 4: `lsMatEditOk` — PM, Office, Production Manager, Drawing office edit materials without a PIN; Saw, Stores,
    Drivers, Floor read-only; Management keeps the PIN. PM view has a new 🏗 Projects tab.
- **Tester round 1** (attack1-merge / -spec / -phone / -pg): 1 High, 4 Medium, 6 Low. All fixed except 1c (an OLD-version
  tab running a Cienapps import overwrites a planner correction) → added to ACCEPTED-FAILURES (close every screen on
  go-live day), Garry to confirm.
- **Full suite** (HEAD 816583e, 181 files, one at a time): 3,309 pass / 38 fail. Baseline (feature/list-excel-template):
  3,206 pass / 26 fail. Every baseline failure is the same; the new ones:
  - attack1-merge 1c (accepted-failures, pending Garry);
  - 11 checks in OLD tests that test the rules Garry changed on 9 Nov — they expect the office to need a PIN to add a
    material (stage3 s1s3-screens ×2, attack2-screens G1/G7, s4-editor ×2, editor e5-columns ×3) and the Floor / Unit /
    Title / Customer boxes to be read-only text (stage3 coder-wo-cols ×2). **Next run: Tester rewrites these to the new
    rule** (office/PM add materials without a PIN; boxes editable), then re-run the full suite.
  - e7 redraw timing (also slow on the baseline run — two suites ran side by side).
- **Manager:** item 3 GO; item 4 GO (once Garry confirms Q3); items 1 and 2 GO WITH CONDITIONS (SQL first, Garry's answers
  to Q1/Q2/Q5, 1c accepted, every screen closed and reopened at release). Release order: list-excel-template first,
  then this branch; Stage 3 SQL, then Project details SQL.
- **Waiting on Garry:** Q1–Q5 above; yes/no on the 1c accepted-failure row.
- **Next run:** Tester updates the 11 old checks + attacks the Materials window at 360 px; full suite; Manager final verdict;
  then screenshots and the final summary.

---
# Part 2 — PM sequence, change requests, Cienapps upload, Johnny's pool, date tools (B5–B11) — 10 Nov 2026

Architect, unattended scheduled run, 10 Nov 2026. Garry's decisions B5–B11 of 9 Nov are recorded in docs/ROADMAP.md.
Builds on `feature/project-details` (Part 1 B1–B4 built) rebased on `feature/dates-deliveries` (Job A built).
Like Part 1 it is **Stage 3 only** (lists switch ON, `V2()`). With the switch off, or before the SQL below is run, none of
it shows and the app is exactly as today. Open questions use the recommended answer, marked ASSUMED (Garry to confirm).
**B11 date tools (step 12) are NOT built until Garry says yes to the wireframe at the end of this part.**

## Goal
Each project has a named Project Manager, and he keeps one list per project: every work order (kitchen, utility, quartz,
robes) in the order the site needs them, each with its required (delivery) date. He can drag rows, set dates in bulk,
spread them, paste the contractor's programme, or load the same Excel he uploads to Cienapps, on PC or phone. The next
two weeks are fixed: changes there go to the Production Manager to approve. Johnny gets one list of everything due in
the next three weeks or more, from every project, in order, and ticks each work order off as he processes it. The CNC
plan built later will read this list.

## Key questions — ASSUMED (recommended answer used; Garry to confirm)
1. **The PM list** = Settings → Staff, people ticked "PM" (the tick box is already there). A PM picks his name once per
   phone/PC and it is remembered until Stage 4 logins. Names are not typed freely (they must match the assignment).
2. **Who assigns a PM to a project:** the office and the Production Manager. A PM cannot claim a project himself.
3. **The fixed window is 14 CALENDAR days from today** (due today + 14 is fixed; today + 15 is free), moving forward
   every day. Alternative: 14 working days (about 3 weeks). Settings number, default 14 (allowed 7–30).
4. **Which date makes a job "fixed":** its build (due) date OR its delivery date falls within the window, overdue
   included. Moving a job INTO the window from outside also needs a request.
5. **Mixed changes** (e.g. "push from here down" over 3 fixed rows and 10 free ones): the 10 change now and the 3 go to
   the Production Manager as one request. The preview says so before Save.
6. **Who approves:** Production Manager only. The office and the Production Manager can still change fixed jobs
   directly: reason required, logged and counted the same way.
7. **Editing a required date sets the delivery date, and build date = delivery − 3 working days** (Job A `delivLead`).
   Both shown in the preview. A job with no delivery date shows its build date in grey.
8. **Waiting rows (no WO yet) are never "fixed".** One dated within 14 days shows red "due soon — no WO number".
9. **Date on a waiting row vs Cienapps' date when the WO arrives:** the PM's date wins, goes through the date rules and
   appears in "Dates to change in Cienapps". If it lands in the fixed window it becomes a change request automatically.
10. **Bank holiday / weekend in a spread or paste** → next working day. A single typed date → Job A's warning.
11. **Johnny's role:** new view "Pre-production", default PIN **1010**, changed by Admin like the others. He picks his
    name once (Staff tick "Pre-production").
12. **Pool horizon** = build due date within today + 7 × weeks (Settings, default 3, minimum 3): day 21 in, day 22 out.
    Overdue unprocessed jobs always in. A row leaves the pool once cut (step 6+), shipped or on hold.
    **Amber** = due within 21 days and not processed. **Red** = past cut-by and not processed.
13. **Cut-by** (CNC) = due − 7 calendar days, moved to the working day before if not a working day.
14. **Out of step:** a not-processed row is flagged when a row above it in Johnny's order has a cut-by more than 2 working
    days LATER (Garry's colour window), or same project + same date in the reverse of the PM's sequence.
15. **"Changed since you last looked"** is kept per person per device until Stage 4.
16. **Cienapps WO titles:** matching assumes the WO title carries the upload line's Name (e.g. "HOUSE TYPE B QUARTZ").
    **Garry: send 5 real WO titles + the upload lines they came from** so the matcher can be checked before go-live.
17. **Old jobs at go-live:** nothing added automatically. On a project's first visit the PM (or office) taps "Start the
    sequence from today's jobs (N)" — every live, not-shipped WO in due-date order. After that, new WOs are added on each import.
18. **Undo** (10 minutes, this screen only) puts dates and positions back. Jobs taken off vans are NOT put back on — listed
    "rebook these".

## Data design — new tables (decided: tables, not the planner record)
Why: rows, positions, requests and Johnny's ticks are edited by many people at once; projects already live in the Stage 3
tables; the planner record is already large (Job A cut `dueHist` to 30 for save speed). Version-checked rows plus database
rules, as for `project_spec_items`. **Dates of matched jobs stay where they are** (`o.dueDate`, `o.delivDate`, `o.dueHist` in
`orders`, written only by `moveDates`). The tables never hold a second copy of a job's date.

SQL: new PENDING block "PM sequence & pre-production" in SUPABASE_CHANGES.md, run AFTER Stage 3 and Part 1 (needs `projects`,
`lists_touch`, `lists_writable`, `project_events`). Re-runnable, GRANT lines, no DELETE, checked twice on a throwaway Postgres
(`tests/seq/pg-check.sql`).
- `alter table projects add column if not exists pm text;` `… seq_rules jsonb not null default '{}'`
  (`{follow:bool, offsets:{utility:int, quartz:int, robes:int, other:int}}` working days after the house's kitchen).
  Trigger `projects_pm_log` (after update when `pm` changes) → `project_events(entity 'project', act 'pm')`.
- **`project_seq`** (one row per future or actual WO): `id text pk` ('Q'+uid) · `project_id text not null references
  projects(id)` · `pos int` (1..n per project, DATABASE-set) · `state text not null default 'waiting' check in
  ('waiting','matched','removed')` · `wo text` · `floor, unit, product, name, descr text` · `kind text not null default
  'kitchen' check in ('kitchen','utility','quartz','robes','other')` · `children jsonb not null default '[]'` (CHILDREN 1–4,
  info only) · `line_key text` (DB-computed) · `req_date date` (waiting rows only) · `own_date boolean default false` ·
  `is_new boolean default false` · `src text check in ('upload','import','manual')` · `upload_id text`, `line_no int` ·
  `matched_at timestamptz, matched_by text, match_how text check in ('auto','confirmed','start')` · `why text` ·
  `version int default 1`, `created_at`, `created_by`, `updated_at`, `updated_by`.
  Indexes: unique `(upper(btrim(wo)))` where `wo is not null and state<>'removed'`; unique `(project_id, line_key)` where
  `line_key is not null and state<>'removed'`; `(project_id,pos)`; `(updated_at)`.
  Trigger `ps_rules` (before insert/update): NFKC + trim every text (trailing spaces). `line_key := upper(floor|unit|product|name)`
  spaces collapsed, when product or name present. `wo` set → `state='matched'`. INSERT takes
  `pg_advisory_xact_lock(hashtext('seq:'||project_id))` and sets `pos=max+1`. A change of `pos` is REFUSED unless
  `current_setting('wpf.seq',true)='rpc'`. `state` cannot go back to 'waiting' except via `seq_unmatch`. Plus `project_seq_touch`.
  Trigger `ps_log` (after): `project_events(entity 'seq')`, act add / match / unmatch / remove / restore / date / edit, old/new
  jsonb incl. `why`. Pos-only changes not logged (the functions log moves).
- Functions (security definer, `set search_path=public`, set `wpf.seq='rpc'` locally, project advisory lock, own
  `project_events` row with `why`): `seq_move(p_ids text[], p_after text, p_expect int[], p_by text, p_why text)` — block
  move under `p_after` (null = top), 'stale' if any version differs, renumber 1..n, clear `is_new`, log old→new pos.
  `seq_insert(p_project text, p_rows jsonb, p_after text, p_by text) returns jsonb {added, skipped:[{line_no,line_key,existing_id,why}]}`.
  `seq_match(p_id, p_wo, p_expect, p_how, p_by)` refuses if the WO is on another live row or the row is matched.
  `seq_unmatch(p_id,p_expect,p_by,p_why)` · `seq_remove(…,p_why)` (state 'removed', never deleted) · `seq_restore(…)`.
- **`seq_requests`**: `id text pk` · `project_id` · `kind check in ('date','move')` · `seq_ids text[] not null` · `wos text[]` ·
  `change jsonb not null` · `preview jsonb` · `why text not null` · `note` · `status default 'open' check in
  ('open','approved','refused','withdrawn','direct')` · `asked_by not null`, `asked_at default now()` · `decided_by`,
  `decided_at`, `answer` · `applied jsonb`, `applied_at` · `seen_at` · `version`, `updated_at`, `updated_by`.
  Trigger `sr_rules`: insert only 'open' or 'direct' (direct: decided_by = asked_by, decided_at = now()); `why` not blank;
  open → approved / refused (`answer` required) / withdrawn; `decided_at` set by the database; once decided only
  `applied`/`applied_at` (once) and `seen_at` change; insert refused 'open request exists' when `seq_ids` overlap another open
  request. Trigger `sr_log` → `project_events(entity 'req')`.
- **`seq_pre`** (Johnny): `seq_id text pk references project_seq(id)` · `wo` · `pre_key double precision` (null = default order)
  · `processed_at`, `processed_by`, `processed_src check in ('tick','sheet')` · `note` · `version`, `updated_at`, `updated_by`.
  Trigger stamps/clears processed_at; `pre_log` → `project_events(entity 'pre')`.
- RLS on all three: read anon/authenticated; insert/update `with check (lists_writable())`. Grants: select, insert, update on
  the three tables; execute on the six functions; all to service_role; revoke delete, truncate.
- **Planner record** (no new column / top-level key): settings `seqFixedDays` (14), `preWks` (3, min 3), `seqWaitWks` (3) →
  `fullSettings`, `settingsFrom`, `applyPlan`. `DB.pins.pre`. Staff role `'pre'`. `dueHist` entries gain optional `fx:1` and
  `rq:'<request id>'`; `src` can be `'pmseq'` or `'undo'`.
- **Browser**: `LS_T` += `project_seq:'sq'`, `seq_requests:'sr'`, `seq_pre:'sp'`; loaded/polled only when `SEQP.st==='ok'`.
  Probe `SEQP` = copy of `SPECP`/`specLoad` (`project_seq?select=id&limit=1`). Probe with a table, never a column (`specMissing`
  doesn't know 42703). `project_events` read only when History opens. Poll 10 s on sequence / pool / requests screens, else 60 s.
  localStorage: `wpfMe_pm`, `wpfMe_pre`, `wpfSeen_<role>_<name>`.

## How a sequence-row date edit flows (one path for every tool, B6/B7/B11)
1. The tool builds per-job targets `change.per[wo]={deliv:X, due:dmShiftWd(X,-delivLead())}`; offsets (B11d) add the house's
   other rows (not `own_date`). Waiting rows get `{req_date}` separately.
2. Preview: `moveDates(wos, change, reason, me, {src:'pmseq', frozenDays:seqFixedDays(), requestOnly:ROLE==='pm'})`. `dmRow` adds
   flags `'fixed'` (`seqFixedAt(o,to)`) and `'request-open'`. With `requestOnly`, `apply()` skips fixed rows into `res.needReq`.
   One-line summary `seqPreviewLine()` (B11h).
3. `pickReason(…, DATE_WHY)`, reason required. Save → `apply()` writes the free jobs exactly as Job A (week follows unless cut,
   off the van "rebook" unless loaded, `dueHist` src 'pmseq', `origDueDate`, `dueKeep`/`delivKeep` → Dates to change in Cienapps,
   saw/stores banner, A9 hold, `sched()`). Waiting rows: version-checked PATCH `req_date` + `why`.
4. `res.needReq` → one `seq_requests` row (date, open). Office/Production Manager: fixed rows applied with `fx:1` + one 'direct' row.
5. Approve: `seqDecide(id,'approved')` = version-checked PATCH `status=eq.open` (claim first; a second Production Manager is told
   "already approved by X — nothing done"), then re-run `moveDates` on TODAY's data with `{src:'pmseq', reqId}` (by "PM (approved
   by X)"), then PATCH `applied`. Preview shows "changed since asked" if the job moved meanwhile. A claim with no `applied` after
   2 minutes shows "Approved — not applied yet [Apply now]". Refuse = `answer` required, nothing moves; PM nudged until `seen_at`.
6. Reorders inside the window (fixed rows among themselves, or a row put above a fixed row) = a 'move' request; outside it
   `seq_move` runs at once.
7. Match hand-over (B10): after `seq_match`, if `row.req_date` ≠ the job's delivery date → steps 2–4 with reason
   {why:'Sequence date', note:'set before the WO existed'}, `requestOnly:true`.

## Screens (word wireframes)
**PM view** (`renderPMV2`): name strip "👤 John Burke · [Not you?]" (`seqMe('pm')`). Nudge bar (`seqNudgesHTML`): "4 rows no date ·
2 dates passed · 12 waiting for WO (3 over 3 wks) · 2 to place · 1 request answered". Tabs: 🚚 Deliveries · 🩹 Snags · 🏗 Projects ·
**🔢 Sequence** — only his projects unless "☐ All projects" (others read-only).
**Sequence page PC** (`seqPage(pid)`):
```
🔢 Aderrig Ph2 · PM John Burke   [⬆ Cienapps file] [📋 Paste programme] [🗓 Weeks] [⚙ Date rules] [📜 History] [↶ Undo 9 min]
To place (2): WO-2611-3 T09 14 "HOUSE TYPE C BED 2" → [✓ T09·14 W2 BED 2] [Pick…] [＋ Add at bottom]
Tick: [Whole house] [Whole block] [From here down]  3 ticked → [📅 Set date] [↔ Spread] [⏩ Push/pull] [# Move to…]
⠿ ☐ #  WO              Flr Unit Prod Name                  Required        Build    Progress                 Moved
⠿ ☐ 1  🔒 WO-2604-7    T09 12   K8   HOUSE TYPE B          Thu 19 Nov 🔒   16 Nov   list✓ proc✓ cut —        2×
⠿ ☐ 2  WO-2604-8       T09 12   K2   HOUSE TYPE B UTILITY  [ 3 Dec 📅]     30 Nov   list — proc —
⠿ ☐ 3  ⏳ no WO yet    T09 13   K8   HOUSE TYPE C          [10 Dec 📅]     —        waiting 1 wk
⠿ ☐ 4  ✋ request sent  WO-2604-9 … "pull to 18 Nov — Site ready early" [Withdraw]
⠿ ☐ 9  🆕 WO-2611-1 new — place in sequence  [▲][▼]
```
Fixed rows greyed; date and handle open "✋ Request a change". **Phone (360 px)**: one card per row with [▲][▼][# Move to][📅];
tick mode = sticky bottom bar; no drag; no sideways scroll.
**Cienapps file** (`seqUploadDlg(pid)`): project first → file → preview "18 lines → 16 new rows, 2 skipped (already in the
sequence: …)", "Add: ◉ at the bottom ○ after row [#]". Children as grey text. Nothing saved until [Save 16 rows].
**Production Manager**: tab **✋ Requests (N)** (`seqReqPage`) — cards with [✓ Approve] [✗ Refuse — reason], then last 30 decided.
Today banners "🏗 3 projects have no PM — assign", "✋ 2 change requests waiting".
**Office / Production Manager**: "PM ▾" per project in `lsProjectsDlg` / `lsProjHubHTML`, "Unassigned (N)" first, "🔢 Sequence".
**Pre-production view** (`renderPre`, role `pre`):
```
🗂 Pre-production — due by Tue 1 Dec (3 wks) [weeks: 3 ▾]  Filters: PM ▾ Project ▾ Material ▾ [Not processed ▾]  [✓ Seen all]
⠿ My# Due# WO          Project      PM      Flr Unit Title           Due     Cut-by  Sheets Material       Spec  List  Badges           ✓
⠿ 1   2    WO-2604-7   Aderrig Ph2  J.Burke T09 12   HOUSE TYPE B   19 Nov  12 Nov  14     H1146 Grey Oak  ⚠     ✓     🔒 fixed · 2×     [☐]
⠿ 2   1    WO-2603-2   Lucan        M.Kelly A1  4    TYPE A KITCHEN 18 Nov  11 Nov  12     W980 White      ✓     —     RED past cut-by  [☐]
⠿ 3   5    ⏳ no WO yet Aderrig Ph2  J.Burke T09 13   HOUSE TYPE C   ~7 Dec  …                                         ↻ changed since you looked
```
"Due#" = default order (due date, then PM sequence) beside his own order. Phone: cards with [▲][▼][✓ Processed], filters in a drawer.
**Week timeline** (`seqWeeksPage(pid|'mine')`): 8 board weeks + Later; header "Factory 340 / 350 h" (`wkHrs`/`wkCap`), red when
over; chips drag between weeks (shift by whole weeks, same flow); fixed weeks grey, a fixed chip opens a request. Phone: stacked
weeks, chip → "Move to week ▾".
**Scorecard** (`scorecardHTML`): "Late changes" column — that week's requests "3 (2✓ 1✗) + 1 direct" (only when `SEQP` ok).
**Export Changes**: "⚙ Processed by pre-production — set 5. WORK ORDER PROCESSED in Cienapps (N)" + Excel sheet "Processed";
clears itself when an import brings step 5+.

## What changes in code (names for the Coder)
- Roles: `'pre'` in `ROLE_LBL`, `pins()` (default '1010'), URL/localStorage role list, `startAutoRefresh`, `rolePicker` (V2),
  View PINs row (V2), staff role columns, `render()` → `renderPre` (the role list is copied in ~8 places — all of them).
- `seqMe(role)` from `staffFor(role)` once per device → `setWho` (`officeWho` only lists admin/office/prod). `pmMine(pid)`.
  `seqCanEdit(pid)`: pm + own project, office, prod. `seqFixedDays()`, `preWks()` (≥3), `seqWaitWks()`.
- Engine (`moveDates`/`dmTarget`/`dmDelivTarget`/`dmRow`): `change.per`, flags `'fixed'`/`'request-open'`, `opts.frozenDays`,
  `opts.requestOnly` → `res.needReq`, `opts.reqId` → `dueHist.rq`, `fx`. `dmHistHTML` labels. `woProgrammed(o)` = step 5 OR
  processed in `seq_pre`. `seqFixedAt(o,to)` = `min(dueDate, delivDate||dueDate, to) <= addDayISO(todayLocal(), seqFixedDays())`.
  `dateCanMove()` stays office/prod; PM edits go only through the sequence page.
- Sequence: `SEQP`/`seqLoad`, `seqRows(pid)`, `seqRowDate(r)`, `seqPage`, `seqBind` (HTML5 drag on PC; ▲▼/Move to everywhere),
  `seqMoveDo` → `lsRpc('seq_move')`, `seqStart(pid)`, `seqReconcile(pids)` after `applyImport` and on opening a sequence
  (confident → `seq_match` + hand-over; ambiguous → "To place"; no waiting rows in that house → insert at bottom `is_new`;
  23505 from another PC → reload silently).
- Upload: `seqReadUpload(aoa)` (header by content: ≥4 of qty/floor/unit/product/name/description/price, trimmed; no header → fixed
  27-column layout when column D looks like `^[A-Z]{1,2}\d{1,2}$` and column A is 1), `seqKind`, `seqLineKey`, `seqUploadDlg`.
- Matching `seqMatchFind(o)`: same project (`lsProjForCust`), floor + unit equal after normalising (upper, no spaces/punctuation,
  T09 = T9); score title words (product code +3, each non-generic name word +2; HOUSE/TYPE ignored); QUARTZ/UTILITY/BED/ROBE/KITCHEN
  and the BED number must AGREE; confident = one best ≥ 3 and next ≤ best − 2.
- Requests: `seqReqMake`, `seqDecide`, `seqReqPage`, `seqReqWithdraw`, `seqReqSeen`.
- Pool: `preRows()`, `preDefKey(r)` (due day, project, pos), `preKey(r)` = `pre_key ?? preDefKey`; drag = midpoint of neighbours;
  `preOutOfStep`, `preSeen`, `preTick(seqId)`, `preMaterial(o)`, `cncCutBy(o)`.
- Date tools: `seqDateDlg(rowIds, mode)` set / spread / push / paste, `seqSpread`, `seqOffsets`, `seqFollowOrder`, `seqPaste`
  (`parseDateIE`), `seqPreviewLine`, `SEQ_UNDO` (memory, 10 min, refused for a job changed since), `seqProgress(o)`.
- `renderExport` + Changes Excel: Processed section. `scorecardHTML`: Late changes.

## B8 — what the CNC view (built later) will read; design only, not built now
Per WO: `project_seq.pos`, `seqRowDate` and `o.dueDate`, `cncCutBy(o)`, `seqFixedAt(o)`, Johnny's `preKey`, `seq_pre.processed_*`
(+ step ≥ 5), `o.sheets` (Cienapps; m²/5.75 fallback), `preMaterial(o)`. **Phase 1 (linked):** the planner reads "CNC Schedule
2025.xlsm" (machine, material, strike-through); a strike-through fills `seq_pre` with `processed_src:'sheet'` (never clears a hand
tick); sequence + dates only set priority and flag "out of step". **Phase 2 (planner plans):** colour first within ±2 days, never
later than cut-by + 2, 30 sheets/machine/day less colour changes, carry-over. **Rule: fixed-window jobs are never re-ordered or moved
to another day by the auto-plan** — they keep Johnny's order and day as locked blocks placed first; only non-fixed jobs are grouped
by colour around them. Johnny's `pre_key` is the tie-break.

## What must NOT change
Lists switch OFF = today's app. Before the SQL = today's Stage 3 screens. Job A rules and every date-change entry point,
`dueKeep`/`delivKeep`, Export Changes date rows, "Mark as applied". Customer = project linking. Spec sheet, materials rights,
PM Deliveries content (only filtered). Import preview/Apply counts. No planner field written by the pool or sequence except through
`moveDates`. Never delete a row.

## Risks
Two PCs dragging (anchors), two Production Managers deciding (claim first), request vs direct change ("changed since asked"),
upload twice / two PCs (database skips duplicates). Old-version office screen moving a fixed job: allowed, not counted — close every
screen at go-live. Wrong auto-match (strict rule, Q16 sample, `seq_unmatch`). 300-row projects (previews capped 50, one `sched()`).
Bank holidays known to 2028 only — flag spreads into 2029. 360 px phones. `projects.pm` read before the SQL → one table probe.

## Acceptance checks
1. Before SQL / switch off: nothing new, no errors. After: probe shows everything.
2. Office assigns a PM; PM picks his name once; sees only his projects; "All projects" read-only; Unassigned listed.
3. Start the sequence; drag, ▲▼, Move to 1, whole house to top on PC and 360 px; History who/when/old→new.
4. Upload sample (27 cols, trailing spaces, C house with two W2): 1 row per line; again: 0 added, all skipped; no header: same.
5. Import: confident matches take over (position, date, history; PM date → Dates to change in Cienapps); ambiguous → To place;
   no waiting rows → bottom "new"; same import on two PCs → no duplicates.
6. Fixed window (today Mon 16 Nov 2026): 30 Nov fixed, 1 Dec free; moving a free job to 25 Nov needs a request; mixed push splits.
7. Approve applies with all Job A rules; two approvers → one applies, other told; refuse needs reason; scorecard counts.
8. Office direct change in the window: reason required, `fx`, counted "direct".
9. Pool: day 21 in, 22 out; weeks ≥ 3; amber/red/out-of-step; Johnny's drag leaves PM order; tick logged; import at step 5 =
   processed; tick at step 4 in Export Changes; PM date change → "changed since you last looked".
10. Tools a–j (after Garry's yes): spread "2 houses per week" from Tue 22 Dec 2026 skips 25–28 Dec; push 3 working days; offsets;
    follow-the-order; paste with 2 unmatched; timeline red over 350 h; preview line; Undo 10 min; nudges; progress chips.
11. Full suite: no new failures outside ACCEPTED-FAILURES. SQL twice on a throwaway Postgres: ALL PG CHECKS PASSED.

## Build steps (small commits, in this order)
1. SQL PENDING block + `tests/seq/pg-check.sql` + fake database routes. 2. B5: probe + load/poll, PM assignment, Unassigned list,
`seqMe`, `pmMine`, role `pre` plumbing + PIN + staff column, settings keys. 3. B6a: sequence page read-only + `seqProgress` + `seqStart`.
4. B6b: `seq_move` + History. 5. Engine: `change.per`, `fixed`, `requestOnly`/`needReq`, `reqId`/`fx`, `woProgrammed` (Job A tests
still pass). 6. B6c: row date edit (single, whole house), waiting-row `req_date`. 7. B10a: upload + preview + `seq_insert`.
8. B10b: `seqMatchFind` (tests first) + `seqReconcile` + To place + hand-over + "not in Cienapps yet?". 9. B7: requests, Production
Manager tab, claim-approve-apply, refuse, 'direct', nudge, scorecard. 10. B9a: pool read-only. 11. B9b: tick + Export Changes,
Johnny's order, out of step, changed-since. 12. B11 tools — ONLY after Garry's yes on the wireframe, one commit each.
13. B8 design final, nothing built. Full suite → Tester → fixes → Manager.

## B11 wireframe for Garry (sent 10 Nov for yes / no)
```
THE SEQUENCE TABLE (one per project, one row per work order, first to last)
 #  WO / status      Floor Unit Product Name                 Required date   Progress
 1  🔒 WO-2604-7     T09   12   K8      HOUSE TYPE B         Thu 19 Nov 🔒   list ✓ · processed ✓
 2  WO-2604-8        T09   12   K2      HOUSE TYPE B UTILITY Thu 3 Dec       list —
 3  ⏳ no WO yet     T09   13   K8      HOUSE TYPE C         Thu 10 Dec      waiting 1 week
 9  🆕 WO-2611-1 — new, place it in the sequence
 - PC: drag rows. Phone: ▲ ▼ and "Move to number…". Tick boxes for the tools below.
 - 🔒 = inside the next 14 days: tap = "Request a change" to the Production Manager.
a) BULK SET — tick rows, or "Whole house" / "Whole block" / "From here down", one date + one reason.
b) SPREAD — rows, start date, pace ("2 houses a week", "1 a working day", "every Tuesday"); skips weekends/bank holidays; preview.
c) PUSH / PULL — "everything from this row down: later by 3 working days" (or weeks); one reason; preview shows knock-ons.
d) DATE RULES per project (optional) — robes = kitchen + 5 working days, quartz = kitchen + 10; any row can be set by hand.
e) DATES FOLLOW THE ORDER (optional per project) — drag a row and it takes the date of the place it lands on.
f) PASTE THE PROGRAMME — two columns from the contractor's Excel (plot or WO, date); unmatched listed.
g) WEEK VIEW — weeks across the top, jobs as chips to drag; factory hours per week, red over 350 h; next 2 weeks grey.
h) BEFORE SAVING one line ("3 jobs come off vans, 1 already cut — flagged, 2 cutting lists move"); AFTER: Undo for 10 minutes.
i) PM HOME SCREEN — "4 rows with no date · 2 dates passed · 12 waiting for a WO number · 1 change request answered".
j) PROGRESS ON EACH ROW (look only) — list ready · processed by Johnny · cut · assembled · in store · on a van · delivered.
SAME RULES FOR EVERY TOOL: reason every time, full history, next 14 days need the Production Manager's OK, build week, van,
saw and stores follow the new date like any other date change.
```
