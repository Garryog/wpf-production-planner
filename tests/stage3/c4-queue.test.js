// Stage 3 C4: the line queue (wpfLineQ → apply_line_changes), list_attach and list_set_done, with Plan B acceptance
// checks 2, 3, 4 and 5. Fake Supabase only (srv3.js). Run: node tests/stage3/c4-queue.test.js
const F = require('./fix3.js');
const { H, D } = F;
const S3 = require('./srv3.js');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const L = F.line;
const name = (p, n) => p.evaluate(n => localStorage.setItem('wpfOpName', n), n);
const reload = p => p.evaluate(async () => { await lsPoll(); render(); });
(async () => {
  const browser = await H.chromium.launch();
  // ---- Acceptance 2: two identical lines — ticking one leaves the other unticked
  {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
    const saw = await F.dev(browser, S, 'saw');
    await saw.page.evaluate(async () => { if (saveT) { clearTimeout(saveT); await saveDB(); } }); // a save left from set-up
    const p0 = S.patches.length, v0 = S.row.version;
    rec('A2: tap tick on line 1 of two identical lines', (await F.tapRow(saw.page, 'data-rt', 'L1:1')) === 'ok');
    const a = await saw.page.evaluate(() => ({ t1: rowTicked('L1', 'L1:1'), t2: rowTicked('L1', 'L1:2'), on1: !!document.querySelector('[data-rt="L1|L1:1"].on'), on2: !!document.querySelector('[data-rt="L1|L1:2"].on'), dots: document.querySelectorAll('.lq-dot').length, q: JSON.parse(localStorage.getItem('wpfLineQ')).length }));
    rec('A2: shows ticked straight away, the identical line stays unticked, one "not sent" dot, queued on the device', a.t1 && !a.t2 && a.on1 && !a.on2 && a.dots === 1 && a.q === 1, JSON.stringify(a));
    await F.sleep(2600); // sent within 2 s without anyone asking
    rec('A2: sent by itself within 2 s; database has line 1 cut, line 2 todo', L(S, 'L1:1').status === 'cut' && L(S, 'L1:2').status === 'todo' && L(S, 'L1:1').status_by === 'Op', L(S, 'L1:1').status + '/' + L(S, 'L1:2').status);
    const b = await saw.page.evaluate(() => ({ q: LQ.q.length, dots: document.querySelectorAll('.lq-dot').length, t2: rowTicked('L1', 'L1:2') }));
    rec('A2: queue empty, dot gone, other line still unticked', b.q === 0 && b.dots === 0 && !b.t2, JSON.stringify(b));
    rec('A2: a bench tick no longer saves the planner record (no PATCH, version unchanged)', S.patches.length === p0 && S.row.version === v0, S.patches.length - p0);
    rec('A2: the tick locked the list (first accepted change)', D.find(S.db, 'lists', 'L1').locked === true);
    // N/A on one of two identical lines parks only that one (the old "identical lines share one record" failure)
    await F.tapRow(saw.page, 'data-rna', 'L1:2'); await F.send(saw.page);
    const c = await saw.page.evaluate(() => ({ w: allHolds(['saw'], 'hold').map(x => x.k), held1: heldRow(lists()[0], 'L1:1') }));
    rec('A2: N/A on the other identical line parks only that one', c.w.join() === 'L1:2' && !c.held1 && L(S, 'L1:2').status === 'waiting', JSON.stringify(c));
    const E = x => JSON.stringify(x || {}) === '{}';
    rec('A2: planner record untouched — listRow / listHold stay empty', E(S.row.settings.listRow) && E(S.row.settings.listHold), JSON.stringify([S.row.settings.listRow, S.row.settings.listHold]));
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    await saw.close();
  }
  // ---- Acceptance 3: phone N/A while the PC cuts, both offline, then reconnect — the line ends up cut (both orders)
  for (const order of ['phone first', 'PC first']) {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
    const phone = await F.dev(browser, S, 'saw', { viewport: { width: 380, height: 800 } }), pc = await F.dev(browser, S, 'saw');
    await name(phone.page, 'Phone'); await name(pc.page, 'PC');
    S.offline = true;
    await F.tapRow(phone.page, 'data-rna', 'L1:3'); await F.tapRow(pc.page, 'data-rt', 'L1:3');
    await phone.page.evaluate(async () => { await lqSend(); }); await pc.page.evaluate(async () => { await lqSend(); });
    const off = [await F.qlen(phone.page), await F.qlen(pc.page)];
    S.offline = false;
    const first = order === 'phone first' ? [phone, pc] : [pc, phone];
    for (const d of first) await d.page.evaluate(async () => { window.dispatchEvent(new Event('online')); await new Promise(r => setTimeout(r, 300)); await lqSend(); });
    await reload(phone.page); await reload(pc.page);
    const st = async p => p.evaluate(() => ({ t: rowTicked('L1', 'L1:3'), h: heldRow(lists()[0], 'L1:3'), q: LQ.q.length, msg: LQ.msgs.join(' | ') }));
    const a = await st(phone.page), b = await st(pc.page);
    rec('A3 (' + order + '): kept on both devices while offline', off[0] === 1 && off[1] === 1, off.join());
    rec('A3 (' + order + '): database line is cut (by the PC), not waiting', L(S, 'L1:3').status === 'cut' && L(S, 'L1:3').status_by === 'PC', L(S, 'L1:3').status + ' by ' + L(S, 'L1:3').status_by);
    rec('A3 (' + order + '): both screens show it done, nobody shows it waiting, queues empty', a.t && !a.h && b.t && !b.h && a.q === 0 && b.q === 0, JSON.stringify({ a, b }));
    if (order === 'PC first') rec('A3 (PC first): the phone is told why its N/A didn\'t stick', /Not parked — "Top" is already cut by PC/.test(a.msg), a.msg);
    await phone.close(); await pc.close();
  }
  // ---- Acceptance 4: a stale untick after someone else ticked the line is refused, with a message
  {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
    const A = await F.dev(browser, S, 'saw'); await name(A.page, 'Aine');
    await F.tapRow(A.page, 'data-rt', 'L1:1'); await F.send(A.page); // cut v2 by Aine
    const B = await F.dev(browser, S, 'saw'); await name(B.page, 'Brian');
    await F.tapRow(B.page, 'data-rt', 'L1:1'); await F.send(B.page); // untick → v3
    await F.tapRow(B.page, 'data-rt', 'L1:1'); await F.send(B.page); // tick again → cut v4 by Brian
    rec('A4: set-up — B unticked and re-ticked (cut by Brian, version 4)', L(S, 'L1:1').status === 'cut' && L(S, 'L1:1').status_by === 'Brian' && L(S, 'L1:1').version === 4, JSON.stringify(L(S, 'L1:1')));
    // A's screen is out of date (still shows Aine's tick). A unticks.
    await F.tapRow(A.page, 'data-rt', 'L1:1');
    const mid = await A.page.evaluate(() => rowTicked('L1', 'L1:1'));
    await F.send(A.page);
    await F.sleep(200);
    const a = await A.page.evaluate(() => ({ t: rowTicked('L1', 'L1:1'), by: (rowTicks('L1')['L1:1'] || {}).by, msg: LQ.msgs.join(' | '), toast: document.getElementById('toast').textContent, q: LQ.q.length }));
    rec('A4: the untick shows at once on A (optimistic)', mid === false);
    rec('A4: refused by the database — line stays cut by Brian', L(S, 'L1:1').status === 'cut' && L(S, 'L1:1').status_by === 'Brian');
    rec('A4: A is told why, and its screen reloads the line (ticked by Brian)', a.t && a.by === 'Brian' && /changed on another screen \(already cut by Brian/.test(a.msg) && a.toast === a.msg && a.q === 0, JSON.stringify(a));
    // a fresh untick (A now up to date) works
    await F.tapRow(A.page, 'data-rt', 'L1:1'); await F.send(A.page);
    rec('A4: after the reload, A\'s untick goes through', L(S, 'L1:1').status === 'todo', L(S, 'L1:1').status);
    // tick on a line changed by a newer revision (screen still on rev 1) is refused with a message
    D.update(S.db, 'lists', D.find(S.db, 'lists', 'L1'), { rev: 2 }); D.update(S.db, 'list_lines', L(S, 'L1:3'), { changed_rev: 2, qty: '3' });
    await F.tapRow(A.page, 'data-rt', 'L1:3'); await F.send(A.page);
    const m = await A.page.evaluate(() => LQ.msgs[LQ.msgs.length - 1]);
    rec('A4b: tick on a line a newer revision changed is refused — "changed in a new revision"', L(S, 'L1:3').status === 'todo' && /changed in a new revision/.test(m), m);
    await reload(A.page);
    await F.tapRow(A.page, 'data-rt', 'L1:3'); await F.send(A.page);
    rec('A4b: once the screen has rev 2 the tick goes through', L(S, 'L1:3').status === 'cut');
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    await A.close(); await B.close();
  }
  // ---- Acceptance 5: saw offline for 10 ticks, tab closed and reopened, back online — all 10 reach the database exactly once
  {
    const S = F.makeServer(F.v2Row());
    F.seedList(S, 'L1', { lines: Array.from({ length: 10 }, (_, i) => ['saw', 'Part ' + (i + 1), '1', 500 + i, 300, 'MFC White', '', '']) });
    const saw = await F.dev(browser, S, 'saw');
    S.offline = true;
    for (let i = 1; i <= 10; i++) await F.tapRow(saw.page, 'data-rt', 'L1:' + i);
    await saw.page.evaluate(async () => { await lqSend(); });
    const a = await saw.page.evaluate(() => ({ q: LQ.q.map(e => e.t + (e.mode || '')).join(','), dots: document.querySelectorAll('.lq-dot').length, done: !!listDone('L1').saw, err: LQ.err }));
    const warn = await saw.page.evaluate(() => { const ev = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(ev); return ev.defaultPrevented; });
    rec('A5: 10 ticks + the automatic "cut complete" kept on the device while offline, shown done at once (the list leaves TO DO)', /^(line,){10}donesaw$/.test(a.q) && a.dots === 0 && a.done, JSON.stringify(a)); // a done list leaves the TO DO view
    rec('A5: closing the tab warns while ticks are unsent', warn === true);
    // the tab is closed and reopened (same device) while still offline
    const page = await saw.ctx.newPage(); page.on('pageerror', e => (S.errors = S.errors || []).push(String(e)));
    await S3.attach({ page }, S);
    await saw.page.close();
    await page.goto('https://wpf.test/?view=saw'); await page.waitForFunction(() => typeof lqSend === 'function'); await F.sleep(300);
    const b = await page.evaluate(() => ({ q: LQ.q.length }));
    rec('A5: reopened tab still holds all 11 unsent changes', b.q === 11, JSON.stringify(b));
    S.offline = false; S.dropReply = 1; // the first send lands but its reply is lost in bad signal
    await page.evaluate(async () => { await loadDB(); lsReset(); await lsLoad(); await lqSend(); });
    const mid = await page.evaluate(() => LQ.q.length);
    await page.evaluate(async () => { await lqSend(); });
    const ev = S.db.t.list_events;
    const cuts = ev.filter(e => e.to_status === 'cut'), per = {}; cuts.forEach(e => { per[e.line_id] = (per[e.line_id] || 0) + 1; });
    rec('A5: first reply lost → kept and resent', mid === 11, mid);
    rec('A5: all 10 lines cut in the database, each exactly once (10 events, no duplicates)', S.db.t.list_lines.every(x => x.status === 'cut') && cuts.length === 10 && Object.values(per).every(n => n === 1) && Object.keys(per).length === 10, cuts.length + ' ' + JSON.stringify(per));
    rec('A5: list signed off once in the database; queue empty', !!D.find(S.db, 'lists', 'L1').saw_done_at && ev.filter(e => e.act === 'saw-on').length === 1 && (await page.evaluate(() => LQ.q.length)) === 0, ev.filter(e => e.act === 'saw-on').length);
    const warn2 = await page.evaluate(() => { const e2 = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e2); return e2.defaultPrevented; });
    rec('A5: no close-tab warning once everything is sent', warn2 === false);
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    await page.close();
  }
  // ---- sign-off, undo, release, attach race, flags, archive, send back
  {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1'); F.seedList(S, 'L2', { name: 'House 2', wos: [] });
    const saw = await F.dev(browser, S, 'saw');
    await saw.page.evaluate(() => { const b = document.querySelector('[data-wldone="L1"]'); b.click(); });
    await F.send(saw.page);
    const l1 = D.find(S.db, 'lists', 'L1');
    rec('CUT COMPLETE: every saw line cut and the list signed off (by the name given), history written by the database', ['L1:1', 'L1:2', 'L1:3'].every(id => L(S, id).status === 'cut') && l1.saw_done_by === 'Tester' && l1.log.some(x => x.what === 'Cut complete'), JSON.stringify([l1.saw_done_by, l1.log]));
    await saw.page.evaluate(() => { wlShowDone = true; render(); document.querySelector('[data-wlundo="L1"]').click(); });
    await F.send(saw.page);
    rec('Undo: sign-off cleared and the saw lines unticked in the database', !D.find(S.db, 'lists', 'L1').saw_done_at && ['L1:1', 'L1:2', 'L1:3'].every(id => L(S, id).status === 'todo'), ['L1:1', 'L1:2', 'L1:3'].map(id => L(S, id).status).join());
    await saw.page.evaluate(() => { wlShowDone = false; render(); });
    // park with "Material not in", then release from the waiting book
    await saw.page.evaluate(() => { document.querySelector('[data-wlhold="L1"]').click(); const c = document.querySelector('[data-hk="L1:3"]'); c.checked = true; document.getElementById('hold-ok').click(); });
    await F.send(saw.page);
    rec('Material not in: the chosen line is waiting', L(S, 'L1:3').status === 'waiting', L(S, 'L1:3').status);
    const book = await saw.page.evaluate(() => { wlShowHold = true; render(); return document.querySelector('.hold-grp') ? document.querySelector('.hold-grp').innerText : ''; });
    await saw.page.evaluate(() => { document.querySelector('[data-relg]').click(); });
    await F.send(saw.page);
    const rel = await saw.page.evaluate(() => { wlShowHold = false; render(); return { h: holdsOf('L1')['L1:3'], txt: document.body.innerText.includes('MATERIAL IN — DO NOW') }; });
    rec('Release all: line back to do with released time, "MATERIAL IN — DO NOW" on the saw', /MFC White — 1 row waiting/.test(book) && L(S, 'L1:3').status === 'todo' && !!L(S, 'L1:3').released_at && rel.h && rel.h.st === 'rel' && rel.h.relBy === 'Tester' && rel.txt, JSON.stringify(rel));
    // two offices attach different WOs at the same moment — both kept
    const o1 = await F.dev(browser, S, 'office'), o2 = await F.dev(browser, S, 'office');
    await o1.page.evaluate(() => { listTag(lists().find(l => l.id === 'L2'), 'WO-1', true); });
    await o2.page.evaluate(() => { listTag(lists().find(l => l.id === 'L2'), 'WO-2', true); });
    const shown = await o1.page.evaluate(() => lists().find(l => l.id === 'L2').wos.join());
    await Promise.all([F.send(o1.page), F.send(o2.page)]);
    rec('attach shows at once on that screen', shown === 'WO-1');
    rec('two offices attaching at once: both work orders kept (list_attach is one step)', D.find(S.db, 'lists', 'L2').wos.slice().sort().join() === 'WO-1,WO-2', D.find(S.db, 'lists', 'L2').wos.join());
    await o1.page.evaluate(() => { listTag(lists().find(l => l.id === 'L2'), 'WO-1', false); }); await F.send(o1.page);
    rec('untag removes only that WO', D.find(S.db, 'lists', 'L2').wos.join() === 'WO-2');
    // no-cut flag (office tick box) and send back with a reason
    await o1.page.evaluate(async () => { showTab('l'); await new Promise(r => setTimeout(r, 100)); });
    await o1.page.evaluate(() => { const l = lists().find(x => x.id === 'L2'); listSetFlag(l, 'noFit', true, 'Tester'); });
    await F.send(o1.page);
    rec('no-fittings flag set by list_set_done with history', D.find(S.db, 'lists', 'L2').no_fit === true && D.find(S.db, 'lists', 'L2').log.some(x => x.what === 'No fittings ticked'));
    D.listSetDone(S.db, 'L1', 'fit', true, 'Mary');
    await o1.page.evaluate(async () => { await lsPoll(); sendBack(lists().find(l => l.id === 'L1'), 'fit'); });
    await F.send(o1.page);
    const lg = D.find(S.db, 'lists', 'L1').log.slice(-1)[0];
    rec('send back for re-picking: cleared, reason + "was done by Mary" in the history', !D.find(S.db, 'lists', 'L1').fit_done_at && /Sent back for re-picking \(was done .* by Mary\)/.test(lg.what) && lg.why === 'Tester', JSON.stringify(lg));
    // delete → archive (never deleted)
    await o1.page.evaluate(() => { showTab('l'); const b = document.querySelector('[data-ldel="L2"]'); if (b) b.click(); });
    const gone = await o1.page.evaluate(() => !lists().some(l => l.id === 'L2'));
    await F.send(o1.page);
    rec('Delete on the Lists tab archives the list: gone from screens, kept in the database', gone && D.find(S.db, 'lists', 'L2').archived === true && !S.deletes3, JSON.stringify({ gone, a: D.find(S.db, 'lists', 'L2').archived }));
    rec('planner record list data never written in V2', JSON.stringify(S.row.settings.lists) === JSON.stringify(F.v2Row().settings.lists) && [S.row.settings.listDone, S.row.settings.listRow, S.row.settings.listHold].every(x => JSON.stringify(x || {}) === '{}') && !(S.row.settings.holdLog || []).length, JSON.stringify([S.row.settings.listDone, S.row.settings.listRow, S.row.settings.listHold, S.row.settings.holdLog]));
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    await saw.close(); await o1.close(); await o2.close();
  }
  // ---- queue collapsing: tick then untick before sending = nothing sent; a tick then untick while the tick is in flight builds on it
  {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
    const saw = await F.dev(browser, S, 'saw');
    await F.tapRow(saw.page, 'data-rt', 'L1:1'); await F.tapRow(saw.page, 'data-rt', 'L1:1');
    const q0 = await F.qlen(saw.page); await F.send(saw.page);
    rec('tick + untick before sending → nothing to send, database untouched', q0 === 0 && L(S, 'L1:1').version === 1, q0);
    let rel; S.hold3 = new Promise(r => { rel = r; });
    await F.tapRow(saw.page, 'data-rt', 'L1:2');
    const p = F.send(saw.page); await F.sleep(150);
    await F.tapRow(saw.page, 'data-rt', 'L1:2'); // untick while the tick is still on its way
    rel(); S.hold3 = null; await p; await F.send(saw.page);
    rec('untick while the tick is in flight: both go, in order, and the untick is accepted', L(S, 'L1:2').status === 'todo' && L(S, 'L1:2').version === 3 && (await F.qlen(saw.page)) === 0, JSON.stringify(L(S, 'L1:2')));
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    await saw.close();
  }
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
