// Stage 3 fake Supabase: the stage 1 fake (planner record + backups, tests/stage1/srv.js — untouched) plus the new
// tables and /rpc/ functions (rules in db3.js). Speaks just enough PostgREST for the app. Never touches the network.
const S1 = require('../stage1/srv.js');
const D = require('./db3.js');
const H = S1.H;
function makeServer(row, opts = {}) { const S = S1.makeServer(row, opts); S.db = D.makeDb(); S.rpcCalls = []; return S; }

function parseQ(url) {
  const u = new URL(url), q = [];
  u.searchParams.forEach((v, k) => q.push([k, v]));
  return q;
}
function val(x) { return x === 'null' ? null : x; }
function match(r, k, f) {
  const i = f.indexOf('.'); const op = f.slice(0, i), v = f.slice(i + 1), x = r[k];
  const s = y => y === null || y === undefined ? null : typeof y === 'boolean' ? String(y) : String(y);
  if (op === 'eq') return s(x) === v;
  if (op === 'neq') return s(x) !== v;
  if (op === 'gt') return x != null && String(x) > v;
  if (op === 'gte') return x != null && String(x) >= v;
  if (op === 'lt') return x != null && String(x) < v;
  if (op === 'is') return v === 'null' ? x == null : s(x) === v;
  if (op === 'in') { const a = v.replace(/^\(|\)$/g, '').split(',').map(z => z.replace(/^"|"$/g, '')); return a.includes(s(x)); }
  if (op === 'cs') { const a = v.replace(/^\{|\}$/g, '').split(',').filter(Boolean); return Array.isArray(x) && a.every(z => x.includes(z)); }
  if (op === 'like') { const re = new RegExp('^' + v.split('*').map(z => z.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$'); return x != null && re.test(String(x)); }
  if (op === 'not') return !match(r, k, v);
  throw new Error('fake server: unsupported filter ' + f);
}
const MAX_ROWS = 1000;
const SPECIAL = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
function select(rows, q) {
  q.forEach(([k, f]) => { if (!SPECIAL.has(k)) rows = rows.filter(r => match(r, k, f)); });
  const o = q.find(([k]) => k === 'order');
  if (o) { const ks = o[1].split(',').map(s => s.split('.')); rows = rows.slice().sort((a, b) => { for (const [c, dir] of ks) { const r = (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * (dir === 'desc' ? -1 : 1); if (r) return r; } return 0; }); } // several columns, asc by default
  const off = q.find(([k]) => k === 'offset'); if (off) rows = rows.slice(+off[1]);
  const lim = q.find(([k]) => k === 'limit'); if (lim) rows = rows.slice(0, +lim[1]);
  return rows.slice(0, MAX_ROWS); // Supabase's API "Max rows" (1,000 by default): a bigger answer is cut short
}
const J = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const ERR = (route, e) => J(route, e.code === '23505' ? 409 : 400, { code: e.code || 'P0001', message: e.message, details: null, hint: null });

async function handle(S, route) {
  const req = route.request(), url = req.url(), m = req.method();
  const path = url.replace(/^.*rest\/v1/, '');
  const tm = /^\/([a-z_]+)(\?|$)/.exec(path);
  const rpc = /^\/rpc\/([a-z_]+)/.exec(path);
  if (!rpc && !(tm && D.TABLES.includes(tm[1]))) {
    // production_planner_keep_switch trigger (SUPABASE_CHANGES.md): a save that leaves out settings.listStore keeps the stored one
    if (m === 'PATCH' && /\/production_planner/.test(path) && S.row && S.row.settings && S.row.settings.listStore) {
      let b = null; try { b = JSON.parse(req.postData() || '{}'); } catch (e) {}
      if (b && (!b.settings || !('listStore' in b.settings)) && 'settings' in b) {
        b.settings = Object.assign({}, b.settings || {}, { listStore: S.row.settings.listStore }, 'listStoreAt' in S.row.settings ? { listStoreAt: S.row.settings.listStoreAt } : {});
        S.keptSwitch = (S.keptSwitch || 0) + 1;
        return route.fallback({ postData: JSON.stringify(b) });
      }
    }
    return route.fallback();
  }
  S.log.push(m + ' ' + path);
  if (S.offline || S.offline3) return route.abort('internetdisconnected');
  if (S.hold3) await S.hold3; // a test can pause the new-table traffic
  if (S.fail3) return J(route, 503, { message: 'down' });
  const pre = (req.headers()['prefer'] || '');
  try {
    if (rpc) {
      const f = D.RPC[rpc[1]]; if (!f) return J(route, 404, { code: 'PGRST202', message: 'Could not find the function ' + rpc[1] });
      // lists_switch_on(): every list function refuses while the planner record says the lists are not switched on
      if (S.row && (!S.row.settings || S.row.settings.listStore !== 'v2') && !S.noSwitchCheck) return J(route, 400, { code: 'P0001', message: 'switched off: the cutting lists are on the old store' });
      const args = JSON.parse(req.postData() || '{}');
      S.rpcCalls.push({ fn: rpc[1], args });
      const out = f(S.db, args);
      if (S.dropReply && S.dropReply-- > 0) return route.abort('connectionreset'); // it landed, the reply is lost
      return J(route, 200, out);
    }
    const t = tm[1], q = parseQ(url), rows = S.db.t[t];
    if (m === 'GET') return J(route, 200, select(rows, q));
    if (m === 'POST') {
      let b = JSON.parse(req.postData() || '[]'); if (!Array.isArray(b)) b = [b];
      if (S.onPost) b = S.onPost(t, b) || b; // a test can lose or change rows on the way in
      const up = /merge-duplicates/.test(pre), out = [];
      b.forEach(r => { const ex = up && r.id != null ? D.find(S.db, t, r.id) : null; out.push(ex ? D.update(S.db, t, ex, r) : D.insert(S.db, t, r)); });
      if (S.dropReply && S.dropReply-- > 0) return route.abort('connectionreset');
      return /return=representation/.test(pre) ? J(route, 201, out) : route.fulfill({ status: 201, body: '' });
    }
    if (m === 'PATCH') {
      const b = JSON.parse(req.postData() || '{}');
      const hit = select(rows, q.filter(([k]) => !['order', 'limit'].includes(k)));
      hit.forEach(r => D.update(S.db, t, r, b));
      return /return=representation/.test(pre) ? J(route, 200, hit) : route.fulfill({ status: 204, body: '' });
    }
    if (m === 'DELETE') { S.deletes3 = (S.deletes3 || 0) + 1; return J(route, 403, { code: '42501', message: 'permission denied for table ' + t }); } // no DELETE grant
  } catch (e) { return ERR(route, e); }
  return J(route, 405, { message: 'method' });
}
async function attach(t, S) {
  await S1.attach(t, S);
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
const newTableCalls = S => S.log.filter(x => /^\w+ \/(projects|project_materials|lists|list_lines|list_revisions|list_events|snags|rpc\/)/.test(x));
module.exports = { H, D, makeServer, attach, open, handle, newTableCalls };
