// Coder check: a save that LANDS but whose reply is lost must not later undo this screen's newer edits.
const { H, makeServer, device } = require('./tsrv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const base = () => ({ id: 'main', version: 1, orders: [H.order({ wo: 'WO-1' }), H.order({ wo: 'WO-2' })], nid: 5, settings: { listRow: { L: {} } } });
(async () => {
  const browser = await H.chromium.launch();
  for (const how of ['same tab', 'reopen']) {
    const S = makeServer(base());
    const A = await device(browser, S, { name: 'A' }, { role: 'saw' }), O = await device(browser, S, { name: 'O' });
    A.dev.dropReply = 1; // write lands, reply lost
    await A.page.evaluate(async () => { DB.listRow.L.x = { m: 'saw' }; DB.orders[0].notes = 'first'; await saveDB(); });
    A.dev.dropReply = 0; A.dev.offline = true;
    await A.page.evaluate(async () => { delete DB.listRow.L.x; DB.orders[0].notes = 'second'; sched(); await saveDB(); writePend(); });
    await O.page.evaluate(async () => { await loadDB(); DB.orders[1].notes = 'office'; await saveDB(); });
    A.dev.offline = false;
    let P = A.page;
    if (how === 'reopen') { await A.page.close({ runBeforeUnload: false }); P = await A.ctx.newPage(); await require('./tsrv').attach(P, S, A.dev); await P.goto('https://wpf.test/?view=saw'); await P.waitForFunction(() => typeof loadDB === 'function' && DB.loaded); await P.waitForTimeout(2000); }
    else await P.evaluate(async () => { await loadDB(); await saveDB(); });
    const r = { x: !!S.row.settings.listRow.L.x, n1: S.row.orders[0].notes, n2: S.row.orders[1].notes };
    rec(how + ': newer untick + note win over own earlier landed save; office edit kept', !r.x && r.n1 === 'second' && r.n2 === 'office', JSON.stringify(r));
    await A.close(); await O.close();
  }
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
