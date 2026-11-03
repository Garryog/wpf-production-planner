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
- CNC auto-plan priority: COLOUR FIRST within a 2-day window (a job may move up to 2 days early/late to join its colour on a machine), then cut-by date; never later than cut-by + 2 days.
- Stock levels: not yet; forklift view shows need only.
- CNC floor screens: one PC/tablet per machine; the operator ticks CUT on that machine's screen.
- Stage 2 addition (22 Oct): a Cienapps import that brings a job in at "Assembly complete" or "Palleted" automatically puts it on the delivery board (delv=true; no van/day assigned; never untags; preview shows "N auto-tagged for delivery").

### Cienapps status ladder (exact wording, from Garry's screenshot 22 Oct 2026)
1. DRAWING · 2. NO SITE MEASURE DONE · 3. READY FOR UPLOAD · 4. READY FOR PRODUCTION · 5. WORK ORDER PROCESSED · 6. JOB CUT COMPLETE · 7. ASSEMBLY COMPLETE · 8. PALLETED · 9. JOB SHIPPED · 10. INSTALLED TO BE INVOICE · 11. COMPLETED AND INVOICED · 12. ON HOLD / DELETE
Rules: rank by the leading number. "Shipped" = step 9 only (left the factory → Shipped tab). Steps 10 and 11 = installed/invoiced → Shipped tab, marked installed/complete respectively. Step 12 ON HOLD / DELETE → never removed; flagged "on hold" and taken out of week totals until it changes. Auto-tag for delivery = steps 7 and 8. Step 5 WORK ORDER PROCESSED = Johnny has programmed it (CNC "programmed"); step 6 = CNC "cut". Note "2.NO SITE MEASURE DONE" has no space after the dot in Cienapps.
- (22 Oct) Step 12 ON HOLD / DELETE: move OUT OF SIGHT — into an "On hold" section of the Shipped tab (or its own "On hold" tab), out of the board and all totals; never deleted; comes back to the board automatically when the step changes.
- (22 Oct, Stage 2 R2) Going on hold takes a job off Deliveries (tag, van and day cleared, what it was noted on the job) — but a job already LOADED, on the road or delivered stays on Deliveries, the floor screen and the driver's run, with an "ON HOLD" marker. If one PC puts a job on hold while a driver loads it at the same moment, the load wins.
- (22 Oct, Stage 2 R2) Import preview re-shown because another PC changed the plan: rows for jobs changed on the other PC go back to "Keep" with no "Move" ticked — the planner decides again.

### Projects hub / Project Manager view (decided 22 Oct 2026 — plan WITH the cutting-list system, shared tables)
- Today the PM view has nothing editable. PMs need: snag tables per project, a project set-up page, delivery sequencing, and live project details (spec).
- Set-up: PM creates the project and its locations at award; design office fills the specification as drawings are signed off; both maintain materials.
- Specification: a FIXED checklist per project type plus extras — Garry will attach WPF's current "drawing details" table as the source for the checklist items. Each item: not specified → proposed → signed off (who/when). A WO whose project has unsigned items shows a RED "spec not signed off: <items>" flag on the board, cutting list and saw view; production is NOT blocked. Spec prints with the cutting list. (Root problem: items not signed off at drawing stage and information not reaching the factory floor.)
- Locations & sequence: list of units (block / floor / apt / room) in delivery order with a target week, from the main contractor's programme; PM reorders (drag) as it changes; full history. Sequences change constantly.
- WO linking: WO numbers arrive too late, so locations exist first. On import the planner SUGGESTS the location by matching the Cienapps title tokens (block, floor, apt no.); PM confirms with one tap or picks; unlinked WOs show "needs location". Once linked, the project sequence drives delivery order.
- Snags per project: PM creates → Production Manager transfers to a cutting list → delivery (photo) → fitter's view. Materials and locations come from the project set-up.
- PM view: own projects only — spec status, sequence, snags, deliveries + proof.
- Spec checklist source (Garry's "Project Details" table, 22 Oct): Carcass Material · Carcass Edgeing · Exposed Material · Plinth on/Built in · Door and Drawer Detail · Door and Drawer Material · Door and Drawer Edging · Wall unit door material · Hinges · Handles · Drawer Construction · Worktop Style · Worktop Colour · Sink Type · Tap Type · Kicker type · Kicker Height · Appliance Details · Oven Details · Cornice · Kitchen Accessories · Other Information (free text). Example values: "18mm MFC EG H1146 Grey Bardolino Oak", "1mm To Match Carcase", "Hettich Dowel Fix 105 (Made Doors)", "Gola Profile", "Hettich Stock", "Hafele Calder", "TBC" (= not signed off), "None", "Built in". A value of "TBC" or blank = not signed off → red flag. Items whose value is a material should be selectable from the project material list.

### Decisions 3 Nov 2026 (Garry back from holiday)
- Old-screen guard APPROVED (docs/PROPOSAL-old-tab-guard.md; SQL pending in SUPABASE_CHANGES.md, run on go-live day right after deploy; test once on a Supabase test project first).
- The 6-hourly "holiday work list" scheduled task is turned off. Weekly health check stays on.
- Cutting lists are the most important part of the roll-out and are not user friendly enough yet — Garry will go through them with Claude and decide changes before any more cutting-list build work.

## Progress log
### 2 Nov 2026 (scheduled run)
- Architect confirmed the cutting-list plan against the code; build notes and build order added to docs/PLAN-cutting-lists-stage3.md (fixed garbled characters in both plan files).
- Saw/Stores re-test: Garry's three rules all pass (N/A → Waiting, sheets = m² ÷ 5.75 + 10%, never both got-out and missing). New file tests/sawstores/retest-nov.test.js found 5 smaller bugs (combined list qty "2x2" shown as 0; combined list counts already-cut lines; "MFC White" vs "mfc white " split in the waiting book; stale "Release all" brings back a finished list; per-line Release button off-screen at 360px).
- Assumption: Office "Material to order" list is step 4 of the build order (after this release), not part of Saw/Stores — not built now.
- Later the same day: Coder fixed all 5 (d3a8f00, 7f195fa, c5de45b, 5af0656, 652aa3b), then the Tester's follow-ups (Print today shows cut lines as done 54081f0; odd spacing/accents in board names count as one material 9472be7, a8b2fef; same-named houses keep their own quantities 122c3c0). Saw/Stores tests: all pass except the 2 already on ACCEPTED-FAILURES; 3 Low left in retest-nov3 (see below).
- Test safety: some old soak tests were trying to reach the live Supabase address when pages closed mid-save (all blocked by the sandbox; nothing reached it). tests/harness.js now stops every such attempt (17c715e).
- **Manager re-review, Saw/Stores (this branch = Stage 1 + Stage 2 + Saw/Stores): GO WITH CONDITIONS** — run the Stage 1 SQL first, close every tab and phone on go-live day, Garry signs off ACCEPTED-FAILURES, and decides whether "Material to order" (office list) can wait for build step 4.
- Cutting-list system (Stage 3) is on its own branch `feature/cutting-lists` — see the Progress log there.
- Low items left for Garry to decide: should "2440MM", "2440 mm" and "2,440" merge with "2440" in the combined list? (totals are already right).
- Next: tidy the 3 Low combined-list items; Zebra labels still waiting on the label size.

### 3 Nov 2026, early morning (scheduled run, session …gUo5CSL2Xqk47vmJY)
- **Two scheduled runs worked on these branches at the same time again** (this one and session …xiu7cMgHZKcEhisJ2m). One commit (d512da9) had to put back a test file the other run deleted. This run stopped making code changes once it saw that. Garry: please make sure only one copy of this scheduled task is on.
- Coder: Q2 Medium fixed (a lost-reply fold no longer brings back a tick the office removed after a Switch back, 1b7189a); diffLines unknown/duplicate ids become new lines (0078d14); "Release all" names every refused line, up to 6 (6e1aec3); park-then-release offline is now sent in order (f0b272b); combined-list labels: "House 1 (2)", look-alike names, "constructor"/"__proto__" houses and lists with no name (c02ea0d, c071581).
- Tester round 7 found the same "zombie tick" on the LIVE save path (switch off, also on main today): saw's save lands but the reply is lost, office unticks, the saw's retry puts the tick back (tests/stage1/t10). Coder added a save check: after a lost reply the screen re-reads the database for up to ~4 s to tell whether its save landed (c584e01, 4447f05, 076212e); the other run added save tags (7cfaf3b, 55b7ad9, 2e7fbcb) and a "Leave page?" warning while a save is being checked (564661a). Important warnings now stay on screen in an amber box until closed (02d4465, 5406bdb, 91753d3).
- Tester rounds 7–9: soaks clean (t1, t1-trace, t9: 0 of ~6,000 unticks came back). Sequential full suites at round 9: stage2-imports 1,005 pass / 10 fail; cutting-lists 1,844 / 16. All failures are the known ones (ACCEPTED-FAILURES, G4b "2440MM", P5) plus: amber box on phones hides/clips older warnings and they don't return after a "Saved" note (attack9-box B3/B8); t12 D6 (office unticks during the saw's outage) — the other run's save tags aim at this, Manager saw it pass at 2e7fbcb.
- R1b (attack3-switch) rewritten to wait for the save; it now passes — its row can come off ACCEPTED-FAILURES once Garry agrees.
- **Manager (reviewed at 2e7fbcb): stage2-imports GO WITH CONDITIONS — keep the new save code** (the old code fails t10 3/3). Conditions: Coder keeps the save on the "may have landed" list in the `saveCheck` 250 ms case; test the save check once against a Supabase TEST project (never the live row); freeze the branch (one session only); Garry signs off ACCEPTED-FAILURES and answers G4b; Stage 1 SQL first; close every tab; tell staff to press "Stay" if asked "Leave page?". No new SQL. **Cutting lists: NO-GO for go-live for now** (merge 2e7fbcb, fix the amber box B3/B8, then rehearse the migration on a test project).
- Process note (Manager): the core save code changed 7 times this run without the Architect updating the plan — next run, Architect writes up the save-check design in docs before more changes.
- Zebra labels: skipped — label size still not recorded in the repo.
- Waiting on Garry: switch off the duplicate scheduled task; a Supabase test project (for the save check and the migration rehearsal); release order; sign off ACCEPTED-FAILURES (incl. removing R1b); "2440MM" = "2440"?; ZD420 label size; earlier open questions (dispatch warning, app-key access until logins, PIN for templates).
- Next: Architect writes up the save check + tags; Coder: saveCheck 250 ms fix, merge 2e7fbcb into cutting-lists, amber box one-at-a-time ("1 of N", ✕ closes one); Tester re-runs t9–t12, soaks, attack9-box, full suites.

### 3 Nov 2026, daytime (scheduled run, session …xiu7cMgHZKcEhisJ2m)
- Another copy of this scheduled task was again working on the same branches at the same time (it added the old-tab guard proposal and t16). Garry: please turn one copy off.
- Coder: save tags so a screen knows its save landed even after someone saved over it (7cfaf3b, 55b7ad9, 2e7fbcb); "Leave page?" while a save is being checked (564661a); slow save kept on the "may have landed" list (a2ab59c, Manager condition); reopen after a crash mid-save uses the save tag, so an office untick isn't undone (78a5147); each tab keeps its own device backup, so two tabs on one PC can't wipe each other's (0812392), plus a warning if the device can't keep a backup; Export Changes baseline put back if an old tab drops it (bb2427a). Warning box: up to 6 warnings, ▲/▼ to step, 36 px buttons, works on landscape phones (91753d3, aaaa7a1, 4d483c1).
- Architect: docs/DESIGN-save-check.md (how the save check works, plain English + technical, and what to test on a Supabase test project).
- Tester rounds 10–12 (t13 save tags, t14 reopen, t17 Export Changes attacks): full suite 1,924 pass / 12 fail, all on ACCEPTED-FAILURES (now updated and dated 3 Nov, every failing check listed). t9: 0 of 1,260 unticks came back; soaks clean; 2,500-job save ~650 ms. Saw/Stores rules re-confirmed (N/A → Waiting; sheets = m² ÷ 5.75 + 10%; never both got-out and missing).
- Garry's report today: the Export Changes list from the meeting-room PC disappears. Cause: the live app rebuilds that list on every 2-minute refresh/reload and keeps it on that PC only. Fixed on this branch (stored in the database, only "Mark as applied" resets it). Until go-live: download the Changes Excel straight after the meeting.
- Remaining risk is all OLD screens left open on go-live day (they overwrite newer saves, can undo ticks and empty the Export Changes list: t13, t16, t17). Manager recommends the database "old-tab guard" (docs/PROPOSAL-old-tab-guard.md) rather than more code; rollback trap noted there (undo the guard BEFORE rolling the website back).
- Supabase Disk IO email (Garry, today): read-only check shows the QUOTING system's wpf_quotes record (~6 MB, rewritten in full ~6,000 times since 20 Aug) causes ~99% of disk writes; the planner is negligible. Fix belongs in the quoting app (save only on change / per-row tables).
- **Manager final: stage2-imports GO WITH CONDITIONS; cutting-lists GO WITH CONDITIONS as a later, separate go-live (switch off; rehearse migration on a test project first).** Conditions: key planned moves into Cienapps before deploy; Stage 1 SQL → deploy → check one screen saves (incognito) → run the guard within minutes → close and reopen every device; nobody moves weeks or presses "Mark as applied" until the guard is on; try the guard once on a Supabase TEST project; Garry ticks ACCEPTED-FAILURES.
- Zebra labels: skipped — label size still not in the repo.
- Waiting on Garry: approve the old-tab guard; a Supabase test project; go-live date for stage2-imports; sign off ACCEPTED-FAILURES; switch off the duplicate scheduled task; "2440MM" = "2440"?; ZD420 label size; earlier open questions (dispatch warning, app-key access until logins, PIN for templates); what "the capacity board is back" meant.
- Next: Tester runs t17 with the guard on (not yet verified); Architect adds the rollback order to RUNBOOK-lists-switch.md; then nothing more until Garry decides.

### 3 Nov 2026, midday (second scheduled run at the same time, session …xff9/D2QE)
- **Two copies of this scheduled task ran side by side again** (this one and …xiu7cMgHZKcEhisJ2m). This run stopped changing things as soon as it saw the other one; the daytime entry above is the main record.
- This run's own work: checked the live `main` code and found that it saves without a version check. Added test t16 (an old tab left open wipes newer saves) and the old-tab guard proposal (docs/PROPOSAL-old-tab-guard.md, commit 234717e).
- Full suite on stage2-imports (at 7556b83, run one file at a time): 1,073 pass / 14 fail. All 14 failures are on ACCEPTED-FAILURES (t13 old-tab ×5, t14 ×3, t3, G4b, the two saw/stores rows, weeks summer-time), plus the 2,500-job timing check, which passes when run alone. t9: no unticks came back.
- An independent Manager review (separate from the other run's) reached the same verdicts: stage2-imports GO WITH CONDITIONS (old-tab guard should be a go-live condition; save check must be tried on a Supabase test project); cutting lists not yet (migration rehearsal first). Amber box B3/B8 now passes (attack9-box 41/41, coder-r9-box 10/10). One Low for the Tester: Chrome "Duplicate tab" copies the per-tab backup slot, which isn't tested yet.
- Waiting on Garry: same list as the daytime entry. **Most urgent: turn off one of the two scheduled tasks.**
