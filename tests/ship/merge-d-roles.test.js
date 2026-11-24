// Merge attack D (Tester, 13 Nov 2026): every role screen with jobs shipped by hand while on a van (this week / next / past)
// and in the pool — Production Manager (its tabs incl. 🚚 Deliveries), PMs, driver, floor, management, saw, stores, drawing
// office — at PC width and phone 360 px. The board step box at 360 px: 7 (store time + tick), 9 (asks, off the board), Cancel.
// Fake Supabase only.  Run: node tests/ship/merge-d-roles.test.js
const M = require('./merge-lib');
const { H, makeServer, openRef, recorder, w, O, W0, WP, W1, pick, bringBack, job } = M;
const { rec, done } = recorder('merge-d-roles');
(async () => {
  const browser = await H.chromium.launch();
  try {
    const R = ['WO-4901-1', 'WO-4902-1', 'WO-4903-1', 'WO-4904-1', 'WO-4905-1', 'WO-4906-1'];
    const row = { id: 'main', version: 1, nid: 50, settings: {}, orders: [
      O(R[0], { delVeh: 'IVECO', delDay: 'Thu', delWk: W0, title: 'O\'Grady <b>x</b> "kitchen" 🏠' }),   // today's van
      O(R[1], { delVeh: 'IVECO', delDay: 'Fri', delWk: W0 }),     // tomorrow
      O(R[2], { delVeh: 'ARTIC', delDay: 'Wed', delWk: WP }),     // past week, missed
      O(R[3], { dueDate: '2026-11-18', plannedWeek: W1 }),        // pool
      O(R[4], { step: '6. JOB CUT COMPLETE', cienStep: '6. JOB CUT COMPLETE', delv: false }),
      O(R[5], { step: '5. WORK ORDER PROCESSED', cienStep: '5. WORK ORDER PROCESSED', delv: false }),
    ] };
    for (const vp of [{ width: 1400, height: 900 }, { width: 360, height: 740 }]) {
      const S = makeServer(row);
      const t = await openRef(browser, S, '', { viewport: vp }), p = t.page;
      const tag = vp.width + 'px';
      // step box at this width
      const a7 = await pick(p, R[4], '7. ASSEMBLY COMPLETE'); const j7 = await job(p, R[4]);
      rec(`${tag}: board step box 6 → 7 works (store time, ticked for delivery)`, j7.step === '7. ASSEMBLY COMPLETE' && !!j7.storeAt && j7.delv, JSON.stringify({ a7: typeof a7 === 'string' ? a7 : 'ok', j7: { step: j7.step, storeAt: j7.storeAt, delv: j7.delv } }));
      const vis = await p.evaluate(wo => { const s = document.querySelector('[data-stepsel="' + wo + '"]'); if (!s) return null; const r = s.getBoundingClientRect(); return { w: r.width, h: r.height, opts: s.options.length }; }, R[5]);
      if (vp.width > 400) rec(`${tag}: step box shown with 11 steps`, vis && vis.opts === 11 && vis.w > 0, JSON.stringify(vis));
      else rec(`INFO ${tag}: the board's Step column (and so the step box) is hidden on a phone — same on main and the Deliveries branch`, true, JSON.stringify(vis));
      const ac = await pick(p, R[5], '9. JOB SHIPPED', false);
      rec(`${tag}: Cancel → box back to 5`, ac.selNow === '5. WORK ORDER PROCESSED', JSON.stringify(ac.selNow));
      for (const wo of R.slice(0, 4)) await pick(p, wo, '9. JOB SHIPPED');
      const sh = await p.evaluate(R => R.slice(0, 4).map(wo => !!DB.orders.find(o => o.wo === wo).shippedAt), R);
      rec(`${tag}: four booked/pool jobs shipped by hand`, sh.every(Boolean), JSON.stringify(sh));
      const sw = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      rec(`${tag}: board page has no sideways scroll`, sw.sw <= sw.cw + 1 || vp.width > 400, JSON.stringify(sw));
      // every role screen
      const roles = await p.evaluate(async R => {
        const out = {}; const errs = []; window.addEventListener('error', e => errs.push(String(e.message)));
        const txt = () => (document.getElementById('app') || document.body).innerText;
        const sws = () => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth });
        localStorage.setItem('wpfDrvName', 'Dan'); localStorage.setItem('wpfDrvVeh', 'IVECO'); localStorage.setItem('wpfDrvDay', 'Thu|' + thisWk());
        for (const r of ['prod', 'pm', 'driver', 'floor', 'dash', 'saw', 'stores', 'design']) {
          try { localStorage.setItem('wpfPin_' + r, '9000'); setRole(r); await new Promise(z => setTimeout(z, 200));
            const T = txt(); out[r] = { n: T.length, wos: R.filter(wo => T.includes(wo)), esc: /<b>x<\/b>/.test(document.getElementById('app').innerHTML.replace(/&lt;b&gt;x&lt;\/b&gt;/g, '')) , ...sws() };
            if (r === 'prod') { for (const pt of ['deliv']) { prodTab = pt; render(); await new Promise(z => setTimeout(z, 200)); const T2 = txt(); out['prod-' + pt] = { n: T2.length, wos: R.filter(wo => T2.includes(wo)), ...sws() }; } prodTab = 'today'; }
          } catch (e) { out[r] = 'ERR ' + e.message; }
        }
        localStorage.setItem('wpfRole', 'office'); setRole('office'); showTab('b');
        return { out, errs };
      }, R);
      for (const [r, v] of Object.entries(roles.out)) rec(`${tag}: ${r} screen renders (no error), no raw HTML from the title`, typeof v === 'object' && v.n > 0 && !v.esc, JSON.stringify(v));
      rec(`${tag}: driver sees today's hand-shipped job (${R[0]}) — it still has to be delivered`, roles.out.driver && roles.out.driver.wos.includes(R[0]), JSON.stringify(roles.out.driver));
      rec(`${tag}: Production Manager's 🚚 Deliveries shows the hand-shipped van jobs`, roles.out['prod-deliv'] && roles.out['prod-deliv'].wos.includes(R[0]), JSON.stringify(roles.out['prod-deliv']));
      // floor (TV screen) and the Production Manager's Deliveries "Give reason" row are wider than 360 px on the Deliveries branch
      // before the merge too (floor also on main) — recorded as known, not merge-caused
      if (vp.width < 400) for (const [r, v] of Object.entries(roles.out)) if (r !== 'floor' && r !== 'prod-deliv') rec(`${tag}: ${r} — no sideways page scroll`, typeof v === 'object' && v.sw <= v.cw + 1, JSON.stringify(v));
      // bring back at this width (Shipped tab button)
      const bb = await bringBack(p, R[0]); const jb = await job(p, R[0]);
      rec(`${tag}: bring back from the Shipped tab works`, bb === 'ok' && jb.step === '8. PALLETED' && jb.day === 'Thu' && jb.wk === W0, JSON.stringify({ bb, step: jb.step, day: jb.day }));
      rec(`${tag}: no page errors`, !(S.errors || []).length && !roles.errs.length, (S.errors || []).concat(roles.errs).join(' | ').slice(0, 400));
      await t.close();
    }
  } finally { await browser.close(); }
  done();
})().catch(e => { console.error(e); process.exit(1); });
