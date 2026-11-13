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
- Label contents (confirmed 21 Oct): WO, project/customer, house or room, part name, L × W, material, edging, quantity. Per-line print + group print. No barcode requested. Label size: see Decisions 3 Nov 2026 (101.6 × 63.5 mm).
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
- Auto-tag in the planner too (Garry, 4 Nov): "in planner when step is updated to assembled or palleted it is auto ticked for delivery". The board step dropdown (the only place the planner sets a step) ticks delv=true on a move to 7 or 8 (pool, no van/day; never untags; a job already tagged keeps its van/day; a hand-untag at that step or later is respected, same as the import; shipped jobs left alone), logged "Auto-tagged for delivery — step changed to 8. PALLETED by X". Go-live gap: one-off Deliveries button "Tag assembled/palleted jobs for delivery (N)" (office, asks first) ticks every job already at 7/8 not yet tagged. On hold still hides a tagged job from the board.

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
- Board sizes: "2440MM", "2440 mm", "2440.0" and "2,440" are the same as 2440 (Garry, 3 Nov). The combined cutting list now shows them as one row (retest-nov3 G4b passes; removed from ACCEPTED-FAILURES).
- Label size CONFIRMED (photo of the roll from Garry, 3 Nov): 101.6 × 63.5 mm (4 × 2.5 in), Zebra Z-Perform 1000T thermal TRANSFER paper, part 76179, 76 mm core, 2,220 labels per roll. Label print page to be 101.6 mm wide × 63.5 mm tall, one label per page, fitting the contents confirmed 21 Oct (WO, project/customer, house or room, part name, L × W, material, edging, qty).
  - To check before go-live: (1) thermal TRANSFER labels need a ribbon; the ZD420 was recorded as DIRECT thermal (no ribbon), and a direct-thermal ZD420 won't print on this stock. Either the printer is the ribbon model (ZD420t) or the labels need to be direct-thermal stock in the same size. (2) The ZD420 takes rolls up to about 127 mm across (1 in core as standard, 3 in core with an adapter). A 2,220-label roll on a 76 mm core is likely bigger than that, so it may need an outside roll holder or smaller rolls.
- Old-screen guard APPROVED (docs/PROPOSAL-old-tab-guard.md; SQL pending in SUPABASE_CHANGES.md, run on go-live day right after deploy; test once on a Supabase test project first).
- The 6-hourly "holiday work list" scheduled task is turned off. Weekly health check stays on.
- Cutting lists are the most important part of the roll-out and are not user friendly enough yet — Garry will go through them with Claude and decide changes before any more cutting-list build work.
- Cutting-list flow (Garry, 3 Nov): (1) lists are made by the Drawing office AND the Production Manager; snag recording should use a similar template. (2) The cutting list must be processed AT THE SAME TIME as the work order is processed (Cienapps "5.WORK ORDER PROCESSED") — not happening today. (3) In a project the same kitchen/bedroom/room types have a standard cutting list: pick from a standard template list per project/customer and add it to the work order. (4) Saw keeps per-line ticking as now. (5) Each customer = a project; templates are found by customer. (6) On import, the planner SUGGESTS the template for each newly processed WO; Production Manager/office confirms with one tap (or all at once). Nothing reaches the saw unconfirmed.
- Cutting-list flow plan (docs/PLAN-cutting-lists-flow-nov.md) APPROVED by Garry 3 Nov with answers: reissue as Rev 2 keeping unchanged ticks; one customer per project (project title is in the Cienapps customer heading); saw's red warning = WOs dragged onto the delivery schedule (van + day); day one shows all processed WOs with no list.
- List creation (Garry, 3 Nov): today lists are typed in Excel by hand and/or written on paper. Making a list in the planner must feel LIKE EXCEL: a grid you type across with Tab/Enter, paste rows straight from Excel, copy a row down, change quantities quickly. Waiting on a sample of WPF's Excel cutting-list sheet to match columns.
- List creation (Garry, 3 Nov, after the format review docs/CUTTING-LIST-FORMAT-REVIEW.md): create a cutting list, with the option to make that list a TEMPLATE that can be picked again; templates must be editable. Saw lists only — CNC 'Crystal Report' PDFs stay out of the planner.
- List editor plan (docs/PLAN-list-editor-excel.md) APPROVED 3 Nov with Garry's answers: colour = dropdown of project materials + 'Add new material'; changing number of units after the saw started = a NEW list; ignore the 'Blank' sheet on Excel import.
- (7) Revisions: when a list changes, a NEW cutting list needs to be created (Garry, 3 Nov). (8) Main problem today: cutting lists are issued too late. The saw must also be told when a job that is SCHEDULED FOR DELIVERY has no cutting list.

- (4 Nov) Cutting lists must be VERY simple. Standard production = Aspect / O'Malleys (saw list = fillers, exposed panels, worktops; cabinets off CNC). Approved: headings prominent, unit blocks hidden by default, 'Bought in' tick per line, worktops cut on the saw, TBC spec flags in red, 'Checked by' (Drawing office / PM) required before a list reaches the saw, fewer buttons. See docs/PLAN-list-editor-excel.md 'Simplify for standard production'.

- (4 Nov) 'Checked by' before issue: OFF for the initial roll-out (keep simple); import one list per sheet; keep amber for stores specs not on the project list.

- (4 Nov, Garry) Stores: reports per project of what has been sent to site, and print a delivery docket for a project (this is the 21 Oct "Items sent" report + a docket; build-order step 4).
- (4 Nov, Garry) Import: all ASSEMBLED and PALLETED work orders must come through already ticked for delivery (confirms the 22 Oct Stage 2 rule delv=true; to be verified on stage2-imports).
- (4 Nov, Garry) Cutting list page: an option to start a cutting list in a STANDARD FORMAT; TWO edging options per piece; a dropdown of that project's materials. (Details to confirm: what the standard format contains; what the two edging options are.)
- (4 Nov, Garry, answers) Edging = TWO edging columns per piece (Edging 1, Edging 2). "Standard format" new list = the standard headings ready to fill (house heading, Fillers and Kickers, Worktops, Stores items). Stores docket: when items are held back and sent in a batch (e.g. 20 taps for a project in one go), stores must generate a docket for that batch and keep a record of it; reports per project of everything sent to site.
- (4 Nov, Garry) FLOOR and UNIT must be kept SEPARATE on all lists and pages (today many screens join them as "floor · unit").
- (4 Nov, Garry) The work-order field is too long: the WO number and the TITLE must be shown as separate fields/columns (WO | Floor | Unit | Title | Customer), on the editor and everywhere else.

- (4 Nov, Garry) Stores docket plan (docs/PLAN-stores-docket.md) APPROVED: only not-yet-got-out items; project address as the docket default plus delivery instructions and a signature block; part quantities allowed.

- (4 Nov, Garry) When a job's STEP is changed in the planner itself (not only on import) to 7. ASSEMBLY COMPLETE or 8. PALLETED, it is auto-ticked for delivery (delv=true, no van/day), same rule as the import. Never untags.

- (4 Nov, Garry) Be more aware of SIMPLEST use, especially for production and stores. REMOVE the "Paper list issued" option. Maybe allow attaching a PHOTO of a list instead. In the cutting list rename "Colour" to "Material".

- (4 Nov, Garry, answers) Photo of a list REPLACES the paper option: on a WO with no typed list, attach a photo (phone camera or file); the saw must be able to open it; it is a stop-gap to be removed later once the typed system is in place (keep it simple, easy to switch off). Docket cancel ASKS "Did these items leave stores?" (Yes = stay got out; No = back to 'to pick'). Dockets are for FITTINGS (stores items) only for now — cutting-list (saw) items are not docketed, so no per-WO quantity split is needed.

<!-- Copied 12 Nov 2026 from feature/project-details-v2 for the list-window release (branch feature/list-window) -->
### Cutting list job boxes + Cienapps WO number always (10 Nov 2026, Garry, go-live day) — add to Job B, do EARLY (staff are entering real lists now)
Garry's words: "cutting list need to break out floor, unit and title into their own boxes. use cienapps work order number at all times. could we look for cienapps number if it not pre-populated. If cienapps wo number cannot be found force new p-number as a last resort".
- **L1 — Separate boxes:** in the cutting list window (new list, Import Excel preview, Find old list / copy, Edit job info) Floor, Unit and Title are each their own box — never one combined text. Excel template + import: keep reading the current template; if the job info block gains Floor / Unit / Title cells, accept both layouts.
- **L2 — Cienapps WO number at all times:** a list is always tied to the Cienapps work order number and shows it everywhere (lists home, saw, stores, dockets, prints). Pre-populate it when the list is started from a job.
- **L3 — Look it up when it is blank:** search the planner's jobs by the matching key from B0 — project (customer name) + floor + unit (trimmed, case-insensitive). Exactly one match → fill it in and show what was matched. Several → the person picks from the short list. Typing a WO number by hand is still allowed but must exist in the planner.
- **L4 — P-number only as a last resort:** no Cienapps job found → say so plainly and make a new P-number only after the person confirms. It is flagged (purple, "not from Cienapps"), and when a later Cienapps import brings a job with the same project + floor + unit the list moves onto the Cienapps WO and the P-number job is merged into it — NEVER two jobs for one unit (Garry: "the most important thing is to avoid duplication's"). One-list-per-WO rule unchanged.
- Architect: confirm with Garry before building — what happens when floor or unit is blank on either side (default: no automatic match, person picks), and whether Title takes part in the match (default: no, it is only shown).

### Cutting list window — Garry's first real use on the live system (10 Nov 2026, 16:11) — do with L1–L4, EARLY
Garry's words: "i need to be able to click into delivery card and be able to add a cutting list. add new material does not see to work in cutting list. where do i add the project list of materials. you qty in the qty column same as L and W. how do you get out of the cutting list without hitting cancel. need clearer step with list is completed that list is saved and list can be closed. says it cant save". (Screenshot: New cutting list for WO-2617-4, Project = "— pick the project —", red "Pick the project.", amber "This device can't keep a backup copy … (storage full or blocked)".) Live data at the time: no real projects yet, only the two migrated example ones.
- **L5 — Project should never block a first list:** when the WO is known, pick the project automatically from the WO's customer (customer → project link); if there is none, offer "Make project '<customer>'" in one tap right where the red message is. "Pick the project." must say what to do (e.g. "Pick the project — or ＋ New project… at the bottom of the list").
- **L6 — Materials easy to find:** "＋ New material…" in the material drop-down must work the first time (if no project yet, lead the person through L5 then carry on, don't just refuse). The project's material list ("Materials" button) needs a clearer label, e.g. "Project materials (add / edit)". Ties in with B (materials editable from PM and office views).
- **L7 — Qty box like L and W:** show "Qty" inside the empty box, same style as "L" and "W".
- **L8 — Clear finish:** after Save show plainly "Saved ✓ — list is with the Saw & Stores" with a Close button; a ✕ Close at the top right of the window at all times (asks only if there are unsaved changes); "Cancel" renamed so it does not read as the only way out.
- **L9 — From the delivery card:** tapping a job's delivery card offers "＋ Add cutting list" (and "Open list" when it has one), opening the same window with the WO, floor, unit, title pre-filled.
- **L10 — "can't keep a backup copy" bar on Garry's office PC:** find out why (likely this browser's storage for garryog.github.io is full — the quoting tool used to be hosted on the same address and kept large local copies). The planner should say how to fix it, and Settings should show how much device storage the planner is using. Never delete another app's stored copies without asking.

### Decisions 10 Nov 2026, 16:18 (Garry, testing the live list window)
Garry's words: "customer and project will always be the same. where do we pick and set up material. there is no need for number in house / list name this could be used for a name of the list only and also searchable again if the list was saved as a template. i need to test this out".
- **Customer = project, always.** The Cienapps customer name IS the project. Nobody should have to pick or create a project by hand when a work order is known: the project is found or made from the customer automatically (supersedes the "pick the project" step in L5; a picker is only needed for a list with no work order).
- **House / list name:** do NOT pre-fill it with the unit number. It is a free name for the list only, and it must be searchable — in Find old list and in the template list when the list was saved as a template.
- **Materials:** make where to set up a project's materials obvious from the list window (see L6).

### Work order drop-down in the list window (10 Nov 2026, 16:24, Garry)
Garry's words: "we only need to see the work orders that are linked to that project in the drop down not all the work orders in the system".
- **L11** — once a project is picked (customer = project), the Work order drop-down lists ONLY that project's work orders (same customer / linked Cienapps names), in WO order, showing WO · floor · unit · title; shipped and on-hold jobs left out; jobs that already have a live list marked. With no project picked it stays empty with "pick the project first" (or a search box) — never all 650. Picking a WO first still sets the project.
- Live note: on 10 Nov one project per customer (40) was added to the live database for Garry (name = customer, cien_names = [customer], updated_by "Claude (go-live 10 Nov, for Garry)") so every WO has a project.

### Due dates prominent everywhere + WO drop-down in due-date order (10 Nov 2026, 16:27, Garry)
Garry's words: "the work order due date are not prominent in all screens. the work orders should appear in order of due date in the work order drop down".
- **L12** — the Work order drop-down in the list window (L11) is sorted by DUE DATE, earliest first (no date last), and each line shows the due date: "WO-2617-4 · Fl 7 · Unit 231 · due 14 Nov". (Supersedes "in WO order" in L11.)
- **DD1** — audit EVERY screen that shows a work order (Capacity Board, Deliveries pool/cards/weeks, Shipped, Cutting Lists home + lists needed + list window header, Saw, Stores, dockets, PM views, prints) and make the due date prominent and in ONE consistent style everywhere: same badge, same format ("Fri 14 Nov · Wk 46"), red when overdue, amber when due this week, "moved N×" where it applies. Architect lists the screens where it is missing or small today; Tester checks each one at PC and phone width.

### Garry 10–12 Nov (voice call 10 Nov evening + 12 Nov) — decisions not yet recorded
- **PRIORITY (12 Nov):** the cutting list window is the NEXT job, as its own small release (target Wed 18 Nov), after the Deliveries weeks release on Mon 16 Nov. PM page, Drawing page and the rest of Job B wait. Scope = L1–L12 + DD1 (list window part) + the items below.
- **Simplicity is the main focus** (Garry: the production manager is "old school"; buy-in depends on it). List window: ONE obvious path — open from the job, fill rows, one big Save. Templates / Import Excel / Find old list go behind a single "Start from…" choice at the top; "Save as template" only for Drawing office / Admin. Fewest buttons on every screen.
- **Cutting lists are owned by the Drawing office and Johnny**, not PMs. "No cutting list yet" warnings go to them; the PM sees each job's list status read-only.
- **Several PMs per project**: a project can have more than one PM; it shows in each of their views; changes logged under the PM who made them.
- **PM marks Installed on his phone** from his sequence table; updates everywhere, goes on Export Changes.
- **Driver confirms delivery → step JOB SHIPPED** if not already, logged under the driver, on Export Changes, shows on Shipped at once.
- **Shipped report**: pick from/to dates → every job shipped in the period with project, PM, value, invoiced status, total, Excel download.
- **PM sequence**: shipped rows stay but grey out and are hidden by default ("show finished"); later the base for installation management (install date, fitters, site snags, sign-off) — a separate phase, not now.
- **Johnny's CNC Schedule (later, CNC job)**: read from SharePoint on a schedule; strike-through = office processing done (CNC files), NOT cut. Mark jobs taken into the planner with an extra "In planner" tick column — tested on a COPY of his .xlsm first, never write colours into his file.


### Dates & deliveries decisions (9 Nov 2026, Garry) — Job A, plan docs/PLAN-dates-deliveries.md
- Order of work: "Dates & deliveries first"; PM sequence, Cienapps upload and Johnny's pool go WITH project details (Job B); CNC view after both.
- Already built 4 Nov: step 7 ASSEMBLY COMPLETE / 8 PALLETED (planner or import) ticks the job for delivery, logged; one-off catch-up button.
- A1 Deliveries page in WEEKS: tabs This week / Next week / +2 / +3 / Later, each with its own vehicle × Mon–Sat grid and day notes; past weeks keep working. To Plan pool grouped by due week. "In store — ready, no delivery date" section (assembled/palleted, not on a van, days in store, amber after 14 days). A3 poster and Excel export per week.
- A2 Due date editable on the Capacity Board row AND the delivery card/pool: date picker + reason (Customer delay · Site not ready · Production · Materials · Design/drawings · Other + note). One change moves the job on both pages.
- A3 Planned week follows the new due week UNLESS already cut (step 6+ or saw ticks): week stays, flagged "due date moved — check week".
- A4 A job booked on a van/day whose due date changes comes OFF the van, back into the To Plan pool of its new week, flagged "date moved — rebook" (logged). Never silently keep the old booking.
- A5 Every date change stores who/when/old/new/reason; original due date kept (origDueDate); "moved N×" badge on board row and delivery card.
- A6 Every planner date change is listed in Export Changes; a re-import still carrying the old Cienapps date does NOT put it back (planner date wins until Cienapps matches, then the override clears).
- A7 Knock-on: cutting-list due date, saw cut-by and stores pick date move with it; saw and stores show "this job has moved" on the card for a day.
- A8 Delivery date per job (Cienapps column L "Delivery/install date" when present, else set in the planner); build due date works back from it (default 3 working days, Settings). Changing the delivery date moves the build dates; changing the build date alone still allowed (flag if after delivery).
- A9 "Don't build too early": a not-yet-cut job whose due date moves out by more than 14 days is flagged (and suggested to move out of the current planned week).
- A10 Site-ready confirmation by PM or office; jobs on the delivery board within N working days (Settings, default 5) without it show amber "site not confirmed"; who/when logged.
- A11 GROUP moving of due (and delivery) dates with one reason — from board group-select/groups, by project/customer, or ticked cards on the delivery page; same A3–A7 rules; summary of what moved and what was flagged.
- Not wanted: a weekly date-changes report.

### Release in small pieces + Job A answers (12 Nov 2026, Garry)
- **Releases go out as small pieces.** Order: (1) the Cutting Lists project filter (PR #2, branch feature/lists-project-filter); (2) **Job A — Dates & deliveries on its own**, branch `release/deliveries-weeks`, for Garry to merge on **Mon 16 Nov**; (3) Job B (project details, PM sequence, pre-production pool) later, in its own pieces. This replaces the Manager's 11 Nov condition "release Job A with Job B" (decision C → Job A on its own first).
- **A1** — the Production Manager gets the FULL Deliveries page as built (🚚 Deliveries button on his screen), Close week included.
- **B1** — Saturday deliveries are allowed and NOT flagged, as built. Sundays and bank holidays are never delivery days.
- **D1** — a loaded / on-the-road job ticked in a group week move still moves, stays on its van and is flagged "date moved after loading — check", as built (plan Q15).
- Bank holidays: **Mon 3 Jan 2028** is the day off for New Year's Day (Sat 1 Jan 2028) — confirmed by Garry. The list also holds Sat 26 Dec 2026 and Sat 25 / Sun 26 Dec 2027, so no delivery lands on Christmas Day or St Stephen's Day.

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

### 2 Nov 2026, evening (second scheduled run, branch feature/cutting-lists)
- Found the cutting-list system already built (Stage 3 core + screens) by the earlier run on `feature/cutting-lists`; this run continued from Tester round 5. Another run was pushing to the same branch at the same time, so this run's tests were renamed `attack5b-*` to avoid clashes.
- Tester round 5b: all round-4 fixes hold. Found 1 Medium (typing over a cut row as a different part lost the "keep aside" warning) and 3 Low. Manager added 2 Medium (two database functions could lock each other up; add a "check a normal save still works" step after the SQL).
- Coder round 5b fixed all six (commits 37086fc–7dd0756). Re-test: 25 of 25 new checks pass; all attack4/attack5b checks green. Full stage3 + saw/stores run: 4 failed of 962, all known (on ACCEPTED-FAILURES). Two Low wording issues left (Release all message only names the first refused line; a park-then-release made offline shows a confusing note).
- **Manager verdict, cutting lists:** code has no open Critical/High/Medium. Still **NO-GO** to merge or to press "Migrate lists" until (a) Stage 1 → Saw/Stores → Stage 2 have gone live one at a time, and (b) the SQL and migration have been rehearsed on a free Supabase test project with a copy of the real data, a real Android phone and the saw PC. The SQL block in SUPABASE_CHANGES.md changed this run (still pending).
- **Manager verdict, Saw/Stores (on feature/stage2-imports): GO with conditions.** Garry's three rules pass; only accepted failures remain. Open: the 21 Oct "warn at dispatch if lines are waiting" isn't built.
- Zebra labels: skipped — label size still not recorded. Waiting on Garry.
- Waiting on Garry: release order; a Supabase test project for the rehearsal; sign off ACCEPTED-FAILURES; dispatch-warning OK until Deliveries?; accept that anyone with the app key can change lists until Stage 4 logins; should office PCs re-enter the PM/Design PIN each time for templates; label size.
- Next: Tester rewrites R1b; Coder tidies the 2 Low messages; then rehearsal on a Supabase test project once Garry sets one up.

### 2 Nov 2026, evening (first run, continued — branch feature/cutting-lists)
- Two scheduled runs worked on this branch at the same time today; both kept their tests apart (attack5b/attack6-r5b vs attack5/attack6-round5). Garry: please check this scheduled task isn't set to fire twice.
- This run: Tester rounds 1–6 against the new lists; every Critical and High found was fixed by the Coder and re-tested (rounds 1–5: switch wiped by old tabs, 1,000-row cap, ticks lost around Migrate/Switch back, office edits overwriting each other, twins, working-day dates, material name clashes, backups carrying the switch). Runbook written: docs/RUNBOOK-lists-switch.md.
- Round 6 (latest): no Critical/High open. 1 Medium left — after a Switch back, if a tablet's save of its held ticks lands but the reply is lost, and the office then unticks that line, the tablet can bring the tick back (tests/stage3/attack6-round5 Q2; only on the Switch-back path). 2 Low in diffLines for line ids no screen can produce today.
- Full suite: 94 files, 1,665 pass / 8 fail — 4 accepted + P5 informational + the 3 above. Switch-OFF app behaves exactly like feature/stage2-imports (Manager checked).
- Manager (final): GO WITH CONDITIONS — fine to carry this code with the switch off; do NOT press Migrate until stage2-imports is live and settled and the migration has been rehearsed on a copy of the real data (Garry supplies a downloaded JSON / Supabase test project). SQL ran clean on a throwaway Postgres (json and jsonb).
- Next: Coder fixes the Q2 Medium; rehearsal once Garry provides data.

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

### 3 Nov 2026, afternoon–evening (live session with Garry, branch feature/cutting-lists-flow)
- Garry back: approved the old-screen guard; turned off the 6-hourly build scheduled task; Export Changes cause explained (live app keeps the list in one browser and wipes it on refresh — fixed on stage2-imports); Supabase Disk IO warning traced to the QUOTING system's wpf_quotes record, not the planner.
- Cutting lists reworked with Garry (most important part of roll-out). Decisions in docs/PLAN-cutting-lists-flow-nov.md and docs/PLAN-list-editor-excel.md (Garry's answers at the bottom of each); format review of WPF's real Excel lists in docs/CUTTING-LIST-FORMAT-REVIEW.md.
- Built on feature/cutting-lists-flow (from feature/cutting-lists): "Cutting lists to issue" after each Cienapps import (suggested template per WO, green only when certain via an allow-list, one-tap confirm / Confirm all green, Excel matches are suggestions only); list due dates; saw red warning for jobs on the delivery schedule with no list, amber count otherwise; PM tiles; board chip; office links customers to projects without a PIN; Excel-like list editor (Description | Qty | Length | Width | Colour | Edging | Note, unit blocks × units, headings, colour dropdown + add new material, keyboard, paste from Excel, Save as template / Update / History, Make new list from this → old list archived in the database); Excel import rewritten for WPF's real workbooks (Blank/Index/Stock sheets ignored, preview); saw "NEW LIST ISSUED – Rev N" banner and "Superseded"; one live list per WO on the quick buttons (database rule).
- Tester rounds 1–4 found ~40 problems (incl. 1 Critical, several High: duplicate lists, wrong green suggestions, quantities changed by merges); all fixed. Final full suite: 2,621 pass / 27 fail, all on ACCEPTED-FAILURES. Pending Stage 3 SQL now safe to run twice (tested on throwaway Postgres).
- **Manager: carry with lists switch OFF = GO. Switch lists ON = GO WITH CONDITIONS:** real WO titles (50–100, with customer heading) and 3–4 real workbooks tested; hands-on session for Garry + one office person on a Supabase TEST project; migration rehearsal on a copy of real data; real Android phone + saw PC; stage2-imports live and settled first; old-tab guard in place (t17); brief staff on new messages ("May have saved…", "You were saving…", "Superseded", saw's "Old list STILL with the saw").
- Not built yet: snag grid (flow step 8); Zebra labels (label size now recorded on stage2-imports — 101.6 × 63.5 mm; ribbon vs direct-thermal to check).
- Waiting on Garry: real WO titles export + 3–4 real cutting-list workbooks; a Supabase test project; go-live date for stage2-imports.
### 4 Nov 2026 (Coder, Garry's 4 Nov requests)
- **Floor and Unit kept apart everywhere** (made on feature/stage2-imports first, then merged → cutting-lists → cutting-lists-flow): two labelled badges ("Floor 1", "Unit 22") on the saw/stores cards, shipped tab, PM / management / floor screen / driver / delivery board, combined list, lists-to-issue and waiting rows; their own Floor and Unit columns in the lists-needed table, past delivery weeks, the printed plan and Lists home; "FLOOR / UNIT" beside the WOs on the saw/stores print and the labels. Search still matches both. A new list is now named after the unit (floor shown beside it from the job).
- **Two edging columns** (Edging 1, Edging 2): editor, saw, prints, labels ("L1LE 1mm / L4S 2mm"); Excel column G that reads like an edging code (or is headed "Edging 2") imports as Edging 2. `edging2` added to the PENDING Stage 3 SQL (re-runnable, tested twice on throwaway Postgres).
- **"New list – standard layout"** on Lists home and on lists-to-issue rows with no template.
- **Checked, not rebuilt:** assembled (7) / palleted (8) jobs come through a Cienapps import ticked for delivery (tests/stage2/autotag-delivery.test.js). Gap for Garry: a job ALREADY at 7/8 in the planner before go-live is not ticked by the next import (the rule fires only when the step moves).

### 4 Nov 2026, evening (Coder, feature/stores-dockets — "simplest use for production and stores")
- **Colour → Material** in every cutting-list screen (editor column and phone cards, Carcass / Door material, preview, help, import message, "Pick the material…" error). Saved field names unchanged; Excel files with a Colour column still import (90f5067).
- **"Paper list issued" removed** — "No list needed" is the only way to clear a WO without a list. An old paper mark counts as "needs a list" again; the office's next load clears it with one history line (ea9a04d).
- **Photo of a list** (stop-gap): "📷 Attach photo of list" on lists-to-issue rows and in the job's photo window (board chip "📷 photo list", "📷 Photo lists" in the panel). Camera or file, several photos; PDFs are kept as PDFs (no PDF-to-image in the browser without an extra library) and open in the phone's PDF viewer. Stored in the new Storage bucket `list-photos` (PENDING SQL); the job keeps `listPhotos` / `photoDone`. Counts as "has a list". Saw / Stores: a "Photo list" card, tap for full screen, ONE tick for the job. Settings "Photo lists allowed" (default on, Admin PIN) hides the attach buttons (52f733f).
- **Docket cancel asks "Did these items leave stores?"** Yes = only the docket is voided (items stay got out, still count as sent, still on Items sent); No = back to "to pick". `docket_cancel(…, p_left)` + `cancel_left` in the PENDING Stores dockets SQL. "Send fittings to site" wording; the docket buttons are hidden quietly until one probe finds the docket tables (acd8a22).
- **One "＋ New list"** on Lists home = the standard layout; "Blank list" under More ▾ (15f65fd).

### 4 Nov 2026, afternoon (live session with Garry — branches feature/cutting-lists-flow and feature/stores-dockets)
- Garry's requests built and tested (Tester rounds 5–6, all findings fixed): simplified editor for standard production (Aspect / O'Malleys style: headings first, unit blocks hidden, Bought in tick, TBC spec flags, "Checked by" built but OFF by default); "Colour" renamed "Material"; two edging columns; one "+ New list" opening the standard layout; floor and unit separate on every screen; WO number and title separate on list screens; auto-tick for delivery when a step is changed in the planner + one-off catch-up button (on stage2-imports); "Paper list issued" removed and replaced by PHOTO OF A LIST (saw opens it full screen, one CUT COMPLETE tick, counted and printed like typed lists; stop-gap, switchable off); stores DOCKETS for fittings with part quantities, project address, delivery instructions, signature block, cancel asks "did the items leave?", "Items sent" report per project (print + Excel).
- Pending SQL for Garry (all in SUPABASE_CHANGES.md, re-run safe): Stage 3 block (now incl. unit_qty, edging2, Bought in kind, Checked by columns), Stores dockets block, Photo of a list bucket.
- Last full suite (feature/stores-dockets, 176 files): 3,163 pass / 27 fail — 23 on ACCEPTED-FAILURES, 4 timing-only (pass alone).
- **Manager (4 Nov): stage2-imports go-live GO WITH CONDITIONS (same conditions as 3 Nov + press the catch-up delivery button once + tell drivers/office that step 7/8 jobs land in the delivery pool). Carry cutting-lists-flow + stores-dockets with the lists switch OFF: GO WITH CONDITIONS (run Stage 3 + dockets SQL before merging, or the docket buttons stay hidden). Switch lists ON: NO-GO until rehearsed on a Supabase test project with real data, real WO titles and real workbooks tested, real Android phone + saw PC.**
- Waiting on Garry: sign off ACCEPTED-FAILURES; go-live date for stage2-imports; a Supabase test project; 50–100 real WO titles + 3–4 real workbooks; answer: can a delivered docket be cancelled / address editable after making (currently no).

### Capacity Board: Shipped / Installed / Completed steps as a small release now (12 Nov 2026, Garry)
Garry: "Shipped step is gone from capacity board. It is still needed" — "Need to be able to update on capacity board to shipped or
installed or completed. The job drops off capacity board after shipping". S1 (built on Job B) is lifted onto the live version as its
own small release, branch feature/board-shipped-steps. Plan: docs/PLAN-board-shipped-steps.md.

### Delivery page usability — TOP PRIORITY for buy-in (10 Nov 2026, Garry, go-live day)
Garry's words: "for the delivery planner due date of jobs need to be edit able in the pool of jobs down for delivery. i need very clear week navigation between week in the delivery page. make it very easy for job in the delivery pool to be moved to other weeks. the easy usability of this page is very important for buy in of the whole planner system wit hthe production manager".
- Job A (A1 weeks, A2 due date on card/pool, A11 group move) already covers the function. Before it is released, Architect + Tester review the Deliveries page as the Production Manager would use it, and the Coder closes any gap:
  - **D1** due date editable straight on every To Plan pool card (one tap → date → reason), not only inside a dialog.
  - **D2** week navigation impossible to miss: big ◀ Prev / Next ▶ plus the week tabs, the week number and Monday date always visible ("Wk 46 · 9 Nov"), "This week" button, the current week highlighted, job count per week on each tab.
  - **D3** moving a pool job to another week in one or two taps: "→ Next week" / "Move to week…" on each card, tick several + "Move ticked to week…", and drag onto a week tab on a PC. Same A3–A7 rules and reason.
- Test with the Production Manager's real use in mind (PC first, then phone). This page decides whether he adopts the planner.

### Due dates prominent everywhere + WO drop-down in due-date order (10 Nov 2026, 16:27, Garry)
Garry's words: "the work order due date are not prominent in all screens. the work orders should appear in order of due date in the work order drop down".
- **L12** — the Work order drop-down in the list window (L11) is sorted by DUE DATE, earliest first (no date last), and each line shows the due date: "WO-2617-4 · Fl 7 · Unit 231 · due 14 Nov". (Supersedes "in WO order" in L11.)
- **DD1** — audit EVERY screen that shows a work order (Capacity Board, Deliveries pool/cards/weeks, Shipped, Cutting Lists home + lists needed + list window header, Saw, Stores, dockets, PM views, prints) and make the due date prominent and in ONE consistent style everywhere: same badge, same format ("Fri 14 Nov · Wk 46"), red when overdue, amber when due this week, "moved N×" where it applies. Architect lists the screens where it is missing or small today; Tester checks each one at PC and phone width.

### Delivery pool cards are messy (10 Nov 2026, 16:30, Garry — screenshot of the ASPECT ATHENRY group in the To Plan pool)
Garry's words: "this is messy they are all over lapping, you can drop the value and just put a total down the bottom. add the dues date to these cards".
- **D4** — pool cards must never overlap: WO, Floor and Unit badges fit inside the card (wrap or shrink), nothing spills into the next card, at PC and phone width. Drop the € value from each card; show the group total value once at the bottom of the group. Add the due date to every card in the DD1 style (red overdue, amber this week). Same fix on the cards in the week grids if they share the layout. Part of the Deliveries usability pass (D1–D3), before Thursday's release.


### 11 Nov 2026 (branch feature/lists-project-filter — small release on top of the live version)
- Garry's request (11 Nov): "the cutting list page need project filters and make sure customer/project is always visible on the cutting list page."
- Built (lists switch ON only; no database changes): one **Project** drop-down at the top of the Cutting Lists page (Office, Drawing office, Production Manager → Lists). It narrows every section — lists to issue, waiting for check, lists needed, waiting on material, the lists and the templates. Projects A–Z with counts, "No project" for anything not linked, a type-to-find box once there are 40+ projects, "✕ All projects" to reset, "N of M shown". The pick is remembered on that device; a project that no longer exists falls back to All projects. Jobs are matched to a project through its Cienapps customer names (customer = project, Garry 10 Nov).
- The project name is now on every row and card of the page (templates too), and wraps on a phone instead of being cut off. The "lists needed" table stacks on a phone (it used to scroll sideways).
- The filter only applies on the Cutting Lists page: the Import page's "lists to issue" panel, the tab badge, the Saw and Stores always show every project. Lists switch OFF: the page is byte-for-byte the same as before (checked against main).
- Tests: tests/lists-filter/f1-project-filter.test.js — 75 checks, all pass. Full suite (181 files): 3,293 pass / 23 fail, every failure already on ACCEPTED-FAILURES; main gives the same failures file by file (main fails 2 more in stage1 t17). Two timing checks (editor e7 redraw, stage3 attack4-states) fail only when two suites run at once and pass alone, on main too.
- Assumed: the project sits under the list name (not a new column) so the lists table keeps its width; the old "All projects" drop-down inside the Lists panel moved to the top bar rather than having two.
- Next: Tester to attack; Manager review; only Garry merges.

