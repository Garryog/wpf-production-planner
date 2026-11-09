// Dates & deliveries (Job A) steps 12–13: "Close week" (one week only) and the "🏬 In store" panel + storeAt stamping.
// A: close This week — delivered archived (Past weeks "Wk N" with its notes + photos), not delivered back to To plan
//    "not delivered Wk N — rebook", other weeks / pool / other weeks' notes + photos untouched, legacy bookings and
//    day-name notes belong to This week until the office answers, old archive entries still open and export.
// B: close a past week that was never closed — this week untouched.
// C: In store — 7/8 not on a van, days in store (amber > 14), oldest first, date unknown last, ⤵ Book; storeAt stamped by
//    the board step box and the import (first time only), never by loading old data. Stubbed Supabase only.
// Run: node tests/dates/c6-close-instore.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
(async () => {
  const browser = await H.chromium.launch();
  const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-25', origDueDate: '2026-11-25', plannedWeek: '2026-11-23', step: '8. PALLETED', delv: true, customer: 'CAIRN', title: 'House ' + wo }, x));
  const W = '2026-11-23', WN = '2026-11-30';

  // ---------- A. Saturday 28 Nov 2026 (Wk 48): close This week ----------
  const rowA = { id: 'main', nid: 9, settings: {
    delNotes: { '2026-11-24': 'this wk tue', '2026-12-01': 'next wk tue', Mon: 'legacy mon <i>' },
    pod: { ['VOLVO|Tue|' + W]: { photos: ['https://x.test/1.jpg'], by: 'Dan' }, ['VOLVO|Tue|' + WN]: { photos: ['https://x.test/2.jpg'] } },
    delArchive: { '2026-10-01.abc': { at: '2026-10-01T10:00:00Z', notes: { Mon: 'old note' }, pod: {}, jobs: [{ wo: 'OLD-1', t: 'Old job', c: 'C', v: 'VOLVO', d: 'Mon', val: 10, vAt: '2026-09-28T12:00:00Z', vBy: 'Dan' }] } },
    delx: [{ wo: 'JOB-M1', title: 'Manual delivered', customer: 'X', value: 1, manual: true, delVeh: 'CRAFTER', delDay: 'Fri', delWk: W, delDone: true, delDelivAt: '2026-11-27T10:00:00Z' },
           { wo: 'JOB-M2', title: 'Manual next week', customer: 'X', value: 1, manual: true, delVeh: 'CRAFTER', delDay: 'Mon', delWk: WN, delDone: false }]
  }, orders: [
    O('WO-D1', { delVeh: 'VOLVO', delDay: 'Tue', delWk: W, delLoadedAt: '2026-11-24T07:00:00Z', delDispAt: '2026-11-24T08:00:00Z', delDelivAt: '2026-11-24T12:00:00Z', delDone: true, delivBy: 'Dan', delMoves: [{ at: '2026-11-20T10:00:00Z', by: 'Ann', why: 'Customer request', from: 'VOLVO|Mon', to: 'VOLVO|Tue' }] }),
    O('WO-U1', { delVeh: 'VOLVO', delDay: 'Wed', delWk: W, delLoadedAt: '2026-11-25T07:00:00Z', ldBy: 'Dan' }),
    O('WO-U2', { delVeh: 'ARTIC', delDay: 'Thu', delWk: W, missWhy: { why: 'Site not ready', by: 'Ann', at: '2026-11-27T10:00:00Z' } }),
    O('WO-L1', { delVeh: 'IVECO', delDay: 'Mon' }),             // legacy booking (no week) — This week until answered
    O('WO-N1', { delVeh: 'VOLVO', delDay: 'Tue', delWk: WN }),  // next week
    O('WO-P1'),                                                 // pool
    O('WO-P2', { delRebook: { at: '2026-11-26T10:00:00Z', by: 'Ann', why: 'Site not ready', was: 'VOLVO|Fri' } }),
  ] };
  const t = await H.open({ browser, now: '2026-11-28T14:00:00Z', row: rowA });
  const A = await t.page.evaluate(async () => {
    const out = {}; const g = w => DB.orders.find(o => o.wo === w);
    showTab('d'); await new Promise(r => setTimeout(r, 150));
    out.btn = document.getElementById('btn-delreset').textContent;
    const seen = []; window.confirm = m => { seen.push(m); return true; };
    document.getElementById('btn-delreset').click(); await new Promise(r => setTimeout(r, 900));
    out.confirm = seen.join(' || ');
    const ks = Object.keys(DB.delArchive).sort(); out.nArch = ks.length;
    const a = DB.delArchive[ks[ks.length - 1]]; out.arch = { w: a.w, by: a.by, jobs: a.jobs.map(j => j.wo + ':' + j.d + ':' + j.dt + ':' + (j.vAt ? 'D' : '-')).sort(), notes: a.notes, pod: Object.keys(a.pod), mv: (a.jobs.find(j => j.wo === 'WO-D1') || {}).mv };
    out.old = !!DB.delArchive['2026-10-01.abc'];
    const pick = o => o && { delv: o.delv, veh: o.delVeh, day: o.delDay, wk: o.delWk, done: o.delDone, ld: o.delLoadedAt, rb: o.delRebook, mv: o.delMoves, mw: o.missWhy };
    ['WO-D1', 'WO-U1', 'WO-U2', 'WO-L1', 'WO-N1', 'WO-P1', 'WO-P2'].forEach(w => out[w] = pick(g(w)));
    out.logU1 = g('WO-U1').log.slice(-1)[0];
    out.delx = DB.delx.map(x => x.wo + ':' + (x.delDay || '') + ':' + (x.delWk || ''));
    out.notes = JSON.parse(JSON.stringify(DB.delNotes)); out.pod = Object.keys(DB.pod);
    out.pool0 = [...document.querySelectorAll('#dpool .dchip')].map(c => c.dataset.dw + '=' + (c.querySelector('.dm-moved') || {}).textContent);
    out.grid0 = [...document.querySelectorAll('.del-grid [data-cell] .dchip')].map(c => c.dataset.dw);
    document.querySelector('[data-deltab="1"]').click(); await new Promise(r => setTimeout(r, 100));
    out.grid1 = [...document.querySelectorAll('.del-grid [data-cell] .dchip')].map(c => c.dataset.dw).sort();
    out.note1 = document.querySelector('.dnote[data-dnote="2026-12-01"]').value;
    // Past weeks: Wk N label; old entry still opens and exports
    document.getElementById('btn-delarch').click(); await new Promise(r => setTimeout(r, 100));
    const ov = () => document.querySelector('.pod-ovl'); out.past = ov().innerText;
    ov().querySelector('[data-arcv="2026-10-01.abc"]').click(); await new Promise(r => setTimeout(r, 100));
    out.oldView = ov().innerText.includes('OLD-1') && ov().innerText.includes('old note');
    const files = []; const wf = XLSX.writeFile; XLSX.writeFile = (wb, n) => files.push(n + ':' + XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }).map(r => r.join('/')).join(';'));
    ov().querySelector('[data-arcx="2026-10-01.abc"]').click();
    ov().querySelector('[data-arcx="' + ks[ks.length - 1] + '"]').click();
    XLSX.writeFile = wf; out.files = files; ov().remove();
    ROLE = 'prod'; ls.set('wpfPin_prod', '9000'); render(); out.score = document.getElementById('app').innerText.match(/Wk 48 · closed[^\n]*/) ? 'ok' : document.getElementById('app').innerText.slice(0, 100);
    ROLE = 'office'; render();
    await new Promise(r => setTimeout(r, 1700));
    return out;
  });
  rec('button reads "🔒 Close Wk 48"; the confirm mentions the backup and what happens', /Close Wk 48/.test(A.btn) && /backup/i.test(A.confirm) && /3 booked but not delivered/.test(A.confirm) && /2 delivered/.test(A.confirm), A.btn + ' / ' + A.confirm.slice(0, 200));
  rec('archive entry for Wk 48 only: delivered + not delivered + legacy booking + delivered manual job', A.arch.w === '2026-11-23' && A.arch.by === 'Tester' && A.arch.jobs.join() === ['JOB-M1:Fri:2026-11-27:D', 'WO-D1:Tue:2026-11-24:D', 'WO-L1:Mon:2026-11-23:-', 'WO-U1:Wed:2026-11-25:-', 'WO-U2:Thu:2026-11-26:-'].join() && A.nArch === 2 && A.old, JSON.stringify(A.arch.jobs));
  rec('archive keeps that week\'s notes (by day) and photos only; move history kept', A.arch.notes.Tue === 'this wk tue' && A.arch.notes.Mon === 'legacy mon <i>' && Object.keys(A.arch.notes).length === 2 && A.arch.pod.join() === 'VOLVO|Tue|2026-11-23' && A.arch.mv && A.arch.mv.length === 1, JSON.stringify([A.arch.notes, A.arch.pod]));
  rec('delivered job leaves the board (delDone kept, untagged)', A['WO-D1'].delv === undefined && A['WO-D1'].done === true && !A['WO-D1'].day && !A['WO-D1'].wk && !A['WO-D1'].mv, JSON.stringify(A['WO-D1']));
  rec('not delivered → back to To plan, still tagged, "not delivered Wk 48 — rebook", stamps cleared, history line', A['WO-U1'].delv === true && A['WO-U1'].day === '' && !A['WO-U1'].wk && !A['WO-U1'].ld && A['WO-U1'].rb && A['WO-U1'].rb.nd === 48 && A['WO-U1'].rb.was === 'VOLVO|Wed|2026-11-23' && /Not delivered in Wk 48/.test(A.logU1.what) && A.logU1.by === 'Tester' && A['WO-U2'].rb.nd === 48 && !A['WO-U2'].mw, JSON.stringify([A['WO-U1'], A.logU1.what]));
  rec('legacy booking (no week) closed with This week', A['WO-L1'].delv === true && A['WO-L1'].day === '' && A['WO-L1'].rb && A['WO-L1'].rb.nd === 48, JSON.stringify(A['WO-L1']));
  rec('next week untouched (job, manual job, note, photos)', A['WO-N1'].day === 'Tue' && A['WO-N1'].wk === '2026-11-30' && A['WO-N1'].veh === 'VOLVO' && A.delx.join() === 'JOB-M2:Mon:2026-11-30' && A.notes['2026-12-01'] === 'next wk tue' && A.note1 === 'next wk tue' && A.pod.join() === 'VOLVO|Tue|2026-11-30' && A.grid1.join() === 'JOB-M2,WO-N1', JSON.stringify([A['WO-N1'], A.delx, A.notes, A.pod, A.grid1]));
  rec('pool untouched (its own "date moved" flag kept); this week\'s notes gone from the board', A['WO-P1'].delv === true && !A['WO-P1'].rb && A['WO-P2'].rb && !A['WO-P2'].rb.nd && A.notes['2026-11-24'] === undefined && A.notes.Mon === undefined, JSON.stringify([A['WO-P2'], A.notes]));
  rec('This week pool shows the rebook cards with their wording; grid empty', A.grid0.length === 0 && A.pool0.some(x => /^WO-U1=🚚 not delivered Wk 48 — rebook/.test(x)) && A.pool0.some(x => /^WO-P2=📅 date moved — rebook/.test(x)) && A.pool0.some(x => /^WO-P1=/.test(x)), A.pool0.join(' | '));
  rec('📚 Past weeks lists "Wk 48"; an old entry without a week still opens and exports', /Wk 48 · Mon 23 Nov/.test(A.past) && A.oldView && A.files.length === 2 && /^WPF_DeliveryWeek_2026-10-01\.xlsx:/.test(A.files[0]) && /OLD-1/.test(A.files[0]) && /^WPF_DeliveryWeek_Wk48_2026-11-23\.xlsx:/.test(A.files[1]) && /Tue 2026-11-24\/Volvo\/WO-D1/.test(A.files[1]), A.files.map(f => f.slice(0, 160)).join(' || '));
  rec('scorecard row "Wk 48 · closed …"', A.score === 'ok', A.score);
  rec('safety backup taken before closing', t.server.posts.some(b => /Close week Wk 48/.test(b || '')), (t.server.posts || []).map(b => String(b).slice(0, 80)).join(' | '));
  rec('no page errors (A)', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
  await t.close();

  // ---------- B. Monday 30 Nov: last week was never closed — close the past tab only ----------
  const rowB = { id: 'main', nid: 9, settings: { delNotes: { '2026-11-25': 'past wed', '2026-12-02': 'this wed' } }, orders: [
    O('WO-PA', { delVeh: 'VOLVO', delDay: 'Wed', delWk: W, delDelivAt: '2026-11-25T12:00:00Z', delDone: true }),
    O('WO-PB', { delVeh: 'VOLVO', delDay: 'Thu', delWk: W }),
    O('WO-TH', { delVeh: 'VOLVO', delDay: 'Wed', delWk: WN }),
  ] };
  const t2 = await H.open({ browser, now: '2026-11-30T09:00:00Z', row: rowB });
  const B = await t2.page.evaluate(async () => {
    const out = {}; const g = w => DB.orders.find(o => o.wo === w);
    showTab('d'); await new Promise(r => setTimeout(r, 120));
    out.tabs = [...document.querySelectorAll('[data-deltab]')].map(b => b.dataset.deltab);
    document.querySelector('[data-deltab="-1"]').click(); await new Promise(r => setTimeout(r, 100));
    out.btn = document.getElementById('btn-delreset').textContent;
    document.getElementById('btn-delreset').click(); await new Promise(r => setTimeout(r, 900));
    out.tabsAfter = [...document.querySelectorAll('[data-deltab]')].map(b => b.dataset.deltab); out.on = (document.querySelector('.del-tab.on') || {}).dataset;
    out.TH = { day: g('WO-TH').delDay, wk: g('WO-TH').delWk }; out.PB = { day: g('WO-PB').delDay, rb: g('WO-PB').delRebook }; out.PA = { delv: g('WO-PA').delv, done: g('WO-PA').delDone };
    out.notes = JSON.parse(JSON.stringify(DB.delNotes)); const a = Object.values(DB.delArchive)[0]; out.arch = { w: a.w, n: a.jobs.length, notes: a.notes };
    out.grid = [...document.querySelectorAll('.del-grid [data-cell] .dchip')].map(c => c.dataset.dw);
    out.closeWeekNext = (() => { const before = JSON.stringify(DB.orders); closeWeek('2026-12-07'); return JSON.stringify(DB.orders) === before; })();
    return out;
  });
  rec('past week gets its own tab and a Close button', B.tabs.join() === '-1,0,1,2,3,later' && /Close Wk 48/.test(B.btn), B.tabs + ' / ' + B.btn);
  rec('closing the past week leaves this week alone; its tab goes; back on This week', B.TH.day === 'Wed' && B.TH.wk === '2026-11-30' && B.PB.day === '' && B.PB.rb.nd === 48 && B.PA.done === true && !B.PA.delv && B.tabsAfter.join() === '0,1,2,3,later' && B.on && B.on.deltab === '0' && B.grid.join() === 'WO-TH', JSON.stringify(B));
  rec('only the past week\'s note archived and removed', B.notes['2026-12-02'] === 'this wed' && B.notes['2026-11-25'] === undefined && B.arch.notes.Wed === 'past wed' && B.arch.w === '2026-11-23' && B.arch.n === 2, JSON.stringify([B.notes, B.arch]));
  rec('a future week can\'t be closed', B.closeWeekNext, '');
  rec('no page errors (B)', !(t2.server.errors || []).length, (t2.server.errors || []).join(' | '));
  await t2.close();

  // ---------- C. In store + storeAt ----------
  const rowC = { id: 'main', nid: 9, settings: {}, orders: [
    O('WO-K1', { storeAt: '2026-11-01T10:00:00Z' }),                                                       // 27 days → amber
    O('WO-K2', { step: '7. ASSEMBLY COMPLETE', log: [{ at: '2026-11-20T09:00:00Z', by: '(import)', what: 'Cienapps import: step: JOB CUT COMPLETE → ASSEMBLY COMPLETE' }] }), // from history: 8 days
    O('WO-K3'),                                                                                              // date unknown
    O('WO-K4', { delVeh: 'VOLVO', delDay: 'Mon', delWk: WN }),                                                // on a van → not in store
    O('WO-K5', { step: '9. JOB SHIPPED', shippedAt: '2026-11-25T10:00:00Z' }),
    O('WO-K6', { cienHold: true }),
    O('WO-K7', { delv: false, delvOverride: '8. PALLETED', storeAt: '2026-11-26T10:00:00Z', dueDate: '2026-12-02' }), // untagged by hand, 2 days
    O('WO-K8', { step: '5. WORK ORDER PROCESSED', delv: false }),
    O('WO-K9', { step: '6. JOB CUT COMPLETE', delv: false }),
    O('WO-K10', { step: '3. In production', delv: false }),
    O('WO-K11', { step: '8. <img src=x onerror=window.__x=1>', title: '<b>bad</b>' }),
  ] };
  const t3 = await H.open({ browser, now: '2026-11-28T14:00:00Z', row: rowC });
  const C = await t3.page.evaluate(async () => {
    const out = {}; const g = w => DB.orders.find(o => o.wo === w);
    out.bootStamped = DB.orders.filter(o => o.storeAt).map(o => o.wo).sort();
    showTab('d'); await new Promise(r => setTimeout(r, 120));
    out.btn = document.getElementById('btn-instore').textContent.replace(/\s+/g, ' ').trim();
    document.getElementById('btn-instore').click(); await new Promise(r => setTimeout(r, 100));
    const rows = [...document.querySelectorAll('#del-store .dsh-row')];
    out.rows = rows.map(r => r.querySelector('b').textContent + '=' + (r.querySelector('.dsh-x') || {}).textContent + (r.style.background ? '#amber' : ''));
    out.xss = !!document.querySelector('#del-store img') || window.__x === 1 || !!document.querySelector('#del-store .dsh-t b');
    document.querySelector('[data-storebook="WO-K7"]').click(); await new Promise(r => setTimeout(r, 150));
    out.book = { delv: g('WO-K7').delv, ovr: g('WO-K7').delvOverride, sel: [...delSel], tab: delTab, log: g('WO-K7').log.slice(-1)[0].what };
    document.querySelector('[data-place="VOLVO|Wed|2026-11-30"]').click(); await new Promise(r => setTimeout(r, 150));
    document.querySelectorAll('.pod-ovl').forEach(o => o.remove());
    out.placed = { day: g('WO-K7').delDay, wk: g('WO-K7').delWk };
    out.rows2 = [...document.querySelectorAll('#del-store .dsh-row b')].map(b => b.textContent);
    // board step box: 5 → 7 stamps storeAt; 7 → 8 keeps the first stamp
    showTab('b'); await new Promise(r => setTimeout(r, 150));
    const sel = document.querySelector('[data-stepsel="WO-K8"]'); out.hasSel = !!sel;
    if (sel) { const opt = [...sel.options].find(o => /^7\./.test(o.value)); sel.value = opt.value; sel.dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 150)); }
    out.s8a = g('WO-K8').storeAt;
    const sel2 = document.querySelector('[data-stepsel="WO-K8"]');
    if (sel2) { const opt = [...sel2.options].find(o => /^8\./.test(o.value)); sel2.value = opt.value; sel2.dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 150)); }
    out.s8b = g('WO-K8').storeAt;
    // import: S9 6 → 8 stamped; S1 (already stamped) kept; S10 3 → 4 not stamped; new job at 7 stamped
    const p = analyzeImport(prepImport([{ wo: 'WO-K9', step: '8. PALLETED', value: 4000, dueDate: '2026-11-25' }, { wo: 'WO-K1', step: '8. PALLETED', value: 4000, dueDate: '2026-11-25' },
      { wo: 'WO-K10', step: '4. Assembly', value: 4000, dueDate: '2026-11-25' }, { wo: 'NEW-1', step: '7. ASSEMBLY COMPLETE', value: 4000, dueDate: '2026-12-10', title: 'New', customer: 'C' }]), 'file');
    applyImport(p);
    out.imp = { S9: g('WO-K9').storeAt, S1: g('WO-K1').storeAt, S10: g('WO-K10').storeAt, NEW: (g('NEW-1') || {}).storeAt };
    await new Promise(r => setTimeout(r, 1700));
    return out;
  });
  rec('loading old data stamps nothing (no boot migration)', C.bootStamped.join() === 'WO-K1,WO-K7', C.bootStamped.join());
  rec('In store button: 5 jobs, 1 over 14 days', /In store 5 \(1 > 14 days\)/.test(C.btn), C.btn);
  rec('In store: oldest first, amber > 14 days, from history when no stamp, date unknown last; vans / shipped / on hold / step 5 out', C.rows.length === 5 && /^WO-K1=.*27 days in store.*#amber$/.test(C.rows[0]) && /^WO-K2=.*8 days in store/.test(C.rows[1]) && !/#amber/.test(C.rows[1]) && /^WO-K7=.*2 days in store/.test(C.rows[2]) && /date unknown/.test(C.rows[3]) && /date unknown/.test(C.rows[4]) && !C.rows.some(r => /^WO-K[4568]=/.test(r)), C.rows.join(' | '));
  rec('In store escapes job text', !C.xss, '');
  rec('⤵ Book: ticks it for delivery (hand-untag cleared), selects it, opens its due week', C.book.delv === true && !C.book.ovr && C.book.sel.join() === 'WO-K7' && C.book.tab === '1' && /In store/.test(C.book.log), JSON.stringify(C.book));
  rec('…then ⤵ Place books it and it leaves In store', C.placed.day === 'Wed' && C.placed.wk === '2026-11-30' && !C.rows2.includes('WO-K7'), JSON.stringify(C.placed) + ' ' + C.rows2);
  rec('board step box: first reaching 7 stamps storeAt; going on to 8 keeps the first stamp', C.hasSel && !!C.s8a && C.s8a === C.s8b, JSON.stringify([C.s8a, C.s8b]));
  rec('import: 6 → 8 stamps, an existing stamp is kept, 3 → 4 not stamped, a new job at 7 stamped', !!C.imp.S9 && C.imp.S1 === '2026-11-01T10:00:00Z' && !C.imp.S10 && !!C.imp.NEW, JSON.stringify(C.imp));
  const sv = (t3.server.row.orders || []).find(o => o.wo === 'WO-K9');
  rec('storeAt saved inside the job', sv && !!sv.storeAt, sv && sv.storeAt);
  rec('no page errors (C)', !(t3.server.errors || []).length, (t3.server.errors || []).join(' | '));
  await t3.close();

  await browser.close();
  console.log('\n' + res.filter(x => x).length + ' passed, ' + res.filter(x => !x).length + ' failed');
})().catch(e => { console.error(e); process.exit(1); });
