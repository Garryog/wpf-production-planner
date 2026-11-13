# Plan — the cutting list window (small release, target Wed 18 Nov 2026)

Branch `feature/list-window`, cut from `main` (12 Nov, after the Shipped steps release). Goes live AFTER the Deliveries weeks
release (Mon 16 Nov); when that is merged to `main`, `main` is merged into this branch.
Garry, 12 Nov: "i really want to get working on the cutting list side of planner". Requests: ROADMAP sections L1–L12, DD1,
"Decisions 10 Nov 2026, 16:18", "Garry 10–12 Nov".

## Goal
Making a cutting list is one obvious path: open it from the job → fill the rows → one big Save → "Saved ✓ — list is with the
Saw & Stores". Nobody picks a project by hand, the Cienapps work order number is always there, and there are as few buttons
as possible. The production manager is old-school; buy-in depends on this being simple.

## Where the code comes from
Most of L1–L12 was already built and attacked on `feature/project-details-v2` (10–12 Nov), mixed in with the PM / sequence /
spec-sheet work that is NOT part of this release. This release **ports only the list-window commits** onto `main` and leaves
the rest behind:

| Piece | Commits on project-details-v2 (in order) |
|---|---|
| Matching key "same house" (project + floor + unit), JS only | 7141f0f, fde9ddf, bbf8622 (JS parts only — no SQL) |
| L1 + L3 Floor / Unit / Title boxes, find the WO | 3c29ded, b32232d, eb9f773, 5fd2d5a |
| L4 P-number last resort, purple "not from Cienapps", two PCs | 39f230d, 641b56b, 419e580, 1d17d08 |
| L7, L6 wording | 7f46cbc, 7e47894 |
| L8 ✕ Close, Saved ✓ panel | 351eb55, d744ca2 |
| Customer = project (L5) | f2aaa48, e7323af, 319a6cb |
| L6 New material first time | fee4b2f |
| L11 + L12 + list name not pre-filled | cd7163a |
| L10 storage bar + Settings | 871609e |
| Tests | the test files those commits add or change, 2a2534e, 5d9ebc1, 63226eb (attack 5) |
| Later, after the Deliveries release is on main: L9 | 8c5903b, d23371e, 1199eb2 |
| Later, own decision (see Q1): L4b merge on import | 2973ddd, 889ee7f, e7ba7e2 |

Left behind on purpose: spec sheets ("✎ Project details"), PM sequence, pre-production pool, upload matching, every SQL block.
**No database change in this release.**

## The window — wireframe in words

Opened from a job (the normal way):

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ✍ New cutting list                                              [ ✕ Close ]  │
│ WO-2617-4 · ASPECT ATHENRY                       [ Due Fri 14 Nov · Wk 46 ]  │  ← WO always shown (L2); due badge (DD1)
│ Floor [ 7  ]  Unit [ 231 ]  Title [ Kitchen type B          ]                │  ← three boxes (L1)
│ List name (optional) [                    ]   e.g. "Kitchen — Type B"        │  ← empty, free name (item 7)
│ Start from: [ Standard blank list ▾ ]                                        │  ← ONE choice (item 1)
│              · Standard blank list · A template… · An Excel file… · An old list…
│──────────────────────────────────────────────────────────────────────────────│
│ #  Description        Qty   L     W     Material ▾   Edging 1  Edging 2  Note │  ← "Qty" hint in the empty box (L7)
│ 1  [            ]    [Qty] [L]   [W]   [        ▾]  …                         │     Material ▾ ends with "＋ New material…" (L6)
│ [ ＋ Row ] [ ＋ Heading ]                                   More ▾            │  ← More ▾: undo, no cutting / no fittings,
│                                                                               │     unit blocks, carcass / door material,
│                                                                               │     🧱 Project materials (add / edit), help
│                                   [   SAVE LIST → SAW & STORES   ]            │  ← one big button
└──────────────────────────────────────────────────────────────────────────────┘
after Save:   Saved ✓ — list is with the Saw & Stores            [ Close ]       (L8)
```

- **Project line.** WO known → the project is the WO's customer, shown as text; found or made automatically (item 2). No
  drop-down, no "Pick the project." message. A project picker appears ONLY when the window is opened with no work order
  (＋ New list on the Lists page): then Project ▾ first, then Work order ▾ listing only that project's jobs (item 4).
- **Work order ▾ (no-WO path only).** This project's live jobs, earliest due first, no date last:
  `WO-2617-4 · Fl 7 · Unit 231 · Kitchen B · due 14 Nov`; shipped / on-hold left out; `✓ has a list` on jobs that have one.
- **WO blank (L3).** "Find the Cienapps WO" looks it up by project + floor + unit: one match fills in and says what matched;
  several → short pick list; none → "No Cienapps job found" and, only after the person confirms, a P-number (purple, "not from
  Cienapps") (L4).
- **Start from… (item 1).** Replaces the separate "📐 Insert from template", "📥 Import Excel" buttons in the window and the
  need to go to "Find old list" first. Shown only on a NEW list that has no typed rows yet (after that it would overwrite
  work — it then asks first). "Insert from template" for adding a second unit to a list in progress moves under More ▾.
- **Save as template** and 🕘 History: shown only to the Drawing office and Admin roles (item 1). Everyone else never sees them.
- **✕ Close** top right at all times; asks only when something was typed and not saved. Clicking outside does nothing (L8).
- **Phone (360 px):** same order top to bottom, one card per row as today, the Save button full width and always in reach.

Lists page: the top bar keeps `＋ New list` and `🔍 Find old list`; `📥 Import Excel` moves into the window's Start from…
(ASSUMED — see Q3).

## Key questions for Garry (built on the recommended answer; say if different)
1. **P-number → Cienapps WO merge when the import arrives (second half of L4).** You already listed this as release 4 of
   the small releases. (a) **Recommended:** keep it as its own release right after this one — this release makes P-numbers
   rare (confirmed last resort, flagged purple) and warns "two jobs for one house"; (b) put the merge into this release (more
   to test, likely past 18 Nov).
2. **Who may "Save as template".** (a) **Recommended / built:** Drawing office and Admin only; (b) also Production Manager.
3. **"📥 Import Excel" on the Lists page top bar.** (a) **Recommended / built:** only inside the window under "Start from…";
   (b) keep the top-bar button as well.
4. **Floor or Unit blank on either side when looking up the WO.** (a) **Recommended / built:** no automatic match — the
   person picks from the project's jobs; (b) match on the one that is filled in.

## What must NOT change
- One live list per work order. Saved lists, templates, materials and projects are untouched (no migration).
- What the saw and stores see, tick and print. Revisions, checks, holds.
- Excel import still reads the current template (and the Floor / Unit / WO cells when present).
- Lists switched OFF: the old screens behave exactly as today.
- An old screen left open (today's live version) must not be able to damage a list made in the new window.
- Nothing is ever deleted; no other app's stored copies are removed (L10).

## Risks
- The port drops the spec-sheet / sequence code the original commits sat beside — every conflict needs reading, not guessing.
- Two PCs making a list for the same job, or a P-number for the same house, at the same moment.
- Customer renamed in Cienapps → a second project for the same customer (rule: one project per customer however spelled;
  a "contains" fit is asked, never assumed).
- Two units with the same number in different blocks (floor / block must be part of the match).
- Fewer buttons must not hide something the Drawing office uses daily (templates, Excel) — they stay one tap away.

## Acceptance checks (Tester)
1. From a job: window opens with WO, project, floor, unit, title filled; no project picker; type rows; Save; "Saved ✓ — list
   is with the Saw & Stores"; Close. The saw sees it.
2. Customer with no project yet → project made from the customer, once; second list for the same customer reuses it.
3. No WO: pick project → WO list shows only that project's jobs, due-date order, shipped / on hold missing, "has a list" marked.
4. WO blank, floor + unit typed: one match fills in; two matches → pick; none → P-number only after confirm, shown purple.
5. "＋ New material…" works first time, with and without an existing project; asked once.
6. Empty Qty box shows "Qty". List name empty on open; a typed name is found in Find old list and in the template list.
7. ✕ Close with nothing typed closes at once; with typed rows asks; outside click does nothing.
8. "Save as template" not on screen for Saw, Stores, PM, office; there for Drawing office and Admin.
9. Start from… template / Excel / old list each fill the rows; changing it after typing asks first.
10. Storage full / blocked: the bar says how to fix it; Settings shows device storage; nothing deleted.
11. Attacks: two PCs at once · old screen open · phone 360 px · WO with blank floor/unit · two units same number in different
    blocks · P-number then import · customer renamed in Cienapps · Excel import through the new window · template save by a
    non-Drawing role.

## Build steps (Coder — small commits, full suite before handing over)
1. Port the matching key (JS only) + its tests.
2. Port L1 + L3 (boxes, find the WO, Excel job cells).
3. Port L4a (P-number last resort, purple flag, two PCs) — without the spec-sheet lines.
4. Port L7, L6, L8, customer = project, L11 + L12, list name, L10.
5. Port the tests that belong to 1–4 (update expectations only where the change is intended; say which).
6. NEW: project shown as text when the WO is known (picker only with no WO).
7. NEW: "Start from…" single choice; move the rest under More ▾; "Save as template" / History only Drawing office + Admin.
8. NEW tests for 6–7 in `tests/listwin/`.
9. Full suite; compare with the `main` baseline; anything new failing is fixed or listed in ACCEPTED-FAILURES for Garry.
Later runs: merge `main` after the Deliveries release → L9 + DD1 badge (item 8) → Tester → Manager.

## Progress log

- **12 Nov 2026, 15:27** — plan written (session …5ys5PB). A second scheduled run (session …AqWY5P3m) had started at the same time; it
  found this plan when it came to push (58 minutes later, nothing else pushed), kept this plan as the plan and merged its build in.
  What it built follows.

# What was built — run of 12 Nov (session …AqWY5P3m)

The window as built differs from the wireframe above in three small ways: the WO number and due date are in the title bar;
"Start from… ▾" is a drop-down button at the top right (not a select) and stays there after rows are typed (it ADDS rows, never
overwrites); "🧱 Project materials" is a button under the rows, not under More. With the job known the Project / Work order
pickers are folded behind "Change job ▾" rather than removed.

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
| 6 | Old tests moved to the new layout; full suite; ACCEPTED-FAILURES tidied for this branch | done 12 Nov |
| 7 | Ownership: "no list yet" warnings to the Drawing office only; PM sees list status read-only | done 12 Nov — PM part; who else sees the warnings is question 7 |
| 8 | Merge `main` once the Deliveries weeks release is in; then L9 (delivery card) and DD1 on Lists home / lists-needed | waits for Mon 16 Nov |
| 9 | Phone: "Use these rows" button in the old-list finder; Esc closes the little panels first | done 12 Nov |
| 10 | Tester round 2, Manager verdict | done 12 Nov — interim GO WITH CONDITIONS |
| 11 | Simplicity polish: one Close, Save pinned to the bottom on phones, the 4 small keyboard points; Tester re-attack of the round-2 fixes | polish done 13 Nov; Tester re-attack to do (next run) |
| 12 | After main is merged: full suite, Tester, final Manager GO, GO-LIVE doc, pull request (not merged) | waits for Mon 16 Nov |

## More questions for Garry (found by the Tester) (recommended answer first)
1. **Two lists on one work order.** Today the window lets a second list be saved on a WO that already has one (it was allowed on
   3 Nov so a kitchen list and a wardrobe list could share a WO). Now it asks first. **A (recommended): keep asking** — "WO already
   has a list — don't save / save anyway". B: never allow a second list. C: allow silently as before.
2. **P-number → Cienapps WO merge (L4b).** **A (recommended): next small release after this one** (it needs one SQL block run in
   Supabase first). B: hold this release until it is in.
3. **Who may save a template.** **A (recommended): Drawing office and Admin only, everywhere** — also take the button off the
   Cutting Lists page rows for everyone else, and the Production Manager PIN no longer opens it. B: leave the Lists page as it is.
4. **Customer spelled one letter differently in Cienapps** ("Aderig Homes"). Today that quietly makes a second project.
   **A (recommended): ask** "Is this project Aderrig? Yes / No — make a new project". B: leave it.

## Progress log — build
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
- Old tests moved to the new rules (said here as the plan asks): s3 bar order, attack3 F8 button, e9 Save as template by role, e5 /
  stage3 attack2-screens / s1s3-screens / s4-editor (materials with no PIN — the Job B branch's versions), l3 read-only Floor box,
  s4 waits for a template's rows; two Tester checks corrected (due "due ?" agreement, unit-block quantities).
- **Full suite (197 files, one at a time, fake Supabase):** 3,984 pass / 75 fail, then 9 stage3 checks fixed by the test updates
  above → **66 fail: 27 are the known ones on ACCEPTED-FAILURES (unchanged by this branch) + 39 from the Tester's new attack files**,
  each listed in ACCEPTED-FAILURES under "Cutting-list window release", pending Garry.
- Not done yet: steps 7–10. No Manager verdict yet, so no pull request.
- Another scheduled run started this job at the same minute; its plan commit (15:27) was merged, no code clash.

### 12 Nov 2026, late (scheduled run 2, 18:23–21:40 UTC)
- `release/deliveries-weeks` is NOT on `main` yet, so `main` was not merged and item 8 (L9, DD1 on Lists home) is still waiting.
- **Coder (5 commits):** "Save as template" is Drawing office / Admin only everywhere (Lists page rows too; the Production Manager
  PIN no longer opens it) · phone: "Use these rows" in view and tap-sized; a second press asks · Esc closes the little panel first;
  Tab from an empty last row goes to Save · PM screen shows each job's list status as plain read-only text (PMs already had no
  list buttons or nags) · "⚠ 2 lists on WO-…" tag on the Cutting Lists page.
- **Tester round 2** (6 new files, 259 checks): no Critical. 1 High — an Excel file for a DIFFERENT house went into the open list
  with no warning. 2 Medium, 4 Low.
- **Coder fixes (8 commits), all of the above:** the Excel file's WO / Floor / Unit are checked against the open job and ONE
  question is asked before any row goes in · a WO typed from another project files the list under the WO's project (customer =
  project) · PM status wraps on phones · the "add a second time?" question only when the rows are really there · Start from…
  closes when a choice is made · Esc leaves the cursor in the row · the 2-lists tag ignores case / spaces · photo-only jobs say
  "photo list made".
- **Full suite (203 files): 4,254 pass / 64 fail** — 27 long-standing, 26 round 1, 11 round 2 "(info)"; every one is on
  ACCEPTED-FAILURES. No file got worse.
- **Manager: interim GO WITH CONDITIONS** for items 1–7, 9 and ownership on 18 Nov. No Blockers, no database change, nothing
  unescaped, lists OFF unchanged apart from the Settings storage section. Conditions: main (with Deliveries) merged in and the
  suite + Tester re-run; step 11 done; Garry's answers below. Item 8 recommended as its own small release after 18 Nov.
  The Manager also notes: "Keep one…" removes an EMPTY duplicate P-number job (a copy is kept in settings, last 300).
- Not a final GO, so no pull request and no GO-LIVE doc yet.
- Left as found: an old list with NO work order can't be saved after an edit — the same on the live site today (question 9).

## Questions added 12 Nov, late (recommended answer first)
5. **"＋ New template" with the Production Manager PIN.** **A (recommended): Drawing office / Admin only**, same as Save as template. B: leave it.
6. **Drawing office PIN remembered on a shared PC.** **A (recommended): forget it when the list window closes.** B: forget after 30 minutes. C: leave.
7. **Who sees "Cutting lists to issue" warnings.** **A (recommended): Drawing office (Johnny) only.** B: office and Production Manager too (as built today).
8. **Settings → "Storage on this device" when lists are OFF.** **A (recommended): show it.** B: hide it.
9. **Old list with no work order, edited.** **A (recommended): let it save without one** (new lists still need a job). B: keep forcing a work order.
10. **Item 8 (＋ Add cutting list on the delivery card, due badge on Lists home).** **A (recommended): its own small release right after 18 Nov** — it can't be built until Deliveries is live on the 16th, leaving one day to test. B: hold the whole release for it.
11. **Default "list owner" name shown to the saw** ("Tell the Production Manager"). **A (recommended): change to "Drawing office".** B: leave.

### 13 Nov 2026, 00:40 UTC (scheduled run 3, started 21:24 on the 12th)
- **Two runs overlapped again.** Run 2 was still working when this one started (its last push was 3 hours old, so the
  "pushed in the last 30 minutes" check let this run through). Both did a Tester round 2. Run 2's 10 commits were merged in
  (8b4d379): its Excel "different house" question and its old-list marker kept; this run's "list name never filled from the
  sheet name" kept. Nothing lost. `release/deliveries-weeks` is still NOT on `main`, so item 8 still waits.
- **Tester round 2b** (5 new files, 248 checks): 2 High, 8 Medium, 6 Low.
- **Coder — fixed (21 commits):**
  - F1 High: Floor 1 · Unit 12 with Title "BLOCK B…" filled in Block A's work order by itself. Now a job whose title names
    another block is never filled in — it is offered as "not sure"; the look-up waits until the Title box is left.
  - F2 High (flag only, no merge): a house that already has a list under a P-number is no longer put on "Cutting lists to
    issue" when its Cienapps WO arrives — it says "List already made under P-…"; the import preview says the same.
  - F3/F4: customer → project is asked, never assumed ("Lucan Developments Ltd" vs project Lucan; "Aderrig Park Homes" vs
    Aderrig). Links by itself only when it is the same customer once Ltd / PLC / The… are ignored.
  - F5/F11/F12: templates (new, edit, archive, copy from another project) Drawing office / Admin only; Admin not asked twice;
    a PIN typed at that question is not remembered.
  - F7 (already live): a new P-number's typed due date, value and hours are no longer blanked when a material is picked.
  - F9: saving a list that was archived on another screen says so instead of "list is with the Saw & Stores".
  - F13 list name not taken from the Excel sheet name · F14 · F15 saw screen says "Tell the Drawing office" · F16 phone button size.
  - Step 11: Tab / Shift+Tab stay inside the window and reach Save; ✕ with only empty rows closes without asking; on phones the
    big Save is pinned to the bottom; ONE Close (top right — the second Close beside Save is gone).
- **Not fixed, on purpose:** two PCs pressing Save in the same second (needs a database rule — with L4b); F6 an old screen wipes
  the duplicate-P-number safety copies (go-live step: close every screen); F10 Excel columns in an unusual order (already live).
- **Test expectations changed by the Coder (each follows a deliberate change):** stage3/flow5-saw + s1s3-screens (owner wording),
  editor/x1-excel-template (name blank), editor/attack1-editor E + seq/l5-l12-window + seq/attack5-window (Drawing office PIN for
  templates; no bottom Close), seq/l3-find-wo (look-up on leaving Title).
- **Full suite (209 files): 4,490 pass / 57 fail** — 25 long-standing, 26 round 1, 6 round 2; all on ACCEPTED-FAILURES. No older
  file worse than before this run.
- **Manager: GO WITH CONDITIONS (interim)** — no Blockers, no database change, everything escaped, lists OFF unchanged, test
  changes legitimate, main path has no pop-up questions. Two "should fix" for the next run:
  1. The F2 flag matches on house + job type only — a P-number list for Block A could hide Block B's WO (same floor / unit) from
     "Cutting lists to issue", and the Lists tab count then disagrees with the panel. Use the block-in-title check there too.
  2. A Drawing office PIN typed for something else (✓ Check, materials) on a shared PC is still remembered and still opens the
     template buttons (Garry decision 2 below).
  Conditions for the final GO: those two; Tester re-attack of this run's fixes and step 11; `main` merged in after Deliveries
  goes live Mon 16 Nov + full suite + final review; go-live day: close every screen first.
- Not a final GO, so no pull request and no GO-LIVE doc yet.

## Questions added 13 Nov (recommended answer first) — 1–11 above are still open; built on the recommended answers
12. **Drawing office PIN on a shared PC (replaces 6).** **A (recommended): only the Drawing office / Admin screen, or the PIN
    typed at that moment, opens templates — a remembered PIN never does.** B: leave as built.
13. **Two PCs saving a list for the same job in the same second.** **A (recommended): accept for 18 Nov; fix with the database
    rule in the L4b release.** B: hold this release.
14. **An old screen left open can wipe the duplicate-P-number safety copies.** **A (recommended): accept, with "close every
    screen" on the go-live list.** B: fix first.
15. **This scheduled task has now run twice at once on two days.** **A (recommended): keep ONE schedule for this job, at least
    4 hours apart.** B: leave it.

