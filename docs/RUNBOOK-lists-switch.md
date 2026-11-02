# Runbook: switching the cutting lists to their own tables (Stage 3)

For Garry. Do these in order; tick each one. If anything looks different from what's described here, stop and send a screenshot.

## Before (any day before migrate day)
1. **Check the settings column type.** Supabase → SQL Editor → run the one-line "Step 0" query at the top of the 2 Nov 2026 block in `SUPABASE_CHANGES.md`. It must say **json** or **jsonb**. Anything else: stop.
2. **Change the Admin PIN** away from the default 9000 (Settings → View PINs). The Admin PIN starts the migration and the switch back.
3. **Run the Stage 1 SQL first** (20 Oct 2026 block) if it hasn't been run: `production_planner` must have a `version` column and the `planner_backups` table must exist.
4. **Run the Stage 3 SQL** (2 Nov 2026 block). Success looks like: "Success. No rows returned"; Table Editor shows `projects`, `project_materials`, `lists`, `list_lines`, `list_revisions`, `list_events`, `snags` (all empty); Database → Functions shows `apply_line_changes`, `list_attach`, `list_set_done`, `save_list_revision`, `snags_to_list`, `lists_switch_on`, `lists_writable`.
5. Merge `feature/cutting-lists` and deploy. **Nothing changes on the floor yet**: the switch is off until step 9. Check the live site in an incognito window: the board, Saw and Stores look exactly as before.

## Migrate day (a quiet moment — e.g. before the saw starts)
6. **Close every planner tab and phone** (office PCs, saw, stores, drivers, PMs, floor screen). Only your own office PC stays open. (A tab left open on old code can't switch the floor back, and its ticks are rescued — but closing everything is still the safe way.)
7. On your PC: refresh the page (Ctrl+F5) so it's the new code.
8. Settings → **Cutting lists store** → **Migrate lists** → enter the Admin PIN → OK.
9. Wait. It takes a backup (saved in the database AND downloaded to the PC as `WPF_Backup_pre-lists-v2_<date>.json`), copies every list, checks the counts and only then switches over.
   - "Lists migrated — N lists, M lines, counts match ✓" = done.
   - "Counts did not match — NOT switched over" = nothing changed for the floor; send the report shown on screen.
10. **Keep the downloaded JSON file** (OneDrive). The copy in the database is deleted automatically after 30 days by the daily backup clean-up. Neither copy contains the lists switch, so restoring either one brings back the old record without switching the lists off.

## Checks after
11. Reopen the saw and stores screens: today's lists are there, ticks and WAITING lines as before.
12. Tick one line on the saw; it shows at once with a small amber dot, and the dot goes within a few seconds.
13. Board colours (red / amber / green) are the same as before the switch.
14. Settings → Cutting lists store says the lists are in their own tables.

## If something is wrong — rollback order
1. **Switch back FIRST:** Settings → Cutting lists store → **Switch back to old lists** → Admin PIN. It rebuilds the old lists from the tables (including lists made since) and turns the switch off. Every screen follows on its next refresh; devices holding unsent ticks put them into the old lists.
2. **Only then** revert the code if you need to.
3. **Restoring a backup will NOT turn the switch off.** The pre-lists-v2 backup is taken before the switch is touched and carries no switch, and the database refuses any save that would move the lists off the new store except through Switch back. So pasting back any backup (or an old tab saving) leaves the floor on the new lists. Always use Switch back to go back.
4. If Settings ever says **"A switch back was started but did not finish"**, press **Finish switch back**. While it is unfinished, ticks on the saw and stores are **held on each device** (the bar says the lists are being switched back) and go into the lists automatically once it finishes — keep those pages open.
5. **If Finish fails** (an error message instead of "Back on the old lists"): press **Stay on the new lists** — the floor carries on as before and the held ticks are sent — then call for help before trying again. Don't restore a backup.
