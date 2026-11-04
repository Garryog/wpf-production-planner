// Garry, 4 Nov: every work order at "7. ASSEMBLY COMPLETE" or "8. PALLETED" must come through a Cienapps import
// already ticked for delivery (delv = true, in the delivery board pool, preview says "N auto-tagged for delivery").
// Real .xlsx through doImport, with trailing spaces in the headers and the step cells, "8.PALLETED" with no space,
// lower case, and a job already on a van/day that must keep its van and day. Stubbed Supabase only.
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
  console.log('INFO  a job already at 8 in the planner before go-live (never ticked), re-imported at 8: delv=' + old.delv + (old.delv ? '' : ' — NOT ticked: the rule only fires when the step moves to 7/8 (Garry to decide)'));
  await t.close();
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
  process.exit(res.every(Boolean) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
