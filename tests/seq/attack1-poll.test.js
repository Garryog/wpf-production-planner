// Tester attack round 1 on Part 2 steps 2–4: the 10-second poll (Johnny's seq_pre table empty when the screen loaded, then
// a row arrives), "Start the sequence from today's jobs" pressed on two PCs at the very same moment / twice on one PC /
// cancelled, a WO already in another project's sequence, and 360 px phones with long names and many rows (PM page,
// office window, History). Fake Supabase only. Run: node tests/seq/attack1-poll.test.js
const X = require('./fixs.js');
const { H, rec, sleep } = X;
const toastOf = p => p.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
(async () => {
  const browser = await H.chromium.launch();

  // ================= A. seq_pre empty at load, then a row arrives (Johnny's first tick / the CNC sheet)
  {
    const S = X.makeServer();
    X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
    X.seqRow(S, 'P1A', 'P1', { wo: 'WO-3' });
    const pm = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
    await pm.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(300);
    rec('A0 page shows 1 row', await pm.page.evaluate(() => document.querySelectorAll('tr.seq-r').length) === 1);
    X.DS.preWrite(S.db, null, { seq_id: 'P1A', wo: 'WO-3', processed: true, updated_by: 'Johnny' }); // first ever seq_pre row
    X.seqRow(S, 'P1B', 'P1', { floor: 'T09', unit: '30', product: 'K1', name: 'NEW FROM ANOTHER PC' });
    S.errLog = [];
    await pm.page.evaluate(async () => { for (let i = 0; i < 3; i++) await lsPoll(); }); await sleep(300);
    const r = await pm.page.evaluate(() => ({ n: document.querySelectorAll('tr.seq-r').length, prog: (document.querySelector('tr[data-seqr="P1A"] .seq-prog') || {}).innerText || '' }));
    const bad = S.log.filter(x => /GET \/seq_pre\?select=\*&order=id\.asc/.test(x));
    rec('A1 after the first seq_pre row exists, the poll still brings new sequence rows (2 rows shown)', r.n === 2, JSON.stringify(r) + ' | seq_pre polls ordered by a column it does not have: ' + bad.length);
    rec('A2 … and WO-3 shows "processed ✓" from Johnny\'s tick', /processed ✓/.test(r.prog), r.prog);
    rec('A3 the poll never asks seq_pre to sort by "id" (it has no id column — the real database refuses with 42703)', !bad.length, bad.slice(0, 2).join(' | '));
    rec('A no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await pm.close();
  }

  // ================= A'. the same on the REAL database's terms: PostgREST checks the order column against the table even
  // when it is empty (42703 "column seq_pre.id does not exist") — so at go-live (seq_pre empty) every poll would fail
  {
    const S = X.makeServer();
    X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
    X.seqRow(S, 'P1A', 'P1', { wo: 'WO-3' });
    const pm = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
    await pm.page.route('**/rest/v1/seq_pre?*', route => /order=id\./.test(route.request().url())
      ? route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: '42703', message: 'column seq_pre.id does not exist', details: null, hint: null }) })
      : route.fallback());
    await pm.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(300);
    X.seqRow(S, 'P1B', 'P1', { floor: 'T09', unit: '31', product: 'K1', name: 'ADDED ON ANOTHER PC' });
    await pm.page.evaluate(async () => { await lsPoll(); await lsPoll(); }); await sleep(300);
    const n = await pm.page.evaluate(() => document.querySelectorAll('tr.seq-r').length);
    rec("A'1 go-live day (seq_pre empty, real PostgREST column check): a row added on another PC reaches this screen on the poll", n === 2, n + ' rows shown (2 in the database)');
    await pm.close();
  }

  // ================= B. Start the sequence: two PCs at the same moment, twice on one PC, cancelled
  {
    const S = X.makeServer();
    X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
    const pm = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
    const of = await X.dev(browser, S, 'office');
    await pm.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(300);
    await of.page.evaluate(() => seqOpen('P1')); await sleep(400);
    // cancel first
    await pm.page.evaluate(() => { window.__confirm = false; document.getElementById('seq-start').click(); window.__confirm = undefined; }); await sleep(300);
    rec('B1 Start → Cancel: nothing sent', !(S.rpcCalls || []).some(c => c.fn === 'seq_insert') && S.db.t.project_seq.length === 0);
    // hold the database: both PCs press Start, then both requests land
    let release; S.holdS = new Promise(r => { release = r; });
    await pm.page.evaluate(() => document.getElementById('seq-start').click());
    await of.page.evaluate(() => document.getElementById('seq-start').click());
    // the PM taps again while his first is still in flight (impatient double-tap)
    await pm.page.evaluate(() => { const b = document.getElementById('seq-start'); if (b) b.click(); });
    await sleep(300); S.holdS = null; release(); await sleep(1200);
    const wos = X.DS.liveOf(S.db, 'P1').map(r => r.wo);
    rec('B2 two PCs + a double-tap at the same moment: each WO once (4 rows), positions 1..4', wos.length === 4 && new Set(wos).size === 4 && X.DS.liveOf(S.db, 'P1').every((r, i) => r.pos === i + 1), JSON.stringify(wos) + ' calls ' + (S.rpcCalls || []).filter(c => c.fn === 'seq_insert').length);
    const ta = await toastOf(pm.page), tb = await toastOf(of.page);
    rec('B3 both screens end with the 4 rows and no Start button', await pm.page.evaluate(() => document.querySelectorAll('tr.seq-r').length === 4 && !document.getElementById('seq-start')) && await of.page.evaluate(() => document.querySelectorAll('.seq-ovl tr.seq-r').length === 4 && !document.getElementById('seq-start')), ta + ' | ' + tb);
    rec('B4 history: exactly 4 "add" events', S.db.t.project_events.filter(e => e.entity === 'seq' && e.act === 'add').length === 4);
    await pm.close(); await of.close();
    // a WO already in ANOTHER project's sequence (its customer was re-linked): skipped and said so
    const S2 = X.makeServer();
    X.seqRow(S2, 'LX', 'P2', { wo: 'WO-3' });
    const o2 = await X.dev(browser, S2, 'office');
    await o2.page.evaluate(() => seqOpen('P1')); await sleep(400);
    const btn = await o2.page.evaluate(() => (document.getElementById('seq-start') || {}).textContent || '');
    await o2.page.evaluate(() => document.getElementById('seq-start').click()); await sleep(800);
    const t2 = await toastOf(o2.page);
    rec('B5 a WO already in Lucan\'s sequence is not offered again for Aderrig (count excludes it) or is skipped with a message', !/\(4\)/.test(btn) || (/already in a sequence/.test(t2) && !X.DS.liveOf(S2.db, 'P1').some(r => r.wo === 'WO-3')), btn + ' | ' + t2);
    rec('B no page errors', !(S.errors || []).length && !(S2.errors || []).length, JSON.stringify([S.errors, S2.errors]));
    await o2.close();
  }

  // ================= C. 360 px phone: 40 rows, long names and WO numbers, History with a long reason
  {
    const S = X.makeServer();
    X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'], name: 'Aderrig Phase 2 Block C North — Apartments and Duplexes (Contract 2026/114)' });
    for (let i = 0; i < 40; i++) X.seqRow(S, 'R' + i, 'P1', { floor: 'T' + String(i).padStart(2, '0'), unit: 'UNIT-' + i + '-LONGLONGLONG', product: 'K8-SPECIAL-EXTRA', name: 'HOUSE TYPE C END OF TERRACE WITH ISLAND AND UTILITY AND PANTRY ' + 'X'.repeat(i % 3 ? 5 : 60), req_date: '2026-12-0' + (1 + (i % 9)) });
    for (let i = 0; i < 12; i++) S.db.t.project_events.push({ id: S.db.seq.project_events++, project_id: 'P1', entity: 'seq', entity_id: 'R' + i, act: 'move', old: { pos: i + 2 }, new: { pos: i + 1, why: 'Site not ready because the contractor\'s programme slipped again — ' + 'very long reason '.repeat(6) }, by: 'Someone With A Very Long Name Indeed', at: new Date().toISOString() });
    const ph = await X.dev(browser, S, 'pm', { viewport: { width: 360, height: 740 }, me: { pm: 'John Burke' } });
    await ph.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(400);
    let sc = await X.noScroll(ph.page);
    const wide = await ph.page.evaluate(() => [...document.querySelectorAll('#seq-pg *')].filter(e => e.getBoundingClientRect().right > 362).slice(0, 5).map(e => e.tagName + '.' + e.className + ' r=' + Math.round(e.getBoundingClientRect().right)));
    rec('C1 PM page, 40 long rows at 360 px: no sideways scroll, nothing sticks out', sc.sw <= sc.cw + 1 && !wide.length, JSON.stringify(sc) + ' ' + wide.join(' | '));
    await ph.page.evaluate(() => document.getElementById('seq-hist').click()); await sleep(500);
    sc = await X.noScroll(ph.page);
    rec('C2 History at 360 px with long names / reasons: no sideways scroll', sc.sw <= sc.cw + 1, JSON.stringify(sc));
    await ph.page.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
    // ▼ on the last-but-one row on the phone, then the page re-renders: still no sideways scroll
    await ph.page.click('[data-seqdn="R38"]'); await sleep(700);
    rec('C3 phone ▼ near the bottom works (R38 → #40)', X.order(S, 'P1').slice(-1)[0] === 'R38', X.order(S, 'P1').slice(-3).join());
    await ph.close();
    const op = await X.dev(browser, S, 'office', { viewport: { width: 360, height: 740 } });
    await op.page.evaluate(() => seqOpen('P1')); await sleep(500);
    sc = await X.noScroll(op.page);
    const w2 = await op.page.evaluate(() => { const b = document.querySelector('.seq-ovl .pod-in').getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right) }; });
    rec('C4 office window at 360 px with 40 long rows: fits, no sideways scroll', sc.sw <= sc.cw + 1 && w2.l >= 0 && w2.r <= 361, JSON.stringify([sc, w2]));
    rec('C no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await op.close();
  }
  await browser.close();
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
