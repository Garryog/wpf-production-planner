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
