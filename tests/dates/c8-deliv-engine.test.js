// Dates & deliveries phase 2, step 19: the delivery date in the Change-dates dialog and the date engine.
// Dialog: typing a delivery date suggests build = delivery − 3 working days (editable), preview shows both; engine writes
// delivDate / delivKeep / origDelivDate / history; "build after delivery" flag; A4 — with a delivery date the van follows
// the DELIVERY date (a build-only move leaves the booking, a delivery move takes it off to rebook); group "+1 week" moves
// delivery dates too; Dates to change in Cienapps lists Due (E) and Delivery (L) rows; the pool groups a job by its
// delivery week. Clock Tue 10 Nov 2026. Stubbed Supabase only.  Run: node tests/dates/c8-deliv-engine.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const w = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await H.chromium.launch();
  const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-20', origDueDate: '2026-11-20', plannedWeek: '2026-11-16', step: '3. In production', customer: 'CAIRN', title: 'House ' + wo }, x));
  const row = { id: 'main', nid: 9, settings: {}, orders: [
    O('WO-1', { delivDate: '2026-11-25', origDelivDate: '2026-11-25' }),
    O('WO-2', { delv: true, delVeh: 'VOLVO', delDay: 'Wed', delWk: '2026-11-23', delivDate: '2026-11-25' }),   // booked on its delivery day
    O('WO-3', { delv: true, delVeh: 'VOLVO', delDay: 'Wed', delWk: '2026-11-23', delivDate: '2026-11-25' }),
    O('WO-4', { delv: true, delVeh: 'IVECO', delDay: 'Thu', delWk: '2026-11-16' }),                            // no delivery date: due rule as before
    O('WO-5', { delivDate: '2026-11-27' }), O('WO-6', { delivDate: '2026-11-27' }),
    O('WO-7', { delv: true, step: '8. PALLETED', dueDate: '2026-11-13', delivDate: '2026-12-09' }),              // pool: delivery Wk 50
  ] };
  const t = await H.open({ browser, now: '2026-11-10T10:00:00Z', row });
  const p = t.page;
  await p.evaluate(() => showTab('b')); await w(200);
  await p.click('[data-duedlg="WO-1"]'); await w(150);
  const has = await p.evaluate(() => !!document.getElementById('dm-deliv') && document.getElementById('dm-deliv').value);
  rec('dialog has a Delivery date box with the job\'s date', has === '2026-11-25', String(has));
  await p.fill('#dm-deliv', '2026-12-04'); await w(80);
  const sug = await p.evaluate(() => ({ due: document.getElementById('dm-date').value, s: document.getElementById('dm-sug').textContent, prev: document.getElementById('dm-prev').innerText }));
  rec('delivery Fri 4 Dec suggests build Tue 1 Dec (3 working days before), editable', sug.due === '2026-12-01' && /3 working days before delivery/.test(sug.s) && /delivery 25 Nov 26 → 4 Dec 26/.test(sug.prev), JSON.stringify(sug));
  await p.fill('#dm-date', '2026-12-07'); await w(80);
  const aft = await p.evaluate(() => document.getElementById('dm-prev').innerText);
  rec('build after delivery is flagged in the preview', /build date is after the delivery date/.test(aft), aft.replace(/\n/g, ' ').slice(0, 200));
  await p.fill('#dm-date', '2026-11-30'); await p.click('[data-dmwhy="Customer delay"]'); await w(50); await p.click('#dm-ok'); await w(200);
  const a = await p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-1'); return { due: o.dueDate, dl: o.delivDate, dk: o.delivKeep, keep: o.dueKeep, od: o.origDelivDate, h: o.dueHist.map(x => x.f + ':' + x.from + '>' + x.to) }; });
  rec('one Move: due and delivery both written, both kept for Cienapps, two history lines', a.due === '2026-11-30' && a.dl === '2026-12-04' && a.dk === '2026-11-25' && a.keep === '2026-11-20' && a.od === '2026-11-25' && a.h.join() === 'due:2026-11-20>2026-11-30,deliv:2026-11-25>2026-12-04', JSON.stringify(a));
  const E = await p.evaluate(() => {
    const g = w => DB.orders.find(o => o.wo === w), out = {};
    moveDates(['WO-2'], { due: '2026-11-19' }, { why: 'Production' }, 'Ann').apply();
    out.b2 = { due: g('WO-2').dueDate, day: g('WO-2').delDay, wk: g('WO-2').delWk, rb: !!g('WO-2').delRebook };
    moveDates(['WO-3'], { deliv: '2026-12-02' }, { why: 'Site not ready' }, 'Ann').apply();
    out.b3 = { due: g('WO-3').dueDate, dl: g('WO-3').delivDate, day: g('WO-3').delDay, rb: g('WO-3').delRebook && g('WO-3').delRebook.why, mv: (g('WO-3').delMoves || []).map(m => m.why) };
    moveDates(['WO-4'], { due: '2026-11-24' }, { why: 'Production' }, 'Ann').apply();
    out.b4 = { day: g('WO-4').delDay, rb: !!g('WO-4').delRebook };
    moveDates(['WO-5', 'WO-6'], { shift: { n: 1, unit: 'wk' } }, { why: 'Materials' }, 'Ann', { src: 'group' }).apply();
    out.g = ['WO-5', 'WO-6'].map(w => g(w).dueDate + '/' + g(w).delivDate);
    out.rows = datesToCienRows().map(d => d.o.wo + ':' + d.f + ':' + (d.has || '-') + '>' + d.to);
    out.jobs = datesToCien().map(o => o.wo);
    out.dlOnly = moveDates(['WO-6'], { deliv: '2026-12-11' }, { why: 'x' }, 'x').rows[0];
    return out;
  });
  rec('A4 with a delivery date: a build-only move leaves the van booking alone', E.b2.due === '2026-11-19' && E.b2.day === 'Wed' && E.b2.wk === '2026-11-23' && !E.b2.rb, JSON.stringify(E.b2));
  rec('A4 with a delivery date: a delivery move takes it off the van to rebook ("Delivery date moved")', E.b3.dl === '2026-12-02' && E.b3.due === '2026-11-20' && E.b3.day === '' && E.b3.rb === 'Site not ready' && /Delivery date moved/.test(E.b3.mv[0]), JSON.stringify(E.b3));
  rec('no delivery date: the due date still drives the van (as before)', E.b4.day === '' && E.b4.rb, JSON.stringify(E.b4));
  rec('group "+1 week" moves the delivery dates too', E.g.join() === '2026-11-27/2026-12-04,2026-11-27/2026-12-04', E.g.join());
  rec('Dates to change in Cienapps: a Due row and a Delivery row (none → new)', E.rows.includes('WO-1:due:2026-11-20>2026-11-30') && E.rows.includes('WO-1:deliv:2026-11-25>2026-12-04') && E.rows.includes('WO-5:deliv:2026-11-27>2026-12-04') && E.jobs.filter(x => x === 'WO-1').length === 1, E.rows.join(' | '));
  rec('delivery-only change preview: due unchanged, not skipped', !E.dlOnly.skipped && !E.dlOnly.dueCh && E.dlOnly.dTo === '2026-12-11', JSON.stringify(E.dlOnly));
  // Export Changes screen + Dates sheet
  const X = await p.evaluate(() => { showTab('x'); const txt = (document.getElementById('exp-dates') || {}).innerText || ''; let sh; const o = XLSX.writeFile; XLSX.writeFile = wb => { sh = XLSX.utils.sheet_to_json(wb.Sheets.Dates, { header: 1 }); }; document.getElementById('btn-xchg').click(); XLSX.writeFile = o; return { txt, hdr: sh && sh[0], n: sh ? sh.length - 1 : 0, last: sh && sh.slice(1).map(r => r[0] + ':' + r[12]) }; });
  rec('Export Changes shows Due (E) / Delivery (L) rows; Dates sheet has "Which Date" at the end', /Delivery \(L\)/.test(X.txt) && /Due \(E\)/.test(X.txt) && X.hdr && X.hdr[12] === 'Which Date' && X.last.includes('WO-1:Delivery date (L)'), JSON.stringify([X.hdr, X.last]));
  // pool by delivery week
  const P = await p.evaluate(async () => { showTab('d'); await new Promise(r => setTimeout(r, 120)); const pool = t => { document.querySelector('[data-deltab="' + t + '"]').click(); return [...document.querySelectorAll('#dpool .dchip')].map(c => c.dataset.dw); };
    const out = { p0: pool('0'), p4: pool('later') }; out.chip = (document.querySelector('.dchip[data-dw="WO-7"] .dchip-due') || {}).textContent; return out; });
  rec('pool groups by the delivery week (due Wk 46 but delivery Wk 50 → Later, not This week)', !P.p0.includes('WO-7') && P.p4.includes('WO-7') && /deliv 9 Dec/.test(P.chip || ''), JSON.stringify(P));
  rec('no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
  await t.close();
  await browser.close();
  console.log('\n' + res.filter(x => x).length + ' passed, ' + res.filter(x => !x).length + ' failed');
})().catch(e => { console.error(e); process.exit(1); });
