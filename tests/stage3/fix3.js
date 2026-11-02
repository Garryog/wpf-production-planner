// Shared set-up for the Stage 3 browser tests: a planner record with the switch ON ('v2') and lists in the fake tables.
const { H, D, makeServer, open, newTableCalls } = require('./srv3.js');
const NOW = '2026-10-21T09:00:00Z'; // Wednesday; WO-1 delivers Thursday → cut by today
const sleep = ms => new Promise(r => setTimeout(r, ms));
function v2Row(extra) {
  return { id: 'main', version: 1, nid: 5,
    orders: [H.order({ wo: 'WO-1', customer: 'Aderrig Homes', dueDate: '2026-10-22', origDueDate: '2026-10-22' }), H.order({ wo: 'WO-2', customer: 'Aderrig Homes', unit: '2', dueDate: '2026-10-22', origDueDate: '2026-10-22' })],
    settings: Object.assign({ listStore: 'v2', listStoreAt: '2026-10-20T08:00:00Z',
      // the frozen old copy — must never be written again in V2
      lists: [{ id: 'OLD1', wb: 'W1', sheet: 'Old', name: 'Old house', project: 'Old', saw: 1, fit: 0, wos: [], up: NOW }],
      listWBs: { W1: { project: 'Old', sheets: { Old: [{ k: 'saw', item: 'X', qty: 1, L: 1, W: 1, mat: 'M', note: '' }] } } } }, extra || {}) };
}
// lines: [kind, part, qty, L, W, material, edging, note, extra]
function seedList(S, id, opt = {}) {
  const d = S.db;
  if (!D.find(d, 'projects', 'P1')) { D.insert(d, 'projects', { id: 'P1', name: 'Aderrig' }); D.insert(d, 'project_materials', { id: 'M1', project_id: 'P1', name: 'MFC White', kind: 'sheet' }); D.insert(d, 'project_materials', { id: 'M2', project_id: 'P1', name: 'Blum hinge', kind: 'other' }); }
  const lines = opt.lines || [['saw', 'Side', '2', 720, 560, 'MFC White', '1mm ABS', ''], ['saw', 'Side', '2', 720, 560, 'MFC White', '1mm ABS', ''], ['saw', 'Top', '1', 1200, 560, 'MFC White', '', 'scribe'], ['fit', 'Hinge', '8', null, null, 'Blum hinge', '', '']];
  D.insert(d, 'lists', Object.assign({ id, project_id: 'P1', name: opt.name || 'House ' + id, wos: opt.wos || ['WO-1'], n_saw: lines.filter(x => x[0] === 'saw').length, n_fit: lines.filter(x => x[0] === 'fit').length, created_at: '2026-10-20T08:00:00.000Z' }, opt.list || {}));
  lines.forEach((x, i) => D.insert(d, 'list_lines', Object.assign({ id: id + ':' + (i + 1), list_id: id, seq: i + 1, kind: x[0], part: x[1], qty: x[2], length_mm: x[3], width_mm: x[4], material: x[5], edging: x[6] || null, note: x[7] || null }, x[8] || {})));
}
async function dev(browser, S, role, extra = {}) {
  const t = await open(browser, S, Object.assign({ now: NOW, role }, extra));
  await t.page.evaluate(async () => { localStorage.setItem('wpfOpName', 'Op'); lsReset(); await lsLoad(); render(); });
  return t;
}
const line = (S, id) => D.find(S.db, 'list_lines', id);
const tapRow = (p, attr, lineId) => p.evaluate(({ attr, lineId }) => { const b = [...document.querySelectorAll('[' + attr + ']')].find(x => x.getAttribute(attr).endsWith('|' + lineId)); if (!b) return 'missing'; if (b.disabled) return 'disabled'; b.click(); return 'ok'; }, { attr, lineId });
const send = p => p.evaluate(async () => { await lqSend(); });
const qlen = p => p.evaluate(() => LQ.q.length);
module.exports = { H, D, makeServer, open, newTableCalls, NOW, sleep, v2Row, seedList, dev, line, tapRow, send, qlen };
