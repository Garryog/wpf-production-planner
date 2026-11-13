# Accepted test failures (Garry to confirm each)
**3 Nov 2026 check (Tester round 12).** This is every check that currently fails, on `feature/stage2-imports` (the go-live branch) and `feature/cutting-lists`. Each one needs Garry's yes/no in the last column. Rows marked **NOT acceptable as-is** are real problems the Tester recommends fixing (or working around) before go-live.

Removed this round: stage3 attack3-switch R1b "re-migration keeps the tick" — passes now (round 10 and again 3 Nov).

Timing note: the 2,500-row timing tests can fail when many tests run at once; they pass when run alone.

| Test | Why it fails (plain English) | Fixed in | Accepted? |
|---|---|---|---|
| stage1 t3 duplicate-WO delete-vs-edit | the merge can't tell two lines with the same WO apart. Stage 2 stops imports creating them (stage1 t8 now passes: a WO twice in one file = one job); existing duplicate lines still hit this | line IDs (Stage 3 per-row tables) | pending |
| stage1 t4 2,500-job merge >10 s | single-record size (passing on this run; may still be slow on a real PC) | Stage 3 | pending |
| sawstores attack-devices identical lines share one record | ticks keyed by line content | line IDs (before snags) | pending |
| sawstores attack-regress A4 label for waiting line | pre-existing | labels step | pending |
| baseline weeks.test.js "Monday 00:30 (summer time) is in the new week" | "this week" is worked out in UTC, so 00:00–01:00 on an Irish summer Monday still counts as last week. Not in the Stage 2 plan | weeks fix TBD | pending |
| stage1 t16 "new-tab note survives an old-tab save" (SQL as written today) | an old-code tab (today's live version) left open after go-live overwrites the whole plan, wiping newer saves. The test shows this risk on purpose | close every screen on go-live day, plus the old-tab guard (docs/PROPOSAL-old-tab-guard.md) if Garry agrees | pending |
| stage1 t13 a1, a2, b1, c3, f2 (old-code office tab) | a tab still running the OLD version (today's live site) saves the whole plan without the new save tags, so an untick it makes can be undone by a new-code screen whose earlier save had no reply ("zombie tick"). Only happens while old tabs are open — every PC, tablet and phone must be closed and reopened on go-live day | go-live day: reopen every device | pending |
| stage1 t14 C7 | if a tab crashes mid-save and is only reopened after more than 40 other saves, it can no longer tell its save landed, so an untick made meanwhile can come back | — (rare: 40+ saves before a crashed tab is reopened) | pending |
| stage1 t14 D4a / D4b | device storage full (or blocked) at the moment of a save: the device can't keep its backup copy, so after a crash an untick made elsewhere can come back. The user is now warned on screen ("keep this page open until it says Saved") | — (user warned) | pending |
| stage3 attack-poll P5 (cutting-lists only) | marked "information only" inside the test itself: a change committed more than 30 s after its database transaction started isn't picked up by polling until reload. Only matters if a transaction runs > 30 s | — | pending |
| stage3 c4-queue A5 "no close-tab warning once everything is sent" (cutting-lists branches) | pre-existing (found failing before the 3 Nov cutting-list flow work; added by the Tester 3 Nov, attack round 1). After the saw's offline ticks have all been sent and confirmed, closing the tab still shows the browser's "Leave site? Changes may not be saved" warning. Nothing is lost — it is a false alarm that may teach people to ignore the warning | Coder to check what still counts as "unsent" after the queue empties | pending |
| stage1 t17-exportbase-attack A2–A5, A'1–A'2 (old-code tab) **NOT acceptable as-is** | "Mark as applied" on one PC is undone if an old-version tab saves before another new-version PC refreshes: that PC puts back its older Export Changes baseline, so the already-applied changes reappear in the Export Changes list on every PC | old-tab guard (docs/PROPOSAL-old-tab-guard.md) would stop it; otherwise store the baseline where old tabs can't overwrite it, and reopen every device on go-live day | pending |
| stage1 t17-exportbase-attack E1–E2, E'1–E'2 (old-code tab) **NOT acceptable as-is** | if an old-version tab saves and the next new-version screen to open is a fresh one (a reloaded page, a PC switched on in the morning), it doesn't know the old baseline, so it rebuilds it from today's plan: **the Export Changes list goes empty for everyone and those week changes are never sent to Cienapps** | old-tab guard (docs/PROPOSAL-old-tab-guard.md) would stop it; otherwise store the baseline where old tabs can't overwrite it, and reopen every device on go-live day | pending |
| seq attack5-window [LOW] "L5 inactive: customer 'Zed Homes' is a Cienapps spelling of INACTIVE project 'Old Zed Site' → no silent second project" (added 10 Nov, Part 4) | an inactive project is not looked at for its Cienapps spellings, so a WO of that customer gets a new project. Left as it is on the coordinator's instruction | Garry to decide (reuse / reactivate the inactive project, or a new one) | **pending — Garry to decide** |
| seq attack5-window [LOW] "L10 blocked: Settings → 💾 Storage on this device can be reached" (added 10 Nov, Part 4) | when the browser blocks storage, the sign-in ("Who's using this screen?") comes back on every screen, so Settings can't be reached to read the storage panel. The plain message still shows. Left as it is on the coordinator's instruction | Garry to decide | **pending — Garry to decide** |

Fixed by Stage 2 and removed from this list: import.test.js (17 of 19), datasafety 3/5/6 (all 11 now pass), weeks 2 and 8 (and the year-end autoSchedule check), stage1 t5 "shipped job returns if edited elsewhere" (rewritten as acceptance check 27 — imports never remove a job, so it can't happen; stage1 t8 rewritten the same way).


## Intermittent soak findings (round 3, 22 Oct)
- **Lost notes (1 in 48 t1 runs) — cause found and fixed (R3 fix 2).** Reproduced again in t1 ×20 (seed 120: saw's last note and two ticks lost, removed by the office writing v74). Cause: after a successful save the screen took the version number from the save reply. The fake server builds that reply after its delay, so if another screen saved in between, the reply carried the *later* number; the screen then believed it already had that later save, and its next save overwrote it without merging. Real Supabase returns the number it wrote, so this was very unlikely live, but the app now always records VER+1 (the number it asked for). Deterministic check: tests/stage2/coder-r3.test.js #2 (fails on the old code). Also checked and ruled out for `notes`: the 3-way field merge (one owner per job in the soak, so only a stale replay could revert it), pending-copy replay on reopen (entries are per job and merged field by field against the latest copy, database wins on a clash), the unconfirmed-save (UNSURE) base swap, and stale refresh replies (dropped by the version check). After the fix: t1-trace ×30 had no lost notes; t1 ×10 clean.
- **Zombie untick — FIXED (22 Oct, Coder commits 2f52825, 077835b, ca25e5e, dd72718).** Reproduced every time by tests/stage1/t9-untick.test.js (100 of 419 unticks came back before the fix). Three faults in the save code: (1) the merge treated an untick as "no change" when an earlier save from this screen had sent the tick without a reply, so the database's tick was kept; (2) a save still in flight when the tab closed wasn't recorded as "may have landed", so the reopened tab lost the untick; (3) only the last 5 unconfirmed saves were remembered. After the fix: t9 ×20 — 0 unticks came back, every keeper tick survived.
- **stage1 t4 "2,500 jobs … under 10 s" occasionally fails (3 in 15 in a loop) — test timing, not lost data.** PC B's startup save is still in flight when the test calls saveDB(), which then only queues B's edit and returns; B's note lands a moment later (confirmed by waiting). Tester to wait for `!SAVING` before checking.


## Cutting-list window release (branch feature/list-window) — added 12 Nov 2026, all PENDING Garry
Full suite on this branch, 12 Nov: 197 files, 3,984 pass / 75 fail before the last test updates; after them 66 fail = 27 on the list
above (the same checks as before this branch) + the 39 below, all from the Tester's new attack files in `tests/list-window/`.

| Test | Why it fails (plain English) | Fixed in | Accepted? |
|---|---|---|---|
| list-window attack1-two-pcs A, B, C, E, F, H (15 checks) | the test answers "OK — save a second list" to the new question "WO already has a cutting list — save a second one anyway?", so two lists are saved. A person now SEES the question; before 12 Nov nothing was asked. Two PCs pressing Save in the same second are still not stopped (needs a database rule), the Cutting Lists page now flags it "⚠ 2 lists on WO-…" | Garry's answer to question 1 in docs/PLAN-list-window.md (ask / never allow / allow) | pending |
| list-window attack1-two-pcs D2 | two PCs change the same quantity: the last Save wins and the second person is not told | later (revisions already record who changed what) | pending |
| list-window attack1-jobs — 3 checks "P-1001 / WO-777" + 1 "not on this branch — L4b" | a P-number's house gets a second list when the Cienapps WO arrives; the automatic merge (L4b) is not in this release. The Cutting Lists page does say "A Cienapps WO now exists for the house of P-1001" | L4b small release (question 2) | pending |
| list-window attack1-jobs "Aderig Homes" | a customer spelled one letter differently quietly makes a second project | question 4 | pending |
| list-window attack1-jobs "(info, simplicity) filled in by itself" | several jobs share the unit number: the right one is offered first but the person must tap it | — (never wrong, one more tap) | pending |
| list-window attack1-layout "(info) Capacity Board behind…" | not this window: the board scrolls sideways on a phone with a 64-letter customer | — | pending |
| list-window attack1-due "(info) due date moved on another PC" | the open window shows the new due date only after the next action | — | pending |
| list-window attack1-oldscreen O4 | an old list that has NO work order can't be saved after an edit until a work order is picked ("Pick the work order…") | Coder to check next run — may be the intended rule | pending |
| list-window attack1-unloaded "(info) the SAME thing on the older code" | shows the Critical "opens empty, Save wipes the rows" fault on the OLD code (main) on purpose; fixed on this branch | fixed here | pending |

**Update 12 Nov 2026, late run.** Fixed and taken off the table above: attack1-tpl-role (5), attack1-keyboard (4), attack1-layout
"Use these rows" on a phone (2), attack1-start-from second press (1), two-pcs "H flagged" (1). Round-1 list-window fails now 26.
Tester round 2 (`tests/list-window/attack2-*.test.js`, 6 files, 259 checks): 1 High, 2 Medium, 4 Low all fixed; the 11 below
are "(info)" checks left failing on purpose until Garry decides. Full suite 203 files: **4,254 pass / 64 fail = 27 long-standing +
26 round 1 + 11 round 2.**

| Test | Why it fails (plain English) | Fixed in | Accepted? |
|---|---|---|---|
| list-window attack2-tpl-pin "(info) … Drawing office PIN stays remembered" (5 checks: office, pm, prod, saw, stores) | once the Drawing office PIN is typed on a PC it stays remembered, so the next person at that PC can Save as template without it | Garry's answer to question 6 in docs/PLAN-list-window.md | pending |
| list-window attack2-tpl-pin "(info, ask Garry) ＋ New template" | "＋ New template" on the Cutting Lists page still accepts the Production Manager PIN (Save as template refuses it) | question 5 | pending |
| list-window attack2-keys K5, K7, K8, K9 (info) | small keyboard points: Tab from an empty heading adds a row; Shift+Tab from Save lands on Close; Tab past Save reaches the page behind; ✕ after ＋ Row with nothing typed still asks | next run (simplicity polish) | pending |
| list-window attack2-finder-pm-tag "(info) O: lists OFF" | with lists switched OFF, Settings shows the new "💾 Storage on this device" section — the only difference from today's screens | question 8 | pending |

**Update 13 Nov 2026, 00:40 (run 3).** Now passing and off the table above: attack2-tpl-pin (6 checks — templates are Drawing
office / Admin only on every route and a PIN typed there is not remembered) and attack2-keys K5, K7, K8, K9 (fixed).
A second Tester round 2 added 5 more files (`attack2-basics / -excel-phone / -fixes / -match / -two-pcs`, 248 checks): 2 High,
8 Medium, 6 Low — 14 fixed, 5 checks left failing (below). Full suite 209 files: **4,490 pass / 57 fail = 25 long-standing
(t17-exportbase gives 8 or 10 from run to run) + 26 round 1 + 6 round 2.** No older file got worse; three stage3 files
(s4-editor, s5s6-templates, attack2-screens) stop early with 0 fails exactly as on the baseline.

| Test | Why it fails (plain English) | Fixed in | Accepted? |
|---|---|---|---|
| list-window attack2-two-pcs (2 checks) "old screen saved the plan → settings.pMerged" | an OLD planner screen left open that saves the plan wipes the safety copies kept of merged-away duplicate P-number jobs (F6) | go-live step: close every screen and phone first | pending |
| list-window attack2-excel-phone (2 checks) "[already on main]" | an Excel sheet with Width before Length, or Qty first, is read in the wrong columns — the same on the live site today (F10) | later (read the column headings) | pending |
| list-window attack2-fixes "[LOW] used, then taken out again with Ctrl+Z" | the test presses Ctrl+Z at phone width, where keyboard shortcuts are off on purpose, so the rows are still there and asking is right; with the ↶ Undo button the question goes away | Tester to correct the test | pending |
| list-window attack2-finder-pm-tag "(info) O: lists OFF" | (still open, as above) Settings shows "💾 Storage on this device" with lists OFF | question 8 | pending |

**Update 13 Nov 2026, 05:10 (run 4).** Tester rounds 3 and 3b added 10 files (`tests/list-window/attack3-*` and `attack3b-*`,
709 checks): 3 High, 6 Medium, 12 Low — all fixed. 13 "(info)" checks are left failing on purpose (below). Full suite 219 files:
**5,183 pass / 71 fail = 27 long-standing (t17-exportbase gave 10 this run) + 25 round 1 (attack1-jobs now 5, was 6) + 6 round 2
+ 13 round 3.** No older file got worse.

| Test | Why it fails (plain English) | Fixed in | Accepted? |
|---|---|---|---|
| list-window attack3-roles-archived-simple "(info) C2" (6 checks: Production Manager, Office, Drawing office at 1280 and 360 px) | the Tester wanted at most 8 buttons outside the rows; there are 9 (Drawing office 10) | question 16 in docs/PLAN-list-window.md | pending |
| list-window attack3-roles-archived-simple "(info) A7" | an Office screen unlocked with the Admin PIN shows no template buttons — templates are on the Drawing office screen only (Admin opens that screen with the Admin PIN) | question 12 (built on answer A) | pending |
| list-window attack3-custproj "(info)" (3 checks: "OGrady & Sons", "Aderig Homes", "Co. Kildare Homes") | a customer spelled without its apostrophe or one letter out is not offered the existing project; "Co. Kildare Homes" links itself to "Kildare Homes" | question 4 | pending |
| list-window attack3-excel "(info) E5" | an Excel file that says "WO-26114" when the planner calls the job "26114" is asked about ("different job?") instead of going straight in — one extra OK, never wrong | later | pending |
| list-window attack3-phone "(info) P10" | on a Drawing office phone the pinned bar also holds "Save as template", so it is 117 px tall (110 wanted) | later (small) | pending |
| list-window attack3-two-pcs-old "(info) O2" | an OLD screen left open can still make a second list for a house that has a P-number list, and the new screen's "⚠ 2 lists" tag only counts lists on the SAME work order | go-live step: close every screen and phone first; full fix with L4b | pending |

