// Coder, Tester round 5 fixes (feature/stores-dockets). Browser + fake Supabase only (never live).
// A5b: a lost reply on Make docket, then an edit, then Make again → the database is asked first; if the docket landed it is
//      printed and the person told (picked lines are not reported "Nothing was sent"); if it did not land, the new docket
//      goes under the same tap id; if the check itself gets no reply, nothing new is sent.
// A7:  "Not cancelled — …" survives the reload.   A9: Floor / Unit listed one per WO, paired, "—" for a blank one.
// Run: node tests/stores-docket/coder-r5.test.js
const X = require('./fixd.js');
const { H, D } = X;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + String(d).slice(0, 400))); };
const J = JSON.stringify;
const openSend = async (p, pid) => { await p.evaluate(() => document.getElementById('dk-send').click()); await X.sleep(200);
  await p.evaluate(pid => { const s = document.getElementById('dk-proj'); s.value = pid; s.onchange({ target: s }); }, pid); await X.sleep(500); };
const setQ = (p, id, v) => p.evaluate(({ id, v }) => { const q = document.querySelector('[data-dkq="' + id + '"]'); q.value = v; q.oninput(); }, { id, v });
const setF = (p, k, v, i = 0) => p.evaluate(({ k, v, i }) => { const e = document.querySelector('[data-dkf="' + i + '|' + k + '"]'); e.value = v; e.oninput(); }, { k, v, i });
const clickMake = async p => { await p.evaluate(() => document.getElementById('dk-make').click()); await X.sleep(700); };
const msg = p => p.evaluate(() => (document.getElementById('dk-msg') || {}).textContent || '');
const dlg = p => p.evaluate(() => !!document.getElementById('dk-send-dlg'));
(async () => {
  const browser = await H.chromium.launch();
  const all = [];
  // 1. picked line: lost reply, change the qty, Make again → told D26-0001 was made, printed, nothing sent twice, no "Nothing was sent"
  {
    const S = X.makeServer(); all.push(S); const a = await X.dev(browser, S, 'stores'); await X.catchPrint(a.page);
    await openSend(a.page, 'P1'); await setQ(a.page, 'L1:2', '10');
    S.dropReply = 1; await clickMake(a.page);
    await setQ(a.page, 'L1:2', '12'); await clickMake(a.page);
    const m = await msg(a.page), pr = (await X.printed(a.page)).join('');
    rec('1 picked line, lost reply then edit: still one docket, 10 sent', S.db.t.stores_dockets.length === 1 && S.db.t.stores_docket_items.filter(i => i.active).reduce((s, i) => s + +i.qty, 0) === 10, J(S.db.t.stores_docket_items));
    rec('1 told the docket HAD been made, changes not sent — not "Nothing was sent"', /D26-0001 HAD been made/.test(m) && /NOT sent/.test(m) && !/Nothing was sent/.test(m), m);
    rec('1 the docket that landed is printed; the dialog stays open showing what is left (10 of 20 sent)', /D26-0001/.test(pr) && await dlg(a.page)
      && await a.page.evaluate(() => /10 of 20 sent/.test(document.querySelector('[data-dkrow="L1:2"]').innerText)), m);
    rec('1 the tap after that is a NEW docket (not stuck on the old one): 5 more → D26-0002', await (async () => { await setQ(a.page, 'L1:2', '5'); await clickMake(a.page);
      return S.db.t.stores_dockets.length === 2 && S.db.t.stores_dockets[1].docket_no === 'D26-0002'; })(), J(S.db.t.stores_dockets.map(d => d.docket_no)));
  }
  // 2. typed item: lost reply, change qty, Make again → typed rows cleared, told, printed
  {
    const S = X.makeServer(X.v1Row()); all.push(S); const v = await X.dev(browser, S, 'stores'); await X.catchPrint(v.page);
    await openSend(v.page, 'Aderrig Homes'); await setF(v.page, 'wo', 'WO-1'); await setF(v.page, 'item', 'Taps'); await setF(v.page, 'qty', '20');
    S.dropReply = 1; await clickMake(v.page);
    await setF(v.page, 'qty', '21'); await clickMake(v.page);
    const m = await msg(v.page);
    rec('2 typed: one docket with Taps 20, told it was made, typed rows cleared', S.db.t.stores_dockets.length === 1 && S.db.t.stores_docket_items.length === 1 && S.db.t.stores_docket_items[0].qty_text === '20'
      && /HAD been made/.test(m) && await v.page.evaluate(() => document.querySelector('[data-dkf="0|item"]').value === ''), m);
  }
  // 3. the first tap never reached the database: edit, Make again → made once, with the edit, under the first tap id
  {
    const S = X.makeServer(X.v1Row()); all.push(S); const v = await X.dev(browser, S, 'stores'); await X.catchPrint(v.page);
    await openSend(v.page, 'Aderrig Homes'); await setF(v.page, 'item', 'Taps'); await setF(v.page, 'qty', '20');
    S.offlineD = true; await clickMake(v.page); const m1 = await msg(v.page);
    S.offlineD = false; await setF(v.page, 'qty', '21'); await clickMake(v.page);
    rec('3 not landed: the next tap makes ONE docket with the edited qty 21, dialog closes', S.db.t.stores_dockets.length === 1 && S.db.t.stores_docket_items[0].qty_text === '21' && !(await dlg(v.page)), m1 + ' | ' + J(S.db.t.stores_docket_items));
    rec('3 the database was asked first (a docket read by cid before the second make_docket)', S.log.some(x => /^GET \/stores_dockets\?.*cid=eq\./.test(x)), J(S.log.filter(x => /stores_dockets|make_docket/.test(x))));
  }
  // 4. the check itself gets no reply → nothing new is sent, plain message; then it lands → one docket
  {
    const S = X.makeServer(X.v1Row()); all.push(S); const v = await X.dev(browser, S, 'stores'); await X.catchPrint(v.page);
    await openSend(v.page, 'Aderrig Homes'); await setF(v.page, 'item', 'Taps'); await setF(v.page, 'qty', '20');
    S.dropReply = 1; await clickMake(v.page);
    await setF(v.page, 'qty', '22'); S.offlineD = true; await clickMake(v.page); const m = await msg(v.page);
    const n = (S.rpcCalls || []).filter(c => c.fn === 'make_docket').length;
    rec('4 the check gets no reply: no second make_docket sent, told to try again', n === 1 && /can't check yet/.test(m) && S.db.t.stores_dockets.length === 1, m + ' calls ' + n);
    S.offlineD = false; await clickMake(v.page);
    rec('4 signal back: still one docket, told it had been made', S.db.t.stores_dockets.length === 1 && /HAD been made/.test(await msg(v.page)));
  }
  // 5. A7: delivered on another PC → "already marked delivered" kept; network failure → "Not cancelled — No connection" kept
  {
    const S = X.makeServer(); all.push(S); const p = await X.dev(browser, S, 'stores');
    await p.page.evaluate(() => dkMake({ project_id: 'P1', cid: 'Z1' }, [{ line_id: 'L1:3', qty: '8' }], 'Op'));
    await p.page.evaluate(() => document.getElementById('dk-list').click()); await X.sleep(500);
    S.offlineD = true;
    await p.page.evaluate(() => { window.prompt = () => 'wrong'; document.querySelector('[data-dkcan]').click(); document.querySelector('#dk-left [data-dkleft="0"]').click(); }); await X.sleep(800);
    const m = await p.page.evaluate(() => document.getElementById('dkl-msg').textContent);
    rec('5 cancel with no connection: "Not cancelled — No connection…" still shown after the reload', /^Not cancelled — No connection/.test(m) && S.db.t.stores_dockets[0].status === 'made', m);
    S.offlineD = false;
    await p.page.evaluate(() => { document.querySelector('[data-dkcan]').click(); document.querySelector('#dk-left [data-dkleft="0"]').click(); }); await X.sleep(800);
    const m2 = await p.page.evaluate(() => document.getElementById('dkl-msg').textContent);
    rec('5 cancelled once the signal is back: the old message is cleared', S.db.t.stores_dockets[0].status === 'cancelled' && m2 === '', m2);
  }
  // 6. A9: list on WO-1 (GF·12), WO-2 (no floor·14), WO-3 (1·15) → "GF, —, 1" / "12, 14, 15", on screen, docket and Items sent
  {
    const S = X.makeServer(); all.push(S); S.row.orders.push(H.order({ wo: 'WO-3', customer: 'Aderrig Homes', dueDate: '2026-10-22', origDueDate: '2026-10-22' }));
    S.row.orders.forEach(x => { if (x.wo === 'WO-1') { x.floor = 'GF'; x.unit = '12'; } if (x.wo === 'WO-2') { x.floor = ''; x.unit = '14'; } if (x.wo === 'WO-3') { x.floor = '1'; x.unit = '15'; } });
    D.update(S.db, 'lists', D.find(S.db, 'lists', 'L1'), { wos: ['WO-1', 'WO-2', 'WO-3'] });
    const q = await X.dev(browser, S, 'stores'); await X.catchPrint(q.page);
    await openSend(q.page, 'P1');
    const cells = await q.page.evaluate(() => [...document.querySelector('[data-dkrow="L1:2"]').children].slice(1, 4).map(td => td.innerText.trim()));
    rec('6 Send screen: WO-1, WO-2, WO-3 | GF, —, 1 | 12, 14, 15', J(cells) === J(['WO-1, WO-2, WO-3', 'GF, —, 1', '12, 14, 15']), J(cells));
    await setQ(q.page, 'L1:2', '20'); await clickMake(q.page);
    const it = S.db.t.stores_docket_items[0] || {};
    const pr = (await X.printed(q.page)).join('');
    rec('6 docket item and print keep the pairing', it.floor === 'GF, —, 1' && it.unit === '12, 14, 15' && /<td>GF, —, 1<\/td><td>12, 14, 15<\/td>/.test(pr), J(it));
  }
  rec('no page errors', !all.some(S => (S.errors || []).length), J(all.map(S => S.errors || [])));
  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
