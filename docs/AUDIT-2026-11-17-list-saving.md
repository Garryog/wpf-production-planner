# Audit — saving cutting lists (17 Nov 2026, after Garry's "all these are now empty")

Manager review of every path that writes a list (code + SQL text; no live database access, nothing run against live).
**Nothing has been lost so far:** checked in the live database (read only) — no list or template has zero rows; rows are never
deleted, only marked removed (delete is revoked), and templates / locked lists keep a full copy per revision.

## Verdict per path
| Path | Verdict |
|---|---|
| New list / P-number list | Safe (two PCs making a P-number at the same second not verified) |
| Edit a list that loaded fully, two PCs | Safe (merge keeps the other PC's rows) |
| Edit a list that opened EMPTY or part-loaded | **Risk → fixed** (PR #6 loads first; PR #7 refuses a silent wipe) |
| Template edit / Save as template | Safe (version check, "no parts" guard) |
| Copy / Make new list from this · Find old list | Safe (loads first) |
| Excel re-upload over an existing list | **Risk** — replaces rows typed in the app since the upload (now asked when it takes away most rows — PR #7) |
| × Multiply / unit blocks | Safe within one version; old + new version open at once: risk (close every screen when PR #5 goes live) |
| Lost reply when saving an EDIT | **Risk** — may say "not saved" when it saved; pressing Save again can add new rows twice |
| Archive / ticks / offline queue | Safe |

## Fixed today (no database change)
1. **PR #6** — ✎ Edit and View load a template / archived / finished list's rows BEFORE opening (it opened looking empty).
2. **PR #7** — (a) if loading the rows fails (bad signal), the list is not marked loaded, so it can't open empty;
   (b) any save that takes away ALL rows, or more than half (3 or more), asks "This save TAKES AWAY 38 of the 40 rows — OK?";
   Cancel saves nothing. Test `tests/hotfix/h17-save-guards.test.js` 6/6; 73 saving-related test files: no new failure.

## Still open (recommended order)
1. **High** — lost reply on an EDIT save: give edits the same "did it reach the database?" check new lists have. Coder, next.
2. **Medium** — Excel re-upload over a list edited in the app: warn by name which typed rows will go.
3. **Recommendation (Garry's decision, database change):** a guard inside `save_list_revision` that refuses a save removing
   every row unless the app says the person confirmed it, plus a tested "restore Rev N" SQL in SUPABASE_CHANGES.md
   (recovery today means hand-written SQL).
4. **Low** — two PCs making a P-number at the same second could get the same number.
