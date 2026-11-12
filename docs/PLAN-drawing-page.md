# Plan: Drawing page (Garry, 12 Nov 2026) — NOT BUILT YET

Garry: "on import any drawing or drawing stage work orders need to be put into a drawing page. drawing management is a area for
future development down the line".

## Garry's answers (12 Nov)
- **Which steps:** "Drawing only go into separate drawing page. if step is at no site measure or further on steps it can go on
  capacity board" → only **1. DRAWING** (and WO-D drawing work orders) go to the Drawing page; 2. NO SITE MEASURE DONE onwards go on the
  Capacity Board as now.
- **Who sees it:** Office + Drawing office + PMs.

## Today (live)
The Cienapps import SKIPS new work orders at drawing stage and WO-D numbers ("not added — drawing"); they never reach the planner.
A job already on the board that Cienapps shows back at drawing is kept on the board and flagged.

## Proposed rules (Architect)
1. A new work order at 1. DRAWING (or a WO-D) is **brought in** and kept on a new **✏ Drawing** page — off the Capacity Board, the
   week totals and capacity, off Deliveries, and not asked for a cutting list. Same pattern as "On hold" jobs today (kept as a job
   with a marker, never a second record — so the no-duplicates rule holds and nothing new is needed in the database).
2. When a later import shows the job at step 2 or further, it leaves the Drawing page and lands on the Capacity Board by itself
   (scheduled by due date like any new job), logged "Left drawing — Cienapps: <step>".
3. Drawing page (read-only for now): WO, project / customer, floor, unit, title, due date, value, **days at drawing**; search; project
   filter; a PM sees his own projects first. Count shown on the tab. Phone and PC.
4. Import preview says "N drawing-stage jobs → Drawing page" instead of "not added".
5. Clear All Orders also clears them (they are jobs); Export Changes ignores them.

## Questions for Garry
- **Q1. A job already on the Capacity Board that Cienapps moves BACK to 1. DRAWING:** (a) stays on the board, flagged "back at
  drawing" as today — **recommended** (it may already be cut); (b) moves to the Drawing page unless it is already cut (step 6+).
- **Q2. Drawing-stage jobs with a due date in the next N weeks:** show an amber "due soon — still at drawing" warning on the Drawing
  page and the PM home? **Recommended: yes, 4 weeks.**

## Later (drawing management — not in this job)
Who is drawing it, drawing revisions, customer sign-off, link to the project spec sign-off, drawing-office workload.

## Risks / tests the Tester must attack
Old screens open on go-live day (a marker they don't know), re-import of the same file, a job going 1 → 2 → 1, WO-D numbers that later
become real WO numbers, 2,500 jobs, two PCs importing at once, phone at 360 px.

## Garry's answers (12 Nov, later)
- **Q1 = (a):** a job already on the Capacity Board that Cienapps moves back to 1. DRAWING stays on the board, flagged.
  Garry adds: "if the same work order appears in a more advanced step it need to go on capacity board" — i.e. as soon as an import
  shows a Drawing-page job at step 2 or later it moves onto the Capacity Board (rule 2 above; one job, never a second record).
- Q2 (amber "due soon — still at drawing") not answered yet — ASSUMED yes, 4 weeks, until Garry says otherwise.

## Built — 12 Nov 2026 (branch feature/drawing-page, cut from the live version)
- Import: a NEW work order at 1. DRAWING, or a WO-D, is brought in with a marker (`drawStage`) instead of being skipped. Shipped /
  invoiced ones are still left out. Preview says "N at drawing stage → ✏ Drawing page".
- The marker keeps it off the Capacity Board, week totals, capacity, Deliveries, lists-needed, the dashboards and the floor screens
  (same pattern as On hold). No new table, column or settings key — it is stored on the job.
- A later import with step 2 or further: the marker is cleared, the job is scheduled to its due week, logged "Left drawing". Same job.
  A WO-D stays on the Drawing page whatever its step (until Cienapps ships / invoices it).
- A job already on the board that goes back to 1. DRAWING stays on the board, flagged (Garry Q1 = a).
- ✏ Drawing tab for the office (count badge); a ✏ Drawing button for PMs and the Drawing office. Look-only: customer filter, search,
  days at drawing, amber "due in N days — still at drawing" within 28 days, red when the due date has passed.
- Test: tests/draw/d1-drawing-page.test.js (21 checks).
- Go-live note: a screen still on the old version does not know the marker and would show drawing jobs on its board — close and reopen
  every screen on go-live day (same rule as every release).
- Merge note for Job B: renderPMV2's strip and the render() lines for the PM / Drawing office roles will clash — keep both buttons.

## 12 Nov 2026 — progress
- Tester attack (tests/draw/attack1-drawing.test.js): 8 findings, all Medium / Low, fixed; 45/45. d1: 21/21.
- Full suite on the final code (182 files): only the three ACCEPTED-FAILURES files fail (sawstores attack-devices, attack-regress, stage1 t17).
- **Manager: GO WITH CONDITIONS.** No database change.
- Left as Low: the Plan Snapshot header counts drawing jobs (as it already does shipped ones); the import's summary line says
  "left drawing → Capacity Board" for a job that went straight from 1 to 9.
- Go-live checklist: [ ] look at the purple "At drawing stage" count in the first import preview before Apply (jobs that used to be
  skipped now come in) · [ ] close and reopen every screen (an old screen shows drawing jobs as unscheduled on its board) ·
  [ ] incognito check · [ ] tell the Drawing office and the PMs about the ✏ Drawing button. Rollback = main at cf70ab9 (drawing jobs
  already saved would then show as unscheduled on the board; nothing is lost; never delete them).
- **Merge note (must do):** the Deliveries branch adds filters that only skip On-hold jobs (PM page "coming up", In store). Whichever
  merges second must change those to skip drawing jobs too (`isOnHold` → `isParked`) and re-run tests/draw.
- For Garry: "Bring back to board" on a shipped WO-D returns it to the Drawing page (recommended, as built) or the board?
  Q2 (amber "due within 4 weeks — still at drawing") is built as assumed.
