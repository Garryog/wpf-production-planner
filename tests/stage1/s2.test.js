const { H, makeServer, open } = require('./srv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const NOW = '2026-10-19T10:00:00Z';
const row = () => ({ id: 'main', version: 1, orders: [H.order({ wo: 'WO-1-1' }), H.order({ wo: 'WO-1-2' })], nid: 3, settings: {} });
(async () => {
  const browser = await H.chromium.launch();
  { // two PCs, different jobs
    const S = makeServer(row());
    const A = await open(browser, S, { now: NOW }), B = await open(browser, S, { now: NOW });
    await A.page.evaluate(async () => { DB.orders[0].plannedWeek = '2026-11-02'; await saveDB(); });
    await B.page.evaluate(async () => { DB.orders[1].plannedWeek = '2026-11-09'; await saveDB(); });
    const w = S.row.orders.map(o => o.plannedWeek).join(',');
    rec('both edits survive', w === '2026-11-02,2026-11-09', w + ' v' + S.row.version);
    const bView = await B.page.evaluate(() => DB.orders.map(o => o.plannedWeek).join(','));
    rec('B sees A edit after merge', bView === w, bView);
    rec('updated_by set', /Tester \[office\]/.test(S.row.updated_by), S.row.updated_by);
    // true clash: same field
    await A.page.evaluate(async () => { DB.orders[0].notes = 'A'; await saveDB(); });
    await B.page.evaluate(async () => { DB.orders[0].notes = 'B'; await saveDB(); });
    rec('clash: later wins + noted', S.row.orders[0].notes === 'B' && (S.row.orders[0].log || []).some(l => /two screens/.test(l.what)), JSON.stringify(S.row.orders[0].log));
    // tick clash: done wins
    S.row.settings.listRow = {}; 
    await A.page.evaluate(async () => { await loadDB(); DB.orders[1].delDone = true; await saveDB(); });
    await B.page.evaluate(async () => { DB.orders[1].delDone = false; DB.orders[1].hours = 9; await saveDB(); });
    rec('done wins', S.row.orders[1].delDone === true && S.row.orders[1].hours === 9, JSON.stringify({ d: S.row.orders[1].delDone, h: S.row.orders[1].hours }));
    // list ticks: A ticks row x, B unticks y (base had y)
    await A.page.evaluate(async () => { DB.listRow = { L1: { y: { m: 'saw' } } }; await saveDB(); });
    await B.page.evaluate(async () => { await loadDB(); });
    await A.page.evaluate(async () => { DB.listRow.L1.x = { m: 'saw' }; await saveDB(); });
    await B.page.evaluate(async () => { delete DB.listRow.L1.y; await saveDB(); });
    rec('tick merges', JSON.stringify(Object.keys(S.row.settings.listRow.L1).sort()) === '["x"]', JSON.stringify(S.row.settings.listRow));
    // B deletes a job while A edits other job
    await A.page.evaluate(async () => { await loadDB(); }); await B.page.evaluate(async () => { await loadDB(); });
    await A.page.evaluate(async () => { DB.orders.push({ wo: 'WO-NEW', title: 'n', plannedWeek: '' }); await saveDB(); });
    await B.page.evaluate(async () => { DB.orders = DB.orders.filter(o => o.wo !== 'WO-1-2'); await saveDB(); });
    rec('add + delete combine', S.row.orders.map(o => o.wo).join(',') === 'WO-1-1,WO-NEW', S.row.orders.map(o => o.wo).join(','));
    await A.close(); await B.close();
  }
  { // legacy: no version column
    const r = row(); delete r.version;
    const S = makeServer(r, { versioned: false });
    const A = await open(browser, S, { now: NOW });
    const warns = []; A.page.on('console', m => warns.push(m.text()));
    await A.page.evaluate(async () => { DB.orders[0].notes = 'L'; await saveDB(); });
    rec('legacy save works', S.row.orders[0].notes === 'L' && !('version' in S.patches[S.patches.length - 1]), JSON.stringify(Object.keys(S.patches[S.patches.length - 1])));
    // legacy but loaded row with version — server rejects version column
    const S2 = makeServer(row(), { versioned: false });
    const B = await open(browser, S2, { now: NOW });
    await B.page.evaluate(async () => { DB.orders[0].notes = 'L2'; await saveDB(); });
    rec('version column rejected -> falls back', S2.row.orders[0].notes === 'L2', S2.patches.length + ' patches');
    await A.close(); await B.close();
  }
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
