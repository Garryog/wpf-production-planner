// ATTACK: the device line queue (wpfLineQ → apply_line_changes). Two tabs on one device, storage full, a refused
// batch, lost reply + untick, switch back while a device still holds unsent ticks. Fake Supabase only.
// Run: node tests/stage3/attack-queue.test.js
const A = require('./atk.js');
const { F, S3, H, D, rec } = A;
const L = F.line;
async function tab2(t, S, role) { // a second tab on the SAME device (same localStorage)
  const page = await t.ctx.newPage(); const n = { ...t, page };
  page.on('pageerror', e => (S.errors = S.errors || []).push(String(e)));
  await S3.attach(n, S);
  await page.goto('https://wpf.test/?view=office');
  await page.waitForFunction(() => typeof analyzeImport === 'function'); await page.waitForTimeout(400);
  await page.evaluate(async r => { localStorage.setItem('wpfPin_' + r, '9000'); setRole(r); lsReset(); await lsLoad(); render(); }, role);
  return n;
}
(async () => {
  const browser = await H.chromium.launch();
  // ---- Q1: two tabs on one device. Tab A's tick is in flight; tab B unticks the same line. Last tap must win.
  {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
    const a = await F.dev(browser, S, 'saw'); const b = await tab2(a, S, 'saw');
    let rel; S.hold3 = new Promise(r => { rel = r; });
    await F.tapRow(a.page, 'data-rt', 'L1:3');
    const sending = a.page.evaluate(async () => { await lqSend(); });
    await F.sleep(300);
    const bt = await b.page.evaluate(() => { LQ.q = lqRead(); LQ.gen++; render(); return rowTicked('L1', 'L1:3'); });
    await F.tapRow(b.page, 'data-rt', 'L1:3'); // B sees the tick (from the shared queue) and unticks it
    const qB = await b.page.evaluate(() => JSON.parse(localStorage.getItem('wpfLineQ') || '[]').map(e => e.status));
    S.hold3 = null; rel(); await sending;
    await b.page.evaluate(async () => { await lqSend(); }); await a.page.evaluate(async () => { await lqSend(); });
    rec('Q1 two tabs, one device: B unticks while A\'s tick is in flight → line ends todo (last tap wins)', L(S, 'L1:3').status === 'todo', 'B saw ticked=' + bt + ' queue after B untick=' + JSON.stringify(qB) + ' db=' + L(S, 'L1:3').status);
    await a.close();
  }
  // ---- Q2: two tabs both send the shared queue at the same moment: each tick applied exactly once
  {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
    const a = await F.dev(browser, S, 'saw'); const b = await tab2(a, S, 'saw');
    S.offline3 = true;
    for (const id of ['L1:1', 'L1:2', 'L1:3']) await F.tapRow(a.page, 'data-rt', id);
    await a.page.evaluate(async () => { await lqSend(); });
    S.offline3 = false;
    await Promise.all([a.page.evaluate(async () => { await lqSend(); }), b.page.evaluate(async () => { LQ.q = lqRead(); await lqSend(); })]);
    const ev = S.db.t.list_events.filter(e => e.line_id && e.act === 'status').length;
    const calls = S.rpcCalls.filter(c => c.fn === 'apply_line_changes').length;
    rec('Q2 two tabs flush the same queue: 3 lines cut, 3 events (exactly once in the FAKE db)', ['L1:1', 'L1:2', 'L1:3'].every(id => L(S, id).status === 'cut') && ev === 3, 'events=' + ev + ' rpc calls=' + calls + ' (both tabs sent the same cids — real Postgres races on le_cid, see report)');
    await a.close();
  }
  // ---- Q3: the database refuses ONE change in a batch with an error (e.g. 23505 le_cid race) → the rest of the batch?
  {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
    const saw = await F.dev(browser, S, 'saw');
    S.offline3 = true;
    for (const id of ['L1:1', 'L1:2', 'L1:3']) await F.tapRow(saw.page, 'data-rt', id);
    await saw.page.evaluate(async () => { await lqSend(); });
    S.offline3 = false;
    const orig = D.RPC.apply_line_changes; let once = true;
    D.RPC.apply_line_changes = (d, a2) => { if (once && a2.p_changes.length > 1) { once = false; throw new D.DbError('duplicate key value violates unique constraint "le_cid"', '23505'); } return orig(d, a2); };
    await saw.page.evaluate(async () => { await lqSend(); });
    D.RPC.apply_line_changes = orig;
    const st = ['L1:1', 'L1:2', 'L1:3'].map(id => L(S, id).status);
    const q = await saw.page.evaluate(() => ({ q: LQ.q.length, msg: LQ.msgs.join(' | '), on: ['L1:1', 'L1:2', 'L1:3'].map(id => rowTicked('L1', id)) }));
    rec('Q3 one bad change in a 3-tick batch (HTTP 409) must not throw away the other ticks', st.every(s => s === 'cut') || q.q > 0, 'db=' + st.join() + ' queue=' + q.q + ' screen=' + q.on.join() + ' msg=' + q.msg);
    await saw.close();
  }
  // ---- Q4: localStorage full / throwing — the tick can't be kept on the device. Is the operator told?
  {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
    const saw = await F.dev(browser, S, 'saw');
    S.offline3 = true;
    await saw.page.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException('QuotaExceededError', 'QuotaExceededError'); }; });
    await F.tapRow(saw.page, 'data-rt', 'L1:3');
    await saw.page.evaluate(async () => { await lqSend(); render(); });
    const w = await saw.page.evaluate(() => ({ mem: LQ.memOnly, bar: !document.getElementById('savebar').hidden, txt: document.body.innerText.match(/could NOT keep|not kept|storage/i) }));
    rec('Q4 storage full: operator warned that ticks are NOT kept on this device (like Stage 1 pendFail bar)', w.mem && (w.bar || !!w.txt), JSON.stringify(w));
    // offline for a while: is there any screen-wide "not sent" warning (LQ.err), not just per-row dots?
    const w2 = await saw.page.evaluate(() => ({ err: LQ.err, bar: !document.getElementById('savebar').hidden, txt: (document.body.innerText.match(/not sent|no signal|offline|NOT SAVED/i) || [''])[0] }));
    rec('Q5 offline: a screen-wide warning shows when the queue cannot send (LQ.err is set)', !!w2.err && (w2.bar || !!w2.txt), JSON.stringify(w2));
    await saw.close();
  }
  // ---- Q6: reply lost on a tick, user then unticks (queued before the resend). Meanwhile another screen unticked
  //          and RE-ticked the line. The resend reports dup with the CURRENT version → the untick is bumped to it and
  //          undoes the other person's tick (acceptance 4 says a stale untick must be refused).
  {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
    const a = await F.dev(browser, S, 'saw'), b = await F.dev(browser, S, 'saw');
    await a.page.evaluate(() => localStorage.setItem('wpfOpName', 'Aine')); await b.page.evaluate(() => localStorage.setItem('wpfOpName', 'Brian'));
    await F.tapRow(a.page, 'data-rt', 'L1:3');
    S.dropReply = 1; await a.page.evaluate(async () => { await lqSend(); }); // landed, reply lost
    await F.tapRow(a.page, 'data-rt', 'L1:3'); // Aine unticks her own tick (still queued behind the unconfirmed tick)
    await b.page.evaluate(async () => { await lsPoll(); render(); });
    await F.tapRow(b.page, 'data-rt', 'L1:3'); await F.send(b.page); // Brian unticks …
    await b.page.evaluate(async () => { await lsPoll(); render(); });
    await F.tapRow(b.page, 'data-rt', 'L1:3'); await F.send(b.page); // … and re-ticks: cut by Brian
    const mid = L(S, 'L1:3').status + ' by ' + L(S, 'L1:3').status_by;
    await a.page.evaluate(async () => { await lqSend(); });
    rec('Q6 lost reply then untick: Aine\'s late untick must not undo Brian\'s newer tick', L(S, 'L1:3').status === 'cut', 'before resend: ' + mid + ' → after: ' + L(S, 'L1:3').status);
    await a.close(); await b.close();
  }
  // ---- Q6b: reply lost on a tick, then the operator unticks it. Nobody else touches the line. It must end todo.
  {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
    const a = await F.dev(browser, S, 'saw');
    await F.tapRow(a.page, 'data-rt', 'L1:3');
    S.dropReply = 1; await a.page.evaluate(async () => { await lqSend(); }); // landed, reply lost
    const q0 = await a.page.evaluate(() => LQ.q.length);
    await F.tapRow(a.page, 'data-rt', 'L1:3'); // untick
    const q1 = await a.page.evaluate(() => ({ n: LQ.q.length, shown: rowTicked('L1', 'L1:3') }));
    await a.page.evaluate(async () => { await lqSend(); await lsPoll(); render(); });
    const q2 = await a.page.evaluate(() => rowTicked('L1', 'L1:3'));
    rec('Q6b lost reply then untick (nobody else involved): line ends todo, as the operator last saw it', L(S, 'L1:3').status === 'todo', 'queue before untick=' + q0 + ' after=' + JSON.stringify(q1) + ' db=' + L(S, 'L1:3').status + ' screen after poll ticked=' + q2);
    await a.close();
  }
  // ---- Q7: switch back while the saw tablet holds unsent ticks (offline). Tablet reconnects afterwards.
  {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
    const off = await F.dev(browser, S, 'office'), saw = await F.dev(browser, S, 'saw');
    S.offline = true; // the tablet has no signal at all
    for (const id of ['L1:1', 'L1:3']) await F.tapRow(saw.page, 'data-rt', id);
    await saw.page.evaluate(async () => { await lqSend(); });
    S.offline = false;
    // office switches back (only its own queue is checked)
    const back = await off.page.evaluate(async () => { for (let i = 0; i < 50 && (SAVING || saveT); i++) { if (saveT) { clearTimeout(saveT); saveT = null; await saveDB(); } await new Promise(r => setTimeout(r, 100)); } try { return await lsSwitchBack('Garry'); } catch (e) { return { err: e.message }; } });
    // the tablet gets signal: the planner refresh runs first (normal 30 s refresh), then the online event
    await saw.page.evaluate(async () => { await loadDB(); window.dispatchEvent(new Event('online')); await new Promise(r => setTimeout(r, 300)); await lqSend(); });
    const s = await saw.page.evaluate(() => ({ v2: V2(), q: LQ.q.length, ticked: Object.keys(rowTicks('L1')).length }));
    const old = Object.keys((S.row.settings.listRow || {}).L1 || {}).length;
    rec('Q7 switch back with ticks unsent on a tablet: the ticks reach the old lists (or switch back is refused)', !!back.err || old >= 2, 'switchback=' + JSON.stringify(back) + ' tablet=' + JSON.stringify(s) + ' old-format ticks on L1=' + old + ' table L1:1=' + L(S, 'L1:1').status);
    rec('Q7b the tablet is not left with ticks stuck in its queue that nothing will ever send', s.q === 0 || !s.v2 === false, 'queue=' + s.q + ' v2=' + s.v2 + ' (lqSend does nothing when !V2(); beforeunload warning also needs V2())');
    await off.close(); await saw.close();
  }
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
