# Plan — Deliveries fixes, 19 Nov 2026

From the Architect, approved by Garry on 19 Nov 2026. Branch `feature/deliveries-19nov` (cut from
`feature/green-step-check`). No database change: everything lives inside the existing `settings` / `orders`.

## Garry's answers (19 Nov)
- **Un-ship:** BOTH cases — a job brought back from the Shipped tab AND a job brought back from 📚 Past weeks.
- **(20 Nov) Steps 10 / 11:** ↩ Back to Deliveries is never offered for step 10 (installed) or 11 (completed / invoiced) — only for a
  delivered job or a Cienapps step-9 job.
- **Slot warning:** warn when the van + day already has ANY job on it.
- **＋ List:** choose the template FIRST.
- **Delete:** two steps, typed WO, never erased.

## Build order (one commit each)
1. **Customer / project band** at the top of every Deliveries card (`dchip`, `.dchip-c`): bold ~13 px, navy band — in the
   pool, the van cells and Later (pool cards used to leave it out). The step badge and the green strip stay.
2. **Slot-occupied warning** inside `placeJobs`: when a van + day already has other jobs (not counting the ones being
   moved) ask "Iveco Tue 25 Nov already has 3 jobs: WO-… (customers). Add these 2 as well?". Cancel changes nothing.
   Covers drag, ⤵ Place, the new selection bar, the list window 🚚 Book and In store → Book.
3. **Visible ☐ tick** on each card, and in the selection bar a van picker, a day picker and "🚚 Book N" (calls
   `placeJobs`). Bar: `[N selected · €value] Put on: [van ▾] [day ▾] [🚚 Book N] 📅 Move to week… 📅 Move dates clear`.
   Usable on a 360 px phone.
4. **× → "Take off board"**, two steps: (a) a dialog saying exactly what will happen; (b) type the WO number (or DELETE
   for a job added by hand) + pick a name; logged. Loaded / dispatched / delivered are refused ("clear its status
   first"). Jobs added by hand are archived (kept, shown in 📚 Past weeks), never erased. A booked card going back to the
   pool keeps its current who / why flow.
5. **"↩ Clear status"** asks to confirm + a name. New **"↩ Back to Deliveries"** on the Shipped-tab card and on each job
   row in 📚 Past weeks: asks name + reason; the old delivered stamps move into the job history; delDone / delDelivAt /
   delivBy cleared; delv = true; pool card marked "↩ brought back — rebook". A step-9 job also gets the existing
   shipBack rule so the next Cienapps import still saying 9 does not ship it again. A job added by hand that was delivered
   and removed at week close is restored from its Past weeks row.
6. **＋ List / ＋ Add cutting list** (L9, `lsNewStd`) when the project has templates: first "Start this list from:
   [Type A] [Type B] … or [Blank standard layout]"; a template opens the window with only the template's rows (WO etc.
   filled). And whenever a template is put into a list, untouched empty rows and empty standard sub-headings are
   removed so no blank lines are left (the `blankAll` edge cases: a colour picked, the heading re-titled by the WO).
   Reproduce Garry's case first.

## Tests
`tests/deliveries/d19-*.test.js`, one per item (fail before, pass after). Fake Supabase only.
