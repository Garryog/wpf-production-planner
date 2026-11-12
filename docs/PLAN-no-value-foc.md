# Plan: Work orders with no value + FOC (Garry, 12 Nov 2026) — NOT BUILT YET

Garry: "if a new work order is created in planner a warning is also needed for having no value. if there is not value on work orders
PM need to be warned. management need to be able to have a view of wo's with no values. if the work order are free of charge we can
ticked FOC. a report list of FOC wo's needs to be available for management to keep control".

## Proposed rules (Architect)
1. **No value** = the job's value is blank or €0 (Cienapps Sub-Total, or the value typed in the planner) and it is not ticked FOC.
2. **Creating a work order in the planner** with no value: a warning before saving — "No value — enter one, tick FOC, or save anyway".
   Never blocks the save (production must not stop for it).
3. **Imports:** the preview counts "N jobs with no value"; they come in as normal and carry a red "€ no value" chip.
4. **PM warned:** red chip on his rows (PM page, sequence table when Job B is live) and a line on his home screen "N of your jobs have
   no value".
5. **FOC tick** per job (who / when / reason logged): clears the warning, shows a grey "FOC" chip. If a value later arrives from
   Cienapps on a FOC job it is flagged "FOC but has a value — check".
6. **Management view:** two lists — "No value" (not FOC) and "FOC" — with project, PM, WO, floor/unit, title, due date, who ticked FOC and
   why; filter by project / PM / date; Excel export. Shipped jobs included (that is where money is lost).
7. Listed in Export Changes? No — FOC is planner-only unless Garry wants it sent to Cienapps.

## Questions for Garry
- **Q1. Who can tick FOC?** (a) Office + management only — **recommended** (control); (b) PMs too, management sees who did it.
- **Q2. Is a reason required for FOC?** (a) Yes, pick from Snag / remedial · Warranty · Goodwill · Sample / showhouse · Other + note —
  **recommended**; (b) optional.
- **Q3. Values under a floor (e.g. below €50) — treat as "no value"?** (a) No, only blank / €0 — **recommended**; (b) yes, below a
  Settings number.
- **Q4. Where does it go live?** (a) small release of its own after the Shipped steps and Deliveries releases — **recommended**;
  (b) with Job B.

## Database
No new table needed: FOC is stored on the job (like the delivery tick). No SQL.

## Garry's answers (12 Nov, later)
- **Q1 = (b):** PMs can tick FOC too (office and management as well); management sees who ticked it and when.
- **Q2 = (a):** a reason is required for FOC (Snag / remedial · Warranty · Goodwill · Sample / showhouse · Other + note).
- Q3 (value floor) and Q4 (when it goes live) not answered — ASSUMED the recommendations: only blank / €0 counts; its own small release.
