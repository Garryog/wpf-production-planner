// Tester attack round 1 on Part 2 step 2 (B5): PM assignment (two PCs at once, names with apostrophes / HTML / emoji),
// pick-your-name once per device, a PM acting on another PM's project (directly and on a stale screen after being
// reassigned), PM Deliveries filter vs customers not linked to a project, the Pre-production role/PIN plumbing, the three
// Settings numbers (bad values, reload, two PCs), the lists switch going off / 'switching' mid-session, and the probe
// failing on the network. Fake Supabase only. Run: node tests/seq/attack1-assign.test.js
const X = require('./fixs.js');
const { H, rec, sleep } = X;
const toastOf = p => p.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
const NAMES = [{ id: 'S1', n: "Seán O'Grady", r: ['pm'] }, { id: 'S2', n: 'Mary <b>Kelly</b> 🏗', r: ['pm'] }, { id: 'S3', n: 'Johnny', r: ['pre'] }, { id: 'S4', n: 'Ann Office', r: ['office'] }];
(async () => {
  const browser = await H.chromium.launch();

  // ================= A. names with an apostrophe, HTML and emoji
  {
    const S = X.makeServer(X.v2Row({ staff: NAMES }));
    const of = await X.dev(browser, S, 'office');
    await of.page.evaluate(() => { showTab('l'); lsProjectsDlg(); }); await sleep(300);
    const opts = await X.pmOpts(of.page, 'P1');
    rec('A1 PM tick list offers the names exactly (apostrophe, HTML as text, emoji)', JSON.stringify(opts) === JSON.stringify(["Seán O'Grady", 'Mary <b>Kelly</b> 🏗']), JSON.stringify(opts));
    await X.tickPMs(of.page, 'P1', ["Seán O'Grady"]); await sleep(500);
    await X.tickPMs(of.page, 'P2', ['Mary <b>Kelly</b> 🏗']); await sleep(500);
    rec('A2 saved as typed in Staff', JSON.stringify(X.D.find(S.db, 'projects', 'P1').pms) === JSON.stringify(["Seán O'Grady"]) && JSON.stringify(X.D.find(S.db, 'projects', 'P2').pms) === JSON.stringify(['Mary <b>Kelly</b> 🏗']), JSON.stringify([X.D.find(S.db, 'projects', 'P1').pms, X.D.find(S.db, 'projects', 'P2').pms]));
    const html = await of.page.evaluate(() => ({ b: !!document.querySelector('#pj-body b b, #pj-body .seq-pm b'), t: document.getElementById('pj-body').innerText }));
    rec('A3 the Projects window shows the HTML name as text (no bold made)', !html.b, JSON.stringify(html.b));
    await of.close();
    const pm = await X.dev(browser, S, 'pm');
    await pm.page.evaluate(() => document.querySelector('[data-meis="Mary <b>Kelly</b> 🏗"]').click()); await sleep(300);
    const m = await pm.page.evaluate(() => ({ me: seqMe('pm'), mine: pmMine('P2'), strip: document.querySelector('.seq-me').innerHTML, who: sessionStorage.getItem('wpfWho') }));
    rec('A4 PM picks "Mary <b>Kelly</b> 🏗": remembered, owns Lucan, strip escaped', m.me === 'Mary <b>Kelly</b> 🏗' && m.mine && /&lt;b&gt;Kelly/.test(m.strip), JSON.stringify(m));
    await pm.page.evaluate(() => { document.getElementById('seq-me-x').click(); }); await sleep(200);
    await pm.page.evaluate(() => document.querySelector(`[data-meis="Seán O'Grady"]`).click()); await sleep(300);
    rec('A5 "Not you?" → Seán O\'Grady: owns Aderrig, not Lucan', await pm.page.evaluate(() => pmMine('P1') && !pmMine('P2') && seqMe('pm') === "Seán O'Grady"));
    // Staff renames him with a trailing space / different case: still him
    await pm.page.evaluate(() => { DB.staff[0].n = "seán o'grady  "; render(); }); await sleep(200);
    rec('A6 Staff name re-typed with different case / trailing spaces: still recognised, still owns Aderrig', await pm.page.evaluate(() => seqMe('pm') !== '' && pmMine('P1')));
    rec('A no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await pm.close();
  }

  // ================= B. two PCs assign a PM to the same project at once; the PM side
  {
    const S = X.makeServer();
    const a = await X.dev(browser, S, 'office'), b = await X.dev(browser, S, 'prod');
    for (const t of [a, b]) { await t.page.evaluate(() => lsProjectsDlg()); } await sleep(300);
    await X.tickPMs(a.page, 'P1', ['John Burke']); await sleep(500);
    await X.tickPMs(b.page, 'P1', ['Mary Kelly']); await sleep(600);
    const tb = await toastOf(b.page), vb = await X.pmTicked(b.page, 'P1');
    rec('B1 two PCs: the second is refused (version check) — John Burke kept', JSON.stringify(X.D.find(S.db, 'projects', 'P1').pms) === '["John Burke"]' && /someone else changed the PMs/.test(tb) && /Now: John Burke/.test(tb), JSON.stringify(X.D.find(S.db, 'projects', 'P1').pms) + ' | ' + tb);
    rec('B2 … and the second PC now shows John Burke ticked (list left open to tick again)', JSON.stringify(vb) === '["John Burke"]' && await b.page.evaluate(() => document.querySelector('[data-seqpmd="P1"]').open), JSON.stringify(vb));
    rec('B3 history: one PM event (John Burke)', S.db.t.project_events.filter(e => e.act === 'pm').length === 1);
    await a.close(); await b.close();
    // the PM acts on another PM's project — straight through the functions, as a curious PM could from the console or a stale screen
    X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P2'), { pms: ['Mary Kelly'] });
    X.seqRow(S, 'L1', 'P2', { wo: 'WO-6' }); X.seqRow(S, 'L2', 'P2', { floor: 'A1', unit: '5', product: 'K1', name: 'TYPE B' });
    const jb = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
    const n0 = (S.rpcCalls || []).length;
    await jb.page.evaluate(async () => { seqMoveReq('P2', 'L2', { up: 1 }); await seqStart('P2'); });
    await sleep(400);
    rec('B4 John (PM of Aderrig) cannot move or start Mary\'s Lucan sequence even by calling the functions', (S.rpcCalls || []).length === n0 && X.order(S, 'P2').join() === 'L1,L2');
    // John's screen is open on Aderrig; the office moves Aderrig to Mary. Before his next poll John presses ▲.
    X.seqRow(S, 'A1', 'P1', { floor: 'T09', unit: '20', product: 'K1', name: 'H20' }); X.seqRow(S, 'A2', 'P1', { floor: 'T09', unit: '21', product: 'K1', name: 'H21' });
    await jb.page.evaluate(async () => { await lsPoll(); pmTab = 'seq'; SEQV.pid = 'P1'; render(); }); await sleep(300);
    X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { pms: ['Mary Kelly'], updated_by: 'Ann Office' });
    await jb.page.evaluate(() => document.querySelector('[data-sequp="A2"]').click()); await sleep(600);
    rec('B5 (information) John reassigned off Aderrig a moment ago, screen not yet polled: his ▲ still goes through — the database does not check who the PM is', true, 'order ' + X.order(S, 'P1').join() + (X.order(S, 'P1').join() === 'A2,A1' ? ' — MOVED by the old PM' : ' — refused'));
    await jb.page.evaluate(async () => { await lsPoll(); render(); }); await sleep(300);
    rec('B6 after the poll John\'s screen is read-only on Aderrig', await jb.page.evaluate(() => !document.querySelector('[data-sequp]') && /Read-only/.test((document.getElementById('seq-pg') || {}).innerText || '')));
    rec('B no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await jb.close();
  }

  // ================= C. PM Deliveries: a customer not linked to any project
  {
    const row = X.v2Row();
    row.orders.push(H.order({ wo: 'WO-90', customer: 'Brand New Builders', floor: 'G', unit: '1', title: 'NEW CUSTOMER JOB', dueDate: '2026-10-29', origDueDate: '2026-10-29', delDay: 'Thu', delVeh: 'VOLVO', delv: true }));
    const S = X.makeServer(row);
    X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
    const pm = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
    const c = await pm.page.evaluate(() => [...document.querySelectorAll('#pm-cust option')].map(o => o.value));
    rec('C1 (information) PM Deliveries with his filter on: a job for a customer not linked to ANY project ("Brand New Builders") — shown to no PM unless he ticks All projects', true, JSON.stringify(c) + (c.includes('Brand New Builders') ? '' : ' — HIDDEN from every PM who has a project'));
    await pm.close();
  }

  // ================= D. Settings numbers: bad values, reload, two PCs at once, never a new top-level key
  {
    const S = X.makeServer();
    const a = await X.dev(browser, S, 'office');
    await a.page.evaluate(() => showTab('s')); await sleep(200);
    const tryVal = async (k, v) => { await a.page.evaluate(([k, v]) => { document.getElementById('s-' + k).value = v; document.getElementById('btn-save-seq').click(); }, [k, v]); await sleep(150); return a.page.evaluate(() => [seqFixedDays(), preWks(), seqWaitWks()]); };
    const r1 = await tryVal('seqFixedDays', '21'); // (a number box can't hold spaces)
    rec('D1 21 accepted', r1[0] === 21, JSON.stringify(r1));
    const bad = [];
    for (const v of ['', '6', '31', '-14', '1e1', '0x10', '14.0', '二十', '21abc', '<script>']) { const r = await tryVal('seqFixedDays', v); if (r[0] !== 21) bad.push(v + '→' + r[0]); }
    rec('D2 blank / 6 / 31 / -14 / 1e1 / 0x10 / 14.0 / text / <script>: refused, 21 kept', !bad.length, bad.join(', '));
    rec('D3 the refusal is told in plain words', /not saved/.test(await toastOf(a.page)), await toastOf(a.page));
    const edge = [];
    for (const [k, v, want] of [['seqFixedDays', '7', 7], ['seqFixedDays', '30', 30], ['preWks', '3', 3], ['preWks', '12', 12], ['preWks', '13', 12], ['seqWaitWks', '1', 1], ['seqWaitWks', '0', 1]]) { const r = await tryVal(k, v); const got = { seqFixedDays: r[0], preWks: r[1], seqWaitWks: r[2] }[k]; if (got !== want) edge.push(k + ' ' + v + '→' + got); }
    rec('D4 range edges: 7 and 30 days, 3 and 12 weeks, 1 week accepted; 13 / 0 refused (old value kept)', !edge.length, edge.join(', '));
    await a.page.evaluate(() => { document.getElementById('s-seqFixedDays').value = '21'; document.getElementById('s-preWks').value = '4'; document.getElementById('s-seqWaitWks').value = '2'; document.getElementById('btn-save-seq').click(); });
    await sleep(2000);
    rec('D5 saved inside settings (21 / 4 / 2), no new top-level key', S.row.settings.seqFixedDays === 21 && S.row.settings.preWks === 4 && S.row.settings.seqWaitWks === 2 && !('seqFixedDays' in S.row), JSON.stringify([S.row.settings.seqFixedDays, S.row.settings.preWks, S.row.settings.seqWaitWks]));
    const c = await X.dev(browser, S, 'office');
    rec('D6 a fresh device (reload) reads 21 / 4 / 2', JSON.stringify(await c.page.evaluate(() => [seqFixedDays(), preWks(), seqWaitWks()])) === '[21,4,2]');
    await c.close();
    // two PCs at once: A changes the window, B changes the pool weeks — both kept
    const b = await X.dev(browser, S, 'prod');
    await a.page.evaluate(() => { showTab('s'); document.getElementById('s-seqFixedDays').value = '10'; document.getElementById('btn-save-seq').click(); });
    await b.page.evaluate(() => { DB.preWks = 6; sched(); });
    await sleep(3500);
    await a.page.evaluate(async () => { await loadDB(); }); await b.page.evaluate(async () => { await loadDB(); }); await sleep(300);
    const ra = await a.page.evaluate(() => [seqFixedDays(), preWks()]), rb = await b.page.evaluate(() => [seqFixedDays(), preWks()]);
    rec('D7 two PCs save different sequence numbers at the same time: both kept everywhere (10 days, 6 weeks)', S.row.settings.seqFixedDays === 10 && S.row.settings.preWks === 6 && ra.join() === '10,6' && rb.join() === '10,6', JSON.stringify({ db: [S.row.settings.seqFixedDays, S.row.settings.preWks], ra, rb }));
    // old saved data with junk in the numbers
    const d = X.makeServer(X.v2Row({ seqFixedDays: '21', preWks: null, seqWaitWks: 3.5 }));
    const t = await X.dev(browser, d, 'office');
    rec('D8 old / hand-edited data ("21" as text, null, 3.5): defaults 14 / 3 / 3, no errors', JSON.stringify(await t.page.evaluate(() => [seqFixedDays(), preWks(), seqWaitWks()])) === '[14,3,3]' && !(d.errors || []).length);
    await t.close();
    rec('D no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await a.close(); await b.close();
  }

  // ================= E. Pre-production plumbing; PINs saved while its box is hidden; switch off mid-session; network down
  {
    const S = X.makeServer();
    const a = await X.dev(browser, S, 'office');
    await a.page.evaluate(() => { DB.pins = Object.assign({}, DB.pins, { pre: '4242' }); SEQP.st = 'missing'; seqShow(); window.prompt = () => '9000'; showTab('s'); }); await sleep(200);
    const hidden = await a.page.evaluate(() => !document.getElementById('s-pin-pre'));
    await a.page.evaluate(() => document.getElementById('btn-save-pins').click()); await sleep(200);
    rec('E1 PINs saved while the Pre-production box is hidden: Johnny\'s PIN (4242) kept', hidden && await a.page.evaluate(() => pins().pre === '4242'));
    await a.page.evaluate(() => { SEQP.st = 'ok'; seqShow(); });
    // staff tick saved while the column is hidden
    await a.page.evaluate(() => { SEQP.st = 'missing'; render(); const cb = document.querySelector('[data-str="0|office"]'); if (cb) { cb.checked = true; cb.onchange.call(cb); } }); await sleep(200);
    rec('E2 a Staff tick changed while the Pre-production column is hidden keeps Johnny\'s "pre" tick', await a.page.evaluate(() => staffFor('pre').some(s => s.n === 'Johnny')));
    await a.page.evaluate(() => { SEQP.st = 'ok'; seqShow(); });
    await a.close();
    // a PM on the Sequence tab when the office switches the lists back off ('switching', then v1)
    X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
    X.seqRow(S, 'Z1', 'P1', { wo: 'WO-3' });
    const pm = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
    await pm.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(300);
    await pm.page.evaluate(() => { DB.listStore = 'switching'; render(); });
    const sw = await pm.page.evaluate(() => ({ pg: !!document.getElementById('seq-pg'), mv: !!document.querySelector('[data-sequp],[draggable="true"],#seq-start') }));
    rec('E3 lists "switching": the page is read-only', sw.pg && !sw.mv, JSON.stringify(sw));
    await pm.page.evaluate(() => { DB.listStore = 'v1'; render(); }); await sleep(200);
    const off = await pm.page.evaluate(() => ({ pg: !!document.getElementById('seq-pg'), tab: !!document.querySelector('[data-pmtab="seq"]'), pmTab, n: document.querySelectorAll('tr.seq-r').length }));
    rec('E4 lists switched off: no sequence page or tab, back on Deliveries', !off.pg && !off.tab && off.n === 0, JSON.stringify(off));
    const n0 = X.SS.seqCalls(S).length;
    await pm.page.evaluate(async () => { await lsPoll(); seqMoveReq('P1', 'Z1', { up: 1 }); });
    rec('E5 … and nothing asks the sequence tables any more', X.SS.seqCalls(S).length === n0, (X.SS.seqCalls(S).length - n0) + ' calls');
    rec('E no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await pm.close();
    // probe fails on the network: hidden, no errors, then shows once the network is back (after the 60 s wait)
    const N = X.makeServer(); N.offlineS = true;
    X.D.update(N.db, 'projects', X.D.find(N.db, 'projects', 'P1'), { pms: ['John Burke'] });
    const p2 = await X.dev(browser, N, 'pm', { me: { pm: 'John Burke' } });
    // (the harness answers every table before the fake is attached, so redo the first probe with the network down)
    await p2.page.evaluate(async () => { SEQP.st = ''; lsReset(); await lsLoad(); render(); }); await sleep(200);
    const st = await p2.page.evaluate(() => ({ st: SEQP.st, tab: !!document.querySelector('[data-pmtab="seq"]'), ask: !!document.querySelector('.pod-ovl') }));
    rec('E6 sequence tables unreachable at start: state "net", no Sequence tab, no name question, no errors', st.st === 'net' && !st.tab && !(N.errors || []).length, JSON.stringify(st));
    N.offlineS = false;
    await p2.page.evaluate(async () => { SEQP.retry = 0; await lsPoll(); render(); }); await sleep(300);
    rec('E7 network back (retry due): the Sequence tab appears', await p2.page.evaluate(() => SEQP.st === 'ok' && !!document.querySelector('[data-pmtab="seq"]')));
    await p2.close();
  }
  await browser.close();
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
