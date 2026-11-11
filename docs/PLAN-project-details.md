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

### 11 Nov 2026 — Garry's answers (replace the recommended defaults)
1. **Sign-off: Project Managers only.** (Built: the PM view signs off directly; any other screen needs the PM or Admin PIN, and the name is recorded.)
2. **Red until everything is filled and signed off.** A project can have **several specs** (e.g. different rooms / house types, or robes). Built: named specs per project, each with its own checklist type; the chip stays red while ANY active spec has an item not signed off ("Robes: Hinges" when there is more than one).
3. **Materials: PM, office and Management** add/edit (no PIN). Drawing office and Production Manager keep it too (Garry, 11 Nov). Saw, stores, drivers, floor read-only.
4. **Changing a job's Customer: Admin only** (Admin PIN each time). Floor, Unit and Title stay editable from the list window.
5. **Who fills in the spec: PM, office and Management** (+ Drawing office and Production Manager keep it). Robes / Schools lists stay as drafted until corrected.
6. **A spec is not applied to a cutting list.** The project keeps its materials list; a list made into a template keeps its materials. The spec only **gives the material choices for the cutting list**: the spec's chosen materials come first in the cutting-list Material drop-down ("From the project details").
7. Still open: yes/no on the ACCEPTED-FAILURES row attack1-merge 1c (old-version screen importing).

**Architect change (from answer 2/6):** new table `project_specs` (id, project_id, name, spec_type kitchens/robes/schools, sort, active — retired, never deleted). `project_spec_items` gets `spec_id`; one item name per spec. A project with no spec yet shows its default checklist (named after the project type) and the first edit creates it. Project details window: one tab per spec, "＋ Add spec" (name + type), rename / "not used any more". Print and the printed saw/stores sheets: one block per spec.

### 11 Nov 2026 (run 2) — Garry's answers built; Tester rounds 2–4; Manager GO WITH CONDITIONS, no Blockers
- **Coder** (16794ad, 2a22f09, 30ffedd, b35c7bb, e4861f2, 9db5b98):
  - Several specs per project (`project_specs`; tabs, ＋ Add spec, Rename, Not used any more / Bring back — never deleted).
    The project stays red until every item on every spec in use is signed off; the chip reads "Kitchens: … · Robes: …".
  - Sign-off: Project Managers only. On the PM screen directly; on any other screen the PM (or Admin) PIN is asked EVERY
    time and the Project Manager's own name is asked and recorded.
  - Marking a spec "not used any more" while it has open items also needs a Project Manager (Manager issue 1); the database
    writes spec add / rename / retire / bring-back to the history, keeps one spec in use per project (two PCs can't retire
    the last two) and refuses saves on a retired spec.
  - Materials and spec values: PM, office, Management, Drawing office, Production Manager — no PIN. Saw, stores, drivers,
    floor read-only. Materials window works on a 360 px phone.
  - Customer of a job: Admin PIN every time (also for ↺). Floor, Unit, Title unchanged.
  - The spec's materials come first in the cutting-list Material drop-down ("From the project details (spec)"); the other
    project materials are still listed below. Nothing is applied to a list or a template.
  - SQL block (now dated 11 Nov) run twice on a fresh throwaway Postgres and as an upgrade of the 9 Nov draft:
    tests/project-details/pg-check.sql ALL PG CHECKS PASSED; two-session retire race script OK.
- **Tester:** round 2 — the 11 old checks that tested the pre-9-Nov rules rewritten to the new rules (s1s3-screens,
  attack2-screens, s4-editor, e5-columns, coder-wo-cols: all pass); attack2-spec / -cust / -mats / -phone / -pg: 1 High
  (two PCs could retire every spec → project went green), 4 Medium, Lows. Rounds 3 and 4: all fixed and re-tested.
  Project-details files now: p1 0/30, p2 0/24, p3 0/28, attack1-spec 0/35, attack1-phone 0/10, attack2-spec 0/81,
  attack2-cust 0/14, attack2-mats 0/13, attack2-phone 0/11; attack1-merge 1 of 18 (1c).
- **Full suite** (HEAD 9db5b98, 188 files, one at a time): **3,472 pass / 27 fail**. Same known failures as the parent
  branch, plus: attack1-merge 1c (ACCEPTED-FAILURES, pending Garry); the 2,500-job timing check (passes alone); and two
  "WITH proposed guard" checks in stage1 t16-oldtab-overwrite — NOT from this branch: `origin/main` moved on 10 Nov
  (release/2026-11-10) and that test uses main as its "old screen"; it fails the same way on feature/list-excel-template.
- **Manager (final, 11 Nov):** item 1 GO WITH CONDITIONS, item 2 GO WITH CONDITIONS, items 3 and 4 GO. No Blockers.
  Conditions: (a) Garry's yes/no on 1c; (b) `origin/main` is 4 commits ahead (the 10 Nov release) — bring it into this
  branch and re-run the full suite before merging (merges cleanly, not yet tested together); (c) SQL first, in order:
  Stage 3 → Photo of a list → Project details; (d) merge feature/list-excel-template first, then this branch; (e) close
  and reopen every screen on go-live day, incognito check; (f) Admin and PM PINs must not be the built-in defaults.
- **Questions for Garry (multiple choice sent):** Q-A material drop-down: spec's materials first + the rest (built) or ONLY
  the spec's materials; Q-B Admin PIN as a backstop for sign-off (built) or PM PIN only; Q-C changing a PROJECT's customer
  in the Projects window: Admin only too?; 1c yes/no.
- **Note:** `origin/feature/project-details-v2` is a different piece of work by another scheduled run (not this branch).
- Screenshots (fake database): docs/screens-project-details/ (remake with `node tests/project-details/screens.js`).
- **Next:** on Garry's go-ahead — merge the 10 Nov release into this branch, full suite, Manager confirm. Nothing else to build.
