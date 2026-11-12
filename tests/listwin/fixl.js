// Shared set-up for the cutting-list window browser tests (list-window release, Nov 2026). The same data as
// tests/seq/fixs.js on feature/project-details-v2, but on the Stores docket fake (tests/stores-docket/srvd.js — untouched,
// which carries the Stage 3 fake) with NO PM-sequence / spec-sheet tables: this release has no database change.
// Project P1 "Aderrig" (customer Aderrig Homes) and P2 "Lucan" (Lucan Homes). Today = Wed 21 Oct 2026 (the Stage 3 NOW).
// Never touches the network.
const FD = require('../stores-docket/fixd.js');
const SD = require('../stores-docket/srvd.js');
const { H, D, DD } = SD;
const { F3, NOW, sleep } = FD;
function v2Row(extra) {
  const r = FD.v2Row(extra);
  r.orders.push(
    H.order({ wo: 'WO-3', customer: 'Aderrig Homes', floor: 'T09', unit: '13', title: 'HOUSE TYPE C', dueDate: '2026-12-03', origDueDate: '2026-12-03', plannedWeek: '' }),
    H.order({ wo: 'WO-4', customer: 'Aderrig Homes', floor: 'T09', unit: '13', title: 'HOUSE TYPE C UTILITY', dueDate: '2026-11-20', origDueDate: '2026-11-20', plannedWeek: '', delivDate: '2026-11-25' }),
    H.order({ wo: 'WO-5', customer: 'Aderrig Homes', floor: 'T09', unit: '14', title: 'HOUSE TYPE D', dueDate: '2026-11-10', origDueDate: '2026-11-10', shippedAt: '2026-10-20T10:00:00Z' }),
    H.order({ wo: 'WO-6', customer: 'Lucan Homes', floor: 'A1', unit: '4', title: 'TYPE A KITCHEN', dueDate: '2026-12-10', origDueDate: '2026-12-10', plannedWeek: '' }));
  return r;
}
function v1Row() { const r = v2Row(); delete r.settings.listStore; delete r.settings.listStoreAt; return r; }
function makeServer(row, opt = {}) {
  const S = SD.makeServer(row || v2Row());
  F3.seedList(S, 'L1', { wos: ['WO-1'], name: 'House 1', lines: opt.lines || FD.LINES });
  D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { customer: 'Aderrig Homes', cien_names: ['Aderrig Homes'] });
  D.insert(S.db, 'projects', { id: 'P2', name: 'Lucan', customer: 'Lucan Homes', cien_names: ['Lucan Homes'] });
  return S;
}
async function dev(browser, S, role, extra = {}) {
  const t = await SD.open(browser, S, Object.assign({ now: NOW, role }, extra));
  await t.page.evaluate(async () => {
    localStorage.setItem('wpfOpName', 'Op'); sessionStorage.setItem('wpfWho', 'Op');
    window.alert = () => {}; window.prompt = (m, d) => (window.__prompt !== undefined ? window.__prompt : 'Op'); window.confirm = () => (window.__confirm !== undefined ? window.__confirm : true);
    if (typeof lsReset === 'function') { lsReset(); await lsLoad(); } render();
  });
  await sleep(300);
  return t;
}
const noScroll = p => p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 300) : '')); };
function finish() { const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0); }
module.exports = { H, D, DD, SD, F3, FD, NOW, sleep, v2Row, v1Row, makeServer, dev, noScroll, rec, finish };
