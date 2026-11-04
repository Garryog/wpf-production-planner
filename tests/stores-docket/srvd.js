// Stores dockets fake Supabase: the Stage 3 fake (tests/stage3/srv3.js — untouched) plus the two docket tables
// (READ only for the app — writes only through the functions) and /rpc/make_docket, docket_delivered, docket_cancel
// (rules in dbd.js). Speaks just enough PostgREST for the app. Never touches the network.
const S3 = require('../stage3/srv3.js');
const DD = require('./dbd.js');
const { H, D } = S3;
function makeServer(row, opts = {}) { const S = S3.makeServer(row, opts); S.db = DD.makeDb(); return S; }
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
  if (op === 'not') return !match(r, k, v);
  throw new Error('fake server: unsupported filter ' + f);
}
const SPECIAL = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns', 'and']);
function select(rows, url) {
  const u = new URL(url), q = []; u.searchParams.forEach((v, k) => q.push([k, v]));
  q.forEach(([k, f]) => { if (!SPECIAL.has(k)) rows = rows.filter(r => match(r, k, f)); });
  const and = q.find(([k]) => k === 'and'); // and=(made_at.gte.X,made_at.lt.Y)
  if (and) and[1].replace(/^\(|\)$/g, '').split(',').forEach(c => { const j = c.indexOf('.'); const col = c.slice(0, j); rows = rows.filter(r => match(r, col, c.slice(j + 1))); });
  const o = q.find(([k]) => k === 'order');
  if (o) { const ks = o[1].split(',').map(s => s.split('.')); rows = rows.slice().sort((a, b) => { for (const [c, dir] of ks) { const r = (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * (dir === 'desc' ? -1 : 1); if (r) return r; } return 0; }); }
  const off = q.find(([k]) => k === 'offset'); if (off) rows = rows.slice(+off[1]);
  const lim = q.find(([k]) => k === 'limit'); if (lim) rows = rows.slice(0, +lim[1]);
  return rows.slice(0, 1000);
}
const J = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
async function handle(S, route) {
  const req = route.request(), url = req.url(), m = req.method();
  const path = url.replace(/^.*rest\/v1/, '');
  const tm = /^\/([a-z_]+)(\?|$)/.exec(path), rpc = /^\/rpc\/([a-z_]+)/.exec(path);
  const mine = (rpc && DD.RPC[rpc[1]]) || (tm && DD.TABLES.includes(tm[1]));
  if (!mine) return route.fallback();
  S.log.push(m + ' ' + path);
  if (S.offline || S.offline3 || S.offlineD) return route.abort('internetdisconnected');
  if (S.noDocketTables) return J(route, 404, { code: rpc ? 'PGRST202' : '42P01', message: rpc ? 'Could not find the function ' + rpc[1] : 'relation "' + tm[1] + '" does not exist' });
  if (S.holdD) await S.holdD;
  try {
    if (rpc) {
      const args = JSON.parse(req.postData() || '{}');
      (S.rpcCalls = S.rpcCalls || []).push({ fn: rpc[1], args });
      S.db.listStore = S.row && S.row.settings ? S.row.settings.listStore || 'v1' : 'v1'; // lists_switch_on() reads the planner record
      const out = DD.RPC[rpc[1]](S.db, args);
      if (S.dropReply && S.dropReply-- > 0) return route.abort('connectionreset'); // it landed, the reply is lost
      return J(route, 200, out);
    }
    if (m === 'GET') return J(route, 200, select(S.db.t[tm[1]], url));
    S.deniedD = (S.deniedD || 0) + 1; // no INSERT / UPDATE / DELETE grant on the docket tables
    return J(route, 403, { code: '42501', message: 'permission denied for table ' + tm[1] });
  } catch (e) { return J(route, 400, { code: e.code || 'P0001', message: e.message, details: e.detail == null ? null : e.detail, hint: e.hint == null ? null : e.hint }); }
}
async function attach(t, S) {
  await S3.attach(t, S);
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
const docketCalls = S => S.log.filter(x => /^\w+ \/(stores_dockets|stores_docket_items|rpc\/(make_docket|docket_delivered|docket_cancel))/.test(x));
module.exports = { H, D, DD, makeServer, attach, open, handle, docketCalls };
