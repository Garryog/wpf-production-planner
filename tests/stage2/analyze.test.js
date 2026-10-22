// Stage 2 step 4: analyzeImport ownership rules, step rank, snags, shipped, A/C values — the plan only (board untouched).
// Run: node tests/stage2/analyze.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
(async () => {
  const orders = [
    H.order({ wo: 'WO-1-1', hours: 20, hoursEstimated: false, value: 5000, step: '3. In production' }),            // hand hours
    H.order({ wo: 'WO-1-2', hours: 7, hoursEstimated: true, value: 5000, step: '4. Assembly' }),                // planner ahead
    H.order({ wo: 'WO-1-3', hours: 7, hoursEstimated: true, value: 5000, step: '3. In production' }),           // cienapps ahead
    H.order({ wo: 'WO-S-55', title: 'Snag kit', step: '3. In production' }),                                   // snag
    H.order({ wo: 'WO-1-4', step: '3. In production', delv: true, delVeh: 'IVECO', delDay: 'Tue' }),            // shipped, on van
    H.order({ wo: 'WO-1-5', step: 'Custom stage' }),                                                         // can't rank
    H.order({ wo: 'WO-1-6', value: 3000, hours: 3, hoursEstimated: true, dueDate: '2026-11-05' }),            // base of an A line
  ];
  const t = await H.open({ now: '2026-10-19T10:00:00Z', row: { id: 'main', orders, nid: 9, settings: {} } });
  const before = await t.page.evaluate(() => JSON.stringify(DB.orders));
  const p = await t.page.evaluate(() => {
    const rows = [
      { wo: 'WO-1-1', value: 5000, hours: 12, step: '3. In production', dueDate: '2026-11-02' },
      { wo: 'WO-1-2', value: 5000, step: '3. In production', dueDate: '2026-11-02' },
      { wo: 'WO-1-3', value: 5000, step: '4. Assembly', dueDate: '2026-11-02' },
      { wo: 'WO-S-55', value: 1, step: 'Job shipped', dueDate: '2026-11-02' },
      { wo: 'WO-S-56', value: 1, step: '3. In production', dueDate: '2026-11-02' },
      { wo: 'WO-1-4', value: 4000, step: '9. JOB SHIPPED', dueDate: '2026-11-02' },
      { wo: 'WO-1-5', value: 4000, step: '3. In production', dueDate: '2026-11-02' },
      { wo: 'WO-1-6A', value: 2000, title: 'extra doors', dueDate: '2026-11-05' },
      { wo: 'WO-1-6', value: 3000, dueDate: '2026-11-05' },
      { wo: 'WO-2-1', value: '', hours: 12, dueDate: '2026-11-20' },
    ];
    return analyzeImport(prepImport(rows), 'file');
  });
  const after = await t.page.evaluate(() => JSON.stringify(DB.orders));
  const u = w => p.updates.find(x => x.wo === w);
  rec('analyze does not touch the board', before === after);
  rec('AC10 hand-set 20h kept; Cienapps hours only noted', !u('WO-1-1') || !('hours' in u('WO-1-1').set), JSON.stringify(u('WO-1-1')));
  rec('AC23 planner step ahead stays (listed in Differs)', !u('WO-1-2') || !('step' in u('WO-1-2').set), JSON.stringify(p.stepDiffs.find(s => s.wo === 'WO-1-2')));
  rec('Cienapps step ahead moves the planner forward', u('WO-1-3') && u('WO-1-3').set.step === '4. Assembly', JSON.stringify(u('WO-1-3')));
  rec('AC22 snag WOs ignored: not new, not updated, counted', !p.newOrders.some(o => /WO-S/.test(o.wo)) && !p.updates.some(x => /WO-S/.test(x.wo)) && p.counts.snag === 2, 'snag=' + p.counts.snag);
  rec('AC21 shipped job listed for the Shipped tab; on-van job shown as staying on Deliveries', p.shipped.some(s => s.wo === 'WO-1-4' && s.onVan) && p.inTransit.some(s => s.wo === 'WO-1-4'), JSON.stringify(p.shipped));
  rec("unrankable step goes to Differs and doesn't move", p.stepDiffs.some(s => s.wo === 'WO-1-5' && /can't tell/.test(s.why)) && !(u('WO-1-5') && 'step' in u('WO-1-5').set), JSON.stringify(p.stepDiffs));
  rec('AC25 A line folded: base value 3000+2000, hours re-estimated, listed as Addition', u('WO-1-6') && u('WO-1-6').set.value === 5000 && u('WO-1-6').set.hours === 7 && p.folds.some(f => f.wo === 'WO-1-6A' && f.base === 'WO-1-6') && !p.newOrders.some(o => o.wo === 'WO-1-6A'), JSON.stringify(u('WO-1-6')) + ' fills=' + JSON.stringify(p.fills.find(f => f.wo === 'WO-1-6')));
  rec('AC7 Hours column used when value blank', p.newOrders.find(o => o.wo === 'WO-2-1').hours === 12 && p.newOrders.find(o => o.wo === 'WO-2-1').hoursSrc === 'cien', JSON.stringify(p.newOrders.find(o => o.wo === 'WO-2-1')));
  rec('no removals in any plan', p.removals.length === 0);
  rec('no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
  await t.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
