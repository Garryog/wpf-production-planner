# Plan: planner sign-in (one login per person)

Architect's plan, 11 Nov 2026. The approach (username + password for everyone, admin-managed, on the web) was approved by Garry on 11 Nov; the key questions in section 9 are still open. Nothing is built yet. Decisions behind it: `docs/ROADMAP.md`, "Access and sign-in decisions (11 Nov 2026)".

## 1. Summary
Everyone signs in with a username and password, once per device, and stays signed in. Admins create, disable and reset accounts on a new Settings → Accounts screen. A small server-side helper (an "Edge Function") does the account work, so no secret key is ever in the page. Each person's roles are kept in a new `staff_accounts` table, and the database checks that table on every request. The cutover has four stages, and each one can be undone:
1. Sign-in ships but is optional, and the PINs keep working.
2. Everyone is signed in, and the logs prove it.
3. The database closes to anyone not signed in, one table at a time.
4. The keys are replaced and the repo goes private.

One thing must be said plainly. **`production_planner` is one big record, so the database can only give someone all of it or none of it.** That means "drivers see only their own runs" stays a screen-level filter until runs move into their own tables. It also means subcontractors must never get access to that record. They need their own per-firm tables (the Fitters view) before any subcontractor account is made.

## 2. How it looks to staff
- **Sign-in screen:** username, password, "Sign in". After that the device remains signed in for weeks and survives restarts. Someone with one role goes straight to their screen. Someone with several roles sees today's role picker, showing only their own roles. No more PINs.
- **Your name is filled in automatically** on every tick and sign-off for personal accounts.
- **Shared PCs** (saw, stores, floor screen, meeting room) are signed in as the station. They keep "pick your name" exactly as now.
- **Admin screen** (Settings → Accounts) shows everyone with their roles, firm, last seen and app version. Buttons: Add person (it makes a starter password and a printable slip), Disable, Reset password, Sign out all devices, Change roles.

## 3. Design decisions
- **Username-only accounts.** Chosen: each username is quietly turned into a made-up internal email (`username@` a WPF sub-domain with no mailbox). Accounts are created already confirmed, so no email is ever sent. Public sign-up and email confirmation are off. *Because* this is Supabase's standard password sign-in with nothing custom. Usernames are lower case, e.g. `john.murphy`. The Coder must check on the test project that Supabase accepts the domain.
- **Admin actions with no secret in the page.** Chosen: one Edge Function, `staff-admin`, with the actions create / disable / enable / reset / set-roles / sign-out-all. It checks that the caller's sign-in is a live admin in `staff_accounts`, and it writes every action to `staff_audit`. It only accepts calls from the planner's web address. *Because* writing directly into Supabase's own login tables from SQL is unsupported and fragile. The function uses Supabase's official admin interface.
- **First admin.** Chosen: Garry adds himself in the Supabase dashboard (Authentication → Add user, auto-confirm). Claude then runs one SQL insert that makes him an admin in `staff_accounts`. *Because* it needs no special code and is easy to check.
- **Where roles live.** Chosen: a new table, `staff_accounts`, with these fields: user id, username, name, roles[], firm (blank = WPF), station yes/no, active, must-change-password, last seen, app version. Database rules read it through tiny helper functions (`is_staff()`, `has_role(...)`, `my_firm()`). Each check is a one-row lookup and is worked out once per request. **The role is not put into the sign-in token.** *Because* a role change or a disable then works within seconds, not after the token's hour runs out.
- **Session length.** Chosen: sign-ins never expire (Supabase's session time limit and idle limit both off). The short access token renews itself. Disable and sign-out-all take effect at once, because every rule also checks `active`. *Because* factory staff should not have to remember passwords often.
- **Sign-in code.** Chosen: add Supabase's official JavaScript library as a pinned local file next to `xlsx.full.min.js`, used for sign-in only. All data calls stay as they are, but take their headers from one `hdr()` function instead of the fixed `SUPA_HDR` (16 call sites, including the two photo uploads). *Because* the hard parts — renewing tokens and two tabs renewing at once without logging each other out — are already solved and tested in that library.
- **Station accounts.**
  - Chosen: one account per shared PC, flagged as a station, with only that PC's role. Stations cannot open Settings or Accounts, and the floor screen and meeting room are read-only.
  - The database records who did what as "picked name via Saw PC". It does this by appending the station's username to `p_by` inside the functions and the save trigger.
  - For personal accounts the database ignores the name the browser sends and uses the account's own name.
  - *Because* this is the only part of the change log the browser cannot fake.
  - Note: the history notes stored inside the big record are still written by the browser until the per-row tables arrive.
- **Passwords.** Chosen: at least 10 characters, no symbol rules. Starter passwords look like `river-oak-42`. Supabase's leaked-password check is on (it comes with Pro). People change the password at first sign-in, except stations. *Because* a long, simple password is stronger and easier than a short complicated one.
- **Lockout and rate limits.** Chosen: Supabase limits sign-in attempts per internet address. All factory PCs share one address, so raise the limit to about 150 per 5 minutes. Supabase has no lockout per account; for staff accounts, long passwords plus the address limit are enough.
- **Offline and poor signal.** Chosen: the screen keeps its device copy and its queue of unsent changes, as today. The token renews when the signal returns, then the queue is sent. A "not signed in" or expired reply must count as "not sent, retry" and **never** as "saved" or "the record is missing".
- **Access per table (Stage 3).**

| Table | Read | Write |
|---|---|---|
| `production_planner` (main) | all internal staff | office, admin, prod, design, saw, stores, driver. Floor, dash and pm read-only. Subcontractors: none |
| `production_planner` bak-* rows | admin only | — |
| lists / lines / projects / materials / snags / events | internal staff | internal staff (as today, plus `lists_writable()`) |
| dockets | internal staff | through the docket functions, for stores, office or admin only |
| `planner_backups` | — | insert: internal staff. Delete: only rows over 30 days old, office or admin |
| `staff_accounts` | yourself; admins see all | through the Edge Function only |
| `pod` and `list-photos` photos | private, internal staff | add only |

  Tightening by role inside the list functions (for example "only the saw ticks cut") comes later. It means turning those functions into checked server functions.
- **The four open functions and `search_path`.** Chosen:
  - `make_docket`, `docket_delivered`, `docket_cancel`: run with admin rights but check `has_role(stores, office, admin)` first. Remove the right to call them from anon and public.
  - `lists_writable`: anon loses the right to call it.
  - All 14 functions get a fixed `search_path` (one setting per function, with no behaviour change).
- **Subcontractors.** Chosen: no accounts until Fitters tables exist that carry a `firm` column with the rule "your firm only" (`my_firm()`). *Because* the main record holds every customer's jobs, the staff list and settings.

## 4. Build stages (each releasable alone)
- **S0 — database preparation (SQL only, no app change).**
  - `staff_accounts` and `staff_audit` with GRANT lines.
  - The helper functions and `i_am_here(app_version)`.
  - The `search_path` fix and the Edge Function.
  - Auth settings: sign-up off, confirm off, password rules, rate limit.
  - Garry's admin account.
  - Undo: none needed, all of it is harmless.
- **S1 — optional sign-in.**
  - App: `hdr()` and the sign-in library; a sign-in screen, with "Use PIN instead" still there.
  - `roleOk()` reads the account's roles when signed in.
  - `pickName` and `officeWho` fill the name automatically for personal accounts.
  - The Accounts screen, and a call to `i_am_here` on load and every 15 minutes.
  - "Not signed in" replies are handled as "not sent, retry".
  - SQL: the save trigger `production_planner_bump` also sets `updated_by` from the account (the old-screen guard logic is kept).
  - Undo: put the website back. The accounts stay, unused.
- **S2 — everyone signed in.**
  - Bulk-create accounts from today's Settings staff list plus the station accounts, and print the slips.
  - After a week with every device on the new version, release **S2b**: PINs removed, sign-in required.
  - Undo: put back the S1 release.
- **S3 — close the database, one SQL block at a time, each with its own "put anon back" block.** Check one save works after each block. Order:
  1. Docket and list functions lose anon.
  2. List, snag and docket tables.
  3. `planner_backups`.
  4. `production_planner`.
  5. Photos: the app must first ship signed photo links (it turns the stored public links into time-limited ones). Only then make both buckets private.

  Rehearse all of S3 on a Supabase test project first.
- **S4 — keys and repo.**
  - Create a new publishable key and release the app with it.
  - When `staff_accounts` shows every device on the new version, delete the old keys (including the old `default` key still waiting).
  - Make the repo private.
  - Undo: until the old key is deleted, simply put the old key back.

## 5. Cutover checklist and undo
1. Quoting has left this project, or no step touches `wpf_quotes`.
2. Supabase test-project rehearsal of S0 to S3 passed.
3. S2 proof:
   - Every active person in `staff_accounts` has a last-seen date within 3 working days, on the current version.
   - Supabase's request logs show **zero not-signed-in planner requests** for 3 working days. The two tracker apps' tables are left out of this count.
4. S3, per table: run the block → save a note → refresh → tick on the saw PC → driver photo on an Android phone. If anything fails, run that table's undo block.
5. The photo bucket is made private only after the signed-link release has been loaded everywhere.
6. Undo order (as with the guard): **put the database rules back first, then roll the website back.**
7. `cp_tracker` / `aa_tracker`: S3 leaves their rules untouched. **Deleting the old key in S4 breaks those apps** unless they have moved project or have the new key.

## 6. Risks (ranked)
- **Critical — a save looks fine but nothing is written.** Once rules close, a screen that is not signed in gets told "OK, nothing changed". The legacy save (`return=minimal`, around line 1053) would show "Saved". The version-checked save (around line 1064) would treat the empty reply as a clash and loop. *Fix:* every write must check how many rows changed, and must refuse to save without a sign-in once S2b is out. Tester proves it.
- **Critical — a closed rule makes the record look empty.** `checkRow` refuses such a load today, and that must stay. No screen may ever save over a load it refused.
- **High — the factory gets locked out.** Every shared-IP sign-in on Monday morning counts against one limit. *Fix:* raise the limit and stagger handing out the slips.
- **High — tabs log each other out.** Two tabs or a phone renewing the token together. *Fix:* the official library and a two-tab test.
- **High — making the repo private stops the site.** GitHub Pages on a private repo needs a paid GitHub plan (Pro, about $4 a month), and the site stays publicly reachable. That is fine once the data is closed.
- **High — photos.** Old stored photo links break when the buckets go private, and printed or Excel links stop working. *Fix:* signed links, released before the switch.
- **Medium — old tabs.** A tab on old code is cut off at S3. That is intended; staff refresh.
- **Medium — `cp_tracker` / `aa_tracker`** stay open to anyone with the key.
- **Medium — station PCs.** One account means one trusted PC. Someone could free-type another person's name in the picker. That limit is accepted.
- **Low — iPhone Safari users** will report sign-in "broken". Use Chrome.

## 7. What the Tester must prove (fake database extended with sign-in endpoints)
- Sign in, close, reopen: still signed in. A token that runs out mid-save renews and the save lands once.
- An offline queue sends after the signal returns and the token renews.
- With rules closed and nobody signed in, no screen says "Saved", and none overwrites or empties the record.
- A disabled account fails on its next request. The roles change without signing out.
- A station tick is logged as "Name via Saw PC". A personal account cannot send someone else's name.
- Floor and dash are refused on writes. Anon is refused on every table and function. Subcontractor accounts see nothing.
- Two tabs plus a phone for 30 minutes: no surprise sign-outs.
- Photos open with signed links after the buckets go private.
- The full existing test suite passes, with only the known failures.

## 8. Rough effort
| Stage | Agent | Garry |
|---|---|---|
| S0 | 1.5 days | 30 min (dashboard user, auth settings, SQL go-ahead) |
| S1 | 5 days | 1 hr |
| S2 | 1 day | 1–2 days of handing out logins, plus a week of watching |
| S3 | 3 days, including the rehearsal | 2 hrs |
| S4 | 0.5 day | 1 hr |

About 11 agent days in total.

## 9. Key questions for Garry
1. **Subcontractors:** no accounts until the Fitters view exists. Then they see their firm's jobs only (site, unit, delivery date, delivered snags and photos) and can mark a job "installed". *Recommend: yes.*
2. **Pay for GitHub Pro (about $4 a month)** so the repo can go private while the site keeps running? *Recommend: yes.*
3. **`cp_tracker` / `aa_tracker`:** move them to their own free Supabase project before the old key is deleted, as with quoting? *Recommend: yes.*
4. **Who are the admins** (create, reset, disable)? *Recommend: Garry plus one office manager.*
5. **Drivers:** a personal account each on their own phone, not one per van? *Recommend: personal.*
6. **PMs:** keep them read-only on the main record until the snag and project tables arrive? *Recommend: yes.*
7. **Passwords:** 10+ characters, changed at first sign-in, and stations never expire? *Recommend: yes.*

## Code facts behind the plan
- `SUPA_HDR` / `SUPA_WHDR` (lines 559–560) are fixed objects that send the publishable key as Bearer. The two photo uploads (lines 5349 and 6812) build their own headers.
- PINs live in the shared settings (`DB.pins`, `pins()` line 1371; `roleOk` line 1378), so anyone with the key can read them today.
- `planner_backups` has a DELETE call (line 1227).
- The `pod` photo bucket is used by the code (lines 6812–6814) but no `pod` bucket policies were found on 11 Nov. Check whether the bucket exists before S3.
- Photo links are stored as public URLs (lines 5353 and 6814).
- Driver identity is a name and van stored on the device only (`renderDriver`, line 6703).
