// ATTACK: ticks saved by another screen shortly BEFORE "Migrate lists" is pressed (after the migrating PC last refreshed).
// They are older than listStoreAt (so never rescued) and not in the migrating PC's copy (so never migrated)?
// Fake Supabase only. Run: node tests/stage3/attack-migwindow.test.js
const A = require('./atk.js');
const { F, H, D, rec, k } = A;
const SIDE = { k: 'saw', item: 'Side', qty: 2, L: 720, W: 560, mat: 'MFC White', note: '' }, TOP = { k: 'saw', item: 'Top', qty: 1, L: 1200, W: 560, mat: 'Oak', note: '' };
const row = () => ({ id: 'main', version: 1, nid: 5, orders: [H.order({ wo: 'WO-1', unit: '1', customer: 'Aderrig Homes', dueDate: '2026-10-22', origDueDate: '2026-10-22' })],
  settings: { lists: [{ id: 'L1', wb: 'W1', sheet: 'House 1', name: 'House 1', project: 'Aderrig', saw: 2, fit: 0, wos: ['WO-1'], up: F.NOW }], listWBs: { W1: { project: 'Aderrig', sheets: { 'House 1': [SIDE, TOP] } } } } });
(async () => {
  const browser = await H.chromium.launch();
  const S = F.makeServer(row());
  const off = await F.open(browser, S, { now: F.NOW, role: 'office' });
  const saw = await F.open(browser, S, { now: F.NOW, role: 'saw' });
  // the saw (same new code, switch still off) ticks Top and N/As nothing; saved to the record
  await saw.page.evaluate(async t => { setRowTick(lists()[0], t, 'saw', 'Sean', true); await saveDB(); }, k(TOP));
  rec('set-up: the saw\'s tick is in the planner record', !!(S.row.settings.listRow && S.row.settings.listRow.L1 && S.row.settings.listRow.L1[k(TOP)]));
  // Garry presses Migrate on the office PC, which has not refreshed since (no loadDB in between)
  const r = await off.page.evaluate(async () => { const x = await lsMigrate('Garry'); return { ok: x.ok }; });
  const st = D.find(S.db, 'list_lines', 'L1:2');
  rec('W1 a tick saved by the saw just before Migrate is in the tables after the switch', r.ok && st.status === 'cut', 'migrate ok=' + r.ok + ' Top in table=' + st.status + ' (lsMigrate reads this PC\'s in-memory copy, never reloads first)');
  const s2 = await F.dev(browser, S, 'saw');
  await s2.page.evaluate(async () => { lsRescue(); await lqSend(); });
  rec('W1b …or at least the rescue of old ticks picks it up', D.find(S.db, 'list_lines', 'L1:2').status === 'cut', 'after rescue=' + D.find(S.db, 'list_lines', 'L1:2').status + ' (tick time < listStoreAt → ignored)');
  rec('W1c and the frozen copy in the planner record still has it (so the data exists, but the floor no longer sees it)', !!S.row.settings.listRow.L1[k(TOP)]);
  await off.close(); await saw.close(); await s2.close();
  // ---- W2: the saw ticks WHILE the migration is copying (after its snapshot, before the switch is saved)
  {
    const S = F.makeServer(row());
    const off = await F.open(browser, S, { now: F.NOW, role: 'office' });
    const saw = await F.open(browser, S, { now: F.NOW, role: 'saw' });
    let go; const gate = new Promise(r => { go = r; }); let hit = false;
    await off.page.route(u => /rest\/v1\/lists\?on_conflict/.test(String(u)), async route => { hit = true; await gate; return route.fallback(); });
    const mig = off.page.evaluate(async () => { const x = await lsMigrate('Garry'); return { ok: x.ok }; });
    for (let i = 0; i < 50 && !hit; i++) await F.sleep(100);
    await saw.page.evaluate(async t => { await loadDB(); setRowTick(lists()[0], t, 'saw', 'Sean', true); await saveDB(); }, k(TOP));
    go(); const r = await mig;
    const s2 = await F.dev(browser, S, 'saw');
    await s2.page.evaluate(async () => { lsRescue(); await lqSend(); });
    rec('W2 a tick saved by an old-mode screen DURING the migration reaches the tables (migrated or rescued)', r.ok && D.find(S.db, 'list_lines', 'L1:2').status === 'cut', 'migrate ok=' + r.ok + ' Top in table=' + D.find(S.db, 'list_lines', 'L1:2').status + '; in frozen record=' + !!S.row.settings.listRow.L1[k(TOP)] + ' tick at ' + S.row.settings.listRow.L1[k(TOP)].at + ' < listStoreAt ' + S.row.settings.listStoreAt);
    await off.close(); await saw.close(); await s2.close();
  }
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
