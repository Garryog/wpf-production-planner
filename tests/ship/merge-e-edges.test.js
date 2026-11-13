// Merge attack E (Tester, 13 Nov 2026): odd step text and backwards moves around the hand-set ship steps.
// E1 a step stored with a trailing space (old data, "8. PALLETED ") shipped by hand then brought back → must not land on Export Changes.
// E2 a job Cienapps put at 10 (installed), brought back to the board, then 9 picked by hand → steps should only move forward.
// E3 the same brought-back job, 8 picked in the step box → storeStamp / delvAuto on a job that had already shipped.
// Fake Supabase only.  Run: node tests/ship/merge-e-edges.test.js   (MERGE_REF=origin/main for the live version)
const M = require('./merge-lib');
const { H, makeServer, openRef, recorder, O, W1, pick, bringBack, job, importRows, XD } = M;
const { rec, done } = recorder('merge-e-edges');
const REF = process.env.MERGE_REF || '';
(async () => {
  const browser = await H.chromium.launch();
  try {
    const E1 = 'WO-5101-1', E2 = 'WO-5102-1';
    const S = makeServer({ id: 'main', version: 1, nid: 5, settings: {}, orders: [
      O(E1, { step: '8. PALLETED ', cienStep: '8. PALLETED ', delVeh: 'IVECO', delDay: 'Fri', delWk: W1 }),
      O(E2, { delVeh: 'IVECO', delDay: 'Thu', delWk: W1 }) ] });
    const t = await openRef(browser, S, REF), p = t.page;
    await pick(p, E1, '9. JOB SHIPPED'); await bringBack(p, E1);
    const c1 = await p.evaluate(wo => changes().filter(o => o.wo === wo).map(o => JSON.stringify(origStep[o.wo]) + ' → ' + JSON.stringify(o.step)), E1);
    rec('E1 "8. PALLETED " (trailing space) shipped by hand then brought back: not on Export Changes (nothing to tell Cienapps)', !c1.length, JSON.stringify(c1));
    await importRows(p, [[E2, 'House ' + E2, 'CAIRN', XD('2026-11-13'), '10. INSTALLED TO BE INVOICE', 1000]]);
    await bringBack(p, E2);
    const b2 = await job(p, E2);
    const r9 = await pick(p, E2, '9. JOB SHIPPED');
    const j9 = await job(p, E2);
    const c2 = await p.evaluate(wo => changes().filter(o => o.wo === wo).map(o => origStep[o.wo] + ' → ' + o.step), E2);
    rec('E2 Cienapps at 10, brought back, 9 picked by hand: should be refused ("steps only move forward"), not sent to Cienapps as 10 → 9',
      j9.step === '10. INSTALLED TO BE INVOICE', JSON.stringify({ before: b2.step, after: j9.step, sh: j9.sh, exportChanges: c2, asked: (r9.asked || [])[0] && r9.asked[0].slice(0, 80) }));
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    await t.close();
  } finally { await browser.close(); }
  done();
})().catch(e => { console.error(e); process.exit(1); });
