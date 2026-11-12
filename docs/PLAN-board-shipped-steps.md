# Small release: Shipped / Installed / Completed on the Capacity Board (12 Nov 2026)

Garry, 12 Nov: "Shipped step is gone from capacity board. It is still needed" — "Need to be able to update on capacity board to
shipped or installed or completed. The job drops off capacity board after shipping".

The live board's step list has only ever offered 1–8 (shipped jobs came off the board only through a Cienapps import). The feature
("S1", Garry 10 Nov) was built and reviewed on the Job B branch (feature/project-details-v2, commit 6eeca5b, Manager GO WITH
CONDITIONS 11 Nov). This branch lifts ONLY S1 onto the live version (main) as its own small release; the Shipped-tab
Project / PM filters (S2) stay with Job B because they need the PM tables.

## What it does
- Board step drop-down: … 8. PALLETED, **JOB SHIPPED**, **INSTALLED**, **COMPLETED** (stored as Cienapps' exact text
  9. JOB SHIPPED / 10. INSTALLED TO BE INVOICE / 11. COMPLETED AND INVOICED).
- Picking one asks first. OK → the job leaves the Capacity Board and the week totals and goes to the 📦 Shipped tab, exactly like a job
  Cienapps calls shipped. INSTALLED / COMPLETED also mark it installed. "✓ Installation complete" stays its own button (Garry 11 Nov).
- A job ticked for delivery stays on 🚚 Deliveries until the driver confirms (same as an import).
- Logged in the job's history with the person. Listed in Export Changes until Cienapps has it. A Cienapps import that is still behind
  (e.g. says 8. PALLETED) leaves it shipped; when Cienapps moves on it takes over. Steps only move forward.
- "↩ Bring back to board" on the Shipped tab puts the old step back. Nothing is ever deleted.
- No database change (no new columns or tables).

## Tests
- `tests/ship/s1-ship-steps.test.js` 20/20 (ported from Job B's tests/seq/s12-ship-steps.test.js onto the plain harness).
- Test expectations moved to the 1–11 list, as on Job B (8525328): stage2 coder-r2 #4, stage3 flow-attack1-switchoff (allowed difference).

## Merge note
Job B already has the same code; when Job B is merged after this, the S1 lines are identical (keep Job B's version).

## 12 Nov 2026 — progress
- Full suite on this branch (180 files): only the three ACCEPTED-FAILURES files fail (sawstores attack-devices, attack-regress, stage1 t17).
- **Manager: GO WITH CONDITIONS.** Code is the same as Job B's S1 (minus the date stamp that only exists on the dates branch). No database change.
  Known small gap (same on Job B): after an import is undone, "Bring back to board" can leave the job showing JOB SHIPPED on the board.
- Conditions: [ ] close and reopen every screen after release · [ ] incognito check: set a test job to JOB SHIPPED, then bring it back ·
  [ ] tell the office that Cienapps still has to be updated (Export Changes) · rollback = main at 32d4568.
- Merge note: when main is later merged into the dates / Job B branches the step drop-down line clashes — keep `storeStamp` and 11 steps.
