// Stage 3 fake database: the new tables and the five database functions from SUPABASE_CHANGES.md (2026-11-02 block),
// written in JS so the tests can run without Supabase. Rules mirror the SQL line by line — the Manager checks the two
// side by side. Never touches the network.
const TABLES = ['projects', 'project_materials', 'lists', 'list_lines', 'list_revisions', 'list_events', 'snags'];
const TOUCHED = { projects: 1, project_materials: 1, lists: 1, list_lines: 1, snags: 1 }; // lists_touch trigger
const now = () => new Date().toISOString();
const clone = x => x === undefined ? undefined : JSON.parse(JSON.stringify(x));

function defaults(t, r) {
  const n = now();
  const base = {
    projects: { customer: null, list_owner: null, active: true, project_type: 'kitchens', pm: null, cien_names: [], order_nos: [], setup_done: false, version: 1, updated_at: n, updated_by: null },
    project_materials: { aliases: [], active: true, sort: 0, version: 1, updated_at: n, updated_by: null },
    lists: { project_id: null, list_type: 'house', type_name: null, is_template: false, template_id: null, template_rev: null, rev: 1, locked: false, sent_at: null,
      wos: [], no_cut: false, no_fit: false, saw_done_at: null, saw_done_by: null, fit_done_at: null, fit_done_by: null, source: 'manual', sdate: null,
      deliver_by: null, archived: false, log: [], n_saw: 0, n_fit: 0, version: 1, created_at: n, created_by: null, updated_at: n, updated_by: null },
    list_lines: { section: null, part: null, length_mm: null, width_mm: null, qty: null, material: null, material_other: false, edging: null, note: null,
      status: 'todo', status_by: null, status_at: null, released_at: null, released_by: null, added_rev: null, changed_rev: null, removed_rev: null,
      src_line_id: null, snag_id: null, version: 1, updated_at: n },
    list_revisions: { meta: null, reason: null, made_by: null, made_at: n },
    list_events: { from_status: null, to_status: null, n: 1, by: null, at: n, client_at: null, note: null, cid: null, line_id: null, v_after: null },
    snags: { location_id: null, where_text: null, raised_at: n, material_id: null, material_text: null, qty: 1, length_mm: null, width_mm: null, edging: null, note: null,
      status: 'raised', status_by: null, status_at: null, list_id: null, list_line_id: null, delivery_item_id: null, photo_path: null, handed_to: null,
      couldnt_reason: null, cien_wo: null, version: 1, updated_at: n, updated_by: null },
  }[t];
  return Object.assign({}, clone(base), clone(r));
}
const CHECKS = {
  project_materials: r => ['sheet', 'other'].includes(r.kind),
  lists: r => ['kitchen', 'house', 'room', 'other', 'snag'].includes(r.list_type) && ['excel', 'manual', 'template', 'migrated'].includes(r.source),
  list_lines: r => ['saw', 'fit', 'hdr'].includes(r.kind) && ['todo', 'cut', 'got-out', 'waiting', 'na'].includes(r.status),
  snags: r => ['saw', 'fit'].includes(r.kind) && ['raised', 'on-list', 'cut', 'on-van', 'delivered', 'placed', 'couldnt-place', 'closed', 'cancelled'].includes(r.status),
};
class DbError extends Error { constructor(m, code) { super(m); this.code = code || 'P0001'; } }
// Postgres column types: '' or rubbish in a date / number column is an error, not a blank (the SQL casts with ::date / ::numeric)
const DATES = ['sdate', 'deliver_by', 'sent_at', 'saw_done_at', 'fit_done_at', 'status_at', 'released_at', 'raised_at'], NUMS = ['length_mm', 'width_mm', 'seq', 'template_rev', 'rev', 'added_rev', 'changed_rev', 'removed_rev', 'n_saw', 'n_fit', 'sort'];
function typeCheck(t, r) {
  DATES.forEach(k => { if (k in r && r[k] != null && (r[k] === '' || isNaN(Date.parse(r[k])))) throw new DbError('invalid input syntax for type date/timestamp: "' + r[k] + '"', '22007'); });
  NUMS.forEach(k => { if (k in r && r[k] != null && (r[k] === '' || typeof r[k] === 'boolean' || isNaN(+r[k]))) throw new DbError('invalid input syntax for type numeric: "' + r[k] + '"', '22P02'); });
  if (t === 'snags' && 'qty' in r && r.qty != null && (r.qty === '' || isNaN(+r.qty))) throw new DbError('invalid input syntax for type numeric: "' + r.qty + '"', '22P02');
}

function makeDb() { const d = { t: {}, seq: { list_revisions: 1, list_events: 1 } }; TABLES.forEach(t => { d.t[t] = []; }); return d; }
function find(d, t, id) { return d.t[t].find(r => r.id === id); }
function insert(d, t, r) {
  const row = defaults(t, r);
  typeCheck(t, row);
  if (t === 'list_revisions' || t === 'list_events') row.id = d.seq[t]++;
  else if (row.id == null || row.id === '') throw new DbError('null value in column "id"', '23502');
  if (row.id != null && d.t[t].some(x => x.id === row.id)) throw new DbError('duplicate key value violates unique constraint "' + t + '_pkey"', '23505');
  if (t === 'list_events' && row.cid != null && d.t[t].some(x => x.cid === row.cid)) throw new DbError('duplicate key value violates unique constraint "le_cid"', '23505');
  if (t === 'projects' && d.t[t].some(x => String(x.name).toLowerCase() === String(row.name).toLowerCase())) throw new DbError('duplicate key value violates unique constraint "projects_name_uq"', '23505');
  if (CHECKS[t] && !CHECKS[t](row)) throw new DbError('new row violates check constraint', '23514');
  d.t[t].push(row); return row;
}
// UPDATE … — the lists_touch trigger bumps version and updated_at; the snag trigger runs after a line's status changes
function update(d, t, row, patch) {
  typeCheck(t, patch);
  const old = clone(row);
  Object.assign(row, clone(patch));
  if (CHECKS[t] && !CHECKS[t](row)) { Object.keys(row).forEach(k => delete row[k]); Object.assign(row, old); throw new DbError('new row violates check constraint', '23514'); }
  if (TOUCHED[t]) { row.version = old.version + 1; row.updated_at = now(); }
  if (t === 'list_lines' && 'status' in patch) snagLineDone(d, old, row);
  return row;
}
function snagLineDone(d, old, nw) {
  if (nw.snag_id != null && ['cut', 'got-out'].includes(nw.status) && old.status !== nw.status) {
    const s = find(d, 'snags', nw.snag_id);
    if (s && s.status === 'on-list') update(d, 'snags', s, { status: 'cut', status_by: nw.status_by, status_at: now() });
  }
}
const logAdd = (r, e) => (r.log || []).concat([e]);

// ---- apply_line_changes(p_changes jsonb, p_by text)
function applyLineChanges(d, changes, by) {
  const res = [];
  for (const c of changes || []) {
    if (c.cid != null && d.t.list_events.some(e => e.cid === c.cid)) {
      const l = find(d, 'list_lines', c.id) || {}, ev = d.t.list_events.find(e => e.cid === c.cid);
      res.push({ id: c.id, cid: c.cid, ok: true, dup: true, va: ev ? ev.v_after : null, status: l.status, v: l.version, by: l.status_by, at: l.status_at, rel: l.released_at, relby: l.released_by });
      continue;
    }
    let l = find(d, 'list_lines', c.id);
    if (!l) { res.push({ id: c.id, cid: c.cid, ok: false, why: 'missing' }); continue; }
    const a = c.act || 'status', w = c.status; let ok = false, noop = false, why = null;
    if (l.removed_rev != null) why = 'removed';
    else if (a === 'release') {
      if (l.status === 'waiting') ok = true;
      else if (['cut', 'got-out'].includes(l.status)) { ok = true; noop = true; }
      else why = 'not-waiting';
    } else if (w === 'cut' || w === 'got-out') {
      if (l.kind !== (w === 'cut' ? 'saw' : 'fit')) why = 'wrong-kind';
      else if (l.status === 'na') why = 'not-needed';
      else if ((l.changed_rev || 0) > (c.rev == null ? 0 : +c.rev)) why = 'changed';
      else if (l.status === w) { ok = true; noop = true; }
      else ok = true;
    } else if (w === 'waiting') {
      if (l.status === 'todo') ok = true;
      else if (l.status === 'waiting') { ok = true; noop = true; }
      else if (['cut', 'got-out'].includes(l.status)) why = 'done';
      else why = 'not-needed';
    } else if (w === 'todo') {
      if (c.v != null && l.version === +c.v) { ok = true; noop = l.status === 'todo'; } else why = 'stale';
    } else if (w === 'na') {
      if (['todo', 'waiting'].includes(l.status)) ok = true; else why = 'done';
    } else why = 'bad';
    if (ok && !noop) {
      if (a === 'release') update(d, 'list_lines', l, { status: 'todo', released_at: now(), released_by: by });
      else update(d, 'list_lines', l, { status: w, status_by: by, status_at: now(), released_at: w === 'todo' ? null : l.released_at });
      const li = find(d, 'lists', l.list_id);
      if (li && !li.locked) update(d, 'lists', li, { locked: true, updated_by: by });
    }
    if (ok) insert(d, 'list_events', { list_id: l.list_id, line_id: l.id, act: a, from_status: c.from == null ? null : c.from, to_status: l.status, by, client_at: c.at || null, cid: c.cid == null ? null : c.cid, v_after: l.version });
    res.push({ id: l.id, cid: c.cid, ok, why, status: l.status, v: l.version, by: l.status_by, at: l.status_at, rel: l.released_at, relby: l.released_by });
  }
  return res;
}

// ---- list_attach(p_list, p_wo, p_on, p_by)
function listAttach(d, id, wo, on, by, cid) {
  const r = find(d, 'lists', id); if (!r) throw new DbError('missing list ' + id);
  if (cid != null && d.t.list_events.some(e => e.cid === cid)) return clone(r); // the same tap resent
  const had = r.wos.includes(wo);
  if (on && !had) update(d, 'lists', r, { wos: r.wos.concat([wo]), updated_by: by, log: logAdd(r, { at: now(), by, what: 'Work order ' + wo + ' attached' }) });
  else if (!on && had) update(d, 'lists', r, { wos: r.wos.filter(w => w !== wo), updated_by: by, log: logAdd(r, { at: now(), by, what: 'Work order ' + wo + ' taken off' }) });
  if (!!on !== had) insert(d, 'list_events', { list_id: id, act: on ? 'attach' : 'detach', by, note: wo, cid: cid == null ? null : cid });
  return clone(r);
}

// ---- list_set_done(p_list, p_mode, p_on, p_by, p_why)
function listSetDone(d, id, mode, on, by, why, cid) {
  const r = find(d, 'lists', id); if (!r) throw new DbError('missing list ' + id);
  if (cid != null && d.t.list_events.some(e => e.cid === cid)) return clone(r); // the same tap resent
  const dd = x => { const t = new Date(x); return String(t.getUTCDate()).padStart(2, '0') + '/' + String(t.getUTCMonth() + 1).padStart(2, '0') + '/' + t.getUTCFullYear(); };
  why = why == null ? null : why;
  if (mode === 'saw' || mode === 'fit') {
    const at = mode + '_done_at', b = mode + '_done_by';
    const what = on ? (mode === 'saw' ? 'Cut complete' : 'Fittings picked')
      : (mode === 'saw' ? 'Sent back for re-cutting' : 'Sent back for re-picking') + (r[at] ? ' (was done ' + dd(r[at]) + (r[b] ? ' by ' + r[b] : '') + ')' : '');
    update(d, 'lists', r, { [at]: on ? now() : null, [b]: on ? by : null, updated_by: by, log: logAdd(r, { at: now(), by, what, why }) });
  } else if (mode === 'no_cut' || mode === 'no_fit') {
    const f = mode;
    update(d, 'lists', r, { [f]: !!on, updated_by: by, log: logAdd(r, { at: now(), by, what: (f === 'no_cut' ? 'No cutting' : 'No fittings') + (on ? ' ticked' : ' unticked'), why }) });
  } else if (mode === 'send') {
    update(d, 'lists', r, { sent_at: r.sent_at || now(), locked: true, updated_by: by, log: logAdd(r, { at: now(), by, what: 'Sent to the saw', why }) });
  } else if (mode === 'archive') {
    update(d, 'lists', r, { archived: !!on, updated_by: by, log: logAdd(r, { at: now(), by, what: on ? 'Archived' : 'Brought back from the archive', why }) });
  } else throw new DbError('bad mode ' + mode);
  insert(d, 'list_events', { list_id: id, act: mode + (on ? '-on' : '-off'), by, note: why, cid: cid == null ? null : cid });
  return clone(r);
}

// ---- save_list_revision(p_list jsonb, p_lines jsonb, p_expect int, p_by, p_reason)
const LINE_F = ['section', 'part', 'length_mm', 'width_mm', 'qty', 'material', 'edging', 'note'];
function saveListRevision(d, pl, lines, expect, by, reason) {
  let r = find(d, 'lists', pl.id), isnew = false, nrev;
  // validate everything first — the SQL runs in one transaction, so an error leaves nothing half-written
  if (!r && expect != null) throw new DbError('stale: list ' + pl.id + ' is missing');
  if (r && (expect == null || r.version !== +expect)) throw new DbError('stale: list ' + r.id + ' is at version ' + r.version + ', editor had ' + expect);
  for (const e of lines || []) {
    if (e.id == null || e.id === '') throw new DbError('null value in column "id" of relation "list_lines"', '23502');
    const ex = find(d, 'list_lines', e.id);
    if (ex && r && ex.list_id !== r.id) throw new DbError('duplicate key value violates unique constraint "list_lines_pkey"', '23505');
    if (!ex && !['saw', 'fit', 'hdr'].includes(e.kind)) throw new DbError('new row violates check constraint', '23514');
  }
  if (!r) {
    r = insert(d, 'lists', { id: pl.id, project_id: pl.project_id || null, name: pl.name || '(no name)', list_type: pl.list_type || 'house', type_name: pl.type_name || null,
      is_template: !!pl.is_template, template_id: pl.template_id || null, template_rev: pl.template_rev == null ? null : +pl.template_rev, wos: pl.wos || [],
      no_cut: !!pl.no_cut, no_fit: !!pl.no_fit, source: pl.source || 'manual', sdate: pl.sdate || null, created_by: by, updated_by: by,
      log: [{ at: now(), by, what: 'List created', why: reason == null ? null : reason }] });
    isnew = true; nrev = 1;
  } else {
    nrev = r.rev;
    if (r.locked || r.is_template || pl.lock) {
      insert(d, 'list_revisions', { list_id: r.id, rev: r.rev, lines: clone(d.t.list_lines.filter(x => x.list_id === r.id && x.removed_rev == null).sort((a, b) => a.seq - b.seq)), meta: clone(r), reason, made_by: by });
      nrev = r.rev + 1;
    }
  }
  const ids = [];
  for (const e of lines || []) {
    ids.push(e.id);
    const ex = d.t.list_lines.find(x => x.id === e.id && x.list_id === r.id);
    if (ex) {
      const p = { seq: e.seq != null ? +e.seq : ex.seq, kind: e.kind || ex.kind, material_other: !!e.material_other, snag_id: e.snag_id != null ? e.snag_id : ex.snag_id, removed_rev: null };
      LINE_F.forEach(k => { p[k] = e[k] === undefined ? null : e[k]; });
      if (e.reset) Object.assign(p, { status: 'todo', status_by: null, status_at: null, released_at: null, changed_rev: nrev });
      const num = v => v == null || v === '' ? null : +v;
      const diff = e.reset || ex.removed_rev != null || Object.keys(p).some(k => k !== 'removed_rev' && (['length_mm', 'width_mm'].includes(k) ? num(p[k]) !== num(ex[k]) : (p[k] == null ? null : p[k]) !== (ex[k] == null ? null : ex[k])));
      if (diff) update(d, 'list_lines', ex, p); // an unchanged line is left alone (version and time don't move)
    } else {
      const p = { id: e.id, list_id: r.id, seq: e.seq != null ? +e.seq : 0, kind: e.kind, material_other: !!e.material_other, snag_id: e.snag_id || null, src_line_id: e.src_line_id || null, added_rev: nrev };
      LINE_F.forEach(k => { p[k] = e[k] === undefined ? null : e[k]; });
      insert(d, 'list_lines', p);
    }
  }
  d.t.list_lines.filter(x => x.list_id === r.id && x.removed_rev == null && !ids.includes(x.id)).forEach(x => update(d, 'list_lines', x, { removed_rev: nrev }));
  const live = d.t.list_lines.filter(x => x.list_id === r.id && x.removed_rev == null);
  const patch = { rev: nrev, updated_by: by, locked: r.is_template ? r.locked : (r.locked || !!pl.lock), n_saw: live.filter(x => x.kind === 'saw').length, n_fit: live.filter(x => x.kind === 'fit').length };
  ['name', 'list_type', 'source'].forEach(k => { if (pl[k] != null) patch[k] = pl[k]; });
  ['project_id', 'type_name', 'sdate', 'deliver_by'].forEach(k => { if (k in pl) patch[k] = pl[k]; });
  ['no_cut', 'no_fit'].forEach(k => { if (pl[k] != null) patch[k] = !!pl[k]; });
  if (!isnew) patch.log = logAdd(r, { at: now(), by, what: nrev > r.rev ? 'Revision ' + nrev : 'List edited', why: reason == null ? null : reason });
  update(d, 'lists', r, patch);
  return { list: clone(r), lines: clone(d.t.list_lines.filter(x => x.list_id === r.id).sort((a, b) => a.seq - b.seq)) };
}

// ---- snags_to_list(p_ids text[], p_deliver_by date, p_by)
let lsN = 0;
function snagsToList(d, ids, deliverBy, by) {
  const ss = d.t.snags.filter(s => ids.includes(s.id));
  const bad = ss.filter(s => s.status !== 'raised');
  if (bad.length) throw new DbError('not raised: ' + bad.map(s => s.id + ' (' + s.status + ')').join(', '));
  if (ss.length !== new Set(ids).size || ss.length !== ids.length) throw new DbError('missing snag');
  const out = [];
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dl = String(deliverBy).slice(8, 10) + ' ' + mon[+String(deliverBy).slice(5, 7) - 1];
  [...new Set(ss.map(s => s.project_id))].sort().forEach(pid => {
    const p = find(d, 'projects', pid);
    const lid = 'LS' + Date.now().toString(16) + (++lsN);
    const mine = ss.filter(s => s.project_id === pid).sort((a, b) => a.raised_at < b.raised_at ? -1 : a.raised_at > b.raised_at ? 1 : a.id < b.id ? -1 : 1);
    insert(d, 'lists', { id: lid, project_id: pid, name: 'Snags ' + (p ? p.name : pid) + ' ' + dl, list_type: 'snag', source: 'manual', deliver_by: deliverBy, created_by: by, updated_by: by,
      log: [{ at: now(), by, what: 'Snag list created from ' + mine.length + ' snags' }] });
    mine.forEach((s, i) => {
      const lnid = lid + ':' + (i + 1), m = s.material_id ? find(d, 'project_materials', s.material_id) : null;
      insert(d, 'list_lines', { id: lnid, list_id: lid, seq: i + 1, kind: s.kind, part: s.item, length_mm: s.length_mm, width_mm: s.width_mm, qty: String(s.qty),
        material: m ? m.name : s.material_text, material_other: !s.material_id && !!s.material_text, edging: s.edging,
        note: [s.where_text, s.note].filter(x => x).join(' — ') || null, snag_id: s.id, added_rev: 1 });
      update(d, 'snags', s, { status: 'on-list', status_by: by, status_at: now(), list_id: lid, list_line_id: lnid, updated_by: by });
    });
    const l = find(d, 'lists', lid), ll = d.t.list_lines.filter(x => x.list_id === lid);
    update(d, 'lists', l, { n_saw: ll.filter(x => x.kind === 'saw').length, n_fit: ll.filter(x => x.kind === 'fit').length });
    out.push(lid);
  });
  return out;
}

// Each database function runs in one transaction: an error part-way leaves nothing behind
const txn = f => (d, a) => { const snap = clone(d.t), seq = clone(d.seq); try { return f(d, a); } catch (e) { d.t = snap; d.seq = seq; throw e; } };
const RPC0 = {
  apply_line_changes: (d, a) => applyLineChanges(d, a.p_changes, a.p_by),
  list_attach: (d, a) => listAttach(d, a.p_list, a.p_wo, a.p_on, a.p_by, a.p_cid),
  list_set_done: (d, a) => listSetDone(d, a.p_list, a.p_mode, a.p_on, a.p_by, a.p_why, a.p_cid),
  save_list_revision: (d, a) => saveListRevision(d, a.p_list, a.p_lines, a.p_expect, a.p_by, a.p_reason),
  snags_to_list: (d, a) => snagsToList(d, a.p_ids, a.p_deliver_by, a.p_by),
};
const RPC = {}; Object.keys(RPC0).forEach(k => { RPC[k] = txn(RPC0[k]); });
module.exports = { makeDb, insert, update, find, applyLineChanges, listAttach, listSetDone, saveListRevision, snagsToList, RPC, TABLES, DbError, clone };
