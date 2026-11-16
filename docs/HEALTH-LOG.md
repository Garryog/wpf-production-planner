# Planner health log

Weekly read-only check of the live planner (main branch + Supabase project WPF-Tracker). Newest entry at the top.

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
