// PM sequence fake Supabase: the Project details fake (tests/project-details/srvp.js — untouched, which carries the Stores
// dockets + Stage 3 fakes) plus project_seq / seq_requests / seq_pre (read / add / change, never delete) and /rpc/seq_*
// (rules in dbs.js). S.noSeqTables = true answers like Supabase before the "PM sequence" SQL is run. Also the
// projects_pm_log trigger (a change of projects.pm → project_events). Never touches the network.
const SP = require('../project-details/srvp.js');
const DS = require('./dbs.js');
const D3 = require('../stage3/db3.js');
const { H, D, DD, DP } = SP;
// projects_pm_log: wrap the Stage 3 fake's insert / update (srv3 calls D.insert / D.update) — projects.pms text[] (default '{}')
// and the history row when the list of PMs changes (act 'pm', old/new {pms:[…]}). The old single `pm` column is not logged.
if (!D3.__seqWrapped) {
  const origU = D3.update, origI = D3.insert; D3.__seqWrapped = true;
  const arr = v => { if (v != null && (!Array.isArray(v) || v.some(x => typeof x !== 'string'))) throw new D3.DbError('malformed array literal: "' + JSON.stringify(v) + '"', '22P02'); };
  D3.insert = function (d, t, r) { if (t === 'projects') { arr(r.pms); r = Object.assign({ pms: [] }, r, r.pms == null ? { pms: [] } : {}); } return origI.call(this, d, t, r); };
  D3.update = function (d, t, row, patch) {
    if (t === 'projects' && 'pms' in patch) { arr(patch.pms); if (patch.pms == null) throw new D3.DbError('null value in column "pms" violates not-null constraint', '23502'); }
    const old = t === 'projects' ? JSON.stringify(row.pms || []) : null;
    const r = origU.apply(this, arguments);
    if (old != null && d.t.project_events && JSON.stringify(r.pms || []) !== old)
      d.t.project_events.push({ id: d.seq.project_events++, project_id: r.id, entity: 'project', entity_id: r.id, act: 'pm', old: { pms: JSON.parse(old) }, new: { pms: (r.pms || []).slice() }, by: r.updated_by || '?', at: new Date().toISOString() });
    return r;
  };
}
function makeServer(row, opts = {}) { const S = SP.makeServer(row, opts); DS.ensure(S.db); return S; }
function match(r, k, f) {
  const i = f.indexOf('.'); const op = f.slice(0, i), v = f.slice(i + 1), x = r[k];
  const s = y => y === null || y === undefined ? null : String(y);
  if (op === 'eq') return s(x) === v;
  if (op === 'neq') return s(x) !== v;
  if (op === 'gt') return x != null && String(x) > v;
  if (op === 'gte') return x != null && String(x) >= v;
  if (op === 'lt') return x != null && String(x) < v;
  if (op === 'lte') return x != null && String(x) <= v;
  if (op === 'is') return v === 'null' ? x == null : s(x) === v;
  if (op === 'in') { const a = v.replace(/^\(|\)$/g, '').split(',').map(z => z.replace(/^"|"$/g, '')); return a.includes(s(x)); }
  throw new Error('fake server: unsupported filter ' + f);
}
const SPECIAL = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
function select(rows, url) {
  const u = new URL(url), q = []; u.searchParams.forEach((v, k) => q.push([k, v]));
  if (q.some(([k, v]) => k === 'order' && /(^|,)id(\.|,|$)/.test(v)) && rows.length && !('id' in rows[0])) throw Object.assign(new Error('column ' + 'id does not exist'), { code: '42703' });
  q.forEach(([k, f]) => { if (!SPECIAL.has(k)) rows = rows.filter(r => match(r, k, f)); });
  const o = q.find(([k]) => k === 'order');
  if (o) { const ks = o[1].split(',').map(s => s.split('.')); rows = rows.slice().sort((a, b) => { for (const [c, dir] of ks) { const r = (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * (dir === 'desc' ? -1 : 1); if (r) return r; } return 0; }); }
  const off = q.find(([k]) => k === 'offset'); if (off) rows = rows.slice(+off[1]);
  const lim = q.find(([k]) => k === 'limit'); if (lim) rows = rows.slice(0, +lim[1]);
  return JSON.parse(JSON.stringify(rows.slice(0, 1000)));
}
const J = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const SEQ_RPC = /^\/rpc\/(seq_[a-z_]+)/;
async function handle(S, route) {
  const req = route.request(), url = req.url(), m = req.method();
  const path = url.replace(/^.*rest\/v1/, '');
  const tm = /^\/([a-z_]+)(\?|$)/.exec(path), rpc = SEQ_RPC.exec(path);
  if (!rpc && !(tm && DS.TABLES.includes(tm[1]))) return route.fallback();
  S.log.push(m + ' ' + path);
  if (S.offline || S.offline3 || S.offlineS) return route.abort('internetdisconnected');
  if (S.noSeqTables) return J(route, 404, { code: rpc ? 'PGRST202' : '42P01', message: rpc ? 'Could not find the function ' + rpc[1] : 'relation "public.' + tm[1] + '" does not exist' });
  if (S.holdS) await S.holdS;
  const pre = req.headers()['prefer'] || '';
  S.db.listStore = S.row && S.row.settings ? S.row.settings.listStore || 'v1' : 'v1'; // lists_writable() reads the planner record
  try {
    if (rpc) {
      const f = DS.RPC[rpc[1]]; if (!f) return J(route, 404, { code: 'PGRST202', message: 'Could not find the function ' + rpc[1] });
      const args = JSON.parse(req.postData() || '{}');
      (S.rpcCalls = S.rpcCalls || []).push({ fn: rpc[1], args });
      if (S.beforeRpc) S.beforeRpc(rpc[1], args); // a test can let "another PC" act just before this call lands
      const out = f(S.db, args);
      if (S.dropReplyS && S.dropReplyS-- > 0) return route.abort('connectionreset');
      return J(route, 200, out);
    }
    const t = tm[1];
    if (m === 'GET') return J(route, 200, select(S.db.t[t], url));
    if (m === 'DELETE') { S.deniedS = (S.deniedS || 0) + 1; return J(route, 403, { code: '42501', message: 'permission denied for table ' + t }); }
    if (!['v2', 'migrating'].includes(S.db.listStore)) return J(route, 403, { code: '42501', message: 'new row violates row-level security policy for table "' + t + '"' });
    if (m === 'POST') {
      let b = JSON.parse(req.postData() || '[]'); if (!Array.isArray(b)) b = [b];
      const out = b.map(r => t === 'project_seq' ? DS.seqInsert(S.db, r) : t === 'seq_requests' ? DS.reqInsert(S.db, r) : DS.preWrite(S.db, null, r));
      return /return=representation/.test(pre) ? J(route, 201, out) : route.fulfill({ status: 201, body: '' });
    }
    if (m === 'PATCH') {
      const b = JSON.parse(req.postData() || '{}');
      const u = new URL(url); const hit = S.db.t[t].filter(r => { let ok = true; u.searchParams.forEach((v, k) => { if (!SPECIAL.has(k) && !match(r, k, v)) ok = false; }); return ok; });
      hit.forEach(r => t === 'project_seq' ? DS.seqUpdate(S.db, r, b, false) : t === 'seq_requests' ? DS.reqUpdate(S.db, r, b) : DS.preWrite(S.db, r, b));
      return /return=representation/.test(pre) ? J(route, 200, JSON.parse(JSON.stringify(hit))) : route.fulfill({ status: 204, body: '' });
    }
  } catch (e) { return J(route, e.code === '23505' ? 409 : 400, { code: e.code || 'P0001', message: e.message, details: null, hint: null }); }
  return J(route, 405, { message: 'method' });
}
async function attach(t, S) {
  await SP.attach(t, S);
  await t.page.route('**/*', route => { const u = route.request().url(); if (!u.includes('supabase.co')) return route.fallback(); return handle(S, route); });
}
async function open(browser, S, opts = {}) {
  const t = await H.open({ browser, now: opts.now, row: S.row || { id: 'main', orders: [], nid: 1, settings: {} }, viewport: opts.viewport });
  t.page.on('pageerror', e => (S.errors = S.errors || []).push(String(e)));
  await attach(t, S);
  await t.page.evaluate(() => loadDB());
  if (opts.role) await t.page.evaluate(r => { localStorage.setItem('wpfPin_' + r, '9000'); setRole(r); }, opts.role);
  return t;
}
const seqCalls = S => S.log.filter(x => /^\w+ \/(project_seq|seq_requests|seq_pre|rpc\/seq_)/.test(x));
module.exports = { H, D, DD, DP, DS, makeServer, attach, open, handle, seqCalls };
