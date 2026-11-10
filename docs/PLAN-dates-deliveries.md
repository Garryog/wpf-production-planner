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

### 10 Nov 2026 — Coder, Manager's conditions
- `2e19002` merged origin/release/2026-11-10 (new key wpf_apps_nov26 = the release's SUPA_KEY, listDelOnly switch, GO-LIVE doc);
  clashes in applyPlan / fullSettings resolved keeping both sets of keys. tests/stage3/x3-deliv-only 8/8, all tests/dates pass
  except the 3 accepted attack1-oldversion checks.
- `e510864` + `32100f0` old-screen guard v2: settings.appRel = 2 on every save; clear "out of date — refresh the page" message
  on refusal (c9-guard-v2); PENDING SQL at the top of SUPABASE_CHANGES.md, checked twice on a throwaway Postgres 16
  (tests/dates/pg-guard-v2.sql: ALL GUARD V2 CHECKS PASSED).
- Go-live checklist section added above.
- Full suite (201 files): **3,582 pass / 28 fail**. New vs the last run: stage3/flow-attack1-switchoff "switch off: saved settings
  have the same keys" — the saved settings now include `appRel` (the guard-v2 marker, wanted on every save); the lists switch-off
  behaviour itself is unchanged. Everything else is the accepted list.

### 10 Nov 2026 — end of run: Manager final verdict on Job A = **GO** (code complete)
- Tester round 3 (3f5e835): switch-off settings check allows `appRel`; listDelOnly + date settings survive save/reload; guard v2 works
  app-side (refused save kept on the device, 10-Nov screen refused once a new screen has saved, two new screens still merge).
  One Medium — a refused 10-Nov screen says "will retry" — on ACCEPTED-FAILURES (ca3385f), go-live day: close every screen.
- **Manager: GO.** Conditions are for go-live day and Garry only: 10 Nov release live and settled first; Garry signs off the ASSUMED
  answers (Key questions 1–17 + phase 2 list) and the 4 new ACCEPTED-FAILURES rows; yes/no to guard v2 (try on a Supabase TEST project
  first); go live Mon–Wed; follow the go-live checklist above.
- Screenshots (fake database) sent to Garry: week tabs, next week, In store, board chips, one-job and group date dialogs, Dates to
  change in Cienapps, phone 360 px.
- **Next run: Job B** — cut feature/project-details-v2 work from feature/dates-deliveries (rebase/merge the parked
  feature/project-details 9 Nov work onto it), write docs/PLAN-project-details.md B5–B11 (send Garry the B11 date-tools wireframe
  before building them), build B1–B4 fixes + B5–B10.

---
## Addendum, 10 Nov 2026 (evening run): Deliveries usability D1–D4 + DD1 (Garry 10 Nov, TOP PRIORITY before Thursday)
Architect, unattended. Garry's words and items are in docs/ROADMAP.md ("Delivery page usability", "Due dates prominent everywhere",
"Delivery pool cards are messy"). ASSUMED = Architect's call, Garry to confirm.

### Exists vs missing
- D1: `dchip()` has a "due … Wk46" link (`data-duedlg`) that opens the full `dateDlg`. Missing: quick tap → date picker → reason.
- D2: tabs This week · Next · +2 · +3 · Later (+ open past weeks) with counts. Missing: ◀ Prev / Next ▶, "This week" button, Monday date
  on tabs, current-week marker separate from selected tab, sticky heading.
- D3: only "📅 Move dates (N)" in the selection bar. Missing: "→ Next week" / "Move to week…" per card, "Move ticked to week…", drag onto tab, target-day rule.
- D4: `.dchip-top` one non-wrapping row; WO, Floor/Unit, € and three 32 px buttons are nowrap → spill past the 216 px card.
- DD1: `dueBadge(due,pw,origDue)` exists (board row + group row) with different colours (amber = within 14 days).

### Decisions (ASSUMED)
1. New helper **`dueTag(o, opts)`** (name `dueBadge` is taken; old one stays on the board group row until Job B). `movedTag(o)` = "🔁 moved N×"
   chip lifted out of `dmChips`, one copy.
2. `dueTag` text "Fri 14 Nov · Wk 46" (year only if not current year). Red = before today; amber = this week (Mon–Sun); grey otherwise;
   "no due date"; manual jobs "manual — no date" or "planned Wk N". Delivery date as second tag "🚚 Tue 18 Nov · Wk 47". A button only if
   `dateCanMove()`. Board option `{late:true}`: also red when planned week ends after due; keeps "(orig …)". Board amber becomes "this week".
3. moved N× = number of `dueHist` entries; tap opens history. The van-move chip (`delMoves`) becomes "🚚 rebooked ×N".
4. **Week move target day**: engine change type `change.toWk = Monday`, per job `wkMoveTo(o,W)`: anchor = delivery date if any, else due date;
   k = whole weeks anchor-week → W; due and delivery both move k×7 days (gap kept). Non-working day → working day before in the same week,
   else after in the same week, else kept + bank-hol flag. Earlier than today → today / next working day; none left in the week → nothing moves,
   toast "No working days left in Wk N — pick Next week". Cienapps job with no due date → last working day of W. Overdue jobs on This week:
   "→ Next week" = shown tab week + 1.
5. Every week move goes through `moveDates(jobs,{toWk:W},reason,by,{src:'planner'})` — A3–A9, dueHist, dueKeep, banner, Dates-to-Cienapps unchanged.
6. Manual jobs (Add Job, no due date): "Move to week…" sets `planWk` (Monday) on the `delx` entry, reason asked, `logEdit`. `delPoolWk` reads it; past week → This week. No new top-level key.
7. Booked cards get no week buttons; if ticked/dragged to a week the preview says "comes off its van → rebook" (loaded stay + flagged); confirm. Dropping on a van cell = booking only.
8. Drop on "Later" → "Move to week…" with Wk +4 chosen. Prev/Next range: earliest open past week … +12; a week outside the strip gets a temporary tab.

### What changes
- **D1** `dchip` uses `dueTag`, hidden `<input type=date class=dq-in data-dq=WO data-f=due|deliv>`; tap → `showPicker()` (fallback focus);
  change → `officeWho` → `pickReason(title, sub, cb, null, DATE_WHY)` with sub from the moveDates preview row ("Fri 14 Nov → Fri 21 Nov · build
  week Wk46 → Wk47" + van line + `dmFlagTxt`) → apply → toast "Due now Fri 21 Nov · Wk 47 — card is on the Wk 47 tab"; flagged → `dateSummaryDlg`.
  "⋯" on the card still opens full `dateDlg`. Same on the board row.
- **D2** sticky `#del-wkbar` above the tabs: [◀ Prev] Wk 46 · Mon 9 Nov – Sat 14 Nov [Next ▶] [This week], ≥44 px; top = measured `.tabs` height.
  Tab label "This week · Wk 46 · 9 Nov (12)"; class `cur` (green underline + ●) on the real current week, `on` = selected; scroll selected tab into view;
  fix `if(!tabs.includes(delTab))delTab='0'` so Prev/Next weeks are added not reset; hide "Close Wk N" when nothing to close.
- **D3** `wkMoveTo`; `dmTarget`/`dmDelivTarget` handle `toWk`; `dmRow` turns err into skipped. Pool cards (not booked): `→ Wk 47` + `Move to week…`.
  `wkPickDlg(wos)`: This week … +12 "Wk N · Mon d Mmm (n jobs)" + "or a date… → dateDlg". Selection bar "📅 Move ticked to week… (N)".
  Week tabs `ondragover/ondrop` via `delDragList` (PC), highlighted while dragging. One preview + one reason per drop/group; preview list first only
  if anything is flagged/skipped/off a van, else reason picker alone (2 taps).
- **D4** card: row 1 WO left, buttons right; row 2 Floor/Unit badges (wrap); title (2 lines max); dueTag (+ delivery tag) + movedTag; status /
  readiness / flag chips + customer. `.dchip{box-sizing:border-box;min-width:0;overflow:hidden}`, `.dchip-top{flex-wrap:wrap;min-width:0}`, badges
  `max-width:100%;overflow:hidden;text-overflow:ellipsis`. Remove `.dcv` € from cards (pool + grid); group header drops €; footer `.dgrp-f`
  "6 jobs · €48,200" under every group (rebook and Later too). Grid Value/day row and week total stay.
- **DD1** dueTag/movedTag on pool cards, grid cards, In store rows (`inStoreHTML`), board row due cell (`{late:true}`). Later (Job B): board group row,
  Shipped, Cutting Lists, Saw, Stores, dockets/run sheets, A3 poster, Full Schedule export, floor and driver screens.
- Data: only `planWk` on manual `delx` entries. No SQL.

### Must NOT change
Close week, legacy-week question / `slotWk`, Past weeks archive (with and without `w`); van placement = booking only; A3–A9, dueHist cap 30,
dueKeep / import Keep-Take; auto-tag, never-untag, On hold, lists switch OFF / listDelOnly; board group-row badge; save/merge (DEL_K); esc on every value;
Floor and Unit separate; saw/stores deadlines read dueDate.

### Risks
Old tests check old card text (due … Wk46, "🔁 date ×", € on card/header) → update as intended changes, list in the log. No drag on phones → buttons cover all;
showPicker needs Chrome 99+. Two PCs moving one job → newer wins, both in history. Manual planWk on two PCs → last save wins.

### Acceptance checks
1 Tap due on pool card → Fri 21 Nov → reason → card on Wk 47 tab, history, moved 1×, Dates-to-Cienapps row; board/saw/stores new date; cancel = no change.
2 → Next week: Wed 12 Nov → Wed 19 Nov; overdue Wed 4 Nov on This week → Wed 19 Nov; with delivery date both move, gap kept.
3 Fri 18 Dec +1 → Thu 24 Dec; Mon 21 Dec +1 → Tue 29 Dec (Wk 53); Thu 31 Dec +1 → Thu 7 Jan 2027; Prev/Next walk Wk 52 → 53 → 1; Oct bank holiday.
4 No-due-date Cienapps job → last working day of target week; manual job → Wk 48 pool, reason logged, never in Dates-to-Cienapps.
5 Cut job → tab moves, build week kept, "due moved — check week". 6 Booked job ticked → preview off van → rebook in new week; LOADED stays, flagged.
7 Tick 5 (cut, manual, booked) → Move ticked → one reason → summary right. 8 PC drag one / three onto tab; drop on Later → picker at +4; van cell = booking.
9 Week bar sticky, labels "Wk N · d Mmm (count)", current week marked, Close hidden on empty past week.
10 360 px and 1366 px, longest WO+Floor+Unit+title: no overlap pool or grid; no € on cards; group footer total correct.
11 Colours: yesterday red, Fri this week amber, next week grey; board row same style + still red when planned week after due; In store same tag.
12 Saw/stores/driver/floor see the tag but can't open the picker. Full suite with lists switch OFF and ON.

### Build steps
1 dueTag, movedTag, CSS, "rebooked" chip · 2 new dchip layout, € to group footer, 360 px · 3 board row + In store · 4 D1 quick edit ·
5 wkMoveTo + toWk + engine tests · 6 card buttons + wkPickDlg + selection bar · 7 manual planWk · 8 tab drop targets ·
9 week bar, labels, cur, Prev/Next fix, Close hidden · 10 update old tests, full suite, screenshots.
