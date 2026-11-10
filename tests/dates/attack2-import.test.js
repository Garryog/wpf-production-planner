// Tester attack 2 — Cienapps column L (delivery date) through the real import (.xlsx via doImport).
// Headers: trailing spaces / caps / "Install Date" map; "Delivery" alone, "Delivery Address", "Delivery Day" must NOT.
// Values: dd/mm text, d/m/yyyy, Excel serial, blank (existing kept), unreadable ("TBC", 31/02) flagged + kept.
// Third delivery date from Cienapps after a planner move; Cienapps back on the planner's date; build after delivery
// flag; booked job whose delivery date Cienapps moves (not pulled — ASSUMED — but must stay visible); new job with L.
// Clock Tue 10 Nov 2026. Stubbed Supabase only.  Run: node tests/dates/attack2-import.test.js
const { H, recorder, w, XD } = require('./attack1-lib');
const { rec, done } = recorder('attack2-import');
(async () => {
  const browser = await H.chromium.launch();
  const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-12-10', origDueDate: '2026-12-10', plannedWeek: '2026-12-07', step: '3. In production', customer: 'CAIRN', title: 'House ' + wo, value: 4000, hours: 5, hoursSrc: 'hand' }, x));
  const row = { id: 'main', nid: 50, settings: { listChk: false }, orders: [
    O('WO-1'), O('WO-2'), O('WO-3', { delivDate: '2026-12-15' }), O('WO-4', { delivDate: '2026-12-15' }), O('WO-5', { delivDate: '2026-12-15' }), O('WO-6'),
    O('WO-7'),
    O('WO-8', { delivDate: '2026-12-15' }), O('WO-9', { delivDate: '2026-12-15' }),
    O('WO-10', { step: '8. PALLETED', delv: true, delVeh: 'VOLVO', delDay: 'Thu', delWk: '2026-11-16', delivDate: '2026-11-19', dueDate: '2026-11-17', plannedWeek: '2026-11-16' }),
  ] };
  const t = await H.open({ browser, now: '2026-11-10T10:00:00Z', row });
  const p = t.page;
  const get = wos => p.evaluate(wos => wos.map(w => { const o = DB.orders.find(x => x.wo === w); return o ? { wo: w, due: o.dueDate, deliv: o.delivDate || '', keep: o.delivKeep || '', orig: o.origDelivDate || '', day: o.delDay || '', rb: !!o.delRebook, hist: (o.dueHist || []).filter(h => h.f === 'deliv').length } : { wo: w, missing: true }; }), wos);
  const apply = () => p.evaluate(async () => { await document.getElementById('imp-apply').onclick(); await new Promise(r => setTimeout(r, 250)); clearTimeout(saveT); await saveDB(); });

  // header mapping only
  // the header path doImport takes for a file with a header row: findHeaderRow + mapFromHeader
  const mapOf = hdr => p.evaluate(hdr => findHeaderRow([hdr, ['WO-1']]) === 0 ? mapFromHeader(hdr) : null, hdr);
  const base = ['WO # ', 'Title', 'Customer', 'Due Date', 'Step', 'Sub-Total'];
  const maps = {};
  for (const h of ['Delivery Date  ', 'DELIVERY DATE', 'Install Date', 'Delivery / Install Date', 'Delivery', 'Delivery Address', 'Delivery Day', 'Deliv Date']) maps[h] = await mapOf(base.concat([h]));
  const L = h => maps[h] ? maps[h].delivDate : 'no map';
  rec('column L: "Delivery Date  " (trailing spaces), "DELIVERY DATE", "Install Date", "Delivery / Install Date" map to the delivery date', [L('Delivery Date  '), L('DELIVERY DATE'), L('Install Date'), L('Delivery / Install Date')].every(x => x === 6), JSON.stringify(Object.fromEntries(Object.keys(maps).map(k => [k, L(k)]))));
  rec('column L: "Delivery" alone, "Delivery Address", "Delivery Day" never map to the delivery date', [L('Delivery'), L('Delivery Address'), L('Delivery Day')].every(x => x === -1 || x === undefined || x === 'no map'), JSON.stringify([L('Delivery'), L('Delivery Address'), L('Delivery Day')]));
  rec('column L present: Due Date still maps to column E (index 3), not L', maps['Delivery Date  '] && maps['Delivery Date  '].dueDate === 3, JSON.stringify(maps['Delivery Date  ']));

  // planner moves WO-8's and WO-9's delivery date first (delivKeep = 15 Dec)
  await p.evaluate(() => { moveDates(['WO-8'], { deliv: '2026-12-18' }, { why: 'Site not ready' }, 'Ann').apply(); moveDates(['WO-9'], { deliv: '2026-12-18' }, { why: 'Site not ready' }, 'Ann').apply(); });
  const HDR = base.concat(['Delivery Date ']);
  const R = (wo, l, due = '2026-12-10') => [wo, 'House ' + wo, 'CAIRN', XD(due), '3. In production', 4000, l];
  const f1 = [HDR, R('WO-1', '17/12/2026'), R('WO-2', XD('2026-12-18')), R('WO-3', ''), R('WO-4', 'TBC'), R('WO-5', '31/02/2027'), R('WO-6', '12/1/2027'),
    R('WO-7', '04/12/2026'),   // delivery before the build date (10 Dec)
    R('WO-8', '22/12/2026'),   // third date (planner had moved it to 18 Dec, Cienapps had 15 Dec)
    R('WO-9', '18/12/2026'),   // Cienapps now has the planner's date
    [...R('WO-10', '03/12/2026', '2026-11-17').slice(0, 4), '8. PALLETED', 4000, '03/12/2026'],   // booked Thu 19 Nov; Cienapps delivery → 3 Dec
    ['WO-9001', 'House new', 'CAIRN', XD('2026-12-20'), '3. In production', 4000, '15/12/2026']]; // new job, build after delivery
  const r1 = await H.importAoa(p, f1);
  const prev = r1.iprev.replace(/\s+/g, ' ');
  rec('preview flags the unreadable delivery dates (TBC, 31/02/2027) and keeps the existing date', /TBC/.test(prev) && /31\/02\/2027/.test(prev), prev.slice(0, 600));
  rec('preview flags "build date … after the delivery date" for WO-7 and the new job', /WO-7[^]*after the delivery date|after the delivery date[^]*WO-7/.test(prev) || (prev.match(/after the delivery date/g) || []).length >= 2, (prev.match(/[^.]{0,80}after the delivery date[^.]{0,40}/g) || []).join(' | '));
  rec('preview tells the user Cienapps sent a third delivery date for WO-8 (planner date kept)', /22 Dec/.test(prev) && /kept/.test(prev), (prev.match(/[^.]{0,60}22 Dec[^.]{0,80}/) || [''])[0]);
  await apply();
  let a = await get(['WO-1', 'WO-2', 'WO-3', 'WO-4', 'WO-5', 'WO-6', 'WO-7', 'WO-8', 'WO-9', 'WO-10', 'WO-9001']);
  const G = Object.fromEntries(a.map(x => [x.wo, x]));
  rec('dd/mm text 17/12/2026 → 17 Dec; Excel serial → 18 Dec; 12/1/2027 → 12 Jan (day first)', G['WO-1'].deliv === '2026-12-17' && G['WO-2'].deliv === '2026-12-18' && G['WO-6'].deliv === '2027-01-12', JSON.stringify([G['WO-1'], G['WO-2'], G['WO-6']]));
  rec('blank / TBC / 31-02 leave the existing delivery date (15 Dec)', G['WO-3'].deliv === '2026-12-15' && G['WO-4'].deliv === '2026-12-15' && G['WO-5'].deliv === '2026-12-15', JSON.stringify([G['WO-3'], G['WO-4'], G['WO-5']]));
  rec('first delivery date from Cienapps: no history entry, no delivKeep', G['WO-1'].hist === 0 && !G['WO-1'].keep, JSON.stringify(G['WO-1']));
  rec('third delivery date: planner\'s 18 Dec kept', G['WO-8'].deliv === '2026-12-18', JSON.stringify(G['WO-8']));
  const dl = await p.evaluate(() => datesToCienRows().filter(r => r.f === 'deliv').map(r => r.o.wo + ':has=' + r.has + ':to=' + r.to));
  rec('third delivery date: "Dates to change in Cienapps" says Cienapps HAS 22 Dec now (not the old 15 Dec)', dl.includes('WO-8:has=2026-12-22:to=2026-12-18'), JSON.stringify(dl) + ' — the list still tells the office Cienapps has 15 Dec');
  rec('Cienapps back on the planner date (WO-9): delivKeep cleared, off the Dates list', !G['WO-9'].keep && !dl.some(x => x.startsWith('WO-9')), JSON.stringify(G['WO-9']));
  rec('WO-10 (booked Thu 19 Nov): Cienapps moved delivery to 3 Dec — stays on the van (ASSUMED), history kept', G['WO-10'].deliv === '2026-12-03' && G['WO-10'].day === 'Thu' && G['WO-10'].hist === 1, JSON.stringify(G['WO-10']));
  const card = await p.evaluate(async () => { showTab('d'); await new Promise(r => setTimeout(r, 150)); document.querySelector('[data-deltab="1"]').click(); await new Promise(r => setTimeout(r, 120)); const c = document.querySelector('.dchip[data-dw="WO-10"]'); return c ? c.innerText.replace(/\s+/g, ' ') : 'NO CARD'; });
  rec('WO-10\'s van card warns that it is booked Thu 19 Nov but the delivery date is now 3 Dec', /check|moved|⚠|not the delivery|differs/i.test(card), card + ' — only "deliv 3 Dec 26" in small print; the import flag is gone after Apply');
  rec('new job with column L: delivery date + original delivery date stored', G['WO-9001'].deliv === '2026-12-15' && G['WO-9001'].orig === '2026-12-15', JSON.stringify(G['WO-9001']));
  // same file again: nothing changes, no extra history
  await H.importAoa(p, f1); await apply();
  const b = await get(['WO-8', 'WO-10']);
  rec('same file twice: no extra delivery history', b[0].hist === 1 && b[1].hist === 1, JSON.stringify(b));
  rec('no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
  await t.close(); await browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
