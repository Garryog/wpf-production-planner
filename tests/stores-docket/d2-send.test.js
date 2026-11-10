// Stores dockets D2: "Send to site" on the Stores screen. Pick the project → only items NOT yet got out (stores + bought-in
// across its WOs), WO / Floor / Unit / Title as separate columns, qty box = what's left; waiting lines greyed; part
// quantities; a second PC with a stale screen is refused per line; free-typed items; switch OFF = typed items only;
// 360 px fits. Fake Supabase only. Run: node tests/stores-docket/d2-send.test.js
const X = require('./fixd.js');
const { H } = X;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 300) : '')); };
const openSend = async (p, pid) => { await p.evaluate(() => document.getElementById('dk-send').click()); await X.sleep(200);
  await p.evaluate(pid => { const s = document.getElementById('dk-proj'); s.value = pid; s.onchange({ target: s }); }, pid); await X.sleep(500); };
const rows = p => p.evaluate(() => [...document.querySelectorAll('[data-dkrow]')].map(tr => ({ id: tr.dataset.dkrow, cls: tr.className, cells: [...tr.children].map(td => td.innerText.trim()), q: (tr.querySelector('[data-dkq]') || {}).value, chk: !!tr.querySelector('[data-dksel]') })));
const setQ = (p, id, v) => p.evaluate(({ id, v }) => { const q = document.querySelector('[data-dkq="' + id + '"]'); q.value = v; q.oninput(); }, { id, v });
const make = async p => { await p.evaluate(() => document.getElementById('dk-make').click()); await X.sleep(700); };
(async () => {
  const browser = await H.chromium.launch();
  const S = X.makeServer();
  const a = await X.dev(browser, S, 'stores');
  await X.catchPrint(a.page);
  rec('Stores screen has a "Send to site" button', await a.page.evaluate(() => !!document.getElementById('dk-send')));
  await openSend(a.page, 'P1');
  let r = await rows(a.page);
  const ids = r.map(x => x.id);
  rec('offers the stores + bought-in lines not yet got out (Tap, Hinge, Worktop, Handle, Plinth clip)', ids.join() === 'L1:2,L1:3,L1:4,L1:5,L1:8', ids.join());
  rec('not offered: saw line, heading, not-needed line', !ids.includes('L1:6') && !ids.includes('L1:1') && !ids.includes('L1:7'));
  const tap = r.find(x => x.id === 'L1:2');
  rec('WO | Floor | Unit | Title in separate columns (WO-1 | GF | 12 | HOUSE WO-1 TYPE B)', tap.cells[1] === 'WO-1' && tap.cells[2] === 'GF' && tap.cells[3] === '12' && tap.cells[4] === 'HOUSE WO-1 TYPE B', JSON.stringify(tap.cells));
  rec('qty box defaults to what is left (20)', tap.q === '20');
  const pl = r.find(x => x.id === 'L1:8');
  rec('waiting line greyed with "Waiting — release first", no tick box', /dk-wait/.test(pl.cls) && !pl.chk && /release first/.test(pl.cells.join(' ')));
  rec('"2x2" line: whole line, no qty box', r.find(x => x.id === 'L1:5').q === undefined && /whole line/.test(r.find(x => x.id === 'L1:5').cells.join(' ')));
  rec('site address defaults to the project\'s', (await a.page.evaluate(() => document.getElementById('dk-site').value)) === 'Site 4, Adamstown, Lucan');
  // B opens the same screen now (it will be stale)
  const b = await X.dev(browser, S, 'stores');
  await openSend(b.page, 'P1');
  // A: 10 taps + a typed item, with delivery instructions
  await setQ(a.page, 'L1:2', '10');
  rec('typing a qty ticks the line', await a.page.evaluate(() => document.querySelector('[data-dksel="L1:2"]').checked));
  await a.page.evaluate(() => { const set = (k, v) => { const e = document.querySelector('[data-dkf="0|' + k + '"]'); e.value = v; e.oninput(); };
    set('wo', 'WO-2'); set('item', 'Spare handles <b>'); set('qty', '4');
    const ins = document.getElementById('dk-instr'); ins.value = 'Block C — ask for Pat'; ins.oninput(); });
  rec('typing a known WO on a typed item fills its Floor and Unit', await a.page.evaluate(() => document.querySelector('[data-dkf="0|floor"]').value === '1' && document.querySelector('[data-dkf="0|unit"]').value === '14'));
  rec('button says "Make docket — 2 items"', /Make docket — 2 items/.test(await a.page.evaluate(() => document.getElementById('dk-make').textContent)));
  await make(a.page);
  const d1 = S.db.t.stores_dockets[0];
  rec('docket D26-0001 made for Aderrig, address + instructions, by Op', d1 && d1.docket_no === 'D26-0001' && d1.project_id === 'P1' && d1.site_address === 'Site 4, Adamstown, Lucan' && d1.delivery_instructions === 'Block C — ask for Pat' && d1.made_by === 'Op', JSON.stringify(d1));
  const its = S.db.t.stores_docket_items;
  rec('items: 10 taps (WO-1, GF, 12) + typed "Spare handles" 4 (WO-2, 1, 14)', its.length === 2 && its[0].line_id === 'L1:2' && its[0].qty === 10 && its[0].floor === 'GF' && its[0].unit === '12' && its[1].kind === 'free' && its[1].item === 'Spare handles <b>' && its[1].qty === 4 && its[1].floor === '1', JSON.stringify(its));
  rec('10 of 20: the tap line is still to pick', X.line(S, 'L1:2').status === 'todo');
  rec('the dialog closes', !(await a.page.evaluate(() => !!document.getElementById('dk-send-dlg'))));
  // reopen: 10 of 20 sent, default 10
  await openSend(a.page, 'P1');
  r = await rows(a.page);
  const tap2 = r.find(x => x.id === 'L1:2');
  rec('reopened: "10 of 20 sent (D26-0001)" and the qty box defaults to 10', tap2.q === '10' && /10 of 20 sent \(D26-0001\)/.test(tap2.cells.join(' ')), JSON.stringify(tap2.cells));
  // B (stale: still thinks 20 left) sends 20 → refused for that line, nothing made
  await setQ(b.page, 'L1:2', '20');
  await make(b.page);
  rec('stale PC: 20 taps refused, nothing made', S.db.t.stores_dockets.length === 1);
  const bad = await b.page.evaluate(() => (document.querySelector('[data-dkrow="L1:2"] .dk-bad') || {}).textContent || '');
  rec('stale PC: the tap line says "more than is left to send — only 10 left (on D26-0001)"', /more than is left to send — only 10 left \(on D26-0001\)/.test(bad), bad);
  rec('stale PC: "Nothing was sent" message', /Nothing was sent/.test(await b.page.evaluate(() => document.getElementById('dk-msg').textContent)));
  // A sends the other 10 + the bought-in worktop → tap got out, worktop keeps its status and drops off
  await a.page.evaluate(() => { document.querySelector('[data-dksel="L1:2"]').click(); document.querySelector('[data-dksel="L1:4"]').click(); });
  await make(a.page);
  rec('the other 10 taps + the worktop: D26-0002; taps got out; worktop keeps its status', S.db.t.stores_dockets.length === 2 && X.line(S, 'L1:2').status === 'got-out' && X.line(S, 'L1:4').status === 'todo');
  await openSend(a.page, 'P1');
  r = await rows(a.page);
  rec('after: taps and worktop no longer offered (fully sent)', !r.some(x => x.id === 'L1:2' || x.id === 'L1:4'), r.map(x => x.id).join());
  rec('the stores bench shows the taps ticked got out', await a.page.evaluate(async () => { await lsPoll(); return !!(lsView('L1').ticks['L1:2']); }));
  await a.page.evaluate(() => document.getElementById('pod-x').click());
  // 360 px: nothing pushes the page sideways
  const n = await X.dev(browser, S, 'stores', { viewport: { width: 360, height: 760 } });
  await openSend(n.page, 'P1');
  const w = await n.page.evaluate(() => { const d = document.querySelector('#dk-send-dlg .pod-in'); return { doc: document.documentElement.scrollWidth, dlg: d.scrollWidth, dlgc: d.clientWidth }; });
  rec('360 px: the dialog fits (no sideways scroll)', w.doc <= 360 && w.dlg <= w.dlgc + 1, JSON.stringify(w));
  await n.page.screenshot({ path: process.env.SHOTS ? process.env.SHOTS + '/send-360.png' : '/dev/null', fullPage: false }).catch(() => {});
  // switch OFF: typed items only, project = the planner's customers
  const S1 = X.makeServer(X.v1Row());
  const o = await X.dev(browser, S1, 'stores');
  await X.catchPrint(o.page);
  await openSend(o.page, 'Aderrig Homes');
  rec('switch OFF: no list lines offered, typed items only', (await rows(o.page)).length === 0 && await o.page.evaluate(() => !!document.querySelector('[data-dkf="0|item"]')));
  await o.page.evaluate(() => { const set = (k, v) => { const e = document.querySelector('[data-dkf="0|' + k + '"]'); e.value = v; e.oninput(); }; set('wo', 'WO-1'); set('item', 'Taps'); set('qty', '20'); });
  await make(o.page);
  const dv = S1.db.t.stores_dockets[0];
  rec('switch OFF: typed docket made under the customer name, no project id', dv && dv.project_id === null && dv.project_name === 'Aderrig Homes' && S1.db.t.stores_docket_items[0].floor === 'GF', JSON.stringify(dv));
  rec('switch OFF: no calls to the cutting-list tables', !X.SD.H || !S1.log.some(x => /^\w+ \/(lists|list_lines|projects|list_events)/.test(x)));
  rec('no page errors', !(S.errors || []).length && !(S1.errors || []).length, JSON.stringify([S.errors, S1.errors]));
  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
