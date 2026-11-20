// attack20-ship-1 (Tester, 20 Nov 2026): Garry's d20 rule "shipped = off 🚚 Deliveries" vs the driver mid-run, two PCs and an old screen.
//  A. driver's page open (stale) when an import ships a job he is carrying; he taps DELIVERED while offline, then back online
//  B. the driver's run after a refresh: a loaded / on-the-road job that Cienapps shipped
//  C. two PCs: ship vs office "mark delivered" on Deliveries; ship vs a ticked selection / drag / ⤵ Place on the other PC
//  D. an OLD screen (origin/main — shipped jobs still on Deliveries there) saving after: moves the job, closes the week
// Fake Supabase only. Run: node tests/deliveries/attack20-ship-1-driver-twopc.test.js
const M = require('../ship/merge-lib');
const { H, makeServer, openRef, recorder, save, reload, O, W0, W1, job, importRows, XD } = M;
const { rec, done } = recorder('attack20-ship-1');
const S9 = '9. JOB SHIPPED', S8 = '8. PALLETED';
const row = (wo, step) => [wo, 'House ' + wo, 'CAIRN', XD('2026-11-13'), step, 1000];
const OLD = 'origin/main';
const drvSetup = (p, veh, day, wk) => p.evaluate(async ({ veh, day, wk }) => { localStorage.setItem('wpfDrvName', 'Joe'); localStorage.setItem('wpfDrvVeh', veh); localStorage.setItem('wpfDrvDay', day + '|' + wk);
  localStorage.setItem('wpfPin_driver', '9000'); setRole('driver'); await new Promise(r => setTimeout(r, 200)); return document.getElementById('app').innerText; }, { veh, day, wk });
const shipCard = (p, wo) => p.evaluate(async wo => { setRole('office'); showTab('h'); await new Promise(r => setTimeout(r, 120));
  const c = document.getElementById('sh-done'); if (c && !c.checked) { c.checked = true; c.onchange(); await new Promise(r => setTimeout(r, 60)); }
  const k = [...document.querySelectorAll('.sh-card')].find(x => (x.querySelector('.wo-num') || {}).textContent === wo); return k ? k.innerText.replace(/\s+/g, ' ') : ''; }, wo);

(async () => {
  const browser = await H.chromium.launch();
  try {
    // ---------- A + B: driver mid-run
    {
      const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [
        O('WO-3001-1', { delVeh: 'IVECO', delDay: 'Thu', delWk: W0, delLoadedAt: '2026-11-12T07:00:00Z', ldBy: 'Joe', delDispAt: '2026-11-12T08:00:00Z' }), // on the road now
        O('WO-3002-1', { delVeh: 'IVECO', delDay: 'Thu', delWk: W0, delLoadedAt: '2026-11-12T07:00:00Z', ldBy: 'Joe', delDispAt: '2026-11-12T08:00:00Z' }),
        O('WO-3003-1', { delVeh: 'IVECO', delDay: 'Thu', delWk: W0, delLoadedAt: '2026-11-12T07:00:00Z', ldBy: 'Joe' }) ] });
      const A = await openRef(browser, S, ''), D = await openRef(browser, S, '', { viewport: { width: 360, height: 740 } });
      const t0 = await drvSetup(D.page, 'IVECO', 'Thu', W0);
      rec('A0 driver Joe sees all three drops on the Iveco Thu', ['WO-3001-1', 'WO-3002-1', 'WO-3003-1'].every(w => t0.includes(w)), t0.slice(0, 300));
      await importRows(A.page, [row('WO-3001-1', S9), row('WO-3002-1', S8), row('WO-3003-1', S9)]); await save(A.page);
      // driver's page still shows the old run (no sync yet); he goes out of coverage, taps DELIVERED on WO-3001-1
      S.offline = true;
      const tap = await D.page.evaluate(async () => { window.confirm = () => true; const b = document.querySelector('[data-ddv="WO-3001-1"]'); if (!b) return 'no button'; b.click();
        await new Promise(r => setTimeout(r, 200)); try { clearTimeout(saveT); await saveDB(); } catch (e) {} await new Promise(r => setTimeout(r, 300));
        return { failed: !!DB.saveFailed, banner: /NOT SAVED YET/.test(document.getElementById('app').innerText) }; });
      rec('A1 offline tap on a job already shipped elsewhere: driver is told NOT SAVED YET', tap !== 'no button' && tap.failed && tap.banner, JSON.stringify(tap));
      S.offline = false; await save(D.page); await D.page.waitForTimeout(300); await reload(A.page);
      const j = await job(A.page, 'WO-3001-1');
      const dv = await A.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-3001-1'); return { at: o.delDelivAt || '', by: o.delivBy || '', done: !!o.delDone }; });
      rec('A2 back online: the driver\'s DELIVERED (time + name) is kept on the shipped job — not lost to the ship', j.sh && !!dv.at && dv.by === 'Joe' && dv.done, JSON.stringify({ sh: j.sh, dv }));
      const c = await shipCard(A.page, 'WO-3001-1');
      rec('A3 Shipped card says "✓ Delivered" with the date (not "Off Deliveries")', /✓ Delivered 1?\d? ?Nov|✓ Delivered \d/.test(c) && !/Off Deliveries \(shipped\)/.test(c), c.slice(0, 300));
      // B. driver refreshes: WO-3003-1 is loaded on his van but Cienapps shipped it
      await reload(D.page); const t1 = await drvSetup(D.page, 'IVECO', 'Thu', W0);
      rec('B1 (d20 rule) after a refresh the driver\'s run drops the shipped jobs WO-3001-1 / WO-3003-1, keeps WO-3002-1', !t1.includes('WO-3003-1') && !t1.includes('WO-3001-1') && t1.includes('WO-3002-1'), t1.slice(0, 400));
      rec('B2 FINDING-CHECK: the driver is told a loaded drop left his run because it was shipped (WO-3003-1 is physically on his van)', /shipped/i.test(t1) && /WO-3003-1/.test(t1), t1.slice(0, 400));
      // ALL DELIVERED now: WO-3003-1 (on his van, shipped) never gets a delivered stamp
      await D.page.evaluate(async () => { window.confirm = () => true; const b = document.getElementById('drv-alldeliv'); if (b) b.click(); await new Promise(r => setTimeout(r, 300)); try { clearTimeout(saveT); await saveDB(); } catch (e) {} });
      await reload(A.page);
      const j3 = await A.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-3003-1'); return { at: o.delDelivAt || '', sh: !!o.shippedAt, l: o.delLoadedAt || '' }; });
      rec('B3 INFO: after ALL DELIVERED the shipped WO-3003-1 (loaded on that van) has no delivered stamp — Shipped card shows "Off Deliveries (shipped)"', true, JSON.stringify(j3));
      rec('A/B no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
      await A.close(); await D.close();
    }
    // ---------- C1: ship (import on A) vs office marks delivered on B's stale Deliveries page — both orders
    for (const order of ['ship-first', 'deliv-first']) {
      const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [O('WO-3011-1', { delVeh: 'IVECO', delDay: 'Wed', delWk: W0 })] });
      const A = await openRef(browser, S, ''), B = await openRef(browser, S, '');
      const ship = async () => { await importRows(A.page, [row('WO-3011-1', S9)]); await save(A.page); };
      const deliv = async () => { await B.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-3011-1'); const t = '2026-11-11T15:00:00Z'; o.delLoadedAt = t; o.delDispAt = t; o.delDelivAt = t; o.delDone = true; o.delivBy = 'Mary'; sched(); }); await save(B.page); };
      if (order === 'ship-first') { await ship(); await deliv(); } else { await deliv(); await ship(); }
      await reload(A.page); await reload(B.page);
      const a = await job(A.page, 'WO-3011-1'), b = await job(B.page, 'WO-3011-1');
      const x = await A.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-3011-1'); return { v: o.delDelivAt || '', by: o.delivBy || '' }; });
      rec(`C1 ${order}: shipped AND delivered by Mary kept; both PCs agree`, a.sh && x.v && x.by === 'Mary' && JSON.stringify([a.sh, a.veh, a.day, a.done]) === JSON.stringify([b.sh, b.veh, b.day, b.done]), JSON.stringify({ a: [a.sh, a.veh, a.day, a.done], b: [b.sh, b.veh, b.day, b.done], x }));
      rec(`C1 ${order}: no page errors`, !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
      await A.close(); await B.close();
    }
    // ---------- C2: B has WO-3021-1 ticked, A ships it; B gets the sync then books the ticked jobs / drags to another week
    {
      const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [O('WO-3021-1', { dueDate: '2026-11-18', plannedWeek: W1 }), O('WO-3022-1', { dueDate: '2026-11-18', plannedWeek: W1 })] });
      const A = await openRef(browser, S, ''), B = await openRef(browser, S, '');
      await B.page.evaluate(async () => { showTab('d'); await new Promise(r => setTimeout(r, 100)); delSel.add('WO-3021-1'); delSel.add('WO-3022-1'); render(); });
      await importRows(A.page, [row('WO-3021-1', S9)]); await save(A.page);
      await reload(B.page);
      const sel = await B.page.evaluate(() => ({ live: delSelLive(), all: [...delSel] }));
      rec('C2 B pulled the ship: the ticked shipped job drops out of the live selection', !sel.live.includes('WO-3021-1') && sel.live.includes('WO-3022-1'), JSON.stringify(sel));
      await B.page.evaluate(W1 => { window.confirm = () => true; sessionStorage.setItem('wpfWho', 'Op'); placeJobs([...delSel].map(findDel).filter(Boolean), 'VOLVO', 'Tue', W1); }, W1);
      await B.page.waitForTimeout(300);
      const j1 = await job(B.page, 'WO-3021-1'), j2 = await job(B.page, 'WO-3022-1');
      rec('C2 ⤵ Place of the ticked jobs books WO-3022-1 only — the shipped WO-3021-1 is not put on a van', j2.veh === 'VOLVO' && j2.day === 'Tue' && !j1.veh && j1.sh, JSON.stringify({ j1: [j1.veh, j1.day, j1.sh], j2: [j2.veh, j2.day] }));
      // drag: a drag started before the sync, dropped after (delDragList still holds the shipped job)
      const due0 = await B.page.evaluate(() => DB.orders.find(x => x.wo === 'WO-3021-1').dueDate);
      const dr = await B.page.evaluate(async () => { showTab('d'); await new Promise(r => setTimeout(r, 100)); delDragList = ['WO-3021-1']; window.__t = [];
        const tb = document.querySelector('[data-deltab="2"]'); if (!tb || !tb.ondrop) return 'no tab'; tb.ondrop({ preventDefault() {}, dataTransfer: { getData: () => '' } }); await new Promise(r => setTimeout(r, 200));
        const o = DB.orders.find(x => x.wo === 'WO-3021-1'); return { due: o.dueDate, pw: o.plannedWeek, toast: (document.getElementById('toast') || {}).textContent || '' }; });
      rec('C2 a drag of the (now shipped) job onto a week tab moves nothing and says why', dr !== 'no tab' && dr.due === due0 && /shipped/i.test(dr.toast), JSON.stringify({ due0, dr }));
      rec('C2 no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
      await A.close(); await B.close();
    }
    // ---------- D: old screen (origin/main) saving after the new screen shipped the job
    {
      const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [
        O('WO-3031-1', { delVeh: 'IVECO', delDay: 'Tue', delWk: W0, delLoadedAt: '2026-11-10T07:00:00Z', ldBy: 'Joe' }),
        O('WO-3032-1', { delVeh: 'IVECO', delDay: 'Wed', delWk: W0 }), O('WO-3033-1', { delVeh: 'IVECO', delDay: 'Mon', delWk: W0, delDelivAt: '2026-11-09T12:00:00Z', delDone: true, delivBy: 'Joe' })] });
      const N = await openRef(browser, S, ''), Old = await openRef(browser, S, OLD);
      await importRows(N.page, [row('WO-3031-1', S9), row('WO-3032-1', S9), row('WO-3033-1', S8)]); await save(N.page);
      await reload(Old.page);
      const oldSees = await Old.page.evaluate(() => delAll().map(o => o.wo));
      rec('D0 INFO old screen still lists the shipped jobs on its Deliveries (old rule) — close old screens at go-live', true, JSON.stringify(oldSees));
      // old screen closes Wk 46 (it treats WO-3031-1/3032-1 as "booked, not delivered")
      await Old.page.evaluate(async W0 => { window.confirm = () => true; sessionStorage.setItem('wpfWho', 'Old'); closeWeek(W0); await new Promise(r => setTimeout(r, 1500)); }, W0);
      await Old.page.evaluate(() => { const b = document.querySelector('#pick-other'); if (b) { b.value = 'Old'; } });
      await save(Old.page); await reload(N.page);
      const r = await N.page.evaluate(() => { const ks = Object.keys(DB.delArchive || {}); const a = ks.length ? DB.delArchive[ks[ks.length - 1]] : null;
        const g = w => { const o = DB.orders.find(x => x.wo === w); return { sh: !!o.shippedAt, veh: o.delVeh || '', day: o.delDay || '', rb: o.delRebook ? o.delRebook.why : '', l: o.delLoadedAt || '', was: delShipWasTxt(o) }; };
        return { n: ks.length, rows: a ? a.jobs.map(j => j.wo + ':' + (j.sh ? 'sh' : '-')) : [], j1: g('WO-3031-1'), j2: g('WO-3032-1'), perf: a ? weekPerf(a.jobs.map(j => ({ ...j, mv: j.mv || [], mw: j.mw || null })), 7) : null }; });
      rec('D1 FINDING-CHECK old screen closing the week after a ship: shipped jobs archived as "shipped" (not as never-left / rebook)', r.rows.includes('WO-3031-1:sh') && r.rows.includes('WO-3032-1:sh'), JSON.stringify(r).slice(0, 700));
      rec('D2 FINDING-CHECK … and the new Shipped card still says where it was (van/day/loaded)', /Iveco/.test(r.j1.was) && /Iveco/.test(r.j2.was), JSON.stringify({ j1: r.j1, j2: r.j2 }));
      rec('D no page errors (new screen)', !(S.errors || []).filter(e => !/^OLD:/.test(e)).length, (S.errors || []).join(' | ').slice(0, 300));
      await N.close(); await Old.close();
    }
    {  // D3: old screen (stale) moves the shipped job's day after the ship → new screen: still shipped, off Deliveries, card shows the new day
      const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [O('WO-3041-1', { delVeh: 'IVECO', delDay: 'Fri', delWk: W0 })] });
      const N = await openRef(browser, S, ''), Old = await openRef(browser, S, OLD);
      await importRows(N.page, [row('WO-3041-1', S9)]); await save(N.page);
      await Old.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-3041-1'); o.delDay = 'Sat'; (o.delMoves = o.delMoves || []).push({ at: new Date().toISOString(), by: 'Old', from: 'IVECO|Fri', to: 'IVECO|Sat', why: 'Other' }); sched(); });
      await save(Old.page); await reload(N.page);
      const j = await job(N.page, 'WO-3041-1'), c = await shipCard(N.page, 'WO-3041-1');
      rec('D3 old screen moves the shipped job Fri→Sat: still shipped + off Deliveries on the new screen; Shipped card shows Sat', j.sh && j.onDel === 0 && j.day === 'Sat' && /Sat/.test(c), JSON.stringify({ sh: j.sh, onDel: j.onDel, day: j.day, c: c.slice(0, 200) }));
      await N.close(); await Old.close();
    }
  } catch (e) { rec('test ran', false, e.stack); }
  await browser.close(); done();
})();
