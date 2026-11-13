// Tester attack 1 — re-imports of the Cienapps export against planner date moves.
// Same file twice (Take, then Keep), old Cienapps date, third date (Take it), date that now matches, shipped in the same
// import (booked and not booked), loaded job, delivered job, cut job. Real .xlsx through doImport; stubbed Supabase only.
// Run: node tests/dates/attack1-reimport.test.js
const { H, recorder, w, XD } = require('./attack1-lib');
const { rec, done } = recorder('attack1-reimport');
const HDR = ['WO # ', ' title', 'CUSTOMER ', 'Due Date  ', 'Step ', 'Sub-Total '];
(async () => {
  const browser = await H.chromium.launch();
  const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-20', origDueDate: '2026-11-20', plannedWeek: '2026-11-16', step: '3. In production', customer: 'CAIRN', title: 'House ' + wo, value: 4000, hours: 5, hoursSrc: 'hand' }, x));
  const row = { id: 'main', nid: 5, settings: { listChk: false }, orders: [
    O('WO-1'), O('WO-2'), O('WO-3'),
    O('WO-4', { step: '8. PALLETED', delv: true, delVeh: 'VOLVO', delDay: 'Thu', delWk: '2026-11-16' }),   // booked, Cienapps ships it + new date
    O('WO-5', { step: '8. PALLETED', delv: true, delVeh: 'DAF', delDay: 'Wed', delWk: '2026-11-16', delLoadedAt: '2026-11-18T07:00:00Z' }), // loaded
    O('WO-6', { step: '8. PALLETED', delv: true, delVeh: 'DAF', delDay: 'Mon', delWk: '2026-11-16', delDelivAt: '2026-11-16T12:00:00Z', delDone: true }), // delivered
    O('WO-7', { step: '6. Cut' }),
    O('WO-8', { step: '8. PALLETED', delv: true }),  // in the pool, Cienapps ships it + new date
  ] };
  const t = await H.open({ browser, now: '2026-11-18T10:00:00Z', row });
  const p = t.page;
  const R = (wo, due, step = '3. In production') => [wo, 'House ' + wo, 'CAIRN', XD(due), step, 4000];
  const apply = dec => p.evaluate(async dec => { document.querySelectorAll('[data-dk]').forEach(r => { if (dec[r.dataset.dk]) r.checked = r.value === dec[r.dataset.dk]; }); await document.getElementById('imp-apply').onclick(); await new Promise(r => setTimeout(r, 250)); clearTimeout(saveT); await saveDB(); }, dec || {});
  const get = wos => p.evaluate(wos => wos.map(w => { const o = DB.orders.find(x => x.wo === w); return { wo: w, due: o.dueDate, keep: o.dueKeep || '', wk: o.plannedWeek, n: (o.dueHist || []).length, veh: o.delVeh || '', day: o.delDay || '', delWk: o.delWk || '', rb: !!o.delRebook, mv: o.dueMv || null, shipped: !!o.shippedAt, done: !!(o.delDelivAt || o.delDone) }; }), wos);

  // planner moves WO-2 and WO-3 first
  await p.evaluate(() => { moveDates(['WO-2'], { due: '2026-11-27' }, { why: 'Customer delay' }, 'Ann').apply(); moveDates(['WO-3'], { due: '2026-11-27' }, { why: 'Production' }, 'Ann').apply(); });

  // import 1: WO-1 Cienapps new date (Take); WO-2 old date; WO-3 third date (Take it); WO-4 shipped + new date; WO-5 loaded + new date; WO-6 delivered + new date; WO-7 cut + new date; WO-8 shipped + new date
  const f1 = [HDR, R('WO-1', '2026-11-25'), R('WO-2', '2026-11-20'), R('WO-3', '2026-12-04'), R('WO-4', '2026-11-26', '9. Shipped'), R('WO-5', '2026-11-27', '8. PALLETED'), R('WO-6', '2026-11-27', '8. PALLETED'), R('WO-7', '2026-12-04', '6. Cut'), R('WO-8', '2026-11-30', '9. Shipped')];
  const r1 = await H.importAoa(p, f1);
  rec('odd headers (trailing / leading spaces, CAPS) still map WO / due date', r1.plan && r1.plan.updates.length >= 5, r1.pend && JSON.stringify(r1.pend.map));
  await apply({ 'WO-1': 'take', 'WO-3': 'take' });
  let a = await get(['WO-1', 'WO-2', 'WO-3', 'WO-4', 'WO-5', 'WO-6', 'WO-7', 'WO-8']);
  rec('Take: WO-1 one history entry from Cienapps, no dueKeep', a[0].due === '2026-11-25' && a[0].n === 1 && !a[0].keep, JSON.stringify(a[0]));
  rec('old Cienapps date: WO-2 keeps the planner date, still on the Dates list', a[1].due === '2026-11-27' && a[1].keep === '2026-11-20' && a[1].n === 1, JSON.stringify(a[1]));
  rec('third date, Take: WO-3 takes the Cienapps date, dueKeep cleared, 2 history entries', a[2].due === '2026-12-04' && !a[2].keep && a[2].n === 2, JSON.stringify(a[2]));
  rec('shipped in the same import: booked WO-4 stays on its van (Deliveries keeps it until the driver confirms)', a[3].day === 'Thu' && a[3].delWk === '2026-11-16' && !a[3].rb && a[3].shipped, JSON.stringify(a[3]));
  rec('loaded WO-5 stays on the van, flagged "date moved after loading"', a[4].day === 'Wed' && a[4].mv && a[4].mv.loaded, JSON.stringify(a[4]));
  rec('delivered WO-6: date updates, still delivered, not put back on To plan', a[5].done && !a[5].rb, JSON.stringify(a[5]));
  rec('cut WO-7 (step 6): Cienapps date taken, build week NOT moved by the import', a[6].due === '2026-12-04' && a[6].wk === '2026-11-16', JSON.stringify(a[6]));
  rec('cut WO-7: the board shows a "due moved — check week" chip (week kept because already cut)', !!a[6].mv, JSON.stringify(a[6]) + ' — Cienapps moved a cut job 2½ weeks; nothing on the board says the build week may be wrong');
  rec('shipped WO-8 (in pool): shipped, date taken', a[7].shipped && a[7].due === '2026-11-30', JSON.stringify(a[7]));

  // import 2: the same file again
  const r2 = await H.importAoa(p, f1);
  const dk2 = await p.evaluate(() => [...document.querySelectorAll('[data-dk]')].map(r => r.dataset.dk));
  rec('same file twice: no due-date rows to decide the second time', dk2.length === 0, JSON.stringify([...new Set(dk2)]));
  rec('same file twice: "Cienapps still has the old date" counts only WO-2', JSON.stringify(r2.plan && r2.plan.oldDates) === '["WO-2"]', JSON.stringify(r2.plan && r2.plan.oldDates));
  await apply();
  a = await get(['WO-1', 'WO-2', 'WO-3', 'WO-7']);
  rec('same file twice: history counts unchanged (no extra "moved" from a repeat import)', a[0].n === 1 && a[1].n === 1 && a[2].n === 2 && a[3].n === 1, JSON.stringify(a.map(x => x.wo + ':' + x.n)));

  // import 3: Keep a plain Cienapps change, then import that file again
  const f3 = [HDR, R('WO-1', '2026-12-11')];
  await H.importAoa(p, f3); await apply({ 'WO-1': 'keep' });
  a = await get(['WO-1']);
  const dl = await p.evaluate(() => datesToCien().map(o => o.wo));
  rec('Keep a Cienapps change: planner date stays, job goes on "Dates to change in Cienapps"', a[0].due === '2026-11-25' && a[0].keep === '2026-12-11' && dl.includes('WO-1'), JSON.stringify(a[0]) + ' list=' + dl);
  const r4 = await H.importAoa(p, f3);
  rec('…same file again: no question, counted as "still has the old date"', (r4.plan.oldDates || []).includes('WO-1') && !(await p.evaluate(() => document.querySelectorAll('[data-dk]').length)), JSON.stringify(r4.plan.oldDates));
  await p.evaluate(() => { IMPPLAN = null; });

  // import 5: Cienapps now has the planner date for WO-2 → cleared
  await H.importAoa(p, [HDR, R('WO-2', '2026-11-27')]); await apply();
  a = await get(['WO-2']);
  rec('date that now matches: dueKeep cleared, off the Dates list, history unchanged', !a[0].keep && a[0].n === 1 && !(await p.evaluate(() => datesToCien().some(o => o.wo === 'WO-2'))), JSON.stringify(a[0]));

  // blank rows + a totals row in the file must not create jobs or change dates
  const before = await p.evaluate(() => DB.orders.length);
  await H.importAoa(p, [HDR, R('WO-2', '2026-11-27'), [], ['', '', '', '', '', ''], ['TOTAL', '', '', '', '', 32000]]);
  await apply();
  const after = await p.evaluate(() => ({ n: DB.orders.length, wos: DB.orders.map(o => o.wo).filter(w => !/^WO-\d$/.test(w)) }));
  rec('blank rows and a TOTAL row do not create jobs', after.n === before, JSON.stringify(after));
  rec('no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
  await t.close(); await browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
