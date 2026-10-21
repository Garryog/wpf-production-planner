# Code health audit: index.html (21 Oct 2026, branch feature/saw-stores-simplify)

## 1. Size and shape
- 4,487 lines, 337 KB. Two script tags: the SheetJS include and one inline block of 4,046 lines (300 KB).
- 206 top-level functions, about 1,300 functions counting inner helpers. About 59 top-level globals: `DB`, `BASE`, `VER`, `ROLE`, plus around 25 bits of screen state (`wlShowDone`, `lstFilter`, `pmCust`...).
- The 10 biggest functions (lines): renderDeliveries 232, renderLists 224, renderBoard 222, renderSettings 149, analyzeImport 129, printPoster 124, guessCols 119, openListEditor 93, renderDriver 89, exportSnapshot 77.
- The saving and merge engine (lines 486-890) is the best-built part. It is commented and tested.

## 2. Fragile spots
- **Adding a setting means editing 3 lists by hand**: `settingsFrom` (582), `applyPlan` (602) and `fullSettings` (890). If you miss one, the field silently never saves or never loads.
- **New jobs are built in 3 places**: manual P-WO (1634), import (3870) and the list editor (4346). A new job field needs editing in all three.
- **Escaping is duplicated**: `escA` (global), plus two local `esc` copies in printRunSheets and printPoster that don't escape quotes. Line 3121 puts one of them inside an attribute. Some screens use `E=escA`.
- **Two date conventions mixed**: `getMonday`/`wkKey` work in UTC. `todayLocal` and `isoOf` (duplicates of each other) work in local time. 7 places use `toISOString().slice(0,10)`, which gives yesterday's date between midnight and 1am in Irish summer time. Examples: the backup day (924), the list horizon (1828, 4451) and archive keys (2972).
- `uid` is defined twice (1989, 3960). `PEND` (import review) and `PEND_KEY` (unsaved changes on this device) are unrelated names that look alike.
- No TODOs, no `debugger` statements, 7 console warnings (all deliberate), 18 `alert`/`confirm`/`prompt` calls.

## 3. Data model
- **Everything lives in one Supabase row**: jobs, settings, every cutting-list workbook (`listWBs`), holds, ticks, POD and the archive. Every save sends the whole row, and every screen downloads the whole row every 2 minutes.
- **Jobs** are keyed by `wo`. Duplicate WOs are matched as `wo#2` by position.
- **Ticks and holds** (`listRow[listId][rowKey]`, `listHold[listId][rowKey]`) are keyed by the line's *content*: type, item, L, W, material and note, lowercased. This causes three problems:
  - Two identical lines share one tick and one hold. This is the duplicate-line problem.
  - Editing a note or size orphans the line's tick. Re-import cleans up orphaned holds but not ticks.
  - A snag, follow-on or label can't point at "this line" reliably.
- **POD** is keyed `vehicle|day|this week's Monday`, i.e. per run, not per WO. It's moved into `delArchive` weekly.

What breaks as planned features land:
- POD per WO / per snag: the key has to change. Old runs need a read-only fallback.
- Snags and follow-ons need a stable line id, or they will detach whenever a line is edited.
- Material lists and fitter views: each adds more to the single row. That means a slower save, more clashes and bigger polls.

## 4. Refactors (no file split, no build tools)
| # | Change | Effort | Risk |
|---|---|---|---|
| 1 | One `SETTINGS` schema `{key:{def,atomic}}` driving settingsFrom/applyPlan/fullSettings | 0.5 day | Low (old data loads via defaults) |
| 2 | `newOrder(fields)` factory used by all 3 job builders | 0.5 day | Low |
| 3 | Delete the local `esc` copies; use `escA` everywhere | 1 hour | Very low |
| 4 | One date module: `todayISO()`, `isoOf`, `wkKey` in local time; replace the `toISOString` slices | 0.5 day | Medium (week keys must not shift; needs the weeks.test.js run) |
| 5 | **Stable line id** (`r.id`) assigned at import or edit and kept across re-import by matching content then position. Ticks and holds keyed by id, with `rowKey` fallback for old data | 1.5-2 days | Medium-high (touches saw/stores/holds; needs a migration test) |
| 6 | Move `listWBs` (and later snags/POD) out of the main row into their own Supabase rows/tables, one row per list | 2-3 days | Medium (SQL first; merge logic simpler per row) |
| 7 | Split renderDeliveries/renderLists/renderBoard into a header, rows and handlers | 1 day each | Low-medium |

Do 1, 3 and 5 before snags/follow-ons. Do 6 before material lists.

## 5. Nervous about for 40 users
- **PINs are stored in the plan row**, which anyone with the public key in the page source can read. The default PINs (9000, 2468, 1111...) are also in the source. Treat the PINs as convenience, not security.
- The Supabase row is writable by anyone with the public key. The `planner_backups` table also allows anonymous **delete**, so backups can be wiped.
- One-row saving: with 40 screens, clashes become routine. After 6 retries a save fails, and then it retries every 30 seconds. Full-row polls every 2 minutes add up as `listWBs` grows. Measure the row size now.
- The content-keyed ticks (section 3) will produce "I ticked one and two went" reports on the saw.
