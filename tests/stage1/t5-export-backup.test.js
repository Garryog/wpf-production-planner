// ATTACK 5: Export Changes baseline across refreshes, imports and two PCs; backups that lie or fail.
// Run: node tests/stage1/t5-export-backup.test.js
const { H, makeServer, device } = require('./tsrv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const base = () => ({ id: 'main', version: 1, orders: [H.order({ wo: 'WO-1', plannedWeek: '2026-10-26' }), H.order({ wo: 'WO-2', plannedWeek: '2026-10-26' }), H.order({ wo: 'WO-3', plannedWeek: '2026-10-26' })], nid: 5, settings: { exportBase: { wk: { 'WO-1': '2026-10-26', 'WO-2': '2026-10-26', 'WO-3': '2026-10-26' }, st: { 'WO-1': '3. In production', 'WO-2': '3. In production', 'WO-3': '3. In production' } } } });
const chg = p => p.evaluate(() => changes().map(o => o.wo + ':' + orig[o.wo] + '>' + o.plannedWeek).sort().join(','));
(async () => {
  const browser = await H.chromium.launch();
  { // B moves a job while A downloads + marks applied with a stale screen
    const S = makeServer(base()); const A = await device(browser, S, { name: 'A' }), B = await device(browser, S, { name: 'B' });
    await A.page.evaluate(async () => { DB.orders[0].plannedWeek = '2026-11-02'; await saveDB(); });
    await B.page.evaluate(async () => { await loadDB(); DB.orders[1].plannedWeek = '2026-11-09'; await saveDB(); }); // A hasn't seen this
    await A.page.evaluate(async () => { DB.orders.forEach(o => { orig[o.wo] = o.plannedWeek || ''; origStep[o.wo] = o.step || ''; }); await saveDB(); }); // Mark as applied
    const a = await chg(A.page); await B.page.evaluate(() => loadDB()); const b = await chg(B.page);
    rec('job moved on another PC after the export is still listed as a change', a === 'WO-2:2026-10-26>2026-11-09' && b === a, 'A=[' + a + '] B=[' + b + ']');
    // both PCs mark as applied at the same time
    await A.page.evaluate(async () => { DB.orders.forEach(o => { orig[o.wo] = o.plannedWeek || ''; }); await saveDB(); });
    await B.page.evaluate(async () => { DB.orders.forEach(o => { orig[o.wo] = o.plannedWeek || ''; }); await saveDB(); });
    await A.page.evaluate(() => loadDB());
    rec('two PCs Mark as applied together: tracker empty on both', (await chg(A.page)) === '' && (await chg(B.page)) === '', (await chg(A.page)) + '|' + (await chg(B.page)));
    // refresh many times: baseline unchanged
    await B.page.evaluate(async () => { DB.orders[2].plannedWeek = '2026-12-07'; await saveDB(); });
    for (let i = 0; i < 3; i++) await A.page.evaluate(() => loadDB());
    rec('baseline survives repeated refreshes', (await chg(A.page)) === 'WO-3:2026-10-26>2026-12-07', await chg(A.page));
    await A.close(); await B.close();
  }
  { // Stage 2 (acceptance check 27): imports never remove a job. A's import marks WO-3 shipped while B has moved it:
    // one copy, shipped (off the board, on the Shipped tab), B's move kept. Replaces the old "removed job comes back" check.
    const S = makeServer(base()); const A = await device(browser, S, { name: 'A' }), B = await device(browser, S, { name: 'B' });
    await B.page.evaluate(async () => { DB.orders[2].plannedWeek = '2026-11-16'; await saveDB(); });
    await A.page.evaluate(async () => { showTab('i'); applyImport(analyzeImport(prepImport([{ wo: 'WO-3', step: '9. JOB SHIPPED', value: 4000, dueDate: '2026-11-02' }]), 'file')); await saveDB(); });
    const o = S.row.orders.filter(x => x.wo === 'WO-3');
    rec('import marking a job shipped vs remote move: one copy, shipped, move kept (never removed)', o.length === 1 && !!o[0].shippedAt && o[0].plannedWeek === '2026-11-16', JSON.stringify(o.map(x => [x.plannedWeek, !!x.shippedAt])));
    await A.close(); await B.close();
  }
  { // backup: database confirms insert but read-back has fewer jobs
    const S = makeServer(base()); S.bakTamper = r => ({ ...r, payload: { ...r.payload, orders: (r.payload && r.payload.orders || []).slice(1) } });
    const A = await device(browser, S, { name: 'A' });
    const out = await A.page.evaluate(async () => { localStorage.removeItem('wpfBakDay'); await tryDailyBackup(); return { err: BAK.err, day: localStorage.getItem('wpfBakDay') }; });
    rec('backup read-back short by one job is reported as FAILED and retried', /read back wrong/.test(out.err) && !out.day, JSON.stringify(out));
    const del = (S.bakDeletes || []).concat(S.mainDeletes ? ['production_planner x' + S.mainDeletes] : []);
    rec('failed backup does not prune old backups', !del.length, del.join(' '));
    await A.close();
  }
  { // backup ok: prune only ever targets planner_backups; Clear all with backup failing + user cancels
    const S = makeServer(base()); S.backups.push({ id: 900, taken_at: '2026-01-01T00:00:00Z', orders_count: 1, payload: { orders: [{}] } }); S.nextId = 901;
    const A = await device(browser, S, { name: 'A' });
    await A.page.evaluate(async () => { localStorage.removeItem('wpfBakDay'); await tryDailyBackup(); });
    rec('prune hits planner_backups only, production_planner never DELETEd', (S.bakDeletes || []).length === 1 && /planner_backups\?taken_at=lt\./.test(S.bakDeletes[0]) && !S.mainDeletes, (S.bakDeletes || []).join() + ' main=' + (S.mainDeletes || 0));
    rec('backup payload carries everything needed to restore (orders + settings + nid)', S.backups.some(b => b.id === 901 && b.payload.orders.length === 3 && b.payload.settings && b.payload.nid), '');
    await A.close();
  }
  { // floor view: no daily backup attempted from phones; office with clock in 2027
    const S = makeServer(base()); const P = await device(browser, S, { name: 'P' }, { role: 'saw' });
    await P.page.evaluate(async () => { localStorage.removeItem('wpfBakDay'); await tryDailyBackup(); });
    rec('phones never take backups', S.backups.length === 0, S.backups.length + '');
    await P.close();
  }
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
