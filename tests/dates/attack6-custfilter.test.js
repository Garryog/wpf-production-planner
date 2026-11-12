// ATTACK 6 — Deliveries page Customer / project filter (A12, Garry 12 Nov 2026). Tester: tries to break it.
// Stubbed Supabase only (tests/harness.js). Run: node tests/dates/attack6-custfilter.test.js
// Focus: can a job that is HIDDEN by the filter ever be ticked / placed / moved; counts; projects late / switched off;
// two tabs; localStorage blocked; nasty names; 360 px; 600 jobs; prints/exports whole week; Production Manager view.
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 400) : '')); };
(async () => {
  const browser = await H.chromium.launch();
  const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-12', origDueDate: '2026-11-12', plannedWeek: '2026-11-09', step: '4. Ready', delv: true, customer: 'ASPECT', title: 'House ' + wo, value: 1000 }, x));
  const NASTY = 'O\'Grady & Sons "Ltd" 🏠 <b>x</b>';
  const LONG = 'BALLYMORE RESIDENTIAL DEVELOPMENTS ' + 'VERYLONGWORDWITHNOSPACES'.repeat(8) + ' PHASE 2 BLOCK C';
  const row = { id: 'main', nid: 9, settings: {}, orders: [
    O('WO-A1'), O('WO-A2'), O('WO-A3', { customer: 'Aspect  ' }),
    O('WO-B1', { customer: 'BALLYMORE HOMES' }), O('WO-B2', { customer: 'BALLYMORE HOMES' }),
    O('WO-B3', { customer: 'BALLYMORE HOMES', delVeh: 'VOLVO', delDay: 'Wed', delWk: '2026-11-09' }),
    O('WO-A4', { delVeh: 'VOLVO', delDay: 'Thu', delWk: '2026-11-09' }),
    // later (due after W+3) and past week bookings
    O('WO-AL', { dueDate: '2026-12-14', origDueDate: '2026-12-14', plannedWeek: '2026-12-14' }),
    O('WO-BL', { customer: 'BALLYMORE HOMES', dueDate: '2026-12-14', origDueDate: '2026-12-14', plannedWeek: '2026-12-14' }),
    O('WO-AP', { delVeh: 'VOLVO', delDay: 'Mon', delWk: '2026-11-02', dueDate: '2026-11-02', origDueDate: '2026-11-02' }),
    O('WO-BP', { customer: 'BALLYMORE HOMES', delVeh: 'VOLVO', delDay: 'Tue', delWk: '2026-11-02', dueDate: '2026-11-02', origDueDate: '2026-11-02' }),
    // rebook group
    O('WO-AR', { delRebook: { was: 'VOLVO|Mon|2026-11-02', by: 'X', why: 'site' } }),
    O('WO-BR', { customer: 'BALLYMORE HOMES', delRebook: { was: 'VOLVO|Mon|2026-11-02', by: 'X', why: 'site' } }),
    // in store, not tagged
    O('WO-SA', { step: '7. ASSEMBLY COMPLETE', delv: false, dueDate: '2026-11-09', origDueDate: '2026-11-09' }),
    O('WO-SB', { customer: 'BALLYMORE HOMES', step: '8. PALLETED', delv: false, dueDate: '2026-11-09', origDueDate: '2026-11-09' }),
    O('WO-N1', { customer: NASTY }), O('WO-L1', { customer: LONG }),
    O('WO-K1', { customer: 'KEANE (2)' }), O('WO-Q1', { customer: '(no customer)' }), O('WO-Q2', { customer: '' }),
    O('WO-T1', { customer: 'TWIN BUILDER' }),
  ] };
  const t = await H.open({ browser, now: '2026-11-10T10:00:00Z', row, viewport: { width: 1366, height: 900 } });
  const p = t.page;
  const R = await p.evaluate(async ({ NASTY, LONG }) => {
    const w = ms => new Promise(r => setTimeout(r, ms)), out = {};
    const pool = () => [...document.querySelectorAll('#dpool .dchip')].filter(c => c.style.display !== 'none').map(c => c.dataset.dw).sort();
    const grid = () => [...document.querySelectorAll('.dcell .dchip')].map(c => c.dataset.dw + (c.classList.contains('dcf-off') ? ':off' : ':on')).sort();
    const tabN = t => { const b = document.querySelector('[data-deltab="' + t + '"] .n'); return b ? b.textContent : ''; };
    const opts = () => [...document.querySelectorAll('#dcf-sel option')].map(o => o.value + '=' + o.textContent);
    const pick = async v => { const s = document.getElementById('dcf-sel'); s.value = v; if (s.value !== v) return 'NOOPT'; s.dispatchEvent(new Event('change')); await w(100); return 'ok'; };
    const placeN = () => { const b = document.querySelector('[data-place]'); return b ? b.textContent : ''; };
    const reset = async () => { localStorage.removeItem('wpfDelCF'); delSel.clear(); delTab = '0'; delStoreOpen = false; delFilter = ''; render(); await w(80); };
    localStorage.removeItem('wpfDelCF'); showTab('d'); await w(150);

    // 1. a ticked pool job whose customer is changed on another PC / by a Cienapps import while the filter is on
    await pick('c:aspect'); delSel.add('WO-A1'); render(); await w(60);
    DB.orders.find(o => o.wo === 'WO-A1').customer = 'BALLYMORE HOMES'; render(); await w(80); // sync redraw
    out.t1 = { sel: [...delSel], pool: pool(), place: placeN(), live: delSelLive() };
    // does ⤵ Place move the unseen job?
    const pb = document.querySelector('[data-place^="VOLVO|Fri"]'); if (pb) { pb.click(); await w(150); }
    const a1 = DB.orders.find(o => o.wo === 'WO-A1'); out.t1.placed = (a1.delVeh || '') + '|' + (a1.delDay || ''); // never booked = '|' (undefined from the fixture counts as not booked)
    a1.customer = 'ASPECT'; a1.delVeh = ''; a1.delDay = ''; delete a1.delWk; delete a1.delBookedBy; await reset();

    // 2. two tabs on one PC: tab B has a Ballymore job ticked, tab A picks ASPECT (localStorage), tab B redraws
    delSel.add('WO-B1'); render(); await w(60);
    localStorage.setItem('wpfDelCF', JSON.stringify({ k: 'c:aspect', lbl: 'ASPECT' })); render(); await w(80);
    out.t2 = { sel: [...delSel], pool: pool(), place: placeN() };
    await reset();

    // 3. ticked greyed van job → × back to pool: is it left ticked while hidden?
    await pick('c:aspect'); delSel.add('WO-B3'); render(); await w(60);
    const xb = document.querySelector('.dcell [data-dx="WO-B3"]'); if (xb) { xb.click(); await w(150); }
    out.t3 = { sel: [...delSel], b3: (o => o.delVeh + '|' + o.delDay)(DB.orders.find(o => o.wo === 'WO-B3')), pool: pool() };
    { const o = DB.orders.find(o => o.wo === 'WO-B3'); o.delVeh = 'VOLVO'; o.delDay = 'Wed'; o.delWk = '2026-11-09'; }
    await reset();

    // 4. group header "select all" + rebook group with filter
    await pick('c:aspect');
    out.t4grps = [...document.querySelectorAll('#dpool .dgrp-h .dgrp-n')].map(x => x.textContent);
    const gh = [...document.querySelectorAll('#dpool .dgrp-h')].find(h => !/rebook/i.test(h.textContent)); if (gh) { gh.click(); await w(80); }
    out.t4sel = [...delSel].sort();
    out.t4rebook = [...document.querySelectorAll('#dpool .dgrp')].filter(g => /rebook/i.test(g.textContent)).map(g => [...g.querySelectorAll('.dchip')].map(c => c.dataset.dw));
    await reset();

    // 5. Later + past tabs with the filter
    await pick('c:aspect');
    out.t5 = { later: tabN('later'), past: tabN('-1') };
    delTab = 'later'; render(); await w(80); out.t5.laterPool = pool();
    delTab = '-1'; render(); await w(80); out.t5.pastGrid = grid(); out.t5.pastPool = pool();
    await reset();

    // 6. ✕ Show all and back: ticked ASPECT pool job, show all, pick Ballymore, back to ASPECT
    await pick('c:aspect'); delSel.add('WO-A2'); render(); await w(50);
    document.getElementById('dcf-all').click(); await w(80); const s1 = [...delSel];
    await pick('c:ballymore homes'); const s2 = [...delSel]; await pick('c:aspect');
    out.t6 = { afterAll: s1, afterB: s2, back: [...delSel] };
    await reset();

    // 7. In store ⤵ Book with filter: booked job is visible + ticked, nothing hidden ticked
    await pick('c:aspect'); delStoreOpen = true; render(); await w(80);
    out.t7store = [...document.querySelectorAll('[data-storebook]')].map(b => b.dataset.storebook);
    const sbk = document.querySelector('[data-storebook="WO-SA"]'); if (sbk) { sbk.click(); await w(150); }
    out.t7 = { sel: [...delSel], pool: pool(), tab: delTab, filt: document.getElementById('dcf-sel').value };
    { const o = DB.orders.find(o => o.wo === 'WO-SA'); o.delv = false; } await reset();

    // 8. nasty names: pick round-trips, bar escaped; label with "(2)" in the name
    out.t8 = {};
    const nk = 'c:' + NASTY.replace(/\s+/g, ' ').trim().toLowerCase();
    out.t8.pickN = await pick(nk); out.t8.poolN = pool(); out.t8.bar = document.getElementById('dcf').textContent.replace(/\s+/g, ' ');
    out.t8.bTags = document.querySelectorAll('#dcf b').length; out.t8.saved = localStorage.getItem('wpfDelCF');
    await pick('c:keane (2)'); out.t8.keaneSaved = JSON.parse(localStorage.getItem('wpfDelCF') || '{}').lbl; out.t8.keanePool = pool();
    // literal "(no customer)" vs empty customer: two entries with the same label?
    out.t8.noCust = opts().filter(x => /\(no customer\)/.test(x));
    await reset();

    // 9. tampered remembered values
    localStorage.setItem('wpfDelCF', JSON.stringify({ k: 'p:', lbl: 'X' })); render(); await w(60);
    out.t9pEmpty = { pool: pool().length, v: document.getElementById('dcf-sel').value };
    localStorage.setItem('wpfDelCF', JSON.stringify({ k: 'c:gone', lbl: '<img src=x onerror=window.__x9=1>' })); render(); await w(60);
    out.t9xss = !!window.__x9 || document.querySelectorAll('#dcf img').length;
    await reset();

    // 10. another PC untags the picked customer's last jobs
    await pick('c:ballymore homes');
    const bl = DB.orders.filter(o => /BALLYMORE/.test(o.customer)); const keep = bl.map(o => [o, o.delv, o.step]);
    bl.forEach(o => { o.delv = false; if (/7\.|8\./.test(o.step)) o.step = '9. SHIPPED'; }); render(); await w(80);
    out.t10 = { v: document.getElementById('dcf-sel').value, pool: pool().length, opt: opts().find(x => x.startsWith('c:ballymore homes')) };
    keep.forEach(([o, d, s]) => { o.delv = d; o.step = s; }); await reset();

    // 11. localStorage blocked (ls wrapper swallows it): does picking work, is the user told?
    const g0 = ls.get, s0 = ls.set; ls.get = k => k === 'wpfDelCF' ? '' : g0(k); ls.set = (k, v) => { if (k !== 'wpfDelCF') s0(k, v); }; // storage refuses (private mode / full)
    window.__toasts = []; const t0 = window.toast; window.toast = m => { window.__toasts.push(m); };
    await pick('c:aspect');
    out.t11 = { v: (document.getElementById('dcf-sel') || {}).value, pool: pool().length, toasts: window.__toasts.slice() };
    ls.get = g0; ls.set = s0; window.toast = t0; await reset();

    // 12. projects: two Cienapps names on one project; one customer that fits two projects (ambiguous)
    const realV2 = V2; window.V2 = () => true; LST.loaded = true;
    LST.p.set('P1', { id: 'P1', name: 'Aspect Athenry', customer: 'ASPECT', cien_names: ['ASPECT', 'KEANE (2)'], active: true });
    LST.p.set('P2', { id: 'P2', name: 'Twin Site One', customer: 'TWIN BUILDER', cien_names: ['TWIN BUILDER'], active: true });
    LST.p.set('P3', { id: 'P3', name: 'Twin Site Two', customer: 'TWIN BUILDER', cien_names: ['TWIN BUILDER'], active: true });
    render(); await w(80);
    out.t12 = { opts: opts() };
    await pick('p:P1'); out.t12.pool = pool();
    await reset();

    // 13. customer picked BEFORE projects existed, then ASPECT gets linked to a project
    window.V2 = realV2; LST.loaded = false; render(); await w(40);
    await pick('c:aspect'); const before = pool();
    window.V2 = () => true; LST.loaded = true; render(); await w(80);
    out.t13 = { before, after: pool(), opt: opts().find(x => x.startsWith('c:aspect')), bar: document.getElementById('dcf').textContent.replace(/\s+/g, ' ') };
    await reset();

    // 14. project picked, then the lists switch is turned off
    await pick('p:P1'); const pOn = pool();
    window.V2 = realV2; render(); await w(80);
    out.t14 = { on: pOn, off: pool(), v: document.getElementById('dcf-sel').value, bar: document.getElementById('dcf').textContent.replace(/\s+/g, ' ') };
    await reset();

    // 15. project pick remembered, projects load AFTER the page drew (and a first load that fails)
    LST.loaded = false; window.V2 = () => true; let calls = 0; const realLoad = window.lsLoad;
    window.lsLoad = () => { calls++; return calls === 1 ? Promise.reject(new Error('offline')) : new Promise(r => setTimeout(() => { LST.loaded = true; r(); }, 50)); };
    renderDeliveries._dcfLoad = 0;
    // the retry waits 30 s by design: squeeze 30 s timers to 60 ms for this step only (fake clock)
    const st0 = window.setTimeout; window.setTimeout = (f, ms, ...a) => st0(f, ms >= 30000 ? 400 : ms, ...a);
    localStorage.setItem('wpfDelCF', JSON.stringify({ k: 'p:P1', lbl: '🏗 Aspect Athenry' })); render(); await w(120);
    out.t15 = { firstPool: pool().length, calls };
    out.t15.callsSoon = (render(), calls); await w(450); render(); await w(200); out.t15.calls2 = calls; window.setTimeout = st0; out.t15.pool2 = pool().length;
    window.lsLoad = realLoad; LST.loaded = true; render(); await w(60); out.t15.loadedPool = pool();
    window.V2 = realV2; LST.p.clear(); LST.loaded = false; await reset();

    // 16. prints / export with the filter on = whole week
    const grab = async fn => { window.__opened.length = 0; fn(); await w(150); return window.__opened.slice(-1)[0] || ''; };
    const strip = h => h.replace(/\d{1,2}:\d{2}(:\d{2})?/g, '').replace(/\d{1,2}\/\d{1,2}\/\d{2,4}/g, '');
    const wf = XLSX.writeFile; let wb = null; XLSX.writeFile = (b) => { wb = JSON.stringify(b.Sheets); };
    const pAll = strip(await grab(() => printPoster(delTabWk('0')))), rAll = strip(await grab(() => printRunSheets(delTabWk('0'))));
    exportDeliveries(delTabWk('0')); const eAll = wb;
    await pick('c:aspect');
    const pF = strip(await grab(() => document.getElementById('btn-delprint').click())), rF = strip(await grab(() => document.getElementById('btn-runsheets').click()));
    document.getElementById('btn-delexp').click(); await w(80); const eF = wb;
    XLSX.writeFile = wf;
    out.t16 = { poster: pAll === pF && /WO-B3/.test(pF), runs: rAll === rF && /WO-B3/.test(rF), exp: eAll === eF && /WO-B3/.test(eF || ''), expB1: /WO-B1/.test(eF || '') };
    await reset();

    // 17. Production Manager view
    localStorage.setItem('wpfPin_prod', '7777'); ROLE = 'prod'; prodTab = 'deliv'; render(); await w(120);
    out.t17 = { bar: !!document.getElementById('dcf-sel') };
    if (out.t17.bar) { await pick('c:aspect'); out.t17.pool = pool(); out.t17.grid = grid(); }
    ROLE = 'office'; showTab('d'); await reset();
    return out;
  }, { NASTY, LONG });

  const J = JSON.stringify;
  rec('1 customer changed by sync while ticked: hidden job is un-ticked', !R.t1.sel.includes('WO-A1'), J(R.t1));
  rec('1b ⤵ Place never books a job hidden by the filter', R.t1.placed === '|', 'WO-A1 ended on ' + R.t1.placed);
  rec('2 filter picked in another tab: this tab\'s hidden ticked pool job is dropped on redraw', !R.t2.sel.includes('WO-B1'), J(R.t2));
  // 3: informational only — × on a booked job opens the "why" dialog, so the job never left the van in this run (placeJobs clears the ticks when it does)
  console.log('INFO 3 × on a ticked greyed van job: ' + J(R.t3));
  rec('4 group header select-all only selects shown ASPECT jobs', R.t4sel.every(w => /^WO-A|JOB/.test(w)) && R.t4sel.length > 0, J(R.t4sel) + ' groups ' + J(R.t4grps));
  rec('4b ASPECT and "Aspect  " are ONE customer in the filter but should be one pool group too', R.t4grps.filter(g => /aspect/i.test(g)).length === 1, J(R.t4grps));
  rec('4c rebook group filtered (WO-AR only)', J(R.t4rebook) === J([['WO-AR']]), J(R.t4rebook));
  rec('5 Later / past tab counts follow the filter', /\(1\)/.test(R.t5.later) && /\(1\)/.test(R.t5.past), J(R.t5));
  rec('5b Later pool = WO-AL; past grid keeps Ballymore greyed', J(R.t5.laterPool) === '["WO-AL"]' && J(R.t5.pastGrid) === J(['WO-AP:on', 'WO-BP:off']), J(R.t5));
  rec('6 Show all keeps the tick; picking Ballymore drops it; back to ASPECT does not re-tick', J(R.t6.afterAll) === '["WO-A2"]' && J(R.t6.afterB) === '[]' && J(R.t6.back) === '[]', J(R.t6));
  rec('7 In store with filter lists only ASPECT; ⤵ Book shows + ticks it, filter stays', J(R.t7store) === '["WO-SA"]' && J(R.t7.sel) === '["WO-SA"]' && R.t7.pool.includes('WO-SA') && R.t7.filt === 'c:aspect', J(R.t7store) + J(R.t7));
  rec('8 O\'Grady & "quotes" & emoji pick works and is shown as text', R.t8.pickN === 'ok' && J(R.t8.poolN) === '["WO-N1"]' && R.t8.bTags === 1, J(R.t8));
  rec('8b customer named "KEANE (2)" keeps its "(2)" in the remembered label', R.t8.keaneSaved === 'KEANE (2)', R.t8.keaneSaved);
  rec('8c "(no customer)" literal and blank customer are not two identical-looking entries', R.t8.noCust.length === 1, J(R.t8.noCust));
  rec('9 damaged value {k:"p:"} falls back to All (not a hidden half-filter)', R.t9pEmpty.v === '' , J(R.t9pEmpty));
  rec('9b tampered label shown as text', !R.t9xss, R.t9xss);
  rec('10 customer untagged elsewhere: stays picked with (0)', R.t10.v === 'c:ballymore homes' && R.t10.pool === 0 && /\(0\)/.test(R.t10.opt || ''), J(R.t10));
  rec('11 localStorage blocked: picking still filters (or the user is told)', R.t11.v === 'c:aspect' || R.t11.toasts.length > 0, J(R.t11));
  rec('12 project with two Cienapps names = one 🏗 entry with both', R.t12.opts.some(x => /^p:P1=🏗 Aspect Athenry \(9\)/.test(x)) && !R.t12.opts.some(x => /^c:(aspect|keane)/.test(x)), J(R.t12.opts));
  rec('12b customer that fits two projects stays a plain customer (never guessed)', R.t12.opts.some(x => x.startsWith('c:twin builder=')) && !R.t12.opts.some(x => /^p:P[23]/.test(x)), J(R.t12.opts));
  rec('12c picking the project shows both customers\' jobs', ['WO-A1', 'WO-A2', 'WO-A3', 'WO-K1'].every(w => R.t12.pool.includes(w)), J(R.t12.pool));
  rec('13 customer picked, then linked to a project: count in the picker matches what is shown', !/\(0\)/.test(R.t13.opt || '') || R.t13.after.length === 0, J(R.t13));
  rec('14 project picked, lists switch turned off: user is not shown an empty board silently', R.t14.off.length > 0 || /0 job|switch|lists/i.test(R.t14.bar), J(R.t14));
  rec('15 projects load fails once: not retried instantly, retried on a redraw after the 30 s wait, then shows the project', R.t15.callsSoon === 1 && R.t15.calls2 > 1 && R.t15.pool2 > 0, J(R.t15));
  rec('16 poster, run sheets and export are the whole week with a filter on', R.t16.poster && R.t16.runs && R.t16.exp, J(R.t16));
  rec('17 Production Manager Deliveries view: filter bar present and works', R.t17.bar && J(R.t17.pool) === J(['WO-A1', 'WO-A2', 'WO-A3', 'WO-AR']), J(R.t17));
  rec('no page errors (1366)', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
  rec('nothing filter-related saved to the database', !t.server.patches.some(b => JSON.stringify(b).includes('wpfDelCF')));
  await t.close();

  // 360 px: very long customer name picked
  const t2 = await H.open({ browser, now: '2026-11-10T10:00:00Z', row, viewport: { width: 360, height: 780 } });
  const R2 = await t2.page.evaluate(async LONG => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    localStorage.removeItem('wpfDelCF'); showTab('d'); await w(150);
    const s = document.getElementById('dcf-sel'); s.value = 'c:' + LONG.toLowerCase(); s.dispatchEvent(new Event('change')); await w(120);
    const b = document.getElementById('dcf').getBoundingClientRect(), x = document.getElementById('dcf-all').getBoundingClientRect();
    const wide = [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1 && !e.closest('[style*="overflow-x:auto"]') && !e.closest('.del-tabs') && !e.closest('.tabs')).slice(0, 4).map(e => e.tagName + '.' + e.className + '[' + (e.id || e.textContent.slice(0, 40)) + ']:' + Math.round(e.getBoundingClientRect().right));
    const r = { wide, sw: document.documentElement.scrollWidth, overflow: document.documentElement.scrollWidth > window.innerWidth + 1, barR: b.right, xR: x.right, vw: window.innerWidth, barH: b.height };
    localStorage.removeItem('wpfDelCF'); return r;
  }, LONG);
  // the page is 20 px too wide at 360 px because of the missed-dates panel's "Give reason" buttons (not the filter) — logged, not counted
  if (R2.overflow) console.log('INFO 360px: page wider than the screen, caused by: ' + JSON.stringify(R2.wide));
  rec('360px: long customer name picked — filter bar and ✕ Show all fit the screen', R2.xR <= R2.vw + 1 && R2.barR <= R2.vw + 1 && !R2.wide.some(x => /dcf/.test(x)), JSON.stringify(R2));
  rec('360px: filter bar with a 200-char no-space name stays under 220 px (accepted Low: unrealistic name, nothing off-screen)', R2.barH < 220, 'bar height ' + R2.barH + ' px');
  await t2.close();

  // performance: 600 and 2000 jobs, render time filter off vs on
  for (const N of [600, 2000]) {
    const orders = [];
    for (let i = 0; i < N; i++) orders.push(O('WO-P' + i, { customer: 'CUST ' + (i % 120), delVeh: i % 7 === 0 ? 'VOLVO' : '', delDay: i % 7 === 0 ? 'Wed' : '', delWk: i % 7 === 0 ? '2026-11-09' : undefined, step: i % 5 === 0 ? '7. ASSEMBLY COMPLETE' : '4. Ready', delv: i % 5 !== 0 }));
    const t3 = await H.open({ browser, now: '2026-11-10T10:00:00Z', row: { id: 'main', nid: 9, settings: {}, orders }, viewport: { width: 1366, height: 900 } });
    const P = await t3.page.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)); localStorage.removeItem('wpfDelCF'); showTab('d'); await w(150);
      const time = () => { const a = performance.now(); for (let i = 0; i < 3; i++) render(); return (performance.now() - a) / 3; };
      const off = time(); localStorage.setItem('wpfDelCF', JSON.stringify({ k: 'c:cust 7', lbl: 'CUST 7' })); const on = time();
      const r = { off: Math.round(off), on: Math.round(on) }; localStorage.removeItem('wpfDelCF'); return r;
    });
    rec(N + ' jobs: render with filter on < 1.5 s and not more than 2x filter off', P.on < 1500 && P.on <= Math.max(2 * P.off, P.off + 150), JSON.stringify(P));
    await t3.close();
  }
  await browser.close();
  const f = res.filter(x => !x).length;
  console.log('\n' + (res.length - f) + '/' + res.length + ' passed');
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
