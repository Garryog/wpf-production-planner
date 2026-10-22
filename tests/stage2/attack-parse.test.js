// TESTER ATTACK (Stage 2): parsers, totals rows, WO keys, A/C suffixes, duplicates, steps, shipped wording.
// Pure analysis in the page (prepImport/analyzeImport) — Supabase stubbed by tests/harness.js, board never touched.
// Run: node tests/stage2/attack-parse.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const NOW = '2026-10-19T10:00:00Z';
(async () => {
  const t = await H.open({ now: NOW, row: { id: 'main', nid: 9, settings: {}, orders: [
    H.order({ wo: 'WO-2604-1', value: 4000, hours: 6, hoursEstimated: true, hoursSrc: 'est', step: '3. In production' }),
    H.order({ wo: '2557_01', value: 1000, hours: 1, hoursEstimated: true, hoursSrc: 'est', step: '3. In production' }),
    H.order({ wo: 'WO-9-1', step: '3. In production' }),
    H.order({ wo: 'WO-9-2', step: '3. In production' }),
    H.order({ wo: 'WO-9-3', step: '3. In production' }),
    H.order({ wo: 'WO-9-4', step: '3. In production' }),
    H.order({ wo: 'WO-9-5', step: '3. In production' }),
    H.order({ wo: 'WO-9-6', step: '3. In production' }),
  ] } });
  const P = (rows) => t.page.evaluate(rows => { const p = analyzeImport(prepImport(rows), 'file'); return p && JSON.parse(JSON.stringify(p)); }, rows);
  const ev = (fn, arg) => t.page.evaluate(fn, arg);

  // ---- dates
  const d = await ev(() => ({
    s46331: parseDateIE(46331), s46331pm: parseDateIE(46331.75), feb27: parseDateIE('29/02/2027'), feb28: parseDateIE('29/02/2028'),
    dmy2: parseDateIE('5/11/26'), dash: parseDateIE('05-11-2026'), dot: parseDateIE('05.11.2026'), mon: parseDateIE('5 Nov 2026'), mon2: parseDateIE('5-Nov-26'),
    iso: parseDateIE('2026-11-05'), isoT: parseDateIE('2026-11-05T00:00:00Z'), us: parseDateIE('11/05/2026'), txtSerial: parseDateIE('46331'),
    withTime: parseDateIE('05/11/2026 00:00'), withTime2: parseDateIE('05/11/2026 14:30:00'), dayName: parseDateIE('Thu 05/11/2026'), sept: parseDateIE('5 Sept 2026'),
  }));
  rec('dates: serial 46331 = 2026-11-05 (also with a time fraction)', d.s46331 === '2026-11-05' && d.s46331pm === '2026-11-05', JSON.stringify([d.s46331, d.s46331pm]));
  rec('dates: 29/02/2027 rejected, 29/02/2028 accepted', d.feb27 === null && d.feb28 === '2028-02-29', JSON.stringify([d.feb27, d.feb28]));
  rec('dates: d/m/yy, dashes, dots, month names, ISO, serial-as-text all = 5 Nov 2026', [d.dmy2, d.dash, d.dot, d.mon, d.mon2, d.iso, d.isoT, d.txtSerial, d.sept.replace('09', '11')].every(x => x === '2026-11-05') || [d.dmy2, d.dash, d.dot, d.mon, d.mon2, d.iso, d.isoT, d.txtSerial].every(x => x === '2026-11-05'), JSON.stringify(d));
  rec('dates: 11/05/2026 read Irish-style (11 May), never US', d.us === '2026-05-11', d.us);
  rec('dates: text date WITH a time ("05/11/2026 00:00") is read (Cienapps/Excel text exports often carry a time)', d.withTime === '2026-11-05' && d.withTime2 === '2026-11-05', JSON.stringify([d.withTime, d.withTime2]));
  rec('dates: "5 Sept 2026" read', d.sept === '2026-09-05', d.sept);

  // ---- numbers / hours
  const n = await ev(() => ({ a: parseNum('€12,500'), b: parseNum('12 500'), c: parseNum('(1,200)'), d: parseNum('-500'), e: parseNum('€12.500,00'), f: parseNum('12,5'), g: parseNum('EUR 1,000'), h: parseNum('1,000 EUR'),
    h1: parseHours('8,5'), h2: parseHours('8.5 hrs'), h3: parseHours('0'), h4: parseHours(''), h5: parseHours('-3') }));
  rec('value: "€12,500" and "12 500" = 12500', n.a === 12500 && n.b === 12500, JSON.stringify(n));
  rec('value: "(1,200)" (accounting negative) not silently read as a positive', n.c === null || Number.isNaN(n.c) || n.c === -1200, String(n.c));
  rec('value: European "€12.500,00" must NOT be silently read as 12.5', n.e !== 12.5, 'read as ' + n.e);
  rec('value: "12,5" (decimal comma) must NOT be silently read as 125', n.f !== 125, 'read as ' + n.f);
  rec('value: "1,000 EUR" read (trailing currency word)', n.h === 1000, String(n.h));
  rec('hours: "8,5" must NOT be silently read as 85h', !(n.h1 && n.h1.h === 85), JSON.stringify(n.h1));
  rec('hours: 0 / negative flagged bad, blank = not supplied', n.h3.bad && n.h5.bad && n.h4 === null, JSON.stringify([n.h3, n.h4, n.h5]));

  // ---- negative value on an existing job
  let p = await P([{ wo: 'WO-2604-1', value: -500, dueDate: '2026-11-02', step: '3. In production' }]);
  const u1 = p.updates.find(x => x.wo === 'WO-2604-1');
  rec('value: a negative value (credit) is flagged, not written over a job silently', !(u1 && u1.set.value === -500) || p.flagged.some(f => f.wo === 'WO-2604-1'), JSON.stringify(u1 && u1.set) + ' flagged=' + JSON.stringify(p.flagged));

  // ---- blank value AND blank hours on a new job
  p = await P([{ wo: 'WO-7000-1', value: '', hours: '', dueDate: '2026-11-02' }]);
  const nn = p.newOrders[0];
  rec('blank value + blank hours: new job gets 1h, value 0, no NaN', nn && nn.hours === 1 && nn.value === 0, JSON.stringify(nn));

  // ---- totals rows
  p = await P([{ wo: 'Total', value: 99999 }, { wo: 'TOTAL 245', value: 99999 }, { wo: 'Grand Total 245', value: 99999 }, { wo: 'Count: 245', value: 99999 }, { wo: '245 jobs', value: 99999 }, { wo: 'Sub-total (12)', value: 5 }, { wo: 'WO-7000-2', value: 1000, dueDate: '2026-11-02' }]);
  rec('totals: "Total" / "TOTAL 245" / "Sub-total (12)" skipped', !p.newOrders.some(o => /^(total|sub)/i.test(o.wo)), p.newOrders.map(o => o.wo).join());
  rec('totals: "Grand Total 245" / "Count: 245" / "245 jobs" are NOT added as jobs', !p.newOrders.some(o => /grand|count|jobs/i.test(o.wo)), 'added as new jobs: ' + p.newOrders.filter(o => /grand|count|jobs/i.test(o.wo)).map(o => o.wo + '(€' + o.value + ', ' + o.hours + 'h)').join(', '));

  // ---- WO keys
  p = await P([{ wo: 'wo-2604-1', value: 4000, dueDate: '2026-11-02', step: '3. In production' }, { wo: 2557.0, value: 1000, dueDate: '2026-11-02' }]);
  rec('WO: lowercase matches; nothing new', p.newOrders.filter(o => /2604/.test(o.wo)).length === 0, p.newOrders.map(o => o.wo).join());
  p = await P([{ wo: ' WO - 2604 - 1 ', value: 4000, dueDate: '2026-11-02' }, { wo: 'WO 2604 1', value: 4000, dueDate: '2026-11-02' }]);
  rec('WO: internal spaces ("WO - 2604 - 1") do not create a duplicate job', p.newOrders.length === 0, 'new: ' + p.newOrders.map(o => JSON.stringify(o.wo)).join(', '));
  p = await P([{ wo: 'WO-2604-1 ', value: 4000, dueDate: '2026-11-02' }]);
  rec('WO: non-breaking space at end does not create a duplicate', p.newOrders.length === 0, p.newOrders.map(o => JSON.stringify(o.wo)).join());

  // ---- A/C suffixes, base on board
  for (const [w, lbl] of [['2557_01A', 'A'], ['2557_01-C', '-C'], ['2557_01a', 'lowercase a'], ['2557_01 A', 'space A'], ['2557_01-a', '-a']]) {
    p = await P([{ wo: w, value: 200, dueDate: '2026-11-02' }]);
    rec('A/C (' + lbl + ' "' + w + '") base on board only: folded, not a new job', p.newOrders.length === 0 && p.folds.length === 1, 'new=' + p.newOrders.map(o => o.wo).join() + ' folds=' + p.folds.length);
  }
  // base and A in file, base not on board
  p = await P([{ wo: '3000_05B', value: 300, dueDate: '2026-11-02' }, { wo: '3000_05', value: 1000, dueDate: '2026-11-09' }]);
  rec('A/C: base + B both new in file → one job €1300', p.newOrders.length === 1 && p.newOrders[0].value === 1300, JSON.stringify(p.newOrders.map(o => [o.wo, o.value])));
  rec('A/C: B line due EARLIER than base — earliest due date kept on the folded job', p.newOrders[0] && p.newOrders[0].dueDate === '2026-11-02', 'due=' + (p.newOrders[0] && p.newOrders[0].dueDate));
  // base absent everywhere
  p = await P([{ wo: '3100_01A', value: 300, dueDate: '2026-11-02' }]);
  rec('A/C: base absent → own job, flagged base not found', p.newOrders.length === 1 && p.flagged.some(f => /not found/.test(f.why)), JSON.stringify(p.flagged));
  // A line shipped while base in production
  p = await P([{ wo: 'WO-2604-1C', value: 300, dueDate: '2026-11-02', step: '8. Job shipped' }]);
  rec('A/C: the addition line\'s own step (shipped) is at least shown/flagged, not silently dropped', p.flagged.some(f => /ship/i.test(f.why)) || p.folds.some(f => /ship/i.test(f.step)), JSON.stringify(p.folds));
  // false-positive: real WO with a letter that is NOT an addition, e.g. WO-BI / revision letters on board as own jobs
  p = await P([{ wo: 'WO-2604-1R', value: 50, dueDate: '2026-11-02', title: 'Remake' }]);
  console.log('INFO  A/C: "WO-2604-1R" (any trailing letter) folds=' + JSON.stringify(p.folds));

  // ---- duplicate WO 3x with different due dates
  p = await P([{ wo: 'WO-7100-1', value: 100, dueDate: '20/11/2026', step: '3. In production' }, { wo: 'WO-7100-1', value: 200, dueDate: '06/11/2026', step: '8. Job shipped' }, { wo: 'wo-7100-1 ', value: 300, dueDate: 46340 }]);
  rec('duplicate 3x: one job, earliest due (6 Nov), flagged', p.newOrders.length === 1 && p.newOrders[0].dueDate === '2026-11-06' && p.flagged.some(f => /duplicate/.test(f.why)), JSON.stringify(p.newOrders.map(o => [o.wo, o.dueDate, o.value, o.step])));
  rec('duplicate 3x: value is not silently the FIRST line only when lines differ (100 vs 200 vs 300) — at least flagged', p.flagged.some(f => /value/i.test(f.why)), 'value used=' + (p.newOrders[0] || {}).value + ' flags=' + JSON.stringify(p.flagged.map(f => f.why)));
  rec('duplicate 3x: one line says shipped, another in production — conflict is flagged', p.flagged.some(f => /step|ship/i.test(f.why)), 'step used=' + (p.newOrders[0] || {}).step);

  // ---- steps
  p = await P([
    { wo: 'WO-9-1', step: 'Ready to be shipped', dueDate: '2026-11-02' },
    { wo: 'WO-9-2', step: 'Part shipped', dueDate: '2026-11-02' },
    { wo: 'WO-9-3', step: 'Deposit invoiced', dueDate: '2026-11-02' },
    { wo: 'WO-9-4', step: 'Not shipped', dueDate: '2026-11-02' },
    { wo: 'WO-9-5', step: 'SHIPPED ', dueDate: '2026-11-02' },
    { wo: 'WO-9-6', step: 'Awaiting material', dueDate: '2026-11-02' },
  ]);
  const shp = p.shipped.map(s => s.wo);
  rec('steps: "SHIPPED " (caps, trailing space) → Shipped', shp.includes('WO-9-5'), shp.join());
  rec('steps: "Ready to be shipped" must NOT take a job in the factory off the board', !shp.includes('WO-9-1'), shp.join());
  rec('steps: "Part shipped" must NOT take the job off the board', !shp.includes('WO-9-2'), shp.join());
  rec('steps: "Deposit invoiced" must NOT take the job off the board', !shp.includes('WO-9-3'), shp.join());
  rec('steps: "Not shipped" must NOT take the job off the board', !shp.includes('WO-9-4'), shp.join());
  rec('steps: unknown wording ("Awaiting material") → Differs, nothing moves', p.stepDiffs.some(s => s.wo === 'WO-9-6') && !p.updates.some(u => u.wo === 'WO-9-6' && u.set.step), JSON.stringify(p.stepDiffs.filter(s => s.wo === 'WO-9-6')));
  p = await P([{ wo: 'WO-7200-1', step: 'Deposit invoiced', value: 9000, dueDate: '2026-11-20' }, { wo: 'WO-7200-2', step: 'Ready to be shipped', value: 9000, dueDate: '2026-11-20' }]);
  rec('steps: a NEW job at "Deposit invoiced" / "Ready to be shipped" is not silently left off the board', p.newOrders.length === 2, 'added=' + p.newOrders.map(o => o.wo).join() + ' excluded=' + JSON.stringify(p.exCounts));
  const sc = await ev(() => ({ a: stepCmp('10. Invoiced', '9. Job shipped'), b: stepCmp('Production complete', '3. In production'), c: stepCmp('3. In Production', '3. In production'), d: stepCmp('Pre-production drawing', 'In production') }));
  rec('steps: "10." ahead of "9."; unnumbered vs numbered uses ladder', sc.a > 0 && sc.b > 0 && sc.c === 0, JSON.stringify(sc));
  rec('steps: "Pre-production drawing" ranks as drawing (behind production), not production', sc.d < 0, JSON.stringify(sc));


  // where do new jobs with an unreadable due date / a digits-totals row land?
  const land = await ev(() => { const p = analyzeImport(prepImport([{ wo: 'WO-7300-1', value: 5000, dueDate: '29/02/2027' }, { wo: 'Grand Total 2', value: 250000, dueDate: '' }]), 'file'); applyImport(p); return DB.orders.filter(o => /7300|Grand/.test(o.wo)).map(o => [o.wo, o.dueDate, o.plannedWeek, o.hours, o.value]); });
  rec('new job with an impossible due date (29/02/2027) is NOT put into this week\'s capacity', !land.some(x => x[0] === 'WO-7300-1' && x[2] === '2026-10-19'), JSON.stringify(land));
  rec('a totals row with digits does not land in this week as a €250k job', !land.some(x => /Grand/.test(x[0])), JSON.stringify(land));
  rec('no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
  await t.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
