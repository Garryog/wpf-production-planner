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
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
