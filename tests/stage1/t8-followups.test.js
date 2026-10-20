// ATTACK 8: follow-ups on the Coder's "known remaining" items.
//  a) t5 import-removal vs remote move: the shipped job comes back — does it also leak into Export Changes
//     (i.e. a date sent back to Cienapps for a shipped job)? Does the next import clear it again?
//  b) t3 duplicate-WO: reachable only via duplicate WOs? Two PCs creating a planner WO (P-number) at once.
// Run: node tests/stage1/t8-followups.test.js
const { H, makeServer, device } = require('./tsrv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const info = (n, d) => console.log('INFO ' + n + '  -> ' + d);
const base = () => ({ id: 'main', version: 1, orders: [H.order({ wo: 'WO-1', plannedWeek: '2026-10-26' }), H.order({ wo: 'WO-2', plannedWeek: '2026-10-26' }), H.order({ wo: 'WO-3', plannedWeek: '2026-10-26' })], nid: 5, settings: { exportBase: { wk: { 'WO-1': '2026-10-26', 'WO-2': '2026-10-26', 'WO-3': '2026-10-26' }, st: { 'WO-1': '3. In production', 'WO-2': '3. In production', 'WO-3': '3. In production' } } } });
const empty = { removals: [], updates: [], newOrders: [], backfills: [], inTransit: [], counts: {}, moves: {} };
(async () => {
  const browser = await H.chromium.launch();
  {
    const S = makeServer(base()); const A = await device(browser, S, { name: 'A' }), B = await device(browser, S, { name: 'B' });
    await B.page.evaluate(async () => { DB.orders[2].plannedWeek = '2026-11-16'; await saveDB(); });
    await A.page.evaluate(async e => { showTab('i'); applyImport({ ...e, removals: [{ wo: 'WO-3', reason: 'shipped' }] }); await saveDB(); }, empty);
    const back = S.row.orders.some(o => o.wo === 'WO-3');
    info('import removal vs remote move: shipped job back on the board', back ? 'yes (known, t5)' : 'no');
    for (const [n, P] of [['A', A], ['B', B]]) { await P.page.evaluate(() => loadDB()); const c = await P.page.evaluate(() => changes().map(o => o.wo).join(',')); rec('resurrected shipped job NOT in Export Changes on ' + n + ' (no date sent to Cienapps)', !/WO-3/.test(c), c || '(none)'); }
    const log = S.row.orders.find(o => o.wo === 'WO-3'); info('history note on the resurrected job', log ? JSON.stringify((log.log || []).slice(-1)) : '-');
    await A.page.evaluate(async e => { showTab('i'); applyImport({ ...e, removals: [{ wo: 'WO-3', reason: 'shipped' }] }); await saveDB(); }, empty);
    rec('next import removes it again (self-heals)', !S.row.orders.some(o => o.wo === 'WO-3'), S.row.orders.map(o => o.wo).join(','));
    await A.close(); await B.close();
  }
  { // same import file listing a WO twice -> duplicate WO lines exist today (reachable, Stage 2 dedupe)
    const S = makeServer(base()); const A = await device(browser, S, { name: 'A' });
    const n = await A.page.evaluate(async () => { showTab('i'); const p = analyzeImport([{ wo: 'WO-9', title: 'x', value: 1000, dueDate: '2026-11-20', step: '3. In production' }, { wo: 'WO-9', title: 'x', value: 1000, dueDate: '2026-11-20', step: '3. In production' }]); applyImport(p); await saveDB(); return DB.orders.filter(o => o.wo === 'WO-9').length; }).catch(e => 'ERR ' + e.message.split('\n')[0]);
    info('one Cienapps file listing a WO on two lines creates duplicate WO lines (the route into the t3 bug)', n + ' line(s)');
    await A.close();
  }
  { // two office PCs each create a planner WO in the same moment: both pick P-1001
    const S = makeServer(base()); const A = await device(browser, S, { name: 'A' }), B = await device(browser, S, { name: 'B' });
    const mk = (p, t) => p.evaluate(async t => { const wo = nextPNumber(); DB.orders.push({ wo, title: t, hours: 4, value: 0, dueDate: '2026-11-20', step: 'Planner WO', plannedWeek: '2026-11-16', notes: '', log: [] }); orig[wo] = ''; origStep[wo] = 'Planner WO'; return wo; }, t);
    const wa = await mk(A.page, 'Snag kit Tullycross'), wb = await mk(B.page, 'Worktop remake Athenry');
    await A.page.evaluate(() => saveDB()); await B.page.evaluate(() => saveDB());
    const p = S.row.orders.filter(o => /^P-/.test(o.wo)).map(o => o.wo + ':' + o.title);
    rec('two planner WOs created at once on two PCs are both kept', p.length === 2, wa + '/' + wb + ' -> ' + JSON.stringify(p));
    await A.close(); await B.close();
  }
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
