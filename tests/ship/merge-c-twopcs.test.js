// Merge attack C (Tester, 13 Nov 2026): two PCs on one fake database. One books / moves the job on a van (Deliveries weeks)
// while the other sets it to JOB SHIPPED by hand on the Capacity Board (S1). New screen = this working tree (the merge);
// old screen = origin/main (live today: has S1, no Deliveries weeks). Also an import preview open on one PC while the other
// ships the job by hand, then Apply. Fake Supabase only.  Run: node tests/ship/merge-c-twopcs.test.js
const M = require('./merge-lib');
const { H, makeServer, openRef, oldHtml, recorder, save, reload, w, O, W0, W1, W2, pick, bringBack, job, XD, HDR } = M;
const { rec, done } = recorder('merge-c-twopcs');
const OLD = 'origin/main';
(async () => {
  const browser = await H.chromium.launch();
  try {
    if (!oldHtml(OLD)) { rec('origin/main available', false); return done(); }
    const J1 = 'WO-4801-1', J2 = 'WO-4802-1', J3 = 'WO-4803-1';
    const baseRow = () => ({ id: 'main', version: 1, nid: 50, settings: {}, orders: [
      O(J1, { dueDate: '2026-11-18', plannedWeek: W1 }),                                   // in the To-plan pool
      O(J2, { delVeh: 'VOLVO', delDay: 'Tue', delWk: W1, dueDate: '2026-11-18', plannedWeek: W1 }), // booked next week Tue
      O(J3, { step: '6. JOB CUT COMPLETE', cienStep: '6. JOB CUT COMPLETE', delv: false }),
    ] });
    // book J1 on next week's Thursday on a NEW screen, the way the Deliveries page writes it
    const bookNew = p => p.evaluate(({ J1, W1 }) => { const o = DB.orders.find(x => x.wo === J1); o.delVeh = 'IVECO'; o.delDay = 'Thu'; o.delWk = W1; o.delPlacedAt = new Date().toISOString(); o.delPlacedBy = 'Ann'; sched(); }, { J1, W1 });
    // move J2 to Friday on the OLD screen (old Deliveries: van/day only)
    const moveOld = p => p.evaluate(J2 => { const o = DB.orders.find(x => x.wo === J2); o.delDay = 'Fri'; (o.delMoves = o.delMoves || []).push({ at: new Date().toISOString(), by: 'Old', from: 'VOLVO|Tue', to: 'VOLVO|Fri', why: 'Other' }); sched(); }, J2);
    const state = async p => { await reload(p); const a = await job(p, J1), b = await job(p, J2); return { J1: a && { step: a.step, sh: a.sh, veh: a.veh, day: a.day, wk: a.wk, hand: !!a.hand, onDel: a.onDel }, J2: b && { step: b.step, sh: b.sh, veh: b.veh, day: b.day, wk: b.wk, hand: !!b.hand } }; };

    for (const combo of [['new', 'new'], ['old', 'new'], ['new', 'old']]) {           // [who books, who ships]
      for (const order of ['book-first', 'ship-first']) {
        const S = makeServer(baseRow());
        const A = await openRef(browser, S, combo[0] === 'old' ? OLD : ''), B = await openRef(browser, S, combo[1] === 'old' ? OLD : '');
        const lbl = `books on ${combo[0]} screen, ships on ${combo[1]} screen, ${order}`;
        const book = async () => { if (combo[0] === 'new') await bookNew(A.page); else await A.page.evaluate(J1 => { const o = DB.orders.find(x => x.wo === J1); o.delVeh = 'IVECO'; o.delDay = 'Thu'; o.delPlacedAt = new Date().toISOString(); sched(); }, J1); await save(A.page); };
        const ship = async () => { const r1 = await pick(B.page, J1, '9. JOB SHIPPED'), r2 = await pick(B.page, J2, '9. JOB SHIPPED'); await save(B.page); return [r1, r2]; };
        let r;
        if (order === 'book-first') { await book(); r = await ship(); } else { r = await ship(); await book(); }
        await w(200);
        const sa = await state(A.page), sb = await state(B.page);
        const exWk = combo[0] === 'new' ? W1 : '';
        rec(`${lbl}: J1 is BOTH shipped (hand) and on IVECO Thu — neither PC's work lost`, sa.J1.sh && sa.J1.step === '9. JOB SHIPPED' && sa.J1.veh === 'IVECO' && sa.J1.day === 'Thu' && sa.J1.wk === exWk, JSON.stringify({ sa: sa.J1, r: (r || []).map(x => typeof x === 'string' ? x : 'ok') }));
        rec(`${lbl}: both screens agree after a reload`, JSON.stringify(sa) === JSON.stringify(sb), JSON.stringify({ sa, sb }));
        rec(`${lbl}: J2 shipped, booking Tue Wk 47 kept`, sa.J2.sh && sa.J2.day === 'Tue' && sa.J2.wk === W1, JSON.stringify(sa.J2));
        if (combo[0] === 'new' && combo[1] === 'new' && order === 'book-first') {
          // on the new screen that shipped: J1 still on Deliveries once, in the Wk 47 grid
          const g = await B.page.evaluate(async J1 => { showTab('d'); await new Promise(r => setTimeout(r, 80)); const b = document.querySelector('[data-deltab="1"]'); b && b.click(); await new Promise(r => setTimeout(r, 80)); return [...document.querySelectorAll('.del-grid [data-cell] .dchip')].filter(c => c.dataset.dw === J1).map(c => c.closest('[data-cell]').dataset.cell); }, J1);
          rec(`${lbl}: shipping screen's Deliveries shows J1 once on IVECO Thu Wk 47`, g.length === 1 && g[0] === 'IVECO|Thu|' + W1, JSON.stringify(g));
        }
        rec(`${lbl}: no page errors`, !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
        await A.close(); await B.close();
      }
    }
    // ---- old screen moves J2's day while the new screen ships it by hand (and the other order)
    for (const order of ['old-first', 'new-first']) {
      const S = makeServer(baseRow());
      const A = await openRef(browser, S, OLD), B = await openRef(browser, S, '');
      if (order === 'old-first') { await moveOld(A.page); await save(A.page); await pick(B.page, J2, '9. JOB SHIPPED'); await save(B.page); }
      else { await pick(B.page, J2, '9. JOB SHIPPED'); await save(B.page); await moveOld(A.page); await save(A.page); }
      const sb = await state(B.page);
      rec(`old screen moves J2 Tue→Fri, new screen ships it (${order}): shipped AND on Fri, week kept (Wk 47)`, sb.J2.sh && sb.J2.day === 'Fri' && sb.J2.wk === W1, JSON.stringify(sb.J2));
      rec(`(${order}) no page errors`, !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
      await A.close(); await B.close();
    }
    // ---- old screen brings back a job shipped by hand on the new screen, and the reverse
    {
      const S = makeServer(baseRow());
      const A = await openRef(browser, S, OLD), B = await openRef(browser, S, '');
      await pick(B.page, J2, '9. JOB SHIPPED'); await save(B.page); await reload(A.page);
      await bringBack(A.page, J2); await save(A.page);
      const sb = await state(B.page);
      rec('new screen ships by hand, old screen (main) brings back: step 8, not shipped, booking + week kept', sb.J2.step === '8. PALLETED' && !sb.J2.sh && sb.J2.day === 'Tue' && sb.J2.wk === W1 && !sb.J2.hand, JSON.stringify(sb.J2));
      await pick(A.page, J3, '7. ASSEMBLY COMPLETE'); await save(A.page);
      await reload(B.page); const j3 = await job(B.page, J3);
      rec('INFO old screen (main) sets step 7: ticked for delivery but no store time (main has no storeStamp) — new screens fall back to the history line', j3.delv && j3.step === '7. ASSEMBLY COMPLETE', JSON.stringify({ storeAt: j3.storeAt, inStore: j3.inStore }));
      const sd = await B.page.evaluate(J3 => { const o = DB.orders.find(x => x.wo === J3); return { since: storeSince(o), days: storeDays(o) }; }, J3);
      rec('… and the new screen still knows when it reached the store (from the history)', !!sd.since && sd.days === 0, JSON.stringify(sd));
      rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
      await A.close(); await B.close();
    }
    // ---- import preview open on PC A; PC B ships the job by hand and saves; A presses Apply
    {
      const K1 = 'WO-4811-1', K2 = 'WO-4812-1';
      const S = makeServer({ id: 'main', version: 1, nid: 50, settings: {}, orders: [
        O(K1, { step: '6. JOB CUT COMPLETE', cienStep: '6. JOB CUT COMPLETE', delv: false }),
        O(K2, { delVeh: 'VOLVO', delDay: 'Wed', delWk: W1 }) ] });
      const A = await openRef(browser, S, ''), B = await openRef(browser, S, '');
      const imp = (wo, st) => [wo, 'House ' + wo, 'CAIRN', XD('2026-11-13'), st, 1000];
      await H.importAoa(A.page, [HDR, imp(K1, '8. PALLETED'), imp(K2, '9. JOB SHIPPED')]);
      const pv = await A.page.evaluate(() => ({ upd: IMPPLAN.updates.map(u => u.wo + ': ' + u.what), ship: IMPPLAN.shipped.map(s => s.wo), btn: !!document.getElementById('imp-apply') }));
      await pick(B.page, K1, '9. JOB SHIPPED'); await pick(B.page, K2, '10. INSTALLED TO BE INVOICE'); await save(B.page);
      const click = () => A.page.evaluate(async () => { const b = document.getElementById('imp-apply'); if (!b) return 'no button'; b.click(); await new Promise(r => setTimeout(r, 2000)); return /changed while you were reviewing|check the preview again/i.test(document.body.innerText) ? 'reshown' : 'applied'; });
      const c1 = await click(); let c2 = ''; if (c1 === 'reshown') c2 = await click();
      await save(A.page); await reload(B.page);
      const k1 = await job(B.page, K1), k2 = await job(B.page, K2);
      rec('preview open on A (Cienapps 8 for K1 at 6, 9 for K2), B ships K1 by hand / sets K2 to INSTALLED, A applies: K1 stays 9 shipped', k1.step === '9. JOB SHIPPED' && k1.sh, JSON.stringify({ pv, c1, c2, k1: { step: k1.step, sh: k1.sh, delv: k1.delv, storeAt: k1.storeAt, logs: k1.logs } }));
      rec('… K2 stays 10 installed, van booking kept', k2.step === '10. INSTALLED TO BE INVOICE' && k2.sh && k2.inst && k2.day === 'Wed' && k2.wk === W1, JSON.stringify({ c1, c2, k2: { step: k2.step, sh: k2.sh, inst: k2.inst, day: k2.day, wk: k2.wk } }));
      rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
      await A.close(); await B.close();
    }
  } finally { await browser.close(); }
  done();
})().catch(e => { console.error(e); process.exit(1); });
