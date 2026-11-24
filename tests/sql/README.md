# SQL tests (throwaway local Postgres only)

These check database changes from `SUPABASE_CHANGES.md` on a **throwaway local Postgres** — never on the live Supabase project.

## list-guard.sql — 18 Nov "Empty-save guard" + "restore a list to an old revision"

Run (needs `psql`, `createdb`, `dropdb`; Postgres 13 or newer):

```bash
sudo apt-get install -y postgresql      # once, if Postgres isn't installed
sudo pg_ctlcluster 16 main start        # or: sudo service postgresql start
tests/sql/run-list-guard.sh             # makes a database wpf_listguard_test, runs the checks, drops it again
```

The runner cuts the SQL out of `SUPABASE_CHANGES.md` word for word (the 2 Nov Stage 3 grey box and the four 18 Nov grey boxes in
order: read-only check, guard, restore — minus its "CHANGE THIS LINE" line — and undo), so the test always checks exactly what
Garry will paste.
Run as root it uses the `postgres` user; otherwise your own Postgres login.

What it checks: before the guard an empty save wipes a list (the hole); the guard block run twice leaves ONE function with
6 settings and its grants; old-style 5-setting saves (by name and in order) still work; a save leaving no rows is refused with
`empty save refused: this save would take away all 3 rows of "House 1"` (hint `empty-refused`) and changes nothing; with
`p_empty_ok` it works and the history says so; an already-empty list and a new list are not refused; "stale" still comes first;
the restore makes a new revision equal to Rev N, keeps ticks on unchanged rows, clears ticks on rows whose size changed back,
deletes nothing, and refuses a Rev that was never kept / an unknown list id; the read-only check gives the one expected row
before and after; the Undo box (run twice) puts back the 2 Nov function byte for byte with its grants, empty saves work again, and
the guard can be run again afterwards.

Expected last line: `ALL LIST GUARD CHECKS PASSED`. Three `ERROR:` lines are expected on the way (each announced by an
`-- expected next:` line) — they are the restore refusing on purpose.
