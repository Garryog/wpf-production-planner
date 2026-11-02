// Stage 3 C1: the listStore switch. Missing or 'v1' → the app behaves exactly as today and never calls the new tables.
// Fake Supabase only (srv3.js). Run: node tests/stage3/c1-switch.test.js
const { H, makeServer, open, newTableCalls } = require('./srv3.js');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const NOW = '2026-10-21T09:00:00Z';
const ROWS = [{ k: 'saw', item: 'Side', qty: 4, L: 2400, W: 600, mat: 'MFC White', note: '' }, { k: 'fit', item: 'Hinge', qty: 8, mat: 'Blum', note: '' }];
const row = extra => ({ id: 'main', version: 1, nid: 5, orders: [H.order({ wo: 'WO-1', dueDate: '2026-10-22', origDueDate: '2026-10-22' })],
  settings: Object.assign({ lists: [{ id: 'L1', wb: 'W1', sheet: 'H1', name: 'House 1', project: 'Proj', saw: 1, fit: 1, wos: ['WO-1'], up: NOW }],
    listWBs: { W1: { project: 'Proj', sheets: { H1: ROWS } } } }, extra || {}) });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await H.chromium.launch();
  for (const [label, extra] of [['switch missing', {}], ["listStore 'v1'", { listStore: 'v1', listStoreAt: '2026-10-20T10:00:00Z' }]]) {
    const S = makeServer(row(extra));
    const saw = await open(browser, S, { now: NOW, role: 'saw' });
    await saw.page.evaluate(() => { localStorage.setItem('wpfOpName', 'Op'); render(); });
    const v = await saw.page.evaluate(() => V2());
    rec(label + ': V2() is false', v === false);
    // tick one row on the saw, sign the list off, save
    const r = await saw.page.evaluate(async () => {
      const b = document.querySelector('[data-rt]'); if (!b) return 'no tick button'; b.click();
      clearTimeout(saveT); await saveDB(); return 'ok';
    });
    rec(label + ': saw tick works the old way and saves into the planner record', r === 'ok' && Object.keys((S.row.settings.listRow || {}).L1 || {}).length === 1, r + ' ' + JSON.stringify(S.row.settings.listRow));
    const off = await open(browser, S, { now: NOW, role: 'office' });
    await off.page.evaluate(async () => { showTab('l'); await new Promise(r => setTimeout(r, 200)); });
    await sleep(300);
    rec(label + ': ZERO calls to the new tables or /rpc/ (saw + office lists tab)', newTableCalls(S).length === 0, newTableCalls(S).join(', '));
    const keys = Object.keys(S.row.settings);
    if (!extra.listStore) rec(label + ': saved settings carry no listStore key (record shape unchanged)', !keys.includes('listStore') && !keys.includes('listStoreAt'), keys.join(','));
    else rec(label + ": saved settings keep listStore 'v1' and listStoreAt", S.row.settings.listStore === 'v1' && S.row.settings.listStoreAt === '2026-10-20T10:00:00Z');
    rec(label + ': no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    await saw.close(); await off.close();
  }
  // v2 is read from settings and survives a merge with another screen's edit
  {
    const S = makeServer(row());
    const A = await open(browser, S, { now: NOW }), B = await open(browser, S, { now: NOW });
    await A.page.evaluate(async () => { DB.listStore = 'v2'; DB.listStoreAt = new Date().toISOString(); clearTimeout(saveT); await saveDB(); });
    await B.page.evaluate(async () => { DB.orders[0].notes = 'B note'; clearTimeout(saveT); await saveDB(); });
    rec("switch set on PC A survives PC B's save (merged, not overwritten)", S.row.settings.listStore === 'v2' && S.row.orders[0].notes === 'B note', JSON.stringify({ ls: S.row.settings.listStore, n: S.row.orders[0].notes }));
    const bv = await B.page.evaluate(() => V2());
    rec('PC B now reads V2() true after the merge', bv === true);
    // switch back writes 'v1' — blank would be skipped by the merge, so it must be a real value
    // a raw 'v2' → 'v1' save is refused by the keep-switch rule (only Switch back's 'switching' step may leave 'v2')
    await A.page.evaluate(async () => { await loadDB(); DB.listStore = 'v1'; clearTimeout(saveT); await saveDB(); });
    rec("a raw save of 'v1' over 'v2' is refused (an old copy can't turn the new lists off)", S.row.settings.listStore === 'v2');
    await A.page.evaluate(async () => { await loadDB(); DB.listStore = 'switching'; clearTimeout(saveT); await saveDB(); await loadDB(); DB.listStore = 'v1'; clearTimeout(saveT); await saveDB(); });
    await B.page.evaluate(async () => { await loadDB(); });
    rec("switch back to 'v1' reaches PC B", (await B.page.evaluate(() => V2())) === false && S.row.settings.listStore === 'v1');
    await A.close(); await B.close();
  }
  // old record with no settings at all still loads
  {
    const S = makeServer({ id: 'main', version: 1, nid: 2, orders: [H.order({ wo: 'WO-1' })] });
    const A = await open(browser, S, { now: NOW });
    const r = await A.page.evaluate(() => ({ v2: V2(), n: lists().length, loaded: DB.loaded }));
    rec('old record without settings loads, V2() false, no lists', r.loaded && !r.v2 && r.n === 0 && !(S.errors || []).length, JSON.stringify(r));
    await A.close();
  }
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
