// Shared set-up for the PM sequence browser tests: the Project details fixtures (tests/project-details/fixp.js — untouched)
// on the sequence fake (srvs.js). Project P1 "Aderrig" (customer Aderrig Homes) and P2 "Lucan" (Lucan Homes).
// Today = Wed 21 Oct 2026 (the Stage 3 NOW): the fixed window (14 days) runs to Wed 4 Nov.
// Staff: John Burke + Mary Kelly ticked PM, Johnny ticked Pre-production.
const FD = require('../stores-docket/fixd.js');
const SS = require('./srvs.js');
const { H, D, DP, DS } = SS;
const { F3, NOW, sleep } = FD;
const STAFF = [{ id: 'S1', n: 'John Burke', r: ['pm'] }, { id: 'S2', n: 'Mary Kelly', r: ['pm'] }, { id: 'S3', n: 'Johnny', r: ['pre'] }, { id: 'S4', n: 'Ann Office', r: ['office'] }];
function v2Row(extra) {
  const r = FD.v2Row(Object.assign({ staff: STAFF }, extra || {}));
  // WO-1 / WO-2 (from the Stage 3 fixture) are due tomorrow — inside the fixed window
  r.orders.push(
    H.order({ wo: 'WO-3', customer: 'Aderrig Homes', floor: 'T09', unit: '13', title: 'HOUSE TYPE C', dueDate: '2026-12-03', origDueDate: '2026-12-03', plannedWeek: '' }),
    H.order({ wo: 'WO-4', customer: 'Aderrig Homes', floor: 'T09', unit: '13', title: 'HOUSE TYPE C UTILITY', dueDate: '2026-11-20', origDueDate: '2026-11-20', plannedWeek: '', delivDate: '2026-11-25' }),
    H.order({ wo: 'WO-5', customer: 'Aderrig Homes', floor: 'T09', unit: '14', title: 'HOUSE TYPE D', dueDate: '2026-11-10', origDueDate: '2026-11-10', shippedAt: '2026-10-20T10:00:00Z' }),
    H.order({ wo: 'WO-6', customer: 'Lucan Homes', floor: 'A1', unit: '4', title: 'TYPE A KITCHEN', dueDate: '2026-12-10', origDueDate: '2026-12-10', plannedWeek: '' }));
  return r;
}
function v1Row() { const r = v2Row(); delete r.settings.listStore; delete r.settings.listStoreAt; return r; }
function makeServer(row, opt = {}) {
  const S = SS.makeServer(row || v2Row());
  F3.seedList(S, 'L1', { wos: ['WO-1'], name: 'House 1', lines: opt.lines || FD.LINES });
  D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { customer: 'Aderrig Homes', cien_names: ['Aderrig Homes'] });
  D.insert(S.db, 'projects', { id: 'P2', name: 'Lucan', customer: 'Lucan Homes', cien_names: ['Lucan Homes'] });
  if (opt.noSeq) S.noSeqTables = true;
  return S;
}
async function dev(browser, S, role, extra = {}) {
  const t = await SS.open(browser, S, Object.assign({ now: NOW, role }, extra));
  await t.page.evaluate(async me => {
    localStorage.setItem('wpfOpName', 'Op'); sessionStorage.setItem('wpfWho', 'Op');
    if (me) { Object.entries(me).forEach(([k, v]) => localStorage.setItem('wpfMe_' + k, v)); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); } // the name was asked before it was set here
    window.alert = () => {}; window.prompt = (m, d) => (window.__prompt !== undefined ? window.__prompt : 'Op'); window.confirm = () => (window.__confirm !== undefined ? window.__confirm : true);
    if (typeof lsReset === 'function') { lsReset(); await lsLoad(); } render();
  }, extra.me || null);
  await sleep(300);
  return t;
}
// sequence rows straight into the fake database (as if another PC had saved them)
function seqRow(S, id, pid, f) { S.db.listStore = 'v2'; return DS.seqInsert(S.db, Object.assign({ id, project_id: pid, updated_by: 'Seed', src: 'manual' }, f || {})); }
const order = (S, pid) => DS.liveOf(S.db, pid).map(r => r.id);
const noScroll = p => p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 300) : '')); };
function finish() { const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0); }
module.exports = { H, D, DP, DS, SS, F3, NOW, sleep, STAFF, v2Row, v1Row, makeServer, dev, seqRow, order, noScroll, rec, finish };
