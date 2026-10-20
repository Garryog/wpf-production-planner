// ATTACK 2 (deterministic): after a merge, the live plan shares objects with BASE ("what the database had").
// Any later edit to those objects silently edits BASE too, so the app thinks the edit is already saved.
// Result: the edit is dropped by the next clash-merge, wiped by the next refresh, and NOT kept on the device.
// Run: node tests/stage1/t2-alias.test.js
const { H, makeServer, device } = require('./tsrv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const row = () => ({ id: 'main', version: 1, orders: [H.order({ wo: 'WO-1' }), H.order({ wo: 'WO-2' })], nid: 5, settings: { listRow: { L: { a: { m: 'saw' } } } } });
(async () => {
  const browser = await H.chromium.launch();
  // Case 1: tick on a list after a merge brought in someone else's tick, then a normal clash
  {
    const S = makeServer(row());
    const A = await device(browser, S, { name: 'A' }), B = await device(browser, S, { name: 'B', }, { role: 'saw' });
    await A.page.evaluate(() => { DB.orders[0].notes = 'office note'; sched(); });                 // office typing, save not sent yet
    await B.page.evaluate(async () => { DB.listRow.L.b = { m: 'saw' }; await saveDB(); });           // saw phone ticks b
    await A.page.evaluate(async () => { await loadDB(); });                                          // office 2-min refresh merges b in
    const aliased = await A.page.evaluate(() => DB.listRow === BASE.settings.listRow);
    rec('live list ticks are NOT the same object as BASE after a merge', !aliased, 'aliased=' + aliased);
    await A.page.evaluate(() => { DB.listRow.L.c = { m: 'saw' }; sched(); });                       // office ticks c (debounced save)
    const unsaved = await A.page.evaluate(() => !same(snap(), BASE));
    rec('app knows tick c is unsaved', unsaved, 'unsaved=' + unsaved);
    await B.page.evaluate(async () => { DB.orders[1].notes = 'saw note'; await saveDB(); });       // someone else saves first
    await A.page.evaluate(async () => { await saveDB(); });
    const srv = Object.keys(S.row.settings.listRow.L).sort().join(','), loc = await A.page.evaluate(() => Object.keys(DB.listRow.L).sort().join(','));
    rec('tick c reaches the database', srv === 'a,b,c', 'server=' + srv + ' officeScreen=' + loc);
    await A.close(); await B.close();
  }
  // Case 2: job added on another device arrives by merge; this device marks it delivered; it vanishes on refresh
  {
    const S = makeServer(row());
    const A = await device(browser, S, { name: 'A' }), B = await device(browser, S, { name: 'B' });
    await B.page.evaluate(async () => { DB.orders.push(Object.assign(JSON.parse(JSON.stringify(DB.orders[0])), { wo: 'WO-NEW' })); await saveDB(); });
    await A.page.evaluate(() => { DB.orders[0].notes = 'x'; sched(); });                            // unsaved edit on this screen
    await A.page.evaluate(async () => { await loadDB(); });                                          // refresh merges WO-NEW in
    A.dev.offline = true;                                                                           // driver/office loses signal
    await A.page.evaluate(async () => { const o = DB.orders.find(x => x.wo === 'WO-NEW'); o.delDone = true; o.delivBy = 'Driver'; sched(); await saveDB(); });
    const st = await A.page.evaluate(() => ({ bar: !document.getElementById('savebar').hidden, pend: localStorage.getItem('wpfPending') }));
    rec('offline: red NOT SAVED bar shown', st.bar, JSON.stringify({ bar: st.bar }));
    rec('offline: the delivered tick is kept on the device (wpfPending)', !!st.pend && /delDone/.test(st.pend), 'wpfPending=' + (st.pend ? st.pend.length + ' chars' : 'null'));
    A.dev.offline = false;
    await B.page.evaluate(async () => { await loadDB(); DB.orders[1].notes = 'other'; await saveDB(); }); // someone else saves meanwhile
    await A.page.evaluate(async () => { await loadDB(); });                                          // auto-refresh when signal returns
    const after = await A.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-NEW'); return { done: !!o.delDone, bar: !document.getElementById('savebar').hidden }; });
    await A.page.evaluate(async () => { await saveDB(); });
    const srv = (S.row.orders.find(o => o.wo === 'WO-NEW') || {}).delDone;
    rec('delivered tick survives the refresh and reaches the database', after.done && srv === true, JSON.stringify({ screenAfterRefresh: after.done, server: srv }));
    await A.close(); await B.close();
  }
  // Case 3: device-copy recovery (reopen) also aliases: edit after recovery is lost on the next clash
  {
    const S = makeServer(row());
    const A = await device(browser, S, { name: 'A' }, { role: 'saw' });
    A.dev.offline = true;
    await A.page.evaluate(async () => { DB.listRow.L.p = { m: 'saw' }; sched(); await saveDB(); writePend(); });
    await A.page.close({ runBeforeUnload: false });
    A.dev.offline = false;
    const p = await A.ctx.newPage(); await require('./tsrv').attach(p, S, A.dev); await p.goto('https://wpf.test/?view=saw');
    await p.waitForFunction(() => typeof loadDB === 'function' && DB.loaded); await p.waitForTimeout(1800);
    const rec1 = Object.keys(S.row.settings.listRow.L).sort().join(',');
    rec('recovered offline tick sent after reopen', rec1 === 'a,p', rec1);
    await A.close();
  }
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
