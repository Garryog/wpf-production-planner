# Plan: Stores dockets + "Items sent" report (Architect, 4 Nov 2026; Garry 4 Nov + 21 Oct decisions)

## For Garry
- Stores screen gets a new button, **"Send to site"**. Pick the project. You see every stores item and bought-in item across that project's work orders that has NOT been sent on a docket yet: WO, Floor, Unit (two separate columns), item, qty, spec and status (to pick / got out / waiting).
- Tick the items (e.g. the 20 taps) → **"Make docket"**. The planner gives the next number (D26-0001, D26-0002 …), marks the items "got out" against that docket, and opens a printable docket: number, date, project, customer, site address, the items (WO / Floor / Unit / item / qty / spec), "Sent by", and blank "Received by / date / sign".
- An item can only ever go on ONE docket. If two people try at once, the second is told which items are already sent. You can add free-typed extra items to a docket (e.g. spare handles that aren't on any list).
- **"Dockets"** button: list of all dockets (filter by project). Reopen, reprint, and tick "Signed docket back" (with the name who received it). Dockets are never deleted. A wrong docket is cancelled with a reason, and its items become sendable again.
- **"Items sent" report** (Stores, Office, PM, Production): pick a project and a date range → every docket and every item got out, with date, WO, Floor, Unit, item/list, who got it out, docket no., delivered yes/no. Print, or download to Excel.

## Data: two new tables (a separate items table so the database itself blocks double-sending)
SQL goes in SUPABASE_CHANGES.md (PENDING, run BEFORE deploy, safe to run twice; after the Stage 3 block, because it uses lists_touch(), lists_writable(), lists_switch_on()):
```sql
alter table projects add column if not exists site_address text;
create table if not exists stores_dockets(id text primary key, docket_no text not null unique,
  yr int not null, seq int not null, project_id text not null references projects(id), customer text,
  site_address text, made_at timestamptz not null default now(), made_by text not null, note text,
  status text not null default 'made' check(status in('made','delivered','cancelled')),
  delivered_at timestamptz, delivered_by text, received_by text, cancel_why text,
  version int not null default 1, updated_at timestamptz not null default now(), updated_by text,
  unique(yr,seq));
create table if not exists stores_docket_items(id bigserial primary key,
  docket_id text not null references stores_dockets(id), line_id text references list_lines(id),
  wo text, floor text, unit text, item text not null, qty text, spec text, kind text, active boolean not null default true);
create unique index if not exists sdi_once on stores_docket_items(line_id, coalesce(wo,'')) where line_id is not null and active;
create index if not exists sd_proj on stores_dockets(project_id, made_at);
drop trigger if exists stores_dockets_touch on stores_dockets;
create trigger stores_dockets_touch before update on stores_dockets for each row execute function lists_touch();
-- RLS as for snags (read for anon/authenticated; add/edit with check lists_writable(); drop-policy-if-exists form)
-- GRANTs (30 Oct rule). No DELETE: a docket is cancelled, never deleted.
grant select, insert, update on stores_dockets, stores_docket_items to anon, authenticated;
grant usage, select on sequence stores_docket_items_id_seq to anon, authenticated;
grant all on stores_dockets, stores_docket_items to service_role;
grant usage, select on sequence stores_docket_items_id_seq to service_role;
revoke delete, truncate on stores_dockets, stores_docket_items from anon, authenticated;
```
Database functions (each with its own `grant execute` line), each doing its whole job in one step:
- `make_docket(p_project, p_items jsonb, p_note, p_by)`: calls lists_switch_on(); locks the lines; refuses if any line is already on a live docket, is waiting, or is marked not needed (returns which and why); takes the next number for the year under pg_advisory_xact_lock so two PCs can't get the same number; saves the docket and its items; sets each stores (fit) line that is still to-pick to got-out once all of its WOs are sent; writes a list_events row (act 'docket', note = docket no.) per line. Bought-in (buy) lines keep their status: the docket item is the record.
- `docket_delivered(p_id, p_received_by, p_by)` and `docket_cancel(p_id, p_why, p_by)`. Cancelling sets active=false on its items so they can be sent again; it does NOT undo got-out ticks.

## Which lines are sendable
Stores (fit) and bought-in (buy) lines on the project's live, not-removed lists, one row per line per WO, with no live docket item. Shown by default: to-pick, and released-from-waiting. "Show got out" toggle adds lines already got out but not on a docket (held back in stores). Waiting lines are greyed "release first". Not-needed lines hidden. Partial quantity: not in the first build (whole line only; type the rest as a free item later).

## Old lists vs new tables (listStore switch)
Picking items from lists = new tables (V2) only (old rows have no permanent ID, so "never on two dockets" can't be guaranteed). With the switch OFF the Dockets screen still works with FREE-TYPED items only (WO + Floor + Unit + item + qty), once the tables exist.

## Screens
- Stores (`renderWorkList(app,'fit')`): header buttons "Send to site" and "Dockets". 360 px Chrome.
- Print docket: A4 like today's Stores sheet print. Floor and Unit are separate columns.
- "Items sent" report: Stores + Office (Lists tab) + PM + Production. Project + From/To dates; rows from docket items and list_events 'got-out'. Delivered = docket marked delivered, or (items not on a docket) the WO's delivery done. Print + Excel (SheetJS).
- Later: pick a van and day on a docket so the driver's run shows "Docket D26-0007" (driver ticks it there, per the 21 Oct rule).

## Must not change
N/A → WAITING one tap, "Release all", "done wins", got-out/cut rules, Deliveries board, Past weeks archive (keeps only 26 weeks, which is why dockets need their own table), Cienapps import/export, switch-OFF behaviour.

## Risks
Two stores PCs sending the same taps (database refuses; test). Docket numbers clashing (lock + unique). SQL run after deploy (CLAUDE.md order). Safari (Chrome only). A list revision removes a line already on a docket: the docket keeps its own copy of the text. Report speed on big projects: filter in the database.

## Acceptance checks
1. 20 tap lines across 5 WOs → docket D26-0001 prints with Floor and Unit separate; lines show "got out".
2. Two browsers send the same taps at once → one docket; the other is told "already on D26-0001".
3. Next docket D26-0002; first of 2027 D27-0001.
4. A waiting line can't be added; after "Release all" it can.
5. Cancel with a reason → items sendable again; docket stays, marked CANCELLED.
6. "Items sent" for a project, last 30 days → matches dockets and ticks; Excel has the same rows.
7. Switch OFF: no list lines offered, free-typed docket works, Saw/Stores tests unchanged.
8. Full suite: only ACCEPTED-FAILURES remain.

## Build steps
D0 SQL + mock (tests/stores-docket/). D1 make_docket / delivered / cancel, tests first. D2 "Send to site" picker (V2). D3 docket print. D4 Dockets list (reopen, reprint, delivered, cancel, free items, both modes). D5 "Items sent" report + print + Excel. D6 site address on Projects. D7 attack tests + full suite.

## Questions for Garry
1. Should items ALREADY ticked "got out" (held in stores) appear in "Send to site"? Recommend: yes, behind a "Show got out" tick.
2. Add an optional "Site address" to each project for the docket? Recommend: yes.
3. Sending part of a line (10 of 20 taps)? Recommend: not now; whole lines only.
