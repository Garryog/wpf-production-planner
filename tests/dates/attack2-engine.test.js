// Tester attack 2 — delivery date in the engine + dialog, Settings numbers, A9 "don't cut early".
// A4 follows the delivery date: moved delivery pulls a booking; setting the delivery date TO the booked day must not;
// a build date moved past the booked delivery is flagged. Suggested build = delivery − 3 working days over Christmas
// (Tue 29 Dec 2026) and Easter (Tue 30 Mar 2027), and with delivLead changed. Settings 0 / −1 / blank / 61 / 9999 /
// 2.5 / 1e3, and a bad value arriving in the saved settings. A9: 15 vs 14 days, two small moves that add up, group and
// import paths, cut clears it, moving back clears it, date coming within range. Clock Tue 10 Nov 2026. Stubbed Supabase.
// Run: node tests/dates/attack2-engine.test.js
const { H, recorder, w, XD } = require('./attack1-lib');
const { rec, done } = recorder('attack2-engine');
(async () => {
  const browser = await H.chromium.launch();
  const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-17', origDueDate: '2026-11-17', plannedWeek: '2026-11-16', step: '3. In production', customer: 'CAIRN', title: 'House ' + wo, value: 4000, hours: 5, hoursSrc: 'hand' }, x));
  const BK = { step: '8. PALLETED', delv: true, delVeh: 'VOLVO', delDay: 'Thu', delWk: '2026-11-16' }; // Thu 19 Nov
  const row = { id: 'main', nid: 50, settings: { listChk: false }, orders: [
    O('D-1', { ...BK, delivDate: '2026-11-19' }),   // delivery moves → off the van
    O('D-2', { ...BK }),                            // first delivery date set to the booked day → stays
    O('D-3', { ...BK, delivDate: '2026-11-19' }),   // build date moved past the booked delivery
    O('D-4', { ...BK, delivDate: '2026-11-19', delLoadedAt: '2026-11-19T07:00:00Z' }), // loaded, delivery moves
    O('D-5', { delivDate: '2027-01-15', dueDate: '2026-12-23', plannedWeek: '2026-12-21' }),
    O('D-6', { delivDate: '2027-04-15', dueDate: '2027-03-25', plannedWeek: '' }),
    O('H-15'), O('H-14'), O('H-A'), O('H-CUT'), O('H-BACK'), O('H-NEAR', { dueDate: '2026-11-12' }),
    O('G-1'), O('G-2', { step: '6. JOB CUT COMPLETE' }),
    O('I-1'),
  ] };
  const t = await H.open({ browser, now: '2026-11-10T10:00:00Z', row });
  const p = t.page;
  const r = await p.evaluate(async () => {
    const g = w => DB.orders.find(o => o.wo === w), out = {};
    const pk = w => { const o = g(w); return { due: o.dueDate, deliv: o.delivDate || '', day: o.delDay || '', wk: o.delWk || '', rb: !!o.delRebook, mv: o.dueMv || null }; };
    moveDates(['D-1'], { deliv: '2026-11-26' }, { why: 'Site not ready' }, 'Ann').apply(); out.d1 = pk('D-1');
    const r2 = moveDates(['D-2'], { deliv: '2026-11-19' }, { why: 'Customer delay' }, 'Ann'); out.d2row = r2.rows[0]; r2.apply(); out.d2 = pk('D-2');
    const r3 = moveDates(['D-3'], { due: '2026-11-24' }, { why: 'Production' }, 'Ann'); out.d3flags = r3.rows[0].flags; r3.apply(); out.d3 = pk('D-3');
    moveDates(['D-4'], { deliv: '2026-11-26' }, { why: 'Site not ready' }, 'Ann').apply(); out.d4 = pk('D-4');
    // the D-3 card / board after the move: is "build after delivery" still visible anywhere?
    showTab('b'); await new Promise(r => setTimeout(r, 150));
    const brow = document.querySelector('tr[data-wo="D-3"]'); out.d3board = brow ? brow.innerText.replace(/\s+/g, ' ') : '';
    // dialog suggestion across Christmas / Easter
    const sug = (wo, dv) => { dateDlgOpen([wo], 'Ann'); const dl = document.getElementById('date-dlg'); const i = dl.querySelector('#dm-deliv'); i.value = dv; i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('change')); const o = { due: dl.querySelector('#dm-date').value, txt: dl.querySelector('#dm-sug').textContent }; dl.remove(); return o; };
    out.s1 = sug('D-5', '2026-12-30');   // Wed 30 Dec → 3 wd back: 29, 24, 23 → 23 Dec
    out.s2 = sug('D-5', '2026-12-29');   // Tue 29 Dec → 24, 23, 22 → 22 Dec
    out.s3 = sug('D-6', '2027-03-31');   // Wed 31 Mar → 30, 26, 25 → 25 Mar
    out.s4 = sug('D-6', '2027-03-30');   // Tue 30 Mar → 26, 25, 24 → 24 Mar
    out.s5 = sug('D-5', '2026-12-28');   // a bank holiday picked as delivery → 24, 23, 22 → 22 Dec
    // user types a build date first, then the delivery date: is the typed build date thrown away?
    dateDlgOpen(['D-5'], 'Ann'); { const dl = document.getElementById('date-dlg'); const d = dl.querySelector('#dm-date'); d.value = '2026-12-18'; d.dispatchEvent(new Event('input'));
      const i = dl.querySelector('#dm-deliv'); i.value = '2027-01-08'; i.dispatchEvent(new Event('input')); out.typed = dl.querySelector('#dm-date').value;
      // clearing the delivery date
      i.value = ''; i.dispatchEvent(new Event('input')); dl.querySelector('[data-dmwhy="Production"]').click(); dl.querySelector('#dm-date').value = '2026-12-23'; dl.querySelector('#dm-date').dispatchEvent(new Event('input'));
      out.clearPrev = dl.querySelector('#dm-prev').innerText.replace(/\s+/g, ' '); dl.remove(); }
    // delivLead = 5
    DB.delivLead = 5; out.s6 = sug('D-6', '2027-03-31'); DB.delivLead = 3; // 30, 26, 25, 24, 23 → 23 Mar
    return out;
  });
  rec('A4: delivery date moved on a booked job → off the van, "rebook"', r.d1.day === '' && r.d1.rb && r.d1.deliv === '2026-11-26', JSON.stringify(r.d1));
  rec('A4: setting the delivery date to the day it is already booked (Thu 19 Nov) keeps it on the van', r.d2.day === 'Thu' && r.d2.wk === '2026-11-16' && !r.d2.rb, JSON.stringify(r.d2) + ' row: ' + JSON.stringify({ pulled: r.d2row.vanPulled, slot: r.d2row.slot }));
  rec('build date moved past the booked delivery: flagged "after-delivery" in the preview', r.d3flags.includes('after-delivery'), JSON.stringify(r.d3flags));
  rec('build date past the booked delivery: still visible after saving (board row or a chip), not only in the dialog', /after.*deliver|deliver.*after|⚠/i.test(r.d3board), r.d3board.slice(0, 300) + ' — D-3 builds 24 Nov, goes out on the van Thu 19 Nov; nothing says so after the dialog closes');
  rec('loaded D-4, delivery moved: stays on the van + "moved after loading" chip', r.d4.day === 'Thu' && r.d4.mv && r.d4.mv.loaded, JSON.stringify(r.d4));
  rec('suggested build = delivery − 3 working days over Christmas: Wed 30 Dec → 23 Dec, Tue 29 Dec → 22 Dec', r.s1.due === '2026-12-23' && r.s2.due === '2026-12-22', JSON.stringify([r.s1, r.s2]));
  rec('suggested build over Easter 2027: Wed 31 Mar → 25 Mar, Tue 30 Mar → 24 Mar', r.s3.due === '2027-03-25' && r.s4.due === '2027-03-24', JSON.stringify([r.s3, r.s4]));
  rec('delivery picked on a bank holiday (Mon 28 Dec): suggestion is still 3 working days before (22 Dec)', r.s5.due === '2026-12-22', JSON.stringify(r.s5));
  rec('delivLead 5: Wed 31 Mar 2027 → Tue 23 Mar', r.s6.due === '2027-03-23' && /5 working days/.test(r.s6.txt), JSON.stringify(r.s6));
  rec('a build date the user typed first is not silently overwritten by the delivery suggestion', r.typed === '2026-12-18', 'typed 18 Dec, then a delivery date → build box now ' + r.typed);
  rec('clearing the delivery date box is either applied or clearly ignored (not silently kept)', /delivery/i.test(r.clearPrev), r.clearPrev.slice(0, 200));

  // ---- Settings numbers ----
  const S = await p.evaluate(async () => {
    const out = {};
    showTab('set'); await new Promise(r => setTimeout(r, 100));
    if (!document.getElementById('s-delivLead')) { const b = [...document.querySelectorAll('[data-tab],button')].find(x => /settings/i.test(x.textContent)); if (b) b.click(); await new Promise(r => setTimeout(r, 150)); }
    const has = !!document.getElementById('s-delivLead'); out.has = has; if (!has) return out;
    const tryv = async v => { document.getElementById('s-delivLead').value = v; document.getElementById('s-siteDays').value = v; document.getElementById('s-earlyDays').value = v; document.getElementById('btn-save-dates').click(); await new Promise(r => setTimeout(r, 60)); return [DB.delivLead, DB.siteDays, DB.earlyDays].join('/') + ' toast=' + ((document.getElementById('toast') || {}).textContent || ''); };
    out.ok = await tryv('4');
    for (const v of ['0', '-1', '', '61', '9999']) out['v' + v] = await tryv(v);
    out.f25 = await tryv('2.5'); out.e = await tryv('1e3');
    await tryv('3'); DB.delivLead = 3; DB.siteDays = 5; DB.earlyDays = 14; // back to the defaults for the A9 checks
    return out;
  });
  rec('Settings: 4 saved for all three', S.has && /^4\/4\/4/.test(S.ok), JSON.stringify(S));
  rec('Settings: 0, −1, blank, 61, 9999 refused with a message, previous value kept', S.has && ['v0', 'v-1', 'v', 'v61', 'v9999'].every(k => /^4\/4\/4 toast=Enter whole numbers/.test(S[k])), JSON.stringify(S));
  rec('Settings: 2.5 and 1e3 are not whole numbers — refused, not saved as 2 / 1', S.has && /^4\/4\/4/.test(S.f25) && /^4\/4\/4/.test(S.e), JSON.stringify({ '2.5': S.f25, '1e3': S.e }));
  // bad values arriving from the database (another tool / old backup)
  const t2 = await H.open({ browser, now: '2026-11-10T10:00:00Z', row: { id: 'main', nid: 5, settings: { delivLead: 9999, siteDays: '7', earlyDays: -3 }, orders: [O('X-1', { ...BK, delivDate: '2026-11-19' })] } });
  const S2 = await t2.page.evaluate(() => ({ dl: delivLead(), sd: siteDays(), ed: earlyDays(), sug: dmShiftWd('2026-11-19', -delivLead()) }));
  rec('a bad saved delivLead (9999) is ignored, not used for the suggestion', S2.dl <= 60, JSON.stringify(S2));
  rec('a bad saved earlyDays (−3) falls back to 14', S2.ed === 14, JSON.stringify(S2));
  await t2.close();

  // ---- A9 ----
  const A = await p.evaluate(async () => {
    const g = w => DB.orders.find(o => o.wo === w), out = {};
    moveDates(['H-15'], { due: '2026-12-02' }, { why: 'Customer delay' }, 'Ann').apply();   // 17 Nov → 2 Dec = 15 days
    moveDates(['H-14'], { due: '2026-12-01' }, { why: 'Customer delay' }, 'Ann').apply();   // 14 days
    moveDates(['H-A'], { due: '2026-11-27' }, { why: 'Customer delay' }, 'Ann').apply();    // 10 days
    moveDates(['H-A'], { due: '2026-12-07' }, { why: 'Customer delay' }, 'Ann').apply();    // +10 more = 20 days from the first date
    moveDates(['H-CUT'], { due: '2026-12-11' }, { why: 'Customer delay' }, 'Ann').apply();
    moveDates(['H-BACK'], { due: '2026-12-11' }, { why: 'Customer delay' }, 'Ann').apply(); out.back1 = !!g('H-BACK').dueHold;
    moveDates(['H-BACK'], { due: '2026-11-20' }, { why: 'Customer delay' }, 'Ann').apply(); out.back2 = !!g('H-BACK').dueHold;
    moveDates(['H-NEAR'], { due: '2026-11-30' }, { why: 'Customer delay' }, 'Ann').apply();  // 18 days out but due only 20 days away
    out.h15 = dueHoldOn(g('H-15')); out.h14 = dueHoldOn(g('H-14')); out.hA = dueHoldOn(g('H-A')); out.near = { set: !!g('H-NEAR').dueHold, on: dueHoldOn(g('H-NEAR')) };
    out.cutBefore = dueHoldOn(g('H-CUT')); g('H-CUT').step = '6. JOB CUT COMPLETE'; out.cutAfter = dueHoldOn(g('H-CUT'));
    moveDates(['G-1', 'G-2'], { shift: { n: 3, unit: 'wk' } }, { why: 'Materials' }, 'Ann', { src: 'group' }).apply(); out.g = [dueHoldOn(g('G-1')), dueHoldOn(g('G-2'))];
    // import path: Cienapps moves I-1 out 4 weeks
    return out;
  });
  rec('A9: moved out 15 days → "don\'t cut early"; 14 days → not', A.h15 && !A.h14, JSON.stringify(A));
  rec('A9: moved out 10 days, then 10 more (20 from the first date, not cut) → "don\'t cut early"', A.hA, JSON.stringify(A) + ' — two small moves never trip it');
  rec('A9: cutting the job clears it', A.cutBefore && !A.cutAfter, JSON.stringify([A.cutBefore, A.cutAfter]));
  rec('A9: moved back within range clears it', A.back1 && !A.back2, JSON.stringify([A.back1, A.back2]));
  rec('A9: group move +3 weeks → on for the not-cut job, not for the cut one', A.g[0] && !A.g[1], JSON.stringify(A.g));
  const HDR = ['WO # ', 'Title', 'Customer', 'Due Date', 'Step', 'Sub-Total'];
  await H.importAoa(p, [HDR, ['I-1', 'House I-1', 'CAIRN', XD('2026-12-15'), '3. In production', 4000]]);
  await p.evaluate(async () => { document.querySelectorAll('[data-dk]').forEach(r => { if (r.value === 'take') r.checked = true; }); await document.getElementById('imp-apply').onclick(); await new Promise(r => setTimeout(r, 250)); });
  const imp = await p.evaluate(() => ({ due: DB.orders.find(o => o.wo === 'I-1').dueDate, on: dueHoldOn(DB.orders.find(o => o.wo === 'I-1')) }));
  rec('A9: Cienapps import moves a not-cut job out 28 days → "don\'t cut early"', imp.due === '2026-12-15' && imp.on, JSON.stringify(imp));
  rec('no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
  await t.close(); await browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
