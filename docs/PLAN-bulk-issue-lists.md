# Plan — Saw batch table, hand guard, copy materials, one template name

Branch `feature/bulk-issue-lists` (cut from `main`, 20 Nov 2026). **Scope changed by Garry's answers on 20 Nov — the
section "FINAL SCOPE" below is what gets built.** The first plan (office-side "issue by house type") is kept further
down for the record only; that screen is DROPPED.

## Garry's answers — 20 Nov 2026 (live)
- Titles: type and hand are always written "TYPE x" + hand.
- Hands (his words): "Standard units do not have H, hand or handed the H hand and handed are mirrors of standard
  templates. You can also have left and right templates." → plain = standard; H = HAND = HANDED = the mirror; LH and RH
  are their own hands.
- Plain "TYPE 1A" where 1A LH / 1A RH exist: leave for a person, never matched automatically.
- **Bulk (his words): "What I mean about bulking templates together is only in the saw view. I want saw to be able to
  tick number of list together in a separate table and built cut the lists then go back to the individual list and label
  the item that were cut per list."** Office-side bulk issue: dropped.
- What the saw's existing "⚡ Combined cutting list" lacks: grouped by board / sheets; a way back to each list; and the
  saw is not using it / cannot find it.
- Which lists: any he ticks, even across projects.
- **Keep it simple at the start (his words): "Batch table is help saw work quicker by know what's involved when a number
  of lists are grouped. Saw man need to go back to individual list to tick all items as cut as he batches the items in
  their individual lists." "For start saw man goes back into single cutting list and marks everything as cut. Printing
  label is option on initial roll out." A list that is short: "has the missing parts listed in the missing items tab in
  saw view"** (= today's N/A → ⏸ WAITING).
  → The batch table is a HELPER to read from. No ticking in it, no new "labelled" tick, no change to how a house is
  finished. Ticks, N/A and CUT COMPLETE stay on each house's own list exactly as today.
- One name per template: "we have just one name per templates. That looks like a mistake" (Emmet Road "4C" / hidden type
  name "4B"). → the template NAME is the one name; the hidden type name is no longer shown or used.

## FINAL SCOPE (what gets built) — no database change, no SQL
### A. Saw page: "⚡ BATCH" tab (saw only; the Stores combined window is unchanged)
Wireframe in words:
- Tabs: 🪚 TO DO · **⚡ BATCH — 6 houses** · ⏸ WAITING · ✓ DONE. The tick box on each list card reads "＋ Add to batch";
  with 1+ ticked the bar says "6 houses ticked → **⚡ Open batch**" (labels for selected and ✕ Clear stay).
- Top line: "6 houses · 2 projects · 41 of 63 pieces cut" and ✕ Empty batch. Small: "This table is to cut from. Tick the
  lines on each house's own list — tap a house to go to it."
- One block per BOARD (material): heading **"18mm MFC White — 9 sheets for this batch · 4 still to cut"** (same rule as
  the sheets panel: m² ÷ 5.75 + 10%, rounded up). Rows: item · L × W · edging/note · TOTAL · one chip per house
  "House 14 ×2" (project shown first when the batch spans projects). A house's share that is already ticked cut on its own
  list shows ✓ and is struck through; a fully cut row moves to the bottom of its board. Read-only: no tick boxes here.
  Tapping a house chip goes to that house's own list.
- Bottom: "Houses in this batch" — one line per house: name · project · WO · Floor · Unit · "cut 8 of 12" · ⏸ n waiting ·
  **[Open list]** (goes to that house's card in TO DO, scrolled into view) · [🏷 Labels] (optional, prints that house).
  A house that is CUT COMPLETE drops out of the batch by itself.
- The batch is part of the page (not a pop-up), so it refreshes with the other device's ticks and new revisions.
- Remembered on this saw device only (browser storage key `wpfSawBatch`), until its houses are finished; finished /
  archived / replaced lists drop out with a one-line note. Storage blocked → held in memory, note "not remembered".
- Waiting (N/A) lines are not in the table; "check quantity" lines ("2x2", blank) are shown red and never added in.
- 360 px: each row a card; chips wrap; no sideways scroll. Works with lists switched on and off.
Code: `combineLists` (keep ticked lines with a cut flag, per-house line ids, board key) · `sheetNeed` gets opt-in
`anyDate` / `todoOnly` (sheets panel figures unchanged) · new `sawBatchHTML` / `sawBatchBind` drawn from
`renderWorkList` · `wpfSawBatch` memory. NOT changed: `setRowTick`, card ticks, auto-finish on the last tick, CUT
COMPLETE, N/A / Waiting / Release, labels, DONE tab and Undo, Deliveries readiness.

### B. Hand guard in "✓ Confirm all green" (`suggestTpl`)
Small pure `typeKey(text,isTemplate)` → `{code, hand: ''|'H'|'LH'|'RH', why}`. Title: code after TYPE + hand words
straight after it (H/HAND/HANDED → H; LH, L/H, LEFT HAND(ED) → LH; RH likewise); spacing never matters ("1A H" = "1AH" =
"1A-H"); the hand is never stripped; a hand word anywhere else → "hand unclear". Template name: same, TYPE optional,
"T2" = TYPE 2. A template is never GREEN unless code + hand equal the title's exactly; plain title where the project has
LH/RH templates of that code → amber "hand not known — confirm singly". Single ✓ Confirm with a different hand asks
"Template is 1A, title says 1A H — use it anyway?".

### C. One name per template (M5)
`tplName(t)` = the template's name, used everywhere `typeName||name` is read today; the "Type name" box is hidden when
editing a TEMPLATE; saving a template writes `type_name` = name. No stored data is rewritten in bulk. For Garry: check
Emmet Road "4C" — its hidden type name was "4B"; it will now show "4C" everywhere.

### D. Copy a project's materials from another project
As the "Copy materials" wireframe and `matCopyDlg` notes below.

### Acceptance checks (Tester)
1. Tick 4 houses from 2 projects → ⚡ Open batch: grouped by board, sheets per board right by hand, every chip names its
   house (+ project). 2. Tick a line on a house's own card → the batch shows that share ✓ at once (other device ≤ 15 s);
   nothing can be ticked in the batch itself. 3. Close and reopen the browser: same batch. 4. A house marked CUT
   COMPLETE leaves the batch; last-line auto-finish works as before. 5. N/A a line on a house → not in the batch, shows
   in ⏸ WAITING as today; after Release it is back. 6. "2x2" line red, never in a total. 7. New Rev mid-batch: changed
   lines back to uncut; replaced list drops out with the note. 8. Open list jumps to the right card (two houses with the
   same name; a house not on today's TO DO filter). 9. 360 px; lists OFF; Stores page unchanged; sheets panel figures
   unchanged. 10. Hand guard: checks 4–6 of the old plan + single-confirm question. 11. Template "4C"/"4B" → "4C"
   everywhere, no Type name box, `type_name` saved = name. 12. Copy materials: check 11 of the old plan.
   13. Full suite: nothing that passed before fails.

### Build steps (Coder)
1 `tplName` (C) · 2 `typeKey` + guard (B) · 3 `matCopyDlg` (D) · 4 `combineLists` + `sheetNeed` options · 5 batch
memory · 6 BATCH tab + bar/tick-box wording + Open list · 7 full suite → Tester → Manager.

### Not in this release
Ticking inside the batch table; a separate "labelled" tick; piece counting ("7 of 12"); office bulk issue by house
type; "Make handed copy" of a template; a batch shared between devices.

---
# FIRST PLAN (20 Nov, before Garry's answers) — for the record; the bulk-issue screen in it is NOT being built


Branch `feature/bulk-issue-lists` (cut from `main`, 20 Nov 2026). Garry agreed the three jobs on 13 Nov
(see `docs/PLAN-list-window.md`, "AFTER this release") and said "start" on 20 Nov. Nothing is built yet —
this is the Architect's plan; Garry answers the key questions first.

## Three things found before planning
1. **About half already exists.** The "Cutting lists to issue" panel already makes one list per work order from a
   template (`ltiConfirm` → `confirmList` → `lsCreateFromTpl`, fixed id `WO:<wo>`). That fixed id + the database's
   one-list-per-WO rule is what makes a batch safe to retry: a lost reply never gives a second list. Bulk issue reuses it.
   New: the grouping, the handing rules and the screen.
2. **Handing hole in the LIVE "✓ Confirm all green".** `suggestTpl` can turn a plain-titled unit ("TYPE 1") green
   against a project whose only template is "Type 1 LH" — a handed list on an un-handed unit. Fix in this release.
   (Found by reading the code; not yet shown with a test.)
3. **Type and hand are not stored on a job.** A job holds WO, floor, unit, title, customer, step, due date. The only
   place type + hand exist is the free-text Cienapps title, and only when someone typed "TYPE x". Titles like
   "BLK A SF KITCHEN 31 TYPE 1 HANDED" read fine; "ADERRIG BLOCK C1.2 _1ST_FL APT_31 PART V KITCHENS" has no type.
   How useful bulk issue is depends on how titles are written (Question 1).

## Goal
Drawing office / Johnny pick a project and see every unit waiting for a list, grouped by house type WITH its hand
("Type 1A H · Kitchen"). Each group shows the one template that matches exactly. Check the per-unit preview, press one
button, each unit gets its own list at the Saw & Stores. A unit whose type or hand can't be read, or has no exact-hand
template, is never issued. Also: copy a project's materials from another project; every template shows one name.

## Key questions for Garry (recommended answer first)
1. **How are type and hand written in Cienapps titles?** A: always "TYPE x" with the hand straight after ("TYPE 1A H",
   "TYPE 2 LH", "TYPE 1 HANDED") · B: mixed — send 20–30 real titles first and the rule is tuned to them · C: not in
   the title — a person tags units with their type (extra step).
2. **Are "H", "HAND", "HANDED" the same hand?** A: yes (mirror of standard); LH and RH are their own · B: every
   spelling is its own type as typed.
3. **Plain "TYPE 1A" in a project that also has 1A LH / 1A RH?** A: "hand not known — issue singly" · B: plain is its
   own type; only a plain "1A" template fits.
4. **Template whose two names disagree (live: Emmet Road "4C" has type name "4B")?** A: the template name wins and is
   the only one shown · B: the type name wins.
5. **Who can bulk issue?** A: the screens that can ✓ Confirm today (Office, Production Manager, Drawing office, Admin)
   · B: Drawing office, Production Manager, Admin only. "Make handed copy" is template makers only either way.
6. **One list per unit, or one list for all ticked units?** A: one per unit (own ticks, Rev, delivery; resumable) ·
   B: one list attached to all units.

Built-on assumptions (say if wrong): copy materials brings only ACTIVE materials the target hasn't got (by name or
other spelling), never changes or retires the target's own; "T2" at the start of a template name reads as TYPE 2;
room and bed count must not contradict between title and template.

## Wireframe in words — "📦 Issue by house type — <project>"
- Top line: "30 units waiting for a list · 22 can be issued · 8 need you". Small: "Each unit gets its own list from the
  template shown. Nothing is sent until you press Issue."
- Green card per issuable group: **"Type 1A H · Kitchen — 9 units"** → template **"1A H · Rev 3"** 👁 View. One row per
  unit: ☑ · WO · Floor · Unit · Title (type in bold) · due badge. "Untick all".
- Amber card, no exact-hand template (ticks greyed): "No template for 1A H" + **"Make handed copy of 1A"** (template
  makers; others: "ask the Drawing office to make template 1A H").
- Two templates fit: a drop-down "Which template for these 3 units?" — nothing ticked until picked.
- Folded grey: "Issue singly (8)" with the reason per line and a "＋ List" button (normal one-unit window).
  Folded: "Already have a list (12)".
- Bottom: one big green **"✓ Issue 22 lists to the Saw & Stores"**. Running: "Issuing 12 of 22…" + Stop. After: per row
  ✓ / "already made on another screen" / ✗ ↻ Retry, and "21 made, 1 not saved — tap Retry".
- 360 px phone: each unit a 2-line card; the bottom bar stays at the bottom.

## Wireframe in words — "⧉ Copy materials into <project>"
- "Copy from:" other projects A–Z with material counts.
- "Sheets (saw)" and "Fittings / other": ☑ name · "also called: …". Already here = greyed, can't tick. Retired not shown.
- "Tick all new" / "None". Note: "Nothing on this project is changed or removed — only new materials are added."
- **"Copy N materials"** → "✓ 14 added · 3 already here". Lost connection: "may have been added — press Copy again,
  nothing is added twice".

## What changes
**Screens:** one new header button "📦 Issue by house type…" on the Cutting lists to issue panel (asks for a project if
none picked; only with lists switched on and for the Q5 roles) · one new button "⧉ Copy from another project…" at the top
of the Materials window (`MAT_ED` roles) · templates show one name; the "Type name" box is hidden when editing a
TEMPLATE (list editing unchanged) · "✓ Confirm all green": a unit whose type+hand doesn't exactly match the template is
amber with the reason, never green.

**New functions (browser only):**
- `typeKey(text, isTemplate)` — pure, heavily tested. Uppercase; "L/H"→LH, "R/H"→RH; "B-1"=B1; other dashes/underscores/
  dots → spaces. Title: code = token after TYPE; hand = hand words DIRECTLY after the code (H, HAND, HANDED, LH, RH,
  LEFT/RIGHT HAND(ED)). Key = code + hand, spaces removed ("1A H" = "1AH" = "1A-H"); the hand is never stripped.
  Template: the one name is the type (room words, bed counts, TYPE/HOUSE/KITCHEN/STD dropped; what is left must be one
  code + optional hand, else "name doesn't read as a type" and not used for bulk). Title left out, with the reason, when:
  no TYPE word · two types · a count / more than one house (`sgQtyWhy`) · a hand word anywhere other than right after
  the code. A bare "H" elsewhere ("BLOCK H", "HOUSE", "4H BLOCK") is ignored.
- `bulkGroups(pid)` — groups `listsNeeded()` jobs of that project by room + key (already leaves out: has a list, photo
  list, no list needed, on hold, shipped, delivered). Templates from `lsTemplatesFor(pid)` with the SAME key: one →
  issuable; two → person picks; none → not issued. Q3=A: plain key K is "hand not known" when the project has K+LH or
  K+RH in any template or title.
- `bulkIssueDlg(pid)` — built like `lsTplAddDlg`. Press: `officeWho` → per group re-read the template (`lsReloadList`);
  archived or Rev changed since the preview → that group stops and asks again. Then per ticked unit, one at a time,
  `confirmList(wo, tid, by)`, checking first it is still in `listsNeeded()`. Stop finishes the current unit. Can't be
  closed mid-save.
- `tplHandCopy(srcTid, targetName)` — opens the template editor UNSAVED with rows copied and edging / edging 2 swapped
  exactly "Cap Left" ↔ "Cap Right". A note lists the rows that mention left/right/LH/RH/LHS/RHS or a non-standard "cap"
  edging — flagged, not changed. Saved by a person → bulk window reopens with the group matched.
- `matCopyDlg(pid)` — reads both projects fresh (`lsMatFresh`); inserts with fixed id `M:<pid>:<srcId>` so a retry or two
  PCs give "already here", never a duplicate.

**Changed functions:** `suggestTpl` (hand guard; template name only) · `tplName(t)` helper used wherever
`t.typeName||t.name` is read today (~20 places) · template save writes `type_name` = name (`lsSaveManual`, `tplNameTo`)
· `ltiInner`/`ltiBind` and `lsMaterialsDlg` get the new buttons only.

**Data:** NO Supabase change, no SQL, no new key in the planner record. Lists use the existing `save_list_revision`
path (works with or without the pending 18 Nov guard); materials use the existing `project_materials` table. Only
Q1 = C would add `o.htype` inside a job (existing orders JSON). No stored template is rewritten: ones that disagree
keep both names in the database until next saved, but every screen shows the name.

**Cienapps:** nothing changes; titles are only read (trimmed).

## What must NOT change
Single ✓ Confirm / Change template / ＋ New list / 📷 photo list / No list needed · one live list per unit · units with
a list, on hold, shipped or delivered never offered · template permissions (`lsTplSaveOk`, `lsTplPinOk`; a remembered
PIN never opens templates) · "Checked by" if switched on · template × blocks, unit blocks, Add to several templates,
History · materials: aliases, M1–M4, nothing deleted · Floor / Unit / WO / Title separate; due-date style · lists
switched off: screens exactly as now.

## Risks
- Titles don't carry the type → the screen shows mostly "issue singly": safe but little use. Measure on real titles first.
- Wrong hand: exact key, hand never stripped, per-unit preview, handed copy always opened for a person. Still possible:
  a title typed wrong in Cienapps or a template named wrong — the preview shows both.
- Two PCs at once: fixed id → one list per unit; the second PC says "already made on another screen".
- Lost reply mid-batch: later units ✗ Retry; a save that landed is found on retry. Closing the page loses nothing.
- Old screen still open: its "Confirm all green" still lacks the hand guard. Go-live: close every screen and phone.
- Job put on hold on another PC in the last minute or two: a list could be made; it stays out of the saw queue while on hold.
- Speed: ~3 database calls per unit; 50 units ≈ 30–60 s on a good line.
- M5: templates showing their type name today will show their name (Emmet Road "4C/4B" → "4C").
- Existing, unchanged, worth knowing: "Create & attach" with several WOs ticked makes ONE list for many units without
  multiplying quantities.

## Acceptance checks (Tester)
1. Titles "TYPE 1A", "TYPE 1A H", "TYPE 1AH", "TYPE 1A-H" + templates "1A" and "1A H": two groups; H/AH/A-H together
   under "1A H"; Issue gives one list per unit.
2. Mixed hands never share a template; a group with only the un-handed template issues nothing.
3. Make handed copy: unsaved "1A H" with every Cap Left/Right swapped; left/right rows listed, not changed; close without
   saving makes nothing; saving makes the group issuable.
4. "HOUSE 14", "BLOCK H", "4H BLOCK", "HANDED" before TYPE: never read as a hand.
5. Q3=A: "TYPE 2" where "2 LH"/"2 RH" exist → "hand not known — issue singly".
6. Confirm all green never puts LH/RH/H on a plain-titled unit, or the reverse.
7. Two PCs press Issue on the same 20 units: 20 lists, none doubled.
8. Network cut after unit 7 of 20: 7 made, rest ✗ Retry; unit 8 landed but reply lost → Retry says "already made";
   close and reopen → only the 12 left are offered.
9. A unit that got a list / went on hold / shipped after the window opened is skipped with the reason.
10. Template edited on another PC after the preview: that group stops and asks again.
11. Copy materials B→A: only new ones ticked; twice adds nothing; two PCs no duplicates; A's own untouched; retired not
    offered; other spellings come across.
12. Template "4C" / type name "4B": shows "4C" everywhere; no Type name box on a template; after save `type_name`="4C".
13. 360 px: no sideways scroll, buttons tappable. Lists off: no new buttons.
14. Full suite: no check that passed before now fails.

## Build steps (Coder — small commits, full suite before the Tester)
0. Before code: 20–30 real Cienapps titles from 2–3 projects + their template names → the `typeKey` test table.
   (ROADMAP still lists the 3 Nov request for real WO titles as waited-on.)
1. M5: `tplName`, hide the Type name box on templates, save `type_name` = name.
2. `typeKey` + test table. 3. Hand guard in `suggestTpl`. 4. `bulkGroups`.
5. `bulkIssueDlg` (preview first, then Issue / Stop / Retry). 6. `tplHandCopy`. 7. `matCopyDlg`. 8. Header button.
9. Full suite, Tester attack, Manager review.

**If Q1 is B or C:** steps 1, 3 and 7 (one name, hand guard, copy materials) can go live alone first.
**Later:** tagging a unit's type by hand; bulk for snag lists; paste rows from Excel; standard stores kit per project;
search in the Material drop-down; fixing the multi-WO "Create & attach" quantities.

## Progress log
### 20 Nov 2026
- Garry: "Yes start 4". Branch cut from `main` (522e610). Architect plan written. No code yet — waiting on the questions.
- Garry answered two rounds of questions (above). Office bulk issue dropped; the saw gets a read-only ⚡ BATCH tab; one
  template name; hand guard; copy materials. No database change. Architect re-planned; build started.

### 20–21 Nov 2026 — build, test, review (Garry live at the start)
- **Coder** built parts A–D (saw ⚡ BATCH tab, hand guard, one template name, copy materials). No Supabase change, no SQL,
  nothing new in the saved planner record (the batch is kept in the saw device's own browser storage).
- **Tester, 3 rounds** (`tests/batch/attack*.test.js`). Proved the hole on the LIVE version: "✓ Confirm all green" issued the
  "Type 2 H" list to a plain "TYPE 2" unit. Closed on this branch. Found 1 High (a 3-bed template going green on a 2-bed
  house — new on the branch), 4 Medium and ~15 Low; all fixed except the three checks now on ACCEPTED-FAILURES.
  A 290,000-combination comparison with the live matcher found no wrong hand / bed count / room going green, and nothing
  green that is not green today.
- **Manager: GO WITH CONDITIONS.** Conditions done: batch houses shown by Floor + Unit (lists are named after their
  template, so "Type B kitchen" ×6 could not be told apart); a handed unit's best guess is the same-hand template; the
  flaky batch test traced to the test itself and made steady; ACCEPTED-FAILURES entry written. Left for Garry: the
  decisions below.
- **Tests.** Last FULL run (all 355 files) on 6e15a7e: 8,890 pass / 190 fail; live `main`: 339 files, 8,464 / 196. No file
  worse than main except `deliveries/attack20-1-merge`, which failed once under load and passes alone. After that only a
  label/wrapping change (733e425); for it the batch, saw/stores, stage3, list-window and lists-filter folders were re-run
  (204 files, none worse) — the whole suite was NOT run again on the final commit.
- **Not tested by anyone:** a real phone or the saw PC, real Cienapps titles and live template names, the live 10-second
  refresh, printed labels.
- Screenshots (fake database): `docs/screens-saw-batch/`. Go-live steps: `docs/GO-LIVE-saw-batch.md`.

## Changed without being in the plan — for Garry to know
- The saw's old "Combined cutting table" pop-up is replaced by the BATCH tab, so its "MARK ALL CUT COMPLETE" button is
  gone from the Saw page (Stores keeps its own). Each house is finished on its own list, as Garry described.
- Every handed unit (H / HAND / HANDED / LH / RH) is now AMBER, never green — it suggests the same-hand template and is
  confirmed one tap at a time. On the live version "HANDED" against a "… Handed" template was green.
- A template with a word after the type that the planner cannot place ("Type B island", "galley", "L-shape", "corner",
  "special", "large") is amber where it is green today, unless the title has that word too.
- A template whose old hidden type name differs from its name (Emmet Road "4C"/"4B") stays amber until it is next saved.

## Decisions for Garry (recommended first)
1. MARK ALL CUT COMPLETE on the Saw page: **A leave it off** · B add it inside the BATCH tab.
2. Handed units always amber (one tap each): **A keep (safest)** · B exact-hand match may go green and be confirmed in bulk.
3. "Type B island / galley / corner…" templates amber: **A accept, rename where it matters** · B add those words as safe.
4. Old type names that differ: **A accept, they fix themselves when saved** · B open and save each on go-live day
   (read-only SQL to list them is in the go-live doc).
