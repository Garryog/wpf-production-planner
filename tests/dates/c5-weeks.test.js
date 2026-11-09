// Dates & deliveries (Job A) steps 10–11: week-aware bookings and the Deliveries week tabs.
// Year end (clock Mon 21 Dec 2026: tabs Wk 52 · 53 · 1 · 2 · Later), bank-holiday columns, booking writes the tab's week,
// moving between weeks asks why, next week's Tuesday never on this Tuesday's floor / driver screens, notes kept per date,
// pool grouped by due week (overdue / no date / manual in This week, past +3 = Later, "rebook" first), legacy bookings
// (day, no week) + the one-time This/Next week question, past week with open bookings gets its own tab, 360 px tabs
// scroll sideways, old saved data renders every view. Stubbed Supabase only.  Run: node tests/dates/c5-weeks.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const w = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await H.chromium.launch();
  const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-12-23', origDueDate: '2026-12-23', plannedWeek: '2026-12-21', step: '8. PALLETED', delv: true, customer: 'CAIRN', title: 'House ' + wo }, x));

  // ---------- A. year end, Monday 21 Dec 2026 ----------
  const rowA = { id: 'main', nid: 9, settings: { delx: [{ wo: 'JOB-M1', title: 'Manual drop', customer: 'X', value: 100, manual: true, delVeh: '', delDay: '', delDone: false }] }, orders: [
    O('WO-1'),                                                  // due this week → This week pool
    O('WO-2', { dueDate: '2026-12-01' }),                      // overdue → This week pool
    O('WO-3', { dueDate: '2026-12-30' }),                      // due Wk 53 → Next week pool
    O('WO-4', { dueDate: '2027-01-06' }),                      // Wk 1
    O('WO-5', { dueDate: '2027-01-13' }),                      // Wk 2
    O('WO-6', { dueDate: '2027-02-15' }),                      // Later
    O('WO-7', { dueDate: '2026-12-30', delRebook: { at: '2026-12-20T10:00:00Z', by: 'Ann', why: 'Site not ready', was: 'VOLVO|Tue' } }), // rebook, Wk 53
    O('WO-8', { dueDate: '', origDueDate: '' }),               // no date → This week
    O('WO-9', { delVeh: 'ARTIC', delDay: 'Fri', delWk: '2026-12-14' }), // last week, never closed → past tab + missed
  ] };
  const t = await H.open({ browser, now: '2026-12-21T10:00:00Z', row: rowA });
  const p = t.page;
  const A = await p.evaluate(async () => {
    const out = {};
    showTab('d'); await new Promise(r => setTimeout(r, 150));
    const tabs = () => [...document.querySelectorAll('[data-deltab]')].map(b => b.dataset.deltab + '=' + b.textContent.replace(/\s+/g, ' ').trim());
    out.tabs = tabs();
    out.wk = { tw: thisWk(), w1: wkPlus(thisWk(), 1), w2: wkPlus(thisWk(), 2), w3: wkPlus(thisWk(), 3), n: [0, 1, 2, 3].map(i => wkNum(wkPlus(thisWk(), i))) };
    const poolWos = () => [...document.querySelectorAll('#dpool .dchip')].map(c => c.dataset.dw);
    const go = async t => { document.querySelector('[data-deltab="' + t + '"]').click(); await new Promise(r => setTimeout(r, 120)); };
    out.pool0 = poolWos();
    out.hdr0 = document.getElementById('del-wkh').textContent;
    out.hol0 = [...document.querySelectorAll('.del-grid thead th')].map(th => th.className + ':' + th.textContent.replace(/\s+/g, ' ').trim());
    out.close0 = !!document.getElementById('btn-delreset');
    out.miss0 = (document.querySelector('.pg').textContent.match(/Missed deliveries need a reason — \d+/) || [''])[0];
    await go('1'); out.pool1 = poolWos(); out.grp1 = [...document.querySelectorAll('#dpool .dgrp-h')].map(h => h.textContent.slice(0, 40));
    out.hol1 = [...document.querySelectorAll('.del-grid thead th')].map(th => th.className);
    out.close1 = !!document.getElementById('btn-delreset');
    await go('2'); out.pool2 = poolWos(); out.hdr2 = document.getElementById('del-wkh').textContent;
    await go('3'); out.pool3 = poolWos();
    await go('later'); out.poolL = poolWos(); out.gridL = !!document.querySelector('.del-grid'); out.grpL = [...document.querySelectorAll('#dpool .dgrp-h')].map(h => h.textContent.slice(0, 30));
    await go('-1'); out.pastGrid = [...document.querySelectorAll('.del-grid [data-cell] .dchip')].map(c => c.dataset.dw + '@' + c.closest('[data-cell]').dataset.cell); out.closeP = !!document.getElementById('btn-delreset'); out.poolP = poolWos();
    // book WO-3 on Next week Tue (select, open tab, tap Place)
    await go('1');
    document.querySelector('.dchip[data-dw="WO-3"]').click(); await new Promise(r => setTimeout(r, 60));
    out.selbar = (document.querySelector('.selbar') || {}).textContent || '';
    document.querySelector('[data-place="VOLVO|Tue|2026-12-28"]').click(); await new Promise(r => setTimeout(r, 120));
    document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); // readiness pop-up
    const g = w => DB.orders.find(o => o.wo === w);
    out.b3 = { veh: g('WO-3').delVeh, day: g('WO-3').delDay, wk: g('WO-3').delWk, first: g('WO-3').delFirst, mv: (g('WO-3').delMoves || []).length };
    // book the rebook job WO-7 → flag cleared
    document.querySelector('.dchip[data-dw="WO-7"]').click(); await new Promise(r => setTimeout(r, 60));
    document.querySelector('[data-place="IVECO|Wed|2026-12-28"]').click(); await new Promise(r => setTimeout(r, 120));
    document.querySelectorAll('.pod-ovl').forEach(o => o.remove());
    out.b7 = { wk: g('WO-7').delWk, rb: g('WO-7').delRebook };
    // move WO-3 to This week Tue → asks why (a move between weeks is a move)
    document.querySelector('.dchip[data-dw="WO-3"]').click(); await new Promise(r => setTimeout(r, 60));
    await go('0');
    document.querySelector('[data-place="VOLVO|Tue|2026-12-21"]').click(); await new Promise(r => setTimeout(r, 120));
    const why = document.querySelector('.pod-ovl [data-why="Customer request"]');
    out.asked = !!why; out.askTxt = why ? why.closest('.pod-in').textContent.slice(0, 200) : '';
    if (why) why.click(); await new Promise(r => setTimeout(r, 120));
    document.querySelectorAll('.pod-ovl').forEach(o => o.remove());
    out.m3 = { wk: g('WO-3').delWk, day: g('WO-3').delDay, mv: g('WO-3').delMoves, log: g('WO-3').log.slice(-1)[0] };
    // cancel a week move → nothing changes
    document.querySelector('.dchip[data-dw="WO-3"]').click(); await go('2');
    document.querySelector('[data-place="VOLVO|Mon|2027-01-04"]').click(); await new Promise(r => setTimeout(r, 120));
    const x = document.querySelector('.pod-ovl #pod-x'); if (x) x.click(); await new Promise(r => setTimeout(r, 80));
    out.c3 = { wk: g('WO-3').delWk, day: g('WO-3').delDay, mv: g('WO-3').delMoves.length };
    // notes per date
    await go('0');
    const n0 = document.querySelector('.dnote[data-dnote="2026-12-22"]'); n0.value = 'Tue this week'; n0.dispatchEvent(new Event('input'));
    await go('1');
    out.n1before = document.querySelector('.dnote[data-dnote="2026-12-29"]').value;
    const n1 = document.querySelector('.dnote[data-dnote="2026-12-29"]'); n1.value = 'Tue next week'; n1.dispatchEvent(new Event('input'));
    await go('0'); out.n0after = document.querySelector('.dnote[data-dnote="2026-12-22"]').value;
    out.notes = JSON.parse(JSON.stringify(DB.delNotes));
    out.dayVal = [dayVal('Tue', '2026-12-21'), dayVal('Tue', '2026-12-28'), dayVal('Wed', '2026-12-28')];
    await new Promise(r => setTimeout(r, 1700)); // save
    return out;
  });
  rec('year end: tabs This week Wk 52 · Next week Wk 53 · Wk 1 · Wk 2 · Later (+ a past Wk 51 tab with an open booking)',
    A.wk.n.join() === '52,53,1,2' && A.tabs.some(x => /^-1=Wk 51 \(past\)/.test(x)) && A.tabs.some(x => /^0=This week · Wk 52/.test(x)) && A.tabs.some(x => /^1=Next week · Wk 53/.test(x)) && A.tabs.some(x => /^2=Wk 1/.test(x)) && A.tabs.some(x => /^3=Wk 2/.test(x)) && A.tabs.some(x => /^later=Later/.test(x)), A.tabs.join(' | '));
  rec('week keys: 21 Dec, 28 Dec, 4 Jan 2027, 11 Jan 2027', A.wk.tw === '2026-12-21' && A.wk.w1 === '2026-12-28' && A.wk.w2 === '2027-01-04' && A.wk.w3 === '2027-01-11', JSON.stringify(A.wk));
  rec('This week pool = due this week + overdue + no date + manual (not next week / later)', ['WO-1', 'WO-2', 'WO-8', 'JOB-M1'].every(x => A.pool0.includes(x)) && !['WO-3', 'WO-4', 'WO-6', 'WO-7'].some(x => A.pool0.includes(x)), A.pool0.join());
  rec('Next week pool = due Wk 53, "rebook" group first', A.pool1.join() === 'WO-7,WO-3' && /rebook/i.test(A.grp1[0]), A.pool1.join() + ' / ' + A.grp1.join(' | '));
  rec('Wk 1 / Wk 2 pools by due week; header shows Wk 1 · Mon 4 Jan', A.pool2.join() === 'WO-4' && A.pool3.join() === 'WO-5' && /Wk 1 · Mon 4 Jan/.test(A.hdr2), A.pool2 + ' / ' + A.pool3 + ' / ' + A.hdr2);
  rec('Later tab = pool only (no van grid), grouped by week', A.poolL.join() === 'WO-6' && !A.gridL && /Wk 7/.test(A.grpL[0] || ''), A.poolL + ' / ' + A.grpL);
  rec('bank-holiday columns shaded: Fri 25 Dec (Wk 52), Mon 28 Dec (Wk 53)', /hol:Fri 25 Dec/.test(A.hol0.join('|')) && !/hol:Thu/.test(A.hol0.join('|')) && A.hol1[1] === 'hol', A.hol0.join(' | '));
  rec('past week with an open booking: own tab, its grid shows the booking; Close only on This week / past', A.pastGrid.join() === 'WO-9@ARTIC|Fri|2026-12-14' && A.closeP && A.close0 && !A.close1 && A.poolP.length === 0, JSON.stringify([A.pastGrid, A.closeP, A.close0, A.close1]));
  rec('missed: last week\'s open booking counts (date gone)', /— 1$/.test(A.miss0), A.miss0);
  rec('selection bar shows "📅 Move dates (1)"', /Move dates \(1\)/.test(A.selbar), A.selbar);
  rec('booking on the Next week tab writes delWk 28 Dec + Tue, first placement stamped, no move', A.b3.veh === 'VOLVO' && A.b3.day === 'Tue' && A.b3.wk === '2026-12-28' && A.b3.mv === 0 && /2026-12-28/.test(A.b3.first), JSON.stringify(A.b3));
  rec('booking a "rebook" job clears the flag', A.b7.wk === '2026-12-28' && !A.b7.rb, JSON.stringify(A.b7));
  rec('moving between weeks asks why; recorded with the week', A.asked && A.m3.wk === '2026-12-21' && A.m3.day === 'Tue' && A.m3.mv.length === 1 && A.m3.mv[0].why === 'Customer request' && A.m3.mv[0].from === 'VOLVO|Tue|2026-12-28' && /29 Dec.*22 Dec/.test(A.m3.log.what), JSON.stringify(A.m3).slice(0, 300));
  rec('cancelling a week move changes nothing', A.c3.wk === '2026-12-21' && A.c3.day === 'Tue' && A.c3.mv === 1, JSON.stringify(A.c3));
  rec('notes kept per date: next week\'s Tuesday note box starts empty; both kept', A.n1before === '' && A.n0after === 'Tue this week' && A.notes['2026-12-22'] === 'Tue this week' && A.notes['2026-12-29'] === 'Tue next week', JSON.stringify(A.notes));
  rec('dayVal(day, week) counts one week only', A.dayVal[0] === 4000 && A.dayVal[1] === 0 && A.dayVal[2] === 4000, JSON.stringify(A.dayVal));
  const saved = (t.server.row.orders || []).find(o => o.wo === 'WO-3');
  rec('booking week saved to the database (inside orders, no new top-level key)', saved && saved.delWk === '2026-12-21' && t.server.patches.length > 0 && t.server.patches.every(b => Object.keys(b).every(k => ['orders', 'settings', 'nid'].includes(k))), saved && saved.delWk + ' keys ' + [...new Set(t.server.patches.flatMap(b => Object.keys(b)))].join());
  rec('no page errors (A)', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
  await t.close();

  // ---------- B. Tuesday 22 Dec: next week's Tuesday booking is NOT on this Tuesday's floor / driver screens ----------
  const rowB = { id: 'main', nid: 9, settings: {}, orders: [
    O('WO-THIS', { delVeh: 'VOLVO', delDay: 'Tue', delWk: '2026-12-21' }),
    O('WO-NEXT', { delVeh: 'VOLVO', delDay: 'Tue', delWk: '2026-12-28' }),
    O('WO-WED', { delVeh: 'VOLVO', delDay: 'Wed', delWk: '2026-12-21' }),
    O('WO-MONX', { delVeh: 'VOLVO', delDay: 'Mon', delWk: '2026-12-21', delDelivAt: '2026-12-21T15:00:00Z', delDone: true }),
  ] };
  const t2 = await H.open({ browser, now: '2026-12-22T09:00:00Z', row: rowB });
  const B = await t2.page.evaluate(async () => {
    const view = (role, f) => { ROLE = role; ls.set('wpfPin_' + role, '9000'); if (f) f(); render(); return document.getElementById('app').textContent; };
    const out = {};
    out.floor = view('floor');
    out.drv = view('driver', () => { ls.set('wpfDrvName', 'Dan'); ls.set('wpfDrvVeh', 'VOLVO'); ls.set('wpfDrvDay', ''); });
    out.drvOpts = [...document.querySelectorAll('#drv-day option')].map(o => o.value + '=' + o.textContent);
    out.drvNext = view('driver', () => ls.set('wpfDrvDay', 'Tue|2026-12-28'));
    out.drvOld = view('driver', () => ls.set('wpfDrvDay', 'Tue')); // stored by the old version: this week
    out.drvStale = view('driver', () => ls.set('wpfDrvDay', 'Wed|2026-12-14')); // a week gone → today
    out.prod = view('prod'); out.dash = view('dash'); out.pm = view('pm');
    out.pk = podKey('VOLVO', 'Tue', '2026-12-28');
    ROLE = 'office'; render();
    return out;
  });
  rec('floor: today Tue 22 Dec shows this week\'s Tuesday job, not next week\'s', /WO-THIS/.test(B.floor) && !/WO-NEXT/.test(B.floor) && /Tue 22 Dec/.test(B.floor) && /Wed 23 Dec/.test(B.floor) && /WO-WED/.test(B.floor), B.floor.slice(0, 300));
  rec('driver run (default today): this Tuesday only; day list has dates, this + next week', /WO-THIS/.test(B.drv) && !/WO-NEXT/.test(B.drv) && B.drvOpts.includes('Tue|2026-12-28=Tue 29 Dec (next week)') && B.drvOpts.includes('Tue|2026-12-21=Tue 22 Dec'), B.drvOpts.slice(0, 8).join(' | '));
  rec('driver picks next week\'s Tuesday: that run only', /WO-NEXT/.test(B.drvNext) && !/WO-THIS/.test(B.drvNext), B.drvNext.slice(0, 200));
  rec('driver: an old stored plain "Tue" = this week; a day from a week gone falls back to today', /WO-THIS/.test(B.drvOld) && !/WO-NEXT/.test(B.drvOld) && /WO-THIS/.test(B.drvStale), '');
  rec('proof-photo key carries the booking week', B.pk === 'VOLVO|Tue|2026-12-28', B.pk);
  rec('Production: next week\'s Tuesday is not "at risk today/tomorrow"', !/WO-NEXT/.test(B.prod.split('LATER THIS WEEK')[0]) && /WO-THIS/.test(B.prod), '');
  rec('PM view: scheduled list shows dates incl. next week (Wk 53)', /Volvo Tue 29 Dec \(Wk 53\)/.test(B.pm) && /Volvo Tue 22 Dec/.test(B.pm), B.pm.slice(0, 300));
  rec('dashboard: missed = only the dates gone (none yet, Monday delivered)', /None — every planned delivery is on time/.test(B.dash), '');
  rec('no page errors (B)', !(t2.server.errors || []).length, (t2.server.errors || []).join(' | '));
  await t2.close();

  // ---------- C. legacy bookings (day, no week) + the one-time question; old notes keyed by day name ----------
  const rowC = { id: 'main', nid: 9, settings: { delNotes: { Wed: 'old <b>note</b>' } }, orders: [
    O('WO-L1', { delVeh: 'VOLVO', delDay: 'Wed' }), O('WO-L2', { delVeh: 'ARTIC', delDay: 'Mon' }), O('WO-N', { delVeh: 'IVECO', delDay: 'Thu', delWk: '2026-11-16' })
  ] };
  const t3 = await H.open({ browser, now: '2026-11-16T10:00:00Z', row: rowC });
  const C = await t3.page.evaluate(async () => {
    const out = {};
    showTab('d'); await new Promise(r => setTimeout(r, 150));
    out.prompt = (document.getElementById('del-legacy') || {}).textContent || '';
    out.grid0 = [...document.querySelectorAll('.del-grid [data-cell] .dchip')].map(c => c.dataset.dw).sort();
    out.note0 = document.querySelector('.dnote[data-dnote="2026-11-18"]').value;
    out.noteEsc = document.querySelector('.dnote[data-dnote="2026-11-18"]').outerHTML.includes('<b>');
    out.slot = slotLblO(DB.orders[0]);
    document.querySelector('[data-legwk="1"]').click(); await new Promise(r => setTimeout(r, 150));
    out.legWk = DB.delLegacyWk; out.notes = JSON.parse(JSON.stringify(DB.delNotes));
    out.promptAfter = !!document.getElementById('del-legacy');
    out.grid0b = [...document.querySelectorAll('.del-grid [data-cell] .dchip')].map(c => c.dataset.dw).sort();
    document.querySelector('[data-deltab="1"]').click(); await new Promise(r => setTimeout(r, 100));
    out.grid1 = [...document.querySelectorAll('.del-grid [data-cell] .dchip')].map(c => c.dataset.dw).sort();
    out.note1 = document.querySelector('.dnote[data-dnote="2026-11-25"]').value;
    await new Promise(r => setTimeout(r, 1700));
    return out;
  });
  rec('legacy question shows the count; until answered they show under This week', /2 bookings from before the week tabs/.test(C.prompt) && C.grid0.join() === 'WO-L1,WO-L2,WO-N', C.prompt.slice(0, 90) + ' / ' + C.grid0);
  rec('old day-name note shows on this week\'s Wednesday (escaped in the box)', C.note0 === 'old <b>note</b>' && !C.noteEsc, C.note0);
  rec('"Next week": delLegacyWk = Mon 23 Nov, note moved to its date, question gone', C.legWk === '2026-11-23' && C.notes['2026-11-25'] === 'old <b>note</b>' && C.notes.Wed === undefined && !C.promptAfter, JSON.stringify([C.legWk, C.notes]));
  rec('…and the legacy bookings now show on the Next week tab only', C.grid0b.join() === 'WO-N' && C.grid1.join() === 'WO-L1,WO-L2' && C.note1 === 'old <b>note</b>', C.grid0b + ' / ' + C.grid1);
  rec('delLegacyWk saved in settings', t3.server.row.settings && t3.server.row.settings.delLegacyWk === '2026-11-23', JSON.stringify((t3.server.row.settings || {}).delLegacyWk));
  rec('no page errors (C)', !(t3.server.errors || []).length, (t3.server.errors || []).join(' | '));
  await t3.close();

  // ---------- D. 360 px phone: the tab strip scrolls sideways ----------
  const t4 = await H.open({ browser, now: '2026-12-21T10:00:00Z', row: rowA, viewport: { width: 360, height: 740 } });
  const D = await t4.page.evaluate(async () => { showTab('d'); await new Promise(r => setTimeout(r, 150)); const s = document.getElementById('del-tabs'); const cs = getComputedStyle(s);
    return { ox: cs.overflowX, sw: s.scrollWidth, cw: s.clientWidth, wrap: cs.flexWrap, h: s.getBoundingClientRect().height, btnH: document.querySelector('.del-tab').getBoundingClientRect().height }; });
  rec('360 px: week tabs are one sideways-scrolling strip (not wrapped), buttons ≥ 36 px', D.ox === 'auto' && D.sw > D.cw && D.wrap === 'nowrap' && D.h < 70 && D.btnH >= 36, JSON.stringify(D));
  await t4.close();

  await browser.close();
  console.log('\n' + res.filter(x => x).length + ' passed, ' + res.filter(x => !x).length + ' failed');
})().catch(e => { console.error(e); process.exit(1); });
