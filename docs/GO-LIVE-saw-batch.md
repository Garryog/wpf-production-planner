# Go-live — Saw ⚡ BATCH tab, hand guard, one template name, copy materials

Branch `feature/bulk-issue-lists` → `main`. **No Supabase SQL to run. Nothing to run before or after.**
Manager verdict 21 Nov 2026: GO WITH CONDITIONS (conditions done; Garry's sign-offs below).

## Before merging
1. Read "Changed without being in the plan" and "Decisions for Garry" in `docs/PLAN-bulk-issue-lists.md`.
2. Sign off the 21 Nov entry in `docs/ACCEPTED-FAILURES.md`.
3. Optional, read-only — list templates whose hidden old type name differs from their name (they stay amber until saved).
   Supabase → SQL editor:
   `select p.name project, l.name, l.type_name from lists l left join projects p on p.id=l.project_id where l.is_template and not l.archived and lower(trim(coalesce(l.type_name,''))) <> lower(trim(l.name)) order by 1,2;`

## Go-live
1. Merge the pull request (merge = deploy). Only Garry merges.
2. Close EVERY open planner screen — office PCs, the saw PC, phones — and reopen. An old screen still has the old
   "Confirm all green" without the hand check.
3. Open the live site in an incognito window; check it loads and the Saw page shows "＋ Add to batch" on each list.
4. On the saw PC / phone (Chrome): add 3 houses to the batch → ⚡ Open batch → check boards, sheets and houses read right →
   Open list on one house → tick a line → back on BATCH that share shows ✓.
5. Office: Materials → "⧉ Copy from another project…" is there; a template shows one name and no "Type name" box.

## Tell people
- **Saw:** tick "＋ Add to batch" on the lists you are cutting together → ⚡ BATCH shows one table, board by board, with
  every house's share. Tick lines and CUT COMPLETE on each house's own list as before ("Open list"). Missing material:
  N/A as before → ⏸ WAITING. Labels are optional. The old combined table and MARK ALL CUT COMPLETE are gone from the saw.
- **Office / Drawing office:** handed units (H, LH, RH) are amber — confirm one at a time, the same-hand template is
  suggested; ✓ Confirm asks if the template's hand differs from the title. More rows may be amber than before.
  Templates have one name. Emmet Road "4C" shows as 4C everywhere — check it is the right list.

## Rollback
Revert `main` to `522e610` (the version live on 20 Nov). Nothing in the database needs undoing. A batch is only kept on
the saw device and is simply ignored by the old version. One thing does not come back: a template SAVED while the new
version was live has had its hidden old type name replaced by its name.
