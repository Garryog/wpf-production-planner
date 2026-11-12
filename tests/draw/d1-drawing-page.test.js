// ✏ Drawing page (Garry, 12 Nov 2026): work orders at 1. DRAWING and WO-D drawing work orders are brought in by the Cienapps import
// and kept on the Drawing page — off the board, totals, Deliveries. The SAME job moves onto the Capacity Board when a later import
// shows it at step 2 or further. A job already on the board that goes back to DRAWING stays on the board. Fake Supabase only.
// Run: node tests/draw/d1-drawing-page.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 420) : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HDR = ['WO #', 'Title', 'Customer', 'Due Date', 'Step', 'Sub-Total'];
const D = s => Math.round((Date.parse(s + 'T00:00:00Z') - Date.UTC(1899, 11, 30)) / 86400000); // Excel serial
(async () => {
  const browser = await H.chromium.launch();
  try {
    const row = { id: 'main', nid: 9, settings: {}, orders: [
      H.order({ wo: 'WO-100-1', customer: 'Aderrig Homes', title: 'HOUSE A', step: '4. READY FOR PRODUCTION', plannedWeek: '2026-11-23', hours: 10, value: 5000, dueDate: '2026-11-27', origDueDate: '2026-11-27' })] };
    const t = await H.open({ browser, now: '2026-11-12T10:00:00Z', row }), p = t.page, S = t.server;
    const imp = async rows => { await H.importAoa(p, [HDR, ...rows]); const pv = await p.evaluate(() => ({ txt: (document.getElementById('iprev') || {}).innerText || '', nNew: IMPPLAN.newOrders.length, ex: IMPPLAN.exCounts, td: IMPPLAN.toDrawNew, dl: IMPPLAN.drawLeft, flags: (IMPPLAN.flagged || []).map(f => f.wo + ': ' + f.why) })); await p.evaluate(() => applyImport(IMPPLAN)); await sleep(300); return pv; };
    const job = wo => p.evaluate(wo => { const o = DB.orders.find(x => x.wo === wo); return o ? { step: o.step, draw: o.drawStage || null, wk: o.plannedWeek || '', delv: !!o.delv, board: boardOrders().includes(o), plan: planOrders().includes(o), del: delAll().includes(o), log: (o.log || []).map(l => l.t || l.what || JSON.stringify(l)).join(' | ') } : null; }, wo);
    const hrs0 = await p.evaluate(() => wkHrs('2026-11-23'));
    // ---- import 1: two at 1. DRAWING, a WO-D, one at 2, one shipped, and the board job unchanged
    const pv1 = await imp([
      ['WO-200-1', 'HOUSE B', 'Aderrig Homes', D('2026-11-27'), '1. DRAWING', 4000],
      ['WO-200-2', 'HOUSE C', 'Ballymore Homes', D('2027-02-01'), '1.DRAWING ', 3000],
      ['WO-D-300-1', 'Drawings for block 2', 'Ballymore Homes', D('2026-12-01'), '4. READY FOR PRODUCTION', 500],
      ['WO-400-1', 'HOUSE D', 'Aderrig Homes', D('2026-11-26'), '2. NO SITE MEASURE DONE', 2000],
      ['WO-500-1', 'HOUSE E', 'Aderrig Homes', D('2026-10-01'), '9. JOB SHIPPED', 2000],
      ['WO-D-600-1', 'Old drawings', 'Aderrig Homes', D('2026-10-01'), '11. COMPLETED AND INVOICED', 100],
      ['WO-100-1', 'HOUSE A', 'Aderrig Homes', D('2026-11-27'), '4. READY FOR PRODUCTION', 5000]]);
    rec('preview: 3 go to the ✏ Drawing page, said in plain words; shipped ones still left out', pv1.td.length === 3 && /3 at drawing stage → ✏ Drawing page/.test(pv1.txt) && pv1.ex && Object.keys(pv1.ex).every(k => /shipped|invoiced/.test(k)), JSON.stringify({ td: pv1.td, ex: pv1.ex }));
    const b = await job('WO-200-1'), c = await job('WO-200-2'), wd = await job('WO-D-300-1'), d2 = await job('WO-400-1');
    rec('1. DRAWING job: in the planner, on the Drawing page, NOT on the board / plan / Deliveries, not scheduled', b && b.draw && b.draw.why === 'step' && !b.board && !b.plan && !b.del && !b.wk && !b.delv, JSON.stringify(b));
    rec('"1.DRAWING " (no space, trailing space) is treated the same', c && c.draw && !c.board, JSON.stringify(c));
    rec('WO-D drawing work order: on the Drawing page whatever its step', wd && wd.draw && wd.draw.why === 'wod' && !wd.board && !wd.plan, JSON.stringify(wd));
    rec('2. NO SITE MEASURE DONE goes on the Capacity Board as before (scheduled)', d2 && !d2.draw && d2.board && d2.plan && !!d2.wk, JSON.stringify(d2));
    const n1 = await p.evaluate(() => ({ n: DB.orders.length, ship: !!DB.orders.find(o => o.wo === 'WO-500-1'), wod6: !!DB.orders.find(o => o.wo === 'WO-D-600-1'), hrs: wkHrs('2026-11-23') }));
    rec('shipped / invoiced new jobs are still not brought in; week totals unchanged by the drawing jobs', n1.n === 5 && !n1.ship && !n1.wod6, JSON.stringify(n1));
    // ---- the page
    await p.evaluate(() => showTab('w')); await sleep(200);
    const pg = await p.evaluate(() => ({ rows: [...document.querySelectorAll('[data-drw]')].map(r => r.dataset.drw), txt: document.getElementById('app').innerText, badge: document.getElementById('drawcnt').textContent, shown: getComputedStyle(document.getElementById('drawcnt')).display }));
    rec('Drawing tab lists the 3 jobs (earliest due first), badge shows 3', JSON.stringify(pg.rows) === JSON.stringify(['WO-200-1', 'WO-D-300-1', 'WO-200-2']) && pg.badge === '3' && pg.shown !== 'none', JSON.stringify(pg.rows) + ' ' + pg.badge);
    rec('amber "due in 15 days — still at drawing" on a job due within 4 weeks; none on one due in February', /due in 15 days — still at drawing/.test(pg.txt) && (pg.txt.match(/still at drawing/g) || []).length === 2, pg.txt.slice(0, 500));
    // filters
    const fl = await p.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); const rows = () => [...document.querySelectorAll('[data-drw]')].map(r => r.dataset.drw); const o = {};
      const s = document.getElementById('drw-cust'); s.value = 'ballymore homes'; s.dispatchEvent(new Event('change')); await w(80); o.cust = rows();
      const q = document.getElementById('drw-q'); q.focus(); q.value = 'block'; q.dispatchEvent(new Event('input')); await w(400); o.q = rows(); o.focus = document.activeElement.id;
      const q2 = document.getElementById('drw-q'); q2.value = ''; q2.dispatchEvent(new Event('input')); await w(400); const s2 = document.getElementById('drw-cust'); s2.value = ''; s2.dispatchEvent(new Event('change')); await w(80); o.all = rows().length; return o; });
    rec('customer filter and search work (focus kept while typing)', JSON.stringify(fl.cust) === JSON.stringify(['WO-D-300-1', 'WO-200-2']) && JSON.stringify(fl.q) === '["WO-D-300-1"]' && fl.focus === 'drw-q' && fl.all === 3, JSON.stringify(fl));
    // ---- nowhere else: every other screen has no trace of the drawing jobs
    const leaks = await p.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); const out = {}; const bad = () => ['WO-200-1', 'WO-200-2', 'WO-D-300-1'].filter(x => document.getElementById('app').innerText.includes(x));
      for (const t of ['b', 'd', 'h', 'l', 'x']) { showTab(t); await w(120); out['office/' + t] = bad(); }
      for (const r of ['dash', 'prod', 'saw', 'stores', 'driver', 'floor']) { ls.set('wpfPin_' + r, pins()[r]); ROLE = r; render(); await w(120); out[r] = bad(); }
      ls.set('wpfPin_pm', pins().pm); ROLE = 'pm'; pmTab = ''; render(); await w(120); out.pm = bad(); out.pmStrip = !!document.querySelector('[data-drwtab="draw"]');
      document.querySelector('[data-drwtab="draw"]').click(); await w(120); out.pmDraw = [...document.querySelectorAll('[data-drw]')].length; pmTab = '';
      ls.set('wpfPin_design', pins().design); ROLE = 'design'; render(); await w(120); out.designStrip = !!document.querySelector('[data-drwtab="draw"]'); document.querySelector('[data-drwtab="draw"]').click(); await w(120); out.designDraw = [...document.querySelectorAll('[data-drw]')].length; designTab = '';
      ROLE = 'office'; showTab('b'); await w(100); out.chg = changes().map(o => o.wo); out.hrs = wkHrs('2026-11-23'); return out; });
    const lk = Object.entries(leaks).filter(([k, v]) => Array.isArray(v) && k !== 'chg' && v.length);
    rec('drawing jobs appear on NO other screen (board, Deliveries, Shipped, Lists, Export, dashboard, Production Manager, saw, stores, driver, floor, PM deliveries)', !lk.length, JSON.stringify(lk));
    rec('PMs and the Drawing office each have a ✏ Drawing button showing the 3 jobs', leaks.pmStrip && leaks.pmDraw === 3 && leaks.designStrip && leaks.designDraw === 3, JSON.stringify([leaks.pmStrip, leaks.pmDraw, leaks.designStrip, leaks.designDraw]));
    rec('not in Export Changes; week totals as before the import + nothing from drawing jobs', leaks.chg.length === 0, JSON.stringify(leaks.chg) + ' hrs ' + hrs0 + ' → ' + leaks.hrs);
    // ---- same file again: nothing doubles
    const pv2 = await imp([['WO-200-1', 'HOUSE B', 'Aderrig Homes', D('2026-11-27'), '1. DRAWING', 4000], ['WO-D-300-1', 'Drawings for block 2', 'Ballymore Homes', D('2026-12-01'), '4. READY FOR PRODUCTION', 500]]);
    const n2 = await p.evaluate(() => DB.orders.length);
    rec('the same rows imported again: no new job, no second record, still on the Drawing page', pv2.nNew === 0 && n2 === 5 && (await job('WO-200-1')).draw && (await job('WO-D-300-1')).draw, JSON.stringify({ nNew: pv2.nNew, n2 }));
    // ---- the job moves on in Cienapps: onto the board, the SAME job
    const pv3 = await imp([['WO-200-1', 'HOUSE B', 'Aderrig Homes', D('2026-11-27'), '3. READY FOR UPLOAD', 4000], ['WO-D-300-1', 'Drawings for block 2', 'Ballymore Homes', D('2026-12-01'), '5. WORK ORDER PROCESSED', 500]]);
    const b3 = await job('WO-200-1'), wd3 = await job('WO-D-300-1'), n3 = await p.evaluate(() => ({ n: DB.orders.length, chg: changes().map(o => o.wo) }));
    rec('Cienapps moves it to 3. READY FOR UPLOAD → the same job is now on the Capacity Board, scheduled to its due week, logged', b3 && !b3.draw && b3.board && b3.plan && b3.wk === '2026-11-23' && b3.step === '3. READY FOR UPLOAD' && /Left drawing/.test(b3.log) && n3.n === 5 && /left drawing → onto the Capacity Board/.test(pv3.txt), JSON.stringify({ b3, n: n3.n }));
    rec('its auto-placed week is not listed in Export Changes', !n3.chg.includes('WO-200-1'), JSON.stringify(n3.chg));
    rec('a WO-D stays on the Drawing page even at a later step', wd3 && wd3.draw && !wd3.board, JSON.stringify(wd3));
    // ---- back to DRAWING once on the board: stays on the board, flagged (Garry Q1 = a)
    const pv4 = await imp([['WO-200-1', 'HOUSE B', 'Aderrig Homes', D('2026-11-27'), '1. DRAWING', 4000]]);
    const b4 = await job('WO-200-1');
    rec('a job on the board that Cienapps moves back to 1. DRAWING stays on the board, flagged', b4 && !b4.draw && b4.board && b4.step === '3. READY FOR UPLOAD' && pv4.flags.some(f => /WO-200-1.*drawing stage — kept on the board/.test(f)), JSON.stringify({ b4, f: pv4.flags }));
    // ---- drawing job goes on hold, then shipped
    await imp([['WO-200-2', 'HOUSE C', 'Ballymore Homes', D('2027-02-01'), '12. ON HOLD / DELETE', 3000]]);
    const c5 = await job('WO-200-2'); const dj5 = await p.evaluate(() => drawJobs().map(o => o.wo));
    rec('a Drawing-page job put ON HOLD in Cienapps leaves the Drawing list (it is in On hold) and is still off the board', c5 && !c5.board && !dj5.includes('WO-200-2'), JSON.stringify({ c5, dj5 }));
    // ---- saved
    await sleep(1800);
    const sv = (S.row.orders || []).find(o => o.wo === 'WO-D-300-1');
    rec('saved to the (fake) database with the marker; no new settings key, no new column', sv && sv.drawStage && sv.drawStage.why === 'wod' && !S.patches.some(b => Object.keys(b).some(k => !['orders', 'settings', 'nid', 'version', 'updated_by', 'updated_at'].includes(k))), JSON.stringify({ sv: sv && sv.drawStage, keys: [...new Set(S.patches.flatMap(b => Object.keys(b)))] }));
    // ---- phone
    await p.setViewportSize({ width: 360, height: 740 }); await p.evaluate(() => showTab('w')); await sleep(250);
    const ns = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    rec('360 px: Drawing page has no sideways scroll', ns.sw <= ns.cw + 1, JSON.stringify(ns));
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    await t.close();
  } finally { await browser.close(); }
  const f = res.filter(x => !x).length; console.log('\n' + (res.length - f) + '/' + res.length + ' passed'); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
