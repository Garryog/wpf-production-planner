# Plan: the cutting-list window (small release, target Wed 18 Nov 2026)

Branch `feature/list-window`, cut from `main` (12 Nov). Garry, 12 Nov: "i really want to get working on the cutting list side of
planner" — its own small release after the Deliveries weeks release (Mon 16 Nov). What Garry asked for is in `docs/ROADMAP.md`
(L1–L12, DD1, "Decisions 10 Nov 2026, 16:18", "Garry 10–12 Nov").

## Goal
A production manager who has never used it can make a cutting list without being shown how: open it from the job, type the rows,
press one big Save. Everything else is out of the way.

## The window, in words (wireframe)
```
✍ New cutting list  [WO-2617-4]                         [Due Fri 23 Oct · Wk 43]   [✕ Close]
Floor [7]  Unit [231]  Title [APT TYPE 1 KITCHEN]  Customer [Aderrig Homes]  List name (optional) [      ]
                                                                    [Change job ▾]  [Start from… ▾]
 #  Description      Qty   Length  Width  Material ▾   Edging 1 ▾  Edging 2 ▾  Note   Bought in  ✕
 1  [Description]   [Qty]  [L]     [W]    [— material —] …
[＋ Row]  [＋ Heading]  [🧱 Project materials (add / edit)]  [More ▾]                         [?]
                                                        [Close]   [ Save list → Saw & Stores ]
```
- **Title bar:** the Cienapps WO number and the due date are always there (red = overdue, amber = due this week). ✕ Close always in view.
- **Job row:** Floor, Unit and Title each in their own box, filled from the work order. The project is found (or made) from the
  Cienapps customer by itself — nobody picks one. "Change job ▾" opens the Project and Work order pickers; they open by themselves
  only when there is no work order, or the planner needs an answer (two projects fit, no connection).
- **Start from… ▾** (one choice): A template… · An Excel file… · An old list… (its rows come into this window). Or just type.
- **Under the rows:** ＋ Row, ＋ Heading, Project materials. "More ▾" holds Undo, Type, No cutting / No fittings, Unit blocks,
  the Excel template and the default materials.
- **Finish:** one big Save → "Saved ✓ — list is with the Saw & Stores" + Close. Ctrl+S also saves.
- **"Save as template"** shows only on a Drawing office screen, or where the Drawing office / Admin PIN has been entered.
- **Phone (360 px):** same order, one column; the due date sits under the title.

## Decisions taken without asking (most reasonable reading — say if any is wrong)
1. Reused the work already built and tested on `feature/project-details-v2` (Part 3 + Part 4, L1–L12) by cherry-picking it onto
   `main`; nothing else from that branch came across (no PM sequence, no spec sheet, no date tools, no Pre-production role).
2. Project materials: office, PMs, Management, Production Manager and Drawing office add / change with no PIN (Garry 9–11 Nov, B4);
   saw, stores, driver and floor screens are read-only. Needed for "New material works first time".
3. Johnny uses the **Drawing office** screen for now — the separate Pre-production screen is part of Job B and is not in this release.
4. No database change in this release. (`pMerged`, a small note kept inside the existing settings record, needs no SQL.)
5. The automatic P-number → Cienapps WO merge (L4b) is NOT in this release — it needs SQL and is item 4 in Garry's small-release
   order. Until then a P-number is flagged purple "not from Cienapps", and the Cutting Lists page says when a Cienapps WO now exists
   for its house.
6. L9 (＋ Add cutting list on the delivery card) and the rest of DD1 (due tag on Cutting Lists home and lists-needed rows) wait
   until `release/deliveries-weeks` is merged to `main` — that release brings the delivery card window and the due tag they use.

## Build steps
| # | Step | Status |
|---|---|---|
| 1 | Port L1–L4a (boxes, find the WO, P-number last resort, flags) from the Job B branch | done 12 Nov |
| 2 | Port L5–L8, L10–L12, list name not pre-filled, template search | done 12 Nov |
| 3 | Materials with no PIN for office / PM / Management / Production Manager / Drawing office | done 12 Nov |
| 4 | Simple layout: title bar WO + due, Change job, ONE Start from…, big Save, Save as template by role | done 12 Nov |
| 5 | Tester attack 1 + fixes | done 12 Nov (see progress) |
| 6 | Old tests moved to the new layout; full suite; ACCEPTED-FAILURES tidied for this branch | in progress |
| 7 | Ownership: "no list yet" warnings to the Drawing office only; PM sees list status read-only | to do |
| 8 | Merge `main` once the Deliveries weeks release is in; then L9 (delivery card) and DD1 on Lists home / lists-needed | waits for Mon 16 Nov |
| 9 | Phone: "Use these rows" button in the old-list finder; Esc closes the little panels first | to do |
| 10 | Tester round 2, Manager GO / NO-GO, GO-LIVE doc, pull request (not merged) | to do |

## What must NOT change
Saw and stores screens, ticks, revisions, the lists switch, imports, Export Changes, Deliveries. Existing lists open and save as before.

## Questions for Garry (recommended answer first)
1. **Two lists on one work order.** Today the window lets a second list be saved on a WO that already has one (it was allowed on
   3 Nov so a kitchen list and a wardrobe list could share a WO). Now it asks first. **A (recommended): keep asking** — "WO already
   has a list — don't save / save anyway". B: never allow a second list. C: allow silently as before.
2. **P-number → Cienapps WO merge (L4b).** **A (recommended): next small release after this one** (it needs one SQL block run in
   Supabase first). B: hold this release until it is in.
3. **Who may save a template.** **A (recommended): Drawing office and Admin only, everywhere** — also take the button off the
   Cutting Lists page rows for everyone else, and the Production Manager PIN no longer opens it. B: leave the Lists page as it is.
4. **Customer spelled one letter differently in Cienapps** ("Aderig Homes"). Today that quietly makes a second project.
   **A (recommended): ask** "Is this project Aderrig? Yes / No — make a new project". B: leave it.

## Progress log
### 12 Nov 2026 (scheduled run 1)
- Branch cut from `main` (cf70ab9). ROADMAP sections copied. 19 commits cherry-picked from `feature/project-details-v2`
  (B0 key, L1/L3, L4a, L1b, two-PC P-numbers, fold-in flags, L5, L6, L7, L8, L10, L11/L12, round-5 fixes) with the spec-sheet and
  job-info-edit parts left out. Helpers `seqKind`, `seqKinds`, `dShort` and the shared test helpers brought over. `tests/run-all.sh` added.
- Simple layout built (step 4). Screenshots: `node tests/list-window/shots.js` (fake database).
- **Tester attack 1** (9 files in `tests/list-window/`, 362 checks): 1 Critical, 4 High, 4 Medium, 7 Low.
  - Critical (already on the live site, not from this work): Edit on a template, an archived list or a shipped job's list opened
    it EMPTY and Save wiped its rows. **Fixed** — the rows are fetched before the window opens.
  - High, fixed: title bar kept the old WO after "Change job"; old-list rows under a unit block were multiplied; a second list
    could be saved on a WO silently (now asked — question 1).
  - High, not fixed: P-number's house gets a second list when the Cienapps WO arrives (needs L4b — question 2). Two PCs pressing
    Save in the same second can still both save (the check asks the database just before saving; a true tie needs the database rule).
  - Medium fixed: phone title bar, Ctrl+S, cursor starts in the first box. Left: finder button on phones, Esc with a panel open,
    Save as template still reachable from the Lists page (question 3), one-letter customer typo (question 4).
- Full suite: see the end-of-run line below.
