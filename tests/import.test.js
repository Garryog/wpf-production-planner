// Cienapps Excel import attack tests. Run: node tests/import.test.js
const H = require('./harness');
const res = [];
const rec = (name, ok, detail) => { res.push({ name, ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  -> ' + detail : '')); };
const HDR = ['WO #', 'Title', 'Customer', 'Due Date', 'Step', 'Sub-Total', 'Reference'];

(async () => {
  const browser = await H.chromium.launch();
  const fresh = async (orders = [], extra = {}) => H.open(Object.assign({ browser, now: '2026-10-19T10:00:00Z', row: { id: 'main', orders, nid: 5, settings: {} } }, extra));
  let t;

  // 1. Messy headers: trailing spaces, odd case, reordered, extra columns
  t = await fresh();
  let r = await H.importAoa(t.page, [['Cienapps export'], [], ['  Due Date ', 'EXTRA', 'wo #  ', 'TITLE', 'customer ', 'Step', 'SUB-TOTAL '], [46331, 'x', 'WO-2604-1', 'Kitchen A', 'Acme', '3. In production', 5000]]);
  rec('Messy/reordered headers map correctly', r.plan && r.plan.newOrders[0] && r.plan.newOrders[0].dueDate === '2026-11-05' && r.plan.newOrders[0].customer === 'Acme', JSON.stringify(r.plan && r.plan.newOrders[0]));
  await t.close();

  // 2. Totals row at the bottom with the label in the WO column
  t = await fresh();
  r = await H.importAoa(t.page, [HDR, ['WO-2604-1', 'K1', 'Acme', 46330, '3. In production', 5000, '2604-1-0-1'], ['WO-2604-2', 'K2', 'Acme', 46331, '3. In production', 6000, '2604-2-0-2'], ['Total', '', '', '', '', 11000, '']]);
  rec('Totals row is not imported as a work order', r.plan && !r.plan.newOrders.some(o => /total/i.test(o.wo)), 'new WOs: ' + (r.plan && r.plan.newOrders.map(o => o.wo + '(' + o.hours + 'h,due=' + JSON.stringify(o.dueDate) + ')').join(', ')));
  await t.close();

  // 3. Same WO twice in one file
  t = await fresh();
  r = await H.importAoa(t.page, [HDR, ['WO-2604-1', 'K1', 'Acme', 46330, '3. In production', 5000, ''], ['WO-2604-1', 'K1 again', 'Acme', 46337, '3. In production', 5000, '']]);
  const dupApplied = await t.page.evaluate(() => { applyImport(IMPPLAN); return DB.orders.filter(o => o.wo === 'WO-2604-1').length; });
  rec('Duplicate WO inside one file creates only one order', dupApplied === 1, 'orders with WO-2604-1 after apply: ' + dupApplied);
  await t.close();

  // 4. WO as number vs text, and re-import idempotency
  t = await fresh([H.order({ wo: '1234', step: '3. In production', dueDate: '2026-11-05', hours: 7, value: 5000 })]);
  r = await H.importAoa(t.page, [HDR, [1234, 'Job', 'Cust', 46331, '3. In production', 5000, '']]);
  rec('Numeric WO 1234 matches existing "1234"', r.plan && r.plan.newOrders.length === 0, 'new=' + (r.plan && r.plan.newOrders.length) + ' upd=' + (r.plan && r.plan.updates.length));
  await t.close();

  // 5. Same file imported twice -> second import changes nothing
  t = await fresh();
  const file5 = [HDR, ['WO-2604-1', 'K1', 'Acme', 46330, '3. In production ', 5000, '2604-1-0-1'], ['WO-2604-2', 'K2', 'Acme', 46345, '4. Assembly', 12000, '2604-2-1-B']];
  await H.importAoa(t.page, file5);
  await t.page.evaluate(() => applyImport(IMPPLAN));
  r = await H.importAoa(t.page, file5);
  rec('Re-importing the identical file changes nothing', r.plan && r.plan.updates.length === 0 && r.plan.newOrders.length === 0, r.plan && r.plan.updates.map(u => u.wo + ': ' + u.what).join(' | '));
  const chg5 = await t.page.evaluate(() => changes().map(o => o.wo));
  rec('Imports alone produce no "changes to send to Cienapps"', chg5.length === 0, 'changes(): ' + chg5.join(','));
  await t.close();

  // 6. Values with euro sign / thousands commas
  t = await fresh();
  r = await H.importAoa(t.page, [HDR, ['WO-2604-1', 'K1', 'Acme', 46330, '3. In production', '€12,500.00', ''], ['WO-2604-2', 'K2', 'Acme', 46330, '3. In production', '12,500', '']]);
  const v6 = r.plan && r.plan.newOrders.map(o => o.wo + ' value=' + o.value + ' hours=' + o.hours).join(' | ');
  rec('Value "€12,500.00" / "12,500" read as 12500 (16h on the default scale: 12,001–15,000 = 16h)', r.plan && r.plan.newOrders.every(o => o.value === 12500 && o.hours === 16), v6);
  await t.close();

  // 7. Hours column present but value column blank -> real hours should be used
  t = await fresh();
  r = await H.importAoa(t.page, [['WO #', 'Title', 'Customer', 'Due Date', 'Hours'], ['WO-2604-1', 'K1', 'Acme', 46330, 12]]);
  rec('Hours from Cienapps used when value is blank', r.plan && r.plan.newOrders[0] && r.plan.newOrders[0].hours === 12, 'hours=' + (r.plan && r.plan.newOrders[0] && r.plan.newOrders[0].hours));
  await t.close();

  // 8. Text dates in various formats (Irish user, Europe/Dublin browser)
  t = await fresh();
  const dates = [['04/10/2026', '2026-10-04'], ['4/10/26', '2026-10-04'], ['04-10-2026', '2026-10-04'], ['04.10.2026', '2026-10-04'], ['04 Oct 2026', '2026-10-04'], ['Oct 4, 2026', '2026-10-04'], ['2026-10-04', '2026-10-04'], ['31/02/2026', null]];
  r = await H.importAoa(t.page, [HDR, ...dates.map((d, i) => ['WO-26-' + i, 'J', 'C', d[0], '3. In production', 5000, ''])]);
  const got = r.plan ? r.plan.newOrders.reduce((a, o) => (a[o.wo] = o.dueDate, a), {}) : {};
  dates.forEach((d, i) => {
    const g = got['WO-26-' + i];
    if (d[1] === null) rec(`Impossible date "${d[0]}" rejected`, !g || !/02-31/.test(g), 'stored as ' + JSON.stringify(g));
    else rec(`Text date "${d[0]}" -> ${d[1]}`, g === d[1], 'got ' + JSON.stringify(g));
  });
  await t.close();

  // 9. Old order with no step field, file has no Step column
  t = await fresh([{ wo: 'WO-1-1', title: 'Old', customer: 'C', hours: 5, dueDate: '2026-11-05', plannedWeek: '2026-11-02', value: 5000 }]);
  r = await H.importAoa(t.page, [['WO #', 'Title', 'Customer', 'Due Date', 'Sub-Total'], ['WO-1-1', 'Old', 'C', 46331, 5000]]);
  const st9 = await t.page.evaluate(() => { if (IMPPLAN) applyImport(IMPPLAN); return DB.orders[0].step; });
  rec('Old order without step keeps blank step when file has no Step column', st9 === undefined || st9 === '', 'step became ' + JSON.stringify(st9));
  await t.close();

  // 10. Manual hours on the board survive a re-import
  t = await fresh([H.order({ wo: 'WO-2604-1', hours: 20, hoursEstimated: false, value: 5000, dueDate: '2026-11-05', step: '3. In production' })]);
  r = await H.importAoa(t.page, [HDR, ['WO-2604-1', 'Job', 'Cust', 46331, '3. In production', 5000, '']]);
  rec('Planner-set hours (20h) not overwritten by value estimate on re-import', r.plan && r.plan.updates.length === 0, r.plan && r.plan.updates.map(u => u.what).join('|'));
  await t.close();

  // 11. Blank due-date cell on an existing job
  t = await fresh([H.order({ wo: 'WO-2604-1', dueDate: '2026-11-05', step: '3. In production', value: 4000, hours: 7 })]);
  r = await H.importAoa(t.page, [HDR, ['WO-2604-1', 'Job', 'Cust', '', '3. In production', 4000, ''], ['WO-2604-9', 'x', 'y', 46331, '3. In production', 4000, '']]);
  rec('Blank due date in file does not wipe existing due date', r.plan && !r.plan.updates.some(u => u.wo === 'WO-2604-1' && !u.dueDate), r.plan && r.plan.updates.map(u => u.wo + ' ' + u.what).join('|'));
  await t.close();

  // 12. Far-future due date -> placed where?
  t = await fresh();
  r = await H.importAoa(t.page, [HDR, ['WO-2604-1', 'K', 'C', '2027-06-01', '3. In production', 30000, '']]);
  const pw12 = await t.page.evaluate(() => { applyImport(IMPPLAN); return DB.orders[0].plannedWeek; });
  rec('Job due June 2027 not auto-planned into week 8 (Dec 2026)', pw12 !== '2026-12-07', 'plannedWeek=' + pw12);
  await t.close();

  // 13. Header beyond row 12 (Cienapps title block) / merged title cells
  t = await fresh();
  const pre = Array.from({ length: 12 }, (_, i) => ['Report line ' + i]);
  r = await H.importAoa(t.page, [...pre, HDR, ['WO-2604-1', 'K', 'C', 46331, '3. In production', 5000, '']], { merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }] });
  rec('Header on row 13 is still detected', !!r.plan, r.pend ? 'fell back to column guessing; WO col guessed=' + r.pend.map.wo : '');
  await t.close();

  // 14. Headerless file -> guessCols
  t = await fresh();
  const rows14 = Array.from({ length: 20 }, (_, i) => ['WO-2604-' + (i + 1), 2604, '2604-' + (i + 1) + '-0-' + (i + 10), 'Kitchen unit ' + i, ['Acme Builders Ltd', 'Bloggs Homes', 'Galway Dev Co'][i % 3], 46200 + i, 46330 + i, '3. In production', 1000 + i * 137.5, ['John Smith', 'Mary Ryan', 'Pat Burke'][i % 3], '0', String(i + 10)]);
  r = await H.importAoa(t.page, rows14);
  const m14 = r.pend && r.pend.map;
  rec('guessCols picks WO=A, due=G (not creation F), customer=E, value=I', m14 && m14.wo === 0 && m14.dueDate === 6 && m14.customer === 4 && m14.value === 8, JSON.stringify(m14));
  await t.close();

  // 15. 2,500-row file
  t = await fresh(Array.from({ length: 800 }, (_, i) => H.order({ wo: 'WO-9-' + i })));
  const big = [HDR, ...Array.from({ length: 2500 }, (_, i) => ['WO-77-' + i, 'K' + i, 'C' + (i % 40), 46330 + (i % 60), '3. In production', 1000 + i, '77-' + i + '-0-' + i])];
  const t0 = Date.now();
  r = await H.importAoa(t.page, big);
  const ms = Date.now() - t0;
  const applyMs = await t.page.evaluate(() => { const s = performance.now(); applyImport(IMPPLAN); render(); return Math.round(performance.now() - s); });
  rec('2,500-row import analyses + applies in reasonable time', r.plan && r.plan.newOrders.length === 2500 && ms < 8000 && applyMs < 8000, `analyse ${ms}ms, apply+render ${applyMs}ms`);
  await t.close();

  // 16. Hours: negative / huge / "8h"
  t = await fresh();
  r = await H.importAoa(t.page, [['WO #', 'Title', 'Customer', 'Due Date', 'Sub-Total', 'Hours'], ['WO-1-1', 'a', 'c', 46331, 5000, -5], ['WO-1-2', 'a', 'c', 46331, 5000, 99999], ['WO-1-3', 'a', 'c', 46331, 5000, '8h']]);
  const h16 = r.plan && r.plan.newOrders.map(o => o.wo + '=' + o.hours).join(' ');
  rec('Absurd hours (99999) flagged or capped', r.plan && !r.plan.newOrders.some(o => o.hours > 500), h16);
  await t.close();

  // 17. Lowercase WO in file vs uppercase on board
  t = await fresh([H.order({ wo: 'WO-2604-1', dueDate: '2026-11-05' })]);
  r = await H.importAoa(t.page, [HDR, ['wo-2604-1', 'Job', 'Cust', 46331, '3. In production', 4000, '']]);
  rec('"wo-2604-1" matches existing "WO-2604-1"', r.plan && r.plan.newOrders.length === 0, 'new=' + (r.plan && r.plan.newOrders.map(o => o.wo)));
  await t.close();

  // 18. Step with trailing space vs stored step
  t = await fresh([H.order({ wo: 'WO-2604-1', dueDate: '2026-11-05', step: '3. In production', value: 4000, hours: 7 })]);
  r = await H.importAoa(t.page, [HDR, ['WO-2604-1', 'Job', 'Cust', 46331, '3. In production ', 4000, '']]);
  rec('Trailing space on Step is not a step change', r.plan && r.plan.updates.length === 0, r.plan && r.plan.updates.map(u => JSON.stringify(u.step)).join());
  await t.close();

  await browser.close();
  console.log('\n' + res.filter(x => !x.ok).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
