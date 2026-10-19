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
