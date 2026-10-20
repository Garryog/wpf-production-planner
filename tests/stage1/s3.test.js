const { H, makeServer, open, reopen } = require('./srv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const NOW = '2026-10-19T10:00:00Z';
const row = () => ({ id: 'main', version: 1, orders: [H.order({ wo: 'WO-1-1' }), H.order({ wo: 'WO-1-2' })], nid: 3, settings: { listWBs: { L1: 'BIGWORKBOOK' } } });
(async () => {
  const browser = await H.chromium.launch();
  {
    const S = makeServer(row());
    const A = await open(browser, S, { now: NOW });
    S.offline = true;
    await A.page.evaluate(async () => { DB.orders[0].notes = 'offline note'; await saveDB(); });
    const p = await A.page.evaluate(() => localStorage.getItem('wpfPending'));
    rec('pending kept on device, no workbooks', p && /offline note/.test(p) && !/BIGWORKBOOK/.test(p), (p || '').length + ' chars');
    // meanwhile another PC changes WO-1-2
    S.row.orders[1].notes = 'other PC'; S.row.version = 2;
    await A.page.close();
    S.offline = false;
    const B = await reopen(A, S);
    await B.page.waitForTimeout(2000);
    const n = S.row.orders.map(o => o.notes).join('|');
    rec('recovered on reopen + merged', n === 'offline note|other PC', n + ' errors:' + (S.errors || []).join());
    rec('workbooks untouched', S.row.settings.listWBs && S.row.settings.listWBs.L1 === 'BIGWORKBOOK', JSON.stringify(S.row.settings.listWBs));
    const p2 = await B.page.evaluate(() => localStorage.getItem('wpfPending'));
    rec('pending cleared after save', !p2, String(p2).slice(0, 50));
    await A.close();
  }
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
