# Supabase changes

Newest at the top. Each block must be run in Supabase BEFORE the matching code goes live on GitHub Pages.

---

## 2026-10-20 — Stage 1 "Stop the data loss" — run BEFORE deploying

**What it does (plain English):**
- Adds a `version` number to the planner record, so two PCs saving at the same moment can no longer silently overwrite each other.
- Adds `updated_by` so we can see which person/device saved last.
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
7. Check: left menu **Table Editor** → you should now see a table called `planner_backups` (empty), and `production_planner` should have two new columns, `version` (all rows = 1) and `updated_by` (blank).

```sql
-- 1. Clash protection on the main planner record
alter table production_planner add column if not exists version bigint not null default 1;
alter table production_planner add column if not exists updated_by text;

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

Note: Stage 4 tightens the anon grants and policies above (the app will stop having open delete access).
