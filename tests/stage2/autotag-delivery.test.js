// Garry, 4 Nov: every work order at "7. ASSEMBLY COMPLETE" or "8. PALLETED" must come through a Cienapps import
// already ticked for delivery (delv = true, in the delivery board pool, preview says "N auto-tagged for delivery").
// Real .xlsx through doImport, with trailing spaces in the headers and the step cells, "8.PALLETED" with no space,
// lower case, and a job already on a van/day that must keep its van and day. Stubbed Supabase only.
// Also (Garry, 4 Nov): a step changed IN THE PLANNER to 7 / 8 ticks it, and a one-off Deliveries button catches up
// jobs already at 7 / 8 before the rule existed.
// Run: node tests/stage2/autotag-delivery.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
(async () => {
  const browser = await H.chromium.launch();
  const row = { id: 'main', nid: 5, settings: {}, orders: [
    // on the board already, moving to 7 / 8 in this import
    H.order({ wo: 'WO-500-1', step: '6. JOB CUT COMPLETE', plannedWeek: '2026-10-19', dueDate: '2026-10-23', customer: 'CAIRN' }),
    // already on a van and a day (planned by hand) — moving to 8 must keep VOLVO / Thu
    H.order({ wo: 'WO-500-2', step: '6. JOB CUT COMPLETE', plannedWeek: '2026-10-19', dueDate: '2026-10-23', customer: 'CAIRN', delv: true, delVeh: 'VOLVO', delDay: 'Thu' }),
    // planned van/day but delv somehow off (old data) — the import ticks it and must not clear the van/day
    H.order({ wo: 'WO-500-3', step: '6. JOB CUT COMPLETE', plannedWeek: '2026-10-19', dueDate: '2026-10-23', customer: 'CAIRN', delv: false, delVeh: 'DAF', delDay: 'Fri' }),
    // stays at 6 → not tagged
    H.order({ wo: 'WO-500-4', step: '5. WORK ORDER PROCESSED', plannedWeek: '2026-10-19', dueDate: '2026-10-23', customer: 'CAIRN' })
  ] };
  const t = await H.open({ browser, now: '2026-10-19T10:00:00Z', row });
  const HDR = ['WO # ', 'Title ', 'Customer ', 'Due Date ', 'Step ', 'Sub-Total ', 'Reference '];
  const aoa = [HDR,
    ['WO-500-1 ', 'House 1', 'CAIRN', 46318, '7. ASSEMBLY COMPLETE  ', 5000, ''],
    ['WO-500-2', 'House 2', 'CAIRN', 46318, '8. PALLETED ', 5000, ''],
    ['WO-500-3', 'House 3', 'CAIRN', 46318, ' 8.PALLETED', 5000, ''],
    ['WO-500-4', 'House 4', 'CAIRN', 46318, '6. JOB CUT COMPLETE', 5000, ''],
    ['WO-600-1', 'House 6', 'NEWCO', 46318, '8.PALLETED   ', 3000, ''],
    ['WO-600-2', 'House 7', 'NEWCO', 46318, '7.ASSEMBLY COMPLETE', 3000, ''],
    ['WO-600-3', 'House 8', 'NEWCO', 46318, '7. assembly complete ', 3000, ''],
    ['WO-600-4', 'House 9', 'NEWCO', 46318, '6. JOB CUT COMPLETE ', 3000, '']];
  const r = await H.importAoa(t.page, aoa);
  rec('real file with trailing-space headers goes straight to the preview (no mapping screen)', !!r.plan && !r.pend, r.pend ? JSON.stringify(r.pend) : '');
  const want = ['WO-500-1', 'WO-500-3', 'WO-600-1', 'WO-600-2', 'WO-600-3'];
  const at = r.plan ? r.plan.autoTag.slice().sort() : [];
  rec('auto-tag list = jobs reaching 7 / 8 that were not already tagged (trailing spaces, "8.PALLETED", lower case)', JSON.stringify(at) === JSON.stringify(want.slice().sort()), JSON.stringify(at));
  rec('preview says "' + want.length + ' auto-tagged for delivery"', new RegExp('\\b' + want.length + ' auto-tagged for delivery').test(r.iprev), (r.iprev.match(/[^\n]*auto-tagged[^\n]*/) || [''])[0]);
  const s = await t.page.evaluate(async () => {
    await document.getElementById('imp-apply').onclick();
    const g = w => { const o = DB.orders.find(x => x.wo === w); return o ? { delv: o.delv === true, veh: o.delVeh || '', day: o.delDay || '', step: o.step } : null; };
    showTab('d'); await new Promise(r => setTimeout(r, 150));
    const pool = [...document.querySelectorAll('#dpool .dchip')].map(c => c.textContent);
    const inPool = w => pool.some(x => x.includes(w));
    const out = {}; ['WO-500-1', 'WO-500-2', 'WO-500-3', 'WO-500-4', 'WO-600-1', 'WO-600-2', 'WO-600-3', 'WO-600-4'].forEach(w => { out[w] = Object.assign(g(w) || {}, { pool: inPool(w) }); });
    return out;
  });
  ['WO-500-1', 'WO-600-1', 'WO-600-2', 'WO-600-3'].forEach(w =>
    rec(w + ' ticked for delivery, no van/day, in the delivery board pool', s[w].delv && !s[w].veh && !s[w].day && s[w].pool, JSON.stringify(s[w])));
  rec('WO-500-2 already on VOLVO / Thu → still VOLVO / Thu after moving to 8 (not back in the pool)', s['WO-500-2'].delv && s['WO-500-2'].veh === 'VOLVO' && s['WO-500-2'].day === 'Thu' && !s['WO-500-2'].pool && /PALLETED/.test(s['WO-500-2'].step), JSON.stringify(s['WO-500-2']));
  rec('WO-500-3 had DAF / Fri with the tick off → ticked, keeps DAF / Fri', s['WO-500-3'].delv && s['WO-500-3'].veh === 'DAF' && s['WO-500-3'].day === 'Fri', JSON.stringify(s['WO-500-3']));
  rec('jobs at 6 are not ticked (existing and new)', !s['WO-500-4'].delv && !s['WO-600-4'].delv && !s['WO-500-4'].pool && !s['WO-600-4'].pool, JSON.stringify([s['WO-500-4'], s['WO-600-4']]));
  // a job ALREADY at 7 in the planner before the import (step unchanged) with no tick: information only (see report)
  const same = await t.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-600-3'); o.delv = false;
    const p = analyzeImport(prepImport([{ wo: 'WO-600-3', step: '7. ASSEMBLY COMPLETE' }]), 'file'); applyImport(p); return { delv: o.delv, tagged: p.autoTag.includes('WO-600-3') }; });
  console.log('INFO  a job already at 7 in the planner with the tick removed by hand, re-imported at the same step: delv=' + same.delv + ' (left as the planner set it — import only ticks on a step move)');
  // go-live case: a job that was ALREADY at 8 in the planner before this rule existed (never ticked, never untagged by hand)
  const old = await t.page.evaluate(() => { DB.orders.push(Object.assign({}, DB.orders.find(x => x.wo === 'WO-500-4'), { wo: 'WO-700-1', step: '8. PALLETED', delv: undefined, delVeh: '', delDay: '' }));
    const o = DB.orders.find(x => x.wo === 'WO-700-1'); const p = analyzeImport(prepImport([{ wo: 'WO-700-1', step: '8. PALLETED ' }]), 'file'); applyImport(p); return { delv: !!o.delv }; });
  console.log('INFO  a job already at 8 in the planner before go-live (never ticked), re-imported at 8: delv=' + old.delv + (old.delv ? '' : ' — NOT ticked by the import: the one-off Deliveries button "Tag assembled/palleted jobs for delivery" catches these up (tested below)'));
  await t.close();

  // ---- Garry, 4 Nov: changing the step IN THE PLANNER (board step dropdown) to 7 / 8 ticks it too
  const row2 = { id: 'main', nid: 5, settings: {}, orders: [
    H.order({ wo: 'WO-800-1', step: '6. JOB CUT COMPLETE', plannedWeek: '2026-10-19' }),                                    // → 8: ticked
    H.order({ wo: 'WO-800-2', step: '6. JOB CUT COMPLETE', plannedWeek: '2026-10-19', delv: true, delVeh: 'VOLVO', delDay: 'Thu' }), // → 7: keeps VOLVO/Thu
    H.order({ wo: 'WO-800-3', step: '7. ASSEMBLY COMPLETE', plannedWeek: '2026-10-19' }),                                   // → 5: not ticked; then → 7: ticked
    H.order({ wo: 'WO-800-4', step: '8. PALLETED', plannedWeek: '2026-10-19', delv: false, delvOverride: '8. PALLETED' }),   // untagged by hand at 8 → 7: stays untagged
    H.order({ wo: 'WO-800-5', step: '6. JOB CUT COMPLETE', plannedWeek: '2026-10-19', delv: false, delvOverride: '6. JOB CUT COMPLETE' }), // untagged at 6 → 8: ticked
    H.order({ wo: 'WO-800-6', step: '8. PALLETED', plannedWeek: '2026-10-19', cienHold: true }),                            // on hold at 8 (not on the board): go-live ticks it, still hidden
    // go-live gap: already at 7/8 before the rule, never ticked
    H.order({ wo: 'WO-900-1', step: '8. PALLETED', plannedWeek: '2026-10-19' }),
    H.order({ wo: 'WO-900-2', step: '7.ASSEMBLY COMPLETE ', plannedWeek: '2026-10-19', delVeh: 'DAF', delDay: 'Fri' }),
    H.order({ wo: 'WO-900-3', step: '8. PALLETED', plannedWeek: '2026-10-19', delv: false, delvOverride: '8. PALLETED' }), // hand-untagged: left
    H.order({ wo: 'WO-900-4', step: '8. PALLETED', plannedWeek: '2026-10-19', shippedAt: '2026-10-10T10:00:00Z' }),         // shipped: left
    H.order({ wo: 'WO-900-5', step: '6. JOB CUT COMPLETE', plannedWeek: '2026-10-19' }),                                   // not 7/8: left
    H.order({ wo: 'WO-900-6', step: '8. PALLETED', plannedWeek: '2026-10-05', dueDate: '2026-10-09' })                      // (10 Nov) due before the 1 Nov cut-off: LEFT — delivered long ago, Cienapps never moved it
  ] };
  const t2 = await H.open({ browser, now: '2026-10-19T10:00:00Z', row: row2 });
  const st = await t2.page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    const g = x => DB.orders.find(o => o.wo === x);
    const pick = async (wo, v) => { showTab('b'); await w(80); const s = document.querySelector('[data-stepsel="' + wo + '"]'); if (!s) return 'no dropdown for ' + wo; s.value = v; s.onchange.call(s); await w(80); return ''; };
    const errs = [];
    // the go-live button, before any step change
    showTab('d'); await w(120);
    const b = document.getElementById('btn-deltag');
    const btnTxt = b ? b.textContent : '';
    errs.push(await pick('WO-800-1', '8. PALLETED'));
    errs.push(await pick('WO-800-2', '7. ASSEMBLY COMPLETE'));
    errs.push(await pick('WO-800-3', '5. WORK ORDER PROCESSED'));
    const d3a = !!g('WO-800-3').delv;
    errs.push(await pick('WO-800-3', '7. ASSEMBLY COMPLETE'));
    errs.push(await pick('WO-800-4', '7. ASSEMBLY COMPLETE'));
    errs.push(await pick('WO-800-5', '8. PALLETED'));
    const snap = x => { const o = g(x); return { delv: o.delv === true, veh: o.delVeh || '', day: o.delDay || '', ovr: o.delvOverride || '', log: (o.log || []).map(l => l.what + ' |' + l.by).join(' / ') }; };
    const out = { btnTxt, d3a, errs: errs.filter(Boolean) };
    ['WO-800-1', 'WO-800-2', 'WO-800-3', 'WO-800-4', 'WO-800-5', 'WO-800-6'].forEach(x => out[x] = snap(x));
    showTab('d'); await w(120);
    const pool = [...document.querySelectorAll('#dpool .dchip')].map(c => c.textContent).join(' ');
    out.pool = { '800-1': pool.includes('WO-800-1') };
    // the button after the step changes: WO-900-1 and WO-900-2 only
    const b2 = document.getElementById('btn-deltag');
    out.btn2 = b2 ? b2.textContent : '';
    const op = window.prompt; window.prompt = (m, d) => d; // (10 Nov) the button first asks for the cut-off date — accept the default 1 Nov 2026
    let asked = '';const oc = window.confirm; window.confirm = m => { asked = m; return false; };
    b2.onclick(); out.cancelLeft = !g('WO-900-1').delv; out.asked = asked;
    window.confirm = oc; document.getElementById('btn-deltag').onclick(); await w(120);
    window.prompt = op;
    ['WO-800-6', 'WO-900-1', 'WO-900-2', 'WO-900-3', 'WO-900-4', 'WO-900-5', 'WO-900-6'].forEach(x => out[x] = snap(x));
    out.btn3 = !!document.getElementById('btn-deltag');
    out.pool6 = [...document.querySelectorAll('#dpool .dchip')].some(c => c.textContent.includes('WO-800-6'));
    return out;
  });
  rec('board step dropdown works (no missing dropdowns)', st.errs.length === 0, JSON.stringify(st.errs));
  rec('WO-800-1 6 → 8 on the board: ticked, no van/day, in the pool', st['WO-800-1'].delv && !st['WO-800-1'].veh && !st['WO-800-1'].day && st.pool['800-1'], JSON.stringify(st['WO-800-1']));
  rec('WO-800-1 history says "Auto-tagged for delivery — step changed to 8. PALLETED by Tester"', /Auto-tagged for delivery — step changed to 8\. PALLETED by Tester \|Tester/.test(st['WO-800-1'].log), st['WO-800-1'].log);
  rec('WO-800-2 already on VOLVO / Thu → 7: keeps VOLVO / Thu, no auto-tag entry', st['WO-800-2'].delv && st['WO-800-2'].veh === 'VOLVO' && st['WO-800-2'].day === 'Thu' && !/Auto-tagged/.test(st['WO-800-2'].log), JSON.stringify(st['WO-800-2']));
  rec('WO-800-3 7 → 5 is not ticked; 5 → 7 is', !st.d3a && st['WO-800-3'].delv, JSON.stringify(st['WO-800-3']));
  rec('WO-800-4 untagged by hand at 8, moved to 7: stays untagged (hand-untag respected, never ticked behind the person)', !st['WO-800-4'].delv && st['WO-800-4'].ovr === '8. PALLETED', JSON.stringify(st['WO-800-4']));
  rec('WO-800-5 untagged by hand at 6, moved to 8: ticked (the step moved beyond the untag), override cleared', st['WO-800-5'].delv && !st['WO-800-5'].ovr, JSON.stringify(st['WO-800-5']));
  rec('go-live button shows before: "Tag assembled/palleted jobs due from 1 Nov 26 for delivery (4)" (800-3 at 7, 800-6 on hold at 8, 900-1, 900-2 — 900-6 due 9 Oct is not counted)', /Tag assembled\/palleted jobs due from 1 Nov 26 for delivery \(4\)/.test(st.btnTxt), st.btnTxt);
  rec('go-live button after step changes still counts only the 3 untouched catch-up jobs', /\(3\)/.test(st.btn2), st.btn2);
  rec('go-live button asks first; Cancel changes nothing', st.cancelLeft && /Tick 3 jobs/.test(st.asked), st.asked);
  rec('go-live: WO-900-1 ticked (pool) with a history line', st['WO-900-1'].delv && /one-off catch-up\) by Tester/.test(st['WO-900-1'].log), JSON.stringify(st['WO-900-1']));
  rec('go-live: WO-900-2 ("7.ASSEMBLY COMPLETE ", had DAF / Fri) ticked, keeps DAF / Fri', st['WO-900-2'].delv && st['WO-900-2'].veh === 'DAF' && st['WO-900-2'].day === 'Fri', JSON.stringify(st['WO-900-2']));
  rec('go-live: hand-untagged, shipped and step-6 jobs left alone', !st['WO-900-3'].delv && !st['WO-900-4'].delv && !st['WO-900-5'].delv, JSON.stringify([st['WO-900-3'], st['WO-900-4'], st['WO-900-5']]));
  rec('go-live: WO-800-6 on hold at 8 is ticked but stays off the delivery board (on hold rules unchanged)', st['WO-800-6'].delv && !st.pool6, JSON.stringify(st['WO-800-6']));
  rec('(10 Nov) WO-900-6 at 8 but due 9 Oct (before the cut-off) is left alone — not ticked, no history', !st['WO-900-6'].delv && !st['WO-900-6'].log, JSON.stringify(st['WO-900-6']));
  rec('go-live button gone once nothing is left to tag', !st.btn3);
  await t2.page.waitForTimeout(2500);
  const ords = typeof t2.server.row.orders === 'string' ? JSON.parse(t2.server.row.orders) : t2.server.row.orders;
  const sv = JSON.stringify(ords.filter(o => /^WO-(800-1|900-1)$/.test(o.wo)).map(o => o.delv));
  rec('auto-tags reach the database (saved)', sv === '[true,true]', sv);
  rec('no page errors', !(t2.server.errors || []).length, JSON.stringify(t2.server.errors || []));
  await t2.close();
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
  process.exit(res.every(Boolean) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
