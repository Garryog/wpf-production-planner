# Plan: Project sequence — shipped jobs drop off, real steps, one source for every field (27 Nov 2026)

Approved by Garry 27 Nov 2026 (all three key questions answered with the recommended default).

## Goal
The project sequence shows only work still to do. Once a job ships or is delivered it leaves the list and the rest renumber 1, 2, 3… Each row shows the job's real planner step (the same badge as the Capacity Board and every other page), where it is on Deliveries, and whether its cutting list is ready / checked. Every number and date on the sequence comes from the same place as the board, Deliveries, Cutting Lists and Export Changes.

## Decided (Garry, 27 Nov)
- Shipped work orders DROP OFF completely — no "show finished" link. Replaces the 12 Nov and 26 Nov ROADMAP lines.
- "Finished" = the app's existing `woFinished(o)` rule (on the Shipped tab, OR Cienapps step 9 / 10 / 11, OR delivered on Deliveries; a job brought back from Shipped is live again until delivered again).
- Finished rows don't count anywhere on the sequence: numbering; date tools (tick bar, Whole house / Whole block / From here down, Spread); Whole-house moves and Move to #; "Put them under row #" on a Cienapps file; PM nudge counts; "dates differ" agree box; "taken out" list; pre-production pool.
- On-hold jobs are not finished: they stay, badge says ON HOLD.
- Progress column = the planner step badge + Deliveries status + list status.
- Q1: a job brought back from Shipped → its row comes back in its old place with a small "↩ back from Shipped" tag. Nothing written to the database.
- Q2: a shipped job the board still shows because of held list lines ("📦 n waiting") → drops off the sequence.
- Q3: pre-production "processed" tick → removed from the sequence Progress (stays in Johnny's pool).

## What changes (for Garry)
- 🔢 Sequence page: shipped / delivered work orders disappear and numbers close up. If every job of a project has shipped: "All n work orders in this sequence have shipped." — Start is NOT offered again.
- Progress column (replaces "list ✓ · processed — · cut ✓ …"):
  - the step badge, e.g. ASSEMBLY COMPLETE — same grey badge as board, lists and Deliveries cards;
  - delivery status worded as on Deliveries: "🚚 to plan" (tagged, not booked) · "🚚 Van 2 · Tue 2 Dec" (booked) · LOADED / DISPATCHED with time; "in store" when step 7–8 and not booked (same rule as the In Store list);
  - list status, same chips as the board: "📋 no list" (red when late) / "📷 photo list" / list ready; "waiting for check" / "✓ checked" only when the "lists must be checked" switch is on.
- Floor / Unit / Name show the job's own values (as the board); a ✎ correction shows at once; a different Cienapps-file line name shows small and grey underneath.
- Build also shows the board week ("wk 49" / "Unscheduled").
- Moved = the board's "🔁 moved n×" button, tap for history.

## Field check
| Field | Today | Same as other pages? | Fix |
|---|---|---|---|
| Step | not shown; Progress home-made | No | `stepBadge(o)` |
| Required date | delivery date else build date | Yes | — |
| Build date | job due date | Yes | add board week |
| Date changes | `moveDates` (src 'pmseq') → week, van, due history, Export Changes | Yes | — |
| Waiting-row date | row `req_date` | Correct | — |
| Floor / Unit | row copy first | No | job `fuF`/`fuU` when matched |
| Name | row name first | No | job title when matched; upload name grey if different |
| Whole house / block grouping | row copy | No | same fix in `seqHouseOf` and block tick |
| ✎ job details | `jobInfoSet` → Export Changes | Yes | — |
| List status | any list incl. archived / templates | No | `woListOk`, board no-list chip, `lsCheckChip` |
| Delivered / van | own mix | Partly | `dStage`, `slotLblO`, In Store rule |
| Moved | due history | Yes, not tappable | `movedTag(o)` + `dmBindChips` |
| Shipped / finished | 3–4 home-made tests | No | `woFinished` everywhere |
| P-number | merge code | Yes | — |

## Must NOT change
- Nothing in `project_seq` is changed, removed or renumbered — screen filter only, no Supabase change.
- ▲ ▼, drag, Move to # still go through `seq_move` with a visible anchor row; hidden rows keep their DB place; fixed-window lock and requests as now.
- Cienapps upload: a line for a shipped house is still skipped "already in the sequence (shipped)", never re-added; preview agrees with the database.
- Import matching: new WOs still match waiting rows; a fully-shipped project still gets 🆕 rows for new WOs.
- Shipped tab, Capacity Board, Deliveries, Cutting Lists, Export Changes, P-number merge unchanged; `woFinished` itself unchanged.
- History still shows everything.

## Risks
- Two PCs: the other PC drops the row at next poll/redraw; ticks cleared; a move started on the old list fails "stale" and reloads (as today).
- A waiting move/date request on a row that has since shipped: approving says no longer in the sequence / already shipped — not changed.
- Edge in the shared rule: brought back, delivered again, delivery week archived → row may reappear (same edge on Cutting Lists today). Leave `woFinished` alone; Tester confirms; Garry accepts or a later small fix.
- Phone (Chrome): Progress cell longer — badges must wrap, table must not widen.

## Acceptance checks (Tester)
1. Each takes the job off on next redraw, numbers 1…n no gap: step 9 by hand on the board; import saying 9/10/11; driver ticks delivered; archive a delivery week with the job delivered.
2. "↩ Bring back to board" → row back in old place with "↩ back from Shipped".
3. Shipped row between rows 3 and 4: ▲ ▼, drag, Move to 4, Whole house move only visible rows; tick bar / Whole block / From here down / Spread never include it, no date written to it.
4. Cienapps file with a shipped house's line → Skipped "(shipped)", not added; preview count = DB adds.
5. Every row shipped → "All n … have shipped", no Start; a new WO in next import still lands 🆕.
6. PM nudge counts and agree box ignore shipped rows.
7. Progress badge text = board step dropdown text = Deliveries card badge, steps 1–8 and ON HOLD.
8. Delivery status = Deliveries card for tagged/booked/loaded/dispatched.
9. List chips = board for no list (late / not late), photo, ready, "No list needed"; check chips only when the switch is on.
10. ✎ Unit → row and Whole-house grouping follow at once; Export Changes lists it.
11. Date change from the sequence moves board week, van and Export Changes exactly as the same change on the board.
12. Pre-production pool and taken-out use the same finished rule.
13. No `project_seq` write except existing moves, dates and upload (fake DB write log empty after shipping a job).

## Build steps (Coder)
1. `function seqDone(o){return !!o&&woFinished(o);}` beside `seqRows`. `seqRows(pid)` = current filter + `!seqDone(seqJob(r))` (waiting rows and rows whose WO isn't in the planner stay). New `seqRowsAll(pid)` = today's `seqRows`. Leave `seqMaps().rows` / `seqWoRow` unchanged.
2. Use `seqRowsAll` where "does a sequence exist" / DB matching matters: `seqPageHTML` start check (+ "all shipped" message); `seqReconcile1`; `seqConfirmHTML` guard; `seqNudges` second loop; `seqUpPreview` rows0 and Start re-check in `seqUpSave`; `seqClaimPreview` live; `seqUpPreview` rowLbl "shipped — WO-x". `seqProjsWithRows` unchanged.
3. Replace home-made finished tests with `seqDone`/`woFinished`: `seqJobsToStart`, `seqJobsNoRow`, `seqTakenOut`, `seqAgreeRows`, `seqNudges` (drop local done), `preRows` gone() → `woFinished(o)||isOnHold(o)||woCut(o)`.
4. Rewrite `seqProgress`/`seqProgHTML`: `stepBadge(o)`; delivery via `dStage`/`dStageLbl`/`dStageTime`, else `slotLblO(o)` when `o.delDay`, else "to plan" when `o.delv`, else In Store rule; list via `woListOk(o)` + board no-list chip moved to a shared helper (e.g. `woListChipHTML(o)`) + `lsCheckChip`; `o.shipBack` → "↩ back from Shipped". Remove `woCut` and seq_pre "processed".
5. Floor / Unit / Name: matched rows use `fuF(o)`/`fuU(o)`/`o.title`, `r.name` grey if different; same in `seqHouseOf` and the 'block' tick in `seqBind`. Do NOT change `seqLk`/`seqHk` or DB `house_key`/`line_key`.
6. Build cell + board week label; Moved cell `movedTag(o)` + `dmBindChips(root)` in `seqBind`.
7. FULL suite; list old tests that checked the old Progress words — don't silently change them.
8. ROADMAP: replace 12 Nov line and 26 Nov "Show shipped (n)" with today's decision; installation from the sequence → Shipped tab. No SUPABASE_CHANGES entry.

## Tests to write (tests/seq/)
ship1-drop (checks 1, 2, 5) · ship2-tools (3) · ship3-upload (4) · ship4-progress (7–9) · ship5-fields (10–11) · ship6-one-rule (12–13 + archived-week edge, expected to fail for Garry to accept or fix).
