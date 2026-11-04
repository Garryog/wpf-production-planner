// Stores dockets fake database: the two docket tables and the three functions from SUPABASE_CHANGES.md (2026-11-04
// "Stores dockets" block), on top of the Stage 3 fake (tests/stage3/db3.js — untouched). Rules mirror the SQL line by
// line so the Manager can check the two side by side. Never touches the network.
const D3 = require('../stage3/db3.js');
const { DbError, clone, find } = D3;
const TABLES = ['stores_dockets', 'stores_docket_items'];
const now = d => (d.clock ? d.clock() : new Date()).toISOString();
const NUM = /^\d+(\.\d+)?$/;
const t = v => (v == null ? '' : String(v)).trim();
const nz = v => t(v) || null;
function makeDb() { const d = D3.makeDb(); TABLES.forEach(x => { d.t[x] = []; }); d.seq.stores_docket_items = 1; return d; }
function ensure(d) { TABLES.forEach(x => { if (!d.t[x]) d.t[x] = []; }); if (!d.seq.stores_docket_items) d.seq.stores_docket_items = 1; }
// lists_switch_on(): refuses unless the planner record says 'v2' (the fake server passes the planner row's switch in)
function switchOn(d) { if (d.listStore !== undefined && d.listStore !== 'v2') throw new DbError('switched off: the cutting lists are on the old store'); }
function touch(row, by, d) { row.version = (row.version || 1) + 1; row.updated_at = now(d); if (by !== undefined) row.updated_by = by; }
function lineUpdate(d, l, patch) { D3.update(d, 'list_lines', l, patch); } // lists_touch + snag trigger
const active = (d, lid) => d.t.stores_docket_items.filter(i => i.line_id === lid && i.active);
const dks = (d, lid) => { const s = [...new Set(active(d, lid).map(i => (find(d, 'stores_dockets', i.docket_id) || {}).docket_no))].sort(); return s.length ? s.join(', ') : null; };
const dublinYear = dt => +new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Dublin', year: 'numeric' }).format(dt);

// ---- make_docket(p_docket jsonb, p_items jsonb, p_by text)
function makeDocket(d, p, items, by) {
  ensure(d); p = p || {};
  if (!t(by)) throw new DbError('say who is sending the docket');
  if (!Array.isArray(items) || !items.length) throw new DbError('a docket needs at least one item');
  const cid = nz(p.cid);
  if (cid) { const ex = d.t.stores_dockets.find(x => x.cid === cid); if (ex) return { ok: true, dup: true, id: ex.id, docket_no: ex.docket_no, made_at: ex.made_at }; }
  let pid = nz(p.project_id), pname = nz(p.project_name), pcust = nz(p.customer);
  if (pid) { const pr = find(d, 'projects', pid); if (!pr) throw new DbError('that project is not in the database'); pname = pr.name; pcust = pcust || pr.customer || null; }
  if (!pname) throw new DbError('pick the project first');
  const withLine = items.filter(x => t(x.line_id));
  if (withLine.length) {
    switchOn(d);
    if (new Set(withLine.map(x => x.line_id)).size !== withLine.length) throw new DbError('the same line is on this docket twice');
  }
  const bad = [];
  for (const it of items) {
    if (!t(it.line_id)) {
      if (!t(it.item)) bad.push({ line_id: null, why: 'no-item' });
      else if (!t(it.qty)) bad.push({ line_id: null, item: it.item, why: 'no-qty' });
      continue;
    }
    const l = find(d, 'list_lines', it.line_id);
    if (!l) { bad.push({ line_id: it.line_id, why: 'missing' }); continue; }
    const li = find(d, 'lists', l.list_id) || {};
    const act = active(d, l.id), sent = act.reduce((s, i) => s + (i.qty == null ? 0 : +i.qty), 0), nsent = act.length, ds = dks(d, l.id);
    const tot = NUM.test(t(l.qty)) ? +t(l.qty) : null, want = NUM.test(t(it.qty)) ? +t(it.qty) : null;
    if (l.removed_rev != null) bad.push({ line_id: l.id, why: 'removed' });
    else if (li.archived || li.is_template) bad.push({ line_id: l.id, why: 'not-live' });
    else if (pid && li.project_id !== pid) bad.push({ line_id: l.id, why: 'other-project' });
    else if (!['fit', 'buy'].includes(l.kind)) bad.push({ line_id: l.id, why: 'wrong-kind' });
    else if (l.status === 'na') bad.push({ line_id: l.id, why: 'not-needed' });
    else if (l.status === 'waiting') bad.push({ line_id: l.id, why: 'waiting' });
    else if (l.status === 'got-out') bad.push({ line_id: l.id, why: 'got-out', dockets: ds });
    else if (tot == null) { if (nsent > 0) bad.push({ line_id: l.id, why: 'sent', left: 0, dockets: ds }); }
    else if (sent >= tot) bad.push({ line_id: l.id, why: 'sent', left: 0, dockets: ds });
    else if (want == null || want <= 0) bad.push({ line_id: l.id, why: 'bad-qty', left: tot - sent });
    else if (want > tot - sent) bad.push({ line_id: l.id, why: 'too-many', left: tot - sent, dockets: ds });
  }
  if (bad.length) return { ok: false, refused: bad };
  const at = now(d), yr = dublinYear(new Date(at));
  const seq = d.t.stores_dockets.filter(x => x.yr === yr).reduce((m, x) => Math.max(m, x.seq), 0) + 1;
  const no = 'D' + String(yr % 100).padStart(2, '0') + '-' + String(seq).padStart(4, '0');
  const id = 'DK' + Math.random().toString(16).slice(2) + Date.now().toString(16);
  if (d.t.stores_dockets.some(x => x.docket_no === no)) throw new DbError('duplicate key value violates unique constraint "stores_dockets_docket_no_key"', '23505');
  d.t.stores_dockets.push({ id, docket_no: no, yr, seq, project_id: pid, project_name: pname, customer: pcust, site_address: nz(p.site_address),
    delivery_instructions: nz(p.delivery_instructions), note: nz(p.note), made_at: at, made_by: t(by), status: 'made', delivered_at: null, delivered_by: null,
    received_by: null, received_at: null, signature_name: null, cancelled_at: null, cancelled_by: null, cancel_why: null, cid, version: 1, updated_at: at, updated_by: t(by) });
  let k = 0;
  for (const it of items) {
    k++;
    const base = { id: d.seq.stores_docket_items++, docket_id: id, seq: k, wo: nz(it.wo), floor: nz(it.floor), unit: nz(it.unit), title: nz(it.title), active: true, got_out_at: null };
    if (!t(it.line_id)) {
      const qt = t(it.qty);
      d.t.stores_docket_items.push(Object.assign(base, { line_id: null, list_id: null, kind: 'free', item: t(it.item), qty: NUM.test(qt) && +qt > 0 ? +qt : null, qty_text: qt, spec: nz(it.spec) }));
      continue;
    }
    const l = find(d, 'list_lines', it.line_id);
    const tot = NUM.test(t(l.qty)) ? +t(l.qty) : null, want = tot == null ? null : +t(it.qty);
    const sent = active(d, l.id).reduce((s, i) => s + (i.qty == null ? 0 : +i.qty), 0);
    let got = null; const from = l.status;
    if (l.kind === 'fit' && l.status === 'todo' && (tot == null || sent + want >= tot)) {
      lineUpdate(d, l, { status: 'got-out', status_by: t(by), status_at: now(d) });
      got = l.status_at;
      const li = find(d, 'lists', l.list_id); if (li && !li.locked) D3.update(d, 'lists', li, { locked: true, updated_by: t(by) });
    }
    d.t.stores_docket_items.push(Object.assign(base, { line_id: l.id, list_id: l.list_id, kind: l.kind, item: t(l.part) || '(no name)', qty: want,
      qty_text: want != null ? String(want) : nz(l.qty), spec: [t(l.material), t(l.note)].filter(Boolean).join(' · ') || null, got_out_at: got }));
    D3.insert(d, 'list_events', { list_id: l.list_id, line_id: l.id, act: 'docket', from_status: got ? 'todo' : from, to_status: l.status, by: t(by),
      note: no + ' · ' + (want != null ? String(want) : (l.qty || '')) + (tot == null ? '' : ' of ' + tot), v_after: l.version, at: now(d) });
  }
  return { ok: true, id, docket_no: no, made_at: at };
}
// ---- docket_delivered(p_id, p_received_by, p_received_at, p_signature_name, p_by)
function docketDelivered(d, id, recBy, recAt, sig, by) {
  ensure(d);
  if (!t(by)) throw new DbError('say who is marking the docket delivered');
  if (!t(recBy)) throw new DbError('type who received it on site');
  const k = find(d, 'stores_dockets', id); if (!k) throw new DbError('missing docket');
  if (k.status === 'cancelled') return { ok: false, why: 'cancelled', docket_no: k.docket_no };
  if (k.status === 'delivered') return { ok: true, dup: true, docket_no: k.docket_no, received_by: k.received_by };
  if (recAt != null && (recAt === '' || isNaN(Date.parse(recAt)))) throw new DbError('invalid input syntax for type date: "' + recAt + '"', '22007');
  Object.assign(k, { status: 'delivered', delivered_at: now(d), delivered_by: t(by), received_by: t(recBy), received_at: recAt || now(d).slice(0, 10), signature_name: nz(sig) });
  touch(k, t(by), d);
  return { ok: true, docket_no: k.docket_no };
}
// ---- docket_cancel(p_id, p_why, p_by)
function docketCancel(d, id, why, by) {
  ensure(d);
  if (!t(by)) throw new DbError('say who is cancelling the docket');
  if (!t(why)) throw new DbError('give the reason for cancelling');
  const its = d.t.stores_docket_items.filter(i => i.docket_id === id);
  const lids = [...new Set(its.map(i => i.line_id).filter(Boolean))].sort();
  if (lids.length) switchOn(d);
  const k = find(d, 'stores_dockets', id); if (!k) throw new DbError('missing docket');
  if (k.status === 'cancelled') return { ok: true, dup: true, docket_no: k.docket_no };
  if (k.status === 'delivered') return { ok: false, why: 'delivered', docket_no: k.docket_no };
  Object.assign(k, { status: 'cancelled', cancelled_at: now(d), cancelled_by: t(by), cancel_why: t(why) }); touch(k, t(by), d);
  its.forEach(i => { i.active = false; });
  for (const lid of lids) {
    const l = find(d, 'list_lines', lid); if (!l) continue;
    const mine = l.status === 'got-out' && d.t.stores_docket_items.some(i => i.line_id === l.id && i.got_out_at != null && Date.parse(i.got_out_at) === Date.parse(l.status_at));
    const from = l.status;
    if (mine) lineUpdate(d, l, { status: 'todo', status_by: t(by), status_at: now(d) });
    D3.insert(d, 'list_events', { list_id: l.list_id, line_id: l.id, act: 'docket-cancel', from_status: from, to_status: l.status, by: t(by), note: k.docket_no + ' cancelled: ' + t(why), v_after: l.version, at: now(d) });
  }
  return { ok: true, docket_no: k.docket_no };
}
// Each function runs in one transaction: an error part-way leaves nothing behind
const txn = f => (d, a) => { const snap = clone(d.t), seq = clone(d.seq); try { return f(d, a); } catch (e) { d.t = snap; d.seq = seq; throw e; } };
const RPC = {
  make_docket: txn((d, a) => makeDocket(d, a.p_docket, a.p_items, a.p_by)),
  docket_delivered: txn((d, a) => docketDelivered(d, a.p_id, a.p_received_by, a.p_received_at, a.p_signature_name, a.p_by)),
  docket_cancel: txn((d, a) => docketCancel(d, a.p_id, a.p_why, a.p_by)),
};
module.exports = { makeDb, ensure, makeDocket, docketDelivered, docketCancel, RPC, TABLES, D3 };
