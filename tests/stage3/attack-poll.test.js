// ATTACK: polling (30-second overlap, lazy finished lists, no duplicates) and the switch OFF network check.
// Fake Supabase only. Run: node tests/stage3/attack-poll.test.js
const A = require('./atk.js');
const { F, H, D, rec, k } = A;
(async () => {
  const browser = await H.chromium.launch();
  // ---- P1 switch OFF: bench ticks, N/A, release, sign-off, upload, typed list → zero calls to the new tables / RPCs
  {
    const SIDE = { k: 'saw', item: 'Side', qty: 2, L: 720, W: 560, mat: 'MFC White', note: '' }, TOP = { k: 'saw', item: 'Top', qty: 1, L: 1200, W: 560, mat: 'Oak', note: '' };
    const row = { id: 'main', version: 1, nid: 5, orders: [H.order({ wo: 'WO-1', unit: '1', customer: 'Aderrig Homes', dueDate: '2026-10-22', origDueDate: '2026-10-22' })],
      settings: { lists: [{ id: 'L1', wb: 'W1', sheet: 'House 1', name: 'House 1', project: 'Aderrig', saw: 2, fit: 0, wos: ['WO-1'], up: F.NOW }], listWBs: { W1: { project: 'Aderrig', sheets: { 'House 1': [SIDE, TOP] } } } } };
    const S = F.makeServer(row);
    const saw = await F.open(browser, S, { now: F.NOW, role: 'saw' }), off = await F.open(browser, S, { now: F.NOW, role: 'office' });
    await saw.page.evaluate(async ({ a, b }) => { const l = lists()[0]; setRowTick(l, a, 'saw', 'S', true); holdRows(l, [b], 'saw', 'S'); releaseHolds(allHolds(['saw'], 'hold'), 'S'); markListDone([l.id], 'saw', 'S'); await saveDB(); }, { a: k(SIDE), b: k(TOP) });
    await off.page.evaluate(async () => { showTab('l'); await loadDB(); showTab('s'); showTab('b'); await new Promise(r => setTimeout(r, 300)); });
    rec('P1 switch OFF: ticks / N/A / release / sign-off / Lists + Settings tabs make ZERO calls to the new tables', F.newTableCalls(S).length === 0 && S.rpcCalls.length === 0, F.newTableCalls(S).slice(0, 5).join(', '));
    rec('P1 switch OFF: ticks still saved in the planner record the old way', !!(S.row.settings.listRow && S.row.settings.listRow.L1 && S.row.settings.listRow.L1[k(SIDE)]), JSON.stringify(S.row.settings.listRow || {}).slice(0, 120));
    await saw.close(); await off.close();
  }
  // ---- P2-P5 v2 polling
  {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
    F.seedList(S, 'LF', { wos: ['WO-X'] }); // tagged to a job that doesn't exist → finished? (no: unknown WO counts as finished)
    D.update(S.db, 'lists', D.find(S.db, 'lists', 'LF'), { saw_done_at: F.NOW, fit_done_at: F.NOW, wos: [] }); // no WO + both signed off = finished
    const a = await F.dev(browser, S, 'saw'), b = await F.dev(browser, S, 'saw');
    const st = () => a.page.evaluate(() => ({ rows: listRows(lists().find(l => l.id === 'L1')).length, t: Object.keys(rowTicks('L1')).sort().join(), lf: LST.full.has('LF'), n: lists().length }));
    const s0 = await st();
    rec('P4 finished list: its lines are NOT loaded at start-up', !s0.lf, JSON.stringify(s0));
    await F.tapRow(b.page, 'data-rt', 'L1:1'); await F.send(b.page);
    await a.page.evaluate(async () => { await lsPoll(); });
    await F.tapRow(b.page, 'data-rt', 'L1:2'); await F.send(b.page);
    await b.page.evaluate(async () => { await lsPoll(); render(); });
    await F.tapRow(b.page, 'data-rt', 'L1:1'); await F.send(b.page); // untick
    await a.page.evaluate(async () => { await lsPoll(); await lsPoll(); });
    const s1 = await st();
    rec('P2 rapid tick / tick / untick on another screen inside the 30 s overlap: A shows exactly the database, no duplicate rows', s1.t === 'L1:2' && s1.rows === s0.rows && s1.n === s0.n, JSON.stringify([s0, s1]));
    // a brand-new list made on another PC appears with all its lines after one poll
    await b.page.evaluate(async () => { await lsSaveList({ id: 'LN', name: 'New one', project_id: 'P1', wos: ['WO-2'], source: 'manual' }, [{ kind: 'saw', part: 'A', qty: '1', length_mm: 1, width_mm: 1, material: 'MFC White' }, { kind: 'saw', part: 'B', qty: '1', length_mm: 2, width_mm: 2, material: 'MFC White' }], 'Bea', null); });
    await a.page.evaluate(async () => { await lsPoll(); });
    const s2 = await a.page.evaluate(() => { const l = lists().find(x => x.id === 'LN'); return l ? listRows(l).length : -1; });
    rec('P3 a list made on another PC shows on the saw with all its lines after one poll', s2 === 2, s2);
    // opening the finished list loads it once; later polls never double it
    await a.page.evaluate(async () => { listRows({ id: 'LF' }); await new Promise(r => setTimeout(r, 400)); await lsPoll(); await lsPoll(); });
    const s3 = await a.page.evaluate(() => ({ full: LST.full.has('LF'), rows: listRows({ id: 'LF' }).length }));
    rec('P4 opening a finished list loads its lines once; polls never duplicate them', s3.full && s3.rows === 4, JSON.stringify(s3));
    // P5: a row committed late with an updated_at older than "since − 30 s" (Postgres now() = START of the transaction,
    //     e.g. a save_list_revision that waited on a row lock / a slow migration batch)
    const since = await a.page.evaluate(() => LST.since.list_lines);
    const ln = D.find(S.db, 'list_lines', 'L1:3'); D.update(S.db, 'list_lines', ln, { status: 'cut', status_by: 'Late' }); ln.updated_at = new Date(Date.parse(since) - 45000).toISOString();
    await a.page.evaluate(async () => { await lsPoll(); await lsPoll(); });
    const s5 = await a.page.evaluate(() => !!rowTicks('L1')['L1:3']);
    rec('P5 (informational) a change committed > 30 s after its transaction began is never seen by polling until reload', s5, 'shown=' + s5 + ' — only matters if a transaction runs > 30 s');
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    await a.close(); await b.close();
  }
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
