// attack20-1 (Tester, 20 Nov 2026): re-attack the attack19 merge fixes (369b14f / 7118fc7) — "the 🚚 tag goes with the booking".
//  A. take off (Cienapps job) vs booking — both orders: on the board, booked, tagged, both PCs agree, history says so
//  B. ↩ Back to Deliveries (Past weeks) vs Close week — both orders: on the Deliveries page
//  C. job goes ON HOLD (import) on PC A while PC B books it: hidden while on hold; where is it when the hold lifts?
//  D. deliberate take-off that NOBODY booked must stay off after stale PCs edit other things (Cienapps job and hand job, 3 PCs)
//  E. three PCs: A takes off, B books, C (stale) edits a note
// Fake Supabase only. Run: node tests/deliveries/attack20-1-merge.test.js
const M = require('../ship/merge-lib');
const { H, makeServer, openRef, recorder, save, reload, O, W0 } = M;
const { rec, done } = recorder('attack20-1-merge');
const NAME = async (p, n) => { if (await p.$('#pick-other')) { await p.fill('#pick-other', n); await p.click('#pick-ok'); await p.waitForTimeout(120); } };
async function takeOff(p, wo, typed) {
  await p.evaluate(async () => { document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); showTab('d'); await new Promise(r => setTimeout(r, 120)); });
  const ok = await p.evaluate(wo => { const b = [...document.querySelectorAll('[data-dx]')].find(x => x.dataset.dx === wo); if (!b) return false; b.click(); return true; }, wo);
  if (!ok) return 'no × button';
  await p.waitForTimeout(80); await p.click('#tob-next'); await p.fill('#tob-t', typed); await p.click('#tob-go'); await p.waitForTimeout(100); await NAME(p, 'Ann'); await p.waitForTimeout(100); return 'ok';
}
const book = (p, wo, veh, day) => p.evaluate(({ wo, veh, day, W0 }) => { window.confirm = () => true; placeJobs([findDel(wo)], veh, day, W0); }, { wo, veh, day, W0 });
const st = (p, wo) => p.evaluate(wo => { const o = findDel(wo); const ar = Object.entries(DB.delArchive || {}).filter(([k, a]) => a.off && (a.jobs || []).some(j => j.wo === wo)).length;
  return o ? { delv: !!o.delv, veh: o.delVeh || '', day: o.delDay || '', wk: o.delWk || '', onPage: delOnPage(o), hold: !!o.cienHold, rb: o.delRebook ? (o.delRebook.back ? 'back' : 'rb') : '', off: ar, log: (o.log || []).slice(-3).map(l => l.what).join(' / ') } : { gone: true, off: ar }; }, wo);
const HDR = ['WO #', 'Title', 'Customer', 'Due Date', 'Step', 'Sub-Total'];
const imp = async (p, rows) => { await H.importAoa(p, [HDR, ...rows]); return p.evaluate(async () => { const ok = !!IMPPLAN; applyImport(IMPPLAN); await new Promise(r => setTimeout(r, 250)); return ok; }); };
(async () => {
  const browser = await H.chromium.launch();
  try {
    // ---------- A
    for (const order of ['book-saves-first', 'takeoff-saves-first']) {
      const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [O('WO-2701-1')] });
      const A = await openRef(browser, S, ''), B = await openRef(browser, S, '');
      if (order === 'book-saves-first') { await book(B.page, 'WO-2701-1', 'IVECO', 'Fri'); await save(B.page); await takeOff(A.page, 'WO-2701-1', 'WO-2701-1'); await save(A.page); }
      else { await takeOff(A.page, 'WO-2701-1', 'WO-2701-1'); await save(A.page); await book(B.page, 'WO-2701-1', 'IVECO', 'Fri'); await save(B.page); }
      await reload(A.page); await reload(B.page);
      const a = await st(A.page, 'WO-2701-1'), b = await st(B.page, 'WO-2701-1');
      rec(`A ${order}: booked AND tagged (on the page, IVECO Fri)`, a.delv && a.onPage && a.veh === 'IVECO' && a.day === 'Fri' && a.wk === W0, JSON.stringify(a));
      rec(`A ${order}: both PCs agree`, JSON.stringify(a) === JSON.stringify(b), JSON.stringify({ a, b }));
      rec(`A ${order}: no page errors`, !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
      await A.close(); await B.close();
    }
    // ---------- B
    for (const order of ['close-first', 'back-first']) {
      const AK = '2026-11-07.zz';
      const S = makeServer({ id: 'main', version: 1, nid: 9, settings: { delArchive: { [AK]: { at: '2026-11-07T16:00:00Z', w: '2026-11-02', by: 'Pat', notes: {}, pod: {}, jobs: [
        { wo: 'WO-2702-1', t: 'House', c: 'CAIRN', f: '', u: '', v: 'VOLVO', d: 'Tue', dt: '2026-11-03', val: 900, lAt: '', dAt: '', vAt: '2026-11-03T12:00:00Z', lBy: '', vBy: 'Joe', mv: [], fd: '', mw: null }] } } },
        orders: [O('WO-2702-1', { delVeh: 'VOLVO', delDay: 'Tue', delWk: W0, delDelivAt: '2026-11-10T12:00:00Z', delivBy: 'Joe', delDone: true })] });
      const A = await openRef(browser, S, ''), B = await openRef(browser, S, '');
      const back = async () => { await A.page.evaluate(() => openDelArchive('2026-11-07.zz')); await A.page.waitForTimeout(100);
        const n = await A.page.evaluate(() => { const b = document.querySelector('[data-arcb]'); if (!b) return 0; b.click(); return 1; }); await A.page.waitForTimeout(100);
        if (n) { await NAME(A.page, 'Ann'); await A.page.click('.pod-ovl [data-why="Not delivered after all"]').catch(() => {}); await A.page.waitForTimeout(150); } return n; };
      const close = async () => { await B.page.evaluate(async W0 => { window.confirm = () => true; closeWeek(W0); await new Promise(r => setTimeout(r, 120)); }, W0); await NAME(B.page, 'Bob'); await B.page.waitForTimeout(800); };
      if (order === 'close-first') { await close(); await save(B.page); await back(); await save(A.page); } else { await back(); await save(A.page); await close(); await save(B.page); }
      await reload(A.page); await reload(B.page);
      const a = await st(A.page, 'WO-2702-1'), b = await st(B.page, 'WO-2702-1');
      rec(`B ${order}: brought back → on the Deliveries page, tagged, "brought back"`, a.onPage && a.delv && a.rb === 'back', JSON.stringify(a));
      rec(`B ${order}: both PCs agree`, JSON.stringify(a) === JSON.stringify(b), JSON.stringify({ a, b }));
      await A.close(); await B.close();
    }
    // ---------- C: on hold on A (import) while booked on B
    for (const order of ['hold-first', 'book-first']) {
      const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [O('WO-2703-1')] });
      const A = await openRef(browser, S, ''), B = await openRef(browser, S, '');
      const hold = async () => { const ok = await imp(A.page, [['WO-2703-1', 'House', 'CAIRN', 46339, '12. ON HOLD', 1000]]); await save(A.page); return ok; };
      if (order === 'hold-first') { await hold(); await book(B.page, 'WO-2703-1', 'IVECO', 'Fri'); await save(B.page); }
      else { await book(B.page, 'WO-2703-1', 'IVECO', 'Fri'); await save(B.page); await hold(); }
      await reload(A.page); await reload(B.page);
      const a = await st(A.page, 'WO-2703-1');
      rec(`C ${order}: on hold → hidden from Deliveries`, a.hold && !a.onPage, JSON.stringify(a));
      rec(`INFO C ${order}: what it holds while on hold`, true, JSON.stringify(a));
      // hold lifts (Cienapps back to 8)
      await imp(A.page, [['WO-2703-1', 'House', 'CAIRN', 46339, '8. PALLETED', 1000]]); await save(A.page); await reload(A.page);
      const c = await st(A.page, 'WO-2703-1');
      rec(`C ${order}: hold lifts → NOT silently back on a booked slot it was taken off when it went on hold ("coming back restores none of it")`, !(c.onPage && c.day), JSON.stringify(c));
      await A.close(); await B.close();
    }
    // ---------- D: deliberate take-off, nobody books, stale PCs edit other things (3 PCs)
    {
      const S = makeServer({ id: 'main', version: 1, nid: 9, orders: [O('WO-2704-1')], settings: { delx: [{ wo: 'JOB-D1', title: 'Spare', customer: 'Cairn', value: 50, manual: true, delVeh: '', delDay: '', delDone: false, jid: 'Jd1', addedAt: '2026-11-10T09:00:00Z' }] } });
      const A = await openRef(browser, S, ''), B = await openRef(browser, S, ''), C = await openRef(browser, S, '');
      await takeOff(A.page, 'WO-2704-1', 'WO-2704-1'); await takeOff(A.page, 'JOB-D1', 'DELETE'); await save(A.page);
      // B (stale): a note on the Cienapps job; C (stale): edits the hand job's value (a plain field, not the booking)
      await B.page.evaluate(() => { DB.orders.find(o => o.wo === 'WO-2704-1').notes = 'ring first'; sched(); }); await save(B.page);
      await C.page.evaluate(() => { const x = DB.delx.find(z => z.wo === 'JOB-D1'); x.value = 60; sched(); }); await save(C.page);
      for (const P of [A, B, C]) await reload(P.page);
      const a1 = await st(A.page, 'WO-2704-1'), a2 = await st(A.page, 'JOB-D1'), c2 = await st(C.page, 'JOB-D1');
      rec('D: Cienapps job taken off on purpose stays off after a stale PC edits its note', !a1.delv && !a1.onPage && !a1.veh, JSON.stringify(a1));
      rec('D: hand job taken off on purpose stays off (archived) after a stale PC changes its value', a2.gone && a2.off === 1, JSON.stringify(a2));
      rec('D: all three PCs agree on the hand job', JSON.stringify(a2) === JSON.stringify(c2), JSON.stringify({ a2, c2 }));
      // and the reverse: C's "Move to week…" (planWk) on the hand job
      await A.close(); await B.close(); await C.close();
    }
    {
      const S = makeServer({ id: 'main', version: 1, nid: 9, orders: [], settings: { delx: [{ wo: 'JOB-D2', title: 'Spare', customer: 'Cairn', value: 50, manual: true, delVeh: '', delDay: '', delDone: false, jid: 'Jd2', addedAt: '2026-11-10T09:00:00Z' }] } });
      const A = await openRef(browser, S, ''), C = await openRef(browser, S, '');
      await takeOff(A.page, 'JOB-D2', 'DELETE'); await save(A.page);
      await C.page.evaluate(async () => { window.confirm = () => true; wkMoveDo(['JOB-D2'], '2026-11-23'); await new Promise(r => setTimeout(r, 150)); }); await NAME(C.page, 'Cy');
      if (await C.page.$('.pod-ovl [data-why]')) { await C.page.click('.pod-ovl [data-why]'); await C.page.waitForTimeout(150); }
      await save(C.page); await reload(A.page);
      const a = await st(A.page, 'JOB-D2');
      rec('D2: hand job taken off on purpose; a stale PC "Moves it to week 48" (not a booking) → where is it? stays off, or on the board with its archive record gone', (a.gone && a.off === 1) || (!a.gone && a.off === 0), JSON.stringify(a));
      rec('INFO D2: result', true, JSON.stringify(a));
      await A.close(); await C.close();
    }
    // ---------- E: three PCs: A takes off, B books, C (stale) edits a note
    {
      const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [O('WO-2705-1')] });
      const A = await openRef(browser, S, ''), B = await openRef(browser, S, ''), C = await openRef(browser, S, '');
      await takeOff(A.page, 'WO-2705-1', 'WO-2705-1'); await save(A.page);
      await book(B.page, 'WO-2705-1', 'VOLVO', 'Thu'); await save(B.page);
      await C.page.evaluate(() => { DB.orders.find(o => o.wo === 'WO-2705-1').notes = 'C'; sched(); }); await save(C.page);
      for (const P of [A, B, C]) await reload(P.page);
      const r = await Promise.all([A, B, C].map(P => st(P.page, 'WO-2705-1')));
      rec('E: 3 PCs → booked VOLVO Thu AND tagged; all agree; note kept', r[0].delv && r[0].day === 'Thu' && r[0].onPage && r.every(x => JSON.stringify(x) === JSON.stringify(r[0])) && await A.page.evaluate(() => DB.orders.find(o => o.wo === 'WO-2705-1').notes === 'C'), JSON.stringify(r));
      await A.close(); await B.close(); await C.close();
    }
  } catch (e) { rec('test ran', false, e.stack); }
  await browser.close(); done();
})();
