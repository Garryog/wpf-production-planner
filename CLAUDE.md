# WPF Production Planner

Single-file web app (`index.html`, vanilla JS + SheetJS `xlsx.full.min.js`) on GitHub Pages, data in Supabase (`production_planner` table: `orders`, `settings`, `nid`). Used at Western Postform Ltd for CNC/assembly capacity, cutting lists, saw/stores sheets, deliveries, and Cienapps ERP import/export.

Owner: Garry O'Grady (Operations Director, no coding background) — explain in plain English, keep answers to the point.

## Team workflow — use the four agents in `.claude/agents/`
1. **architect** — turns the idea into a plan + key questions. Garry answers before anything is built.
2. **coder** — builds the approved plan on a `feature/...` branch. Never on `main`.
3. **tester** — tries to break it. Writes tests in `tests/` only; never touches app code or live Supabase.
4. **manager** — reviews plan, code and test results; gives GO / NO-GO with key issues.

Loop: if Tester or Manager finds Critical/Blocker issues → back to Coder (or Architect if the plan was wrong) → re-test → re-review. Only Garry merges to `main`.

## Hard rules
- Add Supabase columns/tables BEFORE deploying code that uses them (SQL goes in `SUPABASE_CHANGES.md`).
- After deploy, check the live site in an incognito window.
- Chrome is the supported phone browser (Safari on iPhone has blocked Supabase calls).
- Cienapps export headers can have trailing spaces — always trim.
- Never delete production data.

## Where things are written down
- `docs/ROADMAP.md` — build order, every decision Garry has made, open questions. Read it before planning or building.
- `docs/ACCEPTED-FAILURES.md` — failing tests Garry has knowingly accepted, with reason and the stage that fixes them. A failing test not on this list is a bug.
- `docs/CODE-HEALTH.md` — Coder's code audit.
- Coder runs the FULL test suite before handing back to the Tester.
- Every new Supabase table needs its own GRANT lines in the same SQL block (Supabase change from 30 Oct 2026).
