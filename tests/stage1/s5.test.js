const { H, makeServer, open } = require('./srv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const NOW = '2026-10-19T10:00:00Z';
(async () => {
  const browser = await H.chromium.launch();
  const S = makeServer({ id: 'main', version: 1, orders: [H.order({ wo: 'WO-1-1' }), H.order({ wo: 'WO-1-2' })], nid: 3, settings: {} });
  const A = await open(browser, S, { now: NOW }), B = await open(browser, S, { now: NOW });
  await A.page.waitForTimeout(1500);
  rec('baseline migrated and saved', S.row.settings.exportBase && S.row.settings.exportBase.wk['WO-1-1'] === '2026-10-26', JSON.stringify(S.row.settings.exportBase));
  await A.page.evaluate(async () => { DB.orders[0].plannedWeek = '2026-11-02'; await saveDB(); });
  const bc = await B.page.evaluate(async () => { await loadDB(); return changes().map(o => o.wo).join(); });
  const ac = await A.page.evaluate(async () => { await loadDB(); return changes().map(o => o.wo).join(); });
  rec('change visible on both PCs after refresh', ac === 'WO-1-1' && bc === 'WO-1-1', ac + ' / ' + bc);
  await B.page.evaluate(async () => { showTab('x'); document.getElementById('btn-mark').click(); await new Promise(r => setTimeout(r, 1700)); });
  const ac2 = await A.page.evaluate(async () => { await loadDB(); return changes().map(o => o.wo).join(); });
  rec('Mark as applied resets for everyone', ac2 === '', ac2);
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
