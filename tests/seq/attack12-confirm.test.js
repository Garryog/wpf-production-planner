// Tester attack 12 (B10 To place / confirm, two PCs, Dates to agree, ⏳): a stale confirm panel (another PC confirmed first);
// two PCs applying the SAME Cienapps import at the same moment (two pages, one fake DB) → each WO on exactly one row, no double
// 🆕; "Use the waiting row" losing the connection half-way (the retired 🆕 row's WO — Coder deviation 2 — is it still visible
// anywhere?); Dates to agree moving a job INTO the 14-day window (PM → request), onto 25 Dec / 1 Jan / 17 Mar / a Saturday,
// across a week / year boundary; ⏳ at exactly seqWaitWks weeks ±1 day (and just after midnight Irish summer time);
// Remove → reason, Cancel writes nothing; 360 px ⏳ dialog + reason picker; SQL not run → no chip. Fake Supabase only.
// Run: node tests/seq/attack12-confirm.test.js
const X = require('./fixs.js');
const { H, D, rec, sleep } = X;
const C = 'Aderrig Homes';
const J = (wo, f, u, t, x) => H.order(Object.assign({ wo, customer: C, floor: f, unit: u, title: t, dueDate: '2026-12-03', origDueDate: '2026-12-03', plannedWeek: '', step: '4. READY FOR PRODUCTION' }, x || {}));
const rowOf = (S, id) => D.find(S.db, 'project_seq', id);
const woRows = (S, wo) => S.db.t.project_seq.filter(r => r.wo === wo && r.state !== 'removed');
const tap = async (p, sel, ms) => { const ok = await p.evaluate(s => { const b = document.querySelector(s); if (!b) return false; b.click(); return true; }, sel); await sleep(ms || 900); return ok; };
const toastTxt = p => p.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
const U = (S, id, f, u, p, n, kind, x) => X.seqRow(S, id, 'P1', Object.assign({ floor: f, unit: u, product: p, name: n, kind, src: 'upload', upload_id: 'UP1', why: 'Cienapps upload: a.xlsx' }, x || {}));
const oneEach = S => { const m = {}; S.db.t.project_seq.filter(r => r.state !== 'removed' && r.wo).forEach(r => { m[r.wo] = (m[r.wo] || 0) + 1; }); return Object.entries(m).filter(([, n]) => n > 1); };
(async () => {
  const browser = await H.chromium.launch();
  try {
    // ================= 1: stale confirm — another PC confirms first
    const row1 = X.v2Row(); row1.orders.push(J('WO-541', 'T09', '43', 'HOUSE TYPE C'), J('WO-542', 'T09', '43', 'HOUSE TYPE C'));
    const S1 = X.makeServer(row1); D.update(S1.db, 'projects', D.find(S1.db, 'projects', 'P1'), { pms: ['John Burke'] });
    U(S1, 'U5', 'T09', '43', 'K8', 'HOUSE TYPE C', 'kitchen');
    const pm = await X.dev(browser, S1, 'pm', { me: { pm: 'John Burke' } }), p = pm.page;
    await p.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(1200);
    const of = await X.dev(browser, S1, 'office'), o = of.page;
    await o.evaluate(() => seqOpen('P1')); await sleep(1200);
    rec('C1 both screens offer U5 to WO-541 and WO-542', await p.evaluate(() => !!document.querySelector('[data-seqcf="U5"][data-seqcfwo="WO-541"]')) && await o.evaluate(() => !!document.querySelector('[data-seqcf="U5"][data-seqcfwo="WO-542"]')));
    await tap(o, '[data-seqcf="U5"][data-seqcfwo="WO-542"]');
    rec('C2 office confirms WO-542 → U5', rowOf(S1, 'U5').wo === 'WO-542');
    await tap(p, '[data-seqcf="U5"][data-seqcfwo="WO-541"]');
    const t1 = await toastTxt(p);
    rec('C3 PM taps his stale button (WO-541 → U5): refused, told it changed, U5 keeps WO-542, WO-541 on no row', rowOf(S1, 'U5').wo === 'WO-542' && !woRows(S1, 'WO-541').length && /another screen|look again/.test(t1), t1);
    const cf1 = await p.evaluate(() => (document.getElementById('seq-cf') || {}).innerText || '');
    rec('C4 the PM panel then offers WO-541 "Not in the sequence yet … ➕ Add" (the plan: second WO offered a New row)', /WO-541/.test(cf1) && await p.evaluate(() => !!document.querySelector('[data-seqcfnew="WO-541"]')), cf1.replace(/\s+/g, ' ').slice(0, 200));
    await pm.close(); await of.close();

    // ================= 2: two PCs apply the SAME Cienapps import at the same moment
    const HDR = ['WO #', 'Title', 'Customer', 'Due Date', 'Step', 'Sub-Total', 'Reference', 'Floor', 'Unit'];
    const W = (wo, t, f, u) => [wo, t, C, 46359, '4. READY FOR PRODUCTION', 5000, '2604-' + wo, f, u];
    const FILE = [HDR, W('WO-801', 'HOUSE TYPE B LH', 'T09', '80'), W('WO-802', 'HOUSE TYPE B BED 2', 'T09', '81'), W('WO-803', 'HOUSE TYPE B BED 2', 'T09', '81'),
      W('WO-804', 'HOUSE TYPE C', 'T09', '82'), W('WO-805', 'HOUSE TYPE C', 'T10', '83'), W('WO-806', 'HOUSE TYPE C', 'T10', '84')];
    const S2 = X.makeServer(); D.update(S2.db, 'projects', D.find(S2.db, 'projects', 'P1'), { pms: ['John Burke'] });
    U(S2, 'V1', 'T09', '80', 'K8', 'HOUSE TYPE B LH', 'kitchen'); U(S2, 'V2a', 'T09', '81', 'W2', 'HOUSE TYPE B BED 2', 'robes'); U(S2, 'V2b', 'T09', '81', 'W2', 'HOUSE TYPE B BED 2', 'robes');
    U(S2, 'V3', 'T09', '82', 'K8', 'HOUSE TYPE C', 'kitchen');
    const A = await X.dev(browser, S2, 'office'), Bq = await X.dev(browser, S2, 'office');
    await H.importAoa(A.page, FILE); await H.importAoa(Bq.page, FILE); await sleep(200);
    const go = pg => pg.evaluate(async () => { SEQ_REC_RUN = null; document.getElementById('imp-apply').click(); for (let i = 0; i < 80 && !SEQ_REC_RUN; i++) await new Promise(r => setTimeout(r, 50)); return SEQ_REC_RUN ? await SEQ_REC_RUN : null; });
    const [ra, rb] = await Promise.all([go(A.page), go(Bq.page)]); await sleep(500);
    rec('T1 both PCs finish without an error', !!ra && !!rb && !ra.fail && !rb.fail, JSON.stringify([ra, rb]));
    rec('T2 each WO on exactly ONE live row (no doubles)', !oneEach(S2).length, JSON.stringify(oneEach(S2)));
    rec('T3 V1 = WO-801, the BED 2 pair = WO-802 / WO-803 in order, V3 = WO-804', rowOf(S2, 'V1').wo === 'WO-801' && rowOf(S2, 'V2a').wo === 'WO-802' && rowOf(S2, 'V2b').wo === 'WO-803' && rowOf(S2, 'V3').wo === 'WO-804',
      JSON.stringify(['V1', 'V2a', 'V2b', 'V3'].map(i => rowOf(S2, i).wo)));
    rec('T4 the two new T10 WOs: ONE 🆕 row each (not two)', woRows(S2, 'WO-805').length === 1 && woRows(S2, 'WO-806').length === 1);
    rec('T5 the counts add up across the two PCs (4 matched, 2 added in total)', ra.matched + rb.matched === 4 && ra.added + rb.added === 2, JSON.stringify([ra.matched, rb.matched, ra.added, rb.added]));
    await A.close(); await Bq.close();

    // ================= 3: "Use the waiting row" loses the connection half-way — is the WO still visible anywhere?
    const row3 = X.v2Row(); row3.orders.push(J('WO-90', 'T09', '50', 'HOUSE TYPE K'));
    const S3 = X.makeServer(row3); D.update(S3.db, 'projects', D.find(S3.db, 'projects', 'P1'), { pms: ['John Burke'] });
    U(S3, 'U9', '0', '50', 'K8', 'HOUSE TYPE K', 'kitchen');
    X.seqRow(S3, 'N1', 'P1', { wo: 'WO-90', floor: 'T09', unit: '50', descr: 'HOUSE TYPE K', kind: 'kitchen', src: 'import', is_new: true });
    const pm3 = await X.dev(browser, S3, 'pm', { me: { pm: 'John Burke' } }), q = pm3.page;
    await q.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(1200);
    S3.beforeRpc = fn => { if (fn === 'seq_remove') { S3.beforeRpc = null; setImmediate(() => { S3.offline = true; }); } }; // the remove lands, then the line drops
    await tap(q, '[data-seqdbl="N1"][data-seqdblw="U9"]', 1500);
    const t3 = await toastTxt(q); S3.offline = false;
    rec('G1 connection lost after the 🆕 row was retired: the PM is warned', /could not be put back|check History|Not changed/.test(t3), t3);
    const stranded = !woRows(S3, 'WO-90').length;
    await q.evaluate(async () => { await seqFresh('P1'); render(); }); await sleep(800);
    const vis = await q.evaluate(() => { const pl = seqWOPlan('P1'); return { none: pl.none.map(j => j.o.wo), conf: pl.confirm.map(j => j.o.wo), panel: (document.getElementById('seq-cf') || {}).innerText || '', page: (document.getElementById('seq-pg') || {}).innerText || '' }; });
    rec('G2 (deviation 2) WO-90 left with no live row is still shown somewhere on the page to fix (not only in 📜 History)', !stranded || /WO-90/.test(vis.page), JSON.stringify({ stranded, none: vis.none, conf: vis.conf }));
    await pm3.close();

    // ================= 4: Dates to agree — window / bank holidays / weekend / year end
    const row4 = X.v2Row();
    row4.orders.push(J('WO-701', 'T09', '70', 'HOUSE TYPE A', { dueDate: '2026-12-20', origDueDate: '2026-12-20', delivDate: '2026-12-21' }), J('WO-702', 'T09', '71', 'HOUSE TYPE A', { dueDate: '2026-12-20', origDueDate: '2026-12-20', delivDate: '2026-12-21' }),
      J('WO-703', 'T09', '72', 'HOUSE TYPE A', { dueDate: '2027-03-01', origDueDate: '2027-03-01', delivDate: '2027-03-04' }), J('WO-704', 'T09', '73', 'HOUSE TYPE A', { dueDate: '2026-12-20', origDueDate: '2026-12-20', delivDate: '2026-12-21' }),
      J('WO-705', 'T09', '74', 'HOUSE TYPE A', { dueDate: '2026-12-20', origDueDate: '2026-12-20', delivDate: '2026-12-21' }));
    const S4 = X.makeServer(row4); D.update(S4.db, 'projects', D.find(S4.db, 'projects', 'P1'), { pms: ['John Burke'] });
    X.seqRow(S4, 'IN', 'P1', { wo: 'WO-3', floor: 'T09', unit: '13', descr: 'HOUSE TYPE C', req_date: '2026-10-30', src: 'upload' }); // WO-3 due 3 Dec: OUTSIDE the window; the row asks 30 Oct: INSIDE
    X.seqRow(S4, 'XM', 'P1', { wo: 'WO-701', floor: 'T09', unit: '70', req_date: '2026-12-25', src: 'upload' });
    X.seqRow(S4, 'NY', 'P1', { wo: 'WO-702', floor: 'T09', unit: '71', req_date: '2027-01-01', src: 'upload' });
    X.seqRow(S4, 'SP', 'P1', { wo: 'WO-703', floor: 'T09', unit: '72', req_date: '2027-03-17', src: 'upload' });
    X.seqRow(S4, 'SA', 'P1', { wo: 'WO-704', floor: 'T09', unit: '73', req_date: '2026-12-12', src: 'upload' });
    X.seqRow(S4, 'MO', 'P1', { wo: 'WO-705', floor: 'T09', unit: '74', req_date: '2027-01-04', src: 'upload' });
    const pm4 = await X.dev(browser, S4, 'pm', { me: { pm: 'John Burke' } }), r = pm4.page;
    await r.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(1200);
    const d3 = await r.evaluate(() => DB.orders.find(x => x.wo === 'WO-3').dueDate);
    await tap(r, '[data-sequse="IN"]', 1400);
    const rq = S4.db.t.seq_requests.filter(x => (x.wos || []).includes('WO-3'));
    const o3 = await r.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-3'); return { due: o.dueDate, d: o.delivDate }; });
    rec('W1 PM "Use 30 Oct" on WO-3 (today outside the window, the new date INSIDE it): a change request, WO-3 not moved', rq.length === 1 && rq[0].status === 'open' && o3.due === d3 && !o3.d, JSON.stringify({ rq: rq.map(x => x.status), o3, d3 }));
    await r.evaluate(() => { document.querySelectorAll('.seq-res,.pod-ovl').forEach(x => x.remove()); render(); }); await sleep(300);
    const useIt = async id => { await tap(r, '[data-sequse="' + id + '"]', 1400); await r.evaluate(() => { document.querySelectorAll('.seq-res,.pod-ovl').forEach(x => x.remove()); render(); }); await sleep(300); };
    const hol = await r.evaluate(() => ({ xm: isWorkDay('2026-12-25'), ny: isWorkDay('2027-01-01'), sp: isWorkDay('2027-03-17') }));
    for (const id of ['XM', 'NY', 'SP', 'SA', 'MO']) await useIt(id);
    const dd = await r.evaluate(() => ['WO-701', 'WO-702', 'WO-703', 'WO-704', 'WO-705'].map(w => { const o = DB.orders.find(x => x.wo === w); return { w, d: o.delivDate, due: o.dueDate, dw: isWorkDay(o.delivDate), uw: isWorkDay(o.dueDate) }; }));
    const rowsLeft = ['XM', 'NY', 'SP', 'SA', 'MO'].map(id => id + ':' + rowOf(S4, id).req_date);
    rec('W2 the planner knows 25 Dec 2026, 1 Jan 2027, 17 Mar 2027 are bank holidays', !hol.xm && !hol.ny && !hol.sp, JSON.stringify(hol));
    rec('W3 "Use 25 Dec": WO-701 is NOT given a delivery on Christmas Day without a warning (moved to a working day, or refused and the row date kept)', !(dd[0].d === '2026-12-25'), JSON.stringify([dd[0], rowsLeft[0]]));
    rec('W4 "Use 1 Jan 2027": WO-702 not delivered on New Year\'s Day silently', !(dd[1].d === '2027-01-01'), JSON.stringify([dd[1], rowsLeft[1]]));
    rec('W5 "Use 17 Mar 2027": WO-703 not delivered on St Patrick\'s Day silently', !(dd[2].d === '2027-03-17'), JSON.stringify([dd[2], rowsLeft[2]]));
    rec('W6 "Use Sat 12 Dec": Saturday is a delivery day (isDelivDay) — kept as asked, build date a working day', dd[3].d === '2026-12-12' && dd[3].uw, JSON.stringify([dd[3], rowsLeft[3]]));
    rec('W7 "Use Mon 4 Jan 2027" (year end, 1 Jan + 28 Dec holidays): delivery 4 Jan, build date a working day before it (29 Dec 2026)', dd[4].d === '2027-01-04' && dd[4].uw && dd[4].due === '2026-12-29', JSON.stringify(dd[4]));
    rec('W8 every build date set by Use is a working day', dd.every(x => !x.due || x.uw), JSON.stringify(dd.map(x => x.w + ':' + x.due)));
    rec('W9 PM: no page errors', !(S4.errors || []).length, JSON.stringify(S4.errors));
    await pm4.close();

    // ================= 5: ⏳ at exactly seqWaitWks weeks ±1 day (today Wed 21 Oct 2026, 3 weeks = 30 Sep)
    const S5 = X.makeServer(); D.update(S5.db, 'projects', D.find(S5.db, 'projects', 'P1'), { pms: ['John Burke'] });
    const at = (id, iso) => { const w = U(S5, id, 'T09', id.slice(1), 'K8', 'HOUSE TYPE B', 'kitchen'); w.created_at = iso; };
    at('B20', '2026-10-01T10:00:00.000Z'); at('B21', '2026-09-30T10:00:00.000Z'); at('B22', '2026-09-29T10:00:00.000Z'); at('B23', '2026-09-29T23:30:00.000Z'); // B23 = 00:30 on 30 Sep in Dublin (summer time)
    const pm5 = await X.dev(browser, S5, 'pm', { me: { pm: 'John Burke' } }), s = pm5.page;
    await s.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(1200);
    const fl = await s.evaluate(() => [...document.querySelectorAll('[data-seqold]')].map(b => b.dataset.seqold).sort().join());
    rec('H1 ⏳ on 22 days (B22), not on 20 (B20) or exactly 21 days (B21)', /B22/.test(fl) && !/B20/.test(fl) && !/B21/.test(fl), fl);
    rec('H2 a row saved at 00:30 Irish time on 30 Sep (23:30 UTC 29 Sep) = exactly 21 days locally: no ⏳', !/B23/.test(fl), fl);
    await s.evaluate(() => { DB.seqWaitWks = 1; render(); }); await sleep(400);
    const fl1 = await s.evaluate(() => [...document.querySelectorAll('[data-seqold]')].map(b => b.dataset.seqold).sort().join());
    rec('H3 Settings seqWaitWks = 1: all four flagged', fl1 === 'B20,B21,B22,B23', fl1);
    // Remove: reason asked; Cancel writes nothing
    await tap(s, '[data-seqold="B22"]', 500);
    await s.evaluate(() => document.getElementById('sqw-rm').click()); await sleep(300);
    const n0 = (S5.rpcCalls || []).length;
    const canc = await s.evaluate(() => { const b = document.getElementById('pod-x'); if (!b) return false; b.click(); return true; }); await sleep(500);
    rec('H4 Remove → reason picker → Cancel: nothing written, row still waiting', canc && (S5.rpcCalls || []).length === n0 && rowOf(S5, 'B22').state === 'waiting', JSON.stringify([canc, (S5.rpcCalls || []).slice(n0).map(c => c.fn)]));
    await tap(s, '[data-seqold="B22"]', 500);
    await s.evaluate(() => document.getElementById('sqw-rm').click()); await sleep(300);
    await s.evaluate(() => document.querySelector('[data-why="Not ordered / cancelled"]').click()); await sleep(900);
    rec('H5 Remove with a reason: row kept (state removed, reason), History "remove"', rowOf(S5, 'B22').state === 'removed' && /Not ordered/.test(rowOf(S5, 'B22').why) && S5.db.t.project_events.some(e => e.entity_id === 'B22' && e.act === 'remove'));
    await pm5.close();
    // 360 px: ⏳ dialog and reason picker
    const ph = await X.dev(browser, S5, 'pm', { viewport: { width: 360, height: 740 }, me: { pm: 'John Burke' } }), f = ph.page;
    await f.evaluate(() => { DB.seqWaitWks = 1; pmTab = 'seq'; render(); }); await sleep(1200);
    await tap(f, '[data-seqold="B21"]', 500);
    let sc = await X.noScroll(f);
    let bh = await f.evaluate(() => [...document.querySelectorAll('.squ-dlg button')].map(b => Math.round(b.getBoundingClientRect().height)));
    console.log('   ⏳ dialog buttons at 360 px: ' + JSON.stringify(await f.evaluate(() => [...document.querySelectorAll('.squ-dlg button')].map(b => (b.id || b.className) + ' "' + b.textContent.trim() + '" ' + Math.round(b.getBoundingClientRect().height) + 'px'))));
    rec('H6 360 px ⏳ dialog: no sideways scroll, buttons ≥ 36 px', sc.sw <= sc.cw + 1 && bh.length >= 2 && Math.min(...bh) >= 36, JSON.stringify([sc, bh]));
    await f.evaluate(() => document.getElementById('sqw-rm').click()); await sleep(300);
    sc = await X.noScroll(f);
    bh = await f.evaluate(() => [...document.querySelectorAll('[data-why]')].map(b => Math.round(b.getBoundingClientRect().height)));
    rec('H7 360 px reason picker: no sideways scroll, reason buttons ≥ 36 px', sc.sw <= sc.cw + 1 && bh.length === 4 && Math.min(...bh) >= 36, JSON.stringify([sc, bh]));
    await ph.close();

    // ================= 6: SQL not run / lists off: no chip, no panel, nothing sent
    for (const [nm, S0] of [['SQL not run', (() => { const z = X.makeServer(null, { noSeq: true }); D.update(z.db, 'projects', D.find(z.db, 'projects', 'P1'), { pms: ['John Burke'] }); return z; })()], ['lists off', (() => { const z = X.makeServer(X.v1Row()); D.update(z.db, 'projects', D.find(z.db, 'projects', 'P1'), { pms: ['John Burke'] }); return z; })()]]) {
      const z = await X.dev(browser, S0, 'pm', { me: { pm: 'John Burke' } });
      await z.page.evaluate(() => { pmTab = ''; render(); }); await sleep(600);
      const t = await z.page.evaluate(() => document.body.innerText);
      rec('N ' + nm + ': PM home has no "to place / confirm", no ⬆ Cienapps file, no seq_ writes', !/to place \/ confirm/.test(t) && !/⬆ Cienapps file/.test(t) && !(S0.rpcCalls || []).some(c => /^seq_/.test(c.fn)), t.slice(0, 160));
      await z.close();
    }
    rec('no page errors', ![S1, S2, S3, S5].some(x => (x.errors || []).length), JSON.stringify([S1, S2, S3, S5].map(x => x.errors || [])));
  } finally { await browser.close(); }
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
