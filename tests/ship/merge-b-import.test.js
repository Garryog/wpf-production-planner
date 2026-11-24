// Merge attack B (Tester, 13 Nov 2026): Cienapps import behind / level / ahead of a job set to JOB SHIPPED / INSTALLED by hand
// (S1, main) that has a van booking (Deliveries weeks release). Also bring-back then a real "shipped" import, a job with no
// Cienapps step on record, and a preview worked out BEFORE the hand-ship and applied after (the import's "Apply" re-check).
// Fake Supabase only.  Run: node tests/ship/merge-b-import.test.js      (MERGE_REF=origin/main to run the same on main)
const M = require('./merge-lib');
const { H, makeServer, openRef, recorder, w, O, W0, W1, W2, pick, bringBack, job, importRows, XD, HDR } = M;
const { rec, done } = recorder('merge-b-import');
const REF = process.env.MERGE_REF || '';
(async () => {
  const browser = await H.chromium.launch();
  try {
    const bk = (x) => Object.assign({ delVeh: 'VOLVO', delDay: 'Wed', delWk: W1 }, x);
    const ids = ['WO-4701-1', 'WO-4702-1', 'WO-4703-1', 'WO-4704-1', 'WO-4705-1', 'WO-4706-1', 'WO-4707-1', 'WO-4708-1', 'WO-4709-1', 'WO-4710-1'];
    const [A1, A2, A3, A4, A5, A6, A7, A8, A9, A10] = ids;
    const row = { id: 'main', version: 1, nid: 50, settings: {}, orders: [
      O(A1, bk()), O(A2, bk()), O(A3, bk()), O(A4, bk()), O(A5, bk()), O(A6, bk()), O(A7, bk()),
      O(A8, bk({ cienStep: '' })),                                                          // no Cienapps step on record (old data / never imported with a step)
      O(A9, { step: '6. JOB CUT COMPLETE', cienStep: '6. JOB CUT COMPLETE', delv: false }),  // stale preview: Cienapps says 8, hand-ship before Apply
      O(A10, bk()),                                                                          // stale preview: Cienapps says 9, hand-set 10 before Apply
    ] };
    const S = makeServer(row);
    const t = await openRef(browser, S, REF), p = t.page;
    const hasShip = await p.evaluate(() => typeof stepShipHand === 'function');
    if (!hasShip) { rec('this version has no hand-ship (S1) — nothing to test', false); await t.close(); return; }
    const hasWeeks = await p.evaluate(() => typeof slotWk === 'function');
    for (const wo of [A1, A2, A3, A4, A5, A7, A8]) await pick(p, wo, '9. JOB SHIPPED');
    await pick(p, A6, '10. INSTALLED TO BE INVOICE');
    const before = {}; for (const wo of ids) before[wo] = await job(p, wo);
    const bookOk = (a, b) => a.veh === b.veh && a.day === b.day && a.wk === b.wk && a.onDel === 1;
    const imp = (wo, step) => [wo, 'House ' + wo, 'CAIRN', XD('2026-11-13'), step, 1000];
    const pl = await importRows(p, [imp(A1, '8. PALLETED'), imp(A2, '7. ASSEMBLY COMPLETE'), imp(A3, '9. JOB SHIPPED'), imp(A4, '10. INSTALLED TO BE INVOICE'),
      imp(A5, '11. COMPLETED AND INVOICED'), imp(A6, '9. JOB SHIPPED')]);
    const J = {}; for (const wo of ids) J[wo] = await job(p, wo);
    const chg = await p.evaluate(() => changes().map(o => o.wo));
    rec('import behind (8): hand-set 9 holds, still shipped, booking untouched, still on Export Changes', J[A1].step === '9. JOB SHIPPED' && J[A1].sh && bookOk(J[A1], before[A1]) && chg.includes(A1) && !!J[A1].hand, JSON.stringify(J[A1]));
    rec('import behind (7): same, and NOT re-ticked/re-stamped oddly', J[A2].step === '9. JOB SHIPPED' && J[A2].sh && bookOk(J[A2], before[A2]) && chg.includes(A2), JSON.stringify(J[A2]));
    rec('import level (9): stepHand cleared (Cienapps\' now), still shipped, booking untouched, off Export Changes', J[A3].step === '9. JOB SHIPPED' && J[A3].sh && !J[A3].hand && bookOk(J[A3], before[A3]) && !chg.includes(A3), JSON.stringify({ j: J[A3], chg }));
    rec('import ahead (10): step 10, installed, stepHand cleared, booking untouched', J[A4].step === '10. INSTALLED TO BE INVOICE' && J[A4].inst && !J[A4].hand && bookOk(J[A4], before[A4]), JSON.stringify(J[A4]));
    const a5 = await p.evaluate(wo => { const o = DB.orders.find(x => x.wo === wo); return { done: !!o.completeAt, by: o.completeBy, onDel: delAll().includes(o) }; }, A5);
    rec('import ahead (11): step 11, complete (Cienapps), booking untouched — still on its van until the driver confirms', J[A5].step === '11. COMPLETED AND INVOICED' && a5.done && bookOk(J[A5], before[A5]) && a5.onDel, JSON.stringify({ j: J[A5], a5 }));
    rec('hand-set 10, import behind (9): stays 10 installed, booking untouched', J[A6].step === '10. INSTALLED TO BE INVOICE' && J[A6].inst && bookOk(J[A6], before[A6]), JSON.stringify(J[A6]));
    rec('preview: A1/A2/A6 listed "planner is ahead"', (pl.stepDiffs || []).filter(x => /planner is ahead/.test(x.why)).map(x => x.wo).sort().join() === [A1, A2, A6].join(), JSON.stringify(pl.stepDiffs));
    rec('preview: hand-shipped jobs not in the "on a van / not dispatched" warnings (already shipped)', !(pl.inTransit || []).some(x => ids.includes(x.wo)) && !(pl.dispGaps || []).some(x => ids.includes(x.wo)), JSON.stringify({ it: pl.inTransit, dg: pl.dispGaps }));

    // ---- bring back after a level import (A3): Cienapps says 9 → nothing to undo, stays at 9 on the board
    await bringBack(p, A3);
    const a3 = await job(p, A3);
    rec('INFO bring back after Cienapps caught up (A3): back on board, step stays "9. JOB SHIPPED" (Cienapps says so) — shipBack.cs 9', a3.onBoard && !a3.sh && a3.step === '9. JOB SHIPPED' && bookOk(a3, before[A3]), JSON.stringify(a3));
    // ---- bring back A7 (hand 9, Cienapps 8) then Cienapps really ships it → off the board again
    await bringBack(p, A7);
    const a7b = await job(p, A7);
    const pl7 = await importRows(p, [imp(A7, '9. JOB SHIPPED')]);
    const a7 = await job(p, A7);
    rec('A7 brought back (step 8), then Cienapps says 9: shipped again, booking kept, dispatch warning shown', a7b.step === '8. PALLETED' && a7.sh && a7.step === '9. JOB SHIPPED' && bookOk(a7, before[A7]) && (pl7.dispGaps || []).some(x => x.wo === A7), JSON.stringify({ a7b: a7b.back, a7 }));
    // ---- A8: no Cienapps step on record → bring back records shipBack.cs = the HAND step → the real Cienapps "9" is then ignored
    await bringBack(p, A8);
    const a8b = await job(p, A8);
    const pl8 = await importRows(p, [imp(A8, '9. JOB SHIPPED')]);
    const a8 = await job(p, A8);
    rec('A8 (no Cienapps step on record) brought back, then Cienapps really says 9. JOB SHIPPED → should go to Shipped',
      a8.sh && !a8.onBoard, JSON.stringify({ back: a8b.back, step: a8.step, sh: a8.sh, onBoard: a8.onBoard, ship: (pl8.shipped || []).map(s => s.wo) }));

    // ---- stale preview A9: preview worked out (Cienapps 8 = ahead of 6: step + auto-tag), then hand-shipped, then Apply
    await H.importAoa(p, [HDR, imp(A9, '8. PALLETED')]);
    const pv = await p.evaluate(wo => (IMPPLAN.updates || []).filter(u => u.wo === wo).map(u => u.what), A9);
    await p.evaluate(async wo => { window.confirm = () => true; sessionStorage.setItem('wpfWho', 'Op'); stepShipHand(DB.orders.find(o => o.wo === wo), '9. JOB SHIPPED'); await new Promise(r => setTimeout(r, 200)); }, A9);
    const a9mid = await job(p, A9);
    const ap = await p.evaluate(async () => { if (typeof showTab === 'function' && tab !== 'i') showTab('i'); await new Promise(r => setTimeout(r, 100)); const b = document.getElementById('imp-apply'); if (!b) return 'no apply button (' + (IMPPLAN ? 'plan kept' : 'plan gone') + ')'; b.click(); await new Promise(r => setTimeout(r, 1500)); return (document.getElementById('app').innerText.match(/changed while you were reviewing|changed on another PC[^\n]*/) || ['applied'])[0]; });
    let ap2 = '';
    if (/changed/.test(ap)) ap2 = await p.evaluate(async () => { const b = document.getElementById('imp-apply'); if (!b) return 'no button'; b.click(); await new Promise(r => setTimeout(r, 1500)); return 'applied 2nd'; });
    const a9 = await job(p, A9);
    rec('stale preview (Cienapps 8 for a job at 6) applied AFTER the job was shipped by hand: stays 9 shipped, not dragged back to 8', a9mid.sh && a9.step === '9. JOB SHIPPED' && a9.sh, JSON.stringify({ pv, ap, ap2, a9: { step: a9.step, sh: a9.sh, delv: a9.delv, storeAt: a9.storeAt, logs: a9.logs } }));
    rec('INFO stale preview: what the user saw', true, JSON.stringify({ ap, ap2 }));
    // ---- stale preview A10: Cienapps 9 (to Shipped) worked out, then hand-set 10, then Apply
    await H.importAoa(p, [HDR, imp(A10, '9. JOB SHIPPED')]);
    await p.evaluate(async wo => { window.confirm = () => true; stepShipHand(DB.orders.find(o => o.wo === wo), '10. INSTALLED TO BE INVOICE'); await new Promise(r => setTimeout(r, 200)); }, A10);
    const ap3 = await p.evaluate(async () => { if (tab !== 'i') showTab('i'); await new Promise(r => setTimeout(r, 100)); const b = document.getElementById('imp-apply'); if (!b) return 'no apply button'; b.click(); await new Promise(r => setTimeout(r, 1500));
      const b2 = document.getElementById('imp-apply'); if (b2 && /changed/.test(document.getElementById('app').innerText)) { b2.click(); await new Promise(r => setTimeout(r, 1500)); return 'reshown then applied'; } return 'applied'; });
    const a10 = await job(p, A10);
    rec('stale preview (Cienapps 9) applied after a hand-set 10: stays 10 installed, booking kept', a10.step === '10. INSTALLED TO BE INVOICE' && a10.sh && a10.inst && bookOk(a10, before[A10]), JSON.stringify({ ap3, a10 }));
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    await t.close();
  } finally { await browser.close(); }
  done();
})().catch(e => { console.error(e); process.exit(1); });
