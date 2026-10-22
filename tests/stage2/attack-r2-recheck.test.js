// TESTER ATTACK round 2 (Stage 2): the Apply re-check. PC A has the import preview open; PC B changes
// things the import cares about and saves. Then A presses Apply. Does anything of B's get lost? Does the
// "plan changed" path work? Fake versioned Supabase (tests/stage1/tsrv.js) — nothing real is touched.
// Run: node tests/stage2/attack-r2-recheck.test.js
const { H, makeServer, device, sleep } = require('../stage1/tsrv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const L = { 3: '3. READY FOR UPLOAD', 5: '5. WORK ORDER PROCESSED', 6: '6. JOB CUT COMPLETE', 7: '7. ASSEMBLY COMPLETE', 8: '8. PALLETED', 9: '9. JOB SHIPPED', 12: '12. ON HOLD / DELETE' };
(async () => {
  const browser = await H.chromium.launch();
  const st = {}; const wk = {};
  const jobs = ['WO-1', 'WO-2', 'WO-3', 'WO-4', 'WO-5', 'WO-6', 'WO-7', 'WO-8'].map(w => { st[w] = L[5]; wk[w] = '2026-10-26'; return H.order({ wo: w, value: 4000, hours: 7, hoursEstimated: true, hoursSrc: 'est', plannedWeek: '2026-10-26', dueDate: '2026-11-02', origDueDate: '2026-11-02', step: L[5] }); });
  const row = () => ({ id: 'main', version: 1, nid: 20, settings: { exportBase: { wk, st } }, orders: JSON.parse(JSON.stringify(jobs)) });
  // the Cienapps file every scenario imports
  const FILE = [
    { wo: 'WO-1', value: 9000, step: L[5], dueDate: '2026-11-02' },          // value up → hours re-estimated
    { wo: 'WO-2', value: 4000, step: L[5], dueDate: '2026-11-20' },          // due date later
    { wo: 'WO-3', value: 4000, step: L[7], dueDate: '2026-11-02' },          // step forward to 7 → auto-tag
    { wo: 'WO-4', value: 4000, step: L[9], dueDate: '2026-11-02' },          // shipped
    { wo: 'WO-5', value: 4000, step: L[6], dueDate: '2026-11-02' },          // step forward to 6
    { wo: 'WO-6', value: 4000, step: L[5], dueDate: '2026-11-27' },          // due later — A picks "Move to"
    { wo: 'WO-7', value: 4000, step: L[12], dueDate: '2026-11-02' },         // on hold
    { wo: 'WO-8', value: 4000, step: L[5], dueDate: '2026-11-02' },          // unchanged
  ];
  const preview = (P, file) => P.page.evaluate(f => { showTab('i'); IMPPLAN = analyzeImport(prepImport(f), 'file'); renderImportPreview(IMPPLAN); return document.getElementById('iprev').textContent; }, file || FILE);
  const apply = P => P.page.evaluate(async () => { await document.getElementById('imp-apply').onclick(); const txt = document.getElementById('iprev').textContent; const still = !!IMPPLAN; if (!still) await saveDB(); return { txt, still, banner: (document.getElementById('imp-changed') || {}).textContent || '' }; });
  const srv = (S, w) => S.row.orders.find(o => o.wo === w) || null;

  // ---- 1. B hand-edits everything the import touches, then A applies
  {
    const S = makeServer(row());
    const A = await device(browser, S, { name: 'A' }), B = await device(browser, S, { name: 'B' });
    await preview(A);
    // A picks "Move to (due week)" for WO-6 in the preview
    const sel = await A.page.evaluate(() => { const s = document.querySelector('[data-rmv="WO-6"]'); if (!s) return null; s.value = s.options[1].value; return s.value; });
    await B.page.evaluate(async () => {
      const g = w => DB.orders.find(o => o.wo === w);
      Object.assign(g('WO-1'), { hours: 20, hoursSrc: 'hand', hoursEstimated: false });       // hours hand-set
      g('WO-2').dueDate = '2026-11-06';                                                         // planner re-dates WO-2 (customer rang)
      Object.assign(g('WO-3'), { step: '8. PALLETED' });                                        // B steps WO-3 past the file
      Object.assign(g('WO-4'), { delv: true, delVeh: 'VOLVO', delDay: 'Tue', delLoadedAt: '2026-10-22T08:00:00Z' }); // on a van
      g('WO-5').step = '7. ASSEMBLY COMPLETE'; g('WO-5').delv = true; g('WO-5').delVeh = 'IVECO'; g('WO-5').delDay = 'Wed';
      g('WO-6').plannedWeek = '2026-11-09';                                                     // B re-plans WO-6
      g('WO-7').notes = 'B: customer wants it held but keep the slot';
      await saveDB();
    });
    const r0 = await apply(A);
    // B moving WO-5 to 7 makes the import re-estimate its hours (7 = no CNC hours) — a genuinely NEW change, so a re-show is right
    rec('1: re-show only for genuinely new work (WO-5 hours re-estimated at B\'s step 7)', r0.still && /WO-5: hours/.test(r0.banner) && (r0.banner.match(/•/g) || []).length === 1, r0.banner.replace(/\s+/g, ' ').slice(0, 400));
    const r = r0.still ? await apply(A) : r0;
    await sleep(300); await B.page.evaluate(() => loadDB()); await sleep(300);
    const g = w => srv(S, w);
    rec('1: second Apply went through', !r.still, r.banner.replace(/\s+/g, ' ').slice(0, 600));
    rec('1: preview said which changes were dropped because B edited them', /not made — edited on another PC/.test(r.txt), r.txt.slice(0, 400));
    rec('1: B hand-set 20h on WO-1 kept; value 9000 taken', g('WO-1').hours === 20 && g('WO-1').hoursSrc === 'hand' && g('WO-1').value === 9000, JSON.stringify([g('WO-1').hours, g('WO-1').value]));
    rec('1: B moved WO-3 to 8 — not moved back to 7', g('WO-3').step === '8. PALLETED', g('WO-3').step);
    rec('1: WO-4 on B\'s van: shipped, van/day/loaded kept (stays on Deliveries)', !!g('WO-4').shippedAt && g('WO-4').delVeh === 'VOLVO' && g('WO-4').delDay === 'Tue' && !!g('WO-4').delLoadedAt && g('WO-4').delv, JSON.stringify(g('WO-4')).slice(0, 300));
    rec('1: WO-5 B stepped to 7 and put on Iveco/Wed — import (6) does not move it back or clear the van', g('WO-5').step === L[7] && g('WO-5').delVeh === 'IVECO' && g('WO-5').delDay === 'Wed', JSON.stringify([g('WO-5').step, g('WO-5').delVeh, g('WO-5').delDay]));
    rec('1: WO-7 on hold and B\'s note kept', g('WO-7').cienHold === true && /keep the slot/.test(g('WO-7').notes || ''), JSON.stringify([g('WO-7').cienHold, g('WO-7').notes]));
    // the two contested ones
    rec('1: B re-dated WO-2 to 6 Nov while A\'s preview showed "2 Nov → 20 Nov" — B\'s date is not silently overwritten (re-shown or kept)', g('WO-2').dueDate === '2026-11-06' || r.still, 'server due=' + g('WO-2').dueDate + ' origDue=' + g('WO-2').origDueDate + ' (preview showed old due 2 Nov; B set 6 Nov; Take applied without re-showing)');
    rec('1: B re-planned WO-6 to 9 Nov while A\'s preview offered "Move to" — B\'s week not silently overwritten', g('WO-6').plannedWeek === '2026-11-09' || r.still, 'A picked ' + sel + ', server week=' + g('WO-6').plannedWeek);
    rec('no page errors', !A.dev.errors.length && !B.dev.errors.length, A.dev.errors.concat(B.dev.errors).join(' | '));
    await A.close(); await B.close();
  }

  // ---- 2. B deletes a job that the import updates → re-shown as "new job"; Take/Keep and Move choices survive the re-show
  {
    const S = makeServer(row());
    const A = await device(browser, S, { name: 'A' }), B = await device(browser, S, { name: 'B' });
    await preview(A);
    await A.page.evaluate(() => { const k = document.querySelector('[data-dk="WO-2"][value="keep"]'); k.checked = true; const s = document.querySelector('[data-rmv="WO-6"]'); s.value = s.options[1].value; });
    await B.page.evaluate(async () => { DB.orders = DB.orders.filter(o => o.wo !== 'WO-8'); await saveDB(); });
    const r = await apply(A);
    rec('2: B deleted WO-8 → Apply stops, banner names WO-8 as a new job', r.still && /WO-8/.test(r.banner) && /plan changed/.test(r.banner), r.banner.slice(0, 300));
    const kept = await A.page.evaluate(() => ({ keep: (document.querySelector('[data-dk="WO-2"][value="keep"]') || {}).checked, mv: (document.querySelector('[data-rmv="WO-6"]') || {}).value }));
    rec('2: Keep on WO-2 and Move on WO-6 still chosen after the re-show', kept.keep === true && !!kept.mv, JSON.stringify(kept));
    const r2 = await apply(A);
    const g = w => srv(S, w);
    rec('2: second Apply goes through; WO-2 kept planner date (dueKeep), WO-6 moved', !r2.still && g('WO-2').dueDate === '2026-11-02' && g('WO-2').dueKeep === '2026-11-20' && g('WO-6').plannedWeek !== '2026-10-26', JSON.stringify([g('WO-2').dueDate, g('WO-2').dueKeep, g('WO-6').plannedWeek]));
    rec('2: deleted WO-8 is re-added once (the file still has it) — INFO: planner\'s delete is undone by the import', S.row.orders.filter(o => o.wo === 'WO-8').length === 1, String(S.row.orders.filter(o => o.wo === 'WO-8').length));
    await A.close(); await B.close();
  }

  // ---- 3. A has an UNSAVED edit (typed a note, save not yet fired) when pressing Apply → the fresh load must not drop it
  {
    const S = makeServer(row());
    const A = await device(browser, S, { name: 'A' }), B = await device(browser, S, { name: 'B' });
    await preview(A);
    await B.page.evaluate(async () => { DB.orders.find(o => o.wo === 'WO-8').notes = 'B note'; await saveDB(); });
    await A.page.evaluate(() => { DB.orders.find(o => o.wo === 'WO-1').notes = 'A typed this'; sched(); });
    const r = await apply(A);
    const g = w => srv(S, w);
    rec('3: A\'s unsaved note and B\'s saved note both survive A\'s Apply', g('WO-1').notes === 'A typed this' && g('WO-8').notes === 'B note' && !r.still, JSON.stringify([g('WO-1').notes, g('WO-8').notes, r.still]));
    await A.close(); await B.close();
  }

  // ---- 4. B untags WO-3 for delivery AFTER the preview (preview had auto-tag at 7) — untag survives
  {
    const S = makeServer(row());
    const A = await device(browser, S, { name: 'A' }), B = await device(browser, S, { name: 'B' });
    await preview(A);
    // B moves WO-3 to 7 by hand and deliberately leaves it untagged; then A applies the same step
    await B.page.evaluate(async () => { const o = DB.orders.find(o => o.wo === 'WO-3'); o.step = '7. ASSEMBLY COMPLETE'; o.delv = false; await saveDB(); });
    const r = await apply(A);
    const g = w => srv(S, w);
    rec('4: B already moved WO-3 to 7 untagged → A\'s Apply does not tag it behind B\'s back', g('WO-3').delv !== true, JSON.stringify([g('WO-3').step, g('WO-3').delv, r.still]));
    await A.close(); await B.close();
  }

  // ---- 5. A database save from B lands DURING A's re-check (slow load) → no lost update
  {
    const S = makeServer(row());
    const A = await device(browser, S, { name: 'A', getDelay: 0 }), B = await device(browser, S, { name: 'B' });
    await preview(A);
    A.dev.getDelay = 800; // A's fresh load is slow
    const pA = apply(A);
    await sleep(200);
    await B.page.evaluate(async () => { DB.orders.find(o => o.wo === 'WO-1').hours = 33; DB.orders.find(o => o.wo === 'WO-1').hoursSrc = 'hand'; DB.orders.find(o => o.wo === 'WO-8').notes = 'B late'; await saveDB(); });
    const r = await pA; A.dev.getDelay = 0;
    await sleep(500); await A.page.evaluate(() => saveDB()); await sleep(300);
    const g = w => srv(S, w);
    rec('5: B saves while A\'s re-check is in flight — B\'s hours 33 and note kept (merge at save)', g('WO-1').hours === 33 && g('WO-8').notes === 'B late', JSON.stringify([g('WO-1').hours, g('WO-1').value, g('WO-8').notes, r.still]));
    rec('5: A\'s import still landed (value 9000, WO-4 shipped)', g('WO-1').value === 9000 && !!g('WO-4').shippedAt, JSON.stringify([g('WO-1').value, !!g('WO-4').shippedAt]));
    await A.close(); await B.close();
  }

  // ---- 5b. B hand-sets hours in the 1.2 s between A's Apply and A's (debounced) save
  {
    const S = makeServer(row());
    const A = await device(browser, S, { name: 'A' }), B = await device(browser, S, { name: 'B' });
    await preview(A);
    await A.page.evaluate(async () => { await document.getElementById('imp-apply').onclick(); }); // applied locally; save is 1.2 s away
    await B.page.evaluate(async () => { const o = DB.orders.find(o => o.wo === 'WO-1'); o.hours = 33; o.hoursSrc = 'hand'; o.hoursEstimated = false; await saveDB(); });
    await sleep(2500);
    const toast = await A.page.evaluate(() => document.getElementById('toast').textContent);
    const g = w => srv(S, w);
    rec('5b: B hand-sets 33h on WO-1 just after A applied — planner hours win over the import estimate', g('WO-1').hours === 33, JSON.stringify({ hours: g('WO-1').hours, src: g('WO-1').hoursSrc, toastOnA: toast }));
    await A.close(); await B.close();
  }
  // ---- 6. A is offline at Apply → told, nothing applied, preview kept; back online → Apply works
  {
    const S = makeServer(row());
    const A = await device(browser, S, { name: 'A' });
    await preview(A);
    A.dev.offline = true;
    const r = await apply(A).catch(e => ({ err: String(e) }));
    const toast = await A.page.evaluate(() => document.getElementById('toast').textContent);
    rec('6: offline at Apply → not applied, preview kept, user told', r.still && /NOT applied/.test(toast), JSON.stringify(r).slice(0, 100) + ' toast=' + toast);
    A.dev.offline = false;
    const r2 = await apply(A);
    rec('6: back online → Apply works', !r2.still && srv(S, 'WO-1').value === 9000, JSON.stringify(r2).slice(0, 120));
    await A.close();
  }
  // ---- 7. Both office PCs import the same file (A previewing, B applies first) → no duplicates, nothing doubled
  {
    const S = makeServer(row());
    const A = await device(browser, S, { name: 'A' }), B = await device(browser, S, { name: 'B' });
    const F2 = FILE.concat([{ wo: 'WO-50-1', value: 3000, step: L[5], dueDate: '2026-11-13', title: 'new one' }, { wo: '2557_01', value: 1000, dueDate: '2026-11-13' }, { wo: '2557_01B', value: 200, dueDate: '2026-11-13' }]);
    await preview(A, F2); await preview(B, F2);
    const rb = await apply(B);
    const ra = await apply(A);
    await sleep(300);
    const n = w => S.row.orders.filter(o => o.wo === w).length;
    const v = S.row.orders.find(o => o.wo === '2557_01');
    rec('7: same file applied on two PCs → each new job once, addition value not doubled (€1,200)', n('WO-50-1') === 1 && n('2557_01') === 1 && v && v.value === 1200 && !ra.still && !rb.still, JSON.stringify({ n50: n('WO-50-1'), n2557: n('2557_01'), val: v && v.value, aStill: ra.still, aTxt: ra.txt.replace(/\s+/g, ' ').slice(0, 250) }));
    await A.close(); await B.close();
  }
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
