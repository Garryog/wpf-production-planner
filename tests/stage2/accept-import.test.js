// Stage 2 acceptance checks 1–17, 25, 26 (docs/PLAN-stage2-imports.md) through the real import path:
// Excel file → doImport → preview plan → applyImport. Stubbed Supabase only (tests/harness.js).
// Run: node tests/stage2/accept-import.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const HDR = ['WO #', 'Title', 'Customer', 'Due Date', 'Step', 'Sub-Total', 'Reference'];
(async () => {
  const browser = await H.chromium.launch();
  const fresh = (orders = [], settings = {}) => H.open({ browser, now: '2026-10-19T10:00:00Z', row: { id: 'main', orders, nid: 5, settings } });
  let t, r;

  // AC1 messy headers (Excel serial 46330 = Wed 4 Nov 2026)
  t = await fresh();
  r = await H.importAoa(t.page, [['Cienapps export'], [], ['  Due Date ', 'EXTRA', 'wo #  ', 'TITLE', 'customer ', 'Step', 'SUB-TOTAL '], [46330, 'x', 'WO-2604-1', 'Kitchen A', 'Acme', '3. In production', 5000]]);
  let o = r.plan && r.plan.newOrders[0];
  rec('AC1 messy, reordered headers with spaces map correctly', o && o.wo === 'WO-2604-1' && o.dueDate === '2026-11-04' && o.customer === 'Acme' && o.title === 'Kitchen A' && o.step === '3. In production' && o.value === 5000, JSON.stringify(o));
  await t.close();

  // AC2 totals row
  t = await fresh();
  r = await H.importAoa(t.page, [HDR, ['WO-2604-1', 'K1', 'Acme', 46330, '3. In production', 5000, ''], ['WO-2604-2', 'K2', 'Acme', 46331, '3. In production', 6000, ''], ['Total', '', '', '', '', 11000, '']]);
  rec('AC2 a "Total" row is not imported', r.plan && r.plan.newOrders.length === 2 && r.plan.counts.totals === 1, r.plan && r.plan.newOrders.map(x => x.wo).join());
  await t.close();

  // AC3 duplicate WO in one file
  t = await fresh();
  r = await H.importAoa(t.page, [HDR, ['WO-2604-1', 'K1', 'Acme', 46337, '3. In production', 5000, ''], ['WO-2604-1', 'K1 again', 'Acme', 46330, '3. In production', 5000, '']]);
  let n3 = await t.page.evaluate(() => { applyImport(IMPPLAN); return DB.orders.filter(o => o.wo === 'WO-2604-1').map(o => o.dueDate); });
  rec('AC3 same WO twice → one job, earliest due date, flagged', n3.length === 1 && n3[0] === '2026-11-04' && r.plan.flagged.some(f => /duplicate in file/.test(f.why)), JSON.stringify(n3) + ' ' + JSON.stringify(r.plan.flagged));
  await t.close();

  // AC4 numeric WO and lower case
  t = await fresh([H.order({ wo: '1234', dueDate: '2026-11-05', value: 5000 }), H.order({ wo: 'WO-2604-1', dueDate: '2026-11-05', value: 4000 })]);
  r = await H.importAoa(t.page, [HDR, [1234, 'Job', 'Cust', 46331, '3. In production', 5000, ''], ['wo-2604-1', 'Job', 'Cust', 46331, '3. In production', 4000, '']]);
  rec('AC4 1234 matches "1234"; "wo-2604-1" matches "WO-2604-1"', r.plan && r.plan.newOrders.length === 0 && r.plan.counts.skipped === 2, 'new=' + (r.plan && r.plan.newOrders.map(x => x.wo)));
  await t.close();

  // AC5 same file twice
  t = await fresh();
  const f5 = [HDR, ['WO-2604-1', 'K1', 'Acme', 46330, '3. In production ', 5000, '2604-1-0-1'], ['WO-2604-2', 'K2', 'Acme', 46345, '4. Assembly', 12000, '2604-2-1-B'], ['WO-2604-2A', 'K2 extra', 'Acme', 46345, '4. Assembly', 1000, '']];
  await H.importAoa(t.page, f5); await t.page.evaluate(() => applyImport(IMPPLAN));
  const snap1 = await t.page.evaluate(() => JSON.stringify(DB.orders.map(o => { const c = { ...o }; delete c.log; return c; })));
  r = await H.importAoa(t.page, f5);
  const ch5 = await t.page.evaluate(() => { applyImport(IMPPLAN); return changes().map(o => o.wo); });
  const snap2 = await t.page.evaluate(() => JSON.stringify(DB.orders.map(o => { const c = { ...o }; delete c.log; return c; })));
  rec('AC5 importing the same file twice changes nothing', r.plan && r.plan.updates.length === 0 && r.plan.newOrders.length === 0 && snap1 === snap2, r.plan && r.plan.updates.map(u => u.wo + ': ' + u.what).join(' | '));
  rec('AC5 …and lists no Export Changes', ch5.length === 0, ch5.join());
  await t.close();

  // AC6 euro / commas
  t = await fresh();
  r = await H.importAoa(t.page, [HDR, ['WO-2604-1', 'K1', 'Acme', 46330, '3. In production', '€12,500.00', ''], ['WO-2604-2', 'K2', 'Acme', 46330, '3. In production', '12,500', '']]);
  const est = await t.page.evaluate(() => estimateHours(12500));
  rec('AC6 "€12,500.00" and "12,500" read as 12500 (hours from the Settings scale: ' + est + 'h)', r.plan && r.plan.newOrders.every(x => x.value === 12500 && x.hours === est), r.plan && r.plan.newOrders.map(x => x.value + '/' + x.hours + 'h').join(' '));
  await t.close();

  // AC7 hours column, value blank
  t = await fresh();
  r = await H.importAoa(t.page, [['WO #', 'Title', 'Customer', 'Due Date', 'Hours'], ['WO-2604-1', 'K1', 'Acme', 46330, 12]]);
  rec('AC7 an Hours column is used when value is blank', r.plan && r.plan.newOrders[0].hours === 12, JSON.stringify(r.plan && r.plan.newOrders[0]));
  await t.close();

  // AC8 seven date formats + impossible date (impossible on an EXISTING job keeps its date and flags it)
  t = await fresh([H.order({ wo: 'WO-26-9', dueDate: '2026-11-05' })]);
  const dates = ['04/10/2026', '4/10/26', '04-10-2026', '04.10.2026', '04 Oct 2026', 'Oct 4, 2026', '2026-10-04'];
  r = await H.importAoa(t.page, [HDR, ...dates.map((d, i) => ['WO-26-' + i, 'J', 'C', d, '3. In production', 5000, '']), ['WO-26-9', 'Job', 'Cust', '31/02/2026', '3. In production', 4000, '']]);
  const got = r.plan ? r.plan.newOrders.map(x => x.dueDate) : [];
  rec('AC8 all 7 date formats → 2026-10-04', got.length === 7 && got.every(x => x === '2026-10-04'), JSON.stringify(got));
  rec('AC8 31/02/2026 rejected: existing date kept, job flagged', r.plan && !r.plan.updates.some(u => u.wo === 'WO-26-9' && 'dueDate' in u.set) && r.plan.flagged.some(f => f.wo === 'WO-26-9' && /31\/02\/2026/.test(f.why)), JSON.stringify(r.plan && r.plan.flagged));
  await t.close();

  // AC9 no Step column
  t = await fresh([{ wo: 'WO-1-1', title: 'Old', customer: 'C', hours: 5, dueDate: '2026-11-05', plannedWeek: '2026-11-02', value: 5000 }]);
  await H.importAoa(t.page, [['WO #', 'Title', 'Customer', 'Due Date', 'Sub-Total'], ['WO-1-1', 'Old', 'C', 46331, 5000]]);
  const st9 = await t.page.evaluate(() => { if (IMPPLAN) applyImport(IMPPLAN); return DB.orders[0].step; });
  rec('AC9 no Step column → the old blank step stays blank', st9 === undefined || st9 === '', JSON.stringify(st9));
  await t.close();

  // AC10 hand-set hours
  t = await fresh([H.order({ wo: 'WO-2604-1', hours: 20, hoursEstimated: false, value: 5000, dueDate: '2026-11-05' })]);
  await H.importAoa(t.page, [[...HDR, 'Hours'], ['WO-2604-1', 'Job', 'Cust', 46331, '3. In production', 9000, '', 11]]);
  const h10 = await t.page.evaluate(() => { applyImport(IMPPLAN); return DB.orders[0].hours + '/' + DB.orders[0].value; });
  rec('AC10 hand-set 20h survives a re-import (value still updated)', h10 === '20/9000', h10);
  await t.close();

  // AC11 blank due date
  t = await fresh([H.order({ wo: 'WO-2604-1', dueDate: '2026-11-05', value: 4000 })]);
  await H.importAoa(t.page, [HDR, ['WO-2604-1', 'Job', 'Cust', '', '3. In production', 4000, ''], ['WO-2604-9', 'x', 'y', 46331, '3. In production', 4000, '']]);
  const d11 = await t.page.evaluate(() => { applyImport(IMPPLAN); return DB.orders[0].dueDate; });
  rec("AC11 a blank due date doesn't wipe the existing one", d11 === '2026-11-05', d11);
  await t.close();

  // AC12 far future
  t = await fresh();
  await H.importAoa(t.page, [HDR, ['WO-2604-1', 'K', 'C', '2027-06-01', '3. In production', 30000, ''], ['WO-2604-2', 'K', 'C', '2026-12-10', '3. In production', 3000, '']]);
  const pw12 = await t.page.evaluate(() => { applyImport(IMPPLAN); return DB.orders.map(o => o.wo + ':' + (o.plannedWeek || 'unscheduled')).sort().join(' '); });
  rec('AC12 a job due June 2027 is left unscheduled (one due inside the 8 weeks is planned)', pw12 === 'WO-2604-1:unscheduled WO-2604-2:2026-12-07', pw12);
  await t.close();

  // AC13 header on row 13
  t = await fresh();
  r = await H.importAoa(t.page, [...Array.from({ length: 12 }, (_, i) => ['Report line ' + i]), HDR, ['WO-2604-1', 'K', 'C', 46331, '3. In production', 5000, '']], { merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }] });
  rec('AC13 a header on row 13 is found', !!r.plan && !r.pend && r.plan.newOrders.length === 1);
  await t.close();

  // AC14 column guessing + 2,500 rows
  t = await fresh();
  const rows14 = Array.from({ length: 20 }, (_, i) => ['WO-2604-' + (i + 1), 2604, '2604-' + (i + 1) + '-0-' + (i + 10), 'Kitchen unit ' + i, ['Acme Builders Ltd', 'Bloggs Homes', 'Galway Dev Co'][i % 3], 46200 + i, 46330 + i, '3. In production', 1000 + i * 137.5, ['John Smith', 'Mary Ryan', 'Pat Burke'][i % 3], '0', String(i + 10)]);
  r = await H.importAoa(t.page, rows14);
  const m14 = r.pend && r.pend.map;
  rec('AC14 column guessing still passes (WO=A, due=G, customer=E, value=I)', m14 && m14.wo === 0 && m14.dueDate === 6 && m14.customer === 4 && m14.value === 8, JSON.stringify(m14));
  await t.close();
  t = await fresh(Array.from({ length: 800 }, (_, i) => H.order({ wo: 'WO-9-' + i })));
  const big = [HDR, ...Array.from({ length: 2500 }, (_, i) => ['WO-77-' + i, 'K' + i, 'C' + (i % 40), 46330 + (i % 60), '3. In production', 1000 + i, '77-' + i + '-0-' + i])];
  const t0 = Date.now(); r = await H.importAoa(t.page, big); const ms = Date.now() - t0;
  const applyMs = await t.page.evaluate(() => { const s = performance.now(); applyImport(IMPPLAN); render(); return Math.round(performance.now() - s); });
  rec('AC14 2,500 rows analyse + apply in under 8 seconds each', r.plan && r.plan.newOrders.length === 2500 && ms < 8000 && applyMs < 8000, `analyse ${ms}ms, apply+render ${applyMs}ms`);
  await t.close();

  // AC15 hours 99999 / -5 / "8h"
  t = await fresh();
  r = await H.importAoa(t.page, [['WO #', 'Title', 'Customer', 'Due Date', 'Sub-Total', 'Hours'], ['WO-1-1', 'a', 'c', 46331, 5000, -5], ['WO-1-2', 'a', 'c', 46331, 5000, 99999], ['WO-1-3', 'a', 'c', 46331, 5000, '8h']]);
  const h15 = r.plan ? Object.fromEntries(r.plan.newOrders.map(x => [x.wo, x.hours + '/' + x.hoursSrc])) : {};
  rec('AC15 -5 and 99999 ignored, flagged and estimated from value; "8h" = 8', h15['WO-1-1'] === '7/est' && h15['WO-1-2'] === '7/est' && h15['WO-1-3'] === '8/cien' && r.plan.flagged.filter(f => /ignored \(bad data\)/.test(f.why)).length === 2, JSON.stringify(h15));
  await t.close();

  // AC16 trailing space on step
  t = await fresh([H.order({ wo: 'WO-2604-1', dueDate: '2026-11-05', step: '3. In production', value: 4000 })]);
  r = await H.importAoa(t.page, [HDR, ['WO-2604-1', 'Job', 'Cust', 46331, '3. In production ', 4000, '']]);
  rec('AC16 a trailing space on a step is not a change', r.plan && r.plan.updates.length === 0, r.plan && r.plan.updates.map(u => u.what).join());
  await t.close();

  // AC17 step change from Cienapps is not exported
  t = await fresh([H.order({ wo: 'WO-1-1', step: '3. In production', dueDate: '2026-11-05', value: 5000 })]);
  await H.importAoa(t.page, [['WO #', 'Title', 'Customer', 'Due Date', 'Step', 'Sub-Total'], ['WO-1-1', 'Job', 'Cust', 46331, '4. Assembly', 5000]]);
  const ch17 = await t.page.evaluate(() => { applyImport(IMPPLAN); return { ch: changes().map(o => o.wo), step: DB.orders[0].step }; });
  rec('AC17 a step change from Cienapps moves the job forward and is not exported', ch17.step === '4. Assembly' && ch17.ch.length === 0, JSON.stringify(ch17));
  await t.close();

  // AC25 A suffix folds into base, flagged/listed, badge on the board
  t = await fresh([H.order({ wo: 'WO-2604-7', value: 3000, hours: 3, hoursEstimated: true, dueDate: '2026-11-05' })]);
  r = await H.importAoa(t.page, [HDR, ['WO-2604-7', 'Job', 'Cust', 46331, '3. In production', 3000, ''], ['WO-2604-7A', 'Extra doors', 'Cust', 46331, '3. In production', 2000, ''], ['WO-2604-8-C', 'Orphan', 'Cust', 46331, '3. In production', 500, '']]);
  const a25 = await t.page.evaluate(() => { applyImport(IMPPLAN); showTab('b'); const o = DB.orders.find(x => x.wo === 'WO-2604-7'); return { n: DB.orders.length, wos: DB.orders.map(x => x.wo).join(), v: o.value, h: o.hours, adds: Object.keys(o.adds || {}), badge: /\+A/.test(document.querySelector('tr[data-wo="WO-2604-7"]').innerText) }; });
  rec('AC25 an A-suffix line folds into its base (value + hours) and is listed as an Addition', a25.v === 5000 && a25.h === 7 && a25.adds.join() === 'WO-2604-7A' && r.plan.folds.length === 1 && /Additions/.test(r.iprev), JSON.stringify(a25));
  rec('AC25 "+A" badge on the board row', a25.badge, JSON.stringify(a25));
  rec('AC25 a suffix line with no base stays as its own job, flagged "base not found"', /WO-2604-8-C/.test(a25.wos) && r.plan.flagged.some(f => f.wo === 'WO-2604-8-C' && /base WO-2604-8 not found/.test(f.why)), a25.wos);
  r = await H.importAoa(t.page, [HDR, ['WO-2604-7', 'Job', 'Cust', 46331, '3. In production', 3000, ''], ['WO-2604-7A', 'Extra doors', 'Cust', 46331, '3. In production', 2000, ''], ['WO-2604-8-C', 'Orphan', 'Cust', 46331, '3. In production', 500, '']]);
  rec('AC25 re-importing the same A line does not add its value twice', r.plan && r.plan.updates.length === 0, r.plan && r.plan.updates.map(u => u.wo + ' ' + u.what).join('|'));
  await t.close();

  // AC26 sheets column stored
  t = await fresh([H.order({ wo: 'WO-2604-1', value: 4000, dueDate: '2026-11-05' })]);
  await H.importAoa(t.page, [[...HDR, 'No of Sheets '], ['WO-2604-1', 'Job', 'Cust', 46331, '3. In production', 4000, '', 14], ['WO-2604-2', 'K', 'C', 46331, '3. In production', 4000, '', '6']]);
  const s26 = await t.page.evaluate(() => { applyImport(IMPPLAN); return DB.orders.map(o => o.wo + '=' + o.sheetsCien).join(' '); });
  rec('AC26 the sheets column is stored per WO (sheetsCien)', s26 === 'WO-2604-1=14 WO-2604-2=6', s26);
  await t.close();

  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
