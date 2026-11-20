// d20 (Garry 20 Nov 2026): "If a WO is marked as shipped on a WO or in a new Cienapps merge it moves to the Shipped page. If in any
// window a WO is updated to shipped it moves off the Deliveries page and onto the Shipped page."
//  1. Cienapps import to 9 → off Deliveries for the office (pool, van cells, badge), on 📦 Shipped; booking + stamps kept + logged.
//     (Garry 20 Nov) a LOADED / on-the-road job stays on the driver's run + run sheet until he taps delivered; a not-loaded one leaves
//     them at once and the driver sees "WO-x shipped in Cienapps — removed from your run".
//  2. Step set to 9 by hand on the Capacity Board → same.
//  3. Back below 9 (↩ Bring back to board undoes the hand step) → back on Deliveries exactly as it was.
//  4. A job brought back with ↩ Back to Deliveries stays on Deliveries while Cienapps still says 9; moves on (10) → off again.
//  5. Close week: a shipped booked job is archived with the week ("📦 shipped"); old archived weeks' counts unchanged;
//     this week's scorecard counts it as delivered-by-shipping, shown separately.
//  6. Two PCs: one ships (import) while the other books — both orders; ends on Shipped, booking kept, both PCs agree.
// Fake Supabase only. Run: node tests/deliveries/d20-shipped-off.test.js
const M = require('../ship/merge-lib');
const { H, makeServer, openRef, recorder, save, reload, O, W0, HDR, pick, bringBack, job, delSweep, countIn, importRows, XD } = M;
const { rec, done } = recorder('d20-shipped-off');
const S9 = '9. JOB SHIPPED', S10 = '10. INSTALLED TO BE INVOICE', S8 = '8. PALLETED';
const NAME = async (p, n) => { const has = await p.$('#pick-other'); if (has) { await p.fill('#pick-other', n); await p.click('#pick-ok'); await p.waitForTimeout(120); } };
const row = (wo, step) => [wo, 'House ' + wo, 'CAIRN', XD('2026-11-13'), step, 1000];
const BOOKED = { delVeh: 'IVECO', delDay: 'Fri', delWk: W0, delLoadedAt: '2026-11-12T07:30:00Z', ldBy: 'Joe' };
const shipCard = (p, wo) => p.evaluate(async wo => { showTab('h'); await new Promise(r => setTimeout(r, 100));
  const c = [...document.querySelectorAll('.sh-card')].find(x => (x.querySelector('.wo-num') || {}).textContent === wo); return c ? c.innerText.replace(/\s+/g, ' ') : ''; }, wo);
const driver = (p, veh, day, wk) => p.evaluate(({ veh, day, wk }) => { ls.set('wpfDrvName', 'Joe'); ls.set('wpfDrvVeh', veh); ls.set('wpfDrvDay', day + '|' + wk);
  const d = document.createElement('div'); renderDriver(d); const n = d.querySelector('#drv-shoff');
  return [...d.querySelectorAll('.drv-job')].map(x => x.innerText).join(' | ') + (n ? ' || NOTICE: ' + n.innerText : ''); }, { veh, day, wk }); // run list, then the "shipped — removed from your run" notice
const sheets = (p, wk) => p.evaluate(wk => { window.__opened = []; printRunSheets(wk); return (window.__opened || []).join(''); }, wk);

(async () => {
  const browser = await H.chromium.launch();
  try {
    // ---------- 1 + 2 + 3: import to 9; hand step to 9; back below 9
    {
      const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [O('WO-2701-1', BOOKED), O('WO-2702-1', { delVeh: 'IVECO', delDay: 'Fri', delWk: W0 }), O('WO-2703-1')] });
      const A = await openRef(browser, S, ''); const p = A.page;
      const sw0 = await delSweep(p);
      rec('before: WO-2701-1 and WO-2702-1 on the Iveco Fri cell, WO-2703-1 in the pool', countIn(sw0, 'WO-2701-1').g >= 1 && countIn(sw0, 'WO-2702-1').g >= 1 && countIn(sw0, 'WO-2703-1').pl >= 1, JSON.stringify(sw0.grid));
      rec('before: driver Joe on Iveco Fri sees WO-2701-1', /WO-2701-1/.test(await driver(p, 'IVECO', 'Fri', W0)));
      // 1. import to 9
      const pl = await importRows(p, [row('WO-2701-1', S9), row('WO-2702-1', S8), row('WO-2703-1', S8)]);
      rec('import really matched the jobs (no new work orders)', (pl.newOrders || []).length === 0, JSON.stringify((pl.newOrders || []).map(x => x.wo)));
      const j1 = await job(p, 'WO-2701-1'), sw1 = await delSweep(p);
      rec('1. import 9 → shipped, OFF Deliveries everywhere (no grid cell, no pool, delOnPage false)', j1.sh && j1.onDel === 0 && countIn(sw1, 'WO-2701-1').g === 0 && countIn(sw1, 'WO-2701-1').pl === 0 && !(await p.evaluate(() => delOnPage(DB.orders.find(o => o.wo === 'WO-2701-1')))), JSON.stringify({ j1: { sh: j1.sh, onDel: j1.onDel }, where: countIn(sw1, 'WO-2701-1') }));
      rec('1. …nothing erased: tag, van, day, week and loaded stamp kept on the job', j1.delv && j1.veh === 'IVECO' && j1.day === 'Fri' && j1.wk === W0 && await p.evaluate(() => DB.orders.find(o => o.wo === 'WO-2701-1').delLoadedAt === '2026-11-12T07:30:00Z'), JSON.stringify(j1));
      rec('1. …logged "Off 🚚 Deliveries — shipped (was loaded … · Iveco Fri 13 Nov)"', j1.logs.some(l => /^Off 🚚 Deliveries — shipped \(was loaded 12 Nov .* by Joe · Iveco Fri 13 Nov\)/.test(l)), JSON.stringify(j1.logs.slice(-3)));
      const dr1 = await driver(p, 'IVECO', 'Fri', W0), run1 = dr1.split(' || NOTICE: ');
      rec('1. …(Garry 20 Nov) LOADED WO-2701-1 STAYS on driver Joe\'s run, marked "📦 shipped in Cienapps — still tap DELIVERED"', /WO-2701-1[^|]*shipped in Cienapps — still tap DELIVERED/.test(run1[0]) && /WO-2702-1/.test(run1[0]) && !run1[1], dr1);
      const rs = await sheets(p, W0);
      rec('1. …run sheet keeps the loaded WO-2701-1, marked (shipped)', /WO-2701-1 <b>\(shipped\)<\/b>/.test(rs) && /WO-2702-1/.test(rs), rs.length + ' chars');
      const c1 = await shipCard(p, 'WO-2701-1');
      rec('1. …on 📦 Shipped, card says "🚚 Loaded — still on the driver\'s run…" and "Was on Deliveries: on Iveco Fri 13 Nov · loaded …"', /🚚 Loaded — still on the driver's run until he taps delivered/.test(c1) && /Was on Deliveries: on Iveco Fri 13 Nov · loaded 12 Nov/.test(c1), c1);
      rec('1. …offers ↩ Back to Deliveries (step 9)', await p.evaluate(() => !!document.querySelector('[data-shd="WO-2701-1"]')));
      rec('1. …badge counts 2 (WO-2702-1, WO-2703-1)', sw1.badge === '2', sw1.badge);
      // 2. step 9 by hand on the Capacity Board
      const r2 = await pick(p, 'WO-2702-1', S9);
      rec('2. board step drop-down to 9 asks first and says it comes off Deliveries', r2.asked && /comes off 🚚 Deliveries/.test(r2.asked[0] || ''), JSON.stringify(r2));
      const j2 = await job(p, 'WO-2702-1'), sw2 = await delSweep(p);
      rec('2. …shipped, off Deliveries, booking kept, logged with the name', j2.sh && j2.onDel === 0 && countIn(sw2, 'WO-2702-1').g + countIn(sw2, 'WO-2702-1').pl === 0 && j2.delv && j2.veh === 'IVECO' && j2.day === 'Fri' && j2.logs.some(l => /^Off 🚚 Deliveries — shipped \(was Iveco Fri 13 Nov\)/.test(l)), JSON.stringify({ j2, w: countIn(sw2, 'WO-2702-1') }));
      const dr2 = await driver(p, 'IVECO', 'Fri', W0), run2 = dr2.split(' || NOTICE: ');
      rec('2. …not loaded: off the driver\'s run, badge drops it', !/WO-2702-1/.test(run2[0]) && sw2.badge === '1', dr2);
      rec('2. …driver told "WO-2702-1 shipped in Cienapps — removed from your run"', /WO-2702-1 shipped in Cienapps — removed from your run/.test(run2[1] || ''), dr2);
      const rs2 = await sheets(p, W0);
      rec('2. …run sheet drops the not-loaded WO-2702-1 (loaded WO-2701-1 still on)', !/WO-2702-1/.test(rs2) && /WO-2701-1/.test(rs2), rs2.length + ' chars');
      // 3. back below 9 (Bring back to board undoes the hand-set 9 → 8)
      rec('3. ↩ Bring back to board clicked', (await bringBack(p, 'WO-2702-1')) === 'ok');
      const j3 = await job(p, 'WO-2702-1'), sw3 = await delSweep(p);
      rec('3. …step back to 8, not shipped, back on Deliveries on Iveco Fri as it was', !j3.sh && j3.step === S8 && j3.onDel === 1 && countIn(sw3, 'WO-2702-1').g >= 1 && j3.veh === 'IVECO' && j3.day === 'Fri', JSON.stringify({ step: j3.step, sh: j3.sh, w: countIn(sw3, 'WO-2702-1') }));
      rec('3. …logged "Back on 🚚 Deliveries as it was (on Iveco Fri 13 Nov)"', j3.logs.some(l => /Back on 🚚 Deliveries as it was \(on Iveco Fri 13 Nov\)/.test(l)), JSON.stringify(j3.logs.slice(-3)));
      // 4. a job brought back with ↩ Back to Deliveries stays while Cienapps still says 9
      await p.evaluate(async () => { showTab('h'); await new Promise(r => setTimeout(r, 100)); document.querySelector('[data-shd="WO-2701-1"]').click(); });
      await p.waitForTimeout(100); await NAME(p, 'Mary'); await p.click('.pod-ovl [data-why="Not delivered after all"]'); await p.waitForTimeout(200);
      const j4 = await job(p, 'WO-2701-1');
      rec('4. ↩ Back to Deliveries → in the pool (rebook), not shipped, shipBack 9, old stamps in history', !j4.sh && j4.onDel === 1 && j4.back && j4.back.cs === S9 && !j4.veh && j4.logs.some(l => /Brought back to Deliveries — was · loaded 12 Nov/.test(l)), JSON.stringify(j4));
      await importRows(p, [row('WO-2701-1', S9), row('WO-2702-1', S8), row('WO-2703-1', S8)]);
      const j4b = await job(p, 'WO-2701-1');
      rec('4. …the next import still saying 9 leaves it on Deliveries', !j4b.sh && j4b.onDel === 1, JSON.stringify({ sh: j4b.sh, onDel: j4b.onDel }));
      await importRows(p, [row('WO-2701-1', S10), row('WO-2702-1', S8), row('WO-2703-1', S8)]);
      const j4c = await job(p, 'WO-2701-1');
      rec('4. …Cienapps moves on to 10 → shipped again, off Deliveries', j4c.sh && j4c.onDel === 0, JSON.stringify({ sh: j4c.sh, onDel: j4c.onDel }));
      rec('no page errors (1–4)', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 400));
      await A.close();
    }
    // ---------- 5: close week / scorecard
    {
      const AK = '2026-11-07.old';
      const oldJobs = [{ wo: 'WO-2600-1', t: 'House', c: 'CAIRN', f: '', u: '', v: 'VOLVO', d: 'Tue', dt: '2026-11-03', val: 900, lAt: '', dAt: '', vAt: '2026-11-03T12:00:00Z', lBy: '', vBy: 'Joe', mv: [], fd: '', mw: null },
        { wo: 'WO-2601-1', t: 'House', c: 'CAIRN', f: '', u: '', v: 'VOLVO', d: 'Tue', dt: '2026-11-03', val: 900, lAt: '2026-11-03T07:00:00Z', dAt: '', vAt: '', lBy: '', vBy: '', mv: [], fd: '', mw: null }];
      const S = makeServer({ id: 'main', version: 1, nid: 9, settings: { delArchive: { [AK]: { at: '2026-11-07T16:00:00Z', w: '2026-11-02', by: 'Pat', notes: {}, pod: {}, jobs: oldJobs } } },
        orders: [O('WO-2711-1', { delVeh: 'IVECO', delDay: 'Tue', delWk: W0, delLoadedAt: '2026-11-10T07:00:00Z', step: S9, cienStep: S9, shippedAt: '2026-11-10T18:00:00Z', shippedStep: S9 }),
          O('WO-2712-1', { delVeh: 'IVECO', delDay: 'Tue', delWk: W0, delDelivAt: '2026-11-10T11:00:00Z', delivBy: 'Joe', delDone: true })] });
      const A = await openRef(browser, S, ''); const p = A.page;
      const sc0 = await p.evaluate(() => { const ar = DB.delArchive['2026-11-07.old']; return { old: JSON.stringify(weekPerf(ar.jobs.map(j => ({ ...j, mv: j.mv || [], mw: j.mw || null })), 7)), live: weekPerf(liveWeekJobs(), todayDayIx()) }; });
      rec('5. this week (Thu): 2 due, 2 on time — the shipped-not-delivered one counts as delivered-by-shipping, shown separately', sc0.live.due === 2 && sc0.live.onTime === 2 && sc0.live.ship === 1 && sc0.live.never.length === 0, JSON.stringify(sc0.live));
      const html = await p.evaluate(() => scorecardHTML(8));
      rec('5. …scorecard says "incl. 📦 1 shipped"', /incl\. 📦 1 shipped/.test(html));
      await p.evaluate(async W0 => { window.confirm = m => { window.__cw = m; return true; }; closeWeek(W0); await new Promise(r => setTimeout(r, 150)); }, W0);
      await NAME(p, 'Pat'); await p.waitForTimeout(1500);
      const cw = await p.evaluate(() => window.__cw || '');
      rec('5. close-week question lists the shipped job', /1 shipped \(already off Deliveries, on 📦 Shipped\)/.test(cw), cw.slice(0, 500));
      const ar = await p.evaluate(() => { const ks = Object.keys(DB.delArchive).filter(k => k !== '2026-11-07.old'); const a = ks.length === 1 ? DB.delArchive[ks[0]] : null;
        const o = DB.orders.find(x => x.wo === 'WO-2711-1'); return { n: ks.length, jobs: a ? a.jobs.map(j => j.wo + ':' + (j.sh ? 'sh' : '') + ':' + (j.vAt ? 'v' : '') + ':' + j.v + j.d + ':' + (j.lAt ? 'l' : '')) : [], old: JSON.stringify(DB.delArchive['2026-11-07.old'].jobs),
          o: { delv: !!o.delv, veh: o.delVeh, done: !!o.delDone, was: o.delShipWas, sh: !!o.shippedAt, log: (o.log || []).slice(-1)[0] } }; });
      rec('5. …the closed week holds both jobs: WO-2712-1 delivered, WO-2711-1 "shipped" with its van, day and loaded stamp', ar.n === 1 && ar.jobs.includes('WO-2712-1::v:IVECOTue:') && ar.jobs.includes('WO-2711-1:sh::IVECOTue:l'), JSON.stringify(ar.jobs));
      rec('5. …old archived week untouched (rows identical, same counts)', ar.old === JSON.stringify(oldJobs) && await p.evaluate(o => JSON.stringify(weekPerf(DB.delArchive['2026-11-07.old'].jobs.map(j => ({ ...j, mv: j.mv || [], mw: j.mw || null })), 7)) === o, sc0.old), ar.old.slice(0, 200));
      rec('5. …WO-2711-1 still shipped; booking moved into delShipWas (shown on its card), not marked delivered (Tester G2), logged', ar.o.sh && !ar.o.delv && !ar.o.done && ar.o.was && /on Iveco Tue 10 Nov · loaded 10 Nov/.test(ar.o.was.txt) && /Wk 46 closed — shipped/.test((ar.o.log || {}).what || ''), JSON.stringify(ar.o));
      const c5 = await shipCard(p, 'WO-2711-1');
      rec('5. …Shipped card still says where it was, and "Delivered by shipping" (not a blank delivered date)', /✓ Delivered by shipping/.test(c5) && /Was on Deliveries: on Iveco Tue 10 Nov · loaded 10 Nov/.test(c5), c5);
      await p.evaluate(() => { const k = Object.keys(DB.delArchive).find(k => k !== '2026-11-07.old'); openDelArchive(k); }); await p.waitForTimeout(100);
      const pw = await p.evaluate(() => [...document.querySelectorAll('.pod-ovl')].pop().innerText.replace(/\s+/g, ' '));
      rec('5. …📚 Past weeks: "1/2 + 📦 1 shipped" and the row says "📦 shipped"', /1\/2 \+ 📦 1 shipped/.test(pw) && /📦 shipped 10 Nov/.test(pw), pw.slice(0, 600));
      rec('5. …a second close of the same week archives nothing new for it', await p.evaluate(W0 => closeWeekShipped(W0).length === 0 && closeWeekJobs(W0).length === 0, W0));
      rec('no page errors (5)', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 400));
      await A.close();
    }
    // ---------- 7 (Garry 20 Nov): the driver taps DELIVERED on a loaded job that shipped → stamped, leaves his run, card ✓ Delivered by him
    {
      const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [O('WO-2731-1', { delVeh: 'IVECO', delDay: 'Thu', delWk: W0, delLoadedAt: '2026-11-12T07:00:00Z', ldBy: 'Joe', step: S9, cienStep: S9, shippedAt: '2026-11-12T09:00:00Z', shippedStep: S9 }),
        O('WO-2732-1', { delVeh: 'IVECO', delDay: 'Thu', delWk: W0 })] });
      const A = await openRef(browser, S, ''); const p = A.page;
      const sw = await delSweep(p);
      rec('7. office: the loaded + shipped WO-2731-1 is off the Deliveries board', countIn(sw, 'WO-2731-1').g + countIn(sw, 'WO-2731-1').pl === 0, JSON.stringify(sw.grid));
      const t0 = await p.evaluate(async () => { ls.set('wpfDrvName', 'Joe'); ls.set('wpfDrvVeh', 'IVECO'); ls.set('wpfDrvDay', 'Thu|' + thisWk()); localStorage.setItem('wpfPin_driver', '9000'); setRole('driver'); await new Promise(r => setTimeout(r, 200));
        return [...document.querySelectorAll('.drv-job')].map(x => x.innerText.replace(/\s+/g, ' ')).join(' | '); });
      rec('7. driver: it is on his run with a DELIVERED button', /WO-2731-1/.test(t0) && await p.evaluate(() => !!document.querySelector('[data-ddv="WO-2731-1"]')), t0);
      const un = await p.evaluate(async () => { document.querySelector('[data-dl="WO-2731-1"]').click(); await new Promise(r => setTimeout(r, 100)); return !!DB.orders.find(o => o.wo === 'WO-2731-1').delLoadedAt; });
      rec('7. …tapping ON VAN ✓ again does not take it off the van (it would vanish) — told to tap DELIVERED', un);
      const t1 = await p.evaluate(async () => { window.confirm = () => true; document.querySelector('[data-ddv="WO-2731-1"]').click(); await new Promise(r => setTimeout(r, 200));
        const o = DB.orders.find(x => x.wo === 'WO-2731-1'); return { by: o.delivBy, at: !!o.delDelivAt, run: [...document.querySelectorAll('.drv-job')].map(x => x.innerText.replace(/\s+/g, ' ')).join(' | '), photo: !!document.getElementById('drv-photo') }; });
      rec('7. …DELIVERED tap: stamped by Joe, leaves his run, photo button still there', t1.by === 'Joe' && t1.at && !/WO-2731-1/.test(t1.run) && /WO-2732-1/.test(t1.run) && t1.photo, JSON.stringify(t1));
      await p.evaluate(() => setRole('office'));
      const c7 = await shipCard(p, 'WO-2731-1');
      rec('7. …Shipped card says "✓ Delivered 12 Nov by Joe"', /✓ Delivered 12 Nov by Joe/.test(c7), c7);
      rec('no page errors (7)', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
      await A.close();
    }
    // ---------- 6: two PCs — A imports 9 while B books the job (both save orders)
    for (const order of ['ship-saves-first', 'book-saves-first']) {
      const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [O('WO-2721-1')] });
      const A = await openRef(browser, S, ''), B = await openRef(browser, S, '');
      const ship = async () => { await importRows(A.page, [row('WO-2721-1', S9)]); await save(A.page); };
      const book = async () => { await B.page.evaluate(W0 => { window.confirm = () => true; placeJobs([findDel('WO-2721-1')], 'IVECO', 'Fri', W0); }, W0); await B.page.waitForTimeout(150); await save(B.page); };
      if (order === 'ship-saves-first') { await ship(); await book(); } else { await book(); await ship(); }
      await reload(A.page); await reload(B.page);
      const a = await job(A.page, 'WO-2721-1'), b = await job(B.page, 'WO-2721-1');
      const k = j => JSON.stringify({ sh: j.sh, onDel: j.onDel, delv: j.delv, veh: j.veh, day: j.day });
      rec(`6 ${order}: ends on Shipped, off Deliveries`, a.sh && a.onDel === 0, k(a));
      rec(`6 ${order}: both PCs agree (shipped, off Deliveries, same booking)`, k(a) === k(b), k(a) + ' vs ' + k(b));
      rec(`6 ${order}: B's booking is not lost (kept on the job, shown on the Shipped card)`, a.veh === 'IVECO' && a.day === 'Fri' && /Was on Deliveries: on Iveco Fri 13 Nov/.test(await shipCard(A.page, 'WO-2721-1')), k(a));
      rec(`6 ${order}: no page errors`, !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
      await A.close(); await B.close();
    }
  } catch (e) { rec('test ran', false, e.stack); }
  await browser.close(); done();
})();
