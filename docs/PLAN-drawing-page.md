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
