// Round 3 (after Tester attack 4): two P-numbers for one house are FLAGGED, never removed by themselves. Lists home shows
// "⚠ Two P-numbers for one house" with "Keep one…": dropping a job is refused unless it is bare (no list, booking, date
// changes, log entries, made within the hour); a dropped job's full copy goes into settings pMerged. A Cienapps WO for a
// P-job's house is only shown. Fake Supabase only. Run: node tests/seq/l4-keepone.test.js
const X = require('./fixs.js');
const { H, rec, sleep } = X;
const NOW = X.NOW;
const P = (o, x) => Object.assign({ customer: 'Aderrig Homes', pid: 'P1', floor: 'T09', dueDate: '2026-12-10', origDueDate: '2026-12-10', step: 'Planner WO', hours: 4, value: 0, plannedWeek: '', notes: '',
  log: [{ at: new Date(Date.parse(NOW) - 5 * 60e3).toISOString(), by: 'Op', what: 'Work order created with a typed cutting list' }] }, o, x || {});
(async () => {
  const browser = await H.chromium.launch();
  try {
    const row = X.v2Row();
    row.orders.push(P({ wo: 'P-1001', unit: '95', title: 'HOUSE TYPE K' }), P({ wo: 'P-1002', unit: '95', title: 'HOUSE TYPE K <img src=x onerror="window.__x=1">' }),
      P({ wo: 'P-1003', unit: '96', title: 'HOUSE TYPE K' }), { wo: 'WO-96', customer: 'Aderrig Homes', floor: 'T9', unit: '096', title: 'HOUSE TYPE K KITCHEN', dueDate: '2026-12-01', origDueDate: '2026-12-01', step: '1. NEW', hours: 1, value: 0, plannedWeek: '' },
      P({ wo: 'P-1004', unit: '97', title: 'HOUSE TYPE K', delVeh: 'Van 1', delDay: '2026-11-05' }), P({ wo: 'P-1005', unit: '97', title: 'HOUSE TYPE K' }));
    const S = X.makeServer(row);
    X.F3.seedList(S, 'LK2', { wos: ['P-1002'], name: 'House 95 B' });
    const t = await X.dev(browser, S, 'office'), p = t.page;
    await p.evaluate(() => { window.__alerts = []; window.alert = m => window.__alerts.push(m); window.confirm = () => true; showTab('l'); render(); }); await sleep(400);
    const fl = await p.evaluate(() => [...document.querySelectorAll('.p-flag')].map(x => x.innerText.replace(/\s+/g, ' ')));
    rec('Lists home: "Two P-numbers for one house — P-1001 / P-1002" and P-1004 / P-1005 flagged, with Keep one…', fl.some(x => /Two P-numbers for one house — P-1001 · not from Cienapps \/ P-1002/.test(x) && /Keep one/.test(x)) && fl.some(x => /P-1004.*P-1005/.test(x)), JSON.stringify(fl));
    rec('a Cienapps WO for P-1003\'s house is only shown (WO-96), nothing moved', fl.some(x => /A Cienapps WO now exists for the house of P-1003 · not from Cienapps: WO-96/.test(x)) && (S.row.orders.find(o => o.wo === 'P-1003')), JSON.stringify(fl));
    rec('titles escaped in the flags', await p.evaluate(() => window.__x === undefined && !document.querySelector('.p-flags img')));
    const keep = async (k, d) => { await p.evaluate(({ k, d }) => { document.querySelector('[data-pkeep*="' + k + '"][data-pkeep*="' + d + '"]').click(); }, { k, d }); await sleep(200);
      await p.evaluate(({ k, d }) => document.querySelector('[data-pk="' + k + '|' + d + '"]').click(), { k, d }); await sleep(800); };
    // drop P-1002 (it has a list): refused, says why
    await keep('P-1001', 'P-1002');
    let a = await p.evaluate(() => ({ al: window.__alerts.slice(), wos: DB.orders.map(o => o.wo) }));
    rec('Keep P-1001, drop P-1002 (it has a cutting list): refused, both stay', /P-1002 can't be dropped — it has a cutting list/.test(a.al.pop() || '') && a.wos.includes('P-1001') && a.wos.includes('P-1002'), JSON.stringify(a));
    // drop P-1005 vs P-1004 with the van booking: keep P-1005, drop P-1004 → refused
    await keep('P-1005', 'P-1004');
    a = await p.evaluate(() => ({ al: window.__alerts.slice(), wos: DB.orders.map(o => o.wo) }));
    rec('dropping P-1004 (booked on a van): refused', /P-1004 can't be dropped — it has a van \/ delivery booking/.test(a.al.pop() || '') && a.wos.includes('P-1004'), JSON.stringify(a.al));
    // keep P-1002, drop the bare P-1001: done, copy in pMerged, log on P-1002
    await keep('P-1002', 'P-1001');
    a = await p.evaluate(() => ({ wos: DB.orders.map(o => o.wo), pm: DB.pMerged, log: (DB.orders.find(o => o.wo === 'P-1002').log || []).map(x => x.what).join(' | ') }));
    rec('Keep P-1002, drop the bare P-1001: dropped, its full copy in settings pMerged, logged on P-1002', !a.wos.includes('P-1001') && a.pm && a.pm.length === 1 && a.pm[0].wo === 'P-1001' && a.pm[0].into === 'P-1002' && a.pm[0].job.unit === '95' && /P-1001 .*dropped — kept P-1002/.test(a.log), JSON.stringify(a).slice(0, 400));
    await sleep(2500); await p.evaluate(async () => { await saveDB(); }); await sleep(1000);
    rec('saved: the planner record has no P-1001 and keeps the copy in settings.pMerged', !S.row.orders.some(o => o.wo === 'P-1001') && (S.row.settings.pMerged || []).length === 1);
    rec('the flag for house 95 is gone', await p.evaluate(() => { render(); return ![...document.querySelectorAll('.p-flag')].some(x => /P-1001/.test(x.innerText)); }));
    // an old job (made yesterday) is never dropped even when bare
    await p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'P-1005'); o.log[0].at = '2026-10-20T08:00:00Z'; });
    await keep('P-1004', 'P-1005');
    a = await p.evaluate(() => ({ al: window.__alerts.slice(), wos: DB.orders.map(o => o.wo) }));
    rec('dropping a job more than an hour old: refused', /it is more than an hour old/.test(a.al.pop() || '') && a.wos.includes('P-1005'), JSON.stringify(a.al));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await t.close();
    // a page loaded later keeps pMerged; switch off: no flags
    const S0 = X.makeServer(X.v1Row()); const o0 = await X.dev(browser, S0, 'office');
    rec('switch off: no P-number flags', await o0.page.evaluate(() => pFlagsHTML() === ''));
    await o0.close();
  } finally { await browser.close(); }
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
