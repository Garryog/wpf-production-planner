// PM sequence step 4 (Coder, B6b): reorder — ▲ ▼, "# Move to…", HTML5 drag on PC, "Whole house" (same floor + unit moves
// as a block), all through seq_move with the versions this screen read; two PCs at once → 'stale' → reload + message;
// fixed (🔒) rows: a PM is told "Request a change — coming soon", the office moves them with a reason; 📜 History
// (who / when / old → new position) read from project_events. PC + 360 px phone; hidden before the SQL and with the
// switch off. Fake Supabase only. Run: node tests/seq/s4-seq-move.test.js
const X = require('./fixs.js');
const { H, rec, sleep } = X;
(async () => {
  const browser = await H.chromium.launch();
  // ---- before the SQL / switch off: no move controls, no seq_move
  const S0 = X.makeServer(null, { noSeq: true });
  const p0 = await X.dev(browser, S0, 'office');
  const r0 = await p0.page.evaluate(() => { seqOpen('P1'); seqMoveReq('P1', 'QA', { up: 1 }); return { pg: !!document.getElementById('seq-pg'), up: !!document.querySelector('[data-sequp]') }; });
  await sleep(200);
  rec('before the SQL: no sequence page, no move buttons, no seq_move call', !r0.pg && !r0.up && !(S0.rpcCalls || []).some(c => c.fn === 'seq_move'), JSON.stringify(r0));
  rec('before the SQL: no page errors', !(S0.errors || []).length, JSON.stringify(S0.errors));
  await p0.close();
  const S1 = X.makeServer(X.v1Row());
  const p1 = await X.dev(browser, S1, 'office');
  await p1.page.evaluate(() => { seqOpen('P1'); seqMoveReq('P1', 'QA', { up: 1 }); }); await sleep(200);
  rec('switch off: nothing shows, no sequence traffic', X.SS.seqCalls(S1).length === 0 && !(S1.errors || []).length);
  await p1.close();

  // ---- with the SQL: six rows on Aderrig, John Burke is the PM
  const S = X.makeServer();
  X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
  const seed = [['QA', { wo: 'WO-1' }], ['QB', { wo: 'WO-2' }], ['QC', { wo: 'WO-4' }], ['QD', { wo: 'WO-3' }],
    ['QE', { floor: 'T09', unit: '15', product: 'K8', name: 'HOUSE TYPE E' }], ['QF', { floor: 'T09', unit: '16', product: 'K8', name: 'HOUSE TYPE F' }]];
  seed.forEach(([id, f]) => { const o = S.row.orders.find(x => x.wo === f.wo); X.seqRow(S, id, 'P1', Object.assign(o ? { floor: o.floor, unit: o.unit, descr: o.title } : {}, f)); });
  const ord = () => X.order(S, 'P1').join(',');
  const view = p => p.evaluate(() => [...document.querySelectorAll('tr.seq-r')].map(tr => tr.dataset.seqr).join(','));
  const pc1 = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
  await pc1.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(300);
  const c0 = await pc1.page.evaluate(() => ({ up: document.querySelectorAll('[data-sequp]').length, to: document.querySelectorAll('[data-seqto]').length, hd: document.querySelectorAll('tr[draggable] .seq-hd').length, wh: !!document.getElementById('seq-house'), hist: !!document.getElementById('seq-hist') }));
  rec('PM, own project: ▲ ▼ / Move to / drag handle on every row, Whole house tick, History', c0.up === 6 && c0.to === 6 && c0.hd === 6 && c0.wh && c0.hist, JSON.stringify(c0));
  // ▲ on E
  const vE = X.D.find(S.db, 'project_seq', 'QE').version;
  await pc1.page.evaluate(() => document.querySelector('[data-sequp="QE"]').click()); await sleep(600);
  const mv1 = (S.rpcCalls || []).filter(c => c.fn === 'seq_move').pop();
  rec('▲ on row 5: seq_move([E], after C, expect [its version], by John Burke)', mv1 && JSON.stringify(mv1.args.p_ids) === '["QE"]' && mv1.args.p_after === 'QC' && JSON.stringify(mv1.args.p_expect) === JSON.stringify([vE]) && mv1.args.p_by === 'John Burke', JSON.stringify(mv1 && mv1.args));
  rec('database + page: A,B,C,E,D,F', ord() === 'QA,QB,QC,QE,QD,QF' && await view(pc1.page) === 'QA,QB,QC,QE,QD,QF', ord() + ' / ' + await view(pc1.page));
  const h1 = S.db.t.project_events.filter(e => e.act === 'move');
  rec('database history: E moved #5 → #4 by John Burke', h1.length === 1 && h1[0].entity_id === 'QE' && h1[0].old.pos === 5 && h1[0].new.pos === 4 && h1[0].by === 'John Burke', JSON.stringify(h1));
  // ▼ on C
  await pc1.page.evaluate(() => document.querySelector('[data-seqdn="QC"]').click()); await sleep(600);
  rec('▼ on C: A,B,E,C,D,F', ord() === 'QA,QB,QE,QC,QD,QF', ord());
  // Move to 3 on F (a free row; 1 and 2 are 🔒 fixed)
  await pc1.page.evaluate(() => { window.__prompt = '3'; document.querySelector('[data-seqto="QF"]').click(); }); await sleep(600);
  rec('# Move to… 3: F to just under the fixed rows', ord() === 'QA,QB,QF,QE,QC,QD' && await view(pc1.page) === 'QA,QB,QF,QE,QC,QD', ord());
  // Whole house: D (T09 13) takes C (T09 13) with it, in their order
  await pc1.page.evaluate(() => { const w = document.getElementById('seq-house'); w.checked = true; w.onchange(); window.__prompt = '3'; document.querySelector('[data-seqto="QD"]').click(); }); await sleep(600);
  const mv2 = (S.rpcCalls || []).filter(c => c.fn === 'seq_move').pop();
  rec('Whole house ticked: Move D to 3 moves C + D (same floor + unit) as a block', ord() === 'QA,QB,QC,QD,QF,QE' && JSON.stringify(mv2.args.p_ids) === '["QC","QD"]' && mv2.args.p_after === 'QB', ord() + ' ' + JSON.stringify(mv2.args));
  await pc1.page.evaluate(() => { const w = document.getElementById('seq-house'); w.checked = false; w.onchange(); });
  // HTML5 drag on PC: E dropped onto F (E moves up to F's place)
  await pc1.page.dragAndDrop('tr[data-seqr="QE"] .seq-hd', 'tr[data-seqr="QF"]'); await sleep(700);
  rec('PC drag: E dropped on F → A,B,C,D,E,F', ord() === 'QA,QB,QC,QD,QE,QF' && await view(pc1.page) === 'QA,QB,QC,QD,QE,QF', ord() + ' / ' + await view(pc1.page));
  await pc1.page.dragAndDrop('tr[data-seqr="QC"] .seq-hd', 'tr[data-seqr="QE"]'); await sleep(700);
  rec('PC drag down: C dropped on E → A,B,D,E,C,F', ord() === 'QA,QB,QD,QE,QC,QF', ord());
  // a fixed row: the PM is told to ask, nothing moves
  const nMoves = (S.rpcCalls || []).filter(c => c.fn === 'seq_move').length;
  await pc1.page.evaluate(() => document.querySelector('[data-seqdn="QA"]').click()); await sleep(300);
  const tf = await pc1.page.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
  rec('PM on a 🔒 fixed row: "✋ Request a change — coming soon", nothing sent', /Request a change — coming soon/.test(tf) && (S.rpcCalls || []).filter(c => c.fn === 'seq_move').length === nMoves && ord() === 'QA,QB,QD,QE,QC,QF', tf);
  await pc1.page.dragAndDrop('tr[data-seqr="QB"] .seq-hd', 'tr[data-seqr="QD"]'); await sleep(400);
  rec('PM dragging a fixed row: refused the same way', (S.rpcCalls || []).filter(c => c.fn === 'seq_move').length === nMoves && ord() === 'QA,QB,QD,QE,QC,QF', ord());
  await pc1.page.evaluate(() => { window.__prompt = '1'; document.querySelector('[data-seqto="QF"]').click(); }); await sleep(400);
  rec('PM putting a FREE row above 🔒 fixed rows: "Request a change — coming soon", nothing sent', /Request a change — coming soon/.test(await pc1.page.evaluate(() => document.getElementById('toast').textContent)) && (S.rpcCalls || []).filter(c => c.fn === 'seq_move').length === nMoves && ord() === 'QA,QB,QD,QE,QC,QF', ord());

  // ---- two PCs: the office window is open on the same list; the PM moves; the office's move is refused as stale
  const pc2 = await X.dev(browser, S, 'office');
  await pc2.page.evaluate(() => seqOpen('P1')); await sleep(500);
  rec('office window shows the same order', await pc2.page.evaluate(() => [...document.querySelectorAll('.seq-ovl tr.seq-r')].map(tr => tr.dataset.seqr).join(',')) === ord());
  await pc1.page.evaluate(() => { window.__prompt = '3'; document.querySelector('[data-seqto="QF"]').click(); }); await sleep(600);
  rec('PM moved F to #3 meanwhile', ord() === 'QA,QB,QF,QD,QE,QC', ord());
  await pc2.page.evaluate(() => document.querySelector('.seq-ovl [data-seqdn="QD"]').click()); await sleep(700);
  const st = await pc2.page.evaluate(() => ({ t: (document.getElementById('toast') || {}).textContent || '', v: [...document.querySelectorAll('.seq-ovl tr.seq-r')].map(tr => tr.dataset.seqr).join(',') }));
  const last = (S.rpcCalls || []).filter(c => c.fn === 'seq_move').pop();
  rec('office (stale screen) ▼: refused, nothing changed in the database', last.args.p_ids[0] === 'QD' && ord() === 'QA,QB,QF,QD,QE,QC', ord());
  rec('office told "someone else just changed this list — reloaded" and shows the new order', /someone else just changed this list — reloaded/i.test(st.t) && st.v === ord(), JSON.stringify(st));
  // the same race at the very last moment (another PC's move lands just before this one)
  S.beforeRpc = (fn) => { if (fn === 'seq_move') { S.beforeRpc = null; X.DS.RPC.seq_move(S.db, { p_ids: ['QE'], p_after: null, p_expect: null, p_by: 'Other PC' }); } };
  await pc2.page.evaluate(() => document.querySelector('.seq-ovl [data-seqdn="QD"]').click()); await sleep(700);
  const st2 = await pc2.page.evaluate(() => ({ t: (document.getElementById('toast') || {}).textContent || '', v: [...document.querySelectorAll('.seq-ovl tr.seq-r')].map(tr => tr.dataset.seqr).join(',') }));
  rec('another PC moves a split second earlier: stale, reloaded, screen = database', /reloaded/.test(st2.t) && st2.v === ord() && ord() === 'QE,QA,QB,QF,QD,QC', JSON.stringify(st2) + ' ' + ord());
  // office moves a fixed row: reason asked, logged with it
  await pc2.page.evaluate(() => document.querySelector('.seq-ovl [data-seqdn="QB"]').click()); await sleep(300);
  const rs = await pc2.page.evaluate(() => [...document.querySelectorAll('[data-why]')].map(b => b.dataset.why));
  rec('office on a 🔒 fixed row: reason asked (date reasons)', rs.includes('Site not ready') && rs.includes('Other'), JSON.stringify(rs));
  await pc2.page.evaluate(() => document.querySelector('[data-why="Site not ready"]').click()); await sleep(700);
  const lm = (S.rpcCalls || []).filter(c => c.fn === 'seq_move').pop();
  const he = S.db.t.project_events.filter(e => e.act === 'move' && e.entity_id === 'QB').pop();
  rec('fixed row moved by the office with the reason; history keeps the reason', ord() === 'QE,QA,QF,QB,QD,QC' && lm.args.p_why === 'Site not ready' && he && he.new.why === 'Site not ready' && he.by === 'Op', ord() + ' ' + JSON.stringify(he));
  // cancel the reason = nothing moves
  const nm2 = (S.rpcCalls || []).filter(c => c.fn === 'seq_move').length;
  await pc2.page.evaluate(() => document.querySelector('.seq-ovl [data-sequp="QB"]').click()); await sleep(300);
  await pc2.page.evaluate(() => document.querySelector('.pod-ovl:last-of-type #pod-x').click()); await sleep(300);
  rec('reason cancelled: nothing moves', (S.rpcCalls || []).filter(c => c.fn === 'seq_move').length === nm2 && ord() === 'QE,QA,QF,QB,QD,QC', ord());
  // 📜 History
  S.db.t.project_events.push({ id: S.db.seq.project_events++, project_id: 'P1', entity: 'seq', entity_id: 'QE', act: 'move', old: { pos: 9 }, new: { pos: 8, why: '<b>x</b>' }, by: '<img src=x onerror="window.__h=1">', at: new Date(Date.now() + 60000).toISOString() });
  await pc1.page.evaluate(() => { render(); document.getElementById('seq-hist').click(); }); await sleep(600);
  const hi = await pc1.page.evaluate(() => { const b = document.getElementById('seq-hb'); return { t: b.innerText, img: !!b.querySelector('img'), bold: !!b.querySelector('td b'), h: window.__h }; });
  rec('History: who / what / old → new position', /John Burke/.test(hi.t) && /Moved/.test(hi.t) && /#5 → #4/.test(hi.t) && /Site not ready/.test(hi.t) && /Added/.test(hi.t), hi.t.slice(0, 300));
  rec('History escapes names and reasons', !hi.img && !hi.bold && hi.h === undefined && /<img/.test(hi.t), JSON.stringify({ img: hi.img, bold: hi.bold }));
  rec('History read from project_events (entity seq) only when opened', S.log.filter(x => /project_events/.test(x)).every(x => /entity=eq\.seq/.test(x)) && S.log.some(x => /GET \/project_events/.test(x)));
  await pc1.page.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
  // read-only: All projects → Lucan (with a row) has no controls; 'switching' = read-only everywhere
  X.seqRow(S, 'QL1', 'P2', { wo: 'WO-6', floor: 'A1', unit: '4' });
  await pc1.page.evaluate(async () => { PMALL = true; SEQV.pid = 'P2'; await seqFresh('P2'); render(); }); await sleep(300);
  rec('another PM\'s project: rows shown, no move controls', await pc1.page.evaluate(() => document.querySelectorAll('tr.seq-r').length === 1 && !document.querySelector('[data-sequp],[draggable="true"],#seq-house')));
  await pc1.page.evaluate(() => { PMALL = false; SEQV.pid = 'P1'; DB.listStore = 'switching'; render(); }); await sleep(200);
  rec('lists switching back: the sequence is read-only (no move controls)', await pc1.page.evaluate(() => !!document.getElementById('seq-pg') && !document.querySelector('[data-sequp]')));
  await pc1.page.evaluate(() => { DB.listStore = 'v2'; render(); });
  rec('PC: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  await pc1.close(); await pc2.close();

  // ---- phone 360 px: ▲ ▼ / Move to, no drag handle, no sideways scroll
  const ph = await X.dev(browser, S, 'pm', { viewport: { width: 360, height: 740 }, me: { pm: 'John Burke' } });
  await ph.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(300);
  const sc = await X.noScroll(ph.page);
  const ui = await ph.page.evaluate(() => { const b = document.querySelector('[data-seqdn="QD"]').getBoundingClientRect(); return { hd: getComputedStyle(document.querySelector('.seq-hd')).display, h: b.height, w: b.width }; });
  rec('phone 360 px: no sideways scroll, no drag handle, ▼ big enough to tap', sc.sw <= sc.cw + 1 && ui.hd === 'none' && ui.h >= 40 && ui.w >= 44, JSON.stringify([sc, ui]));
  await ph.page.click('[data-seqdn="QD"]'); await sleep(700);
  rec('phone: ▼ on D moves it down one', ord() === 'QE,QA,QF,QB,QC,QD', ord());
  await ph.page.evaluate(() => { const w = document.getElementById('seq-house'); w.checked = true; w.onchange(); window.__prompt = '1'; }); await ph.page.click('[data-seqto="QD"]'); await sleep(700);
  rec('phone: Whole house + Move to 1 above 🔒 fixed rows → refused (request coming soon), nothing moves', ord() === 'QE,QA,QF,QB,QC,QD' && /Request a change/.test(await ph.page.evaluate(() => document.getElementById('toast').textContent)), ord());
  const sc2 = await X.noScroll(ph.page);
  rec('phone: still no sideways scroll after moving', sc2.sw <= sc2.cw + 1, JSON.stringify(sc2));
  await ph.page.evaluate(() => document.getElementById('seq-hist').click()); await sleep(500);
  const sc3 = await X.noScroll(ph.page);
  rec('phone: History window fits (no sideways scroll)', sc3.sw <= sc3.cw + 1 && await ph.page.evaluate(() => /Moved/.test(document.getElementById('seq-hb').innerText)), JSON.stringify(sc3));
  await ph.close();
  rec('positions in the database are always 1..n with no gaps', X.DS.liveOf(S.db, 'P1').every((r, i) => r.pos === i + 1));
  rec('no page errors anywhere', !(S.errors || []).length, JSON.stringify(S.errors));
  await browser.close();
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
