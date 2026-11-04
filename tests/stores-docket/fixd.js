// Shared set-up for the Stores docket browser tests: the Stage 3 fixtures (tests/stage3/fix3.js — untouched) on the
// docket fake (srvd.js). A project "Aderrig" with one list on WO-1 holding stores (fit) and bought-in (buy) lines.
const F3 = require('../stage3/fix3.js');
const SD = require('./srvd.js');
const { H, D, DD } = SD;
const NOW = F3.NOW;
const sleep = F3.sleep;
function v2Row(extra) {
  const r = F3.v2Row(extra);
  r.orders.forEach(o => { o.floor = o.wo === 'WO-1' ? 'GF' : '1'; o.unit = o.wo === 'WO-1' ? '12' : '14'; o.title = 'HOUSE ' + o.wo + ' TYPE B'; });
  return r;
}
function v1Row() { const r = v2Row(); delete r.settings.listStore; delete r.settings.listStoreAt; return r; }
const LINES = [['hdr', 'Kitchen fittings', ''], ['fit', 'Tap', '20', null, null, 'Chrome mixer', '', ''], ['fit', 'Hinge', '8', null, null, 'Blum hinge', '', ''],
  ['buy', 'Worktop', '1', 3000, 600, 'Oak', '', ''], ['fit', 'Handle', '2x2', null, null, 'Bar', '', ''], ['saw', 'Side', '2', 720, 560, 'MFC White', '1mm ABS', ''],
  ['fit', 'Bin', '1', null, null, '', '', '', { status: 'na' }], ['fit', 'Plinth clip', '12', null, null, '', '', '', { status: 'waiting', status_at: '2026-10-20T09:00:00.000Z' }]];
function makeServer(row, opt = {}) {
  const S = SD.makeServer(row || v2Row());
  F3.seedList(S, 'L1', { wos: ['WO-1'], name: 'House 1', lines: opt.lines || LINES });
  D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { customer: 'Aderrig Homes', site_address: 'Site 4, Adamstown, Lucan' });
  return S;
}
async function dev(browser, S, role, extra = {}) {
  const t = await SD.open(browser, S, Object.assign({ now: NOW, role }, extra));
  await t.page.evaluate(async () => { localStorage.setItem('wpfOpName', 'Op'); window.alert = () => {}; window.prompt = (m, d) => (window.__prompt !== undefined ? window.__prompt : 'Op'); window.confirm = () => true; if (typeof lsReset === 'function' && V2()) { lsReset(); await lsLoad(); } render(); });
  return t;
}
// window.open → a fake window that keeps what was written (the printed docket / report)
async function catchPrint(p) { await p.evaluate(() => { window.__printed = []; window.open = () => { const w = { html: '', document: { write(h) { w.html += h; }, close() {} }, focus() {}, print() {}, close() {} }; window.__printed.push(w); return w; }; }); }
const printed = p => p.evaluate(() => (window.__printed || []).map(w => w.html));
const line = (S, id) => D.find(S.db, 'list_lines', id);
module.exports = { H, D, DD, SD, F3, NOW, sleep, v2Row, v1Row, makeServer, dev, catchPrint, printed, line, LINES };
