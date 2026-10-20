const { H, makeServer, open } = require('./srv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const NOW = '2026-10-19T10:00:00Z';
(async () => {
  const browser = await H.chromium.launch();
  for (const role of ['office', 'saw', 'stores', 'driver', 'pm', 'prod', 'floor', 'dash']) {
    const S = makeServer({ id: 'main', version: 1, orders: [H.order({ wo: 'WO-1-1' })], nid: 3, settings: {} });
    const A = await open(browser, S, { now: NOW, role, viewport: { width: 390, height: 800 } });
    const m0 = await A.page.evaluate(() => document.getElementById('stxt').textContent);
    S.offline = true;
    await A.page.evaluate(async () => { DB.orders[0].notes = 'x'; await saveDB(); render(); });
    const st = await A.page.evaluate(() => { const b = document.getElementById('savebar'); const r = b.getBoundingClientRect(); return { vis: !b.hidden && r.height > 0, t: document.getElementById('stxt').textContent }; });
    S.offline = false;
    await A.page.evaluate(async () => { await saveDB(); });
    const st2 = await A.page.evaluate(() => ({ vis: !document.getElementById('savebar').hidden, t: document.getElementById('stxt').textContent }));
    rec(role + ': bar shown on failure, gone after save; marker', st.vis && !st2.vis, `${m0} -> ${st.t} -> ${st2.t}`);
    await A.close();
  }
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
