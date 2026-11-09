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
deleted when new date equals it; never for `P-` planner WOs), **`dueHist`** `[{at,by,f:'due'|'deliv',from,to,why,note,src}]` (last 100),
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
- 360 px phones — sideways-scrolling tabs and grid. Big group moves — preview capped at 50 rows. `dueHist` capped 100.

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
## Progress log
