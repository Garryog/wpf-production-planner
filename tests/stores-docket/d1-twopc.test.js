// Stores dockets D1 in the browser: the app's calls to make_docket / docket_delivered / docket_cancel against the fake
// Supabase. Two stores PCs sending the same taps at the same moment → one docket, the other told which docket has them;
// a lost reply resent → still one docket; part quantities; cancel frees the quantity. Run: node tests/stores-docket/d1-twopc.test.js
const X = require('./fixd.js');
const { H } = X;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 300) : '')); };
(async () => {
  const browser = await H.chromium.launch();
  const S = X.makeServer();
  const a = await X.dev(browser, S, 'stores'), b = await X.dev(browser, S, 'stores');
  const make = (p, items, cid) => p.evaluate(({ items, cid }) => dkMake({ project_id: 'P1', site_address: 'Site 4', cid }, items, 'Op').catch(e => ({ err: e.message, lost: !!e.lost })), { items, cid });
  // both PCs tap "Make docket" for all 20 taps at the same moment
  let release; S.holdD = new Promise(r => { release = r; });
  const pa = make(a.page, [{ line_id: 'L1:2', qty: '20', wo: 'WO-1', floor: 'GF', unit: '12' }], 'A1'), pb = make(b.page, [{ line_id: 'L1:2', qty: '20', wo: 'WO-1' }], 'B1');
  await X.sleep(300); S.holdD = null; release();
  const [ra, rb] = await Promise.all([pa, pb]);
  const oks = [ra, rb].filter(r => r.ok), no = [ra, rb].find(r => !r.ok);
  rec('two PCs, same taps, same moment: exactly one docket', oks.length === 1 && S.db.t.stores_dockets.length === 1, JSON.stringify([ra, rb]));
  rec('the other PC is told the taps are already got out on D26-0001', no && no.refused && no.refused[0].why === 'got-out' && no.refused[0].dockets === 'D26-0001', JSON.stringify(no));
  rec('the refusal reads in plain English', no && (await b.page.evaluate(r => dkWhyTxt(r), no.refused[0])) === 'already got out (on D26-0001)');
  rec('the taps line is got out', X.line(S, 'L1:2').status === 'got-out');
  // lost reply: it landed, the PC sends the same tap again → the same docket
  S.dropReply = 1;
  const r1 = await make(a.page, [{ line_id: 'L1:3', qty: '3' }], 'A2');
  rec('lost reply: the app reports it as "may have landed" (lost)', r1.lost === true, JSON.stringify(r1));
  const r2 = await make(a.page, [{ line_id: 'L1:3', qty: '3' }], 'A2');
  rec('resent with the same tap id: the same docket back (dup), no second docket', r2.ok && r2.dup && r2.docket_no === 'D26-0002' && S.db.t.stores_dockets.length === 2, JSON.stringify(r2));
  // part quantities on the hinge (8): 3 sent, 5 left; 6 refused; 5 OK
  const r3 = await make(b.page, [{ line_id: 'L1:3', qty: '6' }], 'B3');
  rec('part qty: 6 more of the 8 hinges refused (only 5 left)', !r3.ok && r3.refused[0].why === 'too-many' && r3.refused[0].left === 5, JSON.stringify(r3));
  const sent = await b.page.evaluate(() => dkSentFor(['L1:2', 'L1:3']));
  rec('dkSentFor: taps 20 sent on D26-0001, hinges 3 on D26-0002', sent['L1:2'].n === 20 && sent['L1:3'].n === 3 && sent['L1:3'].dk.join() === 'D26-0002', JSON.stringify(sent));
  const r4 = await make(b.page, [{ line_id: 'L1:3', qty: '5' }], 'B4');
  rec('part qty: the last 5 OK → hinges got out', r4.ok && X.line(S, 'L1:3').status === 'got-out');
  // waiting line refused
  const r5 = await make(a.page, [{ line_id: 'L1:8', qty: '12' }], 'A5');
  rec('waiting line refused: "waiting on stock — release it first"', !r5.ok && (await a.page.evaluate(r => dkWhyTxt(r), r5.refused[0])) === 'waiting on stock — release it first');
  // cancel frees the quantity
  const d2 = S.db.t.stores_dockets.find(x => x.docket_no === 'D26-0002');
  const c = await a.page.evaluate(id => dkCancel(id, 'Wrong count', 'Op', false), d2.id);
  rec('cancel D26-0002: hinges back to to-pick, 3 free again', c.ok && X.line(S, 'L1:3').status === 'todo' && (await a.page.evaluate(() => dkSentFor(['L1:3'])))['L1:3'].n === 5);
  const dl = await a.page.evaluate(id => dkDelivered(id, 'Joe Site', '2026-10-22', '', 'Op'), S.db.t.stores_dockets[0].id);
  rec('delivered: received by Joe Site', dl.ok && S.db.t.stores_dockets[0].received_by === 'Joe Site');
  const all = await a.page.evaluate(() => dkLoad());
  rec('dkLoad: dockets newest first with their items', all.length === 3 && all.map(d => d.docket_no).join() === 'D26-0003,D26-0002,D26-0001' && all.every(d => Array.isArray(d.items) && d.items.length >= 1), JSON.stringify(all.map(d => d.docket_no)));
  rec('the app never writes the docket tables directly (no direct POST/PATCH/DELETE)', !S.deniedD && !S.log.some(x => /^(POST|PATCH|DELETE) \/stores_/.test(x)));
  // no docket tables yet (SQL not run): a plain message
  S.noDocketTables = true;
  const m = await a.page.evaluate(() => dkLoad().then(() => 'loaded', e => dkErr(e)));
  rec('SQL not run yet: "The docket tables aren\'t set up … SUPABASE_CHANGES.md"', /aren't set up/.test(m), m);
  rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
