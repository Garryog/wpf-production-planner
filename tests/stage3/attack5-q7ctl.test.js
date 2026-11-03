// ATTACK 5 control for attack5-q7 P4: the SAME "tab dies while the save is in flight" on an ordinary old-lists tick (no
// switch back). If this keeps the tick and P4 doesn't, the loss is specific to the switch-back fold (lqFoldV1).
// Fake Supabase only. Run: node tests/stage3/attack5-q7ctl.test.js
const A = require('./atk.js');
const { F, S3, H, rec, k } = A;
const SIDE = { k: 'saw', item: 'Side', qty: 2, L: 720, W: 560, mat: 'MFC White', note: '' };
const TOP = { k: 'saw', item: 'Top', qty: 1, L: 1200, W: 560, mat: 'MFC White', note: '' };
const row = () => ({ id: 'main', version: 1, nid: 5, orders: [H.order({ wo: 'WO-1', customer: 'Aderrig Homes', dueDate: '2026-10-22', origDueDate: '2026-10-22' })],
  settings: { lists: [{ id: 'L1', wb: 'W1', sheet: 'House 1', name: 'House 1', project: 'Aderrig', saw: 2, fit: 0, wos: ['WO-1'], up: '2026-10-01T08:00:00Z' }],
    listWBs: { W1: { project: 'Aderrig', sheets: { 'House 1': [SIDE, TOP] } } }, listRow: {}, listHold: {}, listDone: {}, holdLog: [] } });
const PP = u => /production_planner/.test(String(u)) && !/select=ls/.test(String(u));
const old = S => Object.keys((S.row.settings.listRow || {}).L1 || {}).length;
(async () => {
  const browser = await H.chromium.launch();
  const S = F.makeServer(row());
  const saw = await F.open(browser, S, { now: F.NOW, role: 'saw' });
  await saw.page.route(PP, r => r.request().method() === 'PATCH' ? new Promise(() => {}) : r.fallback());
  // the saw's own tap path
  const tap = await saw.page.evaluate(() => { const b = [...document.querySelectorAll('[data-rt]')]; b.slice(0, 2).forEach(x => x.click()); return b.length; });
  await F.sleep(3000); // the 1.2 s save starts and hangs
  const st = await saw.page.evaluate(() => ({ saving: !!SAVING, pend: !!(Object.keys(localStorage).filter(k => k.indexOf('wpfPending') === 0).map(k => localStorage.getItem(k)).join('') || null) }));
  const page = await saw.ctx.newPage(); await saw.page.close({ runBeforeUnload: false });
  const n = { ...saw, page }; await S3.attach(n, S);
  await page.goto('https://wpf.test/?view=office'); await page.waitForFunction(() => typeof analyzeImport === 'function'); await F.sleep(1500);
  await page.evaluate(async () => { localStorage.setItem('wpfPin_saw', '9000'); setRole('saw'); await loadDB(); clearTimeout(saveT); await saveDB(); });
  await F.sleep(1500);
  rec('C1 control: ordinary old-lists ticks, tab dies mid-save → ticks kept on the device and saved after reopen', old(S) >= 2, 'buttons=' + tap + ' while saving=' + JSON.stringify(st) + ' → old ticks=' + old(S));
  await page.close(); await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
