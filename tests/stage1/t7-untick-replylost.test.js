// ATTACK 7 (found by the t1 soak, seed 13): a tick whose save LANDED but whose reply was lost (phone lost signal),
// then the user unticks it (mis-tap correction), then the 2-minute refresh runs before the next save.
// The untick must survive. Deterministic repro of the soak's "zombie tick".
// Run: node tests/stage1/t7-untick-replylost.test.js
const { H, makeServer, device, sleep } = require('./tsrv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const base = () => ({ id: 'main', version: 1, orders: [H.order({ wo: 'WO-1', delv: true, delVeh: 'v1', delDay: 'Mon' }), H.order({ wo: 'WO-2' })], nid: 5, settings: { listRow: { L: {} } } });
(async () => {
  const browser = await H.chromium.launch();
  for (const [label, role, tick, untick, check] of [
    ['saw list tick', 'saw', `DB.listRow.L.T1={m:'saw',by:'T'}`, `delete DB.listRow.L.T1`, S => !S.row.settings.listRow.L.T1],
    ['driver delivered tick', 'driver', `DB.orders[0].delDone=true`, `DB.orders[0].delDone=false`, S => !S.row.orders[0].delDone],
  ]) for (const path of ['refresh before next save', 'save straight away', 'untick while still offline, then refresh']) {
    const S = makeServer(base());
    const A = await device(browser, S, { name: 'A' }, { role });
    A.dev.dropReply = 1; // this save lands but the phone never hears back
    await A.page.evaluate(`(async()=>{${tick};await saveDB();})()`);
    A.dev.dropReply = 0;
    const landed = !check(S);
    if (path.startsWith('untick while')) { A.dev.offline = true; await A.page.evaluate(`(async()=>{${untick};await saveDB();})()`); A.dev.offline = false; }
    else await A.page.evaluate(`(async()=>{${untick};sched();})()`);
    if (path.startsWith('untick while')) await A.page.evaluate(async () => { await loadDB(); render(); }); // 2-min refresh fires before the 30-s retry
    if (path === 'refresh before next save') await A.page.evaluate(async () => { await loadDB(); render(); });
    await A.page.evaluate(async () => { await saveDB(); }); await sleep(300);
    await A.page.evaluate(async () => { await loadDB(); });
    const scr = await A.page.evaluate(`(()=>{${'return ' + (role === 'saw' ? '!DB.listRow.L.T1' : '!DB.orders[0].delDone')}})()`);
    rec(label + ' (' + path + '): untick after a lost-reply save survives on server and screen', landed && check(S) && scr, JSON.stringify({ tickLanded: landed, serverUnticked: check(S), screenUnticked: scr, v: S.row.version }));
    await A.close();
  }
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
