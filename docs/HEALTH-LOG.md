# Planner health log

Weekly read-only check of the live planner (main branch + Supabase project WPF-Tracker). Newest entry at the top.

## Mon 23 Nov 2026 — AMBER

**Live?** Yes. Live record version 237, 661 jobs (616 last week). Last save Fri 20 Nov 09:13 UTC, by Garry. Five releases went live this week (#11–#15: board width, list fixes, quicker sync, green strip / step badge, Deliveries). The old-screen guard is on in the database.

**1. Data safety: OK**
- I compared every backup from 16 Nov to the live record, each one against the next:
  - No due dates were blanked and no notes were lost or shortened.
  - No hand-set hours changed, no board steps went backwards, and no delivery ticks were removed.
  - No duplicate WO numbers.
  - 45 jobs were added and none went missing.
- The server logs show no failed saves (no 4xx/5xx on the planner, apart from the usual one bare 401 probe a day) and no Postgres errors. No screen was refused as "out of date".
- 18 Nov Cienapps import (before it, a backup "moving 27 work orders to Shipped"): 204 due dates were updated from Cienapps. None of them were jobs whose date had been held or set by hand.
- **4 jobs where Cienapps is behind the board.** Cienapps says 7 (Assembly complete) and the board says 8 (Palleted). The board kept 8, which is correct by design. The jobs are WO-2765-12, -13 and -15 (Kilmurry Lodge Hotel) and WO-2726-4 (Elliotts Aderrig 4). Their Cienapps delivery dates (30 Oct / 6 Nov) are already past.
- Editors this week: Garry (313 changes), Johnny Glynn (20, on 19 Nov), plus the import. The 19 and 20 Nov daily backups were taken by an office screen with no name picked ("? [office]").

**2. Backups: AMBER**
- Backups exist for 16, 17, 18 (two), 19 and 20 Nov. **There were none on Sat 21 or Sun 22 Nov**, because no office screen was open; last week Garry's PC stayed on over the weekend. Nothing was lost, because nothing changed after Fri 09:13. But the three saves between 08:50 and 09:13 on Friday are not in any backup yet.
- The newest backup (20 Nov, 661 jobs) reads back fine and matches the live jobs.
- Backup size roughly doubled on 19 Nov (350 KB to 640–670 KB). The 18 Nov import added about 800 history lines. Still tiny.

**3. Supabase health: OK**
- Pro plan, healthy. The database is 49 MB (40 MB last week); 27 MB of that is still the empty cp_tracker table.
- Security advisor: the same as last week (14 functions with a mutable search path, and 4 docket/list functions anyone can call). The fix for the first is still pending on health/2026-11-16-function-search-path.
- Performance advisor: info notices only.

**4. Usage: AMBER (same picture as last week)**
- Garry made 160 cutting lists this week, so there are 138 live lists across 8 projects, plus 53 templates.
- The Saw and Stores screens still aren't used:
  - 0 lines cut and 0 lists marked saw-done this week.
  - 1 line got out (17 Nov).
  - Only 1 list has ever been sent.
  - All 9 list events were made by Garry.
- Most lists are on jobs at steps 7–9, which are already assembled or later.
- Of the 250 jobs at steps 4–6 (ready for or in production):
  - 32 have a list.
  - 145 are marked "no list needed".
  - About 73 have neither.
- Holds: only the two old October example holds (L201, L203) are still open. There are 0 stores dockets in use (1 test).

**5. Security: AMBER**
- **The Drawing office PIN is still the default 8888.** It was flagged last week. All other PINs have been changed.
- The repo has no secret keys, emails or phone numbers. The publishable key is in the repo, as expected.
- Anyone with the public key can still read the plan data and PINs. This stays until the sign-in stage.

**Last week's items**
- clear-all-guard and function-search-path are still not merged.
- The 21 missing jobs and the Drawing office PIN: there is no sign either was done.

**Fixes ready (not on main)**
- `health/2026-11-23-server-backup` (docs and tests only) adds a pending "Nightly server backup (pg_cron)" step to SUPABASE_CHANGES.md:
  - The database copies the planner itself at 00:20 UTC each night, so no screen needs to be open.
  - It only prunes copies older than 30 days, and only when today's copy is good.
  - It comes with an undo step.
  - Tests: SQL checks on a throwaway database, including 12 deliberate breakages, all caught after the Tester added a check. The full suite shows nothing new.
  - Manager: GO WITH CONDITIONS. The condition (a line explaining Supabase's "destructive" warning) is done.
  - Real pg_cron could not be tested here. The real proof is a "nightly · server" row the morning after Garry runs it.
- `health/2026-11-23-clear-all-guard-refresh` is last week's Clear All guard brought up to date with main:
  - It was 107 commits behind. The merge had no conflicts.
  - The Tester's Low is fixed: the board is checked again after the name and after the PIN.
  - Tests: 56/56 targeted. The full suite shows nothing new.
  - Manager: GO. It replaces health/2026-11-16-clear-all-guard.

**Test-suite housekeeping**
- stage1 t4 (2,500 jobs in under 10 s) now fails every time on the test machine, on main too. It's only timing; no data is lost.
- The ACCEPTED-FAILURES wording ("occasional") needs updating, and Garry needs to re-accept it.

**Later idea (Architect)**
- Don't prune old backups when today's copy has 0 jobs and the previous one had jobs.
- This protects against a wrongly emptied board being copied for 30 days.

**For Garry**
1. Approve the nightly backup: merge A, run boxes 1–4, then check box 4 the next morning.
2. Merge the Clear All refresh and tell the office it needs the Admin PIN.
3. Set the Drawing office PIN.
4. Check the 4 Kilmurry/Elliotts jobs in Cienapps (step 7 vs 8).
5. Decide on Saw/Stores use.

## Mon 16 Nov 2026 — AMBER (first check; no earlier week to compare)

**Live?** Yes. The new saving system (version / updated_by / updated_at, backups table, cutting-list tables) has been live since 10 Nov. Live record: version 54, 616 jobs, last save Fri 13 Nov 15:41 by Garry.

**1. Data safety**
- No job's data went backwards since Fri 13 Nov (compared with the 13 Nov backup): no due dates blanked, no notes lost, no hours changed, no steps undone, no delivery ticks removed. No duplicate WO numbers.
- 12 Nov "Clear all orders" (fresh start, then a new Cienapps import): 243 jobs went, 209 came in. The backup recorded the person as "? [office]", so nobody was named, and any Office-PIN user could do it.
- **21 jobs were on the board before the clear and did not come back with the new import.** Check these in Cienapps (cancelled, or missing from the export?):
  - 4 that were ticked for delivery: WO-2435-5 (Aspect Herbert St, step 7), WO-2648-38/-40/-42 (Aspect Athenry, step 6)
  - WO-2661-42 (Boyle, Carrick-on-Shannon, due 16 Nov, step 5)
  - WO-2800-3/-6 and WO-2801-5/-8 (Quadrant, Wallbury NUIG, due 25 Nov – 2 Dec, step 3)
  - WO-2762-7…12 and WO-2764-7…12 (Elliotts Aderrig 4, due 11 Dec, step 3)
- The change log shows only 2 people editing this week (Johnny Glynn, Garry), both on 12 Nov. No merge or save failures showed up in the server logs.

**2. Backups** — OK. There is a daily backup for every day from 10 to 16 Nov. The newest (16 Nov 00:01, 616 jobs) reads back fine and matches the live data exactly. Two weak points: the daily backup only runs while a planner screen is open somewhere (Garry's office PC), and anyone with the public key can delete backups (the app's 30-day clean-up needs that).

**3. Supabase health** — OK. Pro plan, database about 40 MB (cp_tracker from the other app takes 27 MB with 0 rows). No Postgres errors. Only one 401 a day (a bare probe). Security advisor: 14 functions with a "mutable search path" (low; SQL prepared) and 4 docket/list functions anyone can call (by design until sign-in). Performance advisor: info notices only.

**4. Usage**
- The Saw and Stores screens are barely used. All week: 2 lines cut, 6 got out, 3 list events. 114 jobs are ticked for delivery (steps 7–9), but only 1 work order (WO-2648-54) has a cutting list. The other 32 lists are templates or examples.
- No items are waiting or on hold. The old holds in settings are only on the October example lists.
- 0 stores dockets made. No list photos uploaded.

**5. Security**
- The **Drawing office PIN has never been set**, so it is still the default 8888. All other PINs have been changed.
- The repo is public. It holds only the publishable key, with no secret keys. Real customer/project names (e.g. "ELLIOTTS ADERRIG 4") appear in some tests and the 10 Nov go-live doc. There are no phone numbers or emails. Note: anyone with the public key can read the plan data (and the PINs), and has been able to since before go-live. The sign-in plan (plan/access-signin-2026-11-11) deals with this.

**Fixes ready (not on main)**
- `health/2026-11-16-clear-all-guard`: Clear All Orders needs a name, then the Admin PIN, then DELETE. The backup carries the name, and an empty board makes no 0-job backup. Tests: 12/12 and 33/33. Full suite: nothing new caused by this branch. Manager: GO WITH CONDITIONS (condition done). After merge, reopen every screen and tell the office it now needs the Admin PIN.
- `health/2026-11-16-function-search-path`: docs only. A pending SQL block in SUPABASE_CHANGES.md. Low priority. Manager: GO.

**Test-suite housekeeping:** attack6-release E1/E2b/E3 and attack1-filter 12c fail on main too. They compare against "live" and are now stale. Manager recommends listing them on ACCEPTED-FAILURES as stale and repointing them.

**For Garry:** set the Drawing office PIN. Check the 21 jobs in Cienapps. Decide whether to push Saw/Stores use or find out why it isn't happening. Approve the two branches.
