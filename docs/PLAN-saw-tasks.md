# Plan: Saw tasks for planner work orders — snags and bulk stock (Garry, 12 Nov 2026) — NOT BUILT YET

Garry: "there are some jobs, a lot of snag orders and bulk project stock components go through the beam saw and don't appear on
Johnny's CNC list. They will not have a Cienapps work order most of the time. for these planner work orders we need to be able to
generate a task for the saw (edger down the line) so they can appear on the saw screen as a cutting list to be done. some of these
types of work orders will be going on a delivery and some will be going into a factory stock".

## What exists today
- Planner work orders (P-numbers) can be made without Cienapps, and a cutting list tagged to a work order shows on the saw screen.
- Snags exist per project (Job B branch). Stock components have no home yet.

## Proposed rules (Architect)
1. **"＋ Saw job"** (office, Production Manager, PMs for their projects): type = **Snag** / **Bulk stock** / **Other**, project (optional
   for stock), description, needed-by date, and its cutting list (typed in the list window, pasted, or from Excel — same window as now).
   It gets a planner number (P-number); if a Cienapps WO turns up later with the same project + floor + unit, the usual one-tap merge.
2. It appears on the **saw screen** as a list to cut, in date order with the other lists, marked SNAG or STOCK. It is NOT on
   Johnny's CNC pool and does not count in CNC sheets.
3. **Where it goes when cut** — picked when the job is made, changeable until it leaves:
   - **Delivery** → ticked for delivery when the saw (later the edger) marks it done; it lands in the Deliveries "To plan" pool.
   - **Factory stock** → goes to a new **Stock** list (what, how many, for which project, date cut, where stored); never on Deliveries.
4. **Edger later:** the task carries its steps (Saw → Edger → Done). Only Saw is switched on now; the edger screen reads the same
   task when it is built.
5. Capacity: saw jobs carry no assembly hours unless typed in; shown on the board in their own "Saw only" group, not in the week totals.
6. Value: follows the No value / FOC rules (docs/PLAN-no-value-foc.md) — snags will mostly be FOC with a reason.

## Questions for Garry
- **Q1. Who can raise a saw job?** (a) Office + Production Manager + PMs — **recommended**; (b) office only.
- **Q2. Stock items:** (a) a simple list for now (what / qty / project / where stored / date), stock control later — **recommended**;
  (b) full stock in/out from day one.
- **Q3. A snag raised on the Snags page:** should "needs cutting" on the snag create the saw job automatically? **Recommended: yes**
  (one record, no retyping).
- **Q4. Order of building:** after the Shipped steps and Deliveries releases, before or after Job B? **Recommended: with Job B**
  (it needs the snags and project tables that go live with Job B).

## Database
A stock list needs one new table (PENDING block in SUPABASE_CHANGES.md with GRANT lines when built). Saw jobs themselves need none.
