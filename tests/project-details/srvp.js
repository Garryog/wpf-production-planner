// Project details fake Supabase: the Stores dockets fake (tests/stores-docket/srvd.js — untouched, which carries the Stage 3
// fake) plus project_spec_items (read / add / change, never delete) and project_events (read only — the database writes it).
// S.noSpecTables = true answers like Supabase before the "Project details" SQL is run. Never touches the network.
const SD = require('../stores-docket/srvd.js');
const DP = require('./dbp.js');
const { H, D, DD } = SD;
function makeServer(row, opts = {}) { const S = SD.makeServer(row, opts); S.db = DP.makeDb(); return S; }
function match(r, k, f) {
  const i = f.indexOf('.'); const op = f.slice(0, i), v = f.slice(i + 1), x = r[k];
  const s = y => y === null || y === undefined ? null : String(y);
  if (op === 'eq') return s(x) === v;
  if (op === 'neq') return s(x) !== v;
  if (op === 'gt') return x != null && String(x) > v;
  if (op === 'gte') return x != null && String(x) >= v;
  if (op === 'lt') return x != null && String(x) < v;
  if (op === 'is') return v === 'null' ? x == null : s(x) === v;
  if (op === 'in') { const a = v.replace(/^\(|\)$/g, '').split(',').map(z => z.replace(/^"|"$/g, '')); return a.includes(s(x)); }
  throw new Error('fake server: unsupported filter ' + f);
}
const SPECIAL = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
function select(rows, url) {
  const u = new URL(url), q = []; u.searchParams.forEach((v, k) => q.push([k, v]));
  q.forEach(([k, f]) => { if (!SPECIAL.has(k)) rows = rows.filter(r => match(r, k, f)); });
  const o = q.find(([k]) => k === 'order');
  if (o) { const ks = o[1].split(',').map(s => s.split('.')); rows = rows.slice().sort((a, b) => { for (const [c, dir] of ks) { const r = (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * (dir === 'desc' ? -1 : 1); if (r) return r; } return 0; }); }
  const lim = q.find(([k]) => k === 'limit'); if (lim) rows = rows.slice(0, +lim[1]);
  return JSON.parse(JSON.stringify(rows.slice(0, 1000)));
}
const J = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
async function handle(S, route) {
  const req = route.request(), url = req.url(), m = req.method();
  const path = url.replace(/^.*rest\/v1/, '');
  const tm = /^\/([a-z_]+)(\?|$)/.exec(path);
  if (!(tm && DP.TABLES.includes(tm[1]))) return route.fallback();
  S.log.push(m + ' ' + path);
  if (S.offline || S.offline3 || S.offlineP) return route.abort('internetdisconnected');
  if (S.noSpecTables) return J(route, 404, { code: '42P01', message: 'relation "public.' + tm[1] + '" does not exist' });
  if (S.holdP) await S.holdP;
  const t = tm[1], pre = req.headers()['prefer'] || '';
  try {
    if (m === 'GET') return J(route, 200, select(S.db.t[t], url));
    if (t === 'project_events' || m === 'DELETE') { S.deniedP = (S.deniedP || 0) + 1; return J(route, 403, { code: '42501', message: 'permission denied for table ' + t }); }
    if (S.row && !['v2', 'migrating'].includes((S.row.settings || {}).listStore)) return J(route, 403, { code: '42501', message: 'new row violates row-level security policy for table "' + t + '"' });
    if (m === 'POST') {
      let b = JSON.parse(req.postData() || '[]'); if (!Array.isArray(b)) b = [b];
      const out = b.map(r => t === 'project_specs' ? DP.insertSpec(S.db, r) : DP.insert(S.db, r));
      if (S.dropReplyP && S.dropReplyP-- > 0) return route.abort('connectionreset');
      return /return=representation/.test(pre) ? J(route, 201, out) : route.fulfill({ status: 201, body: '' });
    }
    if (m === 'PATCH') {
      const b = JSON.parse(req.postData() || '{}');
      const hit = S.db.t[t].filter(r => { const u = new URL(url); let ok = true; u.searchParams.forEach((v, k) => { if (!SPECIAL.has(k) && !match(r, k, v)) ok = false; }); return ok; });
      hit.forEach(r => t === 'project_specs' ? DP.updateSpec(S.db, r, b) : DP.update(S.db, r, b));
      if (S.dropReplyP && S.dropReplyP-- > 0) return route.abort('connectionreset');
      return /return=representation/.test(pre) ? J(route, 200, JSON.parse(JSON.stringify(hit))) : route.fulfill({ status: 204, body: '' });
    }
  } catch (e) { return J(route, e.code === '23505' ? 409 : 400, { code: e.code || 'P0001', message: e.message, details: null, hint: null }); }
  return J(route, 405, { message: 'method' });
}
async function attach(t, S) {
  await SD.attach(t, S);
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
module.exports = { H, D, DD, DP, makeServer, attach, open, handle };
