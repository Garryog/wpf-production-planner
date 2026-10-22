// CODER (Stage 2 fixes, 22 Oct): checks for the Tester/Manager review items 1–9.
// Fake Supabase only (tests/harness.js, tests/stage1/tsrv.js) — nothing real is touched.
// Run: node tests/stage2/coder-fixes.test.js
const { H, makeServer, device } = require('../stage1/tsrv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
(async () => {
  const browser = await H.chromium.launch();
  // ---- 1. Apply re-checks against the database: a NEW change appearing since the preview → shown again, not applied
  {
    const S = makeServer({ id: 'main', version: 1, nid: 3, settings: {}, orders: [H.order({ wo: 'WO-1', value: 4000, plannedWeek: '2026-10-26', step: '3. In production' })] });
    const A = await device(browser, S, { name: 'A' }), B = await device(browser, S, { name: 'B' });
    await A.page.evaluate(() => { showTab('i'); IMPPLAN = analyzeImport(prepImport([{ wo: 'WO-1', value: 9000, step: '3. In production', dueDate: '2026-11-02' }, { wo: 'WO-2', value: 1000, step: '3. In production', dueDate: '2026-11-02' }]), 'file'); renderImportPreview(IMPPLAN); });
    // PC B adds WO-2 by hand with a different value → the import would now UPDATE it (not shown in the preview)
    await B.page.evaluate(async () => { DB.orders.push({ wo: 'WO-2', title: 'by hand', value: 500, hours: 2, hoursSrc: 'hand', dueDate: '2026-11-02', plannedWeek: '2026-10-26', step: '3. In production' }); await saveDB(); });
    const r = await A.page.evaluate(async () => { await document.getElementById('imp-apply').onclick(); return { banner: (document.getElementById('imp-changed') || {}).textContent || '', still: !!IMPPLAN, wo1: DB.orders.find(o => o.wo === 'WO-1').value }; });
    rec('1: plan changed while reviewing → banner with differences, nothing applied', /plan changed while you were reviewing/.test(r.banner) && /WO-2/.test(r.banner) && r.still && r.wo1 === 4000, JSON.stringify(r).slice(0, 300));
    const r2 = await A.page.evaluate(async () => { await document.getElementById('imp-apply').onclick(); await saveDB(); return { still: !!IMPPLAN, wo1: DB.orders.find(o => o.wo === 'WO-1').value, n2: DB.orders.filter(o => o.wo === 'WO-2').length, v2: DB.orders.find(o => o.wo === 'WO-2').value }; });
    rec('1: second Apply (nothing new) applies the re-checked plan; WO-2 not duplicated', !r2.still && r2.wo1 === 9000 && r2.n2 === 1 && r2.v2 === 1000, JSON.stringify(r2));
    await A.close(); await B.close();
  }
  // ---- 1. database unreachable at Apply → not applied
  {
    const S = makeServer({ id: 'main', version: 1, nid: 3, settings: {}, orders: [H.order({ wo: 'WO-1', value: 4000, plannedWeek: '2026-10-26' })] });
    const A = await device(browser, S, { name: 'A' });
    await A.page.evaluate(() => { showTab('i'); IMPPLAN = analyzeImport(prepImport([{ wo: 'WO-1', value: 9000, dueDate: '2026-11-02' }]), 'file'); renderImportPreview(IMPPLAN); });
    await A.page.evaluate(() => { window.__of = window.fetch; window.fetch = () => Promise.reject(new Error('offline')); });
    const r = await A.page.evaluate(async () => { await document.getElementById('imp-apply').onclick(); window.fetch = window.__of; return { still: !!IMPPLAN, v: DB.orders[0].value }; });
    rec('1: database unreachable at Apply → import not applied, preview kept', r.still && r.v === 4000, JSON.stringify(r));
    await A.close();
  }
  // ---- single-PC checks (items 2–9)
  const t = await H.open({ browser, now: '2026-10-19T10:00:00Z', row: { id: 'main', nid: 9, settings: {}, orders: [
    H.order({ wo: 'WO-2604-1', value: 4000, hours: 6, hoursEstimated: true, hoursSrc: 'est', step: '3. In production', dueDate: '2026-11-20' }),
    H.order({ wo: 'WO-8000-1', step: '3. In production' }), H.order({ wo: 'WO-8000-2', step: '3. In production' }), H.order({ wo: 'WO-8000-3', step: '3. In production', delv: true }),
  ] } });
  const P = rows => t.page.evaluate(rows => { const p = analyzeImport(prepImport(rows), 'file'); return p && JSON.parse(JSON.stringify(p, (k, v) => k === 'input' ? undefined : v)); }, rows);
  const ev = (fn, arg) => t.page.evaluate(fn, arg);
  // 2. Cienapps status ladder (Garry, 22 Oct) — every step 1–12, incl. "2.NO SITE" with no space
  const LAD = ['1.DRAWING', '2.NO SITE MEASURE DONE', '3. READY FOR UPLOAD', '4. READY FOR PRODUCTION', '5. WORK ORDER PROCESSED', '6. JOB CUT COMPLETE', '7. ASSEMBLY COMPLETE', '8. PALLETED', '9. JOB SHIPPED', '10. INSTALLED TO BE INVOICE', '11. COMPLETED AND INVOICED', '12. ON HOLD / DELETE'];
  const lad = await ev(L => L.map(s => [stepNo(s), stepNo(' ' + s.toLowerCase() + '  '), stepIsShipped(s), stepOnHold(s), stepForDelivery(s)]), LAD);
  LAD.forEach((s, i) => rec('2: "' + s + '" → step ' + (i + 1) + (i >= 8 && i <= 10 ? ', shipped' : '') + (i === 11 ? ', on hold' : '') + (i === 6 || i === 7 ? ', delivery' : ''),
    lad[i][0] === i + 1 && lad[i][1] === i + 1 && lad[i][2] === (i >= 8 && i <= 10) && lad[i][3] === (i === 11) && lad[i][4] === (i === 6 || i === 7), JSON.stringify(lad[i])));
  const cmp = await ev(L => L.slice(0, 11).map((s, i) => i ? stepCmp(s, L[i - 1]) > 0 : true).every(Boolean), LAD);
  rec('2: steps 1–11 each rank ahead of the one before', cmp);
  const s2 = await ev(() => ['Ready to be shipped', 'Part shipped', 'Not shipped', 'Deposit invoiced', 'Job shipped', 'SHIPPED', '8. Job shipped'].map(s => stepIsShipped(s)));
  rec('2: unnumbered / mis-numbered shipped wording is never "shipped"', s2.every(x => x === false), JSON.stringify(s2));
  let p = await P([{ wo: 'WO-8000-1', step: 'Part shipped', dueDate: '2026-11-20' }]);
  rec('2: "Part shipped" on a board job → flagged + Differs, not Shipped, step not moved', !p.shipped.length && p.flagged.some(f => f.wo === 'WO-8000-1' && /not a shipped step/.test(f.why)) && p.stepDiffs.some(s => s.wo === 'WO-8000-1') && !p.updates.some(u => u.set.step), JSON.stringify([p.flagged, p.stepDiffs]));
  // 9 / 10 / 11 on board jobs → Shipped; 10 marked installed, 11 marked complete
  p = await P([{ wo: 'WO-8000-1', step: '9. JOB SHIPPED' }, { wo: 'WO-8000-2', step: '10. INSTALLED TO BE INVOICE' }, { wo: 'WO-8000-3', step: '11. COMPLETED AND INVOICED ' }]);
  rec('2: steps 9/10/11 → Shipped; 10 installed, 11 complete', p.shipped.length === 3 && p.marks.length === 2 && p.marks.find(m => m.wo === 'WO-8000-2').inst && !p.marks.find(m => m.wo === 'WO-8000-2').done && p.marks.find(m => m.wo === 'WO-8000-3').done, JSON.stringify(p.marks));
  const ap = await ev(() => { applyImport(analyzeImport(prepImport([{ wo: 'WO-8000-2', step: '10. INSTALLED TO BE INVOICE' }, { wo: 'WO-8000-3', step: '11. COMPLETED AND INVOICED' }]), 'file')); const g = w => DB.orders.find(o => o.wo === w); return [!!g('WO-8000-2').shippedAt, !!g('WO-8000-2').installedAt, !!g('WO-8000-2').completeAt, !!g('WO-8000-3').shippedAt, !!g('WO-8000-3').completeAt]; });
  rec('2: applied — 10 shipped+installed (not complete), 11 shipped+complete', JSON.stringify(ap) === '[true,true,false,true,true]', JSON.stringify(ap));
  // 12 on hold: out of sight (board, totals, part-load, PM), listed in the Shipped tab's On hold section; back when the step changes
  const h = await ev(() => {
    const wk = get8Wks()[1]; const o = DB.orders.find(x => x.wo === 'WO-2604-1'); o.plannedWeek = wk; o.orderNo = '2604'; o.unit = 'U1'; const before = wkHrs(wk);
    DB.orders.find(x => x.wo === 'WO-8000-1').orderNo = '2604'; DB.orders.find(x => x.wo === 'WO-8000-1').unit = 'U1';
    const p = analyzeImport(prepImport([{ wo: 'WO-2604-1', step: '12. ON HOLD / DELETE' }]), 'file'); applyImport(p);
    showTab('b'); const row = document.querySelector('tr[data-wo="WO-2604-1"]');
    showTab('h'); const sec = (document.getElementById('sh-hold') || {}).textContent || '';
    const r = { before, held: wkHrs(wk), on: DB.orders.includes(o), step: o.step, flag: p.flagged.some(f => /on hold/.test(f.why)), onBoard: !!row, inBO: boardOrders().includes(o),
      partLoad: partLoadGaps([DB.orders.find(x => x.wo === 'WO-8000-1')]).some(g => g.wo === 'WO-2604-1'), shTab: /WO-2604-1/.test(sec) && /\(1\)/.test(sec), holdAt: !!o.holdAt };
    const i = document.getElementById('sh-hq'); i.value = 'nomatch'; i.oninput.call(i); r.search0 = /No on-hold jobs match/.test(document.getElementById('sh-hold').textContent); i.value = ''; shHoldQ = '';
    const p2 = analyzeImport(prepImport([{ wo: 'WO-2604-1', step: '6. JOB CUT COMPLETE' }]), 'file'); applyImport(p2);
    r.backFlag = p2.flagged.some(f => /back from on hold/.test(f.why)); r.after = wkHrs(wk) - (+o.hours || 0); r.step2 = o.step; r.hold2 = !!o.cienHold; r.inBO2 = boardOrders().includes(o); return r; });
  rec('2: 12 ON HOLD — kept (never deleted), flagged, off the board, out of week totals and part-load', h.on && h.flag && h.step === '3. In production' && h.held === h.before - 6 && !h.onBoard && !h.inBO && !h.partLoad && h.holdAt, JSON.stringify(h));
  rec('2: 12 ON HOLD — listed in the Shipped tab On hold section with count and search', h.shTab && h.search0, JSON.stringify(h));
  rec('2: step changes (6.) → back on the board, flagged "back from on hold", back in totals', !h.hold2 && h.inBO2 && h.backFlag && h.after === h.held && h.step2 === '6. JOB CUT COMPLETE', JSON.stringify(h));
  p = await P([{ wo: 'WO-8100-1', step: '12. ON HOLD / DELETE', value: 3000, dueDate: '2026-10-20' }]);
  rec('2: new job at 12 → added on hold, left unscheduled', p.newOrders.length === 1 && p.newOrders[0].cienHold && p.unsched.includes('WO-8100-1'), JSON.stringify(p.newOrders));
  // 3. auto-tag for delivery at 7 / 8
  p = await P([{ wo: 'WO-8300-1', step: '7. ASSEMBLY COMPLETE', value: 2000, dueDate: '2026-11-20' }, { wo: 'WO-8300-2', step: '8.PALLETED', value: 2000, dueDate: '2026-11-20' }, { wo: 'WO-8300-3', step: '6. JOB CUT COMPLETE', value: 2000, dueDate: '2026-11-20' }]);
  rec('3: new jobs at 7 / 8 auto-tagged (delv, no van/day); 6 not', p.newOrders.filter(o => o.delv).map(o => o.wo).join() === 'WO-8300-1,WO-8300-2' && p.newOrders.every(o => !o.delVeh && !o.delDay) && p.autoTag.length === 2, JSON.stringify(p.autoTag));
  const at = await ev(() => { const o = DB.orders.find(x => x.wo === 'WO-8000-1'); delete o.shippedAt; o.step = '6. JOB CUT COMPLETE'; o.delv = false;
    const p = analyzeImport(prepImport([{ wo: 'WO-8000-1', step: '8. PALLETED' }]), 'file'); IMPPLAN = p; showTab('i'); renderImportPreview(p); const txt = document.getElementById('iprev').textContent;
    applyImport(p); IMPPLAN = null; const r = { delv: o.delv, veh: o.delVeh || '', day: o.delDay || '', txt: /1 auto-tagged for delivery/.test(txt) };
    o.delv = false; o.planUntag = 1; const p2 = analyzeImport(prepImport([{ wo: 'WO-8000-1', step: '8. PALLETED' }]), 'file'); applyImport(p2); r.reTag = o.delv;
    o.delv = true; const p3 = analyzeImport(prepImport([{ wo: 'WO-8000-1', step: '9. JOB SHIPPED' }]), 'file'); applyImport(p3); r.kept = o.delv; return r; });
  rec('3: board job moved to 8 by import → tagged, no van/day; preview says "1 auto-tagged for delivery"', at.delv === true && !at.veh && !at.day && at.txt, JSON.stringify(at));
  rec('3: a planner untag is not undone by a re-import of the same step; import never untags', at.reTag === false && at.kept === true, JSON.stringify(at));
  await t.close();
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
