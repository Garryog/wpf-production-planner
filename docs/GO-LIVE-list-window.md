# Go-live — the cutting list window (target Wed 18 Nov 2026)

Pull request: `feature/list-window` → `main`. **Merging is going live. Only Garry merges.**
Manager verdict, 15 Nov: **GO WITH CONDITIONS**; again **17 Nov, after Garry's 16 Nov additions: GO WITH CONDITIONS** — its one
"should fix" (template inserted in the middle of a × block) is fixed and tested. Conditions left: Garry's answers (questions
20–24 in `docs/PLAN-list-window.md`, all built on A) and the "close every screen" step.

## What changes for people
- **Making a cutting list is one path:** open it from the job → fill the rows → one big **Save** → "Saved ✓ — list is with the Saw & Stores" → Close.
- The **work order number and due date** are always at the top. **Floor, Unit and Title** each have their own box.
- **Nobody picks a project** when the work order is known — the project is the Cienapps customer, found or made by itself.
- Templates, an Excel file and an old list are behind ONE choice at the top: **Start from…**
- With no work order: pick the project, then the Work order list shows only that project's jobs, earliest due first
  (WO · floor · unit · title · due date; shipped and on hold left out; "has a list" marked).
- No Cienapps work order yet: "Find the Cienapps WO" looks it up by project + floor + unit. A **P-number** is only a confirmed
  last resort, shown purple "not from Cienapps".
- "＋ New material…" works first time. A renamed material shows as one board everywhere.
- Templates can be made and changed by the **Drawing office, Admin and the Production Manager**.
- The "can't keep a backup copy" bar says how to fix it; Settings shows "Storage on this device".

Added 16 Nov at Garry's request: **✓ Save & close**; labels one per Zebra label (101.6 × 63.5 mm); **👁 View the list** on the
Saved panel; the **Production Manager books the delivery date + van** from the window (the same booking as the Deliveries page);
any heading can be **× Multiply** (e.g. "Floor 2 × 4" — quantities for ONE, totals worked out); a template can come in × N with a name.

**Not in this release (as Garry chose 13 Nov):** "＋ Add cutting list" on the delivery card and the due badge on the Cutting
Lists home page; the automatic P-number → Cienapps WO merge. Each is its own small release after this one.

## Before merging — Garry
1. Answer the three questions at the end of `docs/PLAN-list-window.md` (20, 21, 22). The release is built on the recommended
   answers, so "A" to each means nothing more to build.
2. **No SQL. Nothing to run in Supabase.**
3. Merge Monday–Wednesday in working hours.
4. **Close the planner on every PC, tablet and phone first** — office, saw, stores, drawing office, PMs, driver. An old screen
   left open is NOT told to refresh by this release, and it can make a second list for a P-number house.

## Steps
1. Close every screen (step 4 above).
2. Garry merges the pull request on GitHub. GitHub Pages puts the new version live in a minute or two.
3. Open the live site in an **incognito Chrome window**:
   - open a job → the list window shows the WO, due date, Floor / Unit / Title;
   - type one row → Save → "Saved ✓ — list is with the Saw & Stores";
   - open the Saw screen → the list is there. Then archive that test list.
4. Check one phone in **Chrome** (not Safari).
5. Reopen the planner on every screen.
6. Tell Johnny / the Drawing office, the Production Manager, saw and stores: the new window, "Start from…", who can save
   templates, and that a job on hold in Cienapps gets no P-number until it is off hold.

## Rollback
- On GitHub, open the merged pull request → **Revert** → merge the revert (main goes back to `7147af2`). The previous version is live again in a minute or two.
- Nothing to undo in Supabase. Lists saved in the new window can be read by the previous version (tested with an old screen
  left open). A full rollback on the live site has not been rehearsed.
- A list with a × block saved in the new version reads correctly on the old version (totals are saved), but should not be
  EDITED on the old version (it would treat a sub-heading as the end of the × block).
- Never delete lists or materials to "tidy up" after a rollback.

## Tests (fake database only)
298 test files, 17 Nov: **about 7,660 pass / 129 fail**, no Critical or High left (15 Nov: 7,454 / 106 on 288 files). Every failing check is listed with its reason in
`docs/ACCEPTED-FAILURES.md` (the "15 Nov 2026 — final round" and "17 Nov 2026" sections hold the new ones, for Garry to accept or reject).
