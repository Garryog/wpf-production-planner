// Coder check: device copy is a small diff, works for 2,500 jobs, and is honest when storage fails.
const { H, makeServer, open, reopen } = require('./srv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
(async () => {
  const browser = await H.chromium.launch();
  const orders = []; for (let i = 0; i < 2500; i++) orders.push(H.order({ wo: 'WO-' + i, log: Array.from({ length: 20 }, (_, j) => ({ at: '2026-10-01', by: 'x', what: 'edit ' + j })) }));
  const S = makeServer({ id: 'main', version: 1, orders, nid: 3, settings: { listRow: { L1: { a: { m: 'saw' } } }, delArchive: { big: { jobs: orders.slice(0, 500) } } } });
  const A = await open(browser, S, {});
  S.offline = true;
  await A.page.evaluate(async () => { for (let i = 0; i < 40; i++) DB.listRow['L' + i] = Object.assign(DB.listRow['L' + i] || {}, { ['r' + i]: { m: 'saw', by: 'x' } }); DB.orders[100].notes = 'off'; DB.orders.splice(7, 1); await saveDB(); });
  const p = await A.page.evaluate(() => localStorage.getItem('wpfPending') || '');
  rec('2,500-job plan: device copy well under 2 MB', p.length > 0 && p.length < 2e6, Math.round(p.length / 1024) + ' KB (plan ' + Math.round(JSON.stringify(S.row).length / 1024) + ' KB)');
  S.row.orders[200].notes = 'other PC'; S.row.version = 2;
  await A.page.close(); S.offline = false;
  const B = await reopen(A, S); await B.page.waitForTimeout(2500);
  const o = S.row.orders;
  rec('reopen: diff merged in', o.length === 2499 && o.find(x => x.wo === 'WO-100').notes === 'off' && o.find(x => x.wo === 'WO-200').notes === 'other PC' && !o.some(x => x.wo === 'WO-7') && Object.keys(S.row.settings.listRow).length === 40, o.length + ' jobs, lists ' + Object.keys(S.row.settings.listRow).length);
  await A.close();
  // storage throws
  const S2 = makeServer({ id: 'main', version: 1, orders: [H.order({ wo: 'WO-1' })], nid: 3, settings: {} });
  const C = await open(browser, S2, {});
  S2.offline = true;
  const bar = await C.page.evaluate(async () => { const si = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'wpfPending') throw new DOMException('full', 'QuotaExceededError'); return si.call(this, k, v); }; DB.orders[0].notes = 'x'; await saveDB(); return document.getElementById('savebar').textContent; });
  rec('storage full: bar says NOT kept on device', /could NOT keep/.test(bar), bar);
  await C.close();
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
