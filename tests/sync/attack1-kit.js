// Shared helpers for the R1 attack tests (tests/sync/attack1-*.test.js). Not a test itself.
// Fake Supabase only (tests/stage1/srv.js behind tests/harness.js network guard) — never the live database.
const fs = require('fs'), path = require('path');
const { H, makeServer, attach } = require('../stage1/srv.js');
const MAIN_HTML = (() => { try { return require('child_process').execSync('git show origin/main:index.html', { cwd: path.join(__dirname, '../..'), maxBuffer: 64 << 20 }).toString(); } catch (e) { return null; } })();
const sleep = ms => new Promise(r => setTimeout(r, ms));
function mkRec() {
  const res = [];
  const rec = (n, ok, d) => { res.push(!!ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 400) : '')); };
  const done = () => { const f = res.filter(x => !x).length; console.log((f ? 'FAILED ' : 'ALL PASSED ') + (res.length - f) + '/' + res.length); process.exit(f ? 1 : 0); };
  return { rec, done };
}
const base = (v = 1, n = 2) => ({ id: 'main', ...(v === null ? {} : { version: v }), orders: Array.from({ length: n }, (_, i) => H.order({ wo: 'WO-' + (i + 1), notes: '' })), nid: n + 3, settings: {} });
// ~630 KB record, like the live one
function bigRow(v = 1) {
  const r = base(v, 0); const pad = 'x'.repeat(260);
  for (let i = 0; i < 1500; i++) r.orders.push(H.order({ wo: 'WO-' + (1000 + i), title: 'Kitchen job ' + i, customer: 'Builder ' + (i % 40), notes: pad }));
  r.nid = 3000; return r;
}
// Like PostgREST: "select=version" answers only that column. Counts bytes of every planner GET.
async function routes(t, S) {
  S.bytes = S.bytes || 0;
  await t.page.route(/production_planner\?id=eq\.main(&select=version)?$/, async route => {
    const req = route.request(); if (req.method() !== 'GET') return route.fallback();
    const isVer = /select=version/.test(req.url());
    S.log.push(isVer ? 'GET ?select=version' : 'GET /production_planner?id=eq.main');
    if (S.offline) return route.abort('internetdisconnected');
    if (isVer) {
      if (S.verHold) await S.verHold;
      if (S.verMode === 'fail') return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"down"}' });
      if (S.verOverride !== undefined) { const b = JSON.stringify([{ version: S.verOverride }]); S.bytes += b.length; return route.fulfill({ status: 200, contentType: 'application/json', body: b }); }
      if (!S.versioned) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"code":"42703","message":"column production_planner.version does not exist"}' });
      const b = JSON.stringify(S.row ? [{ version: S.row.version }] : []); S.bytes += b.length;
      return route.fulfill({ status: 200, contentType: 'application/json', body: b });
    }
    if (S.fullHold) await S.fullHold;
    const b = JSON.stringify(S.row ? [S.row] : []); S.bytes += b.length; S.fullBytes = (S.fullBytes || 0) + b.length;
    return route.fulfill({ status: 200, contentType: 'application/json', body: b });
  });
}
// Open a screen running `html` (default: this branch) on the shared fake database S.
async function pc(browser, S, o = {}) {
  const t = await H.open({ browser, row: S.row || base() });
  await attach(t, S);
  if (o.html) {
    await t.page.route(u => u.href === 'https://wpf.test/' || u.href.startsWith('https://wpf.test/?view'), r => r.fulfill({ status: 200, contentType: 'text/html', body: o.html }));
  }
  await routes(t, S);
  if (o.role) await t.page.evaluate(r => { localStorage.setItem('wpfRole', r); localStorage.setItem('wpfPin_' + r, '9000'); }, o.role);
  t.page.on('pageerror', e => (S.errors = S.errors || []).push(String(e)));
  await t.page.goto('https://wpf.test/?view=' + (o.role || 'office'));
  await t.page.waitForFunction(() => typeof analyzeImport === 'function' && typeof DB !== 'undefined' && DB.loaded, null, { timeout: 20000 }).catch(() => {});
  await t.page.evaluate(() => { clearInterval(viewTimer); window.__off = 0; const rn = Date.now.bind(Date); Date.now = () => rn() + window.__off; });
  await settle(t.page);
  return t;
}
async function settle(page) {
  await page.evaluate(async () => { for (let i = 0; i < 80 && (saveT || SAVING); i++) { await new Promise(r => setTimeout(r, 100)); } if (saveT) await saveDB(); for (let i = 0; i < 50 && SAVING; i++) await new Promise(r => setTimeout(r, 100)); });
}
// Fire the real 2-minute refresh callback once; works on R1 (refreshDB) and on main (loadDB). advance: ms to move the clock first.
async function tick(page, advance = 120000) {
  return page.evaluate(async adv => {
    window.__off += adv;
    const si = window.setInterval; let fn = null;
    window.setInterval = (f, ms) => { if (ms === 120000) fn = f; return si(() => {}, 1e9); };
    try { startAutoRefresh(); } finally { window.setInterval = si; }
    clearInterval(viewTimer);
    const nm = typeof refreshDB === 'function' ? 'refreshDB' : 'loadDB';
    const r0 = window[nm]; let done, ran = false;
    const p = new Promise(r => done = r);
    window[nm] = function () { ran = true; const q = r0.apply(this, arguments); q.then(done, done); return q; };
    try { if (!fn) return { ran: false, nofn: true }; fn(); await Promise.race([p, new Promise(r => setTimeout(r, ran ? 15000 : 300))]); } finally { window[nm] = r0; }
    await new Promise(r => setTimeout(r, 60));
    return { ran };
  }, advance);
}
const fullGets = S => S.log.filter(l => l === 'GET /production_planner?id=eq.main').length;
const verGets = S => S.log.filter(l => l === 'GET ?select=version').length;
const note = (page, wo) => page.evaluate(w => { const o = DB.orders.find(o => o.wo === w); return o ? o.notes : '(gone)'; }, wo);
const bSet = (page, wo, txt) => page.evaluate(async ([w, t]) => { DB.orders.find(o => o.wo === w).notes = t; await saveDB(); }, [wo, txt]);
module.exports = { H, makeServer, attach, MAIN_HTML, sleep, mkRec, base, bigRow, routes, pc, settle, tick, fullGets, verGets, note, bSet };
