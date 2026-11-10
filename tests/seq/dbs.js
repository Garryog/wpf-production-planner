// PM sequence fake database: project_seq, seq_requests, seq_pre and the seq_* functions from SUPABASE_CHANGES.md
// (2026-11-10 "PM sequence & pre-production" block), on top of the Project details fake (tests/project-details/dbp.js —
// untouched; it holds project_events). Rules mirror the SQL triggers ps_rules / ps_log / sr_rules / sp_rules and the
// functions seq_move / seq_insert / seq_match / seq_unmatch / seq_remove / seq_restore line by line
// (tests/seq/pg-check.sql checks the real SQL). Never touches the network.
const D3 = require('../stage3/db3.js');
const { DbError, clone, find } = D3;
const TABLES = ['project_seq', 'seq_requests', 'seq_pre'];
const now = () => new Date().toISOString();
// seq_txt(): NFKC, whitespace collapsed, trimmed, '' → null
const txt = v => { const s = String(v == null ? '' : v).normalize('NFKC').replace(/\s+/g, ' ').trim(); return s || null; };
const lineKey = (f, u, p, n) => (txt(p) == null && txt(n) == null) ? null : [f, u, p, n].map(x => txt(x) || '').join('|').toUpperCase();
function ensure(d) { TABLES.forEach(x => { if (!d.t[x]) d.t[x] = []; }); if (!d.t.project_events) d.t.project_events = []; if (!d.seq.project_events) d.seq.project_events = 1; }
const live = r => r.state !== 'removed';
const ev = (d, project_id, entity, entity_id, act, old, nw, by) => d.t.project_events.push({ id: d.seq.project_events++, project_id, entity, entity_id, act, old, new: nw, by: by || '?', at: now() });
const SEQ_COLS = ['id', 'project_id', 'pos', 'state', 'wo', 'floor', 'unit', 'product', 'name', 'descr', 'kind', 'children', 'line_key', 'req_date', 'own_date', 'is_new', 'src', 'upload_id', 'line_no',
  'matched_at', 'matched_by', 'match_how', 'why', 'version', 'created_at', 'created_by', 'updated_at', 'updated_by'];
function seqCheck(d, n, self) {
  if (!['waiting', 'matched', 'removed'].includes(n.state)) throw new DbError('new row violates check constraint "project_seq_state_check"', '23514');
  if (!['kitchen', 'utility', 'quartz', 'robes', 'other'].includes(n.kind)) throw new DbError('new row violates check constraint "project_seq_kind_check"', '23514');
  if (n.src != null && !['upload', 'import', 'manual', 'start'].includes(n.src)) throw new DbError('new row violates check constraint "project_seq_src_check"', '23514');
  if (n.match_how != null && !['auto', 'confirmed', 'start', 'import'].includes(n.match_how)) throw new DbError('new row violates check constraint "project_seq_match_how_check"', '23514');
  if (n.req_date != null && (n.req_date === '' || isNaN(Date.parse(n.req_date)))) throw new DbError('invalid input syntax for type date: "' + n.req_date + '"', '22007');
  if (!find(d, 'projects', n.project_id)) throw new DbError('insert or update on table "project_seq" violates foreign key constraint', '23503');
  if (live(n) && n.wo != null && d.t.project_seq.some(x => x !== self && x.id !== n.id && live(x) && x.wo != null && x.wo.toUpperCase() === n.wo.toUpperCase())) throw new DbError('duplicate key value violates unique constraint "ps_wo_uq"', '23505');
  // (Garry 10 Nov) no unique "same line" index any more: two identical lines in one house are two rows (seq_insert counts)
}
function tidy(n) { n.wo = n.wo == null ? null : (txt(n.wo) || '').toUpperCase() || null; ['floor', 'unit', 'product', 'name', 'descr', 'why'].forEach(k => { n[k] = txt(n[k]); }); n.line_key = lineKey(n.floor, n.unit, n.product, n.name); }
// ps_log (AFTER) — the database writes the history, never the app
function seqLog(d, n, old) {
  let a;
  if (!old) a = 'add';
  else if (n.state === 'removed' && old.state !== 'removed') a = 'remove';
  else if (old.state === 'removed' && n.state !== 'removed') a = 'restore';
  else if (n.wo != null && old.wo == null) a = 'match';
  else if (n.wo == null && old.wo != null) a = 'unmatch';
  else if ((n.req_date || null) !== (old.req_date || null)) a = 'date';
  else if (JSON.stringify([n.floor, n.unit, n.product, n.name, n.descr, n.kind, n.own_date, n.children]) !== JSON.stringify([old.floor, old.unit, old.product, old.name, old.descr, old.kind, old.own_date, old.children])) a = 'edit';
  else return;
  const pick = r => ({ wo: r.wo, state: r.state, req_date: r.req_date, pos: r.pos, floor: r.floor, unit: r.unit, product: r.product, name: r.name });
  ev(d, n.project_id, 'seq', n.id, a, old ? pick(old) : null, Object.assign(pick(n), { why: n.why, how: n.match_how }), n.updated_by || n.created_by);
}
function seqInsert(d, r) {
  ensure(d);
  if (r.id == null || r.id === '') throw new DbError('null value in column "id"', '23502');
  Object.keys(r).forEach(k => { if (!SEQ_COLS.includes(k)) throw new DbError('Could not find the \'' + k + '\' column of \'project_seq\' in the schema cache', 'PGRST204'); });
  if (d.t.project_seq.some(x => x.id === r.id)) throw new DbError('duplicate key value violates unique constraint "project_seq_pkey"', '23505');
  const n = Object.assign({ pos: 0, state: 'waiting', wo: null, floor: null, unit: null, product: null, name: null, descr: null, kind: 'kitchen', children: [], req_date: null, own_date: false, is_new: false, src: null,
    upload_id: null, line_no: null, matched_at: null, matched_by: null, match_how: null, why: null, version: 1, created_by: null, updated_by: null }, clone(r));
  tidy(n);
  if (n.state === 'removed') throw new DbError('seq: a new row cannot be removed', 'P0001');
  n.pos = d.t.project_seq.filter(x => x.project_id === n.project_id && live(x)).reduce((m, x) => Math.max(m, x.pos), 0) + 1;
  n.state = n.wo != null ? 'matched' : 'waiting';
  if (n.wo != null) { n.matched_at = n.matched_at || now(); n.matched_by = n.matched_by || n.created_by || n.updated_by; }
  n.created_at = now(); n.created_by = n.created_by || n.updated_by; n.updated_at = now();
  seqCheck(d, n, null);
  d.t.project_seq.push(n); seqLog(d, n, null); return n;
}
function seqUpdate(d, row, patch, rpc) {
  Object.keys(patch).forEach(k => { if (!SEQ_COLS.includes(k)) throw new DbError('Could not find the \'' + k + '\' column of \'project_seq\' in the schema cache', 'PGRST204'); });
  const old = clone(row), n = Object.assign(clone(row), clone(patch));
  tidy(n);
  if (n.project_id !== old.project_id) throw new DbError('seq: a row cannot change project', 'P0001');
  if (!rpc) {
    if (n.pos !== old.pos) throw new DbError('seq: use seq_move to change the order', 'P0001');
    if (n.state !== old.state) throw new DbError('seq: use seq_match / seq_unmatch / seq_remove / seq_restore', 'P0001');
    if ((n.wo || null) !== (old.wo || null)) throw new DbError('seq: use seq_match to set a WO number', 'P0001');
    ['matched_at', 'matched_by', 'match_how', 'created_at', 'created_by'].forEach(k => { n[k] = old[k]; });
  }
  if (n.state === 'removed' && old.state === 'removed' && (n.req_date || null) !== (old.req_date || null)) throw new DbError('seq: row is removed', 'P0001');
  n.version = old.version + 1; n.updated_at = now(); // project_seq_touch (lists_touch)
  seqCheck(d, n, row);
  Object.keys(row).forEach(k => delete row[k]); Object.assign(row, n); seqLog(d, row, old); return row;
}
function writable(d) { return ['v2', 'migrating'].includes(d.listStore); }
function needOn(d) { if (!writable(d)) throw new DbError('seq: lists are not switched on', 'P0001'); }
const liveOf = (d, pj) => d.t.project_seq.filter(x => x.project_id === pj && live(x)).sort((a, b) => a.pos - b.pos || String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id)));
function renumber(d, pj, order) { order.forEach((id, i) => { const r = find(d, 'project_seq', id); if (r && r.project_id === pj && r.pos !== i + 1) seqUpdate(d, r, { pos: i + 1 }, true); }); }
const RPC = {
  seq_move(d, a) {
    needOn(d);
    const ids = a.p_ids || [];
    if (!ids.length) return { ok: false, err: 'nothing to move' };
    const f = find(d, 'project_seq', ids[0]); if (!f) return { ok: false, err: 'not found' };
    const pj = f.project_id;
    if (d.t.project_seq.filter(x => ids.includes(x.id) && x.project_id === pj && live(x)).length !== ids.length) return { ok: false, err: 'rows not in one project' };
    if (a.p_expect != null) for (let i = 0; i < ids.length; i++) { const r = find(d, 'project_seq', ids[i]); if (!r || r.version !== a.p_expect[i]) return { ok: false, err: 'stale' }; }
    if (a.p_after != null && (ids.includes(a.p_after) || !d.t.project_seq.some(x => x.id === a.p_after && x.project_id === pj && live(x)))) return { ok: false, err: 'bad anchor' };
    if (a.p_after != null && a.p_after_ver != null && find(d, 'project_seq', a.p_after).version !== a.p_after_ver) return { ok: false, err: 'stale' }; // the anchor changed since the screen read it
    const before = {}; liveOf(d, pj).forEach(x => { before[x.id] = x.pos; });
    const rest = liveOf(d, pj).filter(x => !ids.includes(x.id)).map(x => x.id);
    let ord;
    if (a.p_after == null) ord = ids.concat(rest);
    else { ord = []; rest.forEach(x => { ord.push(x); if (x === a.p_after) ord.push(...ids); }); }
    renumber(d, pj, ord);
    ids.forEach(id => { const r = find(d, 'project_seq', id); seqUpdate(d, r, { is_new: false, updated_by: a.p_by || r.updated_by }, true); });
    const moved = [];
    d.t.project_seq.filter(x => ids.includes(x.id)).forEach(r => {
      if (before[r.id] !== r.pos) { ev(d, pj, 'seq', r.id, 'move', { pos: before[r.id] }, { pos: r.pos, why: a.p_why == null ? null : a.p_why }, a.p_by); moved.push({ id: r.id, from: before[r.id], to: r.pos }); }
    });
    return { ok: true, moved };
  },
  seq_insert(d, a) {
    needOn(d);
    if (!find(d, 'projects', a.p_project)) return { ok: false, err: 'no project' };
    const added = [], skipped = [], seen = {};
    for (const e of a.p_rows || []) {
      const k = lineKey(e.floor, e.unit, e.product, e.name), w = e.wo == null ? null : ((txt(e.wo) || '').toUpperCase() || null);
      let ex = null;
      if (k != null) { // the c-th line with this key is skipped only if the project already had c or more such live rows
        const c = seen[k] = (seen[k] || 0) + 1;
        const had = liveOf(d, a.p_project).filter(x => x.line_key === k && !added.includes(x.id));
        if (had.length >= c) ex = had[c - 1];
      }
      if (ex) { skipped.push({ line_no: e.line_no == null ? null : e.line_no, line_key: k, existing_id: ex.id, why: 'already in the sequence' }); continue; }
      ex = w != null ? d.t.project_seq.find(x => x.wo != null && x.wo.toUpperCase() === w && live(x)) : null;
      if (ex) { skipped.push({ line_no: e.line_no == null ? null : e.line_no, wo: w, existing_id: ex.id, why: 'WO already in a sequence' }); continue; }
      if (find(d, 'project_seq', e.id)) { skipped.push({ line_no: e.line_no == null ? null : e.line_no, existing_id: e.id, why: 'already saved' }); continue; }
      seqInsert(d, { id: e.id, project_id: a.p_project, wo: w, floor: e.floor, unit: e.unit, product: e.product, name: e.name, descr: e.descr, kind: e.kind || 'kitchen', children: e.children || [],
        req_date: e.req_date || null, own_date: !!e.own_date, is_new: !!e.is_new, src: e.src || 'manual', upload_id: e.upload_id || null, line_no: e.line_no == null ? null : +e.line_no,
        match_how: w != null ? (e.match_how || 'import') : null, why: e.why || null, created_by: a.p_by, updated_by: a.p_by });
      added.push(e.id);
    }
    if (a.p_after != null && added.length && d.t.project_seq.some(x => x.id === a.p_after && x.project_id === a.p_project && live(x)) && !added.includes(a.p_after)) {
      const ord = []; liveOf(d, a.p_project).filter(x => !added.includes(x.id)).forEach(x => { ord.push(x.id); if (x.id === a.p_after) ord.push(...added); });
      renumber(d, a.p_project, ord);
    }
    return { ok: true, added, skipped };
  },
  seq_match(d, a) {
    needOn(d);
    const r = find(d, 'project_seq', a.p_id); if (!r) return { ok: false, err: 'not found' };
    if (r.state !== 'waiting') return { ok: false, err: 'not waiting', wo: r.wo };
    if (a.p_expect != null && r.version !== a.p_expect) return { ok: false, err: 'stale' };
    const w = a.p_wo == null ? null : ((txt(a.p_wo) || '').toUpperCase() || null); if (!w) return { ok: false, err: 'no WO' };
    const o = d.t.project_seq.find(x => x.wo != null && x.wo.toUpperCase() === w && live(x)); if (o) return { ok: false, err: 'WO already in a sequence', existing_id: o.id };
    seqUpdate(d, r, { wo: w, state: 'matched', matched_at: now(), matched_by: a.p_by, match_how: ['auto', 'confirmed', 'start', 'import'].includes(a.p_how) ? a.p_how : 'confirmed', is_new: false, updated_by: a.p_by, why: null }, true);
    return { ok: true };
  },
  seq_unmatch(d, a) {
    needOn(d);
    if (txt(a.p_why) == null) return { ok: false, err: 'reason needed' };
    const r = find(d, 'project_seq', a.p_id); if (!r || r.state !== 'matched') return { ok: false, err: 'not matched' };
    if (a.p_expect != null && r.version !== a.p_expect) return { ok: false, err: 'stale' };
    seqUpdate(d, r, { wo: null, state: 'waiting', matched_at: null, matched_by: null, match_how: null, updated_by: a.p_by, why: a.p_why }, true);
    return { ok: true };
  },
  seq_remove(d, a) {
    needOn(d);
    if (txt(a.p_why) == null) return { ok: false, err: 'reason needed' };
    const r = find(d, 'project_seq', a.p_id); if (!r || r.state === 'removed') return { ok: false, err: 'not live' };
    if (a.p_expect != null && r.version !== a.p_expect) return { ok: false, err: 'stale' };
    seqUpdate(d, r, { state: 'removed', updated_by: a.p_by, why: a.p_why }, true);
    renumber(d, r.project_id, liveOf(d, r.project_id).map(x => x.id));
    return { ok: true };
  },
  seq_restore(d, a) {
    needOn(d);
    const r = find(d, 'project_seq', a.p_id); if (!r || r.state !== 'removed') return { ok: false, err: 'not removed' };
    if (a.p_expect != null && r.version !== a.p_expect) return { ok: false, err: 'stale' };
    if (r.wo != null && d.t.project_seq.some(x => x.wo != null && x.wo.toUpperCase() === r.wo.toUpperCase() && live(x))) return { ok: false, err: 'WO already in a sequence' };
    const np = liveOf(d, r.project_id).reduce((m, x) => Math.max(m, x.pos), 0) + 1;
    seqUpdate(d, r, { state: r.wo != null ? 'matched' : 'waiting', pos: np, updated_by: a.p_by, why: a.p_why == null ? null : a.p_why }, true);
    return { ok: true, pos: np };
  },
};
// seq_requests: sr_rules (insert open / direct only, reason needed, no second open request for the same rows; never rewritten)
function reqInsert(d, r) {
  ensure(d);
  const n = Object.assign({ wos: [], preview: null, note: null, status: 'open', decided_by: null, decided_at: null, answer: null, applied: null, applied_at: null, seen_at: null, version: 1, updated_by: null }, clone(r));
  if (d.t.seq_requests.some(x => x.id === n.id)) throw new DbError('duplicate key value violates unique constraint "seq_requests_pkey"', '23505');
  if (!['date', 'move'].includes(n.kind)) throw new DbError('new row violates check constraint', '23514');
  if (!['open', 'direct'].includes(n.status)) throw new DbError('req: a new request is open (or a direct change)', 'P0001');
  if (txt(n.why) == null) throw new DbError('req: reason needed', 'P0001');
  if (txt(n.asked_by) == null) throw new DbError('req: who is asking', 'P0001');
  if (!(n.seq_ids || []).length) throw new DbError('req: no rows', 'P0001');
  n.asked_at = now(); n.updated_at = now();
  if (n.status === 'direct') { n.decided_by = n.asked_by; n.decided_at = now(); }
  else if (d.t.seq_requests.some(x => x.status === 'open' && x.project_id === n.project_id && x.seq_ids.some(i => n.seq_ids.includes(i)))) throw new DbError('req: open request exists for one of these rows', 'P0001');
  d.t.seq_requests.push(n); ev(d, n.project_id, 'req', n.id, n.status === 'direct' ? 'direct' : 'ask', null, { status: n.status, kind: n.kind, wos: n.wos, change: n.change, why: n.why, answer: n.answer }, n.asked_by); return n;
}
function reqUpdate(d, row, patch) {
  const old = clone(row), n = Object.assign(clone(row), clone(patch));
  if (['id', 'project_id', 'kind', 'seq_ids', 'change', 'why', 'asked_by', 'asked_at'].some(k => JSON.stringify(n[k]) !== JSON.stringify(old[k]))) throw new DbError('req: a request cannot be rewritten (withdraw it and ask again)', 'P0001');
  if (old.status === 'open') {
    if (!['open', 'approved', 'refused', 'withdrawn'].includes(n.status)) throw new DbError('req: bad status', 'P0001');
    if (n.status !== 'open') {
      if (txt(n.decided_by) == null) throw new DbError('req: who decided', 'P0001');
      if (n.status === 'refused' && txt(n.answer) == null) throw new DbError('req: a refusal needs a reason', 'P0001');
      n.decided_at = now();
    } else { n.decided_by = null; n.decided_at = null; n.answer = null; }
    if (n.status !== 'approved') { n.applied = null; n.applied_at = null; } else if (n.applied != null) n.applied_at = now();
  } else {
    if (n.status !== old.status || n.decided_by !== old.decided_by || n.answer !== old.answer) throw new DbError('req: already decided by ' + old.decided_by, 'P0001');
    n.decided_at = old.decided_at;
    if (old.applied != null) { n.applied = old.applied; n.applied_at = old.applied_at; }
    else if (n.applied != null) { if (!['approved', 'direct'].includes(old.status)) throw new DbError('req: only an approved request is applied', 'P0001'); n.applied_at = now(); }
  }
  n.version = old.version + 1; n.updated_at = now();
  Object.keys(row).forEach(k => delete row[k]); Object.assign(row, n);
  if (n.status !== old.status) ev(d, n.project_id, 'req', n.id, n.status, { status: old.status }, { status: n.status, why: n.why, answer: n.answer }, n.decided_by || n.updated_by);
  else if (n.applied != null && old.applied == null) ev(d, n.project_id, 'req', n.id, 'applied', { status: old.status }, { status: n.status }, n.decided_by || n.updated_by);
  return row;
}
// seq_pre: sp_rules (stamp / clear processed_at; the sheet never clears a hand tick)
function preWrite(d, row, patch) {
  ensure(d);
  const old = row ? clone(row) : null;
  const n = Object.assign(old ? clone(row) : { wo: null, pre_key: null, processed: false, processed_at: null, processed_by: null, processed_src: null, note: null, version: 1, updated_by: null }, clone(patch));
  if (!find(d, 'project_seq', n.seq_id)) throw new DbError('insert or update on table "seq_pre" violates foreign key constraint', '23503');
  if (old && old.processed && !n.processed && (n.processed_src || '') === 'sheet' && old.processed_src === 'tick') { n.processed = true; n.processed_src = old.processed_src; n.processed_at = old.processed_at; n.processed_by = old.processed_by; }
  if (n.processed) {
    if (!old || !old.processed) { n.processed_at = now(); n.processed_by = txt(n.processed_by) || n.updated_by || '?'; n.processed_src = n.processed_src || 'tick'; }
    else { n.processed_at = old.processed_at; n.processed_by = old.processed_by; n.processed_src = old.processed_src; }
  } else { n.processed_at = null; n.processed_by = null; n.processed_src = null; }
  if (old) { n.version = old.version + 1; } n.updated_at = now();
  if (row) { Object.keys(row).forEach(k => delete row[k]); Object.assign(row, n); } else { if (d.t.seq_pre.some(x => x.seq_id === n.seq_id)) throw new DbError('duplicate key value violates unique constraint "seq_pre_pkey"', '23505'); d.t.seq_pre.push(n); row = n; }
  if ((!old && n.processed) || (old && n.processed !== old.processed)) { const s = find(d, 'project_seq', n.seq_id); ev(d, s && s.project_id, 'pre', n.seq_id, n.processed ? 'processed' : 'unprocessed', null, { wo: n.wo, src: n.processed_src }, n.updated_by); }
  return row;
}
module.exports = { TABLES, ensure, txt, lineKey, seqInsert, seqUpdate, RPC, reqInsert, reqUpdate, preWrite, liveOf };
