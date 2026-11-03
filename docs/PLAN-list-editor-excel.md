# Plan: list editor that works like Excel + Save as template (Architect, 3 Nov 2026) — awaiting Garry's 3 answers

## For Garry: making a list
1. Open a project, then **+ New list** (or **Type a list** on a work order). The grid has the same columns as your sheets: **Description | Qty | Length | Width | Colour | Edging | Note**.
2. Fill in **Carcass colour** and **Door colour** once at the top. Rows left without a colour take them.
3. **+ Unit block**: type "900 Single Rail + 2 shelves" and **Units: 3**, then the parts with the quantity for ONE unit. The planner shows the total (2 × 3 = 6). Changing Units to 4 updates the whole block, like your =$B$5*3 formulas.
4. **+ Heading** for per-house extras ("Gandon Crescent 1": Kicker, Filler, Gable, Backs, Top Cornice).
5. Typing works like Excel: Tab moves right, Enter moves down, the arrow keys move around, and Ctrl+D copies the cell above. You can paste rows straight from Excel.
6. **Insert unit from template…** adds a standard unit (like your Blank sheet) and asks how many.
7. **Save as template** from any list. Give it a type name; ticks are never copied.
8. **Editing a template** saves Rev 2, 3… with a **History**. Lists already made from it never change; they only show "template is now Rev 3 (this copy Rev 2)".
9. **The saw** sees unit headings ("900 Single Rail + 2 shelves – 3 units"), the total to cut on each line, and per-line ticks, as today.
10. Making or editing templates needs the Production Manager, Drawing office or Admin PIN. Anyone in the office can make lists.

## Editor changes (openListEditor2 / draw)
- **Columns:** Description, Qty, Length, Width, Colour, Edging, Note. There is no SAW/FIT column: a row with a length or width goes to the Saw, a row without goes to Stores (decided at save, shown with a grey "Stores" tag).
- **Qty:** inside a unit block it is the per-unit quantity, with "= total" shown beside it.
- **Row types:** part, heading, and unit heading (with Units).
- **Keyboard:** Tab and Shift-Tab; Enter goes down the same column (and adds a row at the bottom); Up/Down; Left/Right at the edge of a cell; Ctrl+D fill down; Insert adds a row; Ctrl+Delete deletes a row; Ctrl+Z undoes. draw() keeps the cursor where it was.
- **Paste** (tabs or new lines) fills rows from the current cell through `lsParseGrid`. It skips the header row, turns text-only rows into headings, reads "total nr of units" as Units, and works out per-unit = total ÷ Units. It shows a summary and can be undone.
- **Colour:** a dropdown of project sheet materials, free text allowed; anything not on the list shows amber and is flagged.
- **Edging:** a dropdown of L1LE 1mm, L2S1LE, L4S 1mm, L4S 2mm and No edge, plus codes already used in the project; free text allowed.
- **Header colours** fill blank Colours at save, with a "Fill down" button to preview.
- **Phone (<700 px):** one card per row, no shortcuts or paste.
- **Storage:** a part line's `qty` stays the TOTAL to cut, so the saw, sheet calculator, combined list and labels are unchanged.
  - A unit heading is stored as `kind='hdr'`, with `qty` = number of units.
  - A part line stores `section` and a new `unit_qty` (per-unit quantity).
  - If Units changes, totals change and those lines are flagged CHANGED (Rev rule). If the total doesn't change (2×2 → 1×4), the line counts as unchanged.
- **Bug found:** lsEditRows/lsEditMerge drop heading lines today. Editing an imported list loses its headings on the saw.

## SQL (add to the still-PENDING Stage 3 block, before any code uses it)
- In `create table list_lines`, add `unit_qty text,`.
- In `save_list_revision`, update and insert `unit_qty` from `e->>'unit_qty'`.
- For an existing test project: `alter table list_lines add column if not exists unit_qty text;`
- No new table, so no new GRANT lines; the existing list_lines grants cover the column. It must be included in the migration rehearsal.

## Save as template / Edit template
- `lsSaveAsTpl(src)` (needs the template PIN) works from a library row, the editor (including unsaved drafts) or a live list. It asks for type and type name.
- If that name already exists it offers "Update template (Rev n+1)" or "New template". It copies headings and `unit_qty`, never ticks, and does not link the source list.
- Edit template = rev n+1 with an optional "what changed" note. A History dialog lists revisions, each viewable read-only.

## Excel import: what the parser gets wrong today, and the fix (confirm with fixtures built from the real files)
1. **Project/Title/Date/Carcass/Door colour header rows** become project "Project" or headings. Fix: recognise the labels and take the value from the next cell.
2. **The "Description | Qty…" column-header row** shows on the saw as a heading. Fix: skip it.
3. **"N – total nr of units"** becomes a Stores line. Fix: it sets Units on the current unit heading.
4. **Formula quantities:** only the cached total is read. Fix: read the formula (=$B$5*3 gives per-unit 3); if there's no cached value, use Units × per-unit.
5. **Carcass/door colour rows** become headings and blank colours stay blank. Fix: fill them as in the editor.
6. **Index sheet** is imported as a list, and the **Blank sheet** becomes a LIVE list auto-tagged to work orders. Fix: skip Index; offer Blank as the project's "Standard units" template (Q3).
7. **The school room breakdown** becomes Stores lines. Fix: an import preview where Stores lines and units can be unticked.
8. **Error text** fix: change it to "Description | Qty | Length | Width | Colour | Edging".

Paste and import both go through one pure function, `lsParseGrid(aoa, {formulas})`.

## Build order (full suite after each step; tests in tests/editor/)
1. lsParseGrid (pure) with fixtures modelled on "Cutting list - Blank.xlsx" and "Cutting list - Cairn Homes.xlsx" (Gandon Cresent 1,2,3) and the school "1200 Wall Units" sheet.
2. Switch the import to lsParseGrid, skip Index, add the Blank-as-template offer and the preview.
3. `unit_qty` in the SQL block and through lsRowToLine/lsCopyLines/lsLineSig/lsView.
4. Keep headings in the editor.
5. Columns, Saw/Stores at save, Colour and Edging dropdowns, header colour fill.
6. Unit blocks.
7. Keyboard and cursor.
8. Paste.
9. Save as template, Update template, History.
10. Insert unit from template.
11. Phone cards.
12. Full suite, Tester, Manager.

## Risks
- Changing Units after the saw has started resets that block (CHANGED flag).
- Cursor lost or slow redraw on big lists.
- Big or odd pastes.
- Colour codes (W/W, UD96) not on project material lists: pre-load them.
- Two people editing the same template.
- Workbooks with no cached values.
- Any code that adds up `qty` without skipping headings.
- Chrome on Android dropdowns.
- The column must be in the SQL before deploy.

## Questions for Garry
1. Row with no colour: A) Carcass colour, except "door"/"drawer front" rows get the Door colour (recommended); B) always Carcass.
2. Changing number of units after the saw has started: A) that block resets and is flagged CHANGED (recommended); B) only allowed before the saw starts, after that a new list.
3. The "Blank" sheet on import: A) becomes the project's "Standard units" template (recommended); B) skipped.

## Garry's answers (3 Nov 2026) — APPROVED for build with these changes
1. **Colour:** every row's Colour is a DROPDOWN of the project's preloaded materials, with an **"+ Add new material…"** option that adds it to the project's material list (and selects it). No automatic carcass/door fill rule: the header colours become an optional default for new rows (a new row starts with the previous row's colour), and they can always be changed.
2. **Changing the number of units after the saw has started → a NEW LIST**, not a Rev 2 reissue. Before the saw starts, Units can change freely. After any line is ticked, the Units box is locked and shows "Saw has started — make a new list for a different number of units". A **"Make new list from this"** button copies it (no ticks) for editing. Other edits keep the existing Rev 2 rule.
3. **"Blank" sheet on import: ignore it** (and the Index, Stock and Door Stock sheets). No "Standard units" template from it. "Insert unit from template…" (step 10) still works from templates made with Save as template.
4. (3 Nov, after seeing the build) "Make new list from this" → the OLD list is ARCHIVED automatically once the new list is saved (taken off the saw). Parts already cut on the old list show on the new list as "already cut on old list" so the saw can check before cutting again.
5. Stores (fittings) rows start with NO colour (they do not copy the row above); pick one only if needed.
