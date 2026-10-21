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

## Saw/Stores release decisions (21 Oct 2026)
- Saw label printer: Zebra ZD420 (direct thermal, 203 dpi, 104 mm max print width; label size, connection and saw device TBC).
- Labels: per-line print AND a group print (print labels for all lines on screen / selected lines in one go).

## Stores report + Driver POD decisions (21 Oct 2026)
- Stores "Items sent" report: per customer/project, by date — date, WO, item/list, who got it out, delivered yes/no; print + Excel.
- Driver: tick + photo PER WORK ORDER (extra photos optional); photo gets a burned-in date/time stamp; driver name recorded. No typed name or signature for now.
- Drivers only see their own deliveries. Two drivers on one run: each picks their own name from the staff list; both recorded on the run; either can tick/photograph.

## Delivery proof decisions (21 Oct 2026, supersedes earlier POD note)
- Snags are the main delivery problem; full kitchens are usually fine unless the site isn't ready.
- Kitchens (full jobs): tick "Delivered to location" is enough; photo optional. "Site not ready" option with photo of where it was left.
- Snags: each snag item is its own line on the driver's run (own section whether on a kitchen run or a separate run). Per snag: tick + stamped photo in place + one-tap "handed to" name. "Couldn't place" = reason list + photo; logged on the run, assigned to nobody, but VISIBLE to PM (own projects), Production Manager (all) and Office (Deliveries tab).
- Driver's snag tick + photo automatically marks the snag "delivered" on the PM's snag table (raised → in production → on van → delivered with photo).
- Weekly summary per driver: snags delivered, placed vs couldn't place, reasons. Records are permanent; drivers can add, not delete. Office must not tick "delivered" on a driver's behalf.
- Proof of delivery visible to Production Manager and PMs.

## Future phase: Fitters view / fitter management (noted 21 Oct 2026 — not yet planned)
- Fitters get their own view. Delivered snags, with photo and site location / "handed to", must appear on the fitter's view for their project.
- Fitter management is a major area for the next phase after saving, saw/stores, cutting lists/snags, deliveries and CNC/forklift. Design the snag and delivery data so a fitter view can read it without rework.
