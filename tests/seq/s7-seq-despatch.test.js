// Garry 10 Nov: the project sequence for the office and despatch too — "🔢 Sequence" on the Deliveries page (office can
// reorder as on the hub), on the Stores screen and the Driver's phone (look only: no handles, no buttons). Hidden before
// the SQL and with the switch off. PC and 360 px. Fake Supabase only. Run: node tests/seq/s7-seq-despatch.test.js
const X = require('./fixs.js');
const { H, rec, sleep } = X;
const vis = p => p.evaluate(() => [...document.querySelectorAll('[data-seqpick]')].filter(b => !b.hidden && b.offsetParent !== null).length);
const pick = async (p, pid) => { await p.evaluate(() => document.querySelector('[data-seqpick]:not([hidden])').click()); await sleep(200); await p.evaluate(pid => document.querySelector('[data-pp="' + pid + '"]').click(), pid); await sleep(500); };
const lookOnly = p => p.evaluate(() => ({ pg: !!document.querySelector('.seq-ovl #seq-pg'), rows: document.querySelectorAll('.seq-ovl tr.seq-r').length, ctl: !!document.querySelector('.seq-ovl [data-sequp], .seq-ovl [draggable="true"], .seq-ovl #seq-house, .seq-ovl #seq-start, .seq-ovl .seq-hd'), ro: /Read-only/.test((document.querySelector('.seq-ovl #seq-pg') || {}).innerText || '') }));
(async () => {
  const browser = await H.chromium.launch();
  // ---- before the SQL / switch off: no Sequence button anywhere
  for (const [lbl, S] of [['before the SQL', X.makeServer(null, { noSeq: true })], ['switch off', X.makeServer(X.v1Row())]]) {
    const o = await X.dev(browser, S, 'office'); await o.page.evaluate(() => showTab('d')); await sleep(200);
    const st = await X.dev(browser, S, 'stores'); const dr = await X.dev(browser, S, 'driver', { viewport: { width: 360, height: 740 } });
    rec(lbl + ': no 🔢 Sequence on Deliveries / Stores / Driver', await vis(o.page) === 0 && await vis(st.page) === 0 && await vis(dr.page) === 0);
    await o.page.evaluate(() => { const b = document.querySelector('[data-seqpick]'); if (b) b.click(); }); await sleep(200);
    rec(lbl + ': even a hidden button does nothing; no page errors', await o.page.evaluate(() => !document.querySelector('.pod-ovl')) && !(S.errors || []).length, JSON.stringify(S.errors));
    await o.close(); await st.close(); await dr.close();
  }
  // ---- with the SQL
  const S = X.makeServer();
  ['QA', 'QB', 'QC'].forEach((id, i) => X.seqRow(S, id, 'P1', { floor: 'T70', unit: String(i + 1), product: 'K1', name: 'HOUSE <i>' + id + '</i>' }));
  const of = await X.dev(browser, S, 'office');
  await of.page.evaluate(() => showTab('d')); await sleep(300);
  rec('office Deliveries: 🔢 Sequence button shown', await vis(of.page) === 1);
  await pick(of.page, 'P1');
  const o1 = await of.page.evaluate(() => ({ rows: document.querySelectorAll('.seq-ovl tr.seq-r').length, up: document.querySelectorAll('.seq-ovl [data-sequp]').length, i: !!document.querySelector('.seq-ovl tr.seq-r i') }));
  rec('office: picks Aderrig → the sequence window, with ▲ ▼ (office can reorder); names escaped', o1.rows === 3 && o1.up === 3 && !o1.i, JSON.stringify(o1));
  await of.page.evaluate(() => document.querySelector('.seq-ovl [data-seqdn="QA"]').click()); await sleep(600);
  rec('office moves A down from the Deliveries page', X.order(S, 'P1').join() === 'QB,QA,QC', X.order(S, 'P1').join());
  await of.close();
  // Stores: look only
  const st = await X.dev(browser, S, 'stores');
  rec('Stores screen: 🔢 Sequence button shown', await vis(st.page) === 1);
  await pick(st.page, 'P1');
  const s1 = await lookOnly(st.page);
  rec('Stores: the sequence, look only (no handles, no ▲ ▼, no Start), says read-only', s1.pg && s1.rows === 3 && !s1.ctl && s1.ro, JSON.stringify(s1));
  const n0 = (S.rpcCalls || []).filter(c => c.fn === 'seq_move').length;
  await st.page.evaluate(() => seqMoveReq('P1', 'QC', { up: 1 })); await sleep(300);
  rec('Stores: a move called directly is refused (nothing sent)', (S.rpcCalls || []).filter(c => c.fn === 'seq_move').length === n0);
  await st.close();
  // Saw: no button (not asked for)
  const sw = await X.dev(browser, S, 'saw');
  rec('Saw screen: no Sequence button', await vis(sw.page) === 0);
  await sw.close();
  // Driver phone 360 px: look only, fits
  const dr = await X.dev(browser, S, 'driver', { viewport: { width: 360, height: 740 } });
  rec('Driver phone: 🔢 Project sequence button shown', await vis(dr.page) === 1);
  const bh = await dr.page.evaluate(() => document.querySelector('[data-seqpick]:not([hidden])').getBoundingClientRect().height);
  await pick(dr.page, 'P1');
  const d1 = await lookOnly(dr.page), sc = await X.noScroll(dr.page);
  rec('Driver 360 px: look only, no sideways scroll, button big enough to tap', d1.pg && d1.rows === 3 && !d1.ctl && sc.sw <= sc.cw + 1 && bh >= 40, JSON.stringify([d1, sc, bh]));
  await dr.close();
  // office Deliveries at 360 px
  const op = await X.dev(browser, S, 'office', { viewport: { width: 360, height: 740 } });
  await op.page.evaluate(() => showTab('d')); await sleep(300);
  await pick(op.page, 'P1');
  const sc2 = await X.noScroll(op.page);
  rec('office 360 px: the window opens from Deliveries and fits', await op.page.evaluate(() => !!document.querySelector('.seq-ovl #seq-pg')) && sc2.sw <= sc2.cw + 1, JSON.stringify(sc2));
  await op.close();
  rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  await browser.close();
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
