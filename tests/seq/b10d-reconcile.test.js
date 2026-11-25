// B10 step 4 (Job B part 6): seqReconcile — after a Cienapps import (after the P-number merge) the WOs take over their waiting
// rows: only when CERTAIN (one "same" row, or identical lines → in position order, one WO each, and no other WO wants them);
// "Apt 7" = "APT07"; different names in one house, two WOs for one row, a blank floor, "Multiple", "0" vs "T09" → nothing written
// (to confirm); a NEW WO with no possible row → 🆕 at the bottom; a P-number never takes a waiting row; after a P → WO merge
// no second row; another screen doing it first = no error, each WO on exactly one row; opening a page matches but never adds;
// lists off / SQL not run → nothing. Import counts unchanged. Fake Supabase only. Run: node tests/seq/b10d-reconcile.test.js
const X = require('./fixs.js');
const { H, D, rec, sleep } = X;
const C = 'Aderrig Homes';
const HDR = ['WO #', 'Title', 'Customer', 'Due Date', 'Step', 'Sub-Total', 'Reference', 'Floor', 'Unit'];
const W = (wo, t, f, u) => [wo, t, C, 46359, '4. READY FOR PRODUCTION', 5000, '2604-' + wo, f, u];
const FILE = [HDR, W('WO-50', 'HOUSE TYPE B LH', 'T09', '40'), W('WO-51', 'HOUSE TYPE B UTILITY LH', 'T09', '40'),
  W('WO-521', 'HOUSE TYPE B BED 2', 'T09', '41'), W('WO-522', 'HOUSE TYPE B BED 2', 'T09', '41'),
  W('WO-53', 'HOUSE TYPE B BED 1', 'T09', '42'), W('WO-541', 'HOUSE TYPE C', 'T09', '43'), W('WO-542', 'HOUSE TYPE C', 'T09', '43'),
  W('WO-55', 'HOUSE TYPE C', 'T09', '44'), W('WO-56', 'HOUSE TYPE C', 'T09', '45'), W('WO-57', 'HOUSE TYPE A', 'T09', 'APT07'),
  W('WO-58', 'HOUSE TYPE A', 'T10', '46'), W('WO-59', 'HOUSE TYPE D', 'T09', '48'), W('WO-60', 'HOUSE TYPE D', '0', '49')];
function server(opt) {
  const row = X.v2Row();
  row.orders.push(H.order({ wo: 'P-1010', pid: 'P1', customer: C, floor: 'T09', unit: '47', title: 'HOUSE TYPE C', step: 'Planner WO', value: 0, plannedWeek: '', dueDate: '2026-12-10', origDueDate: '2026-12-10', log: [] }),
    H.order({ wo: 'P-1011', pid: 'P1', customer: C, floor: 'T09', unit: '48', title: 'HOUSE TYPE D', step: 'Planner WO', value: 0, plannedWeek: '', dueDate: '2026-12-10', origDueDate: '2026-12-10', log: [] }));
  const S = X.makeServer(opt && opt.v1 ? X.v1Row() : row, opt && opt.noSeq ? { noSeq: true } : {});
  if (opt && (opt.v1 || opt.noSeq)) return S;
  D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
  const U = (id, f, u, p, n, kind) => X.seqRow(S, id, 'P1', { floor: f, unit: u, product: p, name: n, kind, src: 'upload', upload_id: 'UP1', why: 'Cienapps upload: a.xlsx' });
  U('U1', 'T09', '40', 'K8', 'HOUSE TYPE B LH', 'kitchen'); U('U2', 'T09', '40', 'K2', 'HOUSE TYPE B UTILITY LH', 'utility');
  U('U3a', 'T09', '41', 'W2', 'HOUSE TYPE B BED 2', 'robes'); U('U3b', 'T09', '41', 'W2', 'HOUSE TYPE B BED 2', 'robes');
  U('U4a', 'T09', '42', 'W2', 'HOUSE TYPE B BED 1', 'robes'); U('U4b', 'T09', '42', 'W1', 'HOUSE TYPE B BED 2', 'robes');
  U('U5', 'T09', '43', 'K8', 'HOUSE TYPE C', 'kitchen'); U('U6', '', '44', 'K8', 'HOUSE TYPE C', 'kitchen'); U('U7', 'Multiple', '45', 'K8', 'HOUSE TYPE C', 'kitchen');
  U('U8', 'T09', 'Apt 7', 'K8', 'HOUSE TYPE A', 'kitchen'); U('U9', 'T09', '46', 'K8', 'HOUSE TYPE A', 'kitchen'); U('U10', 'T09', '47', 'K8', 'HOUSE TYPE C', 'kitchen');
  U('U11', 'T09', '49', 'K8', 'HOUSE TYPE D', 'kitchen');
  X.seqRow(S, 'RP', 'P1', { wo: 'P-1011', floor: 'T09', unit: '48', descr: 'HOUSE TYPE D', kind: 'kitchen', src: 'manual' });
  return S;
}
const rowOf = (S, id) => D.find(S.db, 'project_seq', id);
const woRows = (S, wo) => S.db.t.project_seq.filter(r => r.wo === wo && r.state !== 'removed');
async function apply(p) {
  await p.evaluate(() => { SEQ_REC_RUN = null; document.getElementById('imp-apply').click(); });
  for (let i = 0; i < 80 && !(await p.evaluate(() => !!SEQ_REC_RUN)); i++) await sleep(100);
  return p.evaluate(async () => { const r = SEQ_REC_RUN ? await SEQ_REC_RUN : null; return r; });
}
(async () => {
  const browser = await H.chromium.launch();
  try {
    // ---- lists off / SQL not run: an import does nothing new
    for (const [nm, opt] of [['lists switched off', { v1: true }], ['SQL not run', { noSeq: true }]]) {
      const S0 = server(opt); const a0 = await X.dev(browser, S0, 'office');
      await H.importAoa(a0.page, FILE); await sleep(200);
      const r0 = await a0.page.evaluate(() => { document.getElementById('imp-apply').click(); return new Promise(r => setTimeout(() => r({ run: SEQ_REC_RUN, t: (document.getElementById('iprev') || {}).innerText || '' }), 1200)); });
      rec(nm + ': import applied as before, no sequence matching, no "Sequence:" line, no sequence calls', r0.run === null && /Import applied/.test(r0.t) && !/Sequence:/.test(r0.t) && !(S0.rpcCalls || []).some(c => /^seq_/.test(c.fn)), JSON.stringify([r0.run, (S0.rpcCalls || []).map(c => c.fn)]));
      await a0.close();
    }
    // ---- with the SQL
    const S = server();
    const a = await X.dev(browser, S, 'office'), p = a.page;
    const imp = await H.importAoa(p, FILE); await sleep(200);
    rec('preview offers the certain P-1011 → WO-59 merge, pre-ticked', await p.evaluate(() => !!document.querySelector('[data-pmg="P-1011"][value="WO-59"]:checked')));
    const R = await apply(p);
    const ip = await p.evaluate(() => DB.orders.filter(o => /^WO-(5\d+|60)$/.test(o.wo)).length);
    rec('the import itself did what it always does (13 new WOs on the planner)', ip === 13, ip);
    rec('result: 5 matched · 1 added as 🆕 · 6 to confirm', R && R.matched === 5 && R.added === 1 && R.confirm === 6 && !R.fail, JSON.stringify(R));
    const L = await p.evaluate(() => ((document.getElementById('imp-seqrec') || {}).innerText || '').replace(/\s+/g, ' '));
    rec('import screen: "🔢 Sequence: 5 matched · 1 added as 🆕 · 6 to confirm" + [Open Aderrig (6 to confirm)]', /Sequence: 5 matched · 1 added as 🆕 · 6 to confirm/.test(L) && /Open Aderrig \(6 to confirm\)/.test(L), L);
    rec('WO-50 → U1 (kitchen), WO-51 → U2 (utility): auto, matched', rowOf(S, 'U1').wo === 'WO-50' && rowOf(S, 'U2').wo === 'WO-51' && rowOf(S, 'U1').match_how === 'auto' && rowOf(S, 'U1').state === 'matched');
    rec('two identical "BED 2" rows + two BED 2 WOs: in position order, one each (WO-521 → U3a, WO-522 → U3b)', rowOf(S, 'U3a').wo === 'WO-521' && rowOf(S, 'U3b').wo === 'WO-522');
    rec('"Apt 7" row = WO unit "APT07": automatic (WO-57 → U8)', rowOf(S, 'U8').wo === 'WO-57');
    rec('different names in one house (BED 1 / BED 2) → nobody takes U4a / U4b on their own', !rowOf(S, 'U4a').wo && !rowOf(S, 'U4b').wo && !woRows(S, 'WO-53').length);
    rec('two WOs for one row (WO-541, WO-542 / U5) → neither takes it', !rowOf(S, 'U5').wo && !woRows(S, 'WO-541').length && !woRows(S, 'WO-542').length);
    rec('blank floor (U6), "Multiple" (U7), "0" vs "T09" (U11): never automatic', !rowOf(S, 'U6').wo && !rowOf(S, 'U7').wo && !rowOf(S, 'U11').wo && !woRows(S, 'WO-55').length && !woRows(S, 'WO-56').length && !woRows(S, 'WO-60').length);
    rec('T10 / 46 never takes the T09 / 46 row: WO-58 added as 🆕 at the bottom (is_new, src import)', !rowOf(S, 'U9').wo && woRows(S, 'WO-58').length === 1 && woRows(S, 'WO-58')[0].is_new && woRows(S, 'WO-58')[0].src === 'import' && woRows(S, 'WO-58')[0].pos === X.DS.liveOf(S.db, 'P1').length);
    rec('a P-number never takes a waiting row (P-1010 / U10 stays waiting)', !rowOf(S, 'U10').wo && rowOf(S, 'U10').state === 'waiting');
    rec('after the P-1011 → WO-59 merge: the row RP is handed over, no second row for WO-59', rowOf(S, 'RP').wo === 'WO-59' && woRows(S, 'WO-59').length === 1, JSON.stringify(woRows(S, 'WO-59').map(r => r.id)));
    rec('older WOs with no row (WO-1 … WO-4) are NOT added on their own — not new in this import', ['WO-1', 'WO-2', 'WO-3', 'WO-4'].every(w => !woRows(S, w).length));
    rec('every WO on at most one live row', (() => { const m = {}; S.db.t.project_seq.filter(r => r.state !== 'removed' && r.wo).forEach(r => { m[r.wo] = (m[r.wo] || 0) + 1; }); return Object.values(m).every(n => n === 1); })());
    // ---- the same import again (another PC / a second run): nothing more written
    const n1 = (S.rpcCalls || []).length;
    const R2 = await p.evaluate(async () => seqReconcile(['P1'], new Set(['WO-50', 'WO-58'].map(woKey))));
    rec('run again: 0 matched, 0 added, 6 to confirm, nothing written', R2 && R2.matched === 0 && R2.added === 0 && R2.confirm === 6 && (S.rpcCalls || []).slice(n1).length === 0, JSON.stringify([R2, (S.rpcCalls || []).slice(n1).map(c => c.fn)]));
    // ---- another PC matches first: a refusal is no error, the WO stays on one row
    X.seqRow(S, 'U20', 'P1', { floor: 'T09', unit: '60', product: 'K8', name: 'HOUSE TYPE E', kind: 'kitchen', src: 'upload' });
    X.seqRow(S, 'U21', 'P1', { floor: 'T09', unit: '61', product: 'K8', name: 'HOUSE TYPE E', kind: 'kitchen', src: 'upload' });
    await p.evaluate(() => { DB.orders.push({ ...DB.orders.find(o => o.wo === 'WO-50'), wo: 'WO-70', floor: 'T09', unit: '60', title: 'HOUSE TYPE E', ref: '' }, { ...DB.orders.find(o => o.wo === 'WO-50'), wo: 'WO-71', floor: 'T09', unit: '62', title: 'HOUSE TYPE E', ref: '' }); });
    S.beforeRpc = (fn, args) => { if (fn === 'seq_match' && args.p_wo === 'WO-70') { S.beforeRpc = null; X.DS.RPC.seq_match(S.db, { p_id: 'U20', p_wo: 'WO-70', p_how: 'confirmed', p_by: 'Other PC' }); } };
    S.beforeRpc2 = null;
    const R3 = await p.evaluate(async () => { const r = await seqReconcile(['P1'], new Set(['WO-71'].map(woKey))); return r; });
    rec('another PC matched WO-70 a moment before: refused quietly, WO-70 on ONE row (U20), WO-71 added as 🆕 (no T09 / 62 row)', R3 && !R3.fail && woRows(S, 'WO-70').length === 1 && rowOf(S, 'U20').wo === 'WO-70' && woRows(S, 'WO-71').length === 1 && !rowOf(S, 'U21').wo, JSON.stringify(R3));
    S.beforeRpc = (fn, args) => { if (fn === 'seq_insert') { S.beforeRpc = null; X.seqRow(S, 'OTH', 'P1', { wo: 'WO-72', floor: 'T09', unit: '63', kind: 'kitchen', src: 'import', is_new: true }); } };
    await p.evaluate(() => { DB.orders.push({ ...DB.orders.find(o => o.wo === 'WO-50'), wo: 'WO-72', floor: 'T09', unit: '63', title: 'HOUSE TYPE E', ref: '' }); });
    const R4 = await p.evaluate(async () => seqReconcile(['P1'], new Set(['WO-72'].map(woKey))));
    rec('another PC added the 🆕 row first: skipped by the database, still ONE row for WO-72, no error', R4 && !R4.fail && woRows(S, 'WO-72').length === 1 && woRows(S, 'WO-72')[0].id === 'OTH', JSON.stringify([R4, woRows(S, 'WO-72').map(r => r.id)]));
    // ---- no answer from the database: counted, not shown as done
    X.seqRow(S, 'U30', 'P1', { floor: 'T09', unit: '64', product: 'K8', name: 'HOUSE TYPE F', kind: 'kitchen', src: 'upload' });
    await p.evaluate(() => { DB.orders.push({ ...DB.orders.find(o => o.wo === 'WO-50'), wo: 'WO-73', floor: 'T09', unit: '64', title: 'HOUSE TYPE F', ref: '' }); });
    S.dropReplyS = 1;
    const R5 = await p.evaluate(async () => seqReconcile(['P1'], null));
    rec('lost reply on a match: counted as "not saved (no answer)", the database has it once', R5 && R5.fail === 1 && woRows(S, 'WO-73').length === 1, JSON.stringify(R5));
    rec('office: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await a.close();
    // ---- page open: an editor's page matches what is certain, never adds; a look-only screen writes nothing
    X.seqRow(S, 'U40', 'P1', { floor: 'T09', unit: '65', product: 'K8', name: 'HOUSE TYPE G', kind: 'kitchen', src: 'upload' });
    S.row.orders.push(H.order({ wo: 'WO-80', customer: C, floor: 'T09', unit: '65', title: 'HOUSE TYPE G', dueDate: '2026-12-03', origDueDate: '2026-12-03', plannedWeek: '' }),
      H.order({ wo: 'WO-81', customer: C, floor: 'T09', unit: '66', title: 'HOUSE TYPE G', dueDate: '2026-12-03', origDueDate: '2026-12-03', plannedWeek: '' }));
    const st = await X.dev(browser, S, 'stores'); const n2 = (S.rpcCalls || []).length;
    await st.page.evaluate(() => seqOpen('P1')); await sleep(1200);
    rec('stores opens the sequence: nothing written', (S.rpcCalls || []).slice(n2).length === 0 && !rowOf(S, 'U40').wo);
    await st.close();
    const pm = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
    await pm.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(1500);
    rec('PM opens his sequence: WO-80 takes U40 (certain), WO-81 (no possible row) is NOT added by opening the page', rowOf(S, 'U40').wo === 'WO-80' && rowOf(S, 'U40').match_how === 'auto' && !woRows(S, 'WO-81').length, JSON.stringify((S.rpcCalls || []).slice(n2).map(c => c.fn)));
    rec('the page shows WO-80 on its row', await pm.page.evaluate(() => [...document.querySelectorAll('tr.seq-r')].some(tr => /WO-80/.test(tr.innerText))));
    const n3 = (S.rpcCalls || []).length;
    await pm.page.evaluate(() => { render(); }); await sleep(600);
    rec('redraws within a minute do not run it again', (S.rpcCalls || []).slice(n3).length === 0);
    rec('PM: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await pm.close();
  } finally { await browser.close(); }
  X.finish();
})();
