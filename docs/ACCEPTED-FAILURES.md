# Accepted test failures (Garry to confirm each)
**3 Nov 2026 check (Tester round 12).** This is every check that currently fails, on `feature/stage2-imports` (the go-live branch) and `feature/cutting-lists`. Each one needs Garry's yes/no in the last column. Rows marked **NOT acceptable as-is** are real problems the Tester recommends fixing (or working around) before go-live.

Removed this round: stage3 attack3-switch R1b "re-migration keeps the tick" — passes now (round 10 and again 3 Nov).

Timing note: the 2,500-row timing tests can fail when many tests run at once; they pass when run alone.

| Test | Why it fails (plain English) | Fixed in | Accepted? |
|---|---|---|---|
| dates attack4-usability "L12: list window WO drop-down sorted by due date (earliest first, no date last)" | L12 is built on the Job B branch (feature/project-details-v2, cd7163a), not on this Job A branch. Passes once Job A is merged into Job B | merge of Job A into Job B | pending |
| dates attack4-usability "L12: each WO line shows its due date (\"· due 14 Nov\")" | same as above — built on feature/project-details-v2 | merge of Job A into Job B | pending |
| dates attack6-release C2a "old screen moves a NEXT-week booking to Friday…" (Medium) | a screen still on the version before week tabs shows one week only. If its user drags a job booked for next week to "Fri", they mean this Friday, but the booking keeps its week, so every new screen shows it on next week's Friday. The new code can't see what the old screen meant. **Close every screen on go-live day** (guard v2 stops it) | go-live day | pending |
| dates attack6-release C1k "a PC opened after the old save still has the Settings → Delivery dates numbers" (Medium/Low) | an old screen's save doesn't know the three Delivery dates numbers, so if they were changed from 3 / 5 / 14 they go back to 3 / 5 / 14 for PCs opened afterwards. Same cause as the old-bookings answer above. **Don't change the numbers until every screen is reopened** | go-live day | pending |
| dates attack6-release D1b "each old day note ends up on ONE date only" (Low) | only if two PCs answer the one-time "which week are the old bookings?" question differently at the same moment: both end up agreeing on the week, but the old day notes ("Tue: …") are copied into both weeks. Nothing lost; delete the extra note by hand | Coder, when convenient | pending |
| dates attack6-release G6 "an old day-name note with no old bookings does not reappear every week" (Low) | a day note typed before week tabs, when there are no old bookings (so the one-time question never shows), keeps showing on that weekday every week — the same as live today. Edit or clear the note once and it is filed under its date | Coder, when convenient | pending |
| stage1 t3 duplicate-WO delete-vs-edit | the merge can't tell two lines with the same WO apart. Stage 2 stops imports creating them (stage1 t8 now passes: a WO twice in one file = one job); existing duplicate lines still hit this | line IDs (Stage 3 per-row tables) | pending |
| stage1 t4 2,500-job merge >10 s | single-record size (passing on this run; may still be slow on a real PC) | Stage 3 | pending |
| sawstores attack-devices identical lines share one record | ticks keyed by line content | line IDs (before snags) | pending |
| sawstores attack-regress A4 label for waiting line | pre-existing | labels step | pending |
| baseline weeks.test.js "Monday 00:30 (summer time) is in the new week" | "this week" is worked out in UTC, so 00:00–01:00 on an Irish summer Monday still counts as last week. Not in the Stage 2 plan | weeks fix TBD | **passes now** (dates step 15, `get8Wks` uses the local date, feature/dates-deliveries) — Garry to remove |
| dates attack1-oldversion "old screen Clear Week leaves NEXT week's bookings alone" (High) | a screen still running the version before week tabs has the old "Clear Week — Start Fresh": it untags every booking in every week (all archived first, nothing lost, but next weeks' vans are cleared). The new code can't stop an old screen. **Close every screen on go-live day** (and the newer-version bar asks them to) | go-live day | pending |
| dates attack1-oldversion "old screen Clear Week leaves next week's dated notes alone" | same old button empties every day note, dated ones included. **Close every screen on go-live day** | go-live day | pending |
| dates attack1-oldversion "old screen save keeps settings.delLegacyWk" (Medium) | an old screen's save doesn't know the setting, so the answer to the one-time "which week are the old bookings?" question is dropped and the question is asked again. **Close every screen on go-live day** | go-live day | pending |
| dates attack3-guard "the 10-Nov screen tells its user to refresh" (Medium) | once guard v2 is run, a 10 Nov screen left open is refused (good — it can't overwrite anything), but the 10 Nov code doesn't understand the refusal: it says "Save failed — will retry" and keeps retrying, so that person's edits stay only on that device until the page is refreshed. Can't be fixed in new code. **Close every screen on go-live day** | go-live day | pending |
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


## 13 Nov 2026, afternoon — checks that are OUT OF DATE because Garry changed the rule (not app faults)
Garry answered the open questions live on 13 Nov (table in docs/PLAN-list-window.md). Two answers reverse a rule that older
Tester files check for, so those checks now fail **because the planner does what Garry asked**. The rule as it stands is tested
in the new file `tests/list-window/g13-prod-templates.test.js` (41 checks, all pass). The Tester rewrites the old checks in the
final round (after Deliveries is merged in); until then they are listed here.

| Test | Why it fails (plain English) | Fixed in | Accepted? |
|---|---|---|---|
| list-window attack2-tpl-pin — 44 checks | they expect the Production Manager screen / PIN to be REFUSED for templates; Garry, 13 Nov: the Production Manager may make and change templates | Tester rewrite, final round | pending |
| list-window attack3-roles-archived-simple — 44 more checks ("A1" / "A2" Production Manager rows) | same | Tester rewrite, final round | pending |
| list-window attack3b-phone-tplpin — 49 checks ("T4 … with the Production Manager PIN → refused", and the "template untouched" checks that follow them) | same | Tester rewrite, final round | pending |
| list-window attack2-fixes — 18 checks ("Q3 everywhere", "prod:" rows) | same | Tester rewrite, final round | pending |
| list-window attack2-fixes "[LOW, wording] saw screen … does not say Production Manager" | Garry, 13 Nov: the default list owner the saw is told stays "Production Manager" | Tester rewrite, final round | pending |

**Signed off by Garry, 13 Nov 2026 (answer A to both):** two PCs saving a list for the same job in the same second (fixed
with the database rule in the P-number release) and an old screen wiping the P-number safety copies / making a second list
(go-live step: close every screen and phone) — the rows above for those are accepted for the list window release.


## 14 Nov 2026 — the 156 out-of-date checks above are DONE (nothing for Garry to sign)
The Tester rewrote them to Garry's 13 Nov rule (Production Manager screen / typed PIN open templates; a remembered PIN, PM, office,
saw and stores are still refused; the saw is told "owner Production Manager, Garry and Drawing office"). All 156 pass; the five rows
in the 13 Nov afternoon table no longer apply. Full suite on this code (232 files): **5,488 pass / 68 fail** — every one of the 68 is
on the lists above (t17-exportbase gave 8 this run; s5s6-templates stops early with 0 fails as before). No new failing test.

## 14 Nov 2026 — found while merging main into the Deliveries weeks release (all three happen on today's LIVE version too)
| Test | Why it fails (plain English) | Fixed in | Accepted? |
|---|---|---|---|
| ship merge-b-import A8 (Medium/Low) | a job added by hand (no Cienapps step on record), set to JOB SHIPPED by hand, then "Bring back", then imported as shipped: it stays on the board instead of going to the Shipped tab | small fix after this release | pending |
| ship merge-e-edges E2 (Low/Medium) | after "Bring back" on a job Cienapps had at 10 INSTALLED, the step box lets it go back to 9 JOB SHIPPED and puts that on Export Changes | small fix after this release | pending |
| ship merge-e-edges E1 (Low) | old data with a space after the step name shows as a "change" on Export Changes after ship + bring back | small fix after this release | pending |


## 14 Nov 2026 — after merging the live version (Deliveries weeks) into the list window branch: 3 checks to RE-POINT (not app faults)
| Test | Why it fails (plain English) | Fixed in | Accepted? |
|---|---|---|---|
| dates attack5-carryover B8 and B9 [lists ON] | they compare the PM / saw / Production Manager screens with a version from BEFORE the list window; the list window adds the PM's read-only list status and the saw's "no list yet" wording on purpose | Tester re-points them, final round | pending |
| lists-filter attack1-filter "11 lists switch ON … character-for-character the same as origin/main" | same reason | Tester re-points it, final round | pending |


## 15 Nov 2026 — final round on the list window release (all PENDING Garry unless marked)
Full suite on the final code (288 files, fake database): **7,454 pass / 106 fail**. Two of the 106 are timing checks that fail only
when several test files run at once and pass alone (editor e7-keyboard redraw time, lists-filter attack1-filter 13n). Every older
file was compared with the live version (`main`) or with the lists above: nothing got worse. No Critical or High check fails.
The checks below are the ones NOT already on the lists above.

| Test | Why it fails (plain English) | Fixed in | Accepted? |
|---|---|---|---|
| list-window final-a-customer-simple S1b (Medium) | "📥 Import Excel" is still on the Cutting Lists page. Garry's answer of 13 Nov was "only in the window", but the page button brings in a WHOLE workbook (one list per sheet) and the window brings in ONE sheet — taking the button away would leave no way to import a multi-house workbook | Garry to decide (question 20 in docs/PLAN-list-window.md) | pending |
| list-window final-a-customer-simple C3 (info) | a customer renamed outright in Cienapps gets a new project made from the new name (as decided: customer = project) | — | pending |
| list-window final-a-merged-jobs P4b (info) | the import preview does not say a P-number job already exists for that house — part of the P-number → Cienapps WO merge | P-number release | pending |
| list-window final-b-mat-2pcs W2 (info, Low) | Materials window: when a row's Save is refused because another PC changed it, the name just typed is not kept in the box | later | pending |
| list-window final-b-save-slow D2 (info, Low) | after 10 s of "Saving…" the person is told nothing more (✕ does ask after 20 s) | later | pending |
| list-window final-b-template-names N7, N9b (already on live) | a template can be renamed to a name another template has; "Save as template → Update" goes by Type name | "one name per template" (after this release) | pending |
| list-window final2-two-pc-names 9a, 10a, 11, 12a (Medium, already on live) | two PCs: "no cutting" / "no fittings" / list Type ticked on one PC is put back by a Save from a window opened earlier on another | small fix after this release | pending |
| list-window final2-two-pc-names 3b, 16 (Low) | both PCs rename the same list: last Save wins, nobody told · typing in the Type name box and typing it back stops it following the name | later | pending |
| list-window final2-save-race B1 (Medium/Low, already on live by code reading), B2 (Low) | the list NAME retyped during the second "Saving…" is on screen is not saved · a box changed and put back during a save gives a false "NOT saved" warning (nothing lost) | small fix after this release | pending |
| list-window final2-excel 3.4 (Low) | the same Excel file brought in again AFTER the list was saved and reopened is not asked about (it is asked while the window stays open) | Garry to say if wanted | pending |
| list-window final2-rename B5 (Low) | wiping a renamed board's "Also called" box splits lists never re-saved into a second board on the totals | later (warn before clearing) | pending |
| list-window final2-hold-roles-phone A11 (Low) | a job put ON HOLD after it was picked in the window still saves with a plain "Saved ✓" | Garry's answer to question 21 | pending |
| list-window final2-hold-roles-phone D8b (Low) | Esc does not close the Materials window when it is opened on its own | later | pending |
| dates attack6-release B3b | a check about the test file itself (how often it reads the old version), not the app — out of date since the checks were re-pointed on 14 Nov | Tester | pending |
| dates attack6-release E1, E2b, E3 · stage2 attack-r3 A (2 checks) · stage1 t16 second check | fail the same way on the live version today (run on `main`, 15 Nov) — not caused by this release | — | pending |

## 16 Nov 2026 — checks out of date because Garry asked for "✓ Save & close" (not app faults)
Garry, 16 Nov: "also need a save and close button". The window now has "Save list → Saw & Stores" (saves, shows the Saved ✓
panel, as before) AND a big green "✓ Save & close" (saves and closes in one press). Older checks that count exactly ONE Save /
ONE Close (the word "close" is in the new button), the button count (now one more), or expect `#me-save` to be the full-width
green button on a phone now fail by design. The new behaviour is tested in `tests/list-window/g16-xl-old-saveclose.test.js`
(10 checks, pass). Tester to rewrite: attack3-close-keys C1 (1), attack3-roles-archived-simple C2 / C3 (12), final-a-customer-simple
S6 (1), attack1-layout / attack2-excel-phone / attack3-phone P1 / P10 / final-a-phone "big Save … full width" (8). | pending |
| list-window attack3-roles-archived-simple "(info) C4 Production Manager … no typing box outside the rows except List name" (2) | Garry, 16 Nov: the Production Manager books the delivery date + van from the list window, so his window has a date box | Tester rewrite, final round | pending |

## 17 Nov 2026 — left after Tester rounds 4 and 5 were fixed (all PENDING Garry; none Medium or above except M4, which is refused with a message on purpose)
| Test / check | Why it fails | Fixed by | Status |
|---|---|---|---|
| list-window attack5-multiply M4 (Medium as written) | a sub-heading INSIDE a × block cannot be made × again: the window refuses and says "make it a Heading first" (no silent change of totals). The test wanted 3 × 2 = 6 times over or a warning; the refusal is the warning, in plain words | Garry: question 23 — answered A, 17 Nov | **accepted (Garry, 17 Nov)** |
| list-window attack5-multiply M6b (Low) | 501 typed straight into the × cell is saved (the × Multiply question allows 1–500) | later | pending |
| list-window attack5-multiply M11 (Low) | a template that itself holds a × block with a sub-heading comes in without that sub-heading | later | pending |
| list-window attack4-delivery-book T1 (info) | two PCs booking one job at the same moment: the "first booked" record is the first PC's — same as two people on the Deliveries page | — | pending |
| list-window attack4-labels-search-view V1 ×2 (Low) | Esc does not close the "View the list" window — the same for every View window on live | later | pending |
| list-window attack4-saveclose B1 (info), phone pinned bar ×2 (info) | "✓ Save & close" is not greyed while saving (a press is ignored and says "wait"); on a 360 px phone the pinned Save bar is 171 px of 640 | later | pending |
## 17 Nov 2026 — Capacity Board rows less tall (Garry: "the rows are too high") — out of date by design, not app faults
| Test / check | Why it fails | Fixed by | Status |
|---|---|---|---|
| lists-filter attack1-filter "11 lists switch ON / OFF … screens are character-for-character the same as origin/main" (2) | the check compares the Capacity Board's HTML with the live version byte for byte; the board's date cell was changed on purpose (dates side by side, chips on one line) | Tester: leave office:b out of that comparison | pending |
## 18 Nov 2026 — driver per van per day (settings.vanDrv) — pending, Garry to sign off
| Test / check | Why it fails (plain English) | Fixed by | Accepted? |
|---|---|---|---|
| list-window attack7-vandrv O1 "the old screen's settings save keeps settings.vanDrv" (Medium) | a screen still running the version before drivers-per-van saves the whole settings block without the drivers, so every driver set on the Deliveries page is wiped from the database. **Close every screen and phone on go-live day** | go-live step: close every screen | pending |
| list-window attack7-vandrv O2 "a PC opened after the old screen's save still shows Mick on the Artic" (Medium) | same cause as O1: once the old screen has saved, the drivers are gone for everyone and have to be set again. **Close every screen on go-live day** | go-live step: close every screen | pending |
| list-window attack8-deliv E6 "the old screen's next saves put back ALL the drivers" (Medium) | same cause as O1/O2, seen from the other side: after an old screen's save only the drivers this PC set again come back. **Close every screen on go-live day** | go-live step: close every screen | pending |
| list-window attack7-vandrv T2 "Pat put on the Volvo AND the Artic Fri from two PCs at once → somebody is told" (Low) | two PCs putting the same driver on two different vans in the same second both save without warning (each PC checked before the other had saved). The Deliveries page shows both vans, and the driver's phone shows both as his | — (rare; same-second double booking) | pending |
| list-window attack7-vandrv W "the PM screen shows who drives a van" (info) | only office / Production Manager see the Deliveries page, so a PM doesn't see who drives; the code comment that said "everyone sees it" has been corrected | — (information only) | pending |

## 19 Nov 2026 — R1 sync quick win (branch feature/sync-quick-win): 3 checks RE-POINTED (not app faults, nothing for Garry to sign)
The new Settings → "⏱ Sync speed" panel is on purpose, so the checks that say "Settings reads exactly like origin/main" now take
that one panel out (both sides) before comparing: list-window attack2-basics "office / s screen text identical to main",
list-window attack2-finder-pm-tag "(info) O: office tab s reads the same", lists-filter attack1-filter check 11 (lists ON and OFF).
Everything else on those screens is still compared character for character. Once R1 is on main the take-out does nothing.
Seen during the R1 full run, also failing on main (timing, not R1): list-window attack4-delivery-book "(info) T1 the first booked
record matches the booking kept" (2 of 3 runs on main fail — which PC wins the race decides it); lists-filter 13n (passed on re-run).

## 19 Nov 2026 — template buttons back on the Office screen (Garry: "the edit button for the cutting lists templates is gone. i need that button") — pending, Garry to sign off
The list window release (18 Nov) hid every template button from the Office, PM and Management screens. Garry asked for them back.
They are SHOWN again on every screen that had them before 18 Nov; making or changing a template still needs the Drawing office /
Production Manager / Admin PIN typed at the click (a remembered PIN still never opens templates — new test `list-window/h19-templates`).
These checks expect the buttons to be hidden, so they are out of date by design — not app faults:

| Test / check | Why it fails | Fixed by | Status |
|---|---|---|---|
| list-window attack1-tpl-role (9), attack2-fixes (5), attack2-tpl-pin (3), attack3-roles-archived-simple A1 / C5 (5 new), attack3b-phone-tplpin T2 / T3 (12), final-a-roles-fail (4), final-b-merge-seams 2 (1), g13-prod-templates (2), editor e9-templates (1) | they check that Office / PM / Management see NO ✎ Edit, Archive, 📐 Save as template, ＋ New template or ⧉ Copy from another project. Those buttons are back on purpose. The checks that follow a click (PM PIN typed → allowed; "Sneaked in" template saved with the Production Manager PIN) follow Garry's 13 Nov rule that the Production Manager may make templates | Tester to rewrite to the 19 Nov rule | pending |
| list-window attack3-roles-archived-simple C2 (info) "no more than 8 buttons outside the rows" | 11 buttons instead of 10 on the Office screen — the extra one is 📐 Save as template | — (information only) | pending |
| list-window attack3b-phone-tplpin PH3 "320 px: reason + Save bar take no more than half the screen" (Low) | on a 320 px phone the Office screen's Save bar now also holds 📐 Save as template, so it is taller. Save is still fully on the screen | could hide Save as template on phones if Garry wants | pending |

## 19 Nov 2026 — green strip / step badge / Check view (feature/green-step-check) — pending Garry
Full suite 322 files: 8,130 pass / 195 fail. Compared with the 19 Nov R1 run, the only new failing checks are written for the old screens:
| Check(s) | Why it fails now | Fix |
|---|---|---|
| "screen text identical to main / before" (attack2-basics lists OFF, attack5-carryover B8, attack6-release B4, lists-filter 11, flow-attack1-switchoff) | the grey step badge / green strip change the screen text on purpose (Garry 19 Nov) | Tester re-points to the new screens |
| stage3 coder-wo-cols (3), seq l4-keepone (2) | the step badge text now sits inside the WO cell / line | Tester re-points |
| template-button checks (attack1-tpl-role, attack2-fixes, attack2-tpl-pin, attack3-roles-archived-simple, attack3b-phone-tplpin T2/T3, final-a-roles-fail, final-b-merge-seams, g13-prod-templates, editor e9-templates) | PR #12 (live 19 Nov) brought the template buttons back on Office / PM, as Garry asked | already listed under PR #12 |
| attack3-phone P1, attack3b PH12/PH3 (Save bar not pinned at 481 / 1280 px) | PR #12 pins the Save bar at every width (short laptop screens) | Tester re-points |
| attack5-carryover B5 (real drag at the edge of a 1366×900 window) | cards are a little taller with the step badge on its own line | Tester re-points |

## 20 Nov 2026 — Deliveries fixes (feature/deliveries-19nov): old-screen checks — PENDING Garry
These fail only while a screen still running the OLD version is open. **Go-live step: close every old screen** (every PC, the
Production Manager's phone, the driver phones) when the new file goes live.

| Test | Why it fails (plain English) | Fixed in | Accepted? |
|---|---|---|---|
| deliveries attack19-3 b "(books-it) both screens agree" (Low) | a job added by hand is taken off on a new screen while an old screen books it. The new screen keeps it on the board and clears the stale "taken off" record (same job only); the old screen agrees only after the new screen's next save | go-live: close every old screen | pending |
| deliveries attack19-1 B (both orders) and attack19-3 b "it is in ONE place only" (Low) | the Manager's rule (20 Nov): a "taken off" record is only cleared for the SAME job, matched by the hidden id a job gets when it is added. The test jobs were made without that id (like every hand job added before this release), so when one is taken off on one PC and booked on another, it ends up on the board AND with a "taken off" record in 📚 Past weeks. Nothing is lost; Past weeks just shows the old record too. Hand jobs added after the release clear it (d19-4 checks this) | re-point the fixtures to jobs with an id (Tester) | pending |
| deliveries attack19-3 c "× on the OLD screen erases a hand job" (Medium) | the old version's × deletes a job added by hand with no archive and no question. The new version never erases (it archives in 📚 Past weeks). Code can't change the old file | go-live: close every old screen | pending |
| deliveries attack19-3 d "(old screen) the archived hand job JOB-OFF is NOT erased" | the test's record uses the first key format (`…zz.off`). The new code stores these as `~off.…`, which the old screen's 26-week trim never reaches (checked: passes with a `~off.` key). The test fixture needs re-pointing. Side effect while old screens are open: they keep 26 weeks minus the number of "taken off" records, and show those records as odd rows in their own Past weeks / scorecard | fixture re-point (Tester); go-live: close every old screen | pending |
| deliveries attack19-2 "WO-2610-1 / WO-2611-1: has ↩ Back to Deliveries on Shipped", "… brought back: on Deliveries", "import with the SAME steps: all three still on Deliveries" | out of date: Garry decided 20 Nov that ↩ Back to Deliveries is never offered for step 10 (installed) or 11 (completed / invoiced) | re-point (Tester) | not an app fault |

## 20 Nov 2026 — Deliveries (feature/deliveries-19nov), full suite 339 files: 8,465 pass / 198 fail — pending Garry
No new failing check against the base run except checks that compare with "origin/main", which has moved on:
| Check(s) | Why | Fix |
|---|---|---|
| sync attack1-roles-bytes "vs main", attack1-twopc "B really runs origin/main code" | main now HAS the quick check (R1 live 19 Nov), so "main" is no longer the old code | Tester pins these to the pre-R1 commit |
| attack2-basics / attack2-finder-pm-tag "Deliveries tab reads the same as origin/main" | the Deliveries page changed on purpose (customer band, ticks, bar) | Tester re-points |

## 21 Nov 2026 — Saw batch / hand guard / one template name / copy materials (feature/bulk-issue-lists) — PENDING Garry
Last full run (355 files, commit 6e15a7e): 8,890 pass / 190 fail; live main 339 files: 8,464 / 196. No file worse than main.

| Test | Why it fails (plain English) | Fix | Accepted? |
|---|---|---|---|
| batch attack3-fuzz "the suggestion is the exact-hand template — 110 cases" (Low, same on live) | a hand glued to a ONE-character type ("TYPE 1H", "TYPE BH") gets no template suggested — the person picks it by hand. Nothing wrong is issued. "TYPE 1AH", "TYPE 1 H" are fine | teach the older matcher (`sgFeat`) to split "1H" | pending |
| batch attack3-loaded A (2 checks) (Low) | if an admin presses Migrate lists / Switch back while the lists are still loading on that same PC, the lists count as "loaded" while empty and a remembered saw batch on that PC is dropped. The underlying loading slip is on live too; no saw start-up path hits it (tested) | a "which load is this" check in `lsLoad` | pending |
| lists-filter f1-project-filter, stage1 s11-pend, deliveries attack20-1-merge (timing) | each failed once in a full run with two test streams on 2 CPUs and passes when run alone, same as main | none needed | pending |
| list-window final-b-template-names, m5-template-name-follows, final2-two-pc-names, stage3 flow*-suggest, s4-editor, s5s6-templates, attack1-layout, final-b-old-data (re-pointed, not failing) | these checked the old two-name behaviour; rewritten for Garry's 20 Nov "one name per template". The two-PC rename check no longer checks WHOSE rename wins (last save wins, as on live) | — | nothing to sign; listed for the record |
