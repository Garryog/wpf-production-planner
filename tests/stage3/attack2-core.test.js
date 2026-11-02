// ATTACK 2 — re-check the core fixes with variations: old tabs saving settings in other ways, a new-code tab stuck on
// 'v1' across a re-migration, 3,700+ lines across 1,250 lists, polling past 1,000 rows that share one timestamp, switch
// back with queues on 3 devices (reconnecting in a different order), and a refused batch with a mix of reasons.
// Fake Supabase only. Run: node tests/stage3/attack2-core.test.js
const A = require('./atk.js');
const { F, S3, H, D, rec } = A;
const L = F.line;
const SIDE = { k: 'saw', item: 'Side', qty: 2, L: 720, W: 560, mat: 'MFC White', note: '' };
const BACK = { k: 'saw', item: 'Back', qty: 1, L: 700, W: 600, mat: 'MFC White', note: '' };
const TOP = { k: 'saw', item: 'Top', qty: 1, L: 1200, W: 560, mat: 'MFC White', note: '' };
function v1Row() {
  return { id: 'main', version: 1, nid: 5, orders: [H.order({ wo: 'WO-1', customer: 'Aderrig Homes', dueDate: '2026-10-22', origDueDate: '2026-10-22' })],
    settings: { lists: [{ id: 'L1', wb: 'W1', sheet: 'House 1', name: 'House 1', project: 'Aderrig', saw: 3, fit: 0, wos: ['WO-1'], up: '2026-10-01T08:00:00Z' }],
      listWBs: { W1: { project: 'Aderrig', sheets: { 'House 1': [SIDE, BACK, TOP] } } }, listRow: {}, listHold: {}, listDone: {}, holdLog: [] } };
}
const idle = p => p.evaluate(async () => { for (let i = 0; i < 60 && (SAVING || saveT); i++) { if (saveT) { clearTimeout(saveT); saveT = null; await saveDB(); } await new Promise(r => setTimeout(r, 100)); } });
(async () => {
  const browser = await H.chromium.launch();
  // ---------- V1a: an old (live main) tab changes PINs / capacities in Settings after the migration
  {
    const html = A.gitShow('origin/main');
    const S = F.makeServer(v1Row());
    const old = await A.openOld(browser, S, html);
    const nw = await F.open(browser, S, { now: F.NOW, role: 'office' });
    await nw.page.evaluate(async () => { await lsMigrate('Garry'); });
    await old.page.evaluate(async () => { DB.pins = Object.assign({}, DB.pins, { floor: '2299' }); WCAP = 123; if (typeof markDirty === 'function') try { markDirty(); } catch (e) {} await saveDB(); });
    await F.sleep(300);
    rec('V1a old tab saves a PIN + capacity change: switch stays v2, and the PIN change is kept', S.row.settings.listStore === 'v2' && (S.row.settings.pins || {}).floor === '2299', 'listStore=' + S.row.settings.listStore + ' pin=' + (S.row.settings.pins || {}).floor);
    await old.close(); await nw.close();
  }
  // ---------- V1b: a NEW-code tab loaded while switched back ('v1'), lists re-migrated elsewhere, the tab then saves
  {
    const S = F.makeServer(v1Row());
    const m = await F.open(browser, S, { now: F.NOW, role: 'office' });
    await m.page.evaluate(async () => { await lsMigrate('Garry'); });
    const back = await m.page.evaluate(async () => { try { return await lsSwitchBack('Garry'); } catch (e) { return { err: e.message }; } });
    await idle(m.page);
    const x = await F.open(browser, S, { now: F.NOW, role: 'saw' });
    const xv = await x.page.evaluate(() => DB.listStore);
    const re = await m.page.evaluate(async () => { await loadDB(); try { const r = await lsMigrate('Garry'); return { ok: r.ok }; } catch (e) { return { err: e.message }; } });
    // tab X (still 'v1' in memory) ticks Back the old way and saves before its next refresh
    await x.page.evaluate(async () => { const l = DB.lists.find(z => z.id === 'L1'); const r = lsOldRows(l).find(z => z.item === 'Back'); setRowTick(l, v1Key(r), 'saw', 'Xtab', true); await saveDB(); });
    await idle(x.page);
    rec('V1b switch back → re-migrate: a tab still on v1 saving afterwards does not switch the floor back', back.lists >= 1 && xv === 'v1' && !!re.ok && S.row.settings.listStore === 'v2', 'back=' + JSON.stringify(back) + ' X had=' + xv + ' re-migrate=' + JSON.stringify(re) + ' now=' + S.row.settings.listStore);
    const y = await F.open(browser, S, { now: F.NOW, role: 'saw' });
    await y.page.evaluate(async () => { await new Promise(r => setTimeout(r, 300)); if (V2()) { lsRescue(); await lqSend(); } });
    const bk = S.db.t.list_lines.find(z => z.list_id === 'L1' && z.part === 'Back');
    rec('V1b the v1 tab\'s tick after the re-migration is rescued into the tables', bk && bk.status === 'cut', (bk && bk.status) + ' record listRow=' + JSON.stringify(S.row.settings.listRow) + ' listStoreAt=' + S.row.settings.listStoreAt + ' X saveFailed=' + await x.page.evaluate(() => !!DB.saveFailed));
    await m.close(); await x.close(); await y.close();
  }
  // ---------- V2: 1,250 lists, 3,725 lines (25 lists × 100 + 1,225 × 1)
  {
    const S = F.makeServer(F.v2Row());
    F.seedList(S, 'L0', { wos: ['WO-1'] });
    const ids = [];
    for (let i = 1; i <= 1250; i++) {
      const big = i <= 25, n = big ? 100 : 1, id = 'B' + String(i).padStart(4, '0'); ids.push(id);
      D.insert(S.db, 'lists', { id, project_id: 'P1', name: 'H' + i, wos: big ? ['WO-1'] : ['WO-2'], n_saw: n, created_at: '2026-10-20T08:00:00.000Z' });
      for (let j = 1; j <= n; j++) D.insert(S.db, 'list_lines', { id: id + ':' + j, list_id: id, seq: j, kind: 'saw', part: 'P' + j, qty: '1', length_mm: 100 + j, width_mm: 100, material: 'MFC White' });
    }
    const t0 = Date.now();
    const saw = await F.dev(browser, S, 'saw');
    const got = await saw.page.evaluate(() => ({ l: LST.l.size, ln: LST.ln.size, full: LST.full.size }));
    rec('V2 1,251 lists / 3,729 lines: every list and line loaded past the 1,000-row cap', got.l === 1251 && got.ln === 3729, JSON.stringify(got) + ' in ' + (Date.now() - t0) + ' ms');
    // another device releases / ticks 1,500 lines in ONE transaction → identical updated_at on all of them
    const ts = new Date(Date.now() + 1000).toISOString();
    const big = S.db.t.list_lines.filter(z => z.list_id.startsWith('B') && z.list_id <= 'B0015');
    big.forEach(z => { z.status = 'cut'; z.status_by = 'Other'; z.version++; z.updated_at = ts; });
    // Postgres gives NO stable order between rows with equal updated_at; page 2 can repeat / skip page-1 rows.
    // Emulate that: answer each page from a freshly shuffled tie order (same rows, same filter).
    // (attack3: also intercepts the new 'order=updated_at,id' — ties are then broken by id, as Postgres does; with the old
    // one-column order they are shuffled per page)
    let pages = 0;
    await saw.page.route(u => /\/list_lines\?.*order=updated_at/.test(String(u)), route => {
      const u = new URL(route.request().url()), gt = u.searchParams.get('updated_at'), off = +(u.searchParams.get('offset') || 0), lim = +(u.searchParams.get('limit') || 1000);
      const since = gt ? gt.replace(/^gt\./, '') : '', byId = /updated_at(\.asc)?,id/.test(u.searchParams.get('order') || ''); pages++;
      const rows = S.db.t.list_lines.filter(r => !since || r.updated_at > since).map(r => [r, byId ? 0 : Math.random()]).sort((a, b) => a[0].updated_at < b[0].updated_at ? -1 : a[0].updated_at > b[0].updated_at ? 1 : byId ? (a[0].id < b[0].id ? -1 : a[0].id > b[0].id ? 1 : 0) : a[1] - b[1]).map(a => a[0]);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows.slice(off, off + lim).slice(0, 1000)) });
    });
    await saw.page.evaluate(async () => { await lsPoll(); });
    const seen1 = await saw.page.evaluate(n => [...LST.ln.values()].filter(z => z.list_id <= 'B0015' && z.list_id.startsWith('B') && z.status === 'cut').length, 0);
    rec('V2b 1,500 lines changed in one transaction (same timestamp): one poll picks up all 1,500 (paging on updated_at alone is unstable on ties)', seen1 === 1500 && pages >= 2, 'pages intercepted=' + pages + ' seen after 1 poll=' + seen1 + ' of 1500 — orders by updated_at only, no id tie-breaker (lsPoll)');
    await saw.close();
  }
  // ---------- V3: switch back while 3 devices hold unsent changes; they reconnect in different ways
  {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
    const off = await F.dev(browser, S, 'office');
    const d = [await F.dev(browser, S, 'saw'), await F.dev(browser, S, 'saw'), await F.dev(browser, S, 'stores')];
    for (const [i, t] of d.entries()) await t.page.evaluate(n => localStorage.setItem('wpfOpName', n), ['Aine', 'Brian', 'Cara'][i]);
    S.offline = true;
    await F.tapRow(d[0].page, 'data-rt', 'L1:1');
    await F.tapRow(d[1].page, 'data-rt', 'L1:3'); // Top: only Brian ticks it
    await F.tapRow(d[2].page, 'data-rt', 'L1:4');
    for (const t of d) await t.page.evaluate(async () => { await lqSend(); });
    S.offline = false;
    const back = await off.page.evaluate(async () => { try { return await lsSwitchBack('Garry'); } catch (e) { return { err: e.message }; } });
    await idle(off.page);
    // device 0: refresh first, then online (the order tested before). device 1: ONLINE FIRST (the 'online' event fires
    // the moment the signal is back; the planner refresh is on a 30 s timer). device 2: reload of the page.
    await d[0].page.evaluate(async () => { await loadDB(); window.dispatchEvent(new Event('online')); await new Promise(r => setTimeout(r, 300)); await lqSend(); });
    await d[1].page.evaluate(async () => { window.dispatchEvent(new Event('online')); await new Promise(r => setTimeout(r, 500)); await loadDB(); await lqSend(); });
    const d2 = await S3.attach(d[2], S).then(async () => { await d[2].page.reload(); await d[2].page.waitForFunction(() => typeof lqSend === 'function'); await F.sleep(800); return d[2].page.evaluate(async () => { await lqSend(); return { v2: V2(), q: LQ.q.length }; }); });
    for (const t of d) await idle(t.page);
    const old = S.row.settings.listRow && S.row.settings.listRow.L1 || {};
    const names = Object.keys(old).map(k => k.split('|')[1]);
    const qs = await Promise.all(d.map(t => t.page.evaluate(() => LQ.q.length)));
    rec('V3 switch back with unsent changes on 3 devices: Side (Aine), Top (Brian) and the Hinge (Cara) all reach the OLD lists',
      !back.err && names.includes('side') && names.includes('top') && names.includes('hinge'),
      'switchback=' + JSON.stringify(back) + ' old ticks=' + JSON.stringify(names) + ' queues=' + qs.join() + ' tables: ' + ['L1:1', 'L1:2', 'L1:3', 'L1:4'].map(id => L(S, id).status).join() + ' dev2=' + JSON.stringify(d2));
    rec('V3b the device that got its signal back BEFORE its planner refresh did not send its ticks into the switched-off tables only',
      !(L(S, 'L1:3').status === 'cut' && !names.includes('top')), 'Top in table=' + L(S, 'L1:3').status + ' Top in old lists=' + names.includes('top'));
    await off.close(); for (const t of d) await t.close();
  }
  // ---------- V4: one offline batch, a mix of refusals + good changes
  {
    const S = F.makeServer(F.v2Row());
    F.seedList(S, 'L1', { lines: [['saw', 'A', '1', 100, 100, 'MFC White'], ['saw', 'B', '1', 200, 100, 'MFC White'], ['saw', 'C', '1', 300, 100, 'MFC White'], ['saw', 'D', '1', 400, 100, 'MFC White'], ['saw', 'E', '1', 500, 100, 'MFC White'], ['fit', 'F', '2', null, null, 'Blum hinge'], ['saw', 'G', '1', 700, 100, 'MFC White']] });
    D.update(S.db, 'list_lines', L(S, 'L1:4'), { status: 'cut', status_by: 'Other' });
    const saw = await F.dev(browser, S, 'saw');
    S.offline3 = true;
    await saw.page.evaluate(() => { lqLine('L1:1', 'cut'); lqLine('L1:2', 'cut'); lqLine('L1:3', 'cut'); lqLine('L1:4', 'todo'); lqLine('L1:5', 'waiting'); lqLine('L1:6', 'cut'); lqLine('L1:7', 'cut'); });
    await saw.page.evaluate(async () => { await lqSend(); });
    // meanwhile: A removed and B changed in rev 2; D unticked + re-ticked by someone else; E got cut; G set not-needed
    D.update(S.db, 'lists', D.find(S.db, 'lists', 'L1'), { rev: 2 });
    D.update(S.db, 'list_lines', L(S, 'L1:1'), { removed_rev: 2 });
    D.update(S.db, 'list_lines', L(S, 'L1:2'), { changed_rev: 2, length_mm: 250 });
    D.update(S.db, 'list_lines', L(S, 'L1:4'), { status: 'todo' }); D.update(S.db, 'list_lines', L(S, 'L1:4'), { status: 'cut', status_by: 'Other2' });
    D.update(S.db, 'list_lines', L(S, 'L1:5'), { status: 'cut', status_by: 'Other' });
    D.update(S.db, 'list_lines', L(S, 'L1:7'), { status: 'na' });
    S.offline3 = false;
    await saw.page.evaluate(async () => { LQ.msgs = []; await lqSend(); });
    const st = ['L1:1', 'L1:2', 'L1:3', 'L1:4', 'L1:5', 'L1:6', 'L1:7'].map(id => L(S, id).status).join();
    const q = await saw.page.evaluate(() => ({ q: LQ.q.length, msgs: LQ.msgs }));
    rec('V4 mixed batch: C cut; F (wrong kind: a fitting "cut") refused; A removed, B changed, D stale untick, E done, G not needed — all refused, none applied',
      st === 'todo,todo,cut,cut,cut,todo,na' && q.q === 0, 'db=' + st + ' queue=' + q.q);
    rec('V4b the operator is told (a message naming the first refusal and how many more)', q.msgs.length >= 1 && /\+\d+ more/.test(q.msgs.join(' ')), JSON.stringify(q.msgs));
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
    await saw.close();
  }
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
