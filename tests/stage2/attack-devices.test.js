// TESTER ATTACK (Stage 2): an import applied on PC A while PC B edits the same jobs (Stage 1 merge).
// Fake versioned Supabase from tests/stage1/tsrv.js — nothing real is touched.
// Run: node tests/stage2/attack-devices.test.js
const { H, makeServer, device } = require('../stage1/tsrv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
(async () => {
  const browser = await H.chromium.launch();
  const st = { 'WO-1': '3. In production', 'WO-2': '3. In production', 'WO-3': '3. In production', 'WO-4': '3. In production' };
  const base = () => ({ id: 'main', version: 1, nid: 5, settings: { exportBase: { wk: { 'WO-1': '2026-10-26', 'WO-2': '2026-10-26', 'WO-3': '2026-10-26', 'WO-4': '2026-10-26' }, st } }, orders: [
    H.order({ wo: 'WO-1', value: 4000, hours: 6, hoursEstimated: true, hoursSrc: 'est', plannedWeek: '2026-10-26' }),
    H.order({ wo: 'WO-2', plannedWeek: '2026-10-26' }),
    H.order({ wo: 'WO-3', plannedWeek: '2026-10-26', dueDate: '2026-11-02' }),
    H.order({ wo: 'WO-4', plannedWeek: '2026-10-26' }),
  ] });
  const S = makeServer(base());
  const A = await device(browser, S, { name: 'A' }), B = await device(browser, S, { name: 'B' });
  // A builds the preview from the file: value change (re-estimates WO-1 hours), Cienapps step ahead on WO-2, new due date on WO-3, new job WO-9
  await A.page.evaluate(() => { showTab('i'); IMPPLAN = analyzeImport(prepImport([
    { wo: 'WO-1', value: 9000, step: '3. In production', dueDate: '2026-11-02' },
    { wo: 'WO-2', value: 4000, step: '4. READY FOR PRODUCTION', dueDate: '2026-11-02' },
    { wo: 'WO-3', value: 4000, step: '3. In production', dueDate: '2026-11-20' },
    { wo: 'WO-9', value: 4000, step: '3. In production', dueDate: '2026-11-02', title: 'From Cienapps' },
  ]), 'file'); renderImportPreview(IMPPLAN); });
  // Meanwhile on PC B: hand-set WO-1 to 20h, moves WO-2 on to Production complete, hand-sets WO-3 due date, adds WO-9 by hand
  await B.page.evaluate(async () => {
    const o1 = DB.orders.find(o => o.wo === 'WO-1'); o1.hours = 20; o1.hoursEstimated = false; o1.hoursSrc = 'hand';
    DB.orders.find(o => o.wo === 'WO-2').step = '6. JOB CUT COMPLETE';
    DB.orders.find(o => o.wo === 'WO-4').notes = 'B note';
    await saveDB();
  });
  const v1 = S.row.version;
  // R2 fix 2 (agreed): B changed jobs the import writes to → the first Apply re-shows; the planner checks it and presses Apply again
  const first = await A.page.evaluate(async () => { await document.getElementById('imp-apply').onclick(); return { still: !!IMPPLAN, banner: ((document.getElementById('imp-changed') || {}).textContent || '').replace(/\s+/g, ' ') }; });
  // WO-2: B's step 6 is now ahead of the file's 4, so the import no longer writes to it (dropped, not re-shown) — only WO-1 re-shows
  rec('first Apply re-shows the preview naming WO-1 (hand-set hours on PC B), not WO-2', first.still && /WO-1: changed on another PC/.test(first.banner) && !/WO-2/.test(first.banner), first.banner.slice(0, 300));
  const second = await A.page.evaluate(async () => { const b = document.getElementById('imp-apply'); if (b) await b.onclick(); const still = !!IMPPLAN; await saveDB(); return still; });
  rec('second Apply goes through', !second);
  await new Promise(r => setTimeout(r, 500));
  await A.page.evaluate(() => loadDB()); await B.page.evaluate(() => loadDB());
  await new Promise(r => setTimeout(r, 500));
  const g = w => S.row.orders.find(o => o.wo === w) || {};
  rec('server moved on (B saved first)', v1 > 1 && S.row.version > v1, 'v ' + v1 + ' → ' + S.row.version);
  rec('B\'s hand-set 20h on WO-1 survives A\'s import (planner hours win)', g('WO-1').hours === 20 && g('WO-1').hoursSrc === 'hand', JSON.stringify({ h: g('WO-1').hours, src: g('WO-1').hoursSrc, est: g('WO-1').hoursEstimated, value: g('WO-1').value }));
  rec('WO-1 value from Cienapps (9000) still applied', g('WO-1').value === 9000, String(g('WO-1').value));
  rec('B\'s step "6. JOB CUT COMPLETE" on WO-2 is not moved BACKWARDS to "4. READY FOR PRODUCTION" by the import', g('WO-2').step === '6. JOB CUT COMPLETE', 'step=' + g('WO-2').step);
  rec('B\'s note on WO-4 kept', g('WO-4').notes === 'B note');
  rec('new WO-9 added once', S.row.orders.filter(o => o.wo === 'WO-9').length === 1);
  const chA = await A.page.evaluate(() => changes().map(o => o.wo + ':' + origStep[o.wo] + '>' + o.step).join()), chB = await B.page.evaluate(() => changes().map(o => o.wo + ':' + origStep[o.wo] + '>' + o.step).join());
  rec('Export Changes the same on both PCs after the merge', chA === chB, 'A=' + chA + ' B=' + chB);
  rec('no page errors', !A.dev.errors.length && !B.dev.errors.length, A.dev.errors.concat(B.dev.errors).join(' | '));
  await A.close(); await B.close();

  // Bring back on PC B while PC A's import (same Cienapps "shipped") is being previewed
  {
    const r = { id: 'main', version: 1, nid: 3, settings: {}, orders: [H.order({ wo: 'WO-5', plannedWeek: '2026-10-26', shippedAt: '2026-10-10T10:00:00Z', cienStep: '9. JOB SHIPPED', step: '9. JOB SHIPPED' })] };
    const S2 = makeServer(r);
    const A2 = await device(browser, S2, { name: 'A' }), B2 = await device(browser, S2, { name: 'B' });
    await A2.page.evaluate(() => { showTab('i'); IMPPLAN = analyzeImport(prepImport([{ wo: 'WO-5', step: '9. JOB SHIPPED', value: 4000, dueDate: '2026-11-02' }]), 'file'); renderImportPreview(IMPPLAN); });
    await B2.page.evaluate(async () => { showTab('h'); document.querySelector('[data-shb="WO-5"]').click(); await saveDB(); });
    await A2.page.evaluate(async () => { for (let i = 0; i < 3 && IMPPLAN; i++) { const b = document.getElementById('imp-apply'); if (!b) break; await b.onclick(); } await saveDB(); });
    const a2Done = await A2.page.evaluate(() => !IMPPLAN);
    rec('A\'s import of the shipped file actually applied (after any re-show)', a2Done);
    const o = S2.row.orders[0];
    rec('"Bring back" on PC B survives an import of the same shipped status applied on PC A', !o.shippedAt && !!o.shipBack, JSON.stringify({ shippedAt: o.shippedAt, shipBack: o.shipBack }));
    await A2.close(); await B2.close();
  }
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
