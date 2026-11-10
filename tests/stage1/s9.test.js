const { H, makeServer, open } = require('./srv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
(async () => {
  const browser = await H.chromium.launch();
  {
    const S = makeServer({ id: 'main', version: 1, orders: [H.order({ wo: 'WO-1-1' }), H.order({ wo: 'WO-1-2' })], nid: 3, settings: {} });
    S.backups.push({ id: 99, taken_at: new Date(Date.now() - 40 * 86400000).toISOString(), orders_count: 1, payload: { orders: [] } });
    S.backups.push({ id: 98, taken_at: new Date(Date.now() - 3 * 86400000).toISOString(), orders_count: 1, payload: { orders: [] } });
    S.nextId = 100;
    const A = await open(browser, S, {});
    const out = await A.page.evaluate(async () => { localStorage.removeItem('wpfBakDay'); await tryDailyBackup(); showTab('s'); await new Promise(r => setTimeout(r, 300)); return document.getElementById('bak-last').textContent + '|' + document.getElementById('bak-last').style.color; });
    rec('daily backup written + verified', S.backups.some(b => b.id === 100 && b.orders_count === 2 && b.payload.orders.length === 2), JSON.stringify(S.backups.map(b => b.id)));
    rec('older than 30 days pruned (backups table only)', !S.backups.some(b => b.id === 99) && S.backups.some(b => b.id === 98) && !S.log.some(l => l.startsWith('DELETE /production_planner')), S.log.filter(l => l.startsWith('DELETE')).join());
    rec('settings shows last good backup (green)', /Last good backup: \d/.test(out) && !/c0392b|192, 57, 43/.test(out), out);
    const n = S.backups.length;
    await A.page.evaluate(async () => { localStorage.removeItem('wpfBakDay'); await tryDailyBackup(); });
    rec('second office screen same day does not duplicate', S.backups.length === n, S.backups.length + '');
    await A.close();
  }
  { // table missing
    const S = makeServer({ id: 'main', version: 1, orders: [H.order({ wo: 'WO-1-1' })], nid: 3, settings: {} }); S.noBackupTable = true;
    const A = await open(browser, S, {});
    const out = await A.page.evaluate(async () => { localStorage.removeItem('wpfBakDay'); await tryDailyBackup(); showTab('s'); await new Promise(r => setTimeout(r, 300)); return document.getElementById('bak-last').textContent + '|' + document.getElementById('bak-last').style.color + '|' + localStorage.getItem('wpfBakDay'); });
    rec('missing table: error surfaced in red, retried next time', /not set up yet/.test(out) && /rgb\(192, 57, 43\)/.test(out) && /\|null$/.test(out), out);
    await A.close();
  }
  { // stale backup -> red
    const S = makeServer({ id: 'main', version: 1, orders: [H.order({ wo: 'WO-1-1' })], nid: 3, settings: {} });
    S.backups.push({ id: 5, taken_at: new Date(Date.now() - 40 * 3600000).toISOString(), orders_count: 1, payload: { orders: [{}] } });
    const A = await open(browser, S, {});
    const out = await A.page.evaluate(async () => { showTab('s'); await new Promise(r => setTimeout(r, 300)); return document.getElementById('bak-last').textContent + '|' + document.getElementById('bak-last').style.color; });
    rec('backup older than 36h shown red', /older than 36/.test(out) && /192, 57, 43/.test(out), out);
    await A.close();
  }
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
