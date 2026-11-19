// d19-2 (Garry 19 Nov): booking onto a van + day that already has OTHER jobs asks first — "Iveco Tue 24 Nov already has 2 jobs:
// WO-A1, WO-A2 (Cairn Homes, Kildare Homes). Add these 2 as well?". Cancel changes nothing. Every way of booking goes through
// placeJobs: ⤵ Place, drag (drop on a cell), the list window's 🚚 Book (fin callback). Fake Supabase only.
// Run: node tests/deliveries/d19-2-slot-warning.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 500) : '')); };
const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-25', origDueDate: '2026-11-25', plannedWeek: '2026-11-23', step: '8. PALLETED', delv: true, customer: 'ASPECT', title: 'House ' + wo, value: 1000 }, x));
(async () => {
  const browser = await H.chromium.launch();
  const WK = '2026-11-23';
  const row = { id: 'main', nid: 9, settings: {}, orders: [
    O('WO-A1', { customer: 'Cairn Homes', delVeh: 'IVECO', delDay: 'Tue', delWk: WK }), O('WO-A2', { customer: 'Kildare Homes', delVeh: 'IVECO', delDay: 'Tue', delWk: WK }),
    O('WO-C1'), O('WO-C2'), O('WO-C3'), O('WO-C4')] };
  const t = await H.open({ browser, now: '2026-11-17T10:00:00Z', row }); const p = t.page;
  const R = await p.evaluate(async WK => {
    const W = ms => new Promise(r => setTimeout(r, ms)); const g = w => DB.orders.find(o => o.wo === w);
    const asked = []; let ans = false; window.confirm = m => { asked.push(String(m)); return ans; };
    showTab('d'); delTab = '1'; render(); await W(150);
    const out = {};
    // 1. ⤵ Place two pool jobs onto Iveco Tue → asked; Cancel → nothing changes
    delSel.clear(); delSel.add('WO-C1'); delSel.add('WO-C2'); render(); await W(50);
    const pb = document.querySelector('[data-place="IVECO|Tue|' + WK + '"]'); out.placeBtn = !!pb;
    if (pb) pb.click(); else placeJobs(delSelLive().map(findDel), 'IVECO', 'Tue', WK);
    await W(100);
    out.q1 = asked.slice(); out.c1 = [g('WO-C1').delDay || '', g('WO-C2').delDay || ''];
    // 2. answer OK → both booked
    asked.length = 0; ans = true;
    placeJobs(['WO-C1', 'WO-C2'].map(findDel), 'IVECO', 'Tue', WK); await W(100);
    out.q2 = asked.slice(); out.c2 = [g('WO-C1').delVeh + '|' + g('WO-C1').delDay, g('WO-C2').delVeh + '|' + g('WO-C2').delDay];
    // 3. an empty slot → no question
    asked.length = 0; placeJobs([findDel('WO-C3')], 'VOLVO', 'Wed', WK); await W(100);
    out.q3 = asked.slice(); out.c3 = g('WO-C3').delVeh + '|' + g('WO-C3').delDay;
    // 4. the job being moved is not counted: WO-C3 (alone on Volvo Wed) moved around within its slot = nothing asked
    asked.length = 0; placeJobs([findDel('WO-C3')], 'VOLVO', 'Wed', WK); await W(50); out.q4 = asked.slice();
    // 5. drag WO-C4 onto Volvo Wed (has WO-C3) → asked, Cancel → nothing
    asked.length = 0; ans = false; delTab = '1'; render(); await W(50);
    delDragList = ['WO-C4']; const cell = document.querySelector('.dcell[data-cell="VOLVO|Wed|' + WK + '"]'); cell.ondrop({ preventDefault() {} }); await W(100);
    out.q5 = asked.slice(); out.c5 = g('WO-C4').delDay || '';
    // 6. the list window's 🚚 Book (fin callback): Cancel → fin(false), nothing booked
    asked.length = 0; let fin = null; placeJobs([findDel('WO-C4')], 'IVECO', 'Tue', WK, ok => { fin = ok; }); await W(100);
    out.q6 = asked.slice(); out.fin = fin; out.c6 = g('WO-C4').delDay || '';
    return out;
  }, WK);
  rec('⤵ Place onto a van + day with jobs → asked, naming the slot, the jobs and the customers', R.q1.length === 1 && /Iveco Tue 24 Nov already has 2 jobs: WO-A1, WO-A2 \(Cairn Homes, Kildare Homes\)/.test(R.q1[0]) && /Add these 2 as well\?/.test(R.q1[0]), JSON.stringify([R.placeBtn, R.q1]));
  rec('Cancel → nothing booked', R.c1.every(x => x === ''), JSON.stringify(R.c1));
  rec('OK → both booked on Iveco Tue', R.q2.length === 1 && R.c2.every(x => x === 'IVECO|Tue'), JSON.stringify([R.q2, R.c2]));
  rec('an empty van + day → no question', R.q3.length === 0 && R.c3 === 'VOLVO|Wed', JSON.stringify([R.q3, R.c3]));
  rec('the job being moved is not counted as "already there"', R.q4.length === 0, JSON.stringify(R.q4));
  rec('drag onto a cell with a job → asked ("Add WO-C4 as well?"); Cancel → nothing', R.q5.length === 1 && /Volvo Wed 25 Nov already has 1 job: WO-C3/.test(R.q5[0]) && /Add WO-C4 as well\?/.test(R.q5[0]) && R.c5 === '', JSON.stringify([R.q5, R.c5]));
  rec('list window 🚚 Book: asked; Cancel → its callback hears "not booked" and nothing changes', R.q6.length === 1 && R.fin === false && R.c6 === '', JSON.stringify([R.q6, R.fin, R.c6]));
  rec('no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
  await t.close(); await browser.close();
  console.log(res.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
})();
