// Shared set-up for the Project details browser tests: the Stores dockets fixtures (tests/stores-docket/fixd.js — untouched)
// on the Project details fake (srvp.js). Project P1 "Aderrig" (customer Aderrig Homes) with list L1 on WO-1.
const FD = require('../stores-docket/fixd.js');
const SP = require('./srvp.js');
const { H, D, DP } = SP;
const { F3, NOW, sleep, v2Row, v1Row, catchPrint, printed, LINES } = FD;
function makeServer(row, opt = {}) {
  const S = SP.makeServer(row || v2Row());
  F3.seedList(S, 'L1', { wos: ['WO-1'], name: 'House 1', lines: opt.lines || LINES });
  D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { customer: 'Aderrig Homes', cien_names: ['Aderrig Homes'] });
  if (opt.noSpec) S.noSpecTables = true;
  return S;
}
async function dev(browser, S, role, extra = {}) {
  const t = await SP.open(browser, S, Object.assign({ now: NOW, role }, extra));
  await t.page.evaluate(async () => { localStorage.setItem('wpfOpName', 'Op'); sessionStorage.setItem('wpfWho', window.__who || 'Op'); window.alert = () => {}; window.prompt = (m, d) => (window.__prompt !== undefined ? window.__prompt : 'Op'); window.confirm = () => (window.__confirm !== undefined ? window.__confirm : true); if (typeof lsReset === 'function') { lsReset(); await lsLoad(); } render(); });
  await sleep(300);
  return t;
}
// a spec row straight into the fake database (as if another PC had saved it)
// 'SPD:P1' is the id the app gives a project's first (default) spec; sid picks another spec
function sheet(S, id, name, type, pid) { return S.db.t.project_specs.find(x => x.id === id) || DP.insertSpec(S.db, { id, project_id: pid || 'P1', name, spec_type: type || 'kitchens', updated_by: 'Seed' }); }
function spec(S, id, item, value, extra) { const sid = (extra && extra.spec_id) || 'SPD:P1'; if (sid === 'SPD:P1') sheet(S, sid, 'Kitchens'); return DP.insert(S.db, Object.assign({ id, project_id: 'P1', spec_id: sid, item, value, updated_by: 'Seed' }, extra || {})); }
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 300) : '')); };
function finish() { const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0); }
module.exports = { H, D, DP, SP, F3, NOW, sleep, v2Row, v1Row, makeServer, dev, spec, sheet, catchPrint, printed, LINES, rec, finish };
