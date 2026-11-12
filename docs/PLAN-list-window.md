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
