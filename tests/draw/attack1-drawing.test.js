// Tester attack on the ✏ Drawing page (v-draw, 12 Nov 2026). Fake Supabase only (tests/harness.js). Never edits the app.
// Run: node tests/draw/attack1-drawing.test.js
// A FAIL here is a finding (see the report) — not every FAIL is a blocker.
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 500) : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HDR = ['WO #', 'Title', 'Customer', 'Due Date', 'Step', 'Sub-Total'];
const D = s => Math.round((Date.parse(s + 'T00:00:00Z') - Date.UTC(1899, 11, 30)) / 86400000);
const NOW = '2026-11-12T10:00:00Z';
const sect = async (name, fn) => { try { await fn(); } catch (e) { rec('[' + name + '] ran without crashing', false, e && e.stack || e); } };

(async () => {
  const browser = await H.chromium.launch();
  try {
    // ================= single PC =================
    const row = { id: 'main', nid: 9, settings: {}, orders: [
      H.order({ wo: 'WO-100-1', customer: 'Aderrig Homes', title: 'BOARD JOB', step: '4. READY FOR PRODUCTION', plannedWeek: '2026-11-23', hours: 10, value: 5000, dueDate: '2026-11-27', origDueDate: '2026-11-27' })] };
    const t = await H.open({ browser, now: NOW, row }), p = t.page, S = t.server;
    const imp = async (rows, apply = true) => { await H.importAoa(p, [HDR, ...rows]); const pv = await p.evaluate(() => ({ txt: (document.getElementById('iprev') || {}).innerText || '', nNew: IMPPLAN.newOrders.length, newWos: IMPPLAN.newOrders.map(o => o.wo), td: IMPPLAN.toDrawNew, dl: IMPPLAN.drawLeft, auto: IMPPLAN.autoTag || [], gaps: (IMPPLAN.dispGaps || []).map(g => g.wo), ex: IMPPLAN.exCounts, flags: (IMPPLAN.flagged || []).map(f => f.wo + ': ' + f.why) })); if (apply) { await p.evaluate(() => applyImport(IMPPLAN)); await sleep(250); } return pv; };
    const job = wo => p.evaluate(wo => { const o = DB.orders.find(x => x.wo === wo); return o ? { step: o.step, draw: o.drawStage || null, wk: o.plannedWeek || '', delv: !!o.delv, ship: !!o.shippedAt, hold: !!o.cienHold, board: boardOrders().includes(o), drawPg: drawJobs().includes(o), log: (o.log || []).map(l => l.t || l.what || '').join(' | ') } : null; }, wo);

    // ---- 1. step wording
    await sect('wording', async () => {
      const w = await p.evaluate(() => Object.fromEntries(['Drawing', '1. DRAWINGS', '01. Drawing', 'Pre-production drawing', '10. INSTALLED TO BE INVOICE', '1', '1)DRAWING', '11. COMPLETED AND INVOICED', 'Drawings approved', '12. ON HOLD / DELETE', ' 1 . DRAWING'].map(s => [s, stepIsDrawing(s)])));
      rec('wording: "Drawing", "1. DRAWINGS", "01. Drawing", "Pre-production drawing", "1", "1)DRAWING" = drawing; "10. INSTALLED", "11", "12" are NOT', w['Drawing'] && w['1. DRAWINGS'] && w['01. Drawing'] && w['Pre-production drawing'] && w['1'] && w['1)DRAWING'] && !w['10. INSTALLED TO BE INVOICE'] && !w['11. COMPLETED AND INVOICED'] && !w['12. ON HOLD / DELETE'], JSON.stringify(w));
      rec('note: unnumbered "Drawings approved" also counts as drawing stage (ask Garry if that wording can appear)', true, 'Drawings approved → ' + w['Drawings approved'] + ' ; " 1 . DRAWING" → ' + w[' 1 . DRAWING']);
    });

    // ---- 2. new drawing jobs: preview wording + board header
    let pv1;
    await sect('preview+header', async () => {
      pv1 = await imp([
        ['WO-200-1', 'HOUSE B', 'Aderrig Homes', D('2026-11-27'), '1. DRAWING', 4000],
        ['WO-200-2', 'HOUSE C', 'Ballymore', D('2027-02-01'), 'Drawing', 3000],
        ['WO-D-300-1', 'Drawings block 2', 'Ballymore', D('2026-12-01'), '4. READY FOR PRODUCTION', 500],
        ['WO-210-1', 'NO DUE', 'Ballymore', 'next week sometime', '1. DRAWING', 1000],
        ['WO-220-1', 'HOUSE Z', 'Aderrig Homes', D('2026-11-30'), '1. DRAWING', 2000],
        ['WO-220-1A', 'Extra worktop', 'Aderrig Homes', D('2026-11-25'), '4. READY FOR PRODUCTION', 700],
      ], false);
      const listed = /New work orders — will be added and scheduled to their due-date week/.test(pv1.txt) && pv1.newWos.includes('WO-200-1');
      rec('import preview does not list drawing-stage jobs under "🆕 New work orders — will be added and scheduled to their due-date week"', !listed, 'newOrders section lists: ' + pv1.newWos.join(', ') + ' ; headline: ' + (pv1.txt.match(/\d+ new · [^\n]{0,60}/) || [''])[0]);
      await p.evaluate(() => applyImport(IMPPLAN)); await sleep(250);
      const j = await job('WO-210-1'), z = await job('WO-220-1');
      const zv = await p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-220-1'); return { v: o.value, adds: Object.keys(o.adds || {}), due: o.dueDate, sep: !!DB.orders.find(x => x.wo === 'WO-220-1A') }; });
      rec('drawing job with an unreadable due date: comes in, on the Drawing page, unscheduled', j && j.drawPg && !j.wk && !j.board, JSON.stringify(j));
      rec('addition line (A) of a drawing job folds into it (value 2000+700, due brought forward), stays on the Drawing page, no separate job', z && z.drawPg && zv.v === 2700 && zv.adds.length === 1 && !zv.sep && zv.due === '2026-11-25', JSON.stringify({ z, zv }));
      await p.evaluate(() => showTab('w')); await sleep(150);
      const pg = await p.evaluate(() => ({ txt: document.getElementById('app').innerText, rows: [...document.querySelectorAll('[data-drw]')].map(r => r.dataset.drw) }));
      rec('Drawing page: no "NaN"/"Invalid"/"undefined" text; unreadable-due job listed last', !/NaN|Invalid|undefined/.test(pg.txt) && pg.rows[pg.rows.length - 1] === 'WO-210-1', JSON.stringify(pg.rows) + ' ' + (pg.txt.match(/NaN|Invalid|undefined/) || ''));
      await p.evaluate(() => showTab('b')); await sleep(200);
      const hdr = await p.evaluate(() => { const a = document.getElementById('go-ship'); return { link: a ? a.textContent : '', shipped: DB.orders.filter(isShipped).length, draw: drawJobs().length }; });
      rec('Capacity Board header: the "N shipped" link does not count drawing jobs as shipped', !hdr.link || +hdr.link.match(/\d+/)[0] === hdr.shipped, JSON.stringify(hdr));
    });

    // ---- 3. XSS on the Drawing page
    await sect('xss', async () => {
      await p.evaluate(() => { DB.orders.push({ wo: 'WO-666-1"><img src=x onerror=window.__xss=1>', title: '<script>window.__xss=2</script><b id=xb>T</b>', customer: 'O\'Grady "<svg onload=window.__xss=3>" 😀', floor: '<i id=xf>F</i>', unit: '"><u id=xu>', hours: 1, value: '€9<9', dueDate: '2026-11-20', step: '1. <img src=y onerror=window.__xss=4>', cienStep: '1. <img src=y onerror=window.__xss=5>', drawStage: { why: 'step', at: '<bad>' }, plannedWeek: '' }); });
      for (const [r, tb] of [['office', 'w'], ['pm', ''], ['design', '']]) {
        await p.evaluate(({ r, tb }) => { if (r === 'office') { ROLE = 'office'; showTab(tb); } else { ls.set('wpfPin_' + r, pins()[r]); ROLE = r; if (r === 'pm') pmTab = 'draw'; else designTab = 'draw'; render(); } }, { r, tb });
        await sleep(200);
        await p.evaluate(() => { const s = document.getElementById('drw-cust'); if (s) { s.value = s.options[s.options.length - 1].value; s.dispatchEvent(new Event('change')); } });
        await sleep(150);
        const x = await p.evaluate(() => ({ xss: window.__xss || 0, inj: !!document.querySelector('#app #xb, #app #xf, #app #xu, #app img[src=x], #app img[src=y], #app svg[onload]'), shown: [...document.querySelectorAll('[data-drw]')].length }));
        rec('XSS: ' + r + ' Drawing page shows the job with nasty title/customer/floor/unit/step/WO as plain text', !x.xss && !x.inj && x.shown >= 1, JSON.stringify(x));
      }
      await p.evaluate(() => { drwCust = ''; pmTab = ''; designTab = ''; ROLE = 'office'; DB.orders = DB.orders.filter(o => !/WO-666/.test(o.wo)); showTab('b'); });
    });

    // ---- 4. step 1 → 2 → 1 → 5
    await sect('1-2-1-5', async () => {
      await imp([['WO-700-1', 'HOUSE S', 'Aderrig Homes', D('2026-11-27'), '1. DRAWING', 3000]]);
      const a = await job('WO-700-1');
      await imp([['WO-700-1', 'HOUSE S', 'Aderrig Homes', D('2026-11-27'), '2. NO SITE MEASURE DONE', 3000]]);
      const b = await job('WO-700-1');
      const pv = await imp([['WO-700-1', 'HOUSE S', 'Aderrig Homes', D('2026-11-27'), '1. DRAWING', 3000]]);
      const c = await job('WO-700-1');
      await imp([['WO-700-1', 'HOUSE S', 'Aderrig Homes', D('2026-11-27'), '5. WORK ORDER PROCESSED', 3000]]);
      const d = await job('WO-700-1');
      rec('1 → 2 → 1 → 5: drawing page, then board (scheduled), stays on board flagged at 1, then step 5 on board, same week, one job', a.drawPg && !b.draw && b.board && b.wk && !c.draw && c.board && c.wk === b.wk && pv.flags.some(f => /WO-700-1.*drawing stage/.test(f)) && d.board && d.step === '5. WORK ORDER PROCESSED' && d.wk === b.wk && (await p.evaluate(() => DB.orders.filter(o => o.wo === 'WO-700-1').length)) === 1, JSON.stringify({ a, b, c, d }));
      const chg = await p.evaluate(() => changes().map(o => o.wo));
      rec('1 → 2 → 1 → 5: the job is not on Export Changes (every step came from Cienapps, week auto-placed)', !chg.includes('WO-700-1'), JSON.stringify(chg));
    });

    // ---- 5. WO-D reaching 7 (assembly complete) / 9 shipped
    await sect('wod', async () => {
      const pv7 = await imp([['WO-D-300-1', 'Drawings block 2', 'Ballymore', D('2026-12-01'), '7. ASSEMBLY COMPLETE', 500]]);
      const w7 = await job('WO-D-300-1');
      rec('WO-D drawing order reaching 7. ASSEMBLY COMPLETE is NOT "auto-tagged for delivery" (it is a drawing, not on Deliveries)', !w7.delv && !pv7.auto.includes('WO-D-300-1'), JSON.stringify({ w7, auto: pv7.auto }));
      const cu = await p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-D-300-1'); const was = o.delv; o.delv = false; const r = delvCatchUpOk(o, '2026-01-01'); o.delv = was; return r; });
      rec('Deliveries "catch-up tag 7/8" does not offer a WO-D drawing order', !cu, 'delvCatchUpOk = ' + cu);
      const pv9 = await imp([['WO-D-300-1', 'Drawings block 2', 'Ballymore', D('2026-12-01'), '9. JOB SHIPPED', 500]]);
      const w9 = await job('WO-D-300-1');
      rec('WO-D shipped in Cienapps leaves the Drawing page for Shipped', w9.ship && !w9.drawPg && !w9.board, JSON.stringify(w9));
      rec('WO-D shipped: not in the red "CHECK THESE — shipped but NO dispatch record" warning (a drawing order is never on a van)', !pv9.gaps.includes('WO-D-300-1'), JSON.stringify(pv9.gaps));
      await p.evaluate(() => showTab('h')); await sleep(150);
      const sh = await p.evaluate(() => document.getElementById('app').innerText.includes('WO-D-300-1'));
      rec('WO-D shipped shows on the Shipped tab', sh);
      // "Bring back to board" on it
      await p.evaluate(() => { const b = document.querySelector('[data-shb="WO-D-300-1"]'); if (b) b.click(); }); await sleep(250);
      const bb = await job('WO-D-300-1');
      rec('WO-D "↩ Bring back to board" — note where it lands (board vs Drawing page)', true, JSON.stringify({ ship: bb.ship, board: bb.board, drawPg: bb.drawPg }));
    });

    // ---- 6. step-1 job straight to shipped (9)
    await sect('1-to-9', async () => {
      await imp([['WO-710-1', 'HOUSE Q', 'Aderrig Homes', D('2026-11-27'), '1. DRAWING', 3000]]);
      await imp([['WO-710-1', 'HOUSE Q', 'Aderrig Homes', D('2026-11-27'), '9. JOB SHIPPED', 3000]]);
      const j = await job('WO-710-1');
      rec('drawing job jumping to 9. JOB SHIPPED: goes to Shipped, not the board, unscheduled', j.ship && !j.board && !j.drawPg && !j.wk, JSON.stringify(j));
      rec('…and its history does not claim "now on the Capacity Board"', !/now on the Capacity Board/.test(j.log), j.log);
    });

    // ---- 7. hold then back to 1, then 4
    await sect('hold', async () => {
      await imp([['WO-720-1', 'HOUSE H', 'Aderrig Homes', D('2026-11-27'), '1. DRAWING', 3000]]);
      await imp([['WO-720-1', 'HOUSE H', 'Aderrig Homes', D('2026-11-27'), '12. ON HOLD / DELETE', 3000]]);
      const h = await job('WO-720-1');
      const pvb = await imp([['WO-720-1', 'HOUSE H', 'Aderrig Homes', D('2026-11-27'), '1. DRAWING', 3000]]);
      const b = await job('WO-720-1');
      rec('drawing job on hold, then back to 1. DRAWING → back on the Drawing page (not the board)', h.hold && !h.drawPg && b.drawPg && !b.board && !b.hold && !b.wk, JSON.stringify({ h, b }));
      const f = pvb.flags.find(x => /WO-720-1/.test(x)) || '';
      rec('…and the preview does not tell the office it "returns to the board"', !/returns to the board/.test(f), f);
      await imp([['WO-720-1', 'HOUSE H', 'Aderrig Homes', D('2026-11-27'), '4. READY FOR PRODUCTION', 3000]]);
      const c = await job('WO-720-1');
      rec('…then 4. READY FOR PRODUCTION → on the board, scheduled', c.board && !c.draw && c.wk === '2026-11-23', JSON.stringify(c));
      // straight from hold (that started as drawing) to 4
      await imp([['WO-730-1', 'HOUSE I', 'Aderrig Homes', D('2026-11-27'), '1. DRAWING', 3000]]);
      await imp([['WO-730-1', 'HOUSE I', 'Aderrig Homes', D('2026-11-27'), '12. ON HOLD / DELETE', 3000]]);
      await imp([['WO-730-1', 'HOUSE I', 'Aderrig Homes', D('2026-11-27'), '4. READY FOR PRODUCTION', 3000]]);
      const d = await job('WO-730-1');
      rec('drawing → on hold → 4 in one go: on the board, scheduled', d.board && !d.draw && !d.hold && d.wk === '2026-11-23', JSON.stringify(d));
    });

    // ---- 8. same WO twice in one file with different steps; unknown wording
    await sect('dups+unknown', async () => {
      await imp([['WO-740-1', 'HOUSE R', 'Aderrig Homes', D('2026-11-27'), '1. DRAWING', 3000]]);
      const pv = await imp([['WO-740-1', 'HOUSE R', 'Aderrig Homes', D('2026-11-27'), 'Awaiting customer info', 3000]]);
      const j = await job('WO-740-1');
      rec('drawing job with an unrecognised Cienapps step ("Awaiting customer info") stays on the Drawing page (it is not step 2 or further)', j.drawPg && !j.board, JSON.stringify({ j, dl: pv.dl }));
      await imp([['WO-750-1', 'HOUSE T', 'Aderrig Homes', D('2026-11-27'), '4. READY FOR PRODUCTION', 3000], ['WO-750-1', 'HOUSE T', 'Aderrig Homes', D('2026-11-27'), '1. DRAWING', 3000]]);
      const k = await job('WO-750-1');
      rec('same new WO twice in one file (4 then 1. DRAWING): one job, first line\'s step used, on the board', k && k.board && !k.draw, JSON.stringify(k));
    });

    // ---- 9. exports + full schedule + snapshot
    await sect('exports', async () => {
      await imp([['WO-D-350-1', 'Drawings block 3', 'Ballymore', D('2026-12-01'), '4. READY FOR PRODUCTION', 500]]);
      await p.evaluate(() => { window.__xl = []; XLSX.writeFile = (wb, name) => window.__xl.push({ name, sheets: wb.SheetNames.map(n => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 })) }); });
      await p.evaluate(() => showTab('x')); await sleep(150);
      await p.evaluate(() => { document.getElementById('btn-xfull').click(); }); await sleep(150);
      const xl = await p.evaluate(() => window.__xl.pop());
      const r = (xl.sheets[0] || []).find(x => x[0] === 'WO-200-1');
      rec('Full Schedule Excel: a drawing job is recognisable (its Step column says DRAWING)', r && r[7] === 'DRAWING', JSON.stringify(r));
      const wd = (xl.sheets[0] || []).find(x => x[0] === 'WO-D-350-1');
      rec('Full Schedule Excel: a WO-D drawing order (step 4) is recognisable as a drawing-page job, not an unscheduled board job', wd && wd.some(c => /draw/i.test(String(c)) && c !== 'Drawings block 3'), JSON.stringify(wd));
      const snap = await p.evaluate(() => { let html = ''; const B = window.Blob; window.Blob = function (parts, o) { html = parts.join(''); return new B(parts, o); }; const c = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () {}; try { exportSnapshot(); } finally { window.Blob = B; HTMLAnchorElement.prototype.click = c; } const m = html.match(/(\d+) work orders · ([\d.]+)h/); return { n: m && +m[1], h: m && +m[2], plan: planOrders().length + DB.orders.filter(isShipped).length, all: DB.orders.length, hasDraw: html.includes('WO-200-1') }; });
      rec('Plan Snapshot header count/hours leave out drawing-stage jobs (they are not in the plan)', snap.n !== null && snap.n !== snap.all, JSON.stringify(snap));
    });

    // ---- 10. role views at 360 px; PM with lists switch ON
    await sect('360', async () => {
      await p.setViewportSize({ width: 360, height: 740 });
      for (const r of ['office', 'pm', 'design']) {
        await p.evaluate(r => { if (r === 'office') { ROLE = 'office'; showTab('w'); } else { ls.set('wpfPin_' + r, pins()[r]); ROLE = r; if (r === 'pm') pmTab = 'draw'; else designTab = 'draw'; render(); } }, r); await sleep(200);
        const ns = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, rows: document.querySelectorAll('[data-drw]').length, wide: [...document.querySelectorAll('#app *')].filter(e => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).slice(0, 3).map(e => e.tagName + '.' + e.className) }));
        rec('360 px: ' + r + ' Drawing page fits (no sideways scroll), rows shown', ns.sw <= ns.cw + 1 && ns.rows > 0, JSON.stringify(ns));
      }
      // PM with the lists switch ON (renderPMV2 strip)
      const v2 = await p.evaluate(async () => { const was = DB.listStore; DB.listStore = 'v2'; ROLE = 'pm'; pmTab = ''; try { render(); } catch (e) { DB.listStore = was; return { err: String(e) }; } await new Promise(r => setTimeout(r, 200)); const b = document.querySelector('[data-pmtab="draw"]'); const o = { strip: !!b, lbl: b && b.textContent }; if (b) { b.click(); await new Promise(r => setTimeout(r, 200)); o.rows = document.querySelectorAll('[data-drw]').length; o.sw = document.documentElement.scrollWidth; o.cw = document.documentElement.clientWidth; } DB.listStore = was; pmTab = ''; ROLE = 'office'; return o; });
      rec('PM with lists switch ON: ✏ Drawing button in the PM strip with the count, opens the page, fits 360 px', v2.strip && /\(\d+\)/.test(v2.lbl) && v2.rows > 0 && v2.sw <= v2.cw + 1, JSON.stringify(v2));
      await p.setViewportSize({ width: 1400, height: 900 });
      await p.evaluate(() => { ROLE = 'office'; pmTab = ''; designTab = ''; showTab('b'); });
    });

    // ---- 11. search debounce: a render() fires 250 ms after leaving the page
    await sect('debounce', async () => {
      await p.evaluate(() => showTab('w')); await sleep(100);
      const r = await p.evaluate(async () => { const q = document.getElementById('drw-q'); q.value = 'house'; q.dispatchEvent(new Event('input')); showTab('b'); const s = document.getElementById('srch'); s.focus(); s.value = 'abc'; await new Promise(r => setTimeout(r, 450)); return { tab, focus: document.activeElement && document.activeElement.id, drwQ }; });
      rec('typing in Drawing search then switching to the board: the late search timer does not steal focus from the board search box', r.focus === 'srch', JSON.stringify(r));
      await p.evaluate(() => { drwQ = ''; });
    });

    rec('single PC: no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    await t.close();

    // ================= merge unit checks (mergePlan) =================
    {
      const t2 = await H.open({ browser, now: NOW }), q = t2.page;
      const m = await q.evaluate(() => {
        const base = { orders: [], settings: {} };
        const A = { orders: [{ wo: 'WO-900-1', title: 'X', step: '1. DRAWING', cienStep: '1. DRAWING', drawStage: { why: 'step', at: '2026-11-12T10:00:00Z' }, plannedWeek: '', hours: 5, value: 1 }], settings: {} };
        const B = { orders: [{ wo: 'WO-900-1', title: 'X', step: '3. READY FOR UPLOAD', cienStep: '3. READY FOR UPLOAD', plannedWeek: '2026-11-23', hours: 5, value: 1 }], settings: {} };
        const r1 = mergePlan(base, A, B).plan.orders[0], r2 = mergePlan(base, B, A).plan.orders[0];
        const ok = o => !(o.drawStage && o.plannedWeek) && !(o.drawStage && !stepIsDrawing(o.step));
        // marker cleared on one PC, other PC untouched job → stays cleared
        const b2 = { orders: [{ wo: 'WO-901-1', step: '1. DRAWING', drawStage: { why: 'step', at: 'x' }, plannedWeek: '', notes: '' }], settings: {} };
        const mine = { orders: [{ wo: 'WO-901-1', step: '1. DRAWING', drawStage: { why: 'step', at: 'x' }, plannedWeek: '', notes: 'B note' }], settings: {} };
        const theirs = { orders: [{ wo: 'WO-901-1', step: '3. READY FOR UPLOAD', plannedWeek: '2026-11-23', notes: '', drawLeftAt: 'y' }], settings: {} };
        const r3 = mergePlan(b2, mine, theirs).plan.orders[0];
        const c = o => ({ step: o.step, draw: !!o.drawStage, wk: o.plannedWeek }); return { r1: c(r1), r2: c(r2), ok1: ok(r1), ok2: ok(r2), r3 };
      });
      rec('merge: two PCs import the same NEW job at once (one at 1. DRAWING, one at 3) → never a job that is both on the Drawing page AND planned / past step 1', m.ok1 && m.ok2, JSON.stringify({ r1: m.r1, r2: m.r2 }));
      rec('merge: PC A moved a job off the Drawing page, PC B (stale) only edited a note → marker stays gone, week kept, note kept', !m.r3.drawStage && m.r3.plannedWeek === '2026-11-23' && m.r3.notes === 'B note', JSON.stringify(m.r3));
      await t2.close();
    }

    // ================= two live PCs, version column =================
    {
      const SV = { row: { id: 'main', version: 1, nid: 9, settings: {}, orders: [H.order({ wo: 'WO-100-1', plannedWeek: '2026-11-23', dueDate: '2026-11-27', step: '4. READY FOR PRODUCTION' }), H.order({ wo: 'WO-101-1', plannedWeek: '2026-11-23', dueDate: '2026-11-27', step: '4. READY FOR PRODUCTION' })] }, patches: [], posts: [], deletes: [], other: [] };
      const A = await H.open({ browser, now: NOW, server: SV }), B = await H.open({ browser, now: NOW, server: SV });
      const a = A.page, b = B.page;
      const impOn = async (pg, rows) => { await H.importAoa(pg, [HDR, ...rows]); await pg.evaluate(() => applyImport(IMPPLAN)); };
      // A imports a drawing job; B (board open, never reloaded) edits a board job and saves
      await impOn(a, [['WO-800-1', 'TWO PC', 'Aderrig Homes', D('2026-11-27'), '1. DRAWING', 3000]]);
      await sleep(1800);
      await b.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-100-1'); o.notes = 'B edit'; sched(); }); await sleep(2500);
      const s1 = SV.row.orders.find(o => o.wo === 'WO-800-1'), n1 = SV.row.orders.find(o => o.wo === 'WO-100-1');
      rec('two PCs: A imports a drawing job, B (stale board) saves an edit → database keeps the drawing job WITH its marker and B\'s edit', s1 && s1.drawStage && n1.notes === 'B edit', JSON.stringify({ s1: s1 && s1.drawStage, notes: n1 && n1.notes, v: SV.row.version, conflicts: SV.conflicts }));
      const bSees = await b.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-800-1'); return o ? { draw: !!o.drawStage, board: boardOrders().includes(o) } : null; });
      rec('two PCs: after the merge B has the drawing job, off its board', bSees && bSees.draw && !bSees.board, JSON.stringify(bSees));
      // A moves it to step 3 (leaves drawing); B, stale again, edits another job
      await impOn(a, [['WO-800-1', 'TWO PC', 'Aderrig Homes', D('2026-11-27'), '3. READY FOR UPLOAD', 3000]]);
      await sleep(1800);
      await b.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-101-1'); o.notes = 'B edit 2'; sched(); }); await sleep(2500);
      const s2 = SV.row.orders.find(o => o.wo === 'WO-800-1');
      rec('two PCs: A moves it onto the board; B\'s stale save does NOT put it back on the Drawing page', s2 && !s2.drawStage && s2.plannedWeek === '2026-11-23' && SV.row.orders.find(o => o.wo === 'WO-101-1').notes === 'B edit 2', JSON.stringify({ draw: s2 && s2.drawStage, wk: s2 && s2.plannedWeek }));
      // preview on A, B applies the same import first, then A presses Apply
      await H.importAoa(a, [HDR, ['WO-810-1', 'RACE', 'Aderrig Homes', D('2026-11-27'), '1. DRAWING', 3000]]); await a.evaluate(() => applyImport(IMPPLAN)); await sleep(1800);
      await b.evaluate(() => loadDB()); await sleep(300);
      await H.importAoa(a, [HDR, ['WO-810-1', 'RACE', 'Aderrig Homes', D('2026-11-27'), '3. READY FOR UPLOAD', 3000]]); // A: preview only
      await impOn(b, [['WO-810-1', 'RACE', 'Aderrig Homes', D('2026-11-27'), '3. READY FOR UPLOAD', 3000]]); await sleep(1800);
      // B then moves the week by hand
      await b.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-810-1'); o.plannedWeek = '2026-12-07'; sched(); }); await sleep(1800);
      await a.evaluate(() => document.getElementById('imp-apply').click()); await sleep(2500);
      const s3 = SV.row.orders.find(o => o.wo === 'WO-810-1');
      const lg = (s3.log || []).filter(l => /Left drawing/.test(l.t || l.what || '')).length;
      const atxt = await a.evaluate(() => (document.getElementById('iprev') || {}).innerText || '');
      rec('preview vs apply: B applied the same move + re-planned the week; A\'s Apply keeps B\'s week, logs "Left drawing" once, no duplicate job', s3 && !s3.drawStage && s3.plannedWeek === '2026-12-07' && lg === 1 && SV.row.orders.filter(o => o.wo === 'WO-810-1').length === 1, JSON.stringify({ wk: s3 && s3.plannedWeek, lg, draw: s3 && s3.drawStage, msg: atxt.slice(0, 200) }));
      rec('two PCs: no page errors', !(SV.errors || []).length, (SV.errors || []).join(' | '));
      await A.close(); await B.close();
    }

    // ================= 2,500 jobs, 400 at drawing =================
    {
      const orders = []; for (let i = 0; i < 2100; i++) orders.push(H.order({ wo: 'WO-' + (5000 + i) + '-1', customer: 'Cust ' + (i % 60), plannedWeek: ['2026-11-16', '2026-11-23', '2026-11-30', ''][i % 4], step: '4. READY FOR PRODUCTION' }));
      const T = await H.open({ browser, now: NOW, row: { id: 'main', nid: 9, settings: {}, orders } }), q = T.page;
      const rows = [HDR]; for (let i = 0; i < 400; i++) rows.push(['WO-' + (9000 + i) + '-1', 'House ' + i, 'Cust ' + (i % 60), D('2026-12-01'), i % 5 ? '1. DRAWING' : '4. READY FOR PRODUCTION', 1000]);
      for (let i = 0; i < 100; i++) rows.push(['WO-D-' + (700 + i) + '-1', 'Drw ' + i, 'Cust ' + (i % 60), D('2026-12-01'), '3. READY FOR UPLOAD', 100]);
      const t0 = Date.now(); await H.importAoa(q, rows); const tPrev = Date.now() - t0;
      const t1 = Date.now(); await q.evaluate(() => applyImport(IMPPLAN)); const tApp = Date.now() - t1;
      const perf = await q.evaluate(async () => { const n = drawJobs().length; let t = performance.now(); showTab('w'); const tw = performance.now() - t; t = performance.now(); showTab('b'); const tb = performance.now() - t;
        showTab('w'); t = performance.now(); const qi = document.getElementById('drw-q'); drwQ = 'house 3'; render(); const ts = performance.now() - t; const shown = document.querySelectorAll('[data-drw]').length; drwQ = ''; render(); const full = document.querySelectorAll('[data-drw]').length; return { n, tw: Math.round(tw), tb: Math.round(tb), ts: Math.round(ts), shown, full, more: /more — search to narrow down/.test(document.getElementById('app').innerText) }; });
      rec('2,500 jobs (420 drawing incl. 100 WO-D): preview < 6 s, apply < 3 s, Drawing page < 1 s, board < 2 s', perf.n === 420 && tPrev < 6000 && tApp < 3000 && perf.tw < 1000 && perf.tb < 2000, JSON.stringify({ tPrev, tApp, ...perf }));
      rec('2,500 jobs: Drawing page caps at 300 rows with "…and N more — search"', perf.more && perf.full === 300, JSON.stringify(perf));
      await T.close();
    }
  } finally { await browser.close(); }
  const f = res.filter(x => !x).length; console.log('\n' + (res.length - f) + '/' + res.length + ' passed'); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
