// B9c (Coder): Johnny's own order — ▲ ▼ / # Move to / drag write seq_pre.pre_key only (the PMs' sequences untouched), order holds after
// reload, a new WO slots in by date, Back to due-date order, OUT OF STEP, "↻ changed since you last looked" + Seen all, drag redraw guard.
// Fake Supabase only. Run: node tests/seq/b9c-order.test.js
const { X, makePool, pre, pool, wos } = require('./b9fix.js');
const { H, rec, sleep } = X;
const seqSnap = S => JSON.stringify(S.db.t.project_seq.map(r => [r.id, r.pos, r.version, r.state, r.wo]));
const toasts = p => p.evaluate(() => { window.__t = []; const T = window.toast; window.toast = (m, s) => { window.__t.push(String(m)); try { T(m, s); } catch (e) {} }; });
const lastToast = p => p.evaluate(() => (window.__t || []).slice(-1)[0] || '');
const oos = r => r.filter(x => /OUT OF STEP/.test(x.flags)).map(x => x.wo).join(',');
(async () => {
  const browser = await H.chromium.launch();
  const S = makePool();
  const seq0 = seqSnap(S);
  const a = await pre(browser, S); await toasts(a.page);
  let r = await pool(a.page);
  rec('default order: nothing OUT OF STEP, nothing "↻ changed" on the first visit (baseline)', !oos(r) && !r.some(x => /changed/.test(x.flags)), JSON.stringify(r.map(x => [x.wo, x.flags])));
  const mv = await a.page.evaluate(() => [...document.querySelectorAll('[data-preup]')].map(b => b.dataset.preup));
  rec('▲▼ / Move to only on rows with a sequence row (WO-1, WO-12, W1, WO-10)', JSON.stringify(mv) === JSON.stringify(['W:WO-1', 'W:WO-12', 'R:W1', 'W:WO-10']), JSON.stringify(mv));
  // ▲ on WO-10 (last) → above WO-17
  await a.page.evaluate(() => document.querySelector('[data-preup="W:WO-10"]').click()); await sleep(600);
  r = await pool(a.page);
  const sp10 = S.db.t.seq_pre.find(x => x.seq_id === 'Q10');
  rec('▲ WO-10: now above WO-17; seq_pre pre_key between them; not processed', /⏳ no WO yet,WO-10,WO-17$/.test(wos(r)) && sp10 && typeof sp10.pre_key === 'number' && !sp10.processed, wos(r) + ' ' + JSON.stringify(sp10));
  const w10 = r.find(x => x.wo === 'WO-10');
  rec('WO-10: My# 6 (after processed WO-16, hidden), Due# 7 (the due-date place is kept apart)', w10.my === 6 && w10.dn === 7, JSON.stringify(w10));
  rec('the PMs\' sequences untouched (no project_seq / rpc writes)', seqSnap(S) === seq0 && !S.log.some(x => /^(POST|PATCH) \/(project_seq|rpc)/.test(x)));
  // # Move to 1 on the waiting row → top; cut ~18 Nov above WO-1 / WO-2 / WO-12 (cut in October) → those OUT OF STEP
  await a.page.evaluate(() => { window.prompt = () => '1'; document.querySelector('[data-preto="R:W1"]').click(); }); await sleep(600);
  r = await pool(a.page);
  rec('# Move to 1: waiting row W1 on top (seq_pre row with no WO)', r[0].k === 'R:W1' && S.db.t.seq_pre.some(x => x.seq_id === 'W1' && x.wo === null), wos(r));
  rec('OUT OF STEP: WO-1, WO-2, WO-12 (W1 above, cut ~18 Nov) and WO-17 (WO-10 above, cut 25 Nov > 19 Nov + 2 working days); W1 / WO-10 not', oos(r) === 'WO-1,WO-2,WO-12,WO-17', oos(r));
  await a.page.evaluate(() => { PREV.proc = 'all'; render(); }); await sleep(200);
  r = await pool(a.page);
  rec('processed rows (WO-16, Cienapps step 5) are never flagged', !/WO-16/.test(oos(r)) && /WO-16/.test(wos(r)), oos(r));
  await a.page.evaluate(() => { PREV.proc = 'not'; render(); }); await sleep(200);
  // order holds on a new device / after reload
  const b = await pre(browser, S); await toasts(b.page);
  rec('order holds on another screen (reload): W1 first, WO-10 before WO-17', /^⏳ no WO yet,WO-1,WO-2,WO-12,WO-10,WO-17$/.test(wos(await pool(b.page))), wos(await pool(b.page)));
  // a new WO slots in by date (never-moved rows follow their date)
  await b.page.evaluate(() => { DB.orders.push(Object.assign({}, DB.orders.find(o => o.wo === 'WO-17'), { wo: 'WO-18', customer: 'Nobody Ltd', dueDate: '2026-10-30', origDueDate: '2026-10-30', title: 'NEW' })); render(); }); await sleep(200);
  rec('a new WO due 30 Oct slots in between WO-2 (22 Oct) and WO-12 (1 Nov)', /WO-2,WO-18,WO-12/.test(wos(await pool(b.page))), wos(await pool(b.page)));
  // same project + same due, higher PM position above → OUT OF STEP
  await b.page.evaluate(() => { DB.orders.find(o => o.wo === 'WO-12').dueDate = '2026-10-22'; render(); }); await sleep(200);
  r = await pool(b.page);
  rec('WO-12 (pos 1) and WO-1 (pos 3) both due 22 Oct: default puts WO-12 first and none flagged by position', /WO-12,WO-1,WO-2/.test(wos(r)), wos(r));
  await b.page.evaluate(() => document.querySelector('[data-preup="W:WO-1"]').click()); await sleep(600);
  r = await pool(b.page);
  rec('WO-1 moved above WO-12 → WO-12 OUT OF STEP (same project and due, higher PM position above)', /WO-1,WO-12/.test(wos(r)) && /WO-12/.test(oos(r)), wos(r) + ' | ' + oos(r));
  // gap too small
  const before = JSON.stringify(S.db.t.seq_pre);
  await b.page.evaluate(() => { const r1 = LST.sp.get('Q1'); LST.sp.set('Q12', Object.assign({}, r1, { seq_id: 'Q12', id: 'Q12', wo: 'WO-12', pre_key: r1.pre_key + 1e-9, version: 99 })); LST.gen++; render(); }); await sleep(200);
  r = await pool(b.page);
  await b.page.evaluate(() => preMove('R:W1', { onto: 'W:WO-1' })); await sleep(400);
  rec('two neighbours too close (< 1e-6): refused, "Back to due-date order first", nothing written', /Back to due-date order/.test(await lastToast(b.page)) && JSON.stringify(S.db.t.seq_pre) === before, await lastToast(b.page));
  await b.close();
  // drag on a PC
  await a.page.evaluate(async () => { await lsPoll(); render(); }); await sleep(300);
  r = await pool(a.page);
  const dr = await a.page.evaluate(() => { const rows = [...document.querySelectorAll('#pre-pool tr[data-prer]')]; const src = rows.find(t => t.dataset.prer === 'W:WO-10'), dst = rows[0];
    const dt = new DataTransfer(); src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt })); const armed = PREV.drag;
    // a poll redraw while the drag is armed must not rebuild the table
    const mark = document.getElementById('pre-pool'); mark.dataset.mark = '1'; mergedRender(); const kept = !!document.querySelector('#pre-pool[data-mark="1"]');
    dst.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt })); dst.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    return { armed, kept, after: PREV.drag }; }); await sleep(700);
  r = await pool(a.page);
  rec('drag armed: a redraw (poll / merge) is held off', dr.armed === 'W:WO-10' && dr.kept && dr.after === '', JSON.stringify(dr));
  rec('drag WO-10 onto the top row → WO-10 first', r[0].wo === 'WO-10', wos(r));
  rec('still no project_seq write after every move', seqSnap(S) === seq0);
  // Back to due-date order
  await a.page.evaluate(() => { window.confirm = () => true; document.getElementById('pre-reset').click(); }); await sleep(1200);
  r = await pool(a.page);
  rec('↺ Back to due-date order: every pre_key cleared, My# = Due#, nothing OUT OF STEP', S.db.t.seq_pre.every(x => x.pre_key == null) && r.every(x => x.my === x.dn) && !oos(r), JSON.stringify(S.db.t.seq_pre.map(x => [x.seq_id, x.pre_key])) + ' ' + wos(r));
  rec('reset button gone once nothing is moved', await a.page.evaluate(() => !document.getElementById('pre-reset')));
  // "changed since you last looked"
  await a.page.evaluate(() => { DB.orders.find(o => o.wo === 'WO-10').dueDate = '2026-11-30'; DB.orders.find(o => o.wo === 'WO-17').delivDate = '2026-12-04'; render(); }); await sleep(200);
  r = await pool(a.page);
  rec('a PM / office date change → "↻ changed" on WO-10 and WO-17 only', r.filter(x => /changed/.test(x.flags)).map(x => x.wo).join() === 'WO-17,WO-10' || r.filter(x => /changed/.test(x.flags)).map(x => x.wo).sort().join() === 'WO-10,WO-17', JSON.stringify(r.map(x => [x.wo, x.flags])));
  await a.page.evaluate(() => document.querySelector('[data-preseen="W:WO-10"]').click()); await sleep(200);
  r = await pool(a.page);
  rec('tapping a badge clears that one', !/changed/.test(r.find(x => x.wo === 'WO-10').flags) && /changed/.test(r.find(x => x.wo === 'WO-17').flags));
  X.DS.seqUpdate(S.db, S.db.t.project_seq.find(x => x.id === 'W1'), { req_date: '2026-12-01', updated_by: 'John Burke' }, false);
  await a.page.evaluate(async () => { await lsPoll(); render(); }); await sleep(300);
  r = await pool(a.page);
  rec('a waiting row\'s date changed on another PC → "↻ changed"; "✓ Seen all (2 changed)"', /changed/.test(r.find(x => x.k === 'R:W1').flags) && /Seen all \(2 changed\)/.test(await a.page.evaluate(() => (document.getElementById('pre-seenall') || {}).textContent || '')), JSON.stringify(r.map(x => [x.k, x.flags])));
  await a.page.evaluate(() => document.getElementById('pre-seenall').click()); await sleep(200);
  r = await pool(a.page);
  rec('✓ Seen all clears every badge', !r.some(x => /changed/.test(x.flags)) && await a.page.evaluate(() => !document.getElementById('pre-seenall')));
  // a new device flags nothing; storage blocked flags nothing
  const c = await pre(browser, S);
  rec('a new device: baseline, nothing flagged', !(await pool(c.page)).some(x => /changed/.test(x.flags)));
  await c.page.evaluate(() => { const G = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { if (/^wpfSeen_pre_/.test(k)) throw new Error('blocked'); return G.call(this, k); }; DB.orders.find(o => o.wo === 'WO-10').dueDate = '2026-11-27'; render(); }); await sleep(200);
  rec('storage blocked: nothing flagged, no errors', !(await pool(c.page)).some(x => /changed/.test(x.flags)) && !(S.errors || []).length, JSON.stringify(S.errors));
  await c.close();
  rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  await a.close();
  await browser.close();
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
