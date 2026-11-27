# Trust audit before full roll-out — 27 Nov 2026

Garry, 27 Nov: "if a job is marked as shipped it should not be on the deliveries page in any screen. is there any other silly
things like this … it is important to people to trust the system from the start".

Three independent sweeps of the LIVE version (`main` at dcb8089, after #20), fake database only, nothing changed. "Proved" = seen
happening on screen in a probe; "read" = found by reading the code. Line numbers are `index.html` on that commit. Shipped jobs on
Deliveries is already fixed on pull request #16 (not merged) and is not repeated here. Nothing below is fixed yet.

## A. Fix before roll-out (people will hit these in week one)

| # | What people see | Where | Proved? | Smallest fix |
|---|---|---|---|---|
| 1 | A job the driver tapped DELIVERED comes back onto Deliveries after the next Cienapps import (Cienapps still at step 6/7/8), and is archived a second time at Close week. Counted again in "Delivered this week". | import auto-tick 12017–12024, `delvAutoOk` 2774 | Proved | Auto-tick never re-tags a delivered job. Bug in the 26 Nov rule. |
| 2 | A delivered job stays on the Capacity Board as a normal row, its hours still in the week, until Cienapps is updated. | `boardOrders` 1791, `planOrders` 1780 | Proved | Build Garry's 12 Nov decision "driver confirms delivery → step JOB SHIPPED" (not built anywhere). Also cures 1. |
| 3 | Saw and Stores show lists for shipped / installed / delivered jobs as "⚠ OVERDUE" for ever if nobody ticked them complete; counted in Print today and the dashboard tiles. | `workLists` 8835 | Proved | Leave finished jobs' lists out of TO DO (keep on DONE). |
| 4 | Any office user can delete a job for good with one 🗑 and an OK — no undo, even with a van booking or a list. "Clear All Orders" sits beside "New Work Order". | 2262, 2555–2563, 2357 | Proved | 🗑 behind the Admin PIN or refused when the job has a list / booking / sequence row; Clear All moved into Settings. |
| 5 | Saw / Stores cards say "DELIVERS 1 Dec" — that is the build due date; the van is booked Thu 3 Dec. | 9584, 13848, 13860 | Proved | Show the van booking, else the delivery date, else say "DUE". |
| 6 | Capacity Board group rows keep shipped and on-hold jobs ("3 WOs · 30h" when one is live); the group's 🚚 and week move act on them too. | `grpMembers` 2134, 2265–2292, 2513, 2522 | Proved | Groups on the board = live jobs only. |
| 7 | Week tile shows "7.199999999999999h / 350h". | `wkHrs` 1792, 2321 | Proved | Round to 1 decimal. |
| 8 | A job marked "No list needed" still shows red "AT RISK — no cutting list" on Production Today, and "no cutting list" on the driver's and PM's phone. | `woReady` 13279, 10214, 10217 | Proved | Treat "no list needed" as ready everywhere (the Deliveries card already does). |
| 9 | Overdue jobs not on a van vanish from the PM's Deliveries page; the header says "12 coming up" when there are 30. | 10152–10157 | Proved | Count before cutting the list; add "LATE — not on a van" first, in red. |
| 10 | Saw: late rows in the "waiting for a cutting list" panel are grey text on red — unreadable. | 6238, CSS 523 | Proved | Text colour inherits on late rows. |
| 11 | One tap moving a job's week shows "moved 2×" (build and delivery dates each counted). Production Today counts van rebookings under the same words. | 12836, 12847, 13003, 13972 | Proved | One tap = one move; call van changes "rebooked". |

## B. Garry to decide

1. **Old jobs with no list (about 109 at Job Cut or later):** each shows red "NO LIST YET / NOT READY" on its delivery card and raises the saw's red banner when booked. Rule is Garry's (26 Nov). Options: bulk-mark jobs already cut "No list needed" before roll-out (recommended) / grey "no list on file" for steps 6–8 / leave.
2. **Big green button signs a list off with nothing ticked** (Saw CUT COMPLETE, Stores FITTINGS PICKED). Ask "2 of 3 rows not ticked — mark the whole list?" (recommended) / leave fast.
3. **Jobs planned in a week that has passed** are in no capacity tile, so this week looks lighter than it is. Add an "Earlier weeks — not finished" tile (recommended) / roll them into this week / leave.
4. **Assembled / palleted jobs** are left out of "Due in the next 7 days — not on a van" on Production Today. Include them (recommended) / leave.
5. **A job cancelled in Cienapps** stays on the board with no mark (imports never remove jobs — Stage 2 decision). Flag "not in the last Cienapps file" (recommended) / leave.
6. **Driver's van:** pull request #16 keeps a loaded / on-the-road job on the driver's run after it ships, until he taps delivered (decision of 20 Nov). Still wanted, given "not on any screen"?

## C. Smaller — tidy when convenient

- Correcting a job's Unit / Title does not reach the PM sequence or the pre-production pool (4960, 4775). Proved.
- An on-hold job looks like a normal row in the PM sequence (4956). Proved.
- Group row says "OVERDUE" while its jobs are amber "Wk 48" (2285). Proved.
- Tile number bigger than the list under it with no "…and N more" (13971, 10126). Proved.
- Board link says "2 shipped", the Shipped tab "1 shipped" — the link counts on-hold jobs (2354). Proved.
- Full Schedule Excel and the offline snapshot total more jobs than the board (shipped / on hold included) (12522, 11297). Proved.
- Dates still written four ways ("Wk 49", "Due Tue 1 Dec", "1 Dec 26", "1 Dec") — DD1 not applied on saw, stores, dashboards, PM coming-up, sequence. Proved.
- "Delivered this week" tiles show every delivered job from any week not yet closed (10086, 10154). Read.
- Pre-production "✓ Processed" and driver "DELIVERED ✓" are solid green before they are pressed — read as already done (4763, 10326). Proved.
- Snags "Create cutting list" asks for a date typed as YYYY-MM-DD (8437). Proved.
- PM phone (360 px): job title squeezed to one letter in Coming up rows (10158, CSS 520). Proved.
- PM with no project / project with no PM: read-only with no word on who fixes it (4966, 4786). Proved.
- Production Manager's Deliveries page tells him to use the Capacity Board, which he does not have (10544). Proved.
- Words: "WAITING ON MATERIAL" vs "stock" on Stores; "Which Pre-production are you?"; "Saved ✓ — list is with the Saw & Stores" above "no Stores"; "Save as template" offered to the office then refused; "(L4b)" in an alert; step drop-downs cut off at 1366 px; "0 booked this week" on other week tabs; A3 poster has no Floor / Unit.
- Role picker at 360 px: the PIN box is below ten buttons (partly proved — headless only).

## Checked and fine

No "undefined" / "NaN" / raw dates on any screen; no sideways scroll at 360 px (except the Settings tab strip); about 420 jobs redraw in under half a second. On-hold jobs are off every list they should be off. Deliveries counts match their cards; week numbers, bank holidays, step wording and the red / amber rule agree across board, cards, list window and pool. Import → Apply, step change, booking, list save, saw / stores ticking with Undo, driver loaded → delivered and the PM sequence all did what their messages said and were on the fake server after a reload.

## Not checked

Lists switched OFF; real phone (touch, keyboard); a real Cienapps export; two screens at once and offline messages; label printing, run sheets, A3 poster output; photo upload; Settings; week close and Past weeks; the weekly scorecard sums; clocks changing at midnight.
