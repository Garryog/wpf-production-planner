# Review: WPF's current cutting-list format (3 Nov 2026)

Source: SharePoint "Production - General / Jobs Ready for Production" (read-only, via the Microsoft 365 connector).

## What is there
- **Cutting lists folder:** about 130 Excel workbooks, one per project ("Cutting list - Cairn Homes.xlsx", "Cutting list - Lusk Phase 3.xlsx", "CUBICLES CUTTING LIST 2026.xlsx", a "Cutting list - Blank.xlsx" starter), plus a few snag lists ("Cutting list - Dunleer snags.xlsx") and door lists.
- **Project folders** (e.g. Rosshill, Tivoli Mews): CNC part reports from the design software ("ROHIL_Type_1B_1A_C01 - Crystal Report.pdf"), one per kitchen type. These list each cabinet (W/H/D, position, material, e.g. Egger U702 Cashmere Grey 18mm) and its parts with a CNC number. They are CNC-cut, not saw lists.

## How a saw cutting list is laid out (Excel)
1. **One workbook per project/customer.** An **Index** sheet lists site / road / house numbers. Then **one sheet per house or group of identical houses** ("Gandon Cresent 1,2,3"). The sheet name is pulled into the title.
2. **Sheet header:** Project, Title, Date (=TODAY()). On school jobs also **Carcass colour** and **Door colour** (e.g. UD96 / BERMUDA), which fill down into the rows.
3. **Unit blocks.** A heading row with the unit name ("900 Single Rail + 2 shelves", "1200 Wall Units"), then "N – total nr of units", then part rows. Part quantities are formulas: per-unit quantity × number of units (=$B$5*3). Change N and the whole block re-calculates.
4. **Part row columns (6):** Description | Qty | Length | Width | Colour/board (W/W, UD96, WHB, W/W Vinyl) | Edging/finish code (L1LE 1mm, L2S1LE, L4S 1mm, L4S 2mm, "No edge", blank).
5. **Per-house extras** after the units ("Fillers & Kickers"): a sub-heading per house ("Gandon Cresent 1"), then Kicker, Filler, Gable, Backs, Top Cornice with their own sizes.
6. **"Blank" sheet = the customer's standard unit library** (every robe/unit type with its per-unit parts and N=1). New house sheets are copied from it and N is changed. **This is today's template.**
7. Schools/commercial: one sheet per unit type, with N units and a room breakdown at the bottom (Science Lab 1: 6, Library: 6 …), plus colour lists.

## What this means for the planner's list editor
- Keep the **same 6 columns, in the same order and with the same names**: Description, Qty, Length, Width, Colour, Edging (+ Note).
- Build lists from **standard units × number of units** (like the Blank sheet and the =N×qty formulas), plus **per-house extra rows** (kickers, fillers, gables, backs, cornice).
- Carcass/door colour is set once in the list header and fills down. Colour and edging are dropdowns of the codes WPF already uses, and free text is still allowed.
- Work like Excel: Tab/Enter between cells, paste rows straight from Excel, fill down, insert/delete row, unit headings as group rows.
- The existing "Import Excel" (one workbook per project, one sheet per house) must read these real workbooks correctly, including unit blocks with "total nr of units", per-house sub-headings and formula quantities. This is to be checked against real files before building.

## Addendum 4 Nov 2026: standard production (Garry: "Cairn Homes is a bad example")
Garry: most cabinets come off the CNCs. The saw list is mainly the **fillers and exposed material** (plus some worktops). **Aspect Athenry** and **O'Malleys** are the typical examples. Cairn Homes (wardrobes, everything off the saw) is the exception.

What those workbooks show ("Aspect Cutting List.xlsx", "O'Malleys - Cutting List.xlsx"):
- **One sheet holds several houses.** Each house is a heading ("House nr 103", "House 7 — Type 2", "Block B Apt 29"), followed by sub-headings: "Fillers and Kickers", "Worktops, Fillers and Kickers", "ISLAND", "Utility 103", "Doors FU", "Doors WU".
- **Each house is about 10–25 lines:**
  - Saw parts: Kicker, Fillers, Gable, Tall Gable, Island Gables, Island Back, Heat Pump Frame, Cross Rails, Batten, Raw MDF, Head filler.
  - Worktops: "Top 1000×600 Frosty Matt 25mm, No Cap".
  - Fittings / appliances with a quantity and the item named in the colour column: Kicker vent, Sink "Hafele Calder", Tap, Extractor, Gola rail "J Type", Gola clips, Robe handles.
  - "Bought in" items that have sizes but must NOT be cut, e.g. "Panel Back 900×1842 Nautic Blue — Bought in".
  - Free-text notes: "Talk to Ollie", "Cut down bought in doors at 345".
  - Door rows with no description, sitting under a "Doors FU" heading.
- **No "units × N" blocks.** Houses of the same type are near-copies with small differences: LH/RH sink handing, an extra filler, a 625 vs 628 gable.
- **Spec placeholders on the list:** "Worktops — None Chosen / TBC / Corian", "Sink + Tap — TBC".
- **Edging codes seen:** L1L+2SE 1mm, L1L2SE 1MM, L1LE 1mm, L2LE 1mm, L4S 1mm, L4S 2mm R, "No Cap", "Bought in", and an edge colour ("L2LE 1mm Blue").
- **Material includes thickness:** "36mm Grey Bordelino", "Frosty Matt 25mm", "18mm MDF".

**What this means:** the planner should keep it simple. One list per house, with headings and sub-headings. Templates are a whole house type, copied per house and tweaked. A fast way to make the same list for several houses is needed. Row kinds are Saw / Worktop / Stores item / Bought in / Note. Unit blocks × N become optional (Cairn-style robe jobs only).
