# Plan — growth and an archive for finished jobs (Architect, 19 Nov 2026)

Garry, 18–19 Nov: "the syncing is taking a very long time … we need to plan for the system to grow a lot more. Nobody is using
it, only me at the moment. An archive for finished jobs is important."

## Why it is slow today
Every job lives in ONE database record (`production_planner`, id `main`): 630 KB on 18 Nov (284 KB on 11 Nov). Every save sends
the whole record; every screen downloads the whole record every 2 minutes, even when nothing changed. The database itself is fast
(14–36 ms per save) — the time is moving 630 KB each way and the browser comparing / merging it. At 5,000 jobs a year it would be
about 4.5 MB after a year (up to ~25 MB with full job histories). Not workable.

Biggest parts (18 Nov): per-job history `log` 153 KB, `dueHist` 34 KB, customer / title 22 KB each, `exportBase` (settings) 42 KB.

**Honest point:** an archive alone will not fix today's slowness — only 32 jobs are shipped and none is marked delivered, so it
would take out ~5% today. The quick wins (R1) fix today; the archive stops the record growing for ever; one-record-per-job (R4)
is the long-term answer.

Found in the code (main, 19 Nov): jobs are never removed today (an import only skips NEW WOs already at step 9–11; existing ones
get `shippedAt` and stay) · each job's history is cut to its last 40 entries (older history is already lost) · the merge rule
"removed on one side, changed on the other → keep the change" would bring an archived job back, so archiving needs an
"archived" marker plus the old-screen guard · there is no cheap "has anything changed?" check before the 2-minute download ·
`bakVerified` (checked copy before a bulk delete) can be reused by the archive move.

## 1. What "finished" means (recommended) — a job is "ready to archive" only when ALL are true
- Installation complete ticked in the planner, OR Cienapps step 11 (completed and invoiced) — shipped alone is not enough (22 Oct:
  a job stays through delivery and installation).
- Not on Deliveries any more, not on hold (step 12).
- No waiting lines, no open snag, no cutting list with lines still to cut or pick, no Export Change waiting for Cienapps.
- Nobody has changed it for 30 days.

The archive must still let people find a job (WO, customer, title, floor, unit), see every field, date, its full history, its
cutting lists (read-only, print), delivery proof — and **bring it back** (snag, Cienapps reopens it, mistake) with a reason.

## 2. Options, smallest first
| Option | Work | Today (661 jobs) | 5,000 jobs / year |
|---|---|---|---|
| (a) Quick wins, app only | 1–2 days | 2-minute refresh with no change: 630 KB → under 1 KB. Saves still 630 KB | saves slow again as it grows |
| (a2) Last 10 history entries on the job, older ones to a history table (kept for ever) | 2–3 days | log 153 → ~50 KB | same; full history kept |
| (b) Archive table for finished jobs (live jobs stay in the one record) | ~1 week incl. tests | ~5% smaller today | record ≈ live jobs only, ~1–1.3 MB (estimate) |
| (c) One record per job, save only the changed job | 3–5 weeks + rehearsal | a save ≈ 1–3 KB | a save ≈ 1–3 KB at any size |

**(a)** Ask the database for the version number only before each refresh; download the full record only if it changed (or this
screen has unsaved work). Settings gets a "Sync speed" line (last save / load: KB and seconds) so we can see where time goes.

**(b)** New table `planner_archive`, one row per finished job (full copy + search columns). Office button → preview → backup
(`bakVerified`) → copy → read back and compare → only then remove from the live record, with a short-lived "archived" marker so
no other screen or old device copy brings it back. Old-screen guard raised. Imports look the WO up in the archive: step 9–11
skipped as now; earlier step → "In the archive — bring back?"; lookup fails → Apply blocked (no duplicate job). Cutting lists
stay where they are (own tables). Board, Deliveries, PM board unchanged.

**(c)** New `jobs` table, a version number per job; saves send only changed jobs; refresh fetches only jobs changed since last
look. Rebuilds the save engine and merge per job; imports need one all-or-nothing database function. Best designed with the
logins stage (roadmap step 5).

## 3. Recommendation — small releases, each safe on its own
- **R1 quick wins (a).** No database change. Rollback: previous main.
- **R2 history overflow (a2).** SQL first, then deploy. Entries trimmed from the job only after the table confirms them.
- **R3 archive (b).** SQL first → deploy → incognito check → first archive run with Garry while he is the only user (best
  moment) → close every screen. Manual (office button + preview) for the first months. Rollback: "Bring back all", then old code.
- **R4 one record per job (c).** Own plan, designed with logins; rehearsed on a Supabase TEST project with a copy of the real data.

SQL (R2, R3) will go in SUPABASE_CHANGES.md as PENDING blocks (re-runnable, GRANT lines, screen can add and read but never
delete or edit an archive copy), tested on a throwaway Postgres first. Nothing is ever deleted: archive copies stay even after a
job is brought back.

## Archive screen, in words
- "🗄 Archive" button on the 📦 Shipped tab's top bar (no new main tab).
- Office: "🗄 Archive finished jobs (N ready)" → preview (each job, why it qualifies, tick box) → "Archive N jobs" with progress
  "Backup ✓ · Copied 12 ✓ · Checked ✓ · Removed from live ✓".
- One search box (WO, customer, title, floor, unit) + "Archived: last 3 months / this year / all". Newest first, 50 at a time.
- Result card: WO · Floor · Unit · title · customer · shipped · installed · archived when / by whom. Tap → read-only page with all
  dates, full history, cutting lists (open / print), delivery proof, and **↩ Bring back to the planner** (office, asks a reason).

## Risks
Two screens (one archives while the other edits) · an old screen / device copy bringing jobs back · a lost reply doubling a copy
(unique WO + batch) · an import making a second job for an archived WO · 143 jobs at "7. Assembly complete" — some may have left
long ago without Cienapps being updated; they never qualify until cleaned up · iPhone Safari is not a valid sync test.

## Acceptance checks (Tester — fake database / test project only)
Refresh with nothing changed downloads under 1 KB, and PC A's save shows on PC B within 2 minutes · archive 20 jobs: record
shrinks, each found by WO / customer / unit with history, lists and dates · PC B edits a job while PC A archives it: stays live,
flagged, nothing lost or doubled · an old device copy brings nothing back silently · same Cienapps file twice: step 5 → "bring
back?", step 9–11 skipped, lookup failing → Apply blocked · Bring back restores every field · the screen cannot delete or change
an archive copy · 5,000 archive rows: search under 2 s on an Android phone in Chrome · odd text shows as text · full suite.

## Key questions for Garry (recommended first)
1. What counts as finished? **A** installation complete (or Cienapps 11) + off Deliveries + nothing waiting + 30 days no change ·
   B shipped (9) + 60 days · C Cienapps 11 only.
2. Who archives? **A** office button with a preview (for now) · B automatic every week.
3. Archived WO comes back in an import at an earlier step: **A** preview asks "bring back?" · B automatic · C ignore.
4. Job history: **A** last 10 on the job, older to a history table kept for ever · B leave as now (40, older lost).
5. One record per job: **A** design it with logins, build before drivers / PMs come on, rehearse on a test project · B build now
   while you are the only user · C only if it gets slow again.
6. Old-screen guard switched on in live? **A** not sure — Coder checks read-only before R3.

## Garry's answers
(not yet)
