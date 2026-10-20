const { H, makeServer, open } = require('./srv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
(async () => {
  const browser = await H.chromium.launch();
  const S = makeServer({ id: 'main', version: 1, orders: [H.order({ wo: 'WO-1-1', delv: true, delVeh: 'v1', delDay: 'Mon' }), H.order({ wo: 'WO-1-2' })], nid: 3, settings: {} });
  const A = await open(browser, S, {});
  const msgs = await A.page.evaluate(async () => {
    const seen = []; window.confirm = m => { seen.push(m); return true; }; window.prompt = m => { seen.push(m); return 'DELETE'; };
    showTab('d'); document.getElementById('btn-delreset').click(); await new Promise(r => setTimeout(r, 800));
    showTab('b'); const b = document.getElementById('btn-clearall'); if (b) { b.click(); await new Promise(r => setTimeout(r, 800)); }
    return seen;
  });
  rec('confirm texts mention backup', msgs.length >= 2 && msgs.every(m => /backup/i.test(m)), msgs.map(m => m.slice(0, 60)).join(' || '));
  rec('backup rows taken before Clear Week and Clear all', S.backups.length === 2 && S.backups[0].orders_count === 2 && /Clear Week/.test(S.backups[0].reason) && /Clear all/.test(S.backups[1].reason), S.backups.map(b => b.reason + ':' + b.orders_count).join());
  await A.page.waitForTimeout(1500);
  rec('clear all still works', S.row.orders.length === 0, S.row.orders.length + '');
  // backup failure -> asked, can cancel
  S.noBackupTable = true; S.row.orders = [H.order({ wo: 'WO-9' })]; S.row.version++;
  const r = await A.page.evaluate(async () => { await loadDB(); const seen = []; window.confirm = m => { seen.push(m); return !/FAILED/.test(m); }; window.prompt = () => 'DELETE'; showTab('b'); document.getElementById('btn-clearall').click(); await new Promise(r => setTimeout(r, 800)); return { seen, n: DB.orders.length }; });
  rec('backup failure: user asked, cancel keeps data', r.n === 1 && r.seen.some(m => /FAILED/.test(m)), JSON.stringify(r).slice(0, 200));
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
