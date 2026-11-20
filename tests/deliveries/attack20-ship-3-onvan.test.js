// attack20-ship-3 (Tester, 20 Nov 2026): re-attack after 2817a26 / 2419421 — Garry's live rule: a LOADED / on-the-road job that ships
// stays on the DRIVER's run ("📦 shipped in Cienapps — still tap DELIVERED") until he taps delivered; not-loaded ones leave with a
// "removed from your run" line. Also G2 again, Excel Shipped column, shipped + on hold.
// Fake Supabase only. Run: node tests/deliveries/attack20-ship-3-onvan.test.js
const M = require('../ship/merge-lib');
const { H, makeServer, openRef, recorder, save, reload, O, W0, job, importRows, XD, pick, bringBack } = M;
const { rec, done } = recorder('attack20-ship-3');
const S9 = '9. JOB SHIPPED', S8 = '8. PALLETED', S12 = '12. ON HOLD / DELETE';
const row = (wo, step) => [wo, 'House ' + wo, 'CAIRN', XD('2026-11-13'), step, 1000];
const NAME = async (p, n) => { const has = await p.$('#pick-other'); if (has) { await p.fill('#pick-other', n); await p.click('#pick-ok'); await p.waitForTimeout(120); } };
const close = async (p, wk) => { await p.evaluate(async wk => { sessionStorage.setItem('wpfWho', 'Pat'); window.confirm = m => { window.__cw = m; return true; }; closeWeek(wk); await new Promise(r => setTimeout(r, 150)); }, wk); await NAME(p, 'Pat'); await p.waitForTimeout(1500); };
const drv = (p, name, veh) => p.evaluate(async ({ name, veh }) => { localStorage.setItem('wpfDrvName', name); localStorage.setItem('wpfDrvVeh', veh); localStorage.setItem('wpfDrvDay', 'Thu|' + thisWk());
  localStorage.removeItem('wpfDrvPick'); localStorage.setItem('wpfPin_driver', '9000'); setRole('driver'); await new Promise(r => setTimeout(r, 200));
  return { run: [...document.querySelectorAll('.drv-job')].map(x => x.innerText.replace(/\s+/g, ' ')).join(' | '), all: document.getElementById('app').innerText.replace(/\s+/g, ' '), photo: !!document.getElementById('drv-photo'), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; }, { name, veh });
const g = (p, wo) => p.evaluate(wo => { const o = DB.orders.find(x => x.wo === wo); return { sh: !!o.shippedAt, delv: !!o.delv, veh: o.delVeh || '', day: o.delDay || '', l: o.delLoadedAt || '', v: o.delDelivAt || '', by: o.delivBy || '', done: !!o.delDone, stage: dStage(o), onPage: delOnPage(o), onVanSh: typeof delOnVanShipped === 'function' ? delOnVanShipped(o) : null }; }, wo);

(async () => {
  const browser = await H.chromium.launch();
  try {
    // ---------- 1. G2 again: hand-ship, close week, Bring back, re-tag; and the same for an import-shipped job
    {
      const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [O('WO-3601-1', { delVeh: 'IVECO', delDay: 'Tue', delWk: W0 }), O('WO-3602-1', { delVeh: 'IVECO', delDay: 'Tue', delWk: W0, delLoadedAt: '2026-11-10T07:00:00Z' })] });
      const A = await openRef(browser, S, ''), p = A.page;
      await pick(p, 'WO-3601-1', S9); await importRows(p, [row('WO-3602-1', S9), row('WO-3601-1', S8)]);
      await close(p, W0);
      const ar = await p.evaluate(W0 => Object.values(DB.delArchive || {}).filter(a => a.w === W0).map(a => a.jobs.map(j => j.wo + (j.sh ? ':sh' : ''))), W0);
      rec('1a close Wk 46: hand-shipped WO-3601-1 archived as shipped; INFO where the loaded shipped WO-3602-1 went', JSON.stringify(ar).includes('WO-3601-1:sh'), JSON.stringify({ ar, j2: await g(p, 'WO-3602-1') }));
      for (const wo of ['WO-3601-1', 'WO-3602-1']) {
        await bringBack(p, wo);
        const t = await p.evaluate(async wo => { showTab('b'); await new Promise(r => setTimeout(r, 120)); const o = DB.orders.find(x => x.wo === wo); const b = document.querySelector('[data-dv="' + wo + '"]');
          if (!b) return { no: 'toggle', sh: !!o.shippedAt }; if (!o.delv) b.click(); await new Promise(r => setTimeout(r, 100)); return { delv: !!o.delv, done: !!o.delDone, stage: dStage(o), onPage: delOnPage(o), was: !!o.delShipWas }; }, wo);
        rec(`1b ${wo}: Bring back after the shipped week closed, re-tag → on Deliveries, NOT shown as delivered`, t.onPage && t.stage !== 'deliv' && !t.done, JSON.stringify(t));
      }
      rec('1 no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
      await A.close();
    }
    // ---------- 2. driver with a shipped LOADED job: un-tick, offline DELIVERED, photo, run sheet, 360 px, two drivers
    {
      const S = makeServer({ id: 'main', version: 1, nid: 9, settings: { vanDrv: { ['IVECO|2026-11-12']: 'Joe' } }, orders: [
        O('WO-3701-1', { delVeh: 'IVECO', delDay: 'Thu', delWk: W0, delLoadedAt: '2026-11-12T07:00:00Z', ldBy: 'Joe', title: 'O\'Grady <b>x</b> 🏠 ' + 'long name '.repeat(8) }),
        O('WO-3702-1', { delVeh: 'IVECO', delDay: 'Thu', delWk: W0, delLoadedAt: '2026-11-12T07:00:00Z', ldBy: 'Joe' }),
        O('WO-3703-1', { delVeh: 'IVECO', delDay: 'Thu', delWk: W0 }) ] });
      const A = await openRef(browser, S, ''), D = await openRef(browser, S, '', { viewport: { width: 360, height: 740 } });
      await importRows(A.page, [row('WO-3701-1', S9), row('WO-3702-1', S8), row('WO-3703-1', S9)]); await save(A.page);
      await reload(D.page); const d0 = await drv(D.page, 'Joe', 'IVECO');
      rec('2a run: loaded shipped WO-3701-1 stays, marked "still tap DELIVERED"; not-loaded shipped WO-3703-1 off the run and named "removed from your run"', /WO-3701-1[^|]*still tap DELIVERED/.test(d0.run) && !d0.run.includes('WO-3703-1') && /WO-3703-1 shipped in Cienapps — removed from your run/.test(d0.all), d0.run.slice(0, 300));
      rec('2b 360 px driver page with the shipped mark + long odd title: no sideways scroll, no HTML injected', d0.sw <= d0.cw + 1 && !(await D.page.evaluate(() => !!document.querySelector('.drv-job b b, .drv-jt b'))), JSON.stringify({ sw: d0.sw, cw: d0.cw }));
      const un = await D.page.evaluate(async () => { const b = document.querySelector('[data-dl="WO-3701-1"]'); if (!b) return 'no button'; b.click(); await new Promise(r => setTimeout(r, 150)); const o = DB.orders.find(x => x.wo === 'WO-3701-1'); return { l: o.delLoadedAt || '', toast: (document.getElementById('toast') || {}).textContent || '' }; });
      rec('2c ON VAN un-tick on the shipped loaded job is refused (stays loaded, says why)', un !== 'no button' && !!un.l && /stays on your van list/.test(un.toast), JSON.stringify(un));
      const sheet = await A.page.evaluate(W0 => { window.__opened = []; const wo = window.open; window.open = () => ({ document: { open() {}, write(s) { window.__opened.push(s); }, close() {} }, focus() {}, print() {} }); try { printRunSheets(W0); } catch (e) { return 'ERR ' + e.message; } window.open = wo; return window.__opened.join(''); }, W0);
      rec('2d run sheet lists WO-3701-1 "(shipped)", leaves out WO-3703-1', /WO-3701-1[^<]*<b>\(shipped\)<\/b>/.test(sheet) && !/WO-3703-1/.test(sheet), String(sheet).length + ' chars');
      const mick = await drv(D.page, 'Mick', 'IVECO'), other = await drv(D.page, 'Mick', 'VOLVO');
      rec('2e another driver looking at the Iveco also sees the shipped loaded drop; the Volvo run does not', /WO-3701-1/.test(mick.run) && !/WO-3701-1/.test(other.run) && !/WO-3701-1/.test(other.all), JSON.stringify({ m: mick.run.slice(0, 120), o: other.run.slice(0, 120) }));
      // office view: off the Deliveries board, on Shipped "still on the driver's run"
      const off = await A.page.evaluate(async () => { const o = DB.orders.find(x => x.wo === 'WO-3701-1'); showTab('h'); await new Promise(r => setTimeout(r, 120)); const c = [...document.querySelectorAll('.sh-card')].find(x => (x.querySelector('.wo-num') || {}).textContent === 'WO-3701-1'); return { onPage: delOnPage(o), card: c ? c.innerText.replace(/\s+/g, ' ') : '' }; });
      rec('2f office: off the Deliveries board, Shipped card says still on the driver\'s run', !off.onPage && /still on the driver's run/.test(off.card), off.card.slice(0, 200));
      // DELIVERED while offline, then back online
      await drv(D.page, 'Joe', 'IVECO'); S.offline = true;
      const t = await D.page.evaluate(async () => { window.confirm = () => true; const b = document.querySelector('[data-ddv="WO-3701-1"]'); if (!b) return 'no button'; b.click(); await new Promise(r => setTimeout(r, 200));
        try { clearTimeout(saveT); await saveDB(); } catch (e) {} await new Promise(r => setTimeout(r, 300)); return { failed: !!DB.saveFailed, banner: /NOT SAVED YET/.test(document.getElementById('app').innerText) }; });
      rec('2g DELIVERED offline on the shipped drop: told NOT SAVED YET', t !== 'no button' && t.failed && t.banner, JSON.stringify(t));
      S.offline = false; await save(D.page); await D.page.waitForTimeout(300); await reload(A.page);
      const j = await g(A.page, 'WO-3701-1');
      rec('2h back online: delivered by Joe kept on the shipped job; it has left his run', j.sh && !!j.v && j.by === 'Joe' && !(await drv(D.page, 'Joe', 'IVECO')).run.includes('WO-3701-1'), JSON.stringify(j));
      // photo with only... WO-3702-1 (not shipped) left: photo button still there
      const d1 = await drv(D.page, 'Joe', 'IVECO');
      rec('2i photo button still on his run', d1.photo, d1.run.slice(0, 120));
      rec('2 no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
      await A.close(); await D.close();
    }
    // ---------- 3. ALL DELIVERED with only shipped drops left; photo with only a shipped drop
    {
      const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [O('WO-3801-1', { delVeh: 'VOLVO', delDay: 'Thu', delWk: W0, delLoadedAt: '2026-11-12T07:00:00Z', delDispAt: '2026-11-12T08:00:00Z' }), O('WO-3802-1', { delVeh: 'VOLVO', delDay: 'Thu', delWk: W0, delLoadedAt: '2026-11-12T07:00:00Z' })] });
      const A = await openRef(browser, S, ''), p = A.page;
      await importRows(p, [row('WO-3801-1', S9), row('WO-3802-1', S9)]);
      const d = await drv(p, 'Joe', 'VOLVO');
      rec('3a only shipped drops left: both on his run, ALL DELIVERED + photo shown', /WO-3801-1/.test(d.run) && /WO-3802-1/.test(d.run) && d.photo && /ALL DELIVERED/.test(d.all), d.run.slice(0, 200));
      await p.evaluate(async () => { window.confirm = () => true; const b = document.getElementById('drv-alldeliv'); if (b) b.click(); await new Promise(r => setTimeout(r, 300)); });
      const a = await g(p, 'WO-3801-1'), b = await g(p, 'WO-3802-1'), d2 = await drv(p, 'Joe', 'VOLVO');
      rec('3b ALL DELIVERED stamps both by Joe', !!a.v && !!b.v && a.by === 'Joe' && b.by === 'Joe', JSON.stringify({ a, b, after: d2.all.slice(-200) }));
      rec('3c FINDING-CHECK (Low) after ALL DELIVERED on an all-shipped run the driver sees "All delivered", not "No jobs planned"', /All delivered/.test(d2.all) && !/No jobs planned/.test(d2.all), d2.all.slice(d2.all.indexOf('Volvo'), d2.all.indexOf('Volvo') + 200));
      await A.close();
    }
    // ---------- 4. office closes the week / ↩ Back to Deliveries while the shipped loaded job is still on his run
    for (const act of ['close-week', 'back-to-deliveries']) {
      const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [O('WO-3901-1', { delVeh: 'IVECO', delDay: 'Thu', delWk: W0, delLoadedAt: '2026-11-12T07:00:00Z', delDispAt: '2026-11-12T08:00:00Z', ldBy: 'Joe' }), O('WO-3902-1', { delVeh: 'IVECO', delDay: 'Thu', delWk: W0, delLoadedAt: '2026-11-12T07:00:00Z', delDispAt: '2026-11-12T08:00:00Z' })] });
      const A = await openRef(browser, S, ''), D = await openRef(browser, S, ''), p = A.page;
      await importRows(p, [row('WO-3901-1', S9), row('WO-3902-1', S8)]);
      if (act === 'close-week') await close(p, W0);
      else { await p.evaluate(async () => { sessionStorage.setItem('wpfWho', 'Mary'); showTab('h'); await new Promise(r => setTimeout(r, 120)); const b = document.querySelector('[data-shd="WO-3901-1"]'); window.__shd = !!b; if (b) b.click(); });
        await p.waitForTimeout(150); await NAME(p, 'Mary'); const w = await p.$('.pod-ovl [data-why="Not delivered after all"]'); if (w) await w.click(); await p.waitForTimeout(200); }
      await save(p); await reload(D.page);
      const r = await drv(D.page, 'Joe', 'IVECO'), j = await g(p, 'WO-3901-1');
      const ar = await p.evaluate(W0 => Object.values(DB.delArchive || {}).filter(a => a.w === W0).map(a => a.jobs.map(j => j.wo + (j.sh ? ':sh' : '') + (j.vAt ? ':v' : ''))), W0);
      rec(`4 ${act}: the shipped drop physically on his van (on the road) is still on his run`, /WO-3901-1/.test(r.run), JSON.stringify({ run: r.run.slice(0, 200), j, ar, shd: await p.evaluate(() => window.__shd) }));
      rec(`4 ${act}: INFO archive / job state`, true, JSON.stringify({ ar, j, cw: (await p.evaluate(() => window.__cw || '')).slice(0, 400) }));
      await A.close(); await D.close();
    }
    // ---------- 5. Excel Shipped column; shipped + on hold
    {
      const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [O('WO-4001-1', { delVeh: 'IVECO', delDay: 'Mon', delWk: W0 }), O('WO-4002-1', { delVeh: 'IVECO', delDay: 'Tue', delWk: W0 })] });
      const A = await openRef(browser, S, ''), p = A.page;
      await importRows(p, [row('WO-4001-1', S9), row('WO-4002-1', S9)]);
      await importRows(p, [row('WO-4001-1', S9), row('WO-4002-1', S12)]);
      const h = await g(p, 'WO-4002-1'), hc = await p.evaluate(async () => { showTab('h'); await new Promise(r => setTimeout(r, 120)); return [...document.querySelectorAll('.sh-card')].filter(x => (x.querySelector('.wo-num') || {}).textContent === 'WO-4002-1').map(x => x.innerText.replace(/\s+/g, ' ')); });
      rec('5a shipped then on hold: booking kept (Iveco Tue), off Deliveries, one Shipped card showing it', h.veh === 'IVECO' && h.day === 'Tue' && !h.onPage && hc.length === 1 && /Was on Deliveries: on Iveco Tue/.test(hc[0]), JSON.stringify({ h, hc }));
      await close(p, W0);
      const xl = await p.evaluate(async () => { const k = Object.keys(DB.delArchive).find(k => DB.delArchive[k].w === thisWk()); let rows = null;
        const wf = XLSX.writeFile; XLSX.writeFile = wb => { rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }); }; openDelArchive(k); await new Promise(r => setTimeout(r, 100));
        [...document.querySelectorAll('[data-arcx]')].find(b => b.dataset.arcx === k).click(); XLSX.writeFile = wf; document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); return rows; });
      const hd = (xl || [])[0] || [], ix = hd.indexOf('Shipped'), r1 = (xl || []).find(r => r.includes('WO-4001-1')) || [], r2 = (xl || []).find(r => r.includes('WO-4002-1')) || [];
      rec('5b Past-weeks Excel has a Shipped column filled for both shipped jobs (incl. the on-hold one)', ix > -1 && /shipped/.test(r1[ix] || '') && /shipped/.test(r2[ix] || ''), JSON.stringify({ hd, r1, r2 }));
      rec('5 no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
      await A.close();
    }
  } catch (e) { rec('test ran', false, e.stack); }
  await browser.close(); done();
})();
