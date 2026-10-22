// CODER (Stage 2 round 2 fixes, 22 Oct): hours merge as one unit, Apply re-check on every field, on hold out of
// sight, woFinished, planner overrides, deleted-during-preview, "already applied by another PC".
// Fake Supabase only (tests/harness.js, tests/stage1/tsrv.js) — nothing real is touched.
// Run: node tests/stage2/coder-r2.test.js
const { H, makeServer, device, sleep } = require('../stage1/tsrv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
(async () => {
  const browser = await H.chromium.launch();
  // ---- 1. mergePlan: hours/hoursSrc/hoursEstimated as one unit
  {
    const S = makeServer({ id: 'main', version: 1, nid: 3, settings: {}, orders: [H.order({ wo: 'WO-1', hours: 7, hoursSrc: 'est', hoursEstimated: true })] });
    const A = await device(browser, S, { name: 'A' });
    const r = await A.page.evaluate(() => {
      const b = { orders: [{ wo: 'W', hours: 7, hoursSrc: 'est', hoursEstimated: true }], settings: {} };
      const est = { orders: [{ wo: 'W', hours: 11, hoursSrc: 'est', hoursEstimated: true }], settings: {} };
      const hand = { orders: [{ wo: 'W', hours: 33, hoursSrc: 'hand', hoursEstimated: false }], settings: {} };
      const hand2 = { orders: [{ wo: 'W', hours: 40, hoursSrc: 'hand', hoursEstimated: false }], settings: {} };
      const o = p => p.plan.orders[0];
      const m1 = mergePlan(b, est, hand), m2 = mergePlan(b, hand, est), m3_ = mergePlan(b, hand2, hand), m4 = mergePlan(b, hand2, hand, { theirsWins: true }), m5 = mergePlan(b, b, hand);
      return { m1: o(m1), m2: o(m2), m3: o(m3_), m3n: m3_.notes.length, m4: o(m4), m5: o(m5) };
    });
    rec('1: estimate (mine) vs hand-set (theirs) → hand-set 33 with its source', r.m1.hours === 33 && r.m1.hoursSrc === 'hand' && r.m1.hoursEstimated === false, JSON.stringify(r.m1));
    rec('1: hand-set (mine) vs estimate (theirs) → hand-set 33', r.m2.hours === 33 && r.m2.hoursSrc === 'hand', JSON.stringify(r.m2));
    rec('1: two hand-set values → the save going in wins, logged as a clash', r.m3.hours === 40 && r.m3n === 1 && r.m4.hours === 33, JSON.stringify([r.m3, r.m3n, r.m4]));
    rec('1: changed on one side only → that side', r.m5.hours === 33 && r.m5.hoursSrc === 'hand', JSON.stringify(r.m5));
    await A.close();
  }
  // ---- 2. second PC applies the same file → "already applied by another PC"; deleted job skipped, not re-added
  {
    const S = makeServer({ id: 'main', version: 1, nid: 3, settings: {}, orders: ['WO-1', 'WO-2', 'WO-3'].map(w => H.order({ wo: w, value: 4000, hours: 7, hoursSrc: 'est', hoursEstimated: true, plannedWeek: '2026-10-26', dueDate: '2026-11-02', step: '5. WORK ORDER PROCESSED' })) });
    const A = await device(browser, S, { name: 'A' }), B = await device(browser, S, { name: 'B' });
    const F = [{ wo: 'WO-1', value: 9000, step: '5. WORK ORDER PROCESSED', dueDate: '2026-11-02' }, { wo: 'WO-2', value: 5000, step: '5. WORK ORDER PROCESSED', dueDate: '2026-11-02' }, { wo: 'WO-3', value: 6000, step: '5. WORK ORDER PROCESSED', dueDate: '2026-11-02' }];
    const prev = P => P.page.evaluate(f => { showTab('i'); IMPPLAN = analyzeImport(prepImport(f), 'file'); renderImportPreview(IMPPLAN); }, F);
    await prev(A); await prev(B);
    await B.page.evaluate(async () => { await document.getElementById('imp-apply').onclick(); await saveDB(); });
    const r = await A.page.evaluate(async () => { await document.getElementById('imp-apply').onclick(); return { still: !!IMPPLAN, txt: document.getElementById('iprev').textContent }; });
    rec('2: same file on a second PC → applies, says "already applied by another PC", not "edited on another PC"', !r.still && /changes already applied by another PC/.test(r.txt) && !/edited on another PC/.test(r.txt), r.txt.replace(/\s+/g, ' ').slice(0, 300));
    await A.close(); await B.close();
    const S2 = makeServer({ id: 'main', version: 1, nid: 3, settings: {}, orders: ['WO-1', 'WO-2', 'WO-3'].map(w => H.order({ wo: w, value: 4000, hours: 7, hoursSrc: 'est', hoursEstimated: true, plannedWeek: '2026-10-26', dueDate: '2026-11-02', step: '5. WORK ORDER PROCESSED' })) });
    const C = await device(browser, S2, { name: 'C' }), D = await device(browser, S2, { name: 'D' });
    await prev(C);
    await D.page.evaluate(async () => { DB.orders = DB.orders.filter(o => o.wo !== 'WO-3'); await saveDB(); });
    const r2 = await C.page.evaluate(async () => { await document.getElementById('imp-apply').onclick(); await saveDB(); return { still: !!IMPPLAN, txt: document.getElementById('iprev').textContent, n3: DB.orders.filter(o => o.wo === 'WO-3').length }; });
    await sleep(200);
    rec('2: job deleted on another PC during the preview → skipped (listed), not re-added', !r2.still && r2.n3 === 0 && /deleted on another PC/.test(r2.txt) && /WO-3/.test(r2.txt) && !S2.row.orders.some(o => o.wo === 'WO-3'), r2.txt.replace(/\s+/g, ' ').slice(0, 300));
    await C.close(); await D.close();
  }
  // ---- 3. Apply re-check: another PC re-dates a job in the preview → re-shown, its choice resets to Keep
  {
    const S = makeServer({ id: 'main', version: 1, nid: 3, settings: {}, orders: [H.order({ wo: 'WO-1', value: 4000, hours: 7, hoursSrc: 'est', hoursEstimated: true, plannedWeek: '2026-10-26', dueDate: '2026-11-02', step: '5. WORK ORDER PROCESSED' })] });
    const A = await device(browser, S, { name: 'A' }), B = await device(browser, S, { name: 'B' });
    await A.page.evaluate(() => { showTab('i'); IMPPLAN = analyzeImport(prepImport([{ wo: 'WO-1', value: 4000, step: '5. WORK ORDER PROCESSED', dueDate: '2026-11-20' }]), 'file'); renderImportPreview(IMPPLAN); });
    await B.page.evaluate(async () => { DB.orders[0].dueDate = '2026-11-06'; await saveDB(); });
    const r = await A.page.evaluate(async () => { await document.getElementById('imp-apply').onclick(); return { still: !!IMPPLAN, banner: (document.getElementById('imp-changed') || {}).textContent || '', keep: (document.querySelector('[data-dk="WO-1"][value="keep"]') || {}).checked }; });
    rec('3: another PC re-dated a job in the preview → preview shown again, row set to Keep', r.still && /WO-1: changed on another PC \(due date\)/.test(r.banner) && r.keep === true, JSON.stringify(r).slice(0, 300));
    await A.close(); await B.close();
  }
  await browser.close();

  // ---- 4/5. single screen (harness): overrides, on hold, woFinished, dropdown
  const NOW = '2026-10-19T10:00:00Z';
  const O = (wo, x) => H.order(Object.assign({ wo, step: '5. WORK ORDER PROCESSED', plannedWeek: '2026-10-19', dueDate: '2026-10-23', hours: 6, hoursSrc: 'est', hoursEstimated: true }, x || {}));
  const t = await H.open({ now: NOW, row: { id: 'main', nid: 9, orders: [O('WO-1'), O('WO-2', { delv: true, delVeh: 'VOLVO', delDay: 'Tue' }), O('WO-3'), O('WO-4')],
    settings: { lists: [{ id: 'L1', sheet: 'Unit 2', project: 'P', name: 'L1', wos: ['WO-2'], saw: 3, fit: 2 }], listHold: { L1: { 'saw|0': { st: 'hold', why: 'no board' } } } } } });
  const ev = (fn, a) => t.page.evaluate(fn, a);
  const imp = rows => ev(rows => { const p = analyzeImport(prepImport(rows), 'file'); applyImport(p); return JSON.parse(JSON.stringify({ flagged: p.flagged })); }, rows);
  const g = w => ev(w => JSON.parse(JSON.stringify(DB.orders.find(o => o.wo === w) || null)), w);
  // untag by hand at 7 → import 7 again doesn't re-tag; import 8 does and clears the override
  await imp([{ wo: 'WO-1', step: '7. ASSEMBLY COMPLETE' }]);
  await ev(() => { showTab('b'); document.querySelector('[data-dv="WO-1"]').click(); });
  let o1 = await g('WO-1');
  await imp([{ wo: 'WO-1', step: '6. JOB CUT COMPLETE' }]); await imp([{ wo: 'WO-1', step: '7. ASSEMBLY COMPLETE' }]);
  const a1 = await g('WO-1');
  await imp([{ wo: 'WO-1', step: '8. PALLETED' }]);
  const b1 = await g('WO-1');
  rec('5: untag by hand at 7 → stays untagged at 7; Cienapps 8 re-tags and clears the override', o1.delv === false && o1.delvOverride && !a1.delv && b1.delv === true && !b1.delvOverride, JSON.stringify([o1.delvOverride, a1.delv, b1.delv, b1.delvOverride]));
  // undo complete (button) → re-import 11 doesn't re-complete
  await imp([{ wo: 'WO-3', step: '11. COMPLETED AND INVOICED' }]);
  await ev(() => { shDone = true; showTab('h'); document.querySelector('[data-shu="WO-3"]').click(); shDone = false; });
  const r11 = await imp([{ wo: 'WO-3', step: '11. COMPLETED AND INVOICED' }]);
  const o3 = await g('WO-3');
  rec('5: "Undo complete" respected by the next import of 11 (flagged)', !o3.completeAt && !!o3.completeOverride && r11.flagged.some(f => /Undo complete/.test(f.why)), JSON.stringify([o3.completeAt, o3.completeOverride]));
  // on hold: off Deliveries and badge, list off saw queue, waiting shown on hold card
  await imp([{ wo: 'WO-2', step: '12. ON HOLD / DELETE' }]);
  const h = await ev(() => { showTab('d'); const del = /WO-2/.test(document.getElementById('app').textContent); const badge = +(document.getElementById('delcnt').textContent || 0);
    const d = document.createElement('div'); renderWorkList(d, 'saw'); const saw = /Unit 2/.test(d.textContent);
    showTab('h'); const card = document.getElementById('sh-hold').textContent; const o = DB.orders.find(o => o.wo === 'WO-2');
    return { del, badge, saw, wait: /1 line waiting/.test(card), was: /was Volvo|was VOLVO/i.test(card), print: workListFor('saw', 3).length, sheets: sheetNeed(workLists(), '', '').lines, delv: o.delv, veh: o.delVeh }; });
  rec('3: on hold → off Deliveries + badge, list off the saw queue / Print / sheets, hold card shows 1 line waiting and what it was taken off', !h.del && h.badge === 1 && !h.saw && h.wait && h.was && h.print === 0 && h.sheets === 0 && !h.delv && !h.veh, JSON.stringify(h));
  await imp([{ wo: 'WO-2', step: '5. WORK ORDER PROCESSED' }]);
  const back = await g('WO-2');
  rec('3: back from hold → on the board, delivery tag not restored', !back.cienHold && !back.delv && !back.delVeh, JSON.stringify([back.cienHold, back.delv, back.delVeh]));
  // woFinished + dropdown
  const wf = await ev(() => ({ a: woFinished({ step: '9. JOB SHIPPED' }), b: woFinished({ step: '9. JOB SHIPPED', shipBack: { at: '2026-10-19T09:00:00Z' } }), c: woFinished({ step: 'Job shipped' }), d: getSteps().includes('Job shipped'), n: getSteps().length }));
  rec('4: woFinished by the ladder; brought back = not finished; dropdown 1-8 only', wf.a && !wf.b && !wf.c && !wf.d && wf.n === 8, JSON.stringify(wf));
  rec('no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
  await t.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
