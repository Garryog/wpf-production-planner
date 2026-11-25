// B10 step 5 (Job B part 6): "📌 To place / confirm" at the top of the sequence page (editors only, worked out each time) —
// a WO with possible rows → "which row is it?" (the row whose Name = the WO title listed first, never chosen on its own) → one
// tap = seq_match 'confirmed' (version-checked; stale → "changed on another screen"); two WOs / one row → both listed, the first
// confirmed takes it; WOs with no row → ➕ add at the bottom (one / all, 🆕); possible doubles → [Use the waiting row] retires
// the 🆕 row (kept, History) and matches the waiting row, put back if that fails; nudge "N to place / confirm"; look-only and
// lists-off screens see nothing; names escaped; 360 px. Fake Supabase only. Run: node tests/seq/b10e-confirm.test.js
const X = require('./fixs.js');
const { H, D, rec, sleep } = X;
const C = 'Aderrig Homes';
const J = (wo, f, u, t) => H.order({ wo, customer: C, floor: f, unit: u, title: t, dueDate: '2026-12-03', origDueDate: '2026-12-03', plannedWeek: '', step: '4. READY FOR PRODUCTION' });
function server() {
  const row = X.v2Row();
  row.orders.push(J('WO-53', 'T09', '42', 'HOUSE TYPE B BED 2'), J('WO-541', 'T09', '43', 'HOUSE TYPE C'), J('WO-542', 'T09', '43', 'HOUSE TYPE C'),
    J('WO-55', 'T09', '44', 'HOUSE TYPE C <img src=x onerror="window.__x=1">'), J('WO-90', 'T09', '50', 'HOUSE TYPE K'), J('WO-91', 'T09', '51', 'HOUSE TYPE K'));
  const S = X.makeServer(row);
  D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
  const U = (id, f, u, p, n, kind) => X.seqRow(S, id, 'P1', { floor: f, unit: u, product: p, name: n, kind, src: 'upload', upload_id: 'UP1', why: 'Cienapps upload: a.xlsx' });
  U('U4a', 'T09', '42', 'W2', 'HOUSE TYPE B BED 1', 'robes'); U('U4b', 'T09', '42', 'W1', 'HOUSE TYPE B BED 2', 'robes');
  U('U5', 'T09', '43', 'K8', 'HOUSE TYPE C', 'kitchen'); U('U6', '', '44', 'K8', 'HOUSE TYPE C', 'kitchen');
  U('U9', '0', '50', 'K8', 'HOUSE TYPE K', 'kitchen'); U('U10', '0', '51', 'K8', 'HOUSE TYPE K', 'kitchen');
  X.seqRow(S, 'N1', 'P1', { wo: 'WO-90', floor: 'T09', unit: '50', descr: 'HOUSE TYPE K', kind: 'kitchen', src: 'import', is_new: true });
  X.seqRow(S, 'N2', 'P1', { wo: 'WO-91', floor: 'T09', unit: '51', descr: 'HOUSE TYPE K', kind: 'kitchen', src: 'import', is_new: true });
  return S;
}
const rowOf = (S, id) => D.find(S.db, 'project_seq', id);
const woRows = (S, wo) => S.db.t.project_seq.filter(r => r.wo === wo && r.state !== 'removed');
const cf = p => p.evaluate(() => { const e = document.getElementById('seq-cf'); return e ? e.innerText.replace(/\s+/g, ' ') : ''; });
const tap = async (p, sel) => { const ok = await p.evaluate(s => { const b = document.querySelector(s); if (!b) return false; b.click(); return true; }, sel); await sleep(700); return ok; };
const toastTxt = p => p.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
(async () => {
  const browser = await H.chromium.launch();
  try {
    // ---- lists off: nothing
    const S0 = X.makeServer(X.v1Row()); const o0 = await X.dev(browser, S0, 'office');
    rec('lists switched off: no panel, no sequence calls', await o0.page.evaluate(() => !/seq-cf/.test(seqPageHTML('P1')) && seqConfirmCount('P1') === 0) && X.SS.seqCalls(S0).length === 0);
    await o0.close();
    const S = server();
    // ---- look only
    const st = await X.dev(browser, S, 'stores');
    rec('stores (look only): the page has no To place / confirm', await st.page.evaluate(() => { seqOpen('P1'); return new Promise(r => setTimeout(() => r(!!document.getElementById('seq-pg') && !document.getElementById('seq-cf')), 600)); }));
    await st.close();
    // ---- PM
    const pm = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } }), p = pm.page;
    await p.evaluate(() => { pmTab = ''; render(); }); await sleep(300);
    const nb = await p.evaluate(() => (document.querySelector('.seq-nudge') || {}).innerText || '');
    rec('PM home nudge: "10 to place / confirm" (4 to confirm, 4 not in the sequence, 2 possible doubles)', /10 to place \/ confirm/.test(nb), nb);
    await p.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(1200);
    let t = await cf(p);
    rec('panel "📌 To place / confirm (10)" at the top of the page', /To place \/ confirm \(10\)/.test(t) && await p.evaluate(() => { const pg = document.getElementById('seq-pg'), c = document.getElementById('seq-cf'); return !!c && !!(pg.querySelector('.seq-tbl')) && (c.compareDocumentPosition(pg.querySelector('.seq-tbl')) & 4) !== 0; }), t.slice(0, 120));
    rec('nothing matched on its own by opening the page', !rowOf(S, 'U4a').wo && !rowOf(S, 'U4b').wo && !rowOf(S, 'U5').wo && !rowOf(S, 'U6').wo);
    const order = await p.evaluate(() => [...document.querySelectorAll('[data-seqcfwo="WO-53"]')].map(b => b.dataset.seqcf));
    rec('WO-53 "HOUSE TYPE B BED 2": both rows offered, the row named "HOUSE TYPE B BED 2" (U4b) FIRST', JSON.stringify(order) === '["U4b","U4a"]', JSON.stringify(order));
    rec('names escaped (no element, nothing ran)', await p.evaluate(() => !document.querySelector('#seq-cf img') && window.__x === undefined));
    await tap(p, '[data-seqcf="U4b"][data-seqcfwo="WO-53"]');
    rec('tap → WO-53 on U4b (confirmed); U4a still waiting', rowOf(S, 'U4b').wo === 'WO-53' && rowOf(S, 'U4b').match_how === 'confirmed' && !rowOf(S, 'U4a').wo, await toastTxt(p));
    rec('WO-53 gone from the panel', !/WO-53/.test(await cf(p)));
    // two WOs / one row: both listed, the first confirmed takes it
    const both = await p.evaluate(() => ['WO-541', 'WO-542'].map(w => [...document.querySelectorAll('[data-seqcfwo="' + w + '"]')].map(b => b.dataset.seqcf).join()));
    rec('two WOs for one row: WO-541 and WO-542 both offered U5', JSON.stringify(both) === '["U5","U5"]', JSON.stringify(both));
    await tap(p, '[data-seqcf="U5"][data-seqcfwo="WO-541"]');
    t = await cf(p);
    rec('WO-541 confirmed takes U5; WO-542 now has no possible row → "Not in the sequence yet … ➕ Add at the bottom"', rowOf(S, 'U5').wo === 'WO-541' && /Not in the sequence yet \(5\)/.test(t) && await p.evaluate(() => !!document.querySelector('[data-seqcfnew="WO-542"]') && !document.querySelector('[data-seqcfwo="WO-542"]')), t.slice(0, 300));
    // stale: another screen changed U6 meanwhile
    X.DS.seqUpdate(S.db, rowOf(S, 'U6'), { req_date: '2026-12-20', updated_by: 'Other PC' }, false);
    await tap(p, '[data-seqcf="U6"][data-seqcfwo="WO-55"]');
    t = await toastTxt(p);
    rec('stale (U6 changed on another screen): not matched, "changed on another screen — look again"', !rowOf(S, 'U6').wo && /changed on another screen/.test(t), t);
    await tap(p, '[data-seqcf="U6"][data-seqcfwo="WO-55"]');
    rec('tap again on the fresh page: WO-55 on U6', rowOf(S, 'U6').wo === 'WO-55');
    // ➕ add one / all
    await tap(p, '[data-seqcfnew="WO-542"]');
    rec('➕ Add at the bottom: WO-542 gets a 🆕 row at the bottom (src manual, is_new)', woRows(S, 'WO-542').length === 1 && woRows(S, 'WO-542')[0].is_new && woRows(S, 'WO-542')[0].pos === X.DS.liveOf(S.db, 'P1').length, JSON.stringify(woRows(S, 'WO-542')));
    await tap(p, '#seq-cfall');
    rec('➕ Add all 4 at the bottom: WO-1 … WO-4 each one 🆕 row', ['WO-1', 'WO-2', 'WO-3', 'WO-4'].every(w => woRows(S, w).length === 1 && woRows(S, w)[0].is_new), await toastTxt(p));
    // possible doubles
    t = await cf(p);
    rec('possible doubles listed: WO-90 🆕 row and the waiting row "0 · 50" (❓ level or block)', /Possible double: WO-90/.test(t) && /level or block/.test(t), t);
    await tap(p, '[data-seqdbl="N1"][data-seqdblw="U9"]');
    rec('[Use the waiting row]: the 🆕 row is taken out (kept, "double"), WO-90 on U9', rowOf(S, 'N1').state === 'removed' && /double/.test(rowOf(S, 'N1').why) && rowOf(S, 'U9').wo === 'WO-90' && woRows(S, 'WO-90').length === 1, JSON.stringify([rowOf(S, 'N1').state, rowOf(S, 'U9').wo]));
    rec('History has the remove and the match', S.db.t.project_events.some(e => e.entity_id === 'N1' && e.act === 'remove') && S.db.t.project_events.some(e => e.entity_id === 'U9' && e.act === 'match'));
    // failure: another screen gives U10 a WO a moment before → the 🆕 row is put back
    S.beforeRpc = (fn) => { if (fn === 'seq_match') { S.beforeRpc = null; X.DS.RPC.seq_match(S.db, { p_id: 'U10', p_wo: 'WO-99', p_how: 'confirmed', p_by: 'Other PC' }); } };
    await tap(p, '[data-seqdbl="N2"][data-seqdblw="U10"]');
    t = await toastTxt(p);
    rec('waiting row taken meanwhile: not changed, the 🆕 row is put back (live, WO-91)', rowOf(S, 'N2').state === 'matched' && woRows(S, 'WO-91').length === 1 && /the 🆕 row is back/.test(t), t);
    rec('a removed WO row is never brought back by matching (WO-90 stays on U9 only)', woRows(S, 'WO-90').length === 1 && await p.evaluate(() => !seqWOPlan('P1').jobs.some(j => j.o.wo === 'WO-90')));
    rec('PM: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await pm.close();
    // ---- phone 360 px
    const S2 = server();
    const ph = await X.dev(browser, S2, 'pm', { viewport: { width: 360, height: 740 }, me: { pm: 'John Burke' } });
    await ph.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(1200);
    const sc = await X.noScroll(ph.page);
    const bh = await ph.page.evaluate(() => Math.min(...[...document.querySelectorAll('#seq-cf .btn')].map(b => b.getBoundingClientRect().height)));
    rec('phone 360 px: panel fits, no sideways scroll, buttons ≥ 36 px', sc.sw <= sc.cw + 1 && bh >= 36 && await ph.page.evaluate(() => !!document.getElementById('seq-cf')), JSON.stringify([sc, bh]));
    await ph.close();
  } finally { await browser.close(); }
  X.finish();
})();
