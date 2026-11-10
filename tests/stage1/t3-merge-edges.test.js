// ATTACK 3: merge edge cases — new IDs made on two devices at once (DB.nid++), duplicate WO lines,
// a job without a WO, same job moved on two screens, delete-vs-tick, untick-vs-tick.
// Run: node tests/stage1/t3-merge-edges.test.js
const { H, makeServer, device } = require('./tsrv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const base = (o = []) => ({ id: 'main', version: 1, orders: o.length ? o : [H.order({ wo: 'WO-1' }), H.order({ wo: 'WO-2' }), H.order({ wo: 'WO-3' }), H.order({ wo: 'WO-4' })], nid: 5, settings: {} });
(async () => {
  const browser = await H.chromium.launch();
  const two = async (r, roleB) => { const S = makeServer(r); return [S, await device(browser, S, { name: 'A' }), await device(browser, S, { name: 'B' }, { role: roleB || 'office' })]; };
  { // groups made at the same time on two PCs both get id G5
    const [S, A, B] = await two(base());
    await A.page.evaluate(async () => { grpSel.clear(); grpSel.add('WO-1'); grpSel.add('WO-2'); makeGroup(); DB.grps[Object.keys(DB.grps)[0]].title = 'Kitchen A'; await saveDB(); });
    await B.page.evaluate(async () => { grpSel.clear(); grpSel.add('WO-3'); grpSel.add('WO-4'); makeGroup(); DB.grps[Object.keys(DB.grps)[0]].title = 'Kitchen B'; await saveDB(); });
    const g = S.row.orders.map(o => o.wo + '=' + o.grp).join(' '), ng = Object.keys(S.row.settings.grps).length;
    rec('two groups made at once stay two groups', ng === 2, ng + ' group(s): ' + g + ' titles=' + JSON.stringify(S.row.settings.grps));
    await A.close(); await B.close();
  }
  { // manual delivery jobs added at once both get JOB-5
    const [S, A, B] = await two(base());
    const add = (p, t, c) => p.evaluate(async ({ t, c }) => { showTab('d'); await new Promise(r => setTimeout(r, 100)); document.getElementById('aj-title').value = t; document.getElementById('aj-cust').value = c; document.getElementById('aj-wo').value = ''; document.getElementById('aj-add').click(); await saveDB(); }, { t, c });
    let ok = true; try { await add(A.page, 'Worktop drop Galway', 'Murphy'); await add(B.page, 'Doors to Athenry', "O'Brien"); } catch (e) { ok = false; console.log('  (could not drive Add job form: ' + e.message.split('\n')[0] + ')'); }
    if (ok) { const dx = (S.row.settings.delx || []).map(x => x.wo + ':' + x.title + '/' + x.customer); rec('two manual delivery jobs added at once both kept', dx.length === 2, JSON.stringify(dx)); }
    await A.close(); await B.close();
  }
  { // duplicate WO lines (same WO twice): one PC deletes the first line, the other edits the second
    const r = base([H.order({ wo: 'WO-D', title: 'Line one', hours: 5 }), H.order({ wo: 'WO-D', title: 'Line two', hours: 7 })]);
    const [S, A, B] = await two(r);
    await A.page.evaluate(async () => { DB.orders.splice(0, 1); await saveDB(); });
    await B.page.evaluate(async () => { DB.orders[1].notes = 'edited line two'; await saveDB(); });
    const out = S.row.orders.map(o => o.title + '|' + (o.notes || '')).join(' ; ');
    rec('duplicate-WO: delete line one + edit line two = just edited line two', out === 'Line two|edited line two', out);
    await A.close(); await B.close();
  }
  { // one job without a WO (old data / bad import) turns the whole job merge into a text diff
    const r = base([H.order({ wo: 'WO-1' }), H.order({ wo: 'WO-2' }), H.order({ wo: '' , title: 'No WO yet'})]);
    const [S, A, B] = await two(r);
    await A.page.evaluate(async () => { DB.orders[0].plannedWeek = '2026-11-02'; await saveDB(); });
    await B.page.evaluate(async () => { DB.orders[0].notes = 'B note'; await saveDB(); });
    const w = S.row.orders.filter(o => o.wo === 'WO-1');
    rec('a WO-less job does not make concurrent edits duplicate jobs', w.length === 1 && w[0].plannedWeek === '2026-11-02' && w[0].notes === 'B note', w.length + ' copies of WO-1: ' + JSON.stringify(w.map(o => [o.plannedWeek, o.notes])));
    await A.close(); await B.close();
  }
  { // same job moved by two people: later wins + history note, no duplicate
    const [S, A, B] = await two(base());
    await A.page.evaluate(async () => { DB.orders[0].plannedWeek = '2026-11-02'; await saveDB(); });
    await B.page.evaluate(async () => { DB.orders[0].plannedWeek = '2026-11-16'; await saveDB(); });
    const o = S.row.orders.filter(x => x.wo === 'WO-1');
    rec('same job moved twice: later wins, noted, one copy', o.length === 1 && o[0].plannedWeek === '2026-11-16' && (o[0].log || []).some(l => /two screens/.test(l.what)), JSON.stringify(o.map(x => [x.plannedWeek, (x.log || []).length])));
    await A.close(); await B.close();
  }
  { // job deleted on office while the driver marks it delivered
    const [S, A, B] = await two(base(), 'driver');
    await A.page.evaluate(async () => { DB.orders = DB.orders.filter(o => o.wo !== 'WO-2'); await saveDB(); });
    await B.page.evaluate(async () => { const o = DB.orders.find(x => x.wo === 'WO-2'); o.delDone = true; await saveDB(); });
    const o = S.row.orders.find(x => x.wo === 'WO-2');
    rec('delete vs delivered tick: job kept with the tick (by design)', !!o && o.delDone === true, JSON.stringify(o ? { d: o.delDone } : null));
    await A.close(); await B.close();
  }
  { // untick (legit correction) vs an unrelated edit to the same job
    const r = base([H.order({ wo: 'WO-1', delDone: true }), H.order({ wo: 'WO-2' })]);
    const [S, A, B] = await two(r);
    await A.page.evaluate(async () => { DB.orders[0].delDone = false; await saveDB(); });
    await B.page.evaluate(async () => { DB.orders[0].notes = 'n'; await saveDB(); });
    rec('a deliberate untick survives an unrelated edit on another screen', S.row.orders[0].delDone === false && S.row.orders[0].notes === 'n', JSON.stringify({ d: S.row.orders[0].delDone, n: S.row.orders[0].notes }));
    await A.close(); await B.close();
  }
  { // both PCs add the same WO (manual + import) — one job, not two
    const [S, A, B] = await two(base());
    await A.page.evaluate(async () => { DB.orders.push(Object.assign(JSON.parse(JSON.stringify(DB.orders[0])), { wo: 'WO-9', title: 'From A', hours: 3 })); await saveDB(); });
    await B.page.evaluate(async () => { DB.orders.push(Object.assign(JSON.parse(JSON.stringify(DB.orders[0])), { wo: 'WO-9', title: 'From B', hours: 8 })); await saveDB(); });
    const o = S.row.orders.filter(x => x.wo === 'WO-9');
    rec('same WO added on two PCs: one job', o.length === 1, o.length + ' copies ' + JSON.stringify(o.map(x => [x.title, x.hours])));
    await A.close(); await B.close();
  }
  { // hour scale / capacity edited on two PCs at once
    const [S, A, B] = await two(base());
    await A.page.evaluate(async () => { WCAP = 300; await saveDB(); });
    await B.page.evaluate(async () => { VCAP = 999000; DB.weekCaps['2026-11-02'] = 111; await saveDB(); });
    const s = S.row.settings;
    rec('different settings edited on two PCs both kept', s.wcap === 300 && s.vcap === 999000 && s.weekCaps['2026-11-02'] === 111, JSON.stringify({ w: s.wcap, v: s.vcap, wc: s.weekCaps }));
    await A.close(); await B.close();
  }
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
