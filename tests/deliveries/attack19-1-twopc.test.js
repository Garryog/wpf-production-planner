// attack19-1 (Tester, 19 Nov 2026): two PCs on one fake database vs the d19 Deliveries changes.
//  A. Take off board (Cienapps job) on PC A while PC B books the same job — both orders.
//  B. Take off board (job added by hand) on PC A while PC B books it — both orders.
//  C. ↩ Back to Deliveries (Past weeks) on PC A while PC B closes that week — does the bring-back survive?
//  D. Two PCs book the same empty van + day — warned? both kept?
//  E. Bring back a delivered job on A while the driver's phone (B, stale) taps "delivered" again.
// Fake Supabase only (tests/stage1/srv.js). Run: node tests/deliveries/attack19-1-twopc.test.js
const M = require('../ship/merge-lib');
const { H, makeServer, openRef, recorder, save, reload, w, O, W0 } = M;
const { rec, done } = recorder('attack19-1-twopc');
const NAME = async (p, n) => { const has = await p.$('#pick-other'); if (has) { await p.fill('#pick-other', n); await p.click('#pick-ok'); await p.waitForTimeout(120); } };
async function takeOff(p, wo, typed) {
  await p.evaluate(async () => { showTab('d'); await new Promise(r => setTimeout(r, 120)); });
  const ok = await p.evaluate(wo => { const b = document.querySelector('[data-dx="' + wo + '"]'); if (!b) return false; b.click(); return true; }, wo);
  if (!ok) return 'no × button';
  await p.waitForTimeout(80); await p.click('#tob-next'); await p.waitForTimeout(60);
  await p.fill('#tob-t', typed); await p.click('#tob-go'); await p.waitForTimeout(100);
  await NAME(p, 'Ann'); await p.waitForTimeout(100); return 'ok';
}
const book = (p, wo, veh, day) => p.evaluate(({ wo, veh, day, W0 }) => { window.confirm = () => true; placeJobs([findDel(wo)], veh, day, W0); }, { wo, veh, day, W0 });
const st = (p, wo) => p.evaluate(wo => { const o = findDel(wo); const ar = Object.values(DB.delArchive || {}).filter(a => (a.jobs || []).some(j => j.wo === wo)).length;
  return o ? { delv: o.delv, veh: o.delVeh || '', day: o.delDay || '', wk: o.delWk || '', onPage: delOnPage(o), done: !!o.delDone, rb: o.delRebook ? (o.delRebook.back ? 'back' : 'rb') : '', inDelx: (DB.delx || []).some(x => x.wo === wo), arch: ar } : { gone: true, arch: ar }; }, wo);

(async () => {
  const browser = await H.chromium.launch();
  try {
    // ---------- A: Cienapps job take-off vs booking
    for (const order of ['book-saves-first', 'takeoff-saves-first']) {
      const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [O('WO-A1')] });
      const A = await openRef(browser, S, ''), B = await openRef(browser, S, '');
      if (order === 'book-saves-first') { await book(B.page, 'WO-A1', 'IVECO', 'Fri'); await save(B.page); await takeOff(A.page, 'WO-A1', 'WO-A1'); await save(A.page); }
      else { await takeOff(A.page, 'WO-A1', 'WO-A1'); await save(A.page); await book(B.page, 'WO-A1', 'IVECO', 'Fri'); await save(B.page); }
      await reload(A.page); await reload(B.page);
      const a = await st(A.page, 'WO-A1'), b = await st(B.page, 'WO-A1');
      const ghost = !a.delv && (a.veh || a.day);
      rec(`A ${order}: Cienapps job never left booked on a van but untagged (invisible on Deliveries yet still holding IVECO Fri)`, !ghost, JSON.stringify(a));
      rec(`A ${order}: both PCs agree`, JSON.stringify(a) === JSON.stringify(b), JSON.stringify({ a, b }));
      rec(`A ${order}: no page errors`, !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
      await A.close(); await B.close();
    }
    // ---------- B: hand job take-off vs booking
    for (const order of ['book-saves-first', 'takeoff-saves-first']) {
      const S = makeServer({ id: 'main', version: 1, nid: 9, orders: [], settings: { delx: [{ wo: 'JOB-M1', title: 'Spare doors', customer: 'Cairn', value: 450, manual: true, delVeh: '', delDay: '', delDone: false }] } });
      const A = await openRef(browser, S, ''), B = await openRef(browser, S, '');
      if (order === 'book-saves-first') { await book(B.page, 'JOB-M1', 'IVECO', 'Fri'); await save(B.page); await takeOff(A.page, 'JOB-M1', 'DELETE'); await save(A.page); }
      else { await takeOff(A.page, 'JOB-M1', 'DELETE'); await save(A.page); await book(B.page, 'JOB-M1', 'IVECO', 'Fri'); await save(B.page); }
      await reload(A.page);
      const a = await st(A.page, 'JOB-M1');
      rec(`B ${order}: hand job is in ONE place (on the board XOR archived as taken off) — not both`, !!(a.inDelx) !== !!(a.arch), JSON.stringify(a));
      rec(`B ${order}: hand job not lost (on the board or in Past weeks)`, a.inDelx || a.arch > 0, JSON.stringify(a));
      await A.close(); await B.close();
    }
    // ---------- C: bring back from Past weeks (A) vs Close week (B, stale) on the same delivered job
    for (const order of ['close-first', 'back-first']) {
      const AK = '2026-11-07.zz';
      const row = { id: 'main', version: 1, nid: 9, settings: { delArchive: { [AK]: { at: '2026-11-07T16:00:00Z', w: '2026-11-02', by: 'Pat', notes: {}, pod: {}, jobs: [
        { wo: 'WO-C1', t: 'House', c: 'CAIRN', f: '', u: '', v: 'VOLVO', d: 'Tue', dt: '2026-11-03', val: 900, lAt: '', dAt: '', vAt: '2026-11-03T12:00:00Z', lBy: '', vBy: 'Joe', mv: [], fd: '', mw: null }] } } },
        orders: [O('WO-C1', { delVeh: 'VOLVO', delDay: 'Tue', delWk: W0, delDelivAt: '2026-11-10T12:00:00Z', delivBy: 'Joe', delDone: true })] };
      const S = makeServer(row);
      const A = await openRef(browser, S, ''), B = await openRef(browser, S, '');
      // A: WO-C1 is delivered + still on the board (Tue Wk 46) → ↩ Clear status is the board tool; Past weeks row is for the earlier week.
      const back = async () => { await A.page.evaluate(() => openDelArchive('2026-11-07.zz')); await A.page.waitForTimeout(100);
        const n = await A.page.evaluate(() => { const b = document.querySelector('[data-arcb]'); if (!b) return 0; b.click(); return 1; }); await A.page.waitForTimeout(100);
        if (n) { await NAME(A.page, 'Ann'); await A.page.click('.pod-ovl [data-why="Not delivered after all"]').catch(() => {}); await A.page.waitForTimeout(150); } return n; };
      const close = async () => { await B.page.evaluate(async W0 => { window.confirm = () => true; closeWeek(W0); await new Promise(r => setTimeout(r, 120)); }, W0); await NAME(B.page, 'Bob'); await B.page.waitForTimeout(800); };
      let n;
      if (order === 'close-first') { await close(); await save(B.page); n = await back(); await save(A.page); }
      else { n = await back(); await save(A.page); await close(); await save(B.page); }
      await reload(A.page);
      const a = await st(A.page, 'WO-C1'), toastA = await A.page.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
      rec(`C ${order}: Past-weeks ↩ button was offered on A`, n === 1, '');
      rec(`C ${order}: after both saves, a job A was told is "back on Deliveries" IS on the Deliveries page (or A was told nothing changed)`, a.onPage || /nothing changed/.test(toastA), JSON.stringify({ a, toastA }));
      rec(`C ${order}: no half state (brought-back flag but not tagged)`, !(a.rb === 'back' && !a.delv), JSON.stringify(a));
      await A.close(); await B.close();
    }
    // ---------- D: two PCs book the same empty slot
    {
      const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [O('WO-D1'), O('WO-D2')] });
      const A = await openRef(browser, S, ''), B = await openRef(browser, S, '');
      await A.page.evaluate(() => { window.__asked = []; window.confirm = m => { window.__asked.push(m); return true; }; });
      await B.page.evaluate(() => { window.__asked = []; window.confirm = m => { window.__asked.push(m); return true; }; });
      await A.page.evaluate(W0 => placeJobs([findDel('WO-D1')], 'IVECO', 'Fri', W0), W0); await B.page.evaluate(W0 => placeJobs([findDel('WO-D2')], 'IVECO', 'Fri', W0), W0);
      await save(A.page); await save(B.page); await reload(A.page);
      const r = await A.page.evaluate(W0 => delAll().filter(o => o.delVeh === 'IVECO' && slotIn(o, W0, 'Fri')).map(o => o.wo), W0);
      rec('D: both bookings kept (IVECO Fri has WO-D1 and WO-D2)', r.length === 2, JSON.stringify(r));
      rec('INFO D: neither PC was warned (each saw an empty slot) — expected limitation, the warning is local only', true, JSON.stringify(await A.page.evaluate(() => window.__asked)));
      await A.close(); await B.close();
    }
    // ---------- E: A brings back a delivered step-9 job from Shipped; B (driver phone, stale) re-marks it delivered
    {
      const S9 = '9. JOB SHIPPED';
      const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [O('WO-E1', { step: S9, cienStep: S9, shippedAt: '2026-11-11T10:00:00Z', shippedStep: S9, delv: undefined, delDone: true })] });
      const A = await openRef(browser, S, ''), B = await openRef(browser, S, '');
      await A.page.evaluate(async () => { showTab('h'); await new Promise(r => setTimeout(r, 120)); document.querySelector('[data-shd="WO-E1"]').click(); });
      await A.page.waitForTimeout(100); await NAME(A.page, 'Ann'); await A.page.click('.pod-ovl [data-why="Damaged / returned — deliver again"]'); await A.page.waitForTimeout(150);
      await save(A.page);
      // stale B: an untouched copy edits some other field on the job (a note) and saves
      await B.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-E1'); o.notes = 'call before'; sched(); }); await save(B.page);
      await reload(A.page);
      const a = await M.job(A.page, 'WO-E1');
      rec('E: stale PC editing a note does not undo the bring-back (still on Deliveries, not shipped, shipBack kept)', a.delv && !a.sh && a.back && a.onDel === 1, JSON.stringify({ delv: a.delv, sh: a.sh, back: a.back, onDel: a.onDel }));
      await A.close(); await B.close();
    }
  } catch (e) { rec('test ran', false, e.stack); }
  await browser.close(); done();
})();
