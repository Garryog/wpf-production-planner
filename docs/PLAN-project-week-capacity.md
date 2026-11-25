# Agreed weekly capacity per project (Job B — PM sequence) — plan, 17 Nov 2026

**Garry, 17 Nov:** "In the project managers project sequence of work orders, office needs to be able to set an agreed week
capacity of work for each project. They can be based on number of apartments per week or a money value."

## Garry's answers (17 Nov, live)
1. Over the agreed amount → **warn in red**; nothing blocked, nothing moved.
2. One apartment = **one apartment number** (floor + unit): kitchen, utility and robes of Apt 5 count as ONE.
3. A work order counts in its **delivery week** (the Required / delivery date in the sequence; build date only when there is no
   delivery date yet — shown grey, as the sequence already does).
4. **One figure + exceptions:** e.g. 6 a week, but 3 in Christmas week and 8 from Wk 3 — the office overrides single weeks.

## Wireframe in words
- **Sequence page, top bar (office / Production Manager):** `📏 Agreed per week: 6 apartments  [Change…]` — or
  `€45,000 a week`. Not set → `📏 Set the agreed weekly amount` (office / Production Manager only; PMs see it read-only).
- **Change… dialog:** ( ) Apartments per week  ( ) € value per week · [ 6 ] · "Different for some weeks" → a small list:
  Week [Wk 52 ▾] amount [ 3 ] ＋ · Save. Who / when saved goes in the project's history.
- **Sequence table:** a thin **week band** above each week's rows: `Wk 48 · 23 Nov — 5 / 6 apartments` (green) or
  `Wk 49 · 30 Nov — 8 / 6 apartments ⚠ 2 over` (red). € mode: `€52,300 / €45,000 ⚠ €7,300 over`. Shipped rows still count
  (they were delivered that week); rows with no date are listed under "No date yet", not counted.
- **Capacity Board / Deliveries:** a small red chip on the week header when any project is over its agreed amount that week:
  `⚠ Clancy 8/6` (tap → that project's sequence). Nothing else on those pages changes.
- **PM's phone:** the week bands show too (read-only).

## Counting rules
- Apartments: distinct floor + unit among the project's work orders delivering that week (blank floor/unit → each WO counts
  once, shown "(no unit)" so the office can fix it). Value: the Cienapps value of each work order (additions included).
- A work order moved to another week moves its count with it; the band updates at once.

## Storage — NO database change
- In the planner settings (like the other planner settings): `settings.projCap = { <project id>: { mode: 'apts' | 'eur',
  n: 6, wk: { '2026-12-21': 3 }, by, at } }`. Old screens keep it (unknown settings keys survive on this branch's loader).

## Tests (Tester)
Apartment counting (kitchen + utility + robes = 1; two blocks with the same unit number count 2 — floor differs), € mode,
exceptions, a move between weeks, no delivery date, shipped rows, PM read-only, office edit, phone 360 px, two PCs editing
the amount, old screen open.

## Where / when
Built on `feature/project-details-v2` (Job B — the PM sequence is not live yet). Job B goes live after the cutting list
window release (#5).
