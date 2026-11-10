# Stage 2 plan: Safer imports + Shipped tab

## Goal
Importing the Cienapps file can never delete, duplicate or scramble a job. Shipped jobs move to their own Shipped tab instead of vanishing. Steps and dates follow the rules Garry has agreed, and the import is built so the Cienapps API can feed it later.

## Key questions (answer before build)
1. **What does an A/C suffix look like?** Recommend: one letter right after the number, e.g. `WO-2604-7A` or `WO-2604-7-C`. That line folds into `WO-2604-7`: its value and hours are added, it's listed under "Additions", and a "+A" badge shows on the row. If the base WO isn't on the board or in the file, the line stays as its own job and is flagged "base not found".
2. **Step order.** Recommend: use the number at the front of the step ("3." comes before "4."). Unnumbered steps rank Drawing < In production < Assembly < Assembly complete/Palleted < Production complete < Shipped < Invoiced. If a step can't be ranked, it goes to the Differs panel and nothing moves.
3. **Name of the sheets column.** Recommend recognising "Sheets", "No of sheets", "Sheet count" and "Boards". Garry to confirm the real header.
4. **Invoiced and drawing-stage jobs.** Recommend: "invoiced" goes to the Shipped tab, same as "shipped". A job already on the board that Cienapps now shows at drawing stage, or a WO-D, stays and is flagged "check". No import removes any job. This is stricter than today.
5. **Hand-set hours vs a Cienapps Hours column.** Recommend: the planner's hours win. Cienapps hours only replace hours that were estimated from value.

## What changes
- **Import tab.** One pipeline in clear stages:
  - `doImport`: file to rows.
  - New `normaliseRow`: tidies each row and tracks which fields were actually supplied, so a blank means "not supplied".
  - New `combineRows`: merges duplicates and A/C lines.
  - `analyzeImport(records, source)`: builds the plan without touching the board.
  - `renderImportPreview`.
  - `applyImport(plan)`.

  A future API connection calls `combineRows` onwards with records in the same shape.
- **Matching (`woKey`).** The WO is trimmed, uppercased and treated as text, so `1234` and "1234" match, and so do "wo-2604-1" and "WO-2604-1". Lookups use a Map, which keeps a 2,500-row import fast.
- **Same WO twice in one file.** Becomes one record. Non-blank cells win, the earliest due date is used, and the job is flagged "duplicate in file".
- **Blank cells never wipe data.** A missing Step column leaves the step as it is.
- **Who owns what.** Cienapps sets value, customer, title, floor/unit and sheet count. The planner keeps planned week, ticks, holds and hand-set hours. New field `hoursSrc` (est/cien/hand). Old jobs with `hoursEstimated:false` count as hand-set.
- **Step.** Cienapps ahead: the planner moves forward to match, and `origStep` is set to the Cienapps step, so it does not appear in Export Changes. Planner ahead: unchanged, so it stays on the "update Cienapps" list. The planner never moves backwards.
- **Due-date differences go to the "Differs" panel.** This replaces today's date panel. Each job gets Keep or Take, plus "Take all" / "Keep all", and Take is the default. "Keep" is remembered in `dueKeep` so the same difference isn't asked again. The existing "move to due week" choice stays.
- **Parsers.**
  - New `parseDateIE`: day/month/year with `/ - . space`, 2-digit years read as 20xx, month names, and ISO dates. All built in UTC so no time-zone shift, and impossible dates are rejected (the existing date is kept and the job flagged).
  - New `parseNum`: "â¬12,500.00" becomes 12500.
  - Hours: "8h" becomes 8. Zero or less, or over 500, is ignored, flagged, and the hours are estimated instead.
- **Totals rows** are skipped: a WO containing no digits, or starting with "Total".
- **`findHeaderRow`** scans the whole sheet, not just the first 12 rows.
- **`autoSchedule`.** Jobs due after the 8-week window are left unscheduled. Hours read as `+o.hours||0`.
- **Snag WOs (WO-S)** are ignored by the import: never added, changed or removed. The planner owns snags.
- **Shipped.** Step contains shipped/invoiced: set `shippedAt` (first seen). The job leaves the Capacity Board and week totals (`wkHrs`/`wkVal`/`wkCnt`/unscheduled) but stays on the Deliveries tab until delivered.
  - New tab **ð¦ Shipped** (`t-h`, `renderShipped`): search, delivered yes/no, an "Installation complete" button (`completeAt`, `completeBy`, kept, filter "show completed") and a "Bring back to board" button (`shipBack`).
  - New `needsAttention(o)`: brings a job back to view if it has follow-ons, snags or waiting lines. Only waiting lines exist for now; it is ready for later stages.
- **Sheets.** New `sheetsCien` per WO, kept for the CNC calendar.
- **Export tab.** The Full Schedule export no longer crashes when a job has no step (`o.step||''`). Week Summary uses `wkCap(wk)`. Two new columns are added at the end only: "Shipped At" and "Sheets (Cienapps)". Export Changes columns are unchanged.
- **Old data safety.** Missing `hours`, `title` or `step` never shows NaN or crashes. Board search uses `(o.title||'')`.
- **`get8Wks` clock-change bug.** It moves forward a week using local time (`setDate`), but `getMonday` works in UTC, so the late-March clock change gives a repeated Monday. Fix: step forward a week in UTC (`setUTCDate`).

## What must NOT change
- Preview first; nothing changes until Apply. Cancel changes nothing.
- An import review blocks auto-refresh.
- Planned weeks are never moved by the import itself.
- Jobs on a van stay on Deliveries until the driver confirms.
- The "Cienapps says shipped, but no dispatch record" warning stays.
- The column mapping screen for files with no header row stays.
- The Changes export format and "Mark as applied" stay.
- Cutting-list tags stay on a job when it ships.

## Risks
- **Wrong A/C or step-order guess** files lines under the wrong job. Questions 1â2 cover this, and every fold is listed in the preview.
- **Two PCs:** an import applied while someone else is editing. This relies on the Stage 1 merge. The apply step must look each job up again at apply time.
- **First import after go-live:** many old jobs at once move to Shipped, or Cienapps steps move them forward. The preview shows counts, and a backup is taken first if more than 20 jobs move to Shipped.
- Steps with new wording that can't be ranked will fill the Differs panel.
- Jobs due after the 8 weeks now sit in Unscheduled, so that list grows.
- The bigger orders data adds to the Stage 1 "single-record size" problem, until Stage 3 per-row tables.
- The Shipped tab must work on a phone in Chrome.

## Acceptance checks (from `tests/import.test.js`, `tests/datasafety.test.js`, `tests/weeks.test.js`)
1. Messy, reordered headers with spaces map correctly. (imp 1)
2. A "Total" row is not imported. (imp 2)
3. The same WO twice in one file gives one job, flagged. (imp 3, stage1 t3)
4. 1234 matches "1234", and lowercase matches uppercase. (imp 4, 17)
5. Importing the same file twice changes nothing and lists no Export Changes. (imp 5)
6. "â¬12,500.00" and "12,500" are read as 12500, which gives 14h. (imp 6)
7. An Hours column is used when value is blank. (imp 7)
8. All 7 date formats parse correctly, and 31/02/2026 is rejected. (imp 8)
9. No Step column means the old blank step stays blank. (imp 9)
10. Hand-set 20h survives a re-import. (imp 10)
11. A blank due date doesn't wipe the existing one. (imp 11)
12. A job due in June 2027 is left unscheduled. (imp 12)
13. A header on row 13 is found. (imp 13)
14. Column guessing still passes, and 2,500 rows take under 8 seconds. (imp 14â15)
15. 99999h, â5 and "8h" are handled. (imp 16)
16. A trailing space on a step is not a change. (imp 18)
17. A step change from Cienapps is not exported. (ds 3)
18. Old orders render on every tab with no NaN, and the full export works without a step. (ds 5â6)
19. 8 different Mondays across the March clock change. (wk 2)
20. Week Summary shows 100h capacity. (wk 8)
21. **New:** a shipped job goes to the Shipped tab, is still there after re-import, is searchable, and "Bring back" works.
22. **New:** a WO-S on the board survives the import.
23. **New:** a planner step ahead of Cienapps stays and shows in Export Changes.
24. **New:** a Cienapps step behind the planner is ignored.
25. **New:** an A-suffix line folds into its base and is flagged.
26. **New:** the sheets column is stored.
27. stage1 t5 gets rewritten: shipped jobs are never removed, so the "returns if edited elsewhere" problem can't happen.

ds 1, 2, 4, 7 and 8 belong to Stage 1 saving, not this stage.

## Decisions I made myself (Garry to confirm on 3 Nov)
- No import ever deletes a job. That is the "never delete production data" rule.
- Shipped only affects the Capacity Board, not Deliveries, because "left the factory" doesn't mean delivered.
- Due-date default is Take, because Cienapps holds the customer date. "Keep" is remembered so it isn't asked every week.
- Duplicate due dates take the earliest date, which is safer for production.
- Hours over 500 are treated as bad data.
- New columns go only at the end of the Full Schedule export.
- Build on a new `feature/stage2-imports` branch taken from `feature/saw-stores-simplify`.

## Build steps
1. Add `woKey`, `parseNum`, `parseDateIE`, `parseHours` and the tests that cover them.
2. Make `findHeaderRow` scan every row, skip totals rows, and add the sheets header names.
3. `normaliseRow` + `combineRows` (dedupe, A/C fold).
4. Rewrite `analyzeImport`: Map lookup, ownership rules, step rank, Differs, shipped and snag handling.
5. Preview: Differs panel and "Shipped / Additions / Flagged" sections.
6. `applyImport`: no removals, `origStep` sync, `dueKeep`, `sheetsCien`.
7. `autoSchedule` far-future fix, plus NaN guards in `wkHrs`, the board and exports.
8. Fix `get8Wks` and Week Summary `wkCap`.
9. Shipped tab, `isShipped` / `needsAttention`, and leaving shipped jobs out of week totals.
10. Run the full test suite, update `ACCEPTED-FAILURES.md`, then hand to the Tester.

---
