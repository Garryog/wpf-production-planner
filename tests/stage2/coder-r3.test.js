// CODER (Stage 2 round 3 fixes, 22 Oct): delivery fields merge as one unit when one side untagged and the other
// loaded/dispatched/delivered; save reply carrying a LATER version number must not be trusted (lost-notes cause).
// Fake Supabase only (tests/harness.js, tests/stage1/tsrv.js) — nothing real is touched.
// Run: node tests/stage2/coder-r3.test.js
const { H, makeServer, device, sleep } = require('../stage1/tsrv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
(async () => {
  const browser = await H.chromium.launch();
  // ---- 1. mergePlan: delivery unit
  {
    const S = makeServer({ id: 'main', version: 1, nid: 3, settings: {}, orders: [H.order({ wo: 'WO-1' })] });
    const A = await device(browser, S, { name: 'A' });
    const r = await A.page.evaluate(() => {
      const P = x => ({ orders: [Object.assign({ wo: 'W', notes: '' }, x)], settings: {} });
      const b = P({ delv: true, delVeh: 'VOLVO', delDay: 'Thu' });
      const held = P({ delv: false, delVeh: '', delDay: '', holdDel: 'Volvo · Thu', cienHold: true });
      const loaded = P({ delv: true, delVeh: 'VOLVO', delDay: 'Thu', delLoadedAt: '2026-10-22T09:00:00Z', ldBy: 'Dan' });
      const moved = P({ delv: true, delVeh: 'VOLVO', delDay: 'Fri' });
      const o = p => p.plan.orders[0];
      const m1 = mergePlan(b, loaded, held), m2 = mergePlan(b, held, loaded), m3_ = mergePlan(b, held, loaded, { theirsWins: true });
      const m4 = mergePlan(b, moved, loaded), m5 = mergePlan(b, b, held);
      return { m1: o(m1), m1n: m1.notes.map(n => n.path.join('.') + ' kept ' + n.kept), m2: o(m2), m3: o(m3_), m4: o(m4), m5: o(m5) };
    });
    const ok = x => x.delv === true && x.delVeh === 'VOLVO' && x.delDay === 'Thu' && !!x.delLoadedAt && x.ldBy === 'Dan' && !x.holdDel && x.cienHold === true;
    rec('1a: driver loads (mine) vs office hold-untag (theirs) → loaded + tagged, still on hold, logged', ok(r.m1) && r.m1n.some(n => /delivery kept loaded/.test(n)), JSON.stringify(r.m1) + ' ' + r.m1n.join('|'));
    rec('1b: same the other way round (and with theirsWins) → loaded side wins', ok(r.m2) && ok(r.m3), JSON.stringify([r.m2, r.m3]));
    rec('1c: office moves day while driver loads → field by field, both kept (Fri + loaded)', r.m4.delDay === 'Fri' && !!r.m4.delLoadedAt && r.m4.ldBy === 'Dan', JSON.stringify(r.m4));
    rec('1d: untag on one side only → untag applied', r.m5.delv === false && r.m5.delVeh === '' && r.m5.holdDel === 'Volvo · Thu', JSON.stringify(r.m5));
    await A.close();
  }
  // ---- 2. a save reply that carries a later version (another save landed before the reply was built) is not trusted
  {
    const S = makeServer({ id: 'main', version: 1, nid: 5, settings: {}, orders: [H.order({ wo: 'WO-1', notes: '' }), H.order({ wo: 'WO-2', notes: '' })] });
    const O = await device(browser, S, { name: 'office' }), W = await device(browser, S, { name: 'saw' });
    await O.page.evaluate(() => loadDB()); await W.page.evaluate(() => loadDB());
    O.dev.latency = [2000, 2000]; // office PATCH lands after 1 s; its reply (built from the row at reply time) comes 1 s later
    const p1 = O.page.evaluate(async () => { DB.orders[0].notes = 'office-1'; await saveDB(); });
    await sleep(1300);
    await W.page.evaluate(async () => { DB.orders[1].notes = 'saw-1'; await saveDB(); });
    await p1; O.dev.latency = [0, 0];
    await O.page.evaluate(async () => { DB.orders[0].notes = 'office-2'; await saveDB(); });
    rec('2: office\'s next save merges the saw\'s note in instead of overwriting it', S.row.orders[0].notes === 'office-2' && S.row.orders[1].notes === 'saw-1', JSON.stringify(S.row.orders.map(o => o.notes)));
    await O.close(); await W.close();
  }
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
