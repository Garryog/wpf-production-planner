# Supabase changes

Newest at the top. Each block must be run in Supabase BEFORE the matching code goes live on GitHub Pages.

---

## 2026-10-20 — Stage 1 "Stop the data loss" — run BEFORE deploying

**What it does (plain English):**
- Adds a `version` number to the planner record, so two PCs saving at the same moment can no longer silently overwrite each other.
- Adds `updated_by` and `updated_at` so we can see who saved last and when.
- Adds a database trigger that bumps `version` on EVERY save — including saves from an old planner tab that was left open from before the update. That's what lets new tabs notice an old tab's save and merge it instead of overwriting it.
- Creates a separate `planner_backups` table for the daily safety copy (30 days kept), and gives the app permission to use it.
- Nothing is deleted. Existing data is untouched.

**If you deploy the code without running this first:** the app keeps working the old way (no clash protection, no backups table) and prints a warning in the browser console. So the wrong order can't break the floor — but run this first anyway.

### Steps for Garry
1. Go to https://supabase.com/dashboard and open the WPF project (`klyropbsupqfmtjjwlfa`).
2. In the left menu click **SQL Editor**.
3. Click **New query** (top left).
4. Copy everything in the grey box below and paste it into the editor.
5. Click **Run** (bottom right, or Ctrl+Enter).
6. Expected result: **"Success. No rows returned"**. If you see a red error, stop and send a screenshot — do not deploy.
7. Check: left menu **Database → Triggers** → you should see `production_planner_bump` on `production_planner`.
8. Check: left menu **Table Editor** → you should now see a table called `planner_backups` (empty), and `production_planner` should have three new columns: `version` (all rows = 1), `updated_by` (blank) and `updated_at` (blank).

```sql
-- 1. Clash protection on the main planner record
alter table production_planner add column if not exists version bigint not null default 1;
alter table production_planner add column if not exists updated_by text;
alter table production_planner add column if not exists updated_at timestamptz;

-- Every save (new app, old app, or a manual edit) gets the next version number and a timestamp.
-- The new app also asks for version+1 itself, so this never double-bumps.
create or replace function production_planner_bump() returns trigger language plpgsql as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists production_planner_bump on production_planner;
create trigger production_planner_bump before update on production_planner
  for each row execute function production_planner_bump();

-- 2. Daily backups table
create table if not exists planner_backups(id bigserial primary key, taken_at timestamptz default now(),
  reason text, orders_count int, payload jsonb not null);

-- 3. Data API access (from 30 Oct 2026 Supabase no longer grants this automatically on new tables).
--    The app currently uses the anon (publishable) key for everything.
--    Stage 4 will tighten these anon grants.
grant select, insert, delete on public.planner_backups to anon;
grant usage, select on sequence public.planner_backups_id_seq to anon;
grant select, insert, update, delete on public.planner_backups to authenticated, service_role;
grant usage, select on sequence public.planner_backups_id_seq to authenticated, service_role;

-- 4. Row Level Security: on, with the same open-to-the-app access the planner record has today.
--    (No UPDATE policy for anon: backups are written once, never edited.)
--    Stage 4 replaces these with locked-down policies.
alter table planner_backups enable row level security;
drop policy if exists "planner_backups anon read"   on planner_backups;
drop policy if exists "planner_backups anon insert" on planner_backups;
drop policy if exists "planner_backups anon delete" on planner_backups;
create policy "planner_backups anon read"   on planner_backups for select to anon, authenticated using (true);
create policy "planner_backups anon insert" on planner_backups for insert to anon, authenticated with check (true);
create policy "planner_backups anon delete" on planner_backups for delete to anon, authenticated using (true);
```

### Go-live day (important)
Planner tabs opened BEFORE the update keep running the old code until they're reloaded. Old tabs still save the old way (whole plan, no clash check). The trigger means new tabs will notice and merge those saves, but an old tab can still overwrite a new tab's work. So on deploy day:
1. Run the SQL above.
2. Deploy.
3. Check one screen saves (incognito window).
4. **Within minutes, run the old-screen guard below** (approved by Garry 3 Nov 2026).
5. **Close and reopen every planner tab and phone** (office PCs, saw, stores, drivers, PMs, floor screen). After that, everything is on the new code.
Before step 1: key every planned week move into Cienapps, so the Export Changes list can start empty. Nobody moves weeks or presses "Mark as applied" between steps 2 and 4.

## 2026-11-03 — Old-screen guard — APPROVED by Garry, run on go-live day AFTER the new code is live (step 4 above)
PENDING. Never run it before the new code is deployed — every screen on today's code would get "Save failed". Try it once on a Supabase TEST project first. Full explanation: docs/PROPOSAL-old-tab-guard.md.
```sql
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
**Rollback order (important):** if the website ever has to go back to the old version, FIRST undo this guard (run the original Stage 1 `production_planner_bump` function above again), THEN put main back. The other way round, no screen can save.

Note: Stage 4 tightens the anon grants and policies above (the app will stop having open delete access).
