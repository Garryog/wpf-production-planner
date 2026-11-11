// L4b (Job B part 3; ROADMAP L4 "NEVER two jobs for one unit"): a Cienapps import that brings a WO for the same house as a
// P-number offers to merge them. Pre-ticked only when the B0 key says "same" and it is one-to-one; "not sure" pairs are shown
// unticked with the reason. Ticked: the P-job's live list moves to the WO, its history / date history / delivery booking /
// planner week, hand hours and notes go onto the WO, the planner's due date is kept and Cienapps' listed under "Dates to change
// in Cienapps" (Q9), the sequence row is handed over (same row), the P-job is retired with a full copy kept (WO pFrom +
// settings pMerged) — never just deleted. Both with a live list → refused. Two PCs → merged once. Fake Supabase only.
// Run: node tests/seq/l4b-pmerge.test.js
const X = require('./fixs.js');
const { H, D, rec, sleep } = X;
const HDR = ['WO #', 'Title', 'Customer', 'Due Date', 'Step', 'Sub-Total', 'Reference', 'Floor', 'Unit'];
const C = 'Aderrig Homes';
const FILE = [HDR,
  ['WO-40', 'HOUSE TYPE Q', C, 46359, '4. READY FOR PRODUCTION', 5000, '2604-40-T09-40', 'T09', '40'],
  ['WO-41', 'HOUSE TYPE R', C, 46359, '4. READY FOR PRODUCTION', 5000, '2604-41-0-41', '0', '41'],
  ['WO-42', 'HOUSE TYPE S', C, 46359, '4. READY FOR PRODUCTION', 5000, '2604-42-T09-42', 'T09', '42'],
  ['WO-44', 'HOUSE TYPE U', C, 46359, '4. READY FOR PRODUCTION', 5000, '2604-44-T09-44', 'T09', '44'],
  ['WO-45', 'HOUSE TYPE U', C, 46359, '4. READY FOR PRODUCTION', 5000, '2604-45-T10-44', 'T10', '44'],
  ['WO-61', 'HOUSE TYPE Z', C, 46359, '4. READY FOR PRODUCTION', 5000, '2604-61-T09-61', 'T09', '61']];
const at0 = '2026-10-15T09:00:00.000Z';
function server() {
  const row = X.v2Row();
  const P = (wo, f, u, t, x) => H.order(Object.assign({ wo, pid: 'P1', customer: C, floor: f, unit: u, title: t, step: 'Planner WO', value: 0, plannedWeek: '', dueDate: '2026-12-10', origDueDate: '2026-12-10', log: [{ at: at0, by: 'Ann', what: 'Work order created' }] }, x || {}));
  row.orders.push(
    P('P-1001', 'T09', '40', 'HOUSE TYPE Q', { plannedWeek: '2026-12-07', hours: 7, hoursSrc: 'hand', hoursEstimated: false, notes: 'Keep for site', delv: true, delVeh: 'VOLVO', delDay: 'Thu', delWk: '2026-12-07',
      dueHist: [{ at: '2026-10-16T09:00:00.000Z', by: 'Ann', f: 'due', from: '2026-12-03', to: '2026-12-10', why: 'Site not ready', note: '', src: 'planner' }],
      log: [{ at: at0, by: 'Ann', what: 'Work order created' }, { at: '2026-10-16T09:00:00.000Z', by: 'Ann', what: 'Due date moved' }] }),
    P('P-1002', 'G', '41', 'HOUSE TYPE R'),
    P('P-1003', 'T09', '42', 'HOUSE TYPE S'),
    P('P-1005', 'T09', '60', 'HOUSE TYPE Y'),
    P('P-1008', '', '44', 'HOUSE TYPE U'),
    H.order({ wo: 'WO-42', customer: C, floor: 'T09', unit: '42', title: 'HOUSE TYPE S', step: '4. READY FOR PRODUCTION', dueDate: '2026-12-03', origDueDate: '2026-12-03', ref: '2604-42-T09-42' }));
  const S = X.makeServer(row);
  X.F3.seedList(S, 'LP1', { wos: ['P-1001'], name: 'House 40' });
  X.F3.seedList(S, 'LP3', { wos: ['P-1003'], name: 'House 42 (P)' });
  X.F3.seedList(S, 'L42', { wos: ['WO-42'], name: 'House 42' });
  X.seqRow(S, 'R40', 'P1', { wo: 'P-1001' });
  return S;
}
const pmRows = p => p.evaluate(() => [...document.querySelectorAll('[data-pmg]')].map(c => ({ p: c.dataset.pmg, w: c.value, on: c.checked, t: c.closest('label').innerText })));
(async () => {
  const browser = await H.chromium.launch();
  try {
    const S = server();
    const a = await X.dev(browser, S, 'office'), p = a.page;
    const b = await X.dev(browser, S, 'office'), q = b.page;
    await H.importAoa(p, FILE); await sleep(300);
    let r = await pmRows(p);
    const g = (pp, w) => r.find(x => x.p === pp && x.w === w);
    rec('preview: section "P-numbers that now have a Cienapps WO"', await p.evaluate(() => /P-numbers that now have a Cienapps WO/.test((document.getElementById('imp-pm') || {}).innerText || '')), JSON.stringify(r.map(x => x.p + '>' + x.w)));
    rec('P-1001 → WO-40 (T09 / 40, same project): pre-ticked, "Same project, floor and unit"', g('P-1001', 'WO-40') && g('P-1001', 'WO-40').on && /Same project, floor and unit/.test(g('P-1001', 'WO-40').t), JSON.stringify(g('P-1001', 'WO-40')));
    rec('P-1002 (floor "G") → WO-41 (floor 0): shown NOT ticked, "Not sure"', g('P-1002', 'WO-41') && !g('P-1002', 'WO-41').on && /Not sure/.test(g('P-1002', 'WO-41').t), JSON.stringify(g('P-1002', 'WO-41')));
    rec('P-1008 (floor blank, unit 44): offered for WO-44 and WO-45, neither ticked', g('P-1008', 'WO-44') && g('P-1008', 'WO-45') && !g('P-1008', 'WO-44').on && !g('P-1008', 'WO-45').on, JSON.stringify(r.filter(x => x.p === 'P-1008')));
    rec('P-1005 (no WO for its house) and WO-61 (no P-number) not offered', !r.some(x => x.p === 'P-1005' || x.w === 'WO-61'), '');
    // ---- one P-number ticked for two WOs: refused, nothing imported
    const n0 = await p.evaluate(() => DB.orders.length);
    await p.evaluate(() => { window.__al = []; window.alert = m => window.__al.push(m); document.querySelectorAll('[data-pmg="P-1008"]').forEach(c => { c.checked = true; }); document.getElementById('imp-apply').click(); });
    await sleep(600);
    const al = await p.evaluate(() => ({ al: window.__al, n: DB.orders.length, plan: !!IMPPLAN }));
    rec('P-1008 ticked for WO-44 AND WO-45: told "merges into ONE work order", nothing imported', al.al.length === 1 && /ONE work order/.test(al.al[0]) && al.n === n0 && al.plan, JSON.stringify(al));
    await p.evaluate(() => document.querySelectorAll('[data-pmg="P-1008"]').forEach(c => { c.checked = false; }));
    // ---- PC B builds the same preview now (before A applies)
    await H.importAoa(q, FILE); await sleep(300);
    // ---- A applies (P-1001→WO-40 and P-1003→WO-42 ticked; P-1002 left unticked)
    await p.evaluate(() => document.getElementById('imp-apply').click());
    for (let i = 0; i < 60 && !(await p.evaluate(() => !!PMERGE_RUN)); i++) await sleep(100);
    const out = await p.evaluate(async () => { const o = await PMERGE_RUN; return o; });
    await sleep(1500);
    const J = await p.evaluate(() => { const f = w => DB.orders.find(o => o.wo === w);
      return { p1: !!f('P-1001'), w40: JSON.parse(JSON.stringify(f('WO-40') || null)), p2: !!f('P-1002'), w41: !!f('WO-41'), p3: !!f('P-1003'), w42: !!f('WO-42'), p5: !!f('P-1005'), p8: !!f('P-1008'),
        merged: (DB.pMerged || []).map(x => x.wo + '>' + x.into), dates: datesToCienRows().map(d => d.o.wo + ':' + d.f + ':' + d.has + '>' + d.to), res: (document.getElementById('imp-pmres') || {}).innerText || '' }; });
    const w = J.w40 || {};
    rec('applied: P-1001 merged into WO-40 (P-1001 off the job list; WO-40 there once)', out && out.some(x => x.p === 'P-1001' && x.ok) && !J.p1 && J.w40 && /P-1001 merged into WO-40/.test(J.res), JSON.stringify(out));
    rec('the P-job is never just deleted: full copy on WO-40 (pFrom) and in settings pMerged', (w.pFrom || [])[0] && w.pFrom[0].wo === 'P-1001' && w.pFrom[0].job && w.pFrom[0].job.wo === 'P-1001' && J.merged.includes('P-1001>WO-40'), JSON.stringify({ pFrom: (w.pFrom || []).map(x => x.wo), m: J.merged }));
    rec('WO-40 keeps Cienapps\' own fields (title, ref, step 4, value)', w.title === 'HOUSE TYPE Q' && w.ref === '2604-40-T09-40' && w.step === '4. READY FOR PRODUCTION' && w.value === 5000, JSON.stringify({ t: w.title, ref: w.ref, step: w.step, v: w.value }));
    rec('the planner\'s week (7 Dec) and hand-typed hours (7) carried onto WO-40', w.plannedWeek === '2026-12-07' && w.hours === 7 && w.hoursSrc === 'hand', JSON.stringify({ wk: w.plannedWeek, h: w.hours, hs: w.hoursSrc }));
    rec('due date (Q9): the planner\'s 10 Dec kept, Cienapps\' 3 Dec listed under "Dates to change in Cienapps"', w.dueDate === '2026-12-10' && w.dueKeep === '2026-12-03' && J.dates.includes('WO-40:due:2026-12-03>2026-12-10'), JSON.stringify({ due: w.dueDate, keep: w.dueKeep, d: J.dates }));
    rec('delivery booking (Volvo, Thu) and notes moved onto WO-40', w.delv && w.delVeh === 'VOLVO' && w.delDay === 'Thu' && w.delWk === '2026-12-07' && /Keep for site/.test(w.notes || ''), JSON.stringify({ v: w.delVeh, d: w.delDay, n: w.notes }));
    rec('history: the P-job\'s log lines ("[P-1001] …") and date history on WO-40, plus the merge line', (w.log || []).some(x => /^\[P-1001\] Due date moved/.test(x.what)) && (w.log || []).some(x => /P-1001 \(planner P-number for this house\) merged into WO-40/.test(x.what)) && (w.dueHist || []).some(x => x.why === 'Site not ready'), JSON.stringify((w.log || []).map(x => x.what)).slice(0, 300));
    for (let i = 0; i < 100 && D.find(S.db, 'lists', 'LP1').wos.includes('P-1001'); i++) await sleep(100); // the list change goes through the line queue
    const lp1 = D.find(S.db, 'lists', 'LP1');
    rec('the cutting list "House 40" moved from P-1001 to WO-40 (database)', lp1 && lp1.wos.includes('WO-40') && !lp1.wos.includes('P-1001'), JSON.stringify(lp1 && lp1.wos));
    const r40 = S.db.t.project_seq.find(x => x.id === 'R40');
    rec('the sequence row handed over: same row R40, now WO-40, matched', r40 && r40.wo === 'WO-40' && r40.state === 'matched', JSON.stringify(r40 && { wo: r40.wo, st: r40.state }));
    rec('P-1003 → WO-42 NOT merged: both have a live cutting list — "archive one first"; both jobs and both lists stay', J.p3 && J.w42 && out.some(x => x.p === 'P-1003' && !x.ok && /both have a live cutting list/.test(x.why)) && /P-1003 NOT merged/.test(J.res)
      && D.find(S.db, 'lists', 'LP3').wos.includes('P-1003') && D.find(S.db, 'lists', 'L42').wos.includes('WO-42'), JSON.stringify(out.find(x => x.p === 'P-1003')));
    rec('unticked / not offered stay as they were: P-1002 + new WO-41 both there; P-1005, P-1008 there', J.p2 && J.w41 && J.p5 && J.p8, JSON.stringify(J));
    // ---- PC B applies its older preview: merged once, never twice; no second WO-40
    await q.evaluate(() => document.getElementById('imp-apply').click()); await sleep(1500);
    let st = await q.evaluate(async () => ({ run: PMERGE_RUN ? await PMERGE_RUN : null, plan: !!IMPPLAN, pm: [...document.querySelectorAll('[data-pmg]')].map(c => c.dataset.pmg + '>' + c.value + (c.checked ? '✓' : '')) }));
    if (st.plan) { await q.evaluate(() => document.getElementById('imp-apply').click()); await sleep(1500); st = await q.evaluate(async () => ({ run: PMERGE_RUN ? await PMERGE_RUN : null, plan: !!IMPPLAN })); }
    await sleep(1800);
    const B = await q.evaluate(() => ({ n40: DB.orders.filter(o => o.wo === 'WO-40').length, p1: DB.orders.some(o => o.wo === 'P-1001'), pf: (DB.orders.find(o => o.wo === 'WO-40') || {}).pFrom }));
    rec('second PC with the same preview: no second merge, WO-40 once, P-1001 not back', B.n40 === 1 && !B.p1 && (B.pf || []).length === 1, JSON.stringify({ B: { n40: B.n40, p1: B.p1, pf: (B.pf || []).length }, run: st.run }));
    // ---- the same file again on A: P-1001 no longer offered; P-1002 still offered, unticked
    await H.importAoa(p, FILE); await sleep(300);
    r = await pmRows(p);
    rec('importing again: P-1001 not offered any more; P-1002 → WO-41 still offered, unticked', !r.some(x => x.p === 'P-1001') && r.some(x => x.p === 'P-1002' && x.w === 'WO-41' && !x.on), JSON.stringify(r.map(x => x.p + '>' + x.w + (x.on ? '✓' : ''))));
    // ---- a person ticks the "not sure" one: merged (the person decided)
    await p.evaluate(() => { document.querySelectorAll('[data-pmg]').forEach(c => { c.checked = c.dataset.pmg === 'P-1002'; }); document.getElementById('imp-apply').click(); });
    await sleep(300); for (let i = 0; i < 40 && !(await p.evaluate(() => !!(PMERGE_RUN && document.getElementById('imp-pmres')))); i++) await sleep(100);
    const o2 = await p.evaluate(async () => (await PMERGE_RUN) || []);
    const J2 = await p.evaluate(() => ({ p2: DB.orders.some(o => o.wo === 'P-1002'), n41: DB.orders.filter(o => o.wo === 'WO-41').length, p3: DB.orders.some(o => o.wo === 'P-1003') }));
    rec('ticked by a person: P-1002 merged into WO-41; P-1003 left (unticked this time)', o2.some(x => x.p === 'P-1002' && x.ok) && !J2.p2 && J2.n41 === 1 && J2.p3, JSON.stringify({ o2, J2 }));
    // ---- phone: the preview section at 360 px
    await H.importAoa(p, FILE); await p.setViewportSize({ width: 360, height: 740 }); await sleep(400);
    const ph = await p.evaluate(() => { const c = document.querySelector('[data-pmg]'), l = c && c.closest('label'); return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, h: l ? l.getBoundingClientRect().height : 0, box: c ? c.getBoundingClientRect().width : 0 }; });
    rec('360 px: merge rows ≥ 44 px tall, 22 px tick boxes, no sideways scroll', ph.sw <= ph.cw + 1 && ph.h >= 44 && ph.box >= 20, JSON.stringify(ph));
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    await a.close(); await b.close();
    // ---- lists switched off: never offered
    const S2 = server(); S2.row.settings = X.v1Row().settings; S2.db.listStore = 'v1';
    const c = await X.dev(browser, S2, 'office');
    await H.importAoa(c.page, FILE); await sleep(300);
    rec('lists switched off: no merge section (today\'s import)', !(await c.page.evaluate(() => !!document.getElementById('imp-pm'))));
    await c.close();
  } finally { await browser.close(); }
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
