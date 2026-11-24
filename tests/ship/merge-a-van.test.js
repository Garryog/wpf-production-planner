// Merge attack A (Tester, 13 Nov 2026): a job on a van in a past / this / future week, or in the To-plan pool, set to
// JOB SHIPPED / INSTALLED / COMPLETED by hand on the Capacity Board (S1, from main), then "↩ Bring back to board".
// The same job shipped by a Cienapps import (the Deliveries release's rule) is the yardstick: the hand-set one must sit on
// Deliveries exactly like it. Also the step box 7 / 8 path (storeStamp + delvAuto, the merged line), Cancel, dueMv, delivery
// date, Close week, Shipped tab and Export Changes. Fake Supabase only.  Run: node tests/ship/merge-a-van.test.js
const M = require('./merge-lib');
const { H, makeServer, openRef, recorder, w, O, W0, WP, W1, W2, pick, bringBack, job, delSweep, countIn, importRows, XD } = M;
const { rec, done } = recorder('merge-a-van');
const REF = process.env.MERGE_REF || ''; // '' = this working tree (the merge)
(async () => {
  const browser = await H.chromium.launch();
  try {
    const row = () => ({ id: 'main', version: 1, nid: 50, settings: {}, orders: [
      O('WO-4601-1', { delVeh: 'VOLVO', delDay: 'Tue', delWk: W2, dueDate: '2026-11-25', plannedWeek: W1, hours: 7, value: 2000 }),   // future week (+2)
      O('WO-4602-1', { delVeh: 'VOLVO', delDay: 'Tue', delWk: W2, dueDate: '2026-11-25', plannedWeek: W1, hours: 7, value: 2000 }),   // twin: shipped by import
      O('WO-4603-1', { delVeh: 'IVECO', delDay: 'Fri', delWk: W0, hours: 3, value: 1500 }),                 // this week, day still to come
      O('WO-4604-1', { delVeh: 'IVECO', delDay: 'Fri', delWk: W0, hours: 3, value: 1500 }),                 // twin
      O('WO-4605-1', { delVeh: 'IVECO', delDay: 'Mon', delWk: W0, hours: 2, value: 700 }),                  // this week, Monday gone → missed
      O('WO-4606-1', { delVeh: 'IVECO', delDay: 'Mon', delWk: W0, hours: 2, value: 700 }),                  // twin
      O('WO-4607-1', { delVeh: 'ARTIC', delDay: 'Wed', delWk: WP, dueDate: '2026-11-04', plannedWeek: WP, hours: 4, value: 900 }), // past week, never closed
      O('WO-4608-1', { delVeh: 'ARTIC', delDay: 'Wed', delWk: WP, dueDate: '2026-11-04', plannedWeek: WP, hours: 4, value: 900 }),
      O('WO-4609-1', { dueDate: '2026-11-18', plannedWeek: W1, hours: 6, value: 1100 }),                   // To plan pool (next week), no van
      O('WO-4610-1', { dueDate: '2026-11-18', plannedWeek: W1, hours: 6, value: 1100 }),
      O('WO-4611-1', { delVeh: 'VOLVO', delDay: 'Sat', delWk: W1, hours: 1, value: 300 }),                  // → INSTALLED by hand
      O('WO-4612-1', { delVeh: 'VOLVO', delDay: 'Sat', delWk: W1, hours: 1, value: 300 }),                  // → COMPLETED by hand
      O('WO-4613-1', { delVeh: 'DAF', delDay: 'Thu', delWk: W0, hours: 2, value: 400 }),                    // Cancel test
      O('WO-4614-1', { step: '6. JOB CUT COMPLETE', cienStep: '6. JOB CUT COMPLETE', delv: false, hours: 8, value: 800 }),        // 6 → 7 → 8 → 9 → back
      O('WO-4615-1', { step: '6. JOB CUT COMPLETE', cienStep: '6. JOB CUT COMPLETE', delv: false, delvOverride: '8. PALLETED', hours: 2 }), // untagged by hand at 8
      O('WO-4616-1', { delVeh: 'DAF', delDay: 'Wed', delWk: W1, dueDate: '2026-11-18', origDueDate: '2026-11-13', plannedWeek: W1,
        dueMv: { from: '2026-11-13', to: '2026-11-18', at: '2026-11-10T09:00:00Z', by: 'Ann', why: 'Site not ready', prog: true }, dueKeep: '2026-11-13' }),
      O('WO-4617-1', { delVeh: 'DAF', delDay: 'Wed', delWk: W1, delivDate: '2026-11-18', origDelivDate: '2026-11-20', delivKeep: '2026-11-20', dueDate: '2026-11-16', plannedWeek: W1 }),
    ] });
    const S = makeServer(row());
    const t = await openRef(browser, S, REF), p = t.page;
    const wk0 = await p.evaluate(() => thisWk());
    rec('clock: this week is Wk 46 (Mon 9 Nov)', wk0 === W0, wk0);
    const sw0 = await delSweep(p);
    const hrs0 = await p.evaluate(({ W0, W1, W2, WP }) => ({ W0: wkHrs(W0), W1: wkHrs(W1), W2: wkHrs(W2), WP: wkHrs(WP) }), { W0, W1, W2, WP });
    const day0 = await p.evaluate(({ W0, W1, W2, WP }) => ({ W2Tue: dayVal('Tue', W2), W0Fri: dayVal('Fri', W0), W0Mon: dayVal('Mon', W0), WPWed: dayVal('Wed', WP), W1Sat: dayVal('Sat', W1) }), { W0, W1, W2, WP });
    const miss0 = await p.evaluate(() => missedJobs().map(o => o.wo).sort());

    // ---------- 1. ship by hand vs ship by import
    const ans = {};
    for (const wo of ['WO-4601-1', 'WO-4603-1', 'WO-4605-1', 'WO-4607-1', 'WO-4609-1']) ans[wo] = await pick(p, wo, '9. JOB SHIPPED');
    rec('ship question mentions "stays on 🚚 Deliveries until the driver confirms" for each booked / pooled job', Object.values(ans).every(a => a.asked && /stays on 🚚 Deliveries/.test(a.asked[0] || '')), JSON.stringify(Object.fromEntries(Object.entries(ans).map(([k, v]) => [k, (v.asked || [v])[0] && String((v.asked || [v])[0]).slice(0, 60)]))));
    const twins = await p.evaluate(() => ['WO-4602-1', 'WO-4604-1', 'WO-4606-1', 'WO-4608-1', 'WO-4610-1'].map(wo => { const o = DB.orders.find(x => x.wo === wo); return [wo, o.title, o.customer, o.dueDate, o.value]; }));
    await importRows(p, twins.map(([wo, ti, cu, dd, v]) => [wo, ti, cu, XD(dd), '9. JOB SHIPPED', v]));
    const J = {}; for (const wo of ['WO-4601-1', 'WO-4602-1', 'WO-4603-1', 'WO-4604-1', 'WO-4605-1', 'WO-4606-1', 'WO-4607-1', 'WO-4608-1', 'WO-4609-1', 'WO-4610-1']) J[wo] = await job(p, wo);
    for (const [a, b] of [['WO-4601-1', 'WO-4602-1'], ['WO-4603-1', 'WO-4604-1'], ['WO-4605-1', 'WO-4606-1'], ['WO-4607-1', 'WO-4608-1'], ['WO-4609-1', 'WO-4610-1']]) {
      const pickK = x => ({ sh: x.sh, onBoard: x.onBoard, inPlan: x.inPlan, onDel: x.onDel, veh: x.veh, day: x.day, wk: x.wk, slotWk: x.slotWk, missed: x.missed, inStore: x.inStore, delv: x.delv });
      rec(`${a} (hand) sits exactly like ${b} (Cienapps import): shipped, off the board / week totals, same van / day / week, same missed`, JSON.stringify(pickK(J[a])) === JSON.stringify(pickK(J[b])) && J[a].sh && !J[a].onBoard && !J[a].inPlan, JSON.stringify({ [a]: pickK(J[a]), [b]: pickK(J[b]) }));
      rec(`${a}: kept its van booking (no ghost, no lost booking) — on Deliveries once`, J[a].onDel === 1 && J[a].veh === (a === 'WO-4609-1' ? '' : J[a].veh) && (a === 'WO-4609-1' ? !J[a].day : !!J[a].day), JSON.stringify(J[a]));
    }
    const sw1 = await delSweep(p);
    for (const wo of ['WO-4601-1', 'WO-4603-1', 'WO-4605-1', 'WO-4607-1', 'WO-4609-1']) {
      const c0 = countIn(sw0, wo), c1 = countIn(sw1, wo);
      rec(`${wo}: Deliveries DOM shows it exactly where it was before shipping, once (${c0.where.join(',')})`, JSON.stringify(c0) === JSON.stringify(c1) && c1.g + c1.pl === 1, JSON.stringify({ before: c0.where, after: c1.where }));
    }
    rec('Deliveries tab counts unchanged by shipping (a shipped job still on its van counts as before)', JSON.stringify(sw0.tabs) === JSON.stringify(sw1.tabs), JSON.stringify({ before: sw0.tabs, after: sw1.tabs }));
    const day1 = await p.evaluate(({ W0, W1, W2, WP }) => ({ W2Tue: dayVal('Tue', W2), W0Fri: dayVal('Fri', W0), W0Mon: dayVal('Mon', W0), WPWed: dayVal('Wed', WP), W1Sat: dayVal('Sat', W1) }), { W0, W1, W2, WP });
    rec('van/day loads (€) unchanged by shipping', JSON.stringify(day0) === JSON.stringify(day1), JSON.stringify({ day0, day1 }));
    const hrs1 = await p.evaluate(({ W0, W1, W2, WP }) => ({ W0: wkHrs(W0), W1: wkHrs(W1), W2: wkHrs(W2), WP: wkHrs(WP) }), { W0, W1, W2, WP });
    rec('board week hours: W0 −(3+3+2+2)=−10, W1 −(7+7+6+6)=−26, WP −8 (hand + import alike)', hrs0.W0 - hrs1.W0 === 10 && hrs0.W1 - hrs1.W1 === 26 && hrs0.WP - hrs1.WP === 8, JSON.stringify({ hrs0, hrs1 }));
    const miss1 = await p.evaluate(() => missedJobs().map(o => o.wo).sort());
    rec('missed list unchanged by shipping (WO-4605-1/WO-4606-1/WO-4607-1/WO-4608-1 still "missed" — driver never confirmed; same for hand and import)', JSON.stringify(miss0) === JSON.stringify(miss1), JSON.stringify({ miss0, miss1 }));
    rec('INFO: a shipped job (hand or import) still asks for a "missed delivery" reason', true, JSON.stringify(miss1));

    // ---------- 1b. bring back
    for (const wo of ['WO-4601-1', 'WO-4603-1', 'WO-4605-1', 'WO-4607-1', 'WO-4609-1']) rec('bring back ' + wo + ' clicked', (await bringBack(p, wo)) === 'ok');
    const B = {}; for (const wo of ['WO-4601-1', 'WO-4603-1', 'WO-4605-1', 'WO-4607-1', 'WO-4609-1']) B[wo] = await job(p, wo);
    for (const wo of ['WO-4601-1', 'WO-4603-1', 'WO-4605-1', 'WO-4607-1', 'WO-4609-1']) {
      const a = J[wo], b = B[wo];
      rec(`${wo} brought back: step 8. PALLETED again, not shipped, on the board, booking ${a.veh || 'pool'} ${a.day} ${a.wk} untouched`, b.step === '8. PALLETED' && !b.sh && b.onBoard && b.inPlan && b.veh === a.veh && b.day === a.day && b.wk === a.wk && b.delv && !b.hand, JSON.stringify(b));
    }
    const sw2 = await delSweep(p);
    for (const wo of ['WO-4601-1', 'WO-4603-1', 'WO-4605-1', 'WO-4607-1', 'WO-4609-1']) { const c0 = countIn(sw0, wo), c2 = countIn(sw2, wo); rec(`${wo}: after bring-back, Deliveries shows it once, same place`, JSON.stringify(c0) === JSON.stringify(c2), JSON.stringify(c2.where)); }
    const hrs2 = await p.evaluate(({ W0, W1, W2, WP }) => ({ W0: wkHrs(W0), W1: wkHrs(W1), W2: wkHrs(W2), WP: wkHrs(WP) }), { W0, W1, W2, WP });
    rec('board hours after bring-back = before minus only the import-shipped twins (no double count)', hrs0.W0 - hrs2.W0 === 5 && hrs0.W1 - hrs2.W1 === 13 && hrs0.WP - hrs2.WP === 4, JSON.stringify({ hrs0, hrs2 }));
    rec('Deliveries badge unchanged through ship + bring back', sw0.badge === sw2.badge, sw0.badge + ' → ' + sw2.badge);
    const boardRows = await p.evaluate(() => { showTab('b'); return [...document.querySelectorAll('[data-stepsel]')].map(s => s.dataset.stepsel); });
    rec('board lists each brought-back job once', ['WO-4601-1', 'WO-4603-1', 'WO-4605-1', 'WO-4607-1', 'WO-4609-1'].every(wo => boardRows.filter(x => x === wo).length === 1), JSON.stringify(boardRows));

    // ---------- INSTALLED / COMPLETED by hand on a booked job
    const ai = await pick(p, 'WO-4611-1', '10. INSTALLED TO BE INVOICE'), ac = await pick(p, 'WO-4612-1', '11. COMPLETED AND INVOICED');
    const jI = await job(p, 'WO-4611-1'), jC = await job(p, 'WO-4612-1');
    rec('INSTALLED by hand on a van job: shipped + installed, still on its van (Sat Wk 47) once', jI.sh && jI.inst && jI.day === 'Sat' && jI.wk === W1 && jI.onDel === 1 && !jI.onBoard, JSON.stringify(jI));
    rec('COMPLETED by hand on a van job: shipped + installed, still on its van once', jC.sh && jC.inst && jC.day === 'Sat' && jC.onDel === 1, JSON.stringify(jC));
    await bringBack(p, 'WO-4611-1'); await bringBack(p, 'WO-4612-1');
    const I1b = await job(p, 'WO-4611-1'), C1b = await job(p, 'WO-4612-1');
    rec('INSTALLED/COMPLETED brought back: step 8, installed mark removed, van kept', I1b.step === '8. PALLETED' && !I1b.inst && !I1b.sh && I1b.day === 'Sat' && C1b.step === '8. PALLETED' && !C1b.inst && C1b.day === 'Sat', JSON.stringify({ I1b, C1b }));

    // ---------- 3. Cancel
    const x0 = await job(p, 'WO-4613-1');
    const ax = await pick(p, 'WO-4613-1', '9. JOB SHIPPED', false);
    const x1 = await job(p, 'WO-4613-1');
    rec('Cancel on the ship question: nothing changed (step, booking, log length)', x1.step === x0.step && !x1.sh && x1.veh === x0.veh && x1.day === x0.day && x1.logs.length === x0.logs.length, JSON.stringify({ x0: x0.step, x1: x1.step, l: [x0.logs.length, x1.logs.length] }));
    rec('Cancel: the step box shows the old step again (8. PALLETED)', ax.selNow === '8. PALLETED', JSON.stringify(ax.selNow));
    // Cancel on "who are you" (officeWho) after OK on the ship question
    const xw = await p.evaluate(async () => { sessionStorage.removeItem('wpfWho'); window.confirm = () => true; showTab('b');
      const s = document.querySelector('[data-stepsel="WO-4613-1"]'); s.value = '9. JOB SHIPPED'; s.onchange(); await new Promise(r => setTimeout(r, 200));
      const ov = [...document.querySelectorAll('.pod-ovl,.modal,.ovl,[role=dialog]')].filter(e => e.offsetParent !== null);
      const cancel = [...document.querySelectorAll('button')].find(b => /^\s*(Cancel|✕)\s*$/i.test(b.textContent) && b.offsetParent !== null);
      if (cancel) cancel.click(); await new Promise(r => setTimeout(r, 150));
      const o = DB.orders.find(x => x.wo === 'WO-4613-1'); const s2 = document.querySelector('[data-stepsel="WO-4613-1"]');
      sessionStorage.setItem('wpfWho', 'Op'); return { step: o.step, sh: !!o.shippedAt, sel: s2 && s2.value, dlg: ov.length, cancel: !!cancel }; });
    rec('Cancel on "who are you?" after OK: not shipped, step box back to 8', !xw.sh && xw.step === '8. PALLETED' && xw.sel === '8. PALLETED', JSON.stringify(xw));

    // ---------- 2. step box 7 / 8 (storeStamp + delvAuto) then 9 by hand, then back
    await pick(p, 'WO-4614-1', '7. ASSEMBLY COMPLETE');
    const s7 = await job(p, 'WO-4614-1');
    rec('step 7 by the box: store time stamped, ticked for delivery (pool), in store', !!s7.storeAt && s7.delv && !s7.day && s7.inStore === true, JSON.stringify(s7));
    await w(30); await pick(p, 'WO-4614-1', '8. PALLETED');
    const s8 = await job(p, 'WO-4614-1');
    rec('then 8: store time NOT re-stamped (set once)', s8.storeAt === s7.storeAt && s8.delv, s7.storeAt + ' / ' + s8.storeAt);
    await pick(p, 'WO-4614-1', '9. JOB SHIPPED');
    const s9 = await job(p, 'WO-4614-1');
    rec('then 9 by hand: shipped, storeAt kept, still in the To-plan pool (ticked), not "in store"', s9.sh && s9.storeAt === s7.storeAt && s9.delv && s9.onDel === 1 && s9.inStore === false, JSON.stringify(s9));
    await bringBack(p, 'WO-4614-1');
    const sb = await job(p, 'WO-4614-1');
    rec('bring back: step 8, storeAt kept, delv kept, no delvOverride, in store again', sb.step === '8. PALLETED' && sb.storeAt === s7.storeAt && sb.delv && !sb.ovr && sb.inStore === true && !sb.sh, JSON.stringify(sb));
    // WO-4615-1 untagged by hand at 8 (delvOverride): 7 by box must not tick it? (override was made at 8 → holds for 7 too)
    await pick(p, 'WO-4615-1', '7. ASSEMBLY COMPLETE');
    const u7 = await job(p, 'WO-4615-1');
    rec('job untagged by hand at 8 (delvOverride): step 7 by the box does not re-tick it; store time stamped', !u7.delv && u7.ovr === '8. PALLETED' && !!u7.storeAt, JSON.stringify(u7));
    await pick(p, 'WO-4615-1', '9. JOB SHIPPED'); await bringBack(p, 'WO-4615-1');
    const u9 = await job(p, 'WO-4615-1');
    rec('WO-4615-1 → 9 by hand → bring back: step 7, still untagged, override kept, not on Deliveries', u9.step === '7. ASSEMBLY COMPLETE' && !u9.delv && u9.ovr === '8. PALLETED' && u9.onDel === 0, JSON.stringify(u9));

    // ---------- 5. moved due date (dueMv chip "programmed") / delivery date
    const d1a = await job(p, 'WO-4616-1');
    await pick(p, 'WO-4616-1', '9. JOB SHIPPED');
    const d1b = await job(p, 'WO-4616-1');
    rec('WO-4616-1 (due date moved, "programmed" chip): shipping by hand keeps dueMv, dueDate, booking', JSON.stringify(d1b.dueMv) === JSON.stringify(d1a.dueMv) && d1b.dueDate === d1a.dueDate && d1b.day === 'Wed' && d1b.sh, JSON.stringify(d1b));
    const chipsSh = await p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-4616-1'); try { return dmChips(o); } catch (e) { return 'ERR ' + e; } });
    rec('dmChips on a shipped job renders without error', !/^ERR/.test(chipsSh), chipsSh.slice(0, 200));
    await bringBack(p, 'WO-4616-1');
    const d1c = await job(p, 'WO-4616-1');
    rec('WO-4616-1 brought back: dueMv / dueDate / booking as before', JSON.stringify(d1c.dueMv) === JSON.stringify(d1a.dueMv) && d1c.dueDate === d1a.dueDate && d1c.wk === d1a.wk && d1c.step === '8. PALLETED', JSON.stringify(d1c));
    const d2a = await job(p, 'WO-4617-1');
    await pick(p, 'WO-4617-1', '9. JOB SHIPPED');
    const d2b = await job(p, 'WO-4617-1');
    rec('WO-4617-1 (delivery date moved on Deliveries): shipping keeps delivDate and booking', d2b.delivDate === d2a.delivDate && d2b.day === d2a.day && d2b.wk === d2a.wk, JSON.stringify(d2b));
    // week box on a brought-back job with a moved date: the Deliveries rule clears an unchecked dueMv only
    await bringBack(p, 'WO-4617-1');

    // ---------- 6. Export Changes / Shipped tab / Close week
    const exs = await p.evaluate(async () => { showTab('h'); await new Promise(r => setTimeout(r, 80)); const shTxt = [...document.querySelectorAll('.sh-card .wo-num')].map(e => e.textContent).join(' ');
      showTab('x'); await new Promise(r => setTimeout(r, 80)); return { chg: changes().map(o => o.wo + ':' + o.step), sh: shTxt, x: document.getElementById('app').innerText }; });
    const shCount = wo => (exs.sh.match(new RegExp('\\b' + wo + '\\b', 'g')) || []).length;
    rec('Shipped tab: each still-shipped job listed once (WO-4602-1,WO-4604-1,WO-4606-1,WO-4608-1,WO-4610-1)', ['WO-4602-1', 'WO-4604-1', 'WO-4606-1', 'WO-4608-1', 'WO-4610-1'].every(wo => shCount(wo) === 1), JSON.stringify(['WO-4602-1', 'WO-4604-1', 'WO-4606-1', 'WO-4608-1', 'WO-4610-1'].map(shCount)));
    rec('Shipped tab: brought-back jobs not listed', ['WO-4601-1', 'WO-4603-1', 'WO-4605-1', 'WO-4607-1', 'WO-4609-1', 'WO-4614-1', 'WO-4616-1'].every(wo => shCount(wo) === 0), '');
    rec('Export Changes: hand-shipped WO-4617-1? no (brought back) — brought-back jobs whose step went back to Cienapps\' step are not listed', !exs.chg.some(c => /^(WO-4601-1|WO-4603-1|WO-4605-1|WO-4607-1|WO-4609-1|WO-4616-1|WO-4617-1):/.test(c)), JSON.stringify(exs.chg));
    // ship WO-4613-1 again (for real) and check Export Changes lists the step
    await pick(p, 'WO-4613-1', '9. JOB SHIPPED');
    const ex2 = await p.evaluate(async () => { showTab('x'); await new Promise(r => setTimeout(r, 80)); return { chg: changes().map(o => o.wo + ':' + o.step), x: document.getElementById('app').innerText }; });
    rec('Export Changes lists WO-4613-1 with step PALLETED → JOB SHIPPED', ex2.chg.includes('WO-4613-1:9. JOB SHIPPED') && /WO-4613-1[\s\S]{0,400}JOB SHIPPED/.test(ex2.x), JSON.stringify(ex2.chg));
    // close the past week WP: WO-4607-1 (brought back, at 8) and WO-4608-1 (shipped by import), both booked, not delivered
    const cl = await p.evaluate(async WP => { window.confirm = () => true; window.__closeAsk = ''; const c0 = window.confirm; window.confirm = m => { window.__closeAsk = m; return true; };
      closeWeek(WP); await new Promise(r => setTimeout(r, 1500)); const g = w => DB.orders.find(o => o.wo === w);
      const k = Object.keys(DB.delArchive || {}).sort().pop(); return { ask: window.__closeAsk, arch: k ? DB.delArchive[k].jobs.map(j => j.wo) : [], P1: { day: g('WO-4607-1').delDay, rb: g('WO-4607-1').delRebook && g('WO-4607-1').delRebook.why, sh: !!g('WO-4607-1').shippedAt }, P2: { day: g('WO-4608-1').delDay, rb: g('WO-4608-1').delRebook && g('WO-4608-1').delRebook.why, sh: !!g('WO-4608-1').shippedAt, delv: !!g('WO-4608-1').delv } }; }, WP);
    rec('Close past week: archive has WO-4607-1 and WO-4608-1 once each', cl.arch.filter(x => x === 'WO-4607-1').length === 1 && cl.arch.filter(x => x === 'WO-4608-1').length === 1, JSON.stringify(cl));
    rec('INFO Close past week: a SHIPPED (import) job not confirmed delivered goes back to To plan "rebook" (same for hand-shipped)', true, JSON.stringify(cl.P2));
    const tabsAfter = await delSweep(p);
    rec('after close: no past tab left for Wk 45', !Object.keys(tabsAfter.tabs).includes('-1'), JSON.stringify(Object.keys(tabsAfter.tabs)));
    // save to the fake database and read back
    await M.save(p); await w(300);
    const saved = (S.row.orders || []).find(o => o.wo === 'WO-4613-1');
    rec('saved: WO-4613-1 at 9, shipped, booking kept', saved && saved.step === '9. JOB SHIPPED' && !!saved.shippedAt && saved.delDay === 'Thu', JSON.stringify(saved && { step: saved.step, day: saved.delDay }));
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    await t.close();
  } finally { await browser.close(); }
  done();
})().catch(e => { console.error(e); process.exit(1); });
