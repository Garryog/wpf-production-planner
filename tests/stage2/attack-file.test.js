// TESTER ATTACK (Stage 2): real-shaped Cienapps .xlsx files through doImport → preview → Apply.
// Header on row 1/5/13, trailing-space headers, totals rows, re-import 3x, hand-moved week, 2,500 rows.
// Supabase stubbed (tests/harness.js). Run: node tests/stage2/attack-file.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const NOW = '2026-10-19T10:00:00Z';
const HDR = ['WO # ', ' Title', 'Customer  ', 'DUE DATE ', 'Step ', 'Sub-Total ', 'Reference'];
const title = n => Array.from({ length: n }, (_, i) => i === 0 ? ['Western Postform Ltd — Open Orders Report'] : i === 1 ? ['Printed 19/10/2026'] : ['']);
(async () => {
  const browser = await H.chromium.launch();
  let t;
  const apply = p => p.evaluate(async () => { const b = document.getElementById('imp-apply'); if (!b) return 'no apply button'; await b.onclick(); return 'ok'; });
  const body = [
    ['WO-2610-1', 'Kitchen 1', "O'Grady Homes", 46331, '3. In production', '€12,500', '2610-1-0-1'],
    [2611, 'Wardrobes', 'Smith & Sons <b>', '06/11/2026', '4. Assembly', '9 800', '2611-1-1-2'],
    ['wo-2612-1 ', 'Vanity', 'Café Ltd 😀', '2026-11-20', '3. In production', 1500, ''],
    ['WO-2612-1A', 'Extra doors', 'Café Ltd 😀', '2026-11-20', '3. In production', 500, ''],
    ['', '', '', '', '', '', ''],
    ['WO-S-12', 'Snag', 'X', 46331, '3. In production', 10, ''],
    ['Total', '', '', '', '', 24310, ''],
  ];
  for (const at of [0, 4, 12]) {
    t = await H.open({ browser, now: NOW });
    const r = await H.importAoa(t.page, [...title(at), HDR, ...body]);
    const ok = r.plan && r.plan.newOrders.length === 3 && r.plan.folds.length === 1 && r.plan.counts.snag === 1 && r.plan.counts.totals === 1;
    rec('header on row ' + (at + 1) + ' with trailing spaces/caps: 3 new, 1 fold, snag + totals skipped', ok, r.plan ? JSON.stringify({ n: r.plan.newOrders.map(o => o.wo + '=' + o.value + '/' + o.dueDate), c: r.plan.counts }) : r.iprev.slice(0, 200));
    if (at === 12) {
      const a = await apply(t.page);
      const v = await t.page.evaluate(() => DB.orders.map(o => [o.wo, o.value, o.dueDate, o.plannedWeek, o.floor, o.unit]));
      rec('apply: WO 2611 stored as text, values read, due weeks set', a === 'ok' && v.length === 3 && v.some(x => x[0] === '2611' && x[1] === 9800 && x[2] === '2026-11-06'), JSON.stringify(v));
      const html = await t.page.evaluate(() => { showTab('b'); return { inj: !!document.querySelector('#app b') && [...document.querySelectorAll('#app b')].some(b => b.parentElement && /Smith/.test(b.parentElement.textContent) && b.textContent === ''), txt: document.getElementById('app').innerText.includes('Smith & Sons <b>') }; });
      rec('customer "Smith & Sons <b>" shows as text, no HTML injected', html.txt, JSON.stringify(html));
    }
    await t.close();
  }

  // Columns reordered + extra columns + missing optional columns
  t = await H.open({ browser, now: NOW });
  let r = await H.importAoa(t.page, [['Extra', 'Due date', 'Status', 'Sales Rep', 'WO', 'Junk', 'Value'], ['x', 46331, '3. In production', 'Pat', 'WO-1-1', 'y', 1000], ['x', 46331, '3. In production', 'Pat', 'WO-1-2', 'y', 2000]]);
  rec('reordered/extra columns map correctly', r.plan && r.plan.newOrders.length === 2 && r.plan.newOrders[1].value === 2000 && r.plan.newOrders[0].salesRep === 'Pat', JSON.stringify(r.plan && r.plan.newOrders.map(o => [o.wo, o.value, o.salesRep])));
  await t.close();

  // "Total" in the header row as the VALUE column alias: a Cienapps file with both "Sub-Total" and "Total" columns
  t = await H.open({ browser, now: NOW });
  r = await H.importAoa(t.page, [['WO #', 'Title', 'Due Date', 'Total', 'Sub-Total'], ['WO-1-1', 'a', 46331, 12300, 10000], ['WO-1-2', 'b', 46331, 2460, 2000]]);
  rec('both "Total" (incl. VAT) and "Sub-Total" columns: Sub-Total (net) is used', r.plan && r.plan.newOrders[0].value === 10000, JSON.stringify(r.plan && r.plan.newOrders.map(o => o.value)));
  await t.close();

  // Totals row with digits in the WO cell (common in Excel exports)
  t = await H.open({ browser, now: NOW });
  r = await H.importAoa(t.page, [HDR, ['WO-1-1', 'a', 'c', 46331, '3. In production', 1000, ''], ['Grand Total: 1 orders', '', '', '', '', 1000, '']]);
  rec('totals row "Grand Total: 1 orders" is not imported as a job', r.plan && r.plan.newOrders.length === 1, JSON.stringify(r.plan && r.plan.newOrders.map(o => o.wo)));
  await t.close();

  // Re-import the same file 3x (with a fold, a Keep decision, a hand-moved week, hand hours): nothing changes, nothing exported
  {
    const orders = [
      H.order({ wo: 'WO-3-1', plannedWeek: '2026-11-09', dueDate: '2026-11-02', origDueDate: '2026-11-02', hours: 20, hoursEstimated: false, hoursSrc: 'hand', value: 5000, step: '3. In production' }),
      H.order({ wo: 'WO-3-2', plannedWeek: '2026-10-26', dueDate: '2026-11-02', origDueDate: '2026-11-02', hours: 6, hoursEstimated: true, hoursSrc: 'est', value: 4000, step: '4. Assembly' }),
      H.order({ wo: 'WO-3-3', plannedWeek: '2026-10-26', dueDate: '2026-11-05', origDueDate: '2026-11-05', hours: 6, hoursEstimated: true, value: 4000, step: '3. In production' }),
    ];
    t = await H.open({ browser, now: NOW, row: { id: 'main', nid: 4, orders, settings: { exportBase: { wk: { 'WO-3-1': '2026-10-26', 'WO-3-2': '2026-10-26', 'WO-3-3': '2026-10-26' }, st: { 'WO-3-1': '3. In production', 'WO-3-2': '3. In production', 'WO-3-3': '3. In production' } } } } });
    const file = [HDR,
      ['WO-3-1', 'Job', 'Cust', 46331, '3. In production', 5000, ''],
      ['WO-3-2', 'Job', 'Cust', 46328, '3. In production', 4000, ''], // planner ahead
      ['WO-3-3', 'Job', 'Cust', '12/11/2026', '4. Assembly', 4000, ''],   // date differs (Keep), Cienapps ahead
      ['WO-3-3A', 'Extra', 'Cust', '12/11/2026', '4. Assembly', 800, ''],  // addition
      ['WO-4-1', 'New', 'Cust', '20/11/2026', '3. In production', 7000, ''],
      ['WO-4-1', 'New', 'Cust', '13/11/2026', '3. In production', 7000, ''],
    ];
    const ch0 = await t.page.evaluate(() => changes().map(o => o.wo).sort().join());
    r = await H.importAoa(t.page, file);
    await t.page.evaluate(() => { const k = document.querySelector('[data-dk="WO-3-3"][value="keep"]'); if (k) k.checked = true; });
    await apply(t.page);
    const s1 = await t.page.evaluate(() => JSON.stringify(DB.orders.map(o => { const c = { ...o }; delete c.log; return c; })));
    const ch1 = await t.page.evaluate(() => changes().map(o => o.wo + ':' + (orig[o.wo] || '') + '>' + (o.plannedWeek || '') + ':' + (origStep[o.wo] || '') + '>' + (o.step || '')).sort().join(' | '));
    const runs = [];
    for (let i = 0; i < 3; i++) {
      const ri = await H.importAoa(t.page, file);
      runs.push({ upd: ri.plan.updates.map(u => u.wo + ':' + u.what), add: ri.plan.newOrders.length, sh: ri.plan.shipped.length, fills: ri.plan.fills.map(f => f.wo + ':' + Object.keys(f.set)) });
      await apply(t.page);
    }
    const s4 = await t.page.evaluate(() => JSON.stringify(DB.orders.map(o => { const c = { ...o }; delete c.log; return c; })));
    const ch4 = await t.page.evaluate(() => changes().map(o => o.wo + ':' + (orig[o.wo] || '') + '>' + (o.plannedWeek || '') + ':' + (origStep[o.wo] || '') + '>' + (o.step || '')).sort().join(' | '));
    rec('re-import 3x: no updates, no additions, no fills on runs 2-4', runs.every(x => !x.upd.length && !x.add && !x.sh && !x.fills.length), JSON.stringify(runs));
    rec('re-import 3x: board data identical after runs 2-4', s1 === s4, s1 === s4 ? '' : 'changed');
    rec('re-import 3x: Export Changes identical (only planner-made changes)', ch1 === ch4, 'after 1: ' + ch1 + ' || after 4: ' + ch4);
    const st = await t.page.evaluate(() => DB.orders.map(o => [o.wo, o.plannedWeek, o.hours, o.step, o.dueDate, o.dueKeep || '', o.value]));
    rec('hand-moved week (WO-3-1 wk 9 Nov) and hand 20h kept', st[0][1] === '2026-11-09' && st[0][2] === 20, JSON.stringify(st[0]));
    rec('WO-3-3: Keep date remembered, Cienapps step taken, value 4000+800', st[2][4] === '2026-11-05' && st[2][5] === '2026-11-12' && st[2][3] === '4. Assembly' && st[2][6] === 4800, JSON.stringify(st[2]));
    rec('WO-3-3 step change from Cienapps NOT in Export Changes', !/WO-3-3:/.test(ch4), ch4);
    rec('WO-3-2 planner ahead → in Export Changes', /WO-3-2:/.test(ch4), ch4);
    const n41 = await t.page.evaluate(() => DB.orders.filter(o => o.wo === 'WO-4-1').map(o => [o.dueDate, o.plannedWeek]));
    rec('duplicate new WO-4-1: one job, earliest due 13 Nov, planned in its due week', n41.length === 1 && n41[0][0] === '2026-11-13' && n41[0][1] === '2026-11-09', JSON.stringify(n41));
    // hand move AFTER import, then re-import: week must not move
    await t.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-4-1'); o.plannedWeek = '2026-12-07'; });
    await H.importAoa(t.page, file); await apply(t.page);
    const w41 = await t.page.evaluate(() => DB.orders.find(x => x.wo === 'WO-4-1').plannedWeek);
    rec('hand-moved after import, re-imported: week stays', w41 === '2026-12-07', w41);
    // Cancel changes nothing
    const before = await t.page.evaluate(() => JSON.stringify(DB.orders));
    await H.importAoa(t.page, [HDR, ['WO-3-1', 'CHANGED', 'Cust', 46340, '9. Invoiced', 99999, '']]);
    const after = await t.page.evaluate(() => { document.getElementById('imp-cancel').click(); return JSON.stringify(DB.orders); });
    rec('Cancel changes nothing', before === after);
    rec('no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }

  // 2,500 rows (realistic: 2,000 on the board, 500 new) — analyse + apply time
  {
    const orders = Array.from({ length: 2000 }, (_, i) => H.order({ wo: 'WO-' + (5000 + i) + '-1', value: 3000 + i, hours: 5, hoursEstimated: true, hoursSrc: 'est', step: '3. In production', dueDate: '2026-11-0' + (1 + i % 9) }));
    t = await H.open({ browser, now: NOW, row: { id: 'main', nid: 3, orders, settings: {} } });
    const rows = [HDR, ...Array.from({ length: 2500 }, (_, i) => ['WO-' + (5000 + i) + '-1', 'Job ' + i, 'Cust ' + (i % 40), 46331 + (i % 30), i % 7 === 0 ? '9. JOB SHIPPED' : '3. In production', 3000 + i, ''])];
    const t0 = Date.now();
    r = await H.importAoa(t.page, rows);
    await t.page.waitForFunction(() => !!IMPPLAN, null, { timeout: 30000 }).catch(() => {});
    const t1 = Date.now();
    const ap = await t.page.evaluate(async () => { const s = performance.now(); await document.getElementById('imp-apply').onclick(); const a = performance.now() - s; const s2 = performance.now(); showTab('b'); return { apply: Math.round(a), board: Math.round(performance.now() - s2), n: DB.orders.length, sh: DB.orders.filter(isShipped).length }; });
    rec('2,500 rows: preview < 8 s, apply + board render < 8 s, 2,428 jobs (72 new-and-shipped not added), 286 shipped', t1 - t0 < 8000 && ap.apply + ap.board < 8000 && ap.n === 2428 && ap.sh === 286, 'preview ' + (t1 - t0) + 'ms ' + JSON.stringify(ap));
    await t.close();
  }

  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
