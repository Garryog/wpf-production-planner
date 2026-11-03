// Cutting-list flow, step 2: o.procAt (the day the import first sees a WO at 5. WORK ORDER PROCESSED or later) and the
// wider "lists needed" (switch on: every live WO at steps 5-8 with no list, except on hold, shipped and WOs marked
// "No list needed" / "Paper list issued"); due date = N working days after processed (default 2) or the working day
// before the saw cuts it, whichever first. Switch off: exactly as before. Fake Supabase only.
// Run: node tests/stage3/flow2-needed.test.js
const F = require('./fix3.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const far = '2026-12-15';
function orders() {
  const o = (wo, step, x) => H.order(Object.assign({ wo, step, customer: 'Aderrig Homes', dueDate: far, origDueDate: far, plannedWeek: '2026-12-14' }, x || {}));
  return [
    o('WO-26-S5', '5. WORK ORDER PROCESSED'), o('WO-26-S6', '6. JOB CUT COMPLETE'), o('WO-26-S7', '7.ASSEMBLY COMPLETE '), o('WO-26-S8', '8. PALLETED', { procAt: '2026-10-01' }),
    o('WO-26-S4', '4. READY FOR PRODUCTION'), o('WO-26-S9', '9. JOB SHIPPED'), o('WO-26-S10', '10. INSTALLED TO BE INVOICE'),
    o('WO-26-HOLD', '5. WORK ORDER PROCESSED', { cienHold: true }), o('WO-26-NA', '6. JOB CUT COMPLETE', { listNA: { k: 'none', by: 'Ann', at: '2026-10-20T10:00:00Z' } }),
    o('WO-26-PAPER', '6. JOB CUT COMPLETE', { listNA: { k: 'paper', by: 'Ann', at: '2026-10-20T10:00:00Z' } }),
    o('WO-26-LISTED', '5. WORK ORDER PROCESSED'), o('WO-26-SHIPD', '6. JOB CUT COMPLETE', { shippedAt: '2026-10-19T10:00:00Z' }),
    o('WO-26-SOON', '3. READY FOR UPLOAD', { dueDate: '2026-10-23', origDueDate: '2026-10-23' }), // old rule: due inside the lead time
  ];
}
function server(on) {
  const row = F.v2Row(); row.orders = orders();
  if (!on) { delete row.settings.listStore; delete row.settings.listStoreAt; }
  const S = F.makeServer(row);
  F.seedList(S, 'L1', { wos: ['WO-26-LISTED'] });
  if (!on) row.settings.lists.push({ id: 'OLDL', wb: 'W1', sheet: 'Old', name: 'Listed', project: 'Old', saw: 1, fit: 0, wos: ['WO-26-LISTED'], up: F.NOW });
  return S;
}
(async () => {
  const browser = await H.chromium.launch();
  // ---- switch on
  {
    const S = server(true);
    const t = await F.dev(browser, S, 'office');
    const need = await t.page.evaluate(() => listsNeeded().map(o => o.wo.replace('WO-26-', '')).sort().join());
    rec('on: steps 5, 6, 7 ("7.ASSEMBLY COMPLETE " no space / trailing space), 8 with no list are needed, plus the old due-soon rule', need === ['S5', 'S6', 'S7', 'S8', 'SOON'].sort().join(), need);
    rec('on: step 4, shipped 9/10, on hold, "No list needed", "Paper list issued", has a list, on the Shipped tab → not needed', !/S4|S9|S10|HOLD|NA|PAPER|LISTED|SHIPD/.test(need), need);
    // procAt via an import
    const imp = await t.page.evaluate(async () => {
      showTab('i');
      IMPPLAN = analyzeImport(prepImport([{ wo: 'WO-26-S4', step: '5. WORK ORDER PROCESSED', value: 4000, dueDate: '2026-12-15' }, { wo: 'WO-26-NEW6', step: '6. JOB CUT COMPLETE ', value: 4000, dueDate: '2026-12-15', title: 'House 3 Type B kitchen', customer: 'Aderrig Homes' }, { wo: 'WO-26-NEW3', step: '3. READY FOR UPLOAD', value: 4000, dueDate: '2026-12-15' }]), 'file');
      renderImportPreview(IMPPLAN); await document.getElementById('imp-apply').onclick();
      const g = w => (DB.orders.find(o => o.wo === 'WO-26-' + w) || {}).procAt || '';
      return { S4: g('S4'), NEW6: g('NEW6'), NEW3: g('NEW3'), S5: g('S5'), S7: g('S7'), S8: g('S8'), S9: g('S9'), today: todayLocal() };
    });
    rec('procAt: an existing WO moved to step 5 by the import gets today', imp.S4 === imp.today, JSON.stringify(imp));
    rec('procAt: a new WO at step 6 gets today', imp.NEW6 === imp.today, JSON.stringify(imp));
    rec('procAt: WOs already past step 5 (not in the file) get today on the first run', imp.S5 === imp.today && imp.S7 === imp.today && imp.S9 === imp.today, JSON.stringify(imp));
    rec('procAt: a WO that already has one keeps it; step 3 gets none', imp.S8 === '2026-10-01' && imp.NEW3 === '', JSON.stringify(imp));
    await t.page.evaluate(async () => { await saveDB(); });
    rec('procAt is saved with the job', (S.row.orders.find(o => o.wo === 'WO-26-NEW6') || {}).procAt === '2026-10-21');
    // due dates
    const due = await t.page.evaluate(() => {
      let i = 0; const o = x => { const j = Object.assign({ wo: 'WO-X-' + (++i), dueDate: '2026-12-15' }, x); DB.orders.push(j); return j; };
      const a = lsNeedInfo(o({ procAt: '2026-10-21' }));                  // Wed + 2 working days = Fri 23
      const b = lsNeedInfo(o({ procAt: '2026-10-16' }));                  // Fri 16 + 2 = Tue 20 → late on Wed 21
      const c = lsNeedInfo(o({ procAt: '2026-10-21', dueDate: '2026-10-23' })); // saw cuts Thu 22 → list due Wed 21 (earlier)
      const d0 = lsNeedInfo(o({}));                                         // no procAt: old rule only
      const e = lsNeedInfo(o({ procAt: '2026-10-23' }));                  // Fri 23 + 2 = Tue 27 (Mon 26 is a bank holiday) → Wed 28
      DB.listDue = 5; const f = lsNeedInfo(o({ procAt: '2026-10-21' })); delete DB.listDue; DB.orders = DB.orders.filter(x => !/^WO-X-/.test(x.wo));
      return { a: a.due + (a.late ? '!' : ''), b: b.due + (b.late ? '!' : ''), c: c.due + (c.late ? '!' : ''), d: d0.due, e: e.due, f: f.due, def: listDueDays() };
    });
    rec('due: processed Wed 21 → due Fri 23 (2 working days), not late', due.a === '2026-10-23', JSON.stringify(due));
    rec('due: processed Fri 16 → due Tue 20, late on Wed 21', due.b === '2026-10-20!', JSON.stringify(due));
    rec('due: the working day before the saw cuts it, when that is earlier', due.c === '2026-10-21', JSON.stringify(due));
    rec('due: no procAt → the old rule (day before the saw cuts it)', due.d === '2026-12-11', JSON.stringify(due));
    rec('due: working days skip the bank holiday (Fri 23 + 2 → Wed 28)', due.e === '2026-10-28', JSON.stringify(due));
    rec('due: setting "List due N working days" = 5 → Thu 29 (bank holiday skipped); default 2', due.f === '2026-10-29' && due.def === 2, JSON.stringify(due));
    await t.page.evaluate(async () => { DB.listDue = 3; sched(); await saveDB(); });
    rec('setting saved in the planner record (settings.listDue)', S.row.settings.listDue === 3, JSON.stringify(S.row.settings.listDue));
    const t2 = await F.dev(browser, S, 'office');
    rec('setting read back on another screen', (await t2.page.evaluate(() => listDueDays())) === 3);
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    await t.close(); await t2.close();
  }
  // ---- switch off: exactly as before (only the old due-soon / delivery-board rule), no new tables touched
  {
    const S = server(false);
    const t = await F.open(browser, S, { now: F.NOW, role: 'office' });
    const need = await t.page.evaluate(() => listsNeeded().map(o => o.wo.replace('WO-26-', '')).sort().join());
    rec('off: only the old rule (due inside the lead time) — processed jobs are not added', need === 'SOON', need);
    const imp = await t.page.evaluate(async () => {
      showTab('i');
      IMPPLAN = analyzeImport(prepImport([{ wo: 'WO-26-S4', step: '5. WORK ORDER PROCESSED', value: 4000, dueDate: '2026-12-15' }]), 'file');
      renderImportPreview(IMPPLAN); await document.getElementById('imp-apply').onclick(); await saveDB();
      return { s4: DB.orders.find(o => o.wo === 'WO-26-S4').procAt, need: listsNeeded().map(o => o.wo.replace('WO-26-', '')).sort().join() };
    });
    // Garry's decision (round 1 fix 7b51217): with the switch OFF the import must NOT stamp procAt (switching on stamps it later)
    rec('off: the import does NOT record procAt, nothing else changes', !imp.s4 && imp.need === 'SOON', JSON.stringify(imp));
    rec('off: settings saved without listDue (same shape as before)', !('listDue' in (S.row.settings || {})), JSON.stringify(Object.keys(S.row.settings || {})));
    rec('off: no calls to the new tables', F.newTableCalls(S).length === 0, F.newTableCalls(S).join());
    rec('off: no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    await t.close();
  }
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
