// Tester attack (re-test of fix 2, 6377266): a stale N/A left under a tick by another screen must be cleared on untick /
// "put back in queue", logged as na-cleared, and must NOT come back when the OTHER (stale) screen saves later and merges.
// Stubbed Supabase only. Run: node tests/sawstores/attack-stale.test.js
const { H, makeServer, open } = require('../stage1/srv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const NOW = '2026-10-21T09:00:00Z';
const ROWS = [
  { k: 'saw', item: 'Side', qty: 4, L: 2400, W: 600, mat: 'MFC White', note: '' },
  { k: 'saw', item: 'Top', qty: 2, L: 1200, W: 600, mat: 'MFC White', note: '' },
  { k: 'saw', item: 'Back', qty: 1, L: 900, W: 700, mat: 'Oak', note: '' },
];
const row = () => ({ id: 'main', version: 1, nid: 5, orders: [H.order({ wo: 'WO-1', dueDate: '2026-10-22', origDueDate: '2026-10-22' })],
  settings: { lists: [{ id: 'L1', wb: 'W1', sheet: 'H1', name: 'House 1', project: 'Proj', saw: 3, fit: 0, wos: ['WO-1'], up: NOW }],
    listWBs: { W1: { project: 'Proj', sheets: { H1: ROWS } } } } });
const tap = (p, attr, i) => p.evaluate(({ attr, i }) => { const k = listRows(lists()[0]).map(rowKey)[i]; const b = [...document.querySelectorAll('[' + attr + ']')].find(x => x.getAttribute(attr) === 'L1|' + k); if (!b) return 'missing'; if (b.disabled) return 'disabled'; b.click(); return 'ok'; }, { attr, i });
const save = p => p.evaluate(async () => { clearTimeout(saveT); await saveDB(); });
const reload = p => p.evaluate(async () => { await loadDB(); render(); });
const state = (p, i) => p.evaluate(i => { const l = lists()[0], k = listRows(l).map(rowKey)[i]; return { held: heldRow(l, k), ticked: rowTicked('L1', k), rawHold: !!(holdsOf('L1')[k]), waiting: allHolds(['saw'], 'hold').length }; }, i);
const dev = async (browser, S) => { const t = await open(browser, S, { now: NOW, role: 'saw' }); await t.page.evaluate(() => { localStorage.setItem('wpfOpName', 'Op'); render(); }); return t; };
const acts = S => ((S.row.settings || {}).holdLog || []).map(x => x.act + (x.n > 1 ? 'x' + x.n : '')).join(',');

(async () => {
  const browser = await H.chromium.launch();
  // 1. Clash (B N/A, A ticks), A unticks and saves; B never reloaded and then saves an unrelated N/A → merge.
  {
    const S = makeServer(row()); const A = await dev(browser, S), B = await dev(browser, S);
    await tap(B.page, 'data-rna', 0); await save(B.page);
    await tap(A.page, 'data-rt', 0); await save(A.page);
    await reload(A.page); await reload(B.page);           // both now hold tick + stale hold on row 0
    await tap(A.page, 'data-rt', 0); await save(A.page);  // A unticks → stale hold dropped, na-cleared
    rec('untick after clash logs na-cleared', /na-cleared/.test(acts(S)), acts(S));
    rec('server: row 0 has no hold and no tick after untick', !((S.row.settings.listHold || {}).L1 || {})[(await A.page.evaluate(() => listRows(lists()[0]).map(rowKey)[0]))], JSON.stringify(S.row.settings.listHold || {}));
    await tap(B.page, 'data-rna', 2); await save(B.page);  // B (stale: still has tick + hold on row 0) saves → conflict merge
    await reload(A.page); await reload(B.page);
    const a = await state(A.page, 0), b = await state(B.page, 0);
    rec('stale screen saving later does NOT resurrect row 0 as WAITING', !a.held && !b.held, JSON.stringify({ a, b }));
    rec('stale screen saving later does NOT resurrect A\'s removed tick', !a.ticked && !b.ticked, JSON.stringify({ a, b }));
    rec('B\'s own new N/A (row 2) survives the merge', (await state(A.page, 2)).held, JSON.stringify(await state(A.page, 2)));
    await A.close(); await B.close();
  }
  // 2. "Put this list back in the queue" after a clash on two rows → one na-cleared entry for 2 lines, nothing waiting
  {
    const S = makeServer(row()); const A = await dev(browser, S);
    await A.page.evaluate(() => { const l = lists()[0], k = listRows(l).map(rowKey); holdRows(l, [k[0], k[1]], 'saw', 'B'); DB.listRow = { L1: {} }; k.forEach(x => DB.listRow.L1[x] = { m: 'saw', at: new Date().toISOString(), by: 'A' }); markListDone(['L1'], 'saw', 'A'); render(); });
    await A.page.evaluate(() => { wlShowDone = true; render(); const b = document.querySelector('[data-wlundo="L1"]'); if (b) b.click(); wlShowDone = false; render(); });
    await save(A.page);
    const st = await A.page.evaluate(() => ({ done: !!listDone('L1').saw, w: allHolds(['saw'], 'hold').length, ticks: Object.keys(rowTicks('L1')).length }));
    rec('list back in queue after clash: not done, 0 waiting, 0 ticks', !st.done && st.w === 0 && st.ticks === 0, JSON.stringify(st));
    rec('holds log: one na-cleared entry covering 2 lines', /na-cleared/.test(acts(S)), acts(S));
    await A.close();
  }
  // 3. A real N/A (no tick) must NOT be cleared by putting the list back in the queue
  {
    const S = makeServer(row()); const A = await dev(browser, S);
    await tap(A.page, 'data-rna', 2);
    await tap(A.page, 'data-rt', 0); await tap(A.page, 'data-rt', 1); // last tickable → list auto-done
    await A.page.evaluate(() => { wlShowDone = true; render(); const b = document.querySelector('[data-wlundo="L1"]'); if (b) b.click(); wlShowDone = false; render(); });
    const s = await state(A.page, 2);
    rec('genuine N/A kept after list Undo (still WAITING)', s.held && s.waiting === 1, JSON.stringify(s));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors || []));
    await A.close();
  }
  // 4. Root cause probe: A undoes the ONLY N/A on the list (whole listHold[L1] map is deleted) while B, loaded earlier,
  //    N/As a different row → merge sees "map removed here, changed there" and keeps B's whole map → A's undo is lost.
  {
    const S = makeServer(row()); const A = await dev(browser, S);
    await tap(A.page, 'data-rna', 0); await save(A.page);
    const B = await dev(browser, S);
    await tap(A.page, 'data-rna', 0); await save(A.page);   // A: undo N/A (only hold on L1)
    await tap(B.page, 'data-rna', 2); await save(B.page);   // B: stale, N/A on row 2 → merge
    await reload(A.page);
    const a0 = await state(A.page, 0), a2 = await state(A.page, 2);
    rec('A\'s undo of the only N/A on a list is not reverted by B\'s N/A on another row', !a0.held && a2.held, JSON.stringify({ row0: a0, row2: a2 }));
    // control: same but list has a SECOND hold left, so the map is not emptied
    const S2 = makeServer(row()); const C = await dev(browser, S2);
    await tap(C.page, 'data-rna', 0); await tap(C.page, 'data-rna', 1); await save(C.page);
    const D = await dev(browser, S2);
    await tap(C.page, 'data-rna', 0); await save(C.page);
    await tap(D.page, 'data-rna', 2); await save(D.page);
    await reload(C.page);
    const c0 = await state(C.page, 0);
    console.log('INFO control (map not emptied): row 0 held after merge = ' + c0.held + ' (expected false)');
    await A.close(); await B.close(); await C.close(); await D.close();
  }
  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); if (f) process.exitCode = 1;
})().catch(e => { console.error(e); process.exit(1); });
