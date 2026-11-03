# Proposal: stop an out-of-date planner screen overwriting newer work (3 Nov 2026)

Written by the Architect, 3 Nov 2026 run. **Not built into any SQL Garry has to run. Garry decides: yes or no.**
This answers the open question in docs/DESIGN-save-check.md (Architect concern 3).

## For Garry: the short version

**What we checked.** The planner that is live today (`main`) saves the whole plan in one go and never checks whether someone else saved first.

**Why it matters on go-live day.** Say a PC, tablet or phone still has the old planner open after the new version goes live. When it saves, it writes its old copy of the whole plan over the database. That wipes anything a new screen saved after the old screen last loaded. Test `tests/stage1/t16-oldtab-overwrite.test.js` shows this happening. A note typed on a new screen is gone once the old tab saves. The Stage 1 SQL notices these saves but cannot undo them.

**The plan today** is "close and reopen the planner on every PC, tablet and phone on go-live day". That works, as long as nobody misses a device: a forgotten tab in a drawer, a phone in a van, a screen on the saw.

**The proposal** is one small extra database step, run AFTER the new code is live. From then on, the database refuses any save from an old screen:
- The old screen shows **"Save failed"**, and nothing it holds can overwrite newer work.
- Whoever is using it refreshes the page and gets the new version.
- **Downside:** anything typed on that old screen since its last good save is not saved. They retype it after the refresh. Silently losing someone else's work is worse than this.
- New screens are not affected. Two new screens saving at once still merge as before (tested).
- If you ever edit the planner record by hand in Supabase's Table Editor, the edit is refused unless you also raise `version` by 1. You shouldn't need to do this.

**Order matters.** If this runs BEFORE the new code is live, every screen on the floor would get "Save failed". So:
1. Run the Stage 1 SQL.
2. Deploy the new code.
3. Check one screen saves.
4. Run this.
5. Close and reopen every screen anyway.

## The SQL (pending, for Garry's decision only — do not run before step 2 above)
```sql
-- Old-tab guard: replaces the Stage 1 version-bump function. Same as before, plus: an update to the planner record
-- that doesn't ask for exactly the next version number (only today's old code does that) is refused.
create or replace function production_planner_bump() returns trigger language plpgsql as $$
begin
  if old.id = 'main' and new.version is distinct from old.version + 1 then
    raise exception 'This planner screen is out of date - refresh the page' using errcode = 'P0001';
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end $$;
```
**To undo it:** run the original Stage 1 `production_planner_bump` function from SUPABASE_CHANGES.md again.

## Why it is safe for new code (checked against index.html on both branches)
- Every new-code save of the planner record sends `version = VER+1`, with the filter `version=eq.VER`. If another screen saved first, the filter matches nothing, so the trigger never runs and the normal merge happens.
- The new code's "version column missing" fallback, a plain save, only runs when the Stage 1 SQL hasn't been run. In that case this function doesn't exist either.
- Backups go to `planner_backups`, not this row. Today's old code writes `bak-YYYY-MM-DD` rows into `production_planner`, and those are not `main`, so they are not affected.
- The Stage 3 `production_planner_keep_switch` trigger only adjusts `settings`. It does not save the row itself.

## Test evidence
`tests/stage1/t16-oldtab-overwrite.test.js` uses the real old `main` code, plus a fake database that copies the trigger (`S.guardOld` in tests/stage1/tsrv.js):
- Without the guard: FAIL. The new tab's note is wiped by the old tab. This is the go-live risk, and it stays on docs/ACCEPTED-FAILURES.md until Garry decides.
- With the guard: the note survives, the old tab is refused and shows "Save failed", later new saves go through, and two new screens still merge. All pass.

**Must also be checked once on the Supabase TEST project before going live.**
