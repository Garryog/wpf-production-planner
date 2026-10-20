const { H, makeServer, open } = require('./srv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const NOW = '2026-10-19T10:00:00Z';
const row = () => ({ id: 'main', version: 1, orders: [H.order({ wo: 'WO-1-1' }), H.order({ wo: 'WO-1-2' })], nid: 3, settings: {} });
(async () => {
  const browser = await H.chromium.launch();
  for (const versioned of [true, false]) {
    const r = row(); if (!versioned) delete r.version;
    const S = makeServer(r, { versioned });
    const A = await open(browser, S, { now: NOW });
    S.failSaves = true;
    await A.page.evaluate(async () => { DB.orders[0].notes = 'A note'; await saveDB(); });
    S.row.orders = [H.order({ wo: 'WO-1-1' }), H.order({ wo: 'WO-1-2', notes: 'B important' }), H.order({ wo: 'WO-NEW-9' })]; if (versioned) S.row.version = 5;
    // refresh while failing: merges, keeps local edit
    await A.page.evaluate(async () => { await loadDB(); });
    const loc = await A.page.evaluate(() => DB.orders.map(o => o.wo + ':' + (o.notes || '')).join(','));
    rec((versioned ? 'v ' : 'legacy ') + 'refresh merges local unsaved edit', loc === 'WO-1-1:A note,WO-1-2:B important,WO-NEW-9:', loc);
    S.failSaves = false;
    // more remote changes before retry
    S.row.orders.push(H.order({ wo: 'WO-NEW-10' })); if (versioned) S.row.version = 6;
    await A.page.evaluate(async () => { await saveDB(); });
    const srv = S.row.orders.map(o => o.wo + ':' + (o.notes || '')).join(',');
    rec((versioned ? 'v ' : 'legacy ') + 'retry merges, nothing lost', srv === 'WO-1-1:A note,WO-1-2:B important,WO-NEW-9:,WO-NEW-10:', srv);
    await A.close();
  }
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
