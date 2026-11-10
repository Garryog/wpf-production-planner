# PLAN: Dates and Deliveries (Job A). Branch `feature/dates-deliveries`

Architect, scheduled run, 9 Nov 2026 (evening). Checked against `index.html` on this branch (cut from `feature/list-excel-template`).
Garry's answers of 9 Nov (A1–A11) are in docs/ROADMAP.md under "Dates & deliveries decisions (9 Nov 2026)".
Built unattended: the open questions below use the recommended answer (ASSUMED — Garry to confirm).

---

## Goal
Anyone in the office can change a job's due date in one place — the Capacity Board row or its delivery card — pick a reason,
and the move follows through everywhere: build week, van booking, saw / stores / cutting-list dates, history, and the list of
dates to update in Cienapps. For one job or a whole group. The Deliveries page plans by real weeks (This week, Next week,
+2, +3, Later) and shows what is sitting in store with no van. Phase 2 adds a delivery date per job (separate from the build
date), a "don't build too early" warning and a "site ready" confirmation.

## What exists already (don't rebuild)
- Auto-tag at step 7/8: `delvAutoOk` / `delvAuto` (board step dropdown and import `analyzeImport`), one-off catch-up `#btn-deltag`. Keep.
- Saw, stores and list due dates are worked out from `o.dueDate` every time (`listDueKey`, `listDeadline`, `lsNeedInfo`,
  `listsNeeded`, `dueToday` / `cutTodayEnd`). So A7 mostly happens by itself; only the "this job has moved" banner is new.
- The import already keeps a planner date over Cienapps with `o.dueKeep` (skips a Cienapps date equal to `dueKeep`, clears it
  when Cienapps matches, writes `origDueDate` once). That IS the A6 rule, and old-version screens obey it. A planner move sets `dueKeep`.
- Delivery bookings have no week: `o.delDay` is a day name, `DB.delNotes` keyed by day name. "Clear Week" archives the board
  then UNTAGS every job, pool included. ~76 places read `delDay` — all must become week-aware.
- Merge: 3-way field merge (`m3`); delivery fields merge as one unit (`DEL_K`, `mDel`). New job fields merge without extra work;
  plain arrays keep both sides' additions.
- `logEdit` keeps only 40 lines → date history needs its own array.
- `pickReason` is hard-wired to `MOVE_WHY` → needs a list parameter.
- New settings keys must be added to `fullSettings`, `settingsFrom` AND `applyPlan`.
- Weeks: `getMonday`/`wkKey` in UTC (accepted failure: Monday 00:00–01:00 summer time). 2026 has ISO week 53 (Mon 28 Dec).
  Irish bank holidays `IE_BANK_HOLS` 2026–2028 with `isWorkDay`, `nextWorkDay`, `prevWorkDay`, `lsAddWorkDays` (local noon — safe across clock change).
- No Supabase table or column needed. Everything lives inside `orders` (job fields) and `settings`.

## Key questions — ASSUMED (Garry to confirm; recommended answer used)
1. Bookings already on vans at go-live — which week? **(a)** one-time question to the first office person "This week / Next week"; until answered they show under This week. (b) always This week (c) always Next week.
2. "Close week" (replaces "Clear Week — Start Fresh") — booked but not delivered jobs: **(a)** back to To Plan, flagged "not delivered Wk N — rebook"; delivered archived as today; other weeks, pool, notes untouched. (b) untagged as today.
3. Planner moved a date, then Cienapps sends a third date: shown in the import's Differs box with **Keep (planner) ticked by default**.
4. Import "Take" of a new Cienapps date follows the same rules (history reason "Cienapps import", off the van, banner). **Yes.**
5. "Already cut" = step 6+ OR any saw tick on any of the job's lists OR photo-list cut. Step 5 (programmed) is not cut — week follows, red chip "programmed — take it out of the nest".
6. New due date beyond the 8 board weeks → build week "Unscheduled" (same as `autoSchedule`). Past date → current week.
7. "moved N×" counts every due/delivery-date change after arrival, planner or Cienapps. Tap shows history.
8. A8: build date = Cienapps column E `dueDate`, still what board/saw/stores plan against. Delivery date `delivDate` = Cienapps column L or set in the planner. A planner change of delivery date SUGGESTS build = delivery − N working days (Settings, default 3), editable in the same dialog. An import never recalculates column E; it only flags "build after delivery" or "delivery moved in Cienapps, build didn't — check".
9. Pool grouped by delivery-date week when there is one, else due week (phase 1: due week only).
10. Site ready per job (or whole customer in one tap), for a particular delivery date; a booking/date change shows "confirm again". Office and PM can confirm.
11. Who moves dates: Office and Production Manager (name via `officeWho`). Saw, stores, drivers, floor read only. PMs in Job B.
12. Group move: "Set all to date", "Move all by ± N weeks", "Move all by ± N working days".
13. Weekend / bank holiday date: warning with one-tap "use the working day before"; can still keep it.
14. "Later" tab = pool only, grouped by week, no van grid.
15. A job already LOADED / DISPATCHED / DELIVERED stays on the van, flagged "date moved after loading — check".
16. Export Changes "Mark as applied" does not clear date rows; they clear when an import shows Cienapps has the planner date.
17. (Small fix) "this week" from the local date in `get8Wks` — removes the summer-time accepted failure.

## Wireframes
Date-change dialog (tap a due date on a board row or delivery card):
```
┌ Change dates — WO-2604-7 · Floor 1 · Unit 22 · Kitchen ────────┐
│ Due (build) date   [ 2026-11-20 📅 ]   was Thu 13 Nov (Wk 46)   │
│ Delivery date      [ 2026-11-25 📅 ]   (phase 2)                │
│ Why?  [Customer delay] [Site not ready] [Production]            │
│       [Materials] [Design/drawings] [Other]                     │
│ Note  [ optional — required for Other ]                         │
│ ── What will happen ──                                          │
│ • Build week: Wk 46 → Wk 47 (or: stays Wk 46 — already cut ⚠)   │
│ • Van: off Van 2 Tue 18 Nov → To Plan Wk 47 ("rebook")          │
│ • Saw/stores: cut by … · list due …                             │
│ • ⚠ flags (bank holiday, after delivery, moved out >14 days)    │
│ Original date: Mon 10 Nov · moved 2× before  [History ▾]        │
│                       [Cancel — change nothing]  [✓ Move date]  │
└──────────────────────────────────────────────────────────────────┘
```
Several jobs: same dialog with "Set all to [date]" / "Move all by [±N] [weeks / working days]"; "What will happen" is one line
per job (WO | old → new | week | van | flags), skipped jobs listed with the reason; after saving a summary
"N moved · N weeks kept (cut) · N taken off vans · N flagged". At 360 px: full width, reason buttons 2 per row, stacked cards, 44 px button.

Deliveries:
```
[ This week Wk46 (12) ] [ Next week Wk47 (8) ] [ Wk48 (3) ] [ Wk49 ] [ Later (14) ]   🏬 In store 5 (2 > 14 days)
(This week only) ⚠ Missed deliveries …   ⚠ N bookings from before week tabs — which week? [This] [Next]
Toolbar: ＋Add Job · 📋 Run Sheets (this tab's week) · 🖨 A3 Poster · ⬇ Export · 📚 Past weeks · 🔒 Close Wk46
TO PLAN — due Wk46 (+ overdue, + manual jobs with no date)  🔍 filter   ("📅 date moved — rebook" chips first)
Grid: Vehicle × Mon 10 Nov … Sat 15 Nov (bank holiday columns shaded) · Notes row (dated) · Value/day · Week total
```
In store panel: step 7/8 jobs not on a van, days in store (amber after 14), oldest first, "⤵ Book".

## What changes (for the Coder)
New helpers (local dates): `wkOf(iso)`, `thisWk()`, `wkPlus(wk,n)`, `slotWk(o)` (= `o.delWk || DB.delLegacyWk || thisWk()`),
`slotDate(o)`, `dueWeekFor(due)` (taken out of `autoSchedule`, same behaviour), `woCut(o)`, `DATE_WHY`.
`pickReason(title, sub, cb, onCancel, list = MOVE_WHY)`.

**Shared date engine (Job B will call it too):** `moveDates(jobs, change, reason, by, opts)` → `{rows, apply()}`.
- `change`: `{due?, deliv?, shift?: {n, unit:'wk'|'wd'}, field?: 'due'|'deliv'}`; `reason`: `{why, note}`;
  `opts`: `{src: 'planner'|'cienapps'|'group'|'pmseq', frozenDays?, requestOnly?}` (last two for Job B; accepted, unused in Job A).
- `rows` = pure preview: `{wo, from, to, wkFrom, wkTo, weekKept, vanPulled, vanKept, skipped, flags[]}`; flags `cut-week-kept`,
  `on-van-loaded`, `bank-hol`, `past`, `beyond-8wks`, `after-delivery`, `moved-out-N`, `site-reset`, `programmed`.
- `apply()` re-finds each job by WO, recomputes its row, writes the fields below, `logEdit`, `sched()`, returns a summary.
- Nothing else may write `dueDate` / `plannedWeek` as part of a date move.

Dialog `dateDlg(wos)` + `dateSummaryDlg(result)`. Board: `data-duedlg` on the due badge, chips "🔁 moved N×" and
"📅 due moved — check week" (tap: Move to due week / Keep, it's fine), "📅 Move dates (N)" on the selection bar, group row badge.
Deliveries: `delTab`, `placeJobs` writes `delWk` and clears `delRebook`; cell keys `veh|day|wk`; `delNotes` keyed by date
(old `'Mon'` keys read as legacy week); `dayVal(d, wk)`; "Close week" (backupFirst; only `slotWk(o)===wk`; archive entries get `w`;
Q2 for undelivered); `inStoreHTML()`; legacy-week prompt sets `DB.delLegacyWk`; `printPoster(wk)`, `exportDeliveries(wk)`, `printRunSheets(wk)`.
Week-aware readers (`slotWk(o)===wk && o.delDay===d`): `renderFloor`, `renderDriver`, `podKey`, `missedJobs` (missed = `slotDate(o) < today`),
`liveWeekJobs` / `weekPerf` / `scorecardHTML`, `renderDash`, `renderPM`, `renderProd`, `phOpen` DELIVERS label.
Import: Take via `moveDates(...,{src:'cienapps'})`; Keep default for a third date; count "Cienapps still has the old date".
Export: `datesToCien()` section "📅 Dates to change in Cienapps" + "Dates" sheet in the Changes Excel.
Saw/stores: `movedBanner(o)` until end of the next working day after the change.
Merge: `delWk`, `delRebook` into `DEL_K`; `PRE_K` gains `delWk`, `delRebook`, `dueHist` length (phase 2 `delivDate`/`delivKeep`).
Phase 2: `IMP_FIELDS` `delivDate` (aliases 'delivery date','install date','installation date','delivery/install date',
'delivery / install date','delivery install date' — not bare "delivery"), `delivKeep`, `holdChip(o)`, `siteOkDlg(wos)`.

### Data (inside `orders` / `settings` JSON — no SQL, no new column, no new top-level save key)
Job: `dueDate` (only via `moveDates` for moves), `origDueDate` (set once), `dueKeep` (set to old Cienapps date on first planner move;
deleted when new date equals it; never for `P-` planner WOs), **`dueHist`** `[{at,by,f:'due'|'deliv',from,to,why,note,src}]` (last **30** — lowered from 100 after Tester round 1: save of 2,500 jobs 9.2 s → 2.5 s),
**`dueMv`** `{at,by,from}` (week kept because cut), `plannedWeek`, **`delWk`** (Monday ISO, in `DEL_K`), **`delRebook`** `{at,by,why,was}` (in `DEL_K`),
`delMoves` (+ A4 entry), **`storeAt`** (first reached step 7/8; never written by a boot migration).
Phase 2: `delivDate`, `delivKeep`, `origDelivDate`, `siteOk {at,by,for}`, `dueHold {at,by,days}`.
Settings: `delLegacyWk`, `delivLead` (3), `siteDays` (5), `earlyDays` (14).

## What must NOT change
Auto-tagging and "never untags" (`delvOverride`); import Keep/Take, `planDiff`/`PRE_K` re-check; On hold untag rule (loaded never pulled);
saw/stores deadlines read `dueDate`; Past weeks archive entries without `w` still open/export; proof-of-delivery photos and driver's own run;
the save path (3-way merge, save tags, save check, `exportBase`); Floor/Unit separate, WO/Title separate, esc on every value; lists switch OFF behaviour.

## Risks
- Old screen left open: its "Clear Week" wipes every week's bookings (archived, but off vans); its board/driver show next week's
  Monday as this Monday. Mitigation: newer-version bar + close and reopen every device on go-live day; a `delWk` with no `delDay` = not booked.
- Two PCs: both move a date → later wins `dueDate`, both kept in `dueHist`. Book vs move → delivery fields merge as one unit; `delRebook` shows.
- Year end / wk 53 / bank holidays to 2028 / summer time — new code uses local-date helpers.
- 360 px phones — sideways-scrolling tabs and grid. Big group moves — preview capped at 50 rows. `dueHist` capped 30.

## Acceptance checks
Phase 1: (1) one move updates board, delivery card, saw, stores, list-due; history; origDueDate kept. (2) not-cut job's week follows;
cut job keeps week + chip. (3) booked job comes off van → pool of new week "rebook", logged + scorecard; LOADED stays + flag.
(4) moved 3× badge; moving back to Cienapps date removes it from the Dates list. (5) re-import with old date keeps planner date;
matching date clears; third date defaults Keep. (6) Mark as applied leaves date rows. (7) group move ×4 entry points + summary.
(8) 25 Dec / 28 Dec 2026 warnings. (9) next week's Tue booking not on this Tue floor/driver screens. (10) notes per week; closing a week leaves others.
(11) Close week: delivered → Past weeks "Wk N", undelivered → pool flagged. (12) per-week poster/export/run sheets. (13) In store + amber 14 days.
(14) year-end tabs Wk 52 · 53 · 1 · 2. (15) summer time Monday 00:30. (16) two-PC cases. (17) go-live legacy prompt. (18) 360 px. (19) full suite, switch OFF and ON.
Phase 2: (20) column L import. (21) delivery change suggests build −3 working days; build after delivery flagged. (22) moved out 21 days flag; step 5 red chip.
(23) site not confirmed amber; confirm logs who/when; moving booking → confirm again.

## Build steps
Phase 1: 1 helpers + pickReason list · 2 data plumbing (settings, DEL_K, PRE_K) · 3 moveDates preview · 4 moveDates apply ·
5 dateDlg single + board chips · 6 group mode + summary + selection bar · 7 Export Changes dates · 8 import (old-date count, Keep default, Take via engine) ·
9 movedBanner · 10 week-aware slots + legacy prompt + readers · 11 week tabs, dated notes, pool by due week, bank-hol columns, Move dates on Deliveries ·
12 Close week · 13 storeAt + In store · 14 per-week poster/export/run sheets + Full Schedule columns · 15 get8Wks local week · 16 full suite.
Phase 2: 17 column L · 18 settings numbers · 19 delivery date in dialog/engine/A4/Dates list/pool grouping · 20 A9 dueHold · 21 A10 siteOk · 22 full suite, Manager.

**Note for Job B:** `moveDates(jobs, change, reason, by, {src:'pmseq', frozenDays:14, requestOnly:true})` → store `rows` as a change request; `apply()` later.

---
## Go-live checklist (dates & deliveries) — Manager's conditions, 10 Nov 2026

**Before**
1. The 10 Nov release is live and has settled first (its own checklist, docs/GO-LIVE-2026-11-10.md, done; no open problems).
2. Go live on a **Monday, Tuesday or Wednesday** — never Thursday/Friday (Close week, run sheets and the weekend need watching).
3. Every PC's clock is set automatically (Windows: Settings → Time → "Set time automatically" ON). Week tabs and "this week" come
   from the PC's own date.
4. Old-screen guard v2 (SUPABASE_CHANGES.md, top block) — only if Garry says yes. It is run AFTER deploy (step 7).

**Go-live**
5. Deploy. Check in an **incognito** window: Deliveries shows the week tabs (This week · Next week · +2 · +3 · Later); move one test
   job's due date and move it back (tap the due date, pick a reason); the dot says **Synced**; Settings → Delivery dates shows **3 / 5 / 14**.
6. Close and reopen, **in person**, every office PC, the saw and stores screens, the floor screen, and **every driver's phone**.
   A screen left open on the old version can still "Clear Week" every week's bookings and its driver screen shows next week's Tuesday
   as this Tuesday.
7. (If approved) make one normal save from the new screen, then run old-screen guard v2.
8. The person who plans the vans answers the one-time question on Deliveries: bookings from before the week tabs are for
   **This week** or **Next week**.

**Rollback**
9. FIRST undo guard v2 (re-run the 3 Nov guard SQL), THEN put the older code back.
10. Before going back, check the **Next week / +2 / +3** tabs: the older code has no weeks and shows every booking on this week's days.
    Write those bookings down (or Export each week) so they can be re-booked.

**Who to tell**
- **Office:** "Clear Week" is now **Close week** (one week at a time; not-delivered jobs come back to To plan marked "rebook").
  To change a date, **tap the due date** (board row or delivery card) and pick a reason. **Dates to change in Cienapps** (Export
  Changes) lists every due / delivery date to **type into Cienapps by hand** — it stays until an import shows Cienapps has it.
- **Drivers:** run sheets and the driver screen are now **dated** (pick the day from the list; next week's days are marked).
- **Saw / stores:** a card can show "this job has moved" and "⏳ moved out — don't cut early".
- **PMs:** booked deliveries within 5 working days show **"site not confirmed"** — tap to confirm the site is ready
  (or "Site ready for all" per customer).

---
## Progress log

### 10 Nov 2026 — Coder, steps 10–15 (scheduled run)
- **10** week-aware bookings (`d84b621`): `placeJobs(…, wk)` writes `delWk`, clears `delRebook`; helpers `slotIn`, `slotLblO`, `dShort`,
  `floorSlots`, `delTab`/`delTabWk`, `delNoteGet`/`delNoteSet`, `delLegacyJobs`/`setLegacyWk`. Readers by real date: floor, driver (day picker
  = dated days of this + next week; old plain "Tue" = this week; a stale week → today), `podKey(veh,day,wk)`, missed / never left (date gone,
  any open week), `liveWeekJobs(wk)`, dashboard, PM, Production, saw/stores DELIVERS label. Legacy question on Deliveries (office only).
- **11** week tabs (`1095e1d`): This week · Next week · +2 · +3 · Later, plus a tab for any past week still holding bookings (and any booked
  week past +3). Pool by due week (overdue / no date / manual → This week; past +3 → Later, grouped by week); "rebook" group first;
  bank-holiday columns shaded; notes per date; "📅 Move dates (N)".
- **12** Close week (`b3b3362`): `closeWeek(wk)` — see commit. Archive entries get `w`, `by`, the week's notes (by day name, so the old
  viewer/export read them) and photos. Delivered cards left in the pool are archived with the week they were delivered in.
- **13** `storeAt` + In store (`2359dc6`). **14** per-week poster / export / run sheets + Full Schedule columns (`a1e02bf`). **15** `get8Wks`
  local date (`41821d3`) — weeks.test.js summer-time check passes now (marked in ACCEPTED-FAILURES for Garry to remove).
- Fix (`c138587`): an import date Take no longer pulls a job off its van when Cienapps (same import) says it is shipped.
- Tests: tests/dates/c5-weeks, c6-close-instore, c7-prints (all pass).
- Full suite (186 files): **3,328 pass / 31 fail**. Baseline at the plan commit 88fc13c (179 files): 3,207 / 25. 24 of the 31 are the
  baseline's accepted failures (the summer-time one now passes). 7 are old checks that test behaviour this plan changed on purpose:
  dates/c2-dialog "delivery card shows 'date moved — rebook'" (the card is now on its due week's tab, Wk 49 — with that tab opened the
  whole file passes 17/17); stage1/s10 "backup rows taken before Clear Week" (backup reason is now "Close week Wk N"); stage2/accept-board
  AC18 (Full Schedule's last two columns are now Orig due / Moved ×); stage2/autotag-delivery "WO-800-1 … in the pool" (due Wk 45, so it is
  in the Wk 45 tab's pool, not This week's); stage3/flow-attack1-switchoff dash/office-l/prod "same screen as stage2" (dates added to van
  labels, dashboard "missed" wording).

### 10 Nov 2026 — Coder, Tester round 1 fixes + phase 2 (steps 17–21)
- Round 1 fixes: `286afae` booking merges as one unit (van/day/week/rebook), both-PC date moves merge as a unit (newer move wins),
  dueHist sorted by time, same-day notes keep both texts · `4656789` old-screen bookings: legacy week only for bookings made before
  the answer (`settings.delLegacyAt`; a booking placed/moved later or in a later week = this week); stale "rebook" on a booked job
  dropped on load · `b1c7e56` Close week reloads from the database first; loaded / on-the-road jobs stay on their van ·
  `517f23b` dueHist cap **30**, import Take on a cut job sets the "check week" chip, bank-holiday booking asks, on-hold jobs flagged
  in the preview and still moved (ASSUMED) · `0686193` docs (ACCEPTED-FAILURES rows: old-screen Clear Week ×2, old-screen legacy-week drop).
- Phase 2: **17** `26d0f0a` column L delivery date (aliases as planned; delivKeep; flags only) · **18** `33cd40f` Settings delivLead 3 /
  siteDays 5 / earlyDays 14 · **19** `56b914b` delivery date in the dialog (suggests build = delivery − delivLead working days, editable)
  and engine; A4 follows the delivery date when there is one; Dates list rows for Due (E) and Delivery (L); pool by delivery week ·
  **20** `c59a7c0` A9 dueHold "⏳ moved out — don't cut early" · **21** `afcc378` A10 siteOk · tests `7f6b427` (c8-deliv-import,
  c8-deliv-engine, c8-hold-site).
- ASSUMED in phase 2: an import that changes the delivery date does not take a job off its van (it is flagged); "Set all to" in a
  group move sets the due date only ("Move all by" moves delivery dates too); "within range" for A9 = moved back to within earlyDays
  of the date it moved from, or the due date now within earlyDays of today; "site ready for all" confirms every booked, not-yet-
  confirmed delivery of that customer, each for its own date.

### 10 Nov 2026 — Coder, Tester round 2 fixes
- `6974f96` engine + dialog: delivery date set to the booked day keeps the van booking; lasting "build after delivery — check"
  flag (dueAfterDeliv) on board row + delivery card; a typed build date is never overwritten (suggestion + "Use <date>");
  empty delivery box removes the date (reason, history, Dates-list row); **A9 measured from origDueDate, or from the due date at
  the last "OK to cut" — ASSUMED, Garry to confirm**.
- `4aa59af` import: Cienapps moving a booked job's delivery date leaves a lasting "booked … — delivery date now … — check" chip
  (delivMv, clears on rebook / match); a third Cienapps delivery date has Keep / Take in the preview (Keep default), Keep sets
  delivKeep to the real Cienapps date.
- `c927f78` Settings delivLead / siteDays / earlyDays: whole numbers 1–60 only, on screen and when loaded.
- tests/dates: all pass except the 3 accepted attack1-oldversion checks. Full suite (199 files): **3,571 pass / 27 fail** — the 3
  accepted old-screen checks plus the baseline accepted list (t17 A'1/A'2 timing checks are back in it this run).
