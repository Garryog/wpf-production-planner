# Plan: cutting-list flow, Garry's 3 Nov changes (Architect draft, awaiting Garry's 4 answers)

## For Garry: the new flow
1. **Before step 5 (best case).** The Drawing office or the Production Manager keeps each customer's standard lists ("templates"), one per kitchen/room type (e.g. "Type B kitchen"). They can make a job's list early, and then that job is never flagged.
2. **The office imports the Cienapps export as usual and presses Apply.** A panel then appears: **"Cutting lists to issue (12)"**. It lists every work order at 5.WORK ORDER PROCESSED or later that has no list.
3. **Each row shows a suggested template.** The planner finds the customer's project, then the template whose name best matches the WO title (TYPE B, KITCHEN, 3 BED…). Green = strong match, amber = a guess, grey = no suggestion.
4. **Tap ✓ for one row, or "Confirm all green (9)"** to do the whole batch in one tap. Changing the template takes 3 taps. "No list needed" is one tap.
5. **Nothing reaches the saw until it is confirmed.** Unconfirmed rows stay on the Production Manager's and the office's Lists tabs.
6. **Saw:** per-line ticking as now. A red strip at the top shows **"ON DELIVERY – NO CUTTING LIST"** for any job tagged for delivery that has no list. An amber line shows how many processed jobs are waiting for a list.
7. **Production Manager:** two tiles, "Lists late" (red) and "Lists to issue" (amber). A list is due 2 working days after the WO is processed (changeable in Settings), or the working day before the saw cuts it, whichever comes first.
8. **Changes:** the saw sees "NEW LIST ISSUED – Rev 2 replaces Rev 1 (2 changed / 1 added / 1 removed)". This depends on Q1.
9. **Snags:** entered on the same grid as a cutting list. You can also pick the WO and tick which parts to re-make from its list.

## Gap list: what is built vs what changes
**(a) Cutting-list step after import**
- Today the import ignores lists, and step 5 plays no part in "Lists needed".
- Change: the preview shows "N processed with no cutting list". After Apply, the new `listsToIssueHTML()` panel appears. The same panel sits at the top of the Lists tab, the Production Manager's Lists tab and the Drawing office home.
- New pure function `suggestTpl(order, templates)`, with its own tests.
- New `confirmList(wo, tid)`. It reuses `lsCreateFromTpl` and gives the list a fixed ID `WO:<wo>`, so two PCs confirming at once make one list.
- New WO field `o.procAt`, the date the import first sees the WO at step 5 or later.
- `listsNeeded()` also includes live WOs at steps 5–8 with no list, leaving out on hold, Shipped and "No list needed".

**(b) Customer = project**
- Projects already hold `customer` and `cien_names`.
- When a customer isn't linked, the row offers **Link to project ▾** or **+ New project "X"** (one pick, which adds the name to `cien_names`).
- The Templates page gets a customer search box.

**(c) Revisions (item 7)**
- Recommendation: keep today's revision engine underneath (unchanged lines keep their ticks, changed lines reset and are flagged, "keep aside" for removed parts already cut), but present each change as a new list: a full-width "NEW LIST ISSUED" banner, "Rev 2 replaces Rev 1" on prints and labels, and the old version shown as "Superseded (view only)".
- Truly separate lists risk parts being cut twice. This is Q1.

**(d) Missing-list warnings**
- Saw strip split into red (on delivery, no list) and amber (processed, waiting).
- A "📋 no list" chip on board rows at step 5 or later, red once late.
- The Production Manager tiles split into late and to-issue, with an owner and due-by date per row.
- New setting "List due N working days after WO processed".

**(e) Snags**
- A multi-row grid like the list editor (part, qty, length, width, material, edging, note) plus "Where".
- Optional "From WO" to tick parts from that WO's list.
- Transferring snags to a list is unchanged.

**Also**
- Rename "Design office" to "Drawing office".
- Excel upload auto-tags become suggestions in the same confirm panel, so nothing reaches the saw unconfirmed.

## Build order (with the lists switch off, the app behaves exactly as today)
1. `suggestTpl` (tests first, using real Cienapps titles)
2. `o.procAt` and the wider `listsNeeded`
3. Confirm panel (fixed IDs)
4. Customer → project link
5. Saw strips, board chip, Production Manager tiles, due-by setting
6. Excel auto-tags become suggestions
7. "New list issued" presentation (after Q1)
8. Snag grid
9. Full suite, Tester, Manager

**SQL:** probably none. If the database doesn't refuse a second list with the same ID, `save_list_revision` needs a small guard, which would go in SUPABASE_CHANGES.md and be run before deploy. Go-live still needs the cutting-lists conditions: a migration rehearsal on a Supabase test project.

## Risks
- A wrong suggestion confirmed in bulk: "Confirm all" covers green rows only.
- Two PCs confirming at once: the fixed ID handles it, and this must be tested.
- A builder with several sites (Q2).
- A flood of rows on day one (Q4).
- A partly failed "Confirm all": show the result per row and allow a retry.
- Phone layout in Chrome on Android.
- Cienapps step text varies, so always use `stepNo()`.

## Questions for Garry
1. When a list changes, what does the saw get? A) the same list reissued as "Rev 2 replaces Rev 1", with unchanged parts staying ticked (recommended); B) a separate new list with ticks copied across; C) a new list where the saw starts from zero.
2. Can one customer have several sites? A) one customer = one project, always; B) usually one, but a customer can be linked to several and the office picks per WO.
3. What counts as "scheduled for delivery" for the saw's red warning? A) only jobs with a van and day; B) any delivery tag, including the automatic tag at step 7/8 (recommended).
4. Jobs already past step 5 with no list on go-live day? A) show them all; old ones are cleared with "No list needed" or "Paper list issued" (recommended); B) flag only WOs that reach step 5 after go-live.

## Garry's answers (3 Nov 2026) — plan APPROVED for build
1. Reissue as Rev 2: "NEW LIST ISSUED – Rev 2 replaces Rev 1". Unchanged parts stay ticked, and the old version is kept as superseded.
2. Always one customer per project. The project title is always part of the WO customer heading in Cienapps, even when a builder has several jobs with us. So the customer heading identifies the project, and there is no per-WO project pick.
3. The saw's red "ON DELIVERY – NO CUTTING LIST" warning covers work orders that have been DRAGGED ONTO THE DELIVERY SCHEDULE, meaning given a van and day (delVeh + delDay). The undated delivery pool and the automatic step 7/8 tag do NOT count for the red warning. They still show in the amber "waiting for a list" count.
4. On go-live day, show every processed WO with no list. Old ones are cleared with "No list needed" or "Paper list issued".
