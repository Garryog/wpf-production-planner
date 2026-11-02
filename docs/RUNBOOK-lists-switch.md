# Runbook: switching the cutting lists to their own tables (Stage 3)

For Garry. Do these in order; tick each one. If anything looks different from what's described here, stop and send a screenshot.

## Before (any day before migrate day)
0. **Stage 2 goes live first, on its own — weeks before this.** `feature/cutting-lists` is built on top of Stage 1 and Stage 2 (the Excel/Cienapps imports): merging it also puts all of Stage 1 and Stage 2 live. So:
   - first merge and deploy `feature/stage2-imports` on its own, following its own steps in `SUPABASE_CHANGES.md` (the 20 Oct 2026 Stage 1 SQL, and that block's "Go-live day" — close every tab and phone);
   - let it run in normal use for a while (at least a couple of weeks of imports with no problems);
   - only then start the steps below for this branch. Never put both live on the same day.
0b. **Rehearse the migration on a copy of the real data first.** Garry: Settings → **Download full backup (JSON)**, and send the JSON file to the Tester. Tester: load it into the test setup (fake database — never the live one), run **Migrate lists**, check the counts match and the saw/stores screens look right, then run **Switch back** and check the old lists come back exactly as they were. Only go ahead when that rehearsal passes.
1. **Check the settings column type.** Supabase → SQL Editor → run the one-line "Step 0" query at the top of the 2 Nov 2026 block in `SUPABASE_CHANGES.md`. It must say **json** or **jsonb**. Anything else: stop.
2. **Change the Admin PIN** away from the default 9000 (Settings → View PINs). The Admin PIN starts the migration and the switch back.
3. **Run the Stage 1 SQL first** (20 Oct 2026 block) if it hasn't been run: `production_planner` must have a `version` column and the `planner_backups` table must exist.
4. **Run the Stage 3 SQL** (2 Nov 2026 block). Success looks like: "Success. No rows returned"; Table Editor shows `projects`, `project_materials`, `lists`, `list_lines`, `list_revisions`, `list_events`, `snags` (all empty); Database → Functions shows `apply_line_changes`, `list_attach`, `list_set_done`, `save_list_revision`, `snags_to_list`, `lists_switch_on`, `lists_writable`.
5. Merge `feature/cutting-lists` and deploy (only once Stage 2 has been live a while — see step 0). **Nothing changes on the floor yet**: the switch is off until step 9. Check the live site in an incognito window: the board, Saw and Stores look exactly as before.

## Migrate day (a quiet moment — e.g. before the saw starts)
6. **Close every planner tab and phone** (office PCs, saw, stores, drivers, PMs, floor screen). Only your own office PC stays open. (A tab left open on old code can't switch the floor back, and its ticks are rescued — but closing everything is still the safe way.)
7. On your PC: refresh the page (Ctrl+F5) so it's the new code.
8. Settings → **Cutting lists store** → **Migrate lists** → enter the Admin PIN → OK.
9. Wait. It takes a backup (saved in the database AND downloaded to the PC as `WPF_Backup_pre-lists-v2_<date>.json`), copies every list, checks the counts and only then switches over.
   - "Lists migrated — N lists, M lines, counts match ✓" = done.
   - "Counts did not match — NOT switched over" = nothing changed for the floor; send the report shown on screen.
10. **Keep the downloaded JSON file** (OneDrive). The copy in the database is deleted automatically after 30 days by the daily backup clean-up. No backup contains the lists switch, so restoring any of them brings back the old record without moving the lists switch.

## Checks after
11. **Reopen every screen you closed in step 6** — office PCs, saw, stores, drivers' phones, PMs, the floor screen — each with a fresh load (Ctrl+F5 on PCs; close and reopen the tab on phones). On the saw and stores: today's lists are there, ticks and WAITING lines as before. On the others: the board and deliveries look as before.
12. Tick one line on the saw; it shows at once with a small amber dot, and the dot goes within a few seconds. **This first tick is the first real test of the database permissions** (the new tables taking a change from the floor). If the amber dot is **still there after a minute**, go straight to **Switch back** (rollback step 1 below) and call for help — the tick is held on the tablet and goes into the old lists when the switch back finishes.
13. Board colours (red / amber / green) are the same as before the switch.
14. Settings → Cutting lists store says the lists are in their own tables.

## If something is wrong — rollback order
1. **Switch back FIRST:** Settings → Cutting lists store → **Switch back to old lists** → Admin PIN. It rebuilds the old lists from the tables (including lists made since) and turns the switch off. Every screen follows on its next refresh; devices holding unsent ticks put them into the old lists.
2. **Only then** revert the code if you need to.
3. **Restoring a backup never moves the switch** — not off, and not back on. No backup carries the switch (the pre-lists-v2 copy, the daily copies, the "before …" copies and the Download backup file all leave it out), and the database only lets it move the way Migrate and Switch back move it. So pasting back any backup (or an old tab saving) leaves the lists where they are. Always use Switch back to go back.
4. If Settings ever says **"A switch back was started but did not finish"**, press **Finish switch back**. While it is unfinished, ticks on the saw and stores are **held on each device** (the bar says the lists are being switched back) and go into the lists automatically once it finishes — keep those pages open.
5. **If Finish fails** (an error message instead of "Back on the old lists"): press **Stay on the new lists** — the floor carries on as before and the held ticks are sent — then call for help before trying again. Don't restore a backup.
