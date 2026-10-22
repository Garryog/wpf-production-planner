# WPF Production Planner — roadmap and decisions

## Build order (agreed 22 Oct 2026, after the full four-agent audit)
1. Stage 1 saving fix → go live with OFFICE + SAW + STORES only (2–4 named people, ~2 weeks).
2. Saw/Stores N/A + sheets panel (after re-test and re-review).
3. Stage 2 safer imports (incl. "shipped ≠ complete", A/C suffix matching, snag WOs not removed).
4. Safe before Stage 3: Zebra labels, Office "Material to order", Stores "Items sent" report, CNC calendar + forklift in their OWN new table.
5. Stages 3 + 4 designed and built TOGETHER (per-row tables with access rules from day one; private photo bucket; one login per person).
6. Roll out to drivers and PMs; then snags, "Snags & follow-ons" bin, per-item delivery proof.
7. Cutting-list templates, project material lists, locked revisions.
8. Fitters view / fitter management. Cienapps API bridge when available.
Rule: cap each release at one area of the floor. Nothing new is decided until the floor has used the last release.

## Decisions
- Cienapps "shipped" = left the factory only. The work order stays in the planner through delivery AND installation (fitters stage); only the planner marks it complete.
- Logins for the wide rollout: one per person (simple PIN per person), needed for drivers-see-own-runs, office-can't-tick-for-drivers, and the change log.
- Pilot group: office + saw + stores first.
### Saw/Stores release decisions (21 Oct 2026)
- Saw label printer: Zebra ZD420 (direct thermal, 203 dpi, 104 mm max print width; label size, connection and saw device TBC).
- Labels: per-line print AND a group print (print labels for all lines on screen / selected lines in one go).

### Stores report + Driver POD decisions (21 Oct 2026)
- Stores "Items sent" report: per customer/project, by date — date, WO, item/list, who got it out, delivered yes/no; print + Excel.
- Driver: tick + photo PER WORK ORDER (extra photos optional); photo gets a burned-in date/time stamp; driver name recorded. No typed name or signature for now.
- Drivers only see their own deliveries. Two drivers on one run: each picks their own name from the staff list; both recorded on the run; either can tick/photograph.

### Delivery proof decisions (21 Oct 2026, supersedes earlier POD note)
- Snags are the main delivery problem; full kitchens are usually fine unless the site isn't ready.
- Kitchens (full jobs): tick "Delivered to location" is enough; photo optional. "Site not ready" option with photo of where it was left.
- Snags: each snag item is its own line on the driver's run (own section whether on a kitchen run or a separate run). Per snag: tick + stamped photo in place + one-tap "handed to" name. "Couldn't place" = reason list + photo; logged on the run, assigned to nobody, but VISIBLE to PM (own projects), Production Manager (all) and Office (Deliveries tab).
- Driver's snag tick + photo automatically marks the snag "delivered" on the PM's snag table (raised → in production → on van → delivered with photo).
- Weekly summary per driver: snags delivered, placed vs couldn't place, reasons. Records are permanent; drivers can add, not delete. Office must not tick "delivered" on a driver's behalf.
- Proof of delivery visible to Production Manager and PMs.

### Future phase: Fitters view / fitter management (noted 21 Oct 2026 — not yet planned)
- Fitters get their own view. Delivered snags, with photo and site location / "handed to", must appear on the fitter's view for their project.
- Fitter management is a major area for the next phase after saving, saw/stores, cutting lists/snags, deliveries and CNC/forklift. Design the snag and delivery data so a fitter view can read it without rework.
- ZD420 spec confirmed (sheet from Garry): 203 dpi, 104 mm max print width, USB standard (Ethernet/Wi-Fi/Bluetooth optional), ZPL + EPL. It will be the DEFAULT printer on the saw's PC → use label-sized HTML print page + Chrome kiosk-printing (no dialog). ZPL via Browser Print only if barcodes need to scan.
- Label contents (confirmed 21 Oct): WO, project/customer, house or room, part name, L × W, material, edging, quantity. Per-line print + group print. No barcode requested. Label size still TBC.
- Missing items (N/A → WAITING), confirmed 21 Oct: one tap, no reason asked. Waiting rows surface on the Production Manager view (count per material, he chases) AND on an Office "Material to order" list (purchasing). Anyone on Saw/Stores releases via "Release all" per material. Dispatch with rows waiting: warn but allow (part-load warning); driver's run and delivery note must show what's missing.
- Incomplete deliveries (confirmed 21 Oct): a job ships with WAITING lines → driver's run shows "N items to follow" and the delivery note lists them for site. Job state "delivered, N to follow" (not complete). When the waiting lines are released and ticked done, they drop into the SAME bin as snags ("Snags & follow-ons") on Deliveries and the driver's run, as per-line items (project, apartment, item) with tick + photo + handed-to. Job is COMPLETE (board green) only when every line incl. follow-ons is delivered. Board: amber waiting → blue to-follow → green. Production Manager view gets a "To follow" count.

### Audit follow-up answers (22 Oct 2026)
- Snags: Cienapps's snag system isn't working, so the PLANNER owns snags end to end (raise → cutting list → delivery → closed). No Cienapps WO is required for a snag; if one exists later it can be linked, but the planner must never depend on it.
- Cutting-list revisions: unchanged lines keep their ticks; changed lines reset and are flagged so the saw sees exactly what changed.
- Driver photos: private (logged-in users only) from Stage 4.
- CNC sheet counts: Cienapps already works out sheets from m² (approximate). Use that figure from the Cienapps export as the sheet count for the CNC calendar and forklift view; the planner's own m²/5.75 calc is the fallback/cross-check for lines Cienapps hasn't counted. Johnny's sheet is the source of machine + date + material split.

### Decisions 22 Oct 2026 (before Garry's holiday 23 Oct – 2 Nov)
- Stage 1 go-live waits until Garry is back (3 Nov). Nothing merges to main while he is away; agents plan/build/test on branches.
- Shipped jobs move OFF the main board to a "Shipped" tab (kept until installation is complete; searchable; a job returns to view when it has follow-ons/snags).
- Cutting/fittings lists are the MOST CRITICAL part of the move to the planner. Production Manager must see: structured saving, a database of lists, create a new list, template lists per project (per type), pick a project's list and attach it to a work order — seamless.
- Templates are created/maintained by the Production Manager and the design office; everyone else picks and attaches.
- Authority while away: agents may BUILD the cutting-list system on top of the Stage 3 design (new tables, permanent line IDs) following the Architect's plan without further sign-off; Garry reviews plan + build + tests on 3 Nov.
- Holiday-week work order: (1) Architect plans cutting-list system + Stage 3 tables; (2) Stage 2 imports incl. Shipped tab; (3) build + test cutting-list system; (4) Saw/Stores re-test + Manager re-review; (5) labels if label size arrives.

### CNC planning decisions (22 Oct 2026)
- Two stages per job: PROGRAMMED (Johnny nests/programs it — his strike-through) and CUT (CNC operator ticks on the planner, per job per machine; = Cienapps "cut" stage).
- Machine assignment: Johnny decides, but the planner must plan by sheet count per machine per day AND by material colour — group same-colour jobs on a machine/day to minimise colour changes. Dates still matter.
- Cut-by date today = Cienapps due date minus 7 days.
- Capacity: 30 sheets/machine/day when all one colour; each colour change that day reduces it (3 colour changes → 26 sheets). Per-machine numbers adjustable in Settings; per-day overrides.
- Carry-over: unfinished sheets roll to the next day on the same machine, flagged "carried over".
- Johnny's sheet: read AUTOMATICALLY from SharePoint (Microsoft link / Power Automate), not manual upload.
