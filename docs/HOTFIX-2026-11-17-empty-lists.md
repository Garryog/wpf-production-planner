# Hotfix 17 Nov 2026 — templates / archived lists open EMPTY (live site)

**What Garry saw (17 Nov, ~13:00):** Clancy Cloverhill templates and the Elliotts Aderrig templates "are now empty"; also
thought Aspect Athenry and OCC Ballyburke lists were lost.

**Database check (read only, nothing changed):** NOTHING was lost. Every list and template is there with all its rows:
Clancy 5 templates (40 rows), Elliotts Aderrig 4 — 16 templates, Elliotts Emmet Road 10 templates, Aspect Athenry 9 live lists
+ 2 templates (352 rows), OCC Ballyburke 22 live lists + 10 templates (215 rows). No list in the database has zero rows; no
archive or removal since 16 Nov 14:57; every read from the planner answered OK all morning.

**Cause (a bug on the live version):** to start fast, the planner does not load the rows of templates, archived lists and
finished jobs when it opens — they were meant to load when someone opens one. On the live version, ✎ Edit and View did NOT
wait for them, so a template (and an archived / finished list) opened looking EMPTY. Already fixed on the list-window branch
(12 Nov and 17 Nov), but that release is not live yet. Reproduced on the live code with the fake database
(`tests/hotfix/h17-template-opens-full.test.js`: 3 of 6 fail on live, 6 of 6 pass with the fix).

**Saving one that opened empty:** the save takes the database's rows it did not see as "added on another screen" and keeps
them — no list was emptied (checked: no list has zero rows). Still: do not Save a list that opened empty.

**The fix (this branch, 11 lines):** ✎ Edit and View load the rows first ("Loading the list…"), then open. If they can't be
loaded, nothing opens and it says so. The same two guards as on feature/list-window, so merging that release later is clean.

**Tests:** the new test 6/6; the 33 existing test files that open or view a list: 561 pass / 2 fail — the 2 are the known
"L12" checks already on ACCEPTED-FAILURES (built on another branch). No database change. No SQL.

**Go live:** merge the pull request (only Garry). No need to close every screen for this one, but each screen must be
refreshed (F5) to get it. Check in incognito: Cutting Lists → Templates → View / ✎ Edit on a Clancy template shows its 8 rows.
**Rollback:** Revert the pull request.
