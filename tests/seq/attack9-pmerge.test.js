// Tester attack 9 (11 Nov 2026) on feature/project-details-v2 (0632203) — L4b: a P-number merged into the Cienapps WO at import.
//  M1  which pairs are offered / pre-ticked: "GF" vs "0", "Apt 7" vs "APT07", blank floor, same unit in two blocks, two kitchen WOs for
//      one house, one WO for two P-numbers, kitchen vs utility, another project, a customer not linked to any project.
//  M2  ticking rules: two P-numbers for one WO refused; nothing imported.
//  M3  two PCs pressing Apply on the same import at the same moment: merged once, never two WOs / two copies / doubled history.
//  M4  a stale screen (still showing the P-job) edits it and saves after the merge: the P-job must not come back as a second job.
//  M5  P-job with a sequence row when the WO already has one: no live sequence row left pointing at a job that is gone.
//  M6  merge then Cienapps moves the step on / the same file again: one WO, P not offered again, planner date kept.
//  M7  P-job further on (cut by hand) than the WO: higher step kept, then an import behind does not take it back.
//  M8  P-job both booked AND loaded on a van, WO booked too.
//  M9  P-job shipped by hand (S1) before the WO arrives.
// Findings are marked [HIGH] / [MEDIUM] / [LOW] in the check name, with steps / expected / actual in the comment above.
// Fake Supabase only (tests/seq/srvs.js). Run: node tests/seq/attack9-pmerge.test.js
const X = require('./fixs.js');
const { H, D, rec, sleep } = X;
const HDR = ['WO #', 'Title', 'Customer', 'Due Date', 'Step', 'Sub-Total', 'Reference', 'Floor', 'Unit'];
const C = 'Aderrig Homes';
const L = (wo, t, f, u, x) => [wo, t, (x && x.cust) || C, 46359, (x && x.step) || '4. READY FOR PRODUCTION', 5000, 'R-' + wo, f, u];
const at0 = '2026-10-15T09:00:00.000Z';
const Pj = (wo, f, u, t, x) => H.order(Object.assign({ wo, pid: 'P1', customer: C, floor: f, unit: u, title: t, step: 'Planner WO', value: 0, plannedWeek: '', dueDate: '2026-12-10', origDueDate: '2026-12-10', log: [{ at: at0, by: 'Ann', what: 'Work order created' }] }, x || {}));
function server(ps, extra) {
  const row = X.v2Row();
  ps.forEach(p => row.orders.push(p));
  (extra || []).forEach(o => row.orders.push(o));
  return X.makeServer(row);
}
const pmRows = p => p.evaluate(() => [...document.querySelectorAll('[data-pmg]')].map(c => ({ p: c.dataset.pmg, w: c.value, on: c.checked, t: c.closest('label').innerText.replace(/\s+/g, ' ') })));
const fmtR = r => r.map(x => x.p + '>' + x.w + (x.on ? '✓' : '')).join(' ');
async function apply(p) {
  await p.evaluate(() => { window.__al = []; window.alert = m => window.__al.push(m); PMERGE_RUN = null; document.getElementById('imp-apply').click(); });
  for (let i = 0; i < 60 && !(await p.evaluate(() => !!PMERGE_RUN || !!window.__al.length)); i++) await sleep(100);
  const out = await p.evaluate(async () => (PMERGE_RUN ? await PMERGE_RUN : null));
  await sleep(1200);
  return out;
}
const flush = p => p.evaluate(async () => { clearTimeout(saveT); await saveDB(); });
const reload = async p => { await p.evaluate(async () => { await loadDB(); lsReset(); await lsLoad(); render(); }); await sleep(300); };
const jobsOf = (S, w) => S.row.orders.filter(o => o.wo === w);

(async () => {
  const browser = await H.chromium.launch();
  try {
    // ============================================================================================================ M1 / M2
    console.log('\n--- M1 / M2 which pairs are offered and pre-ticked');
    {
      const S = server([
        Pj('P-1101', 'GF', '7', 'HOUSE TYPE A'),                 // vs WO-101 floor "0"
        Pj('P-1102', 'T09', 'Apt 8', 'HOUSE TYPE B'),            // vs WO-102 "APT08"
        Pj('P-1103', 'T09', '50', 'HOUSE TYPE C'),               // WO-103 T09/50 and WO-104 T10/50 (same unit, two blocks)
        Pj('P-1105', 'T09', '70', 'HOUSE TYPE D'),               // WO-105 and WO-106 both T09/70 kitchens
        Pj('P-1107', 'T09', '72', 'HOUSE TYPE E'), Pj('P-1108', 'T09', '72', 'HOUSE TYPE E'), // two P-numbers, one WO-107
        Pj('P-1109', 'T09', '74', 'HOUSE TYPE F'),               // WO-109 is the UTILITY of that house
        Pj('P-1110', 'T09', '76', 'HOUSE TYPE G'),               // WO-110 same floor/unit but Lucan Homes (other project)
        Pj('P-1111', 'T09', '78', 'HOUSE TYPE H'),               // WO-111 customer not linked to any project
      ]);
      const FILE = [HDR, L('WO-101', 'HOUSE TYPE A', '0', '7'), L('WO-102', 'HOUSE TYPE B', 'T09', 'APT08'), L('WO-103', 'HOUSE TYPE C', 'T09', '50'), L('WO-104', 'HOUSE TYPE C', 'T10', '50'),
        L('WO-105', 'HOUSE TYPE D KITCHEN', 'T09', '70'), L('WO-106', 'HOUSE TYPE D KITCHEN', 'T09', '70'), L('WO-107', 'HOUSE TYPE E', 'T09', '72'), L('WO-109', 'HOUSE TYPE F UTILITY', 'T09', '74'),
        L('WO-110', 'HOUSE TYPE G', 'T09', '76', { cust: 'Lucan Homes' }), L('WO-111', 'HOUSE TYPE H', 'T09', '78', { cust: 'Nobody Homes' })];
      const a = await X.dev(browser, S, 'office'), p = a.page;
      await H.importAoa(p, FILE); await sleep(300);
      const r = await pmRows(p), g = (pp, w) => r.find(x => x.p === pp && x.w === w);
      rec('M1a "GF" vs "0", same unit: offered and pre-ticked (B0: GF = 0)', g('P-1101', 'WO-101') && g('P-1101', 'WO-101').on, fmtR(r));
      rec('M1b "Apt 8" vs "APT08": offered and pre-ticked', g('P-1102', 'WO-102') && g('P-1102', 'WO-102').on, fmtR(r));
      rec('M1c same unit in two blocks: P (T09/50) offered only WO-103 (T09), pre-ticked; never WO-104 (T10)', g('P-1103', 'WO-103') && g('P-1103', 'WO-103').on && !g('P-1103', 'WO-104'), fmtR(r));
      rec('M1d two kitchen WOs for one house: P-1105 offered both, NEITHER ticked', g('P-1105', 'WO-105') && g('P-1105', 'WO-106') && !g('P-1105', 'WO-105').on && !g('P-1105', 'WO-106').on, fmtR(r));
      rec('M1e one WO for two P-numbers: both offered for WO-107, neither ticked, reason says so', g('P-1107', 'WO-107') && g('P-1108', 'WO-107') && !g('P-1107', 'WO-107').on && !g('P-1108', 'WO-107').on && /more than one P-number/.test(g('P-1107', 'WO-107').t), fmtR(r));
      rec('M1f kitchen P-number vs the UTILITY WO of the same house: not offered', !r.some(x => x.p === 'P-1109'), fmtR(r));
      rec('M1g same floor / unit in ANOTHER project (Lucan): not offered', !r.some(x => x.p === 'P-1110'), fmtR(r));
      const u = g('P-1111', 'WO-111');
      rec('M1h WO of a customer not linked to any project: if offered, never pre-ticked', !u || !u.on, JSON.stringify(u));
      // M2: tick both P-numbers for WO-107 → refused, nothing imported
      const n0 = await p.evaluate(() => DB.orders.length);
      await p.evaluate(() => { document.querySelectorAll('[data-pmg]').forEach(c => { c.checked = c.value === 'WO-107'; }); });
      const out = await apply(p);
      const st = await p.evaluate(() => ({ al: window.__al, n: DB.orders.length }));
      rec('M2 two P-numbers ticked for WO-107: refused with a message, nothing imported, no merge', out === null && st.al.length === 1 && /Only one P-number/.test(st.al[0]) && st.n === n0, JSON.stringify(st));
      rec('M1/M2 no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
      await a.close();
    }

    // ============================================================================================================ M3
    console.log('\n--- M3 two PCs press Apply at the same moment');
    const M3FILE = [HDR, L('WO-40', 'HOUSE TYPE Q', 'T09', '40')];
    const m3P = () => Pj('P-1001', 'T09', '40', 'HOUSE TYPE Q', { plannedWeek: '2026-12-07', notes: 'Keep for site', delv: true, delVeh: 'VOLVO', delDay: 'Thu', delWk: '2026-12-07',
      dueHist: [{ at: '2026-10-16T09:00:00.000Z', by: 'Ann', f: 'due', from: '2026-12-03', to: '2026-12-10', why: 'Site not ready', note: '', src: 'planner' }] });
    {
      const S = server([m3P()]);
      X.F3.seedList(S, 'LP1', { wos: ['P-1001'], name: 'House 40' });
      X.seqRow(S, 'R40', 'P1', { wo: 'P-1001', floor: 'T09', unit: '40' });
      const a = await X.dev(browser, S, 'office'), b = await X.dev(browser, S, 'office');
      await H.importAoa(a.page, M3FILE); await H.importAoa(b.page, M3FILE); await sleep(300);
      const ra = await pmRows(a.page), rb = await pmRows(b.page);
      const [oa, ob] = await Promise.all([apply(a.page), apply(b.page)]);
      await sleep(1500); await flush(a.page); await flush(b.page); await sleep(800);
      await reload(a.page); await reload(b.page); await flush(a.page); await flush(b.page); await sleep(500);
      const w = jobsOf(S, 'WO-40'), wo = w[0] || {};
      const st = { ob: JSON.stringify(ob), nW: w.length, nP: jobsOf(S, 'P-1001').length, pFrom: (wo.pFrom || []).length, merged: ((S.row.settings || {}).pMerged || []).filter(x => x.wo === 'P-1001').length,
        hist: (wo.dueHist || []).filter(h => h.why === 'Site not ready').length, mergeLog: (wo.log || []).filter(x => /merged into WO-40/.test(x.what)).length, pLog: (wo.log || []).filter(x => /^\[P-1001\] Work order created/.test(x.what)).length,
        list: (D.find(S.db, 'lists', 'LP1') || {}).wos, seq: S.db.t.project_seq.filter(x => x.state !== 'removed').map(x => x.id + ':' + x.wo), oa, ob, pre: [fmtR(ra), fmtR(rb)] };
      rec('M3a both PCs pre-ticked it; after both Apply: WO-40 once, P-1001 gone', /P-1001>WO-40✓/.test(st.pre[0]) && /P-1001>WO-40✓/.test(st.pre[1]) && st.nW === 1 && st.nP === 0, JSON.stringify(st));
      // [LOW] Steps: two office PCs build the same import preview (P-1001 → WO-40 pre-ticked) and press Apply at the same moment.
      // Expected: one merge; the second PC is told "already merged (another PC)". Actual: BOTH screens run the merge and both say
      // "P-1001 merged into WO-40"; WO-40's history gets the merge line twice, and the second PC also says "⚠ sequence row not handed
      // over — match it on the sequence page" although it was (a false alarm). pFrom / pMerged / list / sequence row stay single.
      rec('M3b [LOW] merged ONCE: one pFrom copy, one pMerged entry, P\'s date history and log lines not doubled, one merge line', st.pFrom === 1 && st.merged === 1 && st.hist === 1 && st.pLog === 1 && st.mergeLog === 1, JSON.stringify(st));
      rec('M3c list "House 40" on WO-40 only, one live sequence row (R40 → WO-40)', JSON.stringify(st.list) === '["WO-40"]' && st.seq.join() === 'R40:WO-40', JSON.stringify(st));
      rec('M3 no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
      await a.close(); await b.close();
    }

    // ============================================================================================================ M4
    console.log('\n--- M4 a stale screen edits the P-job after the merge');
    {
      const S = server([m3P()]);
      X.F3.seedList(S, 'LP1', { wos: ['P-1001'], name: 'House 40' });
      const b = await X.dev(browser, S, 'office'); // PC B opened before the import, never refreshed
      const a = await X.dev(browser, S, 'office');
      await H.importAoa(a.page, M3FILE); await sleep(300); await apply(a.page); await flush(a.page); await sleep(500);
      const mid = { nP: jobsOf(S, 'P-1001').length, nW: jobsOf(S, 'WO-40').length };
      // B: the job's notes typed on the old copy (as the job panel does: change + log + save)
      const be = await b.page.evaluate(async () => { const o = DB.orders.find(o => o.wo === 'P-1001'); if (!o) return 'gone on B'; o.notes = 'Site contact changed'; logEdit(o, 'Notes changed', 'Bob'); sched(); clearTimeout(saveT); await saveDB(); return 'edited'; });
      await sleep(800); await reload(a.page); await flush(a.page); await sleep(300);
      const fin = { nP: jobsOf(S, 'P-1001').length, nW: jobsOf(S, 'WO-40').length, onA: await a.page.evaluate(() => DB.orders.filter(o => o.wo === 'P-1001' || o.wo === 'WO-40').map(o => o.wo + ':' + (o.notes || ''))) };
      // [HIGH] Steps: PC A imports and merges P-1001 into WO-40; PC B (opened earlier, not refreshed) edits P-1001's notes and
      // saves. Expected: P-1001 does not come back — one job for the house (B's edit lands on WO-40 or B is told). Two jobs = the house
      // can be built twice. Actual: P-1001 is back in the job list beside WO-40 (B's save re-adds it) — two jobs for one house.
      rec('M4 [HIGH] stale screen edits P-1001 after the merge: P-1001 does NOT come back as a second job for the house', mid.nP === 0 && be === 'edited' && fin.nP === 0 && fin.nW === 1, JSON.stringify({ mid, be, fin }));
      rec('M4 no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
      await a.close(); await b.close();
    }

    // ============================================================================================================ M5
    console.log('\n--- M5 P-job has a sequence row and the WO already has one');
    {
      const S = server([Pj('P-1003', 'T09', '42', 'HOUSE TYPE S')], [H.order({ wo: 'WO-42', customer: C, floor: 'T09', unit: '42', title: 'HOUSE TYPE S', step: '4. READY FOR PRODUCTION', dueDate: '2026-12-03', origDueDate: '2026-12-03', ref: 'R-WO-42' })]);
      X.seqRow(S, 'RP', 'P1', { wo: 'P-1003', floor: 'T09', unit: '42' }); X.seqRow(S, 'RW', 'P1', { wo: 'WO-42', floor: 'T09', unit: '42' });
      const a = await X.dev(browser, S, 'office');
      await H.importAoa(a.page, [HDR, L('WO-42', 'HOUSE TYPE S', 'T09', '42')]); await sleep(300);
      const r = await pmRows(a.page);
      await a.page.evaluate(() => document.querySelectorAll('[data-pmg]').forEach(c => { c.checked = true; }));
      const out = await apply(a.page); await flush(a.page);
      const live = S.db.t.project_seq.filter(x => x.state !== 'removed').map(x => x.id + ':' + (x.wo || '-'));
      const orphan = live.filter(x => /P-1003/.test(x));
      // [MEDIUM] Steps: P-1003 (sequence row RP) and WO-42 (row RW) are the same house; an import offers the merge, the office ticks it.
      // Expected: one live sequence row for the house (RP retired / removed with a reason, or the merge refused until sorted out).
      // Actual (if it fails): RP stays live, matched to P-1003 — a job that no longer exists — so the PM's list shows the house twice,
      // one row pointing at nothing; only a note in the merge result says "check the sequence page".
      rec('M5 offered (P-1003 → WO-42) and merged', r.some(x => x.p === 'P-1003' && x.w === 'WO-42') && out && out.some(x => x.p === 'P-1003' && x.ok), JSON.stringify({ r: fmtR(r), out }));
      rec('M5 [MEDIUM] after the merge no live sequence row points at the retired P-1003 (one row for the house)', !orphan.length, JSON.stringify({ live, out }));
      rec('M5 no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
      await a.close();
    }

    // ============================================================================================================ M6 / M7
    console.log('\n--- M6 / M7 merge, then Cienapps moves the step on; the same file twice; P further on than the WO');
    {
      const S = server([m3P(), Pj('P-1004', 'T09', '43', 'HOUSE TYPE T', { step: '6. JOB CUT COMPLETE', plannedWeek: '2026-11-30' })]);
      const a = await X.dev(browser, S, 'office'), p = a.page;
      const F1 = [HDR, L('WO-40', 'HOUSE TYPE Q', 'T09', '40'), L('WO-43', 'HOUSE TYPE T', 'T09', '43')];
      await H.importAoa(p, F1); await sleep(300); const o1 = await apply(p); await flush(p);
      const s1 = await p.evaluate(() => { const f = w => DB.orders.find(o => o.wo === w) || {}; return { s43: f('WO-43').step, wk43: f('WO-43').plannedWeek, due40: f('WO-40').dueDate, keep40: f('WO-40').dueKeep }; });
      rec('M7a P-1004 cut by hand (step 6) merged into WO-43 (Cienapps step 4): step 6 kept, P\'s week kept', o1 && o1.some(x => x.p === 'P-1004' && x.ok) && s1.s43 === '6. JOB CUT COMPLETE' && s1.wk43 === '2026-11-30', JSON.stringify({ o1, s1 }));
      // same file again (Cienapps still at 4)
      await H.importAoa(p, F1); await sleep(300); const r2 = await pmRows(p); await apply(p); await flush(p);
      const s2 = await p.evaluate(() => { const f = w => DB.orders.filter(o => o.wo === w); return { n40: f('WO-40').length, n43: f('WO-43').length, s43: (f('WO-43')[0] || {}).step, p: DB.orders.filter(o => /^P-100[14]$/.test(o.wo)).length, due40: (f('WO-40')[0] || {}).dueDate }; });
      rec('M6a the same file again: nothing offered, WO-40 / WO-43 once each, P-numbers not back, WO-43 still step 6 (import behind)', !r2.length && s2.n40 === 1 && s2.n43 === 1 && !s2.p && s2.s43 === '6. JOB CUT COMPLETE', JSON.stringify({ r2: fmtR(r2), s2 }));
      rec('M6b the planner\'s due date (10 Dec) still kept on WO-40 after the second import (Cienapps\' 3 Dec stays on Dates to change)', s2.due40 === '2026-12-10', JSON.stringify(s2));
      // Cienapps moves WO-40 on to step 6 and changes its due date to the planner's
      const F2 = [HDR, L('WO-40', 'HOUSE TYPE Q', 'T09', '40', { step: '6. JOB CUT COMPLETE' })]; F2[1][3] = 46366; // 10 Dec 2026
      await H.importAoa(p, F2); await sleep(300); await apply(p); await flush(p);
      const s3 = await p.evaluate(() => { const o = DB.orders.find(o => o.wo === 'WO-40') || {}; return { n: DB.orders.filter(o => o.wo === 'WO-40').length, step: o.step, due: o.dueDate, keep: o.dueKeep || '', pFrom: (o.pFrom || []).length, rows: datesToCienRows().filter(d => d.o.wo === 'WO-40').length }; });
      rec('M6c Cienapps moves WO-40 to step 6 with due 10 Dec: step 6 taken, one WO-40, copy kept, nothing left on Dates to change in Cienapps', s3.n === 1 && s3.step === '6. JOB CUT COMPLETE' && s3.due === '2026-12-10' && !s3.keep && s3.pFrom === 1 && !s3.rows, JSON.stringify(s3));
      rec('M6 no job lost: P-numbers kept in settings pMerged', (await p.evaluate(() => (DB.pMerged || []).map(x => x.wo).sort().join())) === 'P-1001,P-1004');
      rec('M6/M7 no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
      await a.close();
    }

    // ============================================================================================================ M8
    console.log('\n--- M8 P-job loaded on a van, WO booked too');
    {
      const S = server([Pj('P-1201', 'T09', '80', 'HOUSE TYPE K', { delv: true, delVeh: 'VOLVO', delDay: 'Thu', delWk: '2026-10-19', delLoadedAt: '2026-10-21T07:00:00.000Z' })],
        [H.order({ wo: 'WO-80', customer: C, floor: 'T09', unit: '80', title: 'HOUSE TYPE K', step: '8. PALLETED', dueDate: '2026-10-22', origDueDate: '2026-10-22', ref: 'R-WO-80', delv: true, delVeh: 'IVECO', delDay: 'Fri', delWk: '2026-10-19' })]);
      const a = await X.dev(browser, S, 'office');
      await H.importAoa(a.page, [HDR, L('WO-80', 'HOUSE TYPE K', 'T09', '80', { step: '8. PALLETED' })]); await sleep(300);
      const r = await pmRows(a.page);
      const out = r.length ? (await a.page.evaluate(() => document.querySelectorAll('[data-pmg]').forEach(c => { c.checked = true; })), await apply(a.page)) : null;
      const w = await a.page.evaluate(() => { const o = DB.orders.find(o => o.wo === 'WO-80') || {}; return { veh: o.delVeh, day: o.delDay, loaded: o.delLoadedAt || '', p: DB.orders.some(o => o.wo === 'P-1201') }; });
      // [MEDIUM if it fails] the P-job is already LOADED on Volvo Thursday; merging keeps the WO's Iveco Friday booking and drops the "loaded"
      // state from the live job (only in the copy). Expected: such a merge is refused, or the loaded van wins, or at least flagged loudly.
      const res = JSON.stringify(out || []);
      rec('M8 [MEDIUM if it fails] P-job LOADED on Volvo merged into a WO booked on Iveco: refused, or the loaded booking kept, or flagged "loaded"', !r.length || (out && out.some(x => !x.ok)) || w.loaded || /loaded/i.test(res), JSON.stringify({ r: fmtR(r), out, w }));
      rec('M8 no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
      await a.close();
    }

    // ============================================================================================================ M9
    console.log('\n--- M9 P-job shipped by hand (S1) before the WO arrives');
    {
      const S = server([Pj('P-1301', 'T09', '90', 'HOUSE TYPE M', { step: '9. JOB SHIPPED', shippedAt: '2026-10-20T10:00:00.000Z', shippedStep: '9. JOB SHIPPED', stepHand: { from: '8. PALLETED', to: '9. JOB SHIPPED', at: '2026-10-20T10:00:00.000Z', by: 'Ann' } })]);
      const a = await X.dev(browser, S, 'office');
      const pv = await H.importAoa(a.page, [HDR, L('WO-90', 'HOUSE TYPE M', 'T09', '90')]); await sleep(300);
      const r = await pmRows(a.page);
      const txt = await a.page.evaluate(() => (document.getElementById('iprev') || {}).innerText || '');
      // [LOW] Steps: a P-number is set to 9. JOB SHIPPED by hand (the house was built and sent under the P-number); later Cienapps
      // sends the WO for that house at step 4. Expected: the preview says the house was already shipped as P-1301 (so it is not built
      // twice). Actual (if it fails): the WO comes in as a new job with no mention of P-1301.
      rec('M9 [LOW] the WO for a house already shipped as a P-number is flagged in the preview (offered or warned)', r.some(x => x.p === 'P-1301') || /P-1301/.test(txt), JSON.stringify({ r: fmtR(r), txt: txt.slice(0, 300) }));
      rec('M9 no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
      await a.close();
    }
  } finally { await browser.close(); }
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
