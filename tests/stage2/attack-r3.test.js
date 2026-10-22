// TESTER ATTACK round 3 (Stage 2): on hold out of sight in EVERY view (incl. a loaded job staying on Deliveries),
// the hold-untag racing a driver/office loading the van, woFinished with brought-back jobs, and the planner overrides
// (untag at 7/8, Undo complete) pressed through the real buttons and across two PCs.
// Fake versioned Supabase (tests/stage1/tsrv.js) — nothing real is touched. Run: node tests/stage2/attack-r3.test.js
const { H, makeServer, device, sleep } = require('../stage1/tsrv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const L = { 5: '5. WORK ORDER PROCESSED', 6: '6. JOB CUT COMPLETE', 7: '7. ASSEMBLY COMPLETE', 8: '8. PALLETED', 9: '9. JOB SHIPPED', 11: '11. COMPLETED AND INVOICED', 12: '12. ON HOLD / DELETE' };
(async () => {
  const browser = await H.chromium.launch();
  // today's delivery day as the app sees it (floor screen / driver default)
  const probe = await device(browser, makeServer({ id: 'main', version: 1, nid: 1, settings: {}, orders: [] }), { name: 'probe' });
  const { DAY, WK } = await probe.page.evaluate(() => ({ DAY: floorDays()[0], WK: get8Wks()[0] }));
  await probe.close();
  const J = (wo, x) => H.order(Object.assign({ wo, value: 4000, hours: 7, hoursEstimated: true, hoursSrc: 'est', plannedWeek: WK, dueDate: '2026-11-02', step: L[5], customer: 'Cust-' + wo.replace(/\W/g, ''), title: 'Title-' + wo.replace(/\W/g, '') }, x || {}));
  const viewText = (P, role, tab) => P.page.evaluate(([role, tab]) => { ROLE = role; ls.set('wpfPin_' + role, '9000'); if (role === 'driver') { ls.set('wpfDrvName', 'Dan'); ls.set('wpfDrvVeh', 'VOLVO'); ls.set('wpfDrvDay', floorDays()[0]); } if (tab) showTab(tab); else render(); return document.getElementById('app').textContent; }, [role, tab]);

  // ---- A. on hold out of sight everywhere; a LOADED held job stays on Deliveries / floor / driver run
  {
    const orders = [
      J('WO-H1', { delv: true, delVeh: 'VOLVO', delDay: DAY, dueDate: '2026-10-23' }),                         // tagged, not loaded
      J('WO-H2', { delv: true, delVeh: 'VOLVO', delDay: DAY, delLoadedAt: new Date().toISOString(), ldBy: 'Dan' }), // loaded
      J('WO-60', { delv: true, delVeh: 'VOLVO', delDay: DAY }),                                                  // control
    ];
    const lists = [{ id: 'LH', sheet: 'Unit H1', project: 'Proj', name: 'LH-list', wos: ['WO-H1'], saw: 2, fit: 2, up: new Date().toISOString() },
                   { id: 'LK', sheet: 'Unit OK', project: 'Proj', name: 'LK-list', wos: ['WO-60'], saw: 2, fit: 2, up: new Date().toISOString() }];
    const S = makeServer({ id: 'main', version: 1, nid: 5, settings: { lists }, orders });
    const A = await device(browser, S, { name: 'A' });
    await A.page.evaluate(L12 => { const p = analyzeImport(prepImport([{ wo: 'WO-H1', step: L12, value: 4000, dueDate: '2026-10-23' }, { wo: 'WO-H2', step: L12, value: 4000, dueDate: '2026-11-02' }]), 'file'); applyImport(p); return saveDB(); }, L[12]);
    const V = {};
    for (const [role, tab] of [['office', 'b'], ['office', 'l'], ['office', 'd'], ['office', 'h'], ['floor'], ['dash'], ['prod'], ['pm'], ['saw'], ['stores'], ['driver']]) V[role + (tab ? ':' + tab : '')] = await viewText(A, role, tab);
    const where = re => Object.keys(V).filter(k => re.test(V[k]));
    // the office Cutting Lists tab is where lists are managed — it may list LH, but must say it's on hold
    const h1 = where(/WO-H1|LH-list|Unit H1/).filter(k => k !== 'office:h' && k !== 'office:l');
    rec('A: held job (tagged, not loaded, with a cutting list) is in NO view except the On hold card (and the office list manager)', h1.length === 0 && /WO-H1/.test(V['office:h']), 'seen in: ' + h1.join(', '));
    const lt = V['office:l'], li = lt.indexOf('LH-list');
    console.log('INFO  office Cutting Lists tab shows LH-list: ' + (li >= 0) + (li >= 0 ? ' · on-hold marker near it: ' + /on hold/i.test(lt.slice(Math.max(0, li - 300), li + 300)) : ''));
    rec('A: control job WO-60 still visible on Deliveries, floor and driver run', ['office:d', 'floor', 'driver'].every(k => /WO-60/.test(V[k])), where(/WO-60/).join(', '));
    rec('A: held job already LOADED stays on Deliveries, floor screen and the driver\'s run', ['office:d', 'floor', 'driver'].every(k => /WO-H2/.test(V[k])), 'WO-H2 seen in: ' + where(/WO-H2/).join(', '));
    const badge = await A.page.evaluate(() => { ROLE = 'office'; render(); updDelBadge && updDelBadge(); return +(document.getElementById('delcnt') || {}).textContent || 0; });
    rec('A: Deliveries badge counts the loaded held job and the control, not the unloaded held one (2)', badge === 2, 'badge=' + badge);
    const tot = await A.page.evaluate(wk => ({ hrs: wkHrs(wk) }), WK);
    rec('A: week totals leave both held jobs out (7h = WO-60 only)', tot.hrs === 7, JSON.stringify(tot));
    rec('no page errors (A)', !A.dev.errors.length, A.dev.errors.join(' | '));
    await A.close();
  }

  // ---- B. hold-untag races a van load: office PC imports 12 (untags) while the driver's phone (stale, refreshes every 2 min) loads it
  for (const order of ['import-saves-first', 'load-saves-first']) {
    const S = makeServer({ id: 'main', version: 1, nid: 5, settings: {}, orders: [J('WO-71', { delv: true, delVeh: 'VOLVO', delDay: DAY })] });
    const A = await device(browser, S, { name: 'A' }), D = await device(browser, S, { name: 'D' });
    const imp = () => A.page.evaluate(async L12 => {
      showTab('i'); IMPPLAN = analyzeImport(prepImport([{ wo: 'WO-71', step: L12, value: 4000, dueDate: '2026-11-02' }]), 'file'); renderImportPreview(IMPPLAN);
      for (let i = 0; i < 3 && IMPPLAN; i++) { const b = document.getElementById('imp-apply'); if (!b) break; await b.onclick(); }
      await saveDB();
    }, L[12]);
    const load = () => D.page.evaluate(async () => { const o = DB.orders.find(o => o.wo === 'WO-71'); o.delLoadedAt = new Date().toISOString(); o.ldBy = 'Dan'; await saveDB(); }); // = driver's "on the van" tap
    if (order === 'import-saves-first') { await imp(); await load(); } else { await load(); await imp(); }
    await sleep(300);
    const C = await device(browser, S, { name: 'C' });
    const o = S.row.orders.find(o => o.wo === 'WO-71');
    const vis = await C.page.evaluate(() => ({ del: delAll().some(o => o.wo === 'WO-71'), onHold: isOnHold(DB.orders.find(o => o.wo === 'WO-71')) }));
    const drv = await viewText(C, 'driver');
    rec('B(' + order + '): job physically LOADED on the van while Cienapps put it on hold — still on Deliveries and the driver\'s run', vis.del && /WO-71/.test(drv), JSON.stringify({ delv: o.delv, veh: o.delVeh, day: o.delDay, loaded: !!o.delLoadedAt, hold: o.cienHold, onDeliveries: vis.del, onDriverRun: /WO-71/.test(drv) }));
    await A.close(); await D.close(); await C.close();
  }

  // ---- C. woFinished with brought-back jobs
  {
    const S = makeServer({ id: 'main', version: 1, nid: 5, settings: { lists: [{ id: 'LB', sheet: 'U', project: 'P', name: 'LB', wos: ['WO-81'], saw: 1, fit: 1 }] }, orders: [
      J('WO-81', { step: L[9], cienStep: L[9], shippedAt: '2026-10-10T10:00:00Z', delv: true, delDone: true, delDelivAt: '2026-10-10T15:00:00Z', dueDate: '2026-10-24' })] });
    const A = await device(browser, S, { name: 'A' });
    const r = await A.page.evaluate(() => {
      const o = DB.orders.find(o => o.wo === 'WO-81'), l = lists().find(l => l.id === 'LB'), out = {};
      out.before = { fin: woFinished(o), listFin: listFinished(l) };
      showTab('h'); const b = document.querySelector('[data-shb="WO-81"]'); out.btn = !!b; if (b) b.click();
      out.back = { shipped: isShipped(o), fin: woFinished(o), listFin: listFinished(l), onBoard: boardOrders().includes(o), inSaw: workLists().some(x => x.id === 'LB') };
      o.delDelivAt = new Date(Date.now() + 1000).toISOString(); // delivered again (the remake)
      out.redelivered = { fin: woFinished(o), listFin: listFinished(l) };
      return out;
    });
    rec('C: shipped + delivered job → finished; after "Bring back" its old delivery doesn\'t count — live, list not finished', r.before.fin && r.btn && !r.back.shipped && !r.back.fin && !r.back.listFin && r.back.onBoard, JSON.stringify(r));
    rec('C: brought-back job delivered again → finished again', r.redelivered.fin && r.redelivered.listFin, JSON.stringify(r.redelivered));
    // next import still says 9 — does the brought-back job get shipped again straight away (undoing the bring-back)?
    const r2 = await A.page.evaluate(L9 => { const p = analyzeImport(prepImport([{ wo: 'WO-81', step: L9, value: 4000, dueDate: '2026-10-24' }]), 'file'); applyImport(p); const o = DB.orders.find(o => o.wo === 'WO-81'); return { shipped: isShipped(o), shipBack: !!o.shipBack }; }, L[9]);
    rec('C: re-import of the same 9 does not re-ship a brought-back job', !r2.shipped && r2.shipBack, JSON.stringify(r2));
    rec('no page errors (C)', !A.dev.errors.length, A.dev.errors.join(' | '));
    await A.close();
  }

  // ---- D. overrides through the real buttons
  {
    const S = makeServer({ id: 'main', version: 1, nid: 5, settings: {}, orders: [J('WO-91', { step: L[7], cienStep: L[7], delv: true }), J('WO-92', {})] });
    const A = await device(browser, S, { name: 'A' }), B = await device(browser, S, { name: 'B' });
    const imp = (P, rows) => P.page.evaluate(rows => { const p = analyzeImport(prepImport(rows), 'file'); applyImport(p); const o = DB.orders.find(o => o.wo === rows[0].wo); return JSON.parse(JSON.stringify({ delv: o.delv, ov: o.delvOverride, completeAt: o.completeAt, cov: o.completeOverride, shipped: !!o.shippedAt, autoTag: p.autoTag })); }, rows);
    // untag WO-91 with the board's delivery toggle
    const un = await A.page.evaluate(() => { showTab('b'); const b = document.querySelector('[data-dv="WO-91"]'); if (b) b.click(); const o = DB.orders.find(o => o.wo === 'WO-91'); return { btn: !!b, delv: o.delv, ov: o.delvOverride }; });
    rec('D: board toggle untags WO-91 at step 7 and records the override', un.btn && !un.delv && un.ov === L[7], JSON.stringify(un));
    let r = await imp(A, [{ wo: 'WO-91', step: L[7], value: 4000, dueDate: '2026-11-02' }]);
    rec('D: import of the same 7 → stays untagged', !r.delv && r.ov === L[7], JSON.stringify(r));
    await A.page.evaluate(() => saveDB());
    // override travels to PC B and is respected there too
    await B.page.evaluate(() => loadDB());
    r = await imp(B, [{ wo: 'WO-91', step: L[7], value: 4000, dueDate: '2026-11-02' }]);
    rec('D: PC B (after loading) also respects the untag', !r.delv, JSON.stringify(r));
    r = await imp(B, [{ wo: 'WO-91', step: L[8], value: 4000, dueDate: '2026-11-02' }]);
    rec('D: Cienapps moves on to 8 → re-tagged and override cleared', r.delv === true && !r.ov, JSON.stringify(r));
    // planner step ahead of Cienapps: planner sets 8 by hand, untags; Cienapps still says 7 then 8
    await B.page.evaluate(L8 => { const o = DB.orders.find(o => o.wo === 'WO-91'); o.step = L8; showTab('b'); document.querySelector('[data-dv="WO-91"]').click(); }, L[8]);
    r = await imp(B, [{ wo: 'WO-91', step: L[8], value: 4000, dueDate: '2026-11-02' }]);
    rec('D: untagged at planner step 8, Cienapps 8 → stays untagged', !r.delv, JSON.stringify(r));
    // Undo complete on PC B while PC A has an 11 import preview open
    await B.page.evaluate(() => saveDB()); await A.page.evaluate(() => loadDB());
    await A.page.evaluate(async L11 => { const p = analyzeImport(prepImport([{ wo: 'WO-92', step: L11, value: 4000, dueDate: '2026-11-02' }]), 'file'); applyImport(p); await saveDB(); }, L[11]);
    await B.page.evaluate(() => loadDB());
    await A.page.evaluate(L11 => { showTab('i'); IMPPLAN = analyzeImport(prepImport([{ wo: 'WO-92', step: L11, value: 4100, dueDate: '2026-11-02' }]), 'file'); renderImportPreview(IMPPLAN); }, L[11]);
    const ub = await B.page.evaluate(async () => { shDone = true; showTab('h'); const b = document.querySelector('[data-shu="WO-92"]'); if (b) b.click(); shDone = false; await saveDB(); const o = DB.orders.find(o => o.wo === 'WO-92'); return { btn: !!b, completeAt: o.completeAt || null, cov: o.completeOverride }; });
    const ap = await A.page.evaluate(async () => { const out = []; for (let i = 0; i < 3 && IMPPLAN; i++) { const b = document.getElementById('imp-apply'); if (!b) break; await b.onclick(); out.push(((document.getElementById('imp-changed') || {}).textContent || '').replace(/\s+/g, ' ').slice(0, 160)); } await saveDB(); return out; });
    await sleep(300);
    const u = S.row.orders.find(o => o.wo === 'WO-92');
    rec('D: "Undo complete" pressed on PC B while PC A\'s 11-import preview was open → A\'s Apply does not re-complete it', ub.btn && !u.completeAt && !!u.completeOverride && u.value === 4100, JSON.stringify({ ub, server: { completeAt: u.completeAt, cov: u.completeOverride, value: u.value }, applySteps: ap }));
    rec('no page errors (D)', !A.dev.errors.length && !B.dev.errors.length, A.dev.errors.concat(B.dev.errors).join(' | '));
    await A.close(); await B.close();
  }
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
