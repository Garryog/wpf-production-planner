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

## Garry's answers (12 Nov, later)
- **Q1 = (a):** office, Production Manager and PMs can raise a saw job.
- **Q2 = (a):** a simple stock list first. Garry adds where it must go: "we need to develop a system that will control project
  component stocks. the component will appear later on on a cutting list for a work order. on some projects we want to have a buffer
  of standard component that we can pull from as we make deliveries".
- Q3 (snag "needs cutting" makes the saw job) and Q4 (build order) not answered — ASSUMED the recommendations.

## Project component stock (Garry, 12 Nov) — design direction for the Architect, to plan before the stock list is built
So the simple list is built in a shape the full system can grow from:
1. **Stock is per project and per component** (a standard part: description, material, size, edging — the same fields as a cutting-list
   line), with a quantity on hand and where it is stored.
2. **In:** a "Bulk stock" saw job, when the saw marks it done, adds its quantities to that project's stock.
3. **Out:** when a work order's cutting list has a line that matches a stocked component, the list shows "N in stock — take from stock"
   and the person confirms; that line is then NOT cut again, stores picks it, and the stock goes down. Never taken automatically.
4. **Buffer:** per project and component a target buffer quantity; when stock falls below it the Production Manager and the PM see
   "below buffer — raise a stock job" (one tap makes the bulk saw job for the shortfall).
5. **History:** every in / out with who, when, which work order — so management can see what was made, used and what is left when the
   project ends (left-over stock report).
Open questions for Garry when this is planned: how a component is recognised as "the same" (exact match on description + size +
material, confirmed by a person the first time — recommended); whether stock can be shared between projects (recommended: no, moved
by hand with a note); who can adjust a count (recommended: stores + office, with a reason).

## Garry, 13 Nov 2026 — every new P-work order gets a CATEGORY
Garry's words: "when we create a new P-work order in planner. we need to give it a category. 1. for delivery - must be linked to a
project 2. for factory project stock must be linked to a project and a project kanban system that manages the project compenent, the
component that are being cut, cut and picked for delivery & 3. toilet cubicles."
- **Category is asked every time a P-number is made** (＋ New P-number in the list window, ＋ Saw job, New Work Order on the board) and
  cannot be skipped. It replaces "where it goes when cut" in rule 3 above. Shown as a badge wherever the job shows; changeable by
  office / Production Manager with a logged reason until the job is cut.
  1. **For delivery** — a project MUST be picked (customer = project). When done it is ticked for delivery and lands in the Deliveries pool.
  2. **Factory project stock** — a project MUST be picked. Never on Deliveries. Its components go onto that project's **component
     kanban board** (below).
  3. **Toilet cubicles** — its own category. ASSUMED until Garry answers: project optional (cubicle jobs are often one-off customers),
     goes on Deliveries when done like category 1, filterable on the board, saw and Shipped; uses the cubicles cutting list layout.
- **Project component kanban** (per project; this IS the "project component stock" system above, shown as a board): one card per
  component (description, material, size, edging, qty), columns **To cut → Being cut → Cut (in stock) → Picked for delivery**.
  Cards move by themselves from what people already do: the stock job's list sent to the saw = To cut; first saw tick = Being cut;
  saw marks the line cut = Cut (in stock), qty on hand goes up; stores picks it for a work order / docket = Picked for delivery, qty
  goes down, with the WO and docket number on the card. Buffer target and "below buffer" flag per card as in point 4 above. Read-only
  for PMs on site; office, Production Manager, saw and stores move cards only through their normal screens (no free dragging — ASSUMED).
- Existing P-numbers with no category: shown as "no category — pick one" to the office; never guessed.
- Questions for Garry: (1) cubicles — is a project needed, and do they go on the delivery board? (2) may anyone drag a kanban card by
  hand, or only through saw / stores ticks (recommended)? (3) can a "For delivery" P-job later be switched to stock, and the reverse?

## Garry, 13 Nov 2026 (09:09) — how project stock components are used and identified
Garry's words: "the project kanban items will appear on a cutting list down the line when they are being delivered, the saw and
dispatch will need to know they are down for delivery and need to be picked and sent on truck. they will be put on the WO cutting
list for the job that is going. the kanban stock will need to manage what is in stock and what is being consumed be wo. the project
component will need a code to ID them as a project stock component so the stock can be managed".
- **Component code:** every project stock component gets its own code, unique within the project, made by the planner when the
  component is first set up and never reused (proposed form: project short code + running number, e.g. "ASP-C014"; Architect to
  confirm with Garry). The code — not the description — is what identifies a stock component everywhere (replaces "exact match on
  description + size + material" above). Printed on the stock job's saw list and on the label for the stored parts.
- **On the WO cutting list:** when the work order that is going out needs a stocked component, the component is put on THAT work
  order's cutting list as a **"FROM STOCK"** line carrying its code and quantity (picked from the project's stock list in the list
  window, not typed). Supersedes point 3 "Out" above.
- **Saw:** sees the line marked "FROM STOCK — do not cut", so the saw knows it is already made and is going with this job.
- **Stores / dispatch:** the line is on their pick list for that work order as "pick from project stock" with the code and where it
  is stored; picked → goes on the docket and the truck with the rest of the job. The delivery card shows "includes project stock".
- **Stock control by work order:** kanban card per code shows on hand, **reserved** (on a WO list, not yet picked) and **consumed**
  (picked), with the list of work orders that took it and when. Putting a FROM STOCK line on a list reserves the quantity; the pick
  consumes it; taking the line off the list releases it. Asking for more than is free is refused with what is left and offers "raise
  a stock job for the shortfall". Buffer flag works on free stock (on hand − reserved).
- Kanban columns now: To cut → Being cut → In stock → Reserved for a WO → Picked / sent.
