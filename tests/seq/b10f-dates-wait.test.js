// B10 step 6 (Job B part 6): "📅 Dates to agree" — a matched row whose own required date (set before the WO existed) differs
// from the job's delivery date: "Row asked 12 Dec · Cienapps 19 Dec — [Use 12 Dec] [Keep 19 Dec]". Use = the date engine
// (moveDates src 'pmseq', reason "Sequence date — set before the WO existed"; inside the fixed window a PM's change becomes a
// request); either button clears the row's date. "⏳ not in Cienapps yet?" on rows waiting longer than seqWaitWks() weeks →
// "Uploaded <date> by <name>, file <name>, row N" → Keep waiting / Remove this row… (reason, seq_remove, kept in History).
// Lists off → nothing. Fake Supabase only. Run: node tests/seq/b10f-dates-wait.test.js
const X = require('./fixs.js');
const { H, D, rec, sleep } = X;
const rowOf = (S, id) => D.find(S.db, 'project_seq', id);
const tap = async (p, sel) => { const ok = await p.evaluate(s => { const b = document.querySelector(s); if (!b) return false; b.click(); return true; }, sel); await sleep(900); return ok; };
const toastTxt = p => p.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
function server() {
  const S = X.makeServer();
  D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
  X.seqRow(S, 'A1', 'P1', { wo: 'WO-3', floor: 'T09', unit: '13', descr: 'HOUSE TYPE C', req_date: '2026-12-11', src: 'upload' });
  X.seqRow(S, 'A2', 'P1', { wo: 'WO-4', floor: 'T09', unit: '13', descr: 'HOUSE TYPE C UTILITY', kind: 'utility', req_date: '2026-11-27', src: 'upload' });
  X.seqRow(S, 'A3', 'P1', { wo: 'WO-1', req_date: '2026-10-30', src: 'upload' });
  X.seqRow(S, 'A4', 'P1', { wo: 'WO-2', req_date: '2026-10-22', src: 'upload' }); S.row.orders.find(o => o.wo === 'WO-2').delivDate = '2026-10-22'; // the same date: nothing to agree
  const w1 = X.seqRow(S, 'W1', 'P1', { floor: 'T09', unit: '30', product: 'K8', name: 'HOUSE TYPE B <b>LH</b>', src: 'upload', upload_id: 'U1', line_no: 7, why: 'Cienapps upload: phase1.xlsx', updated_by: 'John Burke' });
  w1.created_at = '2026-09-10T09:00:00.000Z';
  const w2 = X.seqRow(S, 'W2', 'P1', { floor: 'T09', unit: '31', product: 'K8', name: 'HOUSE TYPE B', src: 'upload', why: 'Cienapps upload: phase1.xlsx' }); w2.created_at = '2026-10-15T09:00:00.000Z';
  const w3 = X.seqRow(S, 'W3', 'P1', { floor: 'T09', unit: '32', product: 'K8', name: 'HOUSE TYPE B', src: 'upload', line_no: 9, why: 'Cienapps upload: phase0.xlsx', updated_by: 'Mary Kelly' });
  w3.created_at = '2026-09-01T09:00:00.000Z'; X.DS.seqUpdate(S.db, w3, { req_date: '2026-12-01', why: 'Customer delay', updated_by: 'John Burke' }, false);
  return S;
}
(async () => {
  const browser = await H.chromium.launch();
  try {
    const S0 = X.makeServer(X.v1Row()); const o0 = await X.dev(browser, S0, 'office');
    rec('lists switched off: no Dates to agree, no ⏳ flag (no sequence page)', await o0.page.evaluate(() => !/seq-agree|seq-old/.test(seqPageHTML('P1')) && seqAgreeRows('P1').length === 0));
    await o0.close();
    const S = server();
    const st = await X.dev(browser, S, 'stores');
    const sr = await st.page.evaluate(() => { seqOpen('P1'); return new Promise(r => setTimeout(() => r({ ag: !!document.getElementById('seq-agree'), old: document.querySelectorAll('[data-seqold]').length }), 700)); });
    rec('stores (look only): no Dates to agree; the ⏳ flag shows (look only)', !sr.ag && sr.old === 2, JSON.stringify(sr));
    await st.page.evaluate(() => document.querySelector('[data-seqold="W1"]').click()); await sleep(400);
    rec('stores: the ⏳ dialog has no Keep / Remove buttons', await st.page.evaluate(() => !!document.getElementById('sqw-b') && !document.getElementById('sqw-rm')));
    await st.close();
    const pm = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } }), p = pm.page;
    await p.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(1200);
    const ag = await p.evaluate(() => { const e = document.getElementById('seq-agree'); return e ? e.innerText.replace(/\s+/g, ' ') : ''; });
    rec('Dates to agree (3): WO-3 "Row asked 11 Dec · Cienapps no delivery date", WO-4 "27 Nov · Cienapps 25 Nov"; WO-2 (same date) not listed', /Dates to agree \(3\)/.test(ag) && /WO-3.*Row asked 11 Dec · Cienapps no delivery date/.test(ag) && /WO-4.*Row asked 27 Nov · Cienapps 25 Nov/.test(ag) && /Use Fri 11 Dec/.test(ag) && /Keep 25 Nov/.test(ag) && !/WO-2/.test(ag), ag);
    // Use 11 Dec: through the date engine
    await tap(p, '[data-sequse="A1"]'); await sleep(300);
    const o3 = await p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-3'); return { d: o.delivDate, due: o.dueDate, h: (o.dueHist || []).map(x => x.f + ':' + x.to + ':' + x.why + ':' + x.src) }; });
    rec('Use 11 Dec: WO-3 delivery 11 Dec, build date before it, history "Sequence date — set before the WO existed" (pmseq)', o3.d === '2026-12-11' && o3.due < '2026-12-11' && o3.h.some(x => /Sequence date — set before the WO existed:pmseq/.test(x)), JSON.stringify(o3));
    rec('…and the row\'s own date is cleared', rowOf(S, 'A1').req_date === null);
    await p.evaluate(() => document.querySelectorAll('.seq-res').forEach(x => x.remove()));
    // Keep: the job's date stays, the row's date is cleared
    await tap(p, '[data-seqkeep="A2"]');
    rec('Keep 25 Nov: WO-4 unchanged, the row\'s date cleared', rowOf(S, 'A2').req_date === null && await p.evaluate(() => DB.orders.find(x => x.wo === 'WO-4').delivDate === '2026-11-25'), await toastTxt(p));
    // inside the fixed window: a PM's Use → a change request (nothing moves), the row's date cleared
    const d1 = await p.evaluate(() => DB.orders.find(x => x.wo === 'WO-1').dueDate);
    await tap(p, '[data-sequse="A3"]'); await sleep(300);
    const rq = S.db.t.seq_requests.filter(q => q.status === 'open' && (q.wos || []).includes('WO-1'));
    rec('WO-1 inside the fixed window: PM\'s Use sends ONE change request, WO-1 not moved, the row\'s date cleared', rq.length === 1 && rq[0].why === 'Sequence date — set before the WO existed' && await p.evaluate(d1 => DB.orders.find(x => x.wo === 'WO-1').dueDate === d1, d1) && rowOf(S, 'A3').req_date === null, JSON.stringify(rq.map(q => q.why)));
    await p.evaluate(() => document.querySelectorAll('.seq-res').forEach(x => x.remove())); await p.evaluate(() => render()); await sleep(300);
    rec('Dates to agree gone once all are answered', await p.evaluate(() => !document.getElementById('seq-agree')));
    // ⏳ not in Cienapps yet?
    const fl = await p.evaluate(() => [...document.querySelectorAll('[data-seqold]')].map(b => b.dataset.seqold + ':' + b.textContent));
    rec('⏳ "not in Cienapps yet?" on W1 and W3 (older than 3 weeks), not on W2 (6 days)', JSON.stringify(fl) === '["W1:⏳ not in Cienapps yet?","W3:⏳ not in Cienapps yet?"]', JSON.stringify(fl));
    await tap(p, '[data-seqold="W1"]');
    let b = await p.evaluate(() => (document.getElementById('sqw-b') || {}).innerText || '');
    rec('W1: "Uploaded 10 Sept 2026 by John Burke, file phase1.xlsx, row 7 … check Cienapps"', /Uploaded 10 Sept? 2026 by John Burke, file phase1\.xlsx, row 7/.test(b) && /check Cienapps/.test(b), b);
    rec('names escaped in the dialog', await p.evaluate(() => !document.querySelector('.squ-dlg b b') && /<b>LH<\/b>/.test(document.querySelector('.squ-dlg').innerText)));
    await tap(p, '#sqw-keep');
    rec('Keep waiting: closed, nothing written', await p.evaluate(() => !document.getElementById('sqw-b')) && rowOf(S, 'W1').state === 'waiting');
    await tap(p, '[data-seqold="W3"]'); await sleep(300);
    b = await p.evaluate(() => (document.getElementById('sqw-b') || {}).innerText || '');
    rec('W3 (its note was replaced by a date change): the file name comes from History — "file phase0.xlsx, row 9", by Mary Kelly', /Uploaded 1 Sept? 2026 by Mary Kelly, file phase0\.xlsx, row 9/.test(b), b);
    await p.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
    // Remove this row…
    await tap(p, '[data-seqold="W1"]');
    await p.evaluate(() => document.getElementById('sqw-rm').click()); await sleep(200);
    const rs = await p.evaluate(() => [...document.querySelectorAll('[data-why]')].map(x => x.dataset.why));
    rec('Remove this row… asks why (Not ordered / cancelled, Uploaded twice, Wrong project, Other)', JSON.stringify(rs) === '["Not ordered / cancelled","Uploaded twice","Wrong project","Other"]', JSON.stringify(rs));
    await p.evaluate(() => document.querySelector('[data-why="Uploaded twice"]').click()); await sleep(900);
    rec('removed: kept in the database (state removed, reason), never deleted; History "remove"', rowOf(S, 'W1') && rowOf(S, 'W1').state === 'removed' && rowOf(S, 'W1').why === 'Uploaded twice' && S.db.t.project_events.some(e => e.entity_id === 'W1' && e.act === 'remove') && !S.deniedS, await toastTxt(p));
    rec('the page no longer shows W1', await p.evaluate(() => !document.querySelector('[data-seqr="W1"]')));
    rec('PM: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await pm.close();
    // phone 360 px
    const S2 = server(); const ph = await X.dev(browser, S2, 'pm', { viewport: { width: 360, height: 740 }, me: { pm: 'John Burke' } });
    await ph.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(1200);
    const sc = await X.noScroll(ph.page);
    rec('phone 360 px: Dates to agree + ⏳ fit, no sideways scroll', sc.sw <= sc.cw + 1 && await ph.page.evaluate(() => !!document.getElementById('seq-agree') && !!document.querySelector('[data-seqold]')), JSON.stringify(sc));
    await ph.close();
  } finally { await browser.close(); }
  X.finish();
})();
