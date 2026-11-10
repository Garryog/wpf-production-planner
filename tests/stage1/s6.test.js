const { H, makeServer, open } = require('./srv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const NOW = '2026-10-19T10:00:00Z';
(async () => {
  const browser = await H.chromium.launch();
  for (const [name, broken] of [['[] reply', []], ['orders null', [{ id: 'main', version: 3, orders: null, settings: null }]], ['empty plan', [{ id: 'main', version: 3, orders: [], settings: {} }]], ['orders not array', [{ id: 'main', version: 3, orders: {}, settings: {} }]]]) {
    const S = makeServer({ id: 'main', version: 1, orders: [H.order({ wo: 'WO-1-1' })], nid: 3, settings: {} });
    const A = await open(browser, S, { now: NOW });
    S.broken = broken;
    const st = await A.page.evaluate(async () => { await loadDB(); DB.orders[0].notes = 'x'; const n = DB.orders.length; await saveDB(); return { n, rb: DB.remoteBroken, sf: DB.saveFailed }; });
    const p = S.patches.length;
    rec(name + ': kept local jobs, no save', st.n === 1 && st.rb && p <= 1 && S.row.orders.length === 1, JSON.stringify(st) + ' patches=' + p);
    S.broken = null;
    await A.page.evaluate(async () => { await loadDB(); await saveDB(); });
    rec(name + ': recovers when DB good again', S.row.orders[0].notes === 'x', JSON.stringify(S.row.orders[0].notes));
    await A.close();
  }
  // legit "clear all": orders [] but settings present -> accepted
  { const S = makeServer({ id: 'main', version: 1, orders: [H.order({ wo: 'WO-1-1' })], nid: 3, settings: {} });
    const A = await open(browser, S, { now: NOW });
    S.row.orders = []; S.row.settings = { wcap: 350, lists: [] }; S.row.version = 2;
    const n = await A.page.evaluate(async () => { await loadDB(); return DB.orders.length + ' ' + DB.remoteBroken; });
    rec('cleared plan with settings is accepted', n === '0 false', n); await A.close(); }
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
