// Tester round 5, attack 1 on Stores dockets (feature/stores-dockets). Browser + fake Supabase only (never live).
// Two PCs 15 + 10 of 20; cancel racing a send; bench untick after a docket; switch moving mid-docket; lost reply resend
// from the screen; lost reply then an edit; year change; delivered can't be cancelled (stale screen); free items with
// the switch OFF; Items sent Excel = screen; multi-WO Floor/Unit; long text at 360 px; HTML shown as text; bench N/A.
// Run: node tests/stores-docket/attack1-dockets.test.js
const X = require('./fixd.js');
const { H, D, DD } = X;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + String(d).slice(0, 400))); };
const J = JSON.stringify;
const make = (p, items, cid) => p.evaluate(({ items, cid }) => dkMake({ project_id: 'P1', cid }, items, 'Op').catch(e => ({ err: e.message, lost: !!e.lost })), { items, cid });
const openSend = async (p, pid) => { await p.evaluate(() => document.getElementById('dk-send').click()); await X.sleep(200);
  await p.evaluate(pid => { const s = document.getElementById('dk-proj'); s.value = pid; s.onchange({ target: s }); }, pid); await X.sleep(500); };
const setQ = (p, id, v) => p.evaluate(({ id, v }) => { const q = document.querySelector('[data-dkq="' + id + '"]'); q.value = v; q.oninput(); }, { id, v });
const setF = (p, k, v, i = 0) => p.evaluate(({ k, v, i }) => { const e = document.querySelector('[data-dkf="' + i + '|' + k + '"]'); e.value = v; e.oninput(); }, { k, v, i });
const clickMake = async p => { await p.evaluate(() => document.getElementById('dk-make').click()); await X.sleep(700); };
const msg = p => p.evaluate(() => (document.getElementById('dk-msg') || {}).textContent || '');
const active = (S, lid) => S.db.t.stores_docket_items.filter(i => i.line_id === lid && i.active).reduce((s, i) => s + (+i.qty || 0), 0);
(async () => {
  const browser = await H.chromium.launch();
  // ---------- A1: two PCs, 15 + 10 of 20 taps at the same moment
  {
    const S = X.makeServer();
    const a = await X.dev(browser, S, 'stores'), b = await X.dev(browser, S, 'stores');
    let rel; S.holdD = new Promise(r => { rel = r; });
    const pa = make(a.page, [{ line_id: 'L1:2', qty: '15' }], 'A1'), pb = make(b.page, [{ line_id: 'L1:2', qty: '10' }], 'B1');
    await X.sleep(300); S.holdD = null; rel();
    const [ra, rb] = await Promise.all([pa, pb]);
    const ok = [ra, rb].filter(r => r.ok), no = [ra, rb].find(r => !r.ok);
    rec('A1 15 + 10 of 20 at once: one docket, the other refused', ok.length === 1 && !!no && S.db.t.stores_dockets.length === 1, J([ra, rb]));
    const txt = no ? await b.page.evaluate(r => dkWhyTxt(r), no.refused[0]) : '';
    rec('A1 the refusal names what is left and the docket', /more than is left to send — only (5|10) left \(on D26-0001\)/.test(txt), txt);
    rec('A1 never more than 20 sent; line still to pick', active(S, 'L1:2') <= 20 && X.line(S, 'L1:2').status === 'todo', active(S, 'L1:2'));
    // ---------- A2: cancel racing a send of the rest
    const d1 = S.db.t.stores_dockets[0], left = 20 - active(S, 'L1:2');
    S.holdD = new Promise(r => { rel = r; });
    const pc = a.page.evaluate(id => dkCancel(id, 'wrong', 'Op'), d1.id), ps = make(b.page, [{ line_id: 'L1:2', qty: String(left) }], 'B2');
    await X.sleep(300); S.holdD = null; rel();
    const [rc, rs] = await Promise.all([pc, ps]);
    const sent = active(S, 'L1:2'), st = X.line(S, 'L1:2').status;
    rec('A2 cancel racing a send: both answered, sent-so-far and status agree (got out only if all 20 sent)', rc.ok && rs.ok && ((sent >= 20) === (st === 'got-out')), J({ rc, rs, sent, st }));
    // ---------- A3: docket marks taps got out, bench unticks, then the docket is cancelled
    const S2 = X.makeServer(); const s = await X.dev(browser, S2, 'stores');
    const r0 = await make(s.page, [{ line_id: 'L1:2', qty: '20' }], 'S1');
    rec('A3 docket for all 20: taps got out', r0.ok && X.line(S2, 'L1:2').status === 'got-out');
    await s.page.evaluate(async () => { await lsPoll(); render(); });
    const t1 = await X.F3.tapRow(s.page, 'data-rt', 'L1:2'); await X.F3.send(s.page); await s.page.evaluate(async () => { await lsPoll(); });
    rec('A3 bench untick of a docketed line goes through (or is refused) without error', t1 === 'ok' && !(S2.errors || []).length, t1 + J(S2.errors));
    const stU = X.line(S2, 'L1:2').status;
    await openSend(s.page, 'P1');
    const offered = await s.page.evaluate(() => [...document.querySelectorAll('[data-dkrow]')].map(r => r.dataset.dkrow));
    rec('A3 after the untick the 20 taps are NOT offered again (already on D26-0001)', !offered.includes('L1:2'), stU + ' ' + offered.join());
    await s.page.evaluate(() => document.getElementById('pod-x') && document.getElementById('pod-x').click());
    // bench ticks it again (picked by hand), then cancel the docket → the hand tick stays
    const t2 = await X.F3.tapRow(s.page, 'data-rt', 'L1:2'); await X.F3.send(s.page);
    const c = await s.page.evaluate(id => dkCancel(id, 'oops', 'Op'), S2.db.t.stores_dockets[0].id);
    rec('A3 re-ticked by hand then docket cancelled: the hand tick (got out) stays', t2 === 'ok' && c.ok && X.line(S2, 'L1:2').status === 'got-out', t2 + ' ' + X.line(S2, 'L1:2').status);
    // ---------- A3b: the Items sent report must not count the taps twice (15 on a docket + the bench tick of the whole line)
    const S3 = X.makeServer(); const r3 = await X.dev(browser, S3, 'stores');
    await make(r3.page, [{ line_id: 'L1:2', qty: '15' }], 'R1');
    await r3.page.evaluate(async () => { await lsPoll(); render(); });
    await X.F3.tapRow(r3.page, 'data-rt', 'L1:2'); await X.F3.send(r3.page);
    const rows = await r3.page.evaluate(async () => { await lsPoll(); const pr = dkProjChoices().find(p => p.id === 'P1'); return dkReportRows(pr, '2026-10-01', '2026-10-31'); });
    const taps = rows.filter(r => r.item === 'Tap'), tq = taps.reduce((s, r) => s + (+r.qty || 0), 0);
    rec('A3b Items sent: 15 taps on a docket then the rest ticked on the bench → report totals 20 taps, not more', tq <= 20, J(taps.map(r => [r.docket, r.qty])) + ' total ' + tq);
    // ---------- A4: switch moves to 'switching' while Make docket is in flight
    const S4 = X.makeServer(); const m = await X.dev(browser, S4, 'stores');
    await openSend(m.page, 'P1'); await setQ(m.page, 'L1:3', '8');
    S4.holdD = new Promise(r => { rel = r; });
    const pm = clickMake(m.page); await X.sleep(200);
    S4.row.settings.listStore = 'switching'; S4.holdD = null; rel(); await pm; await X.sleep(300);
    const mm = await msg(m.page);
    rec('A4 switch moving mid-docket: no docket, a clear "not made" message, not "may have been made"', S4.db.t.stores_dockets.length === 0 && /Not made/.test(mm) && !/may have been made/.test(mm), mm);
    rec('A4 the message is plain English (no "lists_switch_on" / SQL words)', !/lists_switch_on|P0001|exception/.test(mm) && mm.length < 200, mm);
    // ---------- A5: lost reply on the screen → tap again → the SAME docket number, nothing twice
    const S5 = X.makeServer(); const l = await X.dev(browser, S5, 'stores'); await X.catchPrint(l.page);
    await openSend(l.page, 'P1'); await setQ(l.page, 'L1:3', '8'); await setF(l.page, 'item', 'Spare handles'); await setF(l.page, 'qty', '4');
    S5.dropReply = 1; await clickMake(l.page);
    const lm = await msg(l.page);
    rec('A5 lost reply: "No reply … Tap Make docket again: it will NOT make a second one"', /No reply/.test(lm) && S5.db.t.stores_dockets.length === 1, lm);
    await clickMake(l.page);
    rec('A5 tapped again: one docket D26-0001, the typed item once, the dialog closes and prints', S5.db.t.stores_dockets.length === 1 && S5.db.t.stores_docket_items.filter(i => i.kind === 'free').length === 1
      && !(await l.page.evaluate(() => !!document.getElementById('dk-send-dlg'))) && (await X.printed(l.page)).some(h => /D26-0001/.test(h)), J(S5.db.t.stores_dockets.map(d => d.docket_no)));
    // A5b lost reply, then the user changes the typed qty and taps again (only typed items)
    const S6 = X.makeServer(X.v1Row()); const v = await X.dev(browser, S6, 'stores'); await X.catchPrint(v.page);
    await openSend(v.page, 'Aderrig Homes'); await setF(v.page, 'wo', 'WO-1'); await setF(v.page, 'item', 'Taps'); await setF(v.page, 'qty', '20');
    S6.dropReply = 1; await clickMake(v.page);
    await setF(v.page, 'qty', '21'); await clickMake(v.page);
    rec('A5b lost reply then an edit then Make again: the typed items are not put on two dockets (D26-0001 and D26-0002)', S6.db.t.stores_dockets.length === 1, J(S6.db.t.stores_dockets.map(d => d.docket_no)) + ' items ' + J(S6.db.t.stores_docket_items.map(i => i.item + ' ' + i.qty)));
    // ---------- A6: numbering across the year change (fake mirrors SQL: Irish year)
    const db = DD.makeDb(); let clk = new Date('2026-12-31T23:59:30Z'); db.clock = () => clk;
    D.insert(db, 'projects', { id: 'P1', name: 'Aderrig' });
    const f = () => DD.RPC.make_docket(db, { p_docket: { project_id: 'P1' }, p_items: [{ item: 'x', qty: '1' }], p_by: 'Op' });
    const n1 = f().docket_no, n2 = f().docket_no; clk = new Date('2027-01-01T00:00:10Z'); const n3 = f().docket_no, n4 = f().docket_no;
    clk = new Date('2027-06-30T23:30:00Z'); const n5 = f().docket_no; // 00:30 Irish summer time on 1 July — still 2027
    rec('A6 D26-0001, D26-0002, then D27-0001, D27-0002, D27-0003', [n1, n2, n3, n4, n5].join() === 'D26-0001,D26-0002,D27-0001,D27-0002,D27-0003', [n1, n2, n3, n4, n5].join());
    // ---------- A7: a stale Dockets screen tries to cancel a docket another PC marked delivered
    const S7 = X.makeServer(); const p1 = await X.dev(browser, S7, 'stores'), p2 = await X.dev(browser, S7, 'stores');
    await make(p1.page, [{ line_id: 'L1:3', qty: '8' }], 'C1');
    await p1.page.evaluate(() => document.getElementById('dk-list').click()); await X.sleep(500);
    await p2.page.evaluate(id => dkDelivered(id, 'Joe', '2026-10-21', '', 'Op'), S7.db.t.stores_dockets[0].id);
    await p1.page.evaluate(() => { window.prompt = () => 'wrong'; document.querySelector('[data-dkcan]').click(); }); await X.sleep(800);
    const m7 = await p1.page.evaluate(() => document.getElementById('dkl-msg').textContent + ' | ' + document.getElementById('dk-list-dlg').innerText);
    rec('A7 stale screen: delivered docket NOT cancelled, told "already marked delivered" (the message must not be wiped by the reload), shows DELIVERED, no Cancel button now', S7.db.t.stores_dockets[0].status === 'delivered' && /already marked delivered/.test(m7) && /DELIVERED/.test(m7)
      && !(await p1.page.evaluate(() => !!document.querySelector('[data-dkcan]'))) && X.line(S7, 'L1:3').status === 'got-out', m7.slice(0, 300));
    // ---------- A8: switch OFF typed docket with HTML, long text, cancel and deliver work; Items sent Excel = screen
    const S8 = X.makeServer(X.v1Row()); const o = await X.dev(browser, S8, 'stores', { viewport: { width: 360, height: 760 } }); await X.catchPrint(o.page);
    const long = 'Spare handle bar brushed steel 320mm centres '.repeat(6) + '<img src=x onerror="window.__x=1">';
    await openSend(o.page, 'Aderrig Homes'); await setF(o.page, 'wo', 'WO-1'); await setF(o.page, 'item', long); await setF(o.page, 'qty', '4'); await setF(o.page, 'spec', '<script>window.__x=2</script>O\'Grady "x" 😀');
    await o.page.evaluate(() => { const e = document.getElementById('dk-instr'); e.value = '<b>Block C</b>'; e.oninput(); });
    const w0 = await o.page.evaluate(() => document.documentElement.scrollWidth);
    await clickMake(o.page);
    const pr = (await X.printed(o.page)).join('');
    rec('A8 switch OFF: typed docket made; printout shows the HTML as text (no tag, no script)', S8.db.t.stores_dockets.length === 1 && /&lt;img src=x/.test(pr) && !/<img src=x/.test(pr) && !/<script>window.__x/.test(pr) && /&lt;b>Block C/.test(pr), pr.slice(0, 200));
    rec('A8 Floor and Unit are separate columns on the printed docket (GF | 12)', /<th>Floor<\/th><th>Unit<\/th>/.test(pr) && /<td>GF<\/td><td>12<\/td>/.test(pr));
    await o.page.evaluate(() => document.getElementById('dk-list').click()); await X.sleep(500);
    await o.page.evaluate(() => document.querySelector('[data-dkopen]').click()); await X.sleep(200);
    const w1 = await o.page.evaluate(() => { const d = document.querySelector('#dk-list-dlg .pod-in') || document.querySelector('#dk-list-dlg'); return { doc: document.documentElement.scrollWidth, sw: d.scrollWidth, cw: d.clientWidth }; });
    rec('A8 360 px: Send dialog and opened Dockets list with long typed text fit (no sideways scroll)', w0 <= 360 && w1.doc <= 360 && w1.sw <= w1.cw + 1, J({ w0, w1 }));
    rec('A8 no script ran from typed text', !(await o.page.evaluate(() => window.__x)));
    // deliver with switch OFF
    await o.page.evaluate(() => document.querySelector('[data-dkdel]').click()); await X.sleep(100);
    await o.page.evaluate(() => { document.getElementById('dkv-by').value = '<i>Pat</i>'; document.querySelector('[data-dkvok]').click(); }); await X.sleep(800);
    rec('A8 switch OFF: marked delivered; "received by" shown as text', S8.db.t.stores_dockets[0].status === 'delivered' && await o.page.evaluate(() => /<i>Pat<\/i>/.test(document.getElementById('dk-list-dlg').innerText)));
    // report → Excel rows = screen rows
    await o.page.evaluate(() => { window.__xl = null; XLSX.writeFile = (wb) => { const ws = wb.Sheets[wb.SheetNames[0]]; window.__xl = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false }); }; });
    await o.page.evaluate(() => { document.getElementById('dk-list-dlg').remove(); document.getElementById('dk-rep').click(); }); await X.sleep(200);
    await o.page.evaluate(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.onchange({ target: e }); }; set('dkr-from', '2026-10-01'); set('dkr-to', '2026-12-31'); set('dkr-proj', 'Aderrig Homes'); }); await X.sleep(800);
    await o.page.evaluate(() => document.getElementById('dkr-xls').click()); await X.sleep(200);
    const cmp = await o.page.evaluate(() => { const scr = [...document.querySelectorAll('#dk-rep-dlg tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim())); return { scr, xl: window.__xl }; });
    const norm = r => r.map(v => String(v == null ? '' : v).trim().replace(/^—$/, ''));
    rec('A8 Items sent: Excel has the same rows as the screen (and the header)', cmp.xl && cmp.xl.length === cmp.scr.length + 1 && cmp.scr.every((r, i) => J(norm(r)) === J(norm(cmp.xl[i + 1]))), J(cmp).slice(0, 600));
    // ---------- A9: a list covering several WOs: Floor and Unit must stay paired with their WO
    const S9 = X.makeServer(); S9.row.orders.push(H.order({ wo: 'WO-3', customer: 'Aderrig Homes', dueDate: '2026-10-22', origDueDate: '2026-10-22' }));
    S9.row.orders.forEach(x => { if (x.wo === 'WO-1') { x.floor = 'GF'; x.unit = '12'; } if (x.wo === 'WO-2') { x.floor = 'GF'; x.unit = '14'; } if (x.wo === 'WO-3') { x.floor = '1'; x.unit = '15'; x.title = 'T3'; } });
    D.update(S9.db, 'lists', D.find(S9.db, 'lists', 'L1'), { wos: ['WO-1', 'WO-2', 'WO-3'] });
    const q = await X.dev(browser, S9, 'stores');
    await openSend(q.page, 'P1');
    const cells = await q.page.evaluate(() => { const tr = document.querySelector('[data-dkrow="L1:2"]'); return [...tr.children].slice(1, 4).map(td => td.innerText.trim()); });
    rec('A9 list on WO-1/2/3 (GF·12, GF·14, 1·15): each Floor still lines up with its WO (3 floors for 3 WOs)', cells[1].split(',').length === cells[0].split(',').length, J(cells));
    // ---------- A10: Stores bench unchanged — N/A → Waiting in one tap, Release all brings it back
    const S10 = X.makeServer(); const bn = await X.dev(browser, S10, 'stores');
    const na = await X.F3.tapRow(bn.page, 'data-rna', 'L1:3'); await X.F3.send(bn.page);
    rec('A10 bench: N/A → Waiting in one tap still works with the docket bar', na === 'ok' && X.line(S10, 'L1:3').status === 'waiting', na + ' ' + X.line(S10, 'L1:3').status);
    rec('A10 bench: the docket bar has all three buttons and no page errors anywhere', await bn.page.evaluate(() => ['dk-send', 'dk-list', 'dk-rep'].every(id => !!document.getElementById(id)))
      && ![S, S2, S3, S4, S5, S6, S7, S8, S9, S10].some(x => (x.errors || []).length), J([S, S2, S3, S4, S5, S6, S7, S8, S9, S10].map(x => x.errors || [])));
  }
  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
