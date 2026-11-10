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
  const apply = P => P.page.evaluate(async () => { const b = document.getElementById('imp-apply'); if (!b) return { txt: document.getElementById('iprev').textContent, still: !!IMPPLAN, banner: '', noButton: true }; await b.onclick(); const txt = document.getElementById('iprev').textContent; const still = !!IMPPLAN; if (!still) await saveDB(); return { txt, still, banner: (document.getElementById('imp-changed') || {}).textContent || '' }; });
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
    // R2 fix 2 (agreed): any job B changed that the import still writes to re-shows the preview; those rows restart at Keep, no Move
    const bl = r0.banner.replace(/\s+/g, ' ');
    const named = ['WO-1', 'WO-2', 'WO-3', 'WO-4', 'WO-5', 'WO-6'].filter(w => new RegExp(w + ': changed on another PC').test(bl));
    rec('1: Apply re-shows and names every job B changed that the import writes to (WO-1..6), not WO-8', r0.still && named.length === 6 && !/WO-8/.test(bl), bl.slice(0, 500));
    const ch = await A.page.evaluate(() => ({ dk2: (document.querySelector('[data-dk="WO-2"][value="keep"]') || {}).checked, mv6: (document.querySelector('[data-rmv="WO-6"]') || { value: 'none' }).value, dk6: (document.querySelector('[data-dk="WO-6"][value="keep"]') || {}).checked }));
    rec('1: after the re-show B\'s rows start at Keep — WO-2 Keep, WO-6 Keep and A\'s "Move to" dropped', ch.dk2 === true && ch.dk6 === true && (ch.mv6 === '' || ch.mv6 === 'none'), JSON.stringify(ch));
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
    rec('1: B re-dated WO-2 to 6 Nov while A\'s preview showed "2 Nov → 20 Nov" — B\'s date kept', g('WO-2').dueDate === '2026-11-06', 'server due=' + g('WO-2').dueDate + ' origDue=' + g('WO-2').origDueDate + ' (preview showed old due 2 Nov; B set 6 Nov; Take applied without re-showing)');
    rec('1: B re-planned WO-6 to 9 Nov while A\'s preview offered "Move to" — B\'s week kept', g('WO-6').plannedWeek === '2026-11-09', 'A picked ' + sel + ', server week=' + g('WO-6').plannedWeek);
    rec('no page errors', !A.dev.errors.length && !B.dev.errors.length, A.dev.errors.concat(B.dev.errors).join(' | '));
    await A.close(); await B.close();
  }

  // ---- 2. B deletes a job the import would update (WO-8) while A's preview is open.
  // R2 fix 2 (agreed): the deleted job is skipped and listed, not re-added; nothing else changed, so Apply goes through
  // in one go with A's Keep (WO-2) and Move (WO-6) choices honoured.
  {
    const S = makeServer(row());
    const A = await device(browser, S, { name: 'A' }), B = await device(browser, S, { name: 'B' });
    await preview(A);
    await A.page.evaluate(() => { const k = document.querySelector('[data-dk="WO-2"][value="keep"]'); k.checked = true; const s = document.querySelector('[data-rmv="WO-6"]'); s.value = s.options[1].value; });
    await B.page.evaluate(async () => { DB.orders = DB.orders.filter(o => o.wo !== 'WO-8'); await saveDB(); });
    const r = await apply(A);
    const g = w => srv(S, w);
    rec('2: B deleted WO-8 → Apply goes through in one go and says WO-8 was skipped (deleted on another PC)', !r.still && /deleted on another PC[^]*WO-8/.test(r.txt), r.txt.replace(/\s+/g, ' ').slice(0, 400));
    rec('2: WO-8 not re-added by this Apply', S.row.orders.filter(o => o.wo === 'WO-8').length === 0, String(S.row.orders.filter(o => o.wo === 'WO-8').length));
    rec('2: A\'s choices honoured — WO-2 kept planner date (dueKeep 20 Nov), WO-6 moved to its due week', g('WO-2').dueDate === '2026-11-02' && g('WO-2').dueKeep === '2026-11-20' && g('WO-6').plannedWeek !== '2026-10-26' && g('WO-6').dueDate === '2026-11-27', JSON.stringify([g('WO-2').dueDate, g('WO-2').dueKeep, g('WO-6').plannedWeek, g('WO-6').dueDate]));
    // the NEXT import of the same file brings it back as a new job (the planner's delete is not remembered) — INFO only
    await A.page.evaluate(() => loadDB()); await preview(A); const r3 = await apply(A);
    console.log('INFO  next import after the delete: WO-8 lines on server = ' + S.row.orders.filter(o => o.wo === 'WO-8').length + ' (re-added as a new job: ' + /WO-8/.test(r3.txt) + ')');
    rec('no page errors', !A.dev.errors.length && !B.dev.errors.length, A.dev.errors.concat(B.dev.errors).join(' | '));
    await A.close(); await B.close();
  }
  // ---- 2b. B edits WO-6 (hand-set hours) while A has Keep on WO-2 and Move on WO-6 → re-show; WO-6 restarts at Keep/no Move,
  // A's Keep on WO-2 (not touched by B) survives; the second Apply leaves WO-6's week and due date alone.
  {
    const S = makeServer(row());
    const A = await device(browser, S, { name: 'A' }), B = await device(browser, S, { name: 'B' });
    await preview(A);
    await A.page.evaluate(() => { document.querySelector('[data-dk="WO-2"][value="keep"]').checked = true; const s = document.querySelector('[data-rmv="WO-6"]'); s.value = s.options[1].value; });
    await B.page.evaluate(async () => { Object.assign(DB.orders.find(o => o.wo === 'WO-6'), { hours: 12, hoursSrc: 'hand', hoursEstimated: false }); await saveDB(); });
    const r = await apply(A);
    const ch = await A.page.evaluate(() => ({ dk2: (document.querySelector('[data-dk="WO-2"][value="keep"]') || {}).checked, dk6: (document.querySelector('[data-dk="WO-6"][value="keep"]') || {}).checked, mv6: (document.querySelector('[data-rmv="WO-6"]') || { value: 'none' }).value }));
    rec('2b: B hand-set WO-6 hours → Apply re-shows naming WO-6 only', r.still && /WO-6: changed on another PC/.test(r.banner) && !/WO-2/.test(r.banner), r.banner.replace(/\s+/g, ' ').slice(0, 300));
    rec('2b: WO-6 restarts at Keep with no Move; A\'s Keep on WO-2 survives', ch.dk2 === true && ch.dk6 === true && (ch.mv6 === '' || ch.mv6 === 'none'), JSON.stringify(ch));
    const r2 = await apply(A);
    const g = w => srv(S, w);
    rec('2b: second Apply: WO-6 week/due/hours untouched (B\'s 12h), WO-2 Keep honoured', !r2.still && g('WO-6').plannedWeek === '2026-10-26' && g('WO-6').dueDate === '2026-11-02' && g('WO-6').hours === 12 && g('WO-2').dueDate === '2026-11-02' && g('WO-2').dueKeep === '2026-11-20', JSON.stringify([r2.still, g('WO-6').plannedWeek, g('WO-6').dueDate, g('WO-6').dueKeep, g('WO-6').hours, g('WO-2').dueDate, g('WO-2').dueKeep]));
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

  const REP = +process.env.REPEAT || 1;
  for (let rep = 0; rep < REP; rep++) {
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
