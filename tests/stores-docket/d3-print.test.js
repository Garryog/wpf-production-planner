// Stores dockets D3: the printed docket (A4). Docket no., date, project, customer, site address, delivery instructions,
// items as WO | Floor | Unit | Item | Qty | Spec (Floor and Unit apart), sent by, the "received by / print name /
// signature / date" block; typed text escaped; a cancelled docket prints CANCELLED. Run: node tests/stores-docket/d3-print.test.js
const X = require('./fixd.js');
const { H } = X;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 300) : '')); };
(async () => {
  const browser = await H.chromium.launch();
  const S = X.makeServer();
  const a = await X.dev(browser, S, 'stores');
  await X.catchPrint(a.page);
  // through the screen: 10 of 20 taps + a typed item with HTML in it
  await a.page.evaluate(() => document.getElementById('dk-send').click()); await X.sleep(200);
  await a.page.evaluate(() => { const s = document.getElementById('dk-proj'); s.value = 'P1'; s.onchange({ target: s }); }); await X.sleep(500);
  await a.page.evaluate(() => { const q = document.querySelector('[data-dkq="L1:2"]'); q.value = '10'; q.oninput();
    const set = (k, v) => { const e = document.querySelector('[data-dkf="0|' + k + '"]'); e.value = v; e.oninput(); };
    set('wo', 'WO-2'); set('item', '<img src=x onerror=alert(1)>Spare'); set('qty', '4'); set('spec', 'Matt black');
    const si = document.getElementById('dk-site'); si.value = 'Site 4, Adamstown\nLucan, Co. Dublin'; si.oninput();
    const ins = document.getElementById('dk-instr'); ins.value = 'Block C — ask for Pat'; ins.oninput();
    document.getElementById('dk-make').click(); });
  await X.sleep(900);
  const html = (await X.printed(a.page))[0] || '';
  rec('making a docket opens its print page', html.length > 500);
  rec('docket number and date', /D26-0001/.test(html) && /21 Oct 2026|\d{1,2} \w{3} 2026/.test(html));
  rec('project, customer, site address (two lines), delivery instructions', /Aderrig/.test(html) && /Aderrig Homes/.test(html) && /Site 4, Adamstown<br>Lucan, Co\. Dublin/.test(html) && /Block C — ask for Pat/.test(html));
  rec('items table columns: WO | Floor | Unit | Item | Qty | Spec', /<th>WO<\/th><th>Floor<\/th><th>Unit<\/th><th>Item<\/th><th class="n">Qty<\/th><th>Spec<\/th>/.test(html));
  rec('tap row: WO-1 | GF | 12 | Tap | 10 | Chrome mixer', /<td class="m">WO-1<\/td><td>GF<\/td><td>12<\/td><td><b>Tap<\/b>.*?<\/td><td class="n">10<\/td><td>Chrome mixer<\/td>/.test(html));
  rec('typed item row: WO-2 | 1 | 14 | … | 4 | Matt black', /<td class="m">WO-2<\/td><td>1<\/td><td>14<\/td>.*?<td class="n">4<\/td><td>Matt black<\/td>/.test(html));
  rec('typed text is escaped (no live <img>)', !/<img src=x/.test(html) && /&lt;img src=x/.test(html));
  rec('sent by Op', /Sent by:<\/b> Op/.test(html));
  rec('received block: print name, signature, date (blank until delivered)', /Received by \(print name\):/.test(html) && /Signature:/.test(html) && /<span>Date:<\/span><b><\/b>/.test(html));
  rec('A4 portrait print page', /@page\{size:A4 portrait/.test(html));
  // delivered and cancelled versions
  const d = S.db.t.stores_dockets[0];
  await a.page.evaluate(id => dkDelivered(id, 'Joe Site', '2026-10-22', 'J. Site', 'Op'), d.id);
  const h2 = await a.page.evaluate(async id => dkDocketHTML((await dkLoad('&id=eq.' + id))[0]), d.id);
  rec('delivered docket prints the received-by name and date', /Joe Site/.test(h2) && /22 Oct 2026/.test(h2) && /signed: J\. Site/.test(h2));
  const r2 = await a.page.evaluate(() => dkMake({ project_id: 'P1' }, [{ item: 'Bin', qty: '1' }], 'Op'));
  await a.page.evaluate(id => dkCancel(id, 'Typed twice', 'Op', false), r2.id);
  const h3 = await a.page.evaluate(async id => dkDocketHTML((await dkLoad('&id=eq.' + id))[0]), r2.id);
  rec('cancelled docket prints CANCELLED with the reason, items still listed', /class="wm">CANCELLED/.test(h3) && /Typed twice/.test(h3) && /<b>Bin<\/b>/.test(h3));
  rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
