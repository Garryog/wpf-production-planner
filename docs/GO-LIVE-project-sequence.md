# Go-live: PM project sequence + project details (Job B) — branch `feature/project-details-v3`

Written 25 Nov 2026. Manager verdict: **GO WITH CONDITIONS** (below). Nothing here is live until Garry merges.

## What goes live
- **🔢 Project sequence** per project: one row per work order in the order the site needs them, each with its Required (on site)
  date and Build date; PMs reorder and change dates (inside the fixed window a PM's change is a request to the Production Manager).
- **Cienapps upload file → sequence**, rows waiting for a WO number, matched to the work order when it arrives.
- **Johnny's Pre-production pool** (own screen / PIN).
- **Project details (spec sheets)** per project, with the red "SPEC NOT SIGNED OFF" warning.
- **Merged P-numbers** remembered, so an old screen can't bring one back.
- Smaller: 🧱 Materials button in the sequence window; ✎ Job details (floor / unit / title / customer) from the sequence table;
  PM page shows "required on site"; a date moved inside the fixed window from the board / Deliveries counts as a Late change.

## Conditions before the merge
1. Full test suite on the final commit — every failure on `docs/ACCEPTED-FAILURES.md`. (Coder)
2. Dry run with ONE real Cienapps upload file through the preview, on a test copy. (Garry sends the file)
3. Garry signs off the pending rows in `docs/ACCEPTED-FAILURES.md` and the open questions at the end of this page.

## Steps on the day
1. **Supabase → SQL Editor.** From `SUPABASE_CHANGES.md` run these three boxes, in this order, each until it says "Success":
   1. "Project details (spec sheets)"
   2. "PM sequence & pre-production (Job B part 2)"
   3. "Merged P-numbers stay merged"
   They can be run the evening before: today's live screens are not affected, and each box can be run twice safely.
   **Do NOT run the "Stage 3 cutting lists" box again** (it is already live; re-running it would undo the 18 Nov guard). The 18 Nov
   "Empty-save guard" box is separate and can be run any time.
2. **Supabase → Table Editor:** check `project_specs`, `project_seq`, `seq_requests` and `seq_pre` are there.
3. **Everyone closes the planner** — every PC, the saw, stores and floor screens, and phones. An old screen left open can put the
   sequence settings back to their defaults and overwrite job-detail corrections.
4. **Garry merges the pull request** `feature/project-details-v3` → `main`.
5. **Wait 10 minutes** (GitHub Pages can serve the old copy for that long).
6. **Incognito Chrome window:** open the live site. Check: it says Synced; the 🔢 Project sequence button is there; open one
   project's sequence; open Deliveries and a cutting list; no error bar.
7. **Reopen every screen.** Tell the PMs, Johnny and the office what is new.
8. **Only after all screens are reopened:** Settings → set the fixed-window days and the pre-production weeks.

## If something is wrong (rollback)
- Put `main` back to the commit before the merge (Garry: "Revert" on the merged pull request) and close / reopen every screen.
- The SQL can stay — the old code ignores it.
- Before restoring any planner BACKUP, run this one line in Supabase first: `drop trigger if exists pp_pmerged_guard on production_planner;`

## If the code went live before the SQL
The sequence, project details and pre-production screens simply stay hidden until the boxes are run. Nothing else changes.

## Open questions for Garry (none blocks the merge unless marked)
- "KITCHEN ISLAND" line in the upload: an island or a kitchen? (today: asked with one tap)
- Two P-numbers made for one house from two PCs at the same moment: flag only (as built) or move the list onto one?
- Capacity Board row: due date only (your 18 Nov choice) — or also show the required-on-site date?
- Johnny's pool and the upload "as built" — confirm after the dry run.
- Next release (not in this one): the simpler import — your 25 Nov decisions are in `docs/ROADMAP.md`.
