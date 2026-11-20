# Plan — Issue lists by house type, copy materials, one template name

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
