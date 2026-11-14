// Dates & deliveries (Job A): A6 + A7. A planner date move is listed in Export Changes "Dates to change in Cienapps"
// and the Changes Excel "Dates" sheet; Mark as applied leaves it. A re-import still carrying the OLD Cienapps date keeps
// the planner date (counted in the preview); an import with the planner date clears it; a THIRD date starts on Keep;
// Take goes through the date engine (history, off the van, week untouched). Saw card shows "has moved" for a day.
// Real .xlsx through doImport, stubbed Supabase only.  Run: node tests/dates/c3-export-import.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const w = ms => new Promise(r => setTimeout(r, ms));
const XD = iso => (Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 86400000;
(async () => {
  const browser = await H.chromium.launch();
  const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-20', origDueDate: '2026-11-20', plannedWeek: '2026-11-16', step: '3. In production', customer: 'CAIRN', title: 'House ' + wo, floor: 'F1', unit: 'U' + wo.slice(-1), value: 4000, hours: 5, hoursSrc: 'hand' }, x));
  const lists = [{ id: 'L3', wb: 'W1', sheet: 'H3', name: 'House 3', project: 'Proj', saw: 1, fit: 0, noFit: true, wos: ['WO-3'], up: '2026-11-09T09:00:00Z' }];
  const sheets = { H3: [{ k: 'saw', item: 'Side', qty: 2, L: 2400, W: 600, mat: 'MFC White', note: '' }] };
  const row = { id: 'main', nid: 5, settings: { listChk: false, lists, listWBs: { W1: { project: 'Proj', sheets } } }, orders: [
    O('WO-1'), O('WO-2'), O('WO-3', { delv: true, delVeh: 'VOLVO', delDay: 'Thu' }), O('WO-4')] };
  const t = await H.open({ browser, now: '2026-11-10T10:00:00Z', row });
  const p = t.page;
  await p.evaluate(async () => {
    moveDates(['WO-1'], { due: '2026-11-27' }, { why: 'Customer delay', note: 'flooring late' }, 'Ann').apply();
    moveDates(['WO-2'], { due: '2026-11-27' }, { why: 'Site not ready' }, 'Ann').apply();
    XLSX.writeFile = (wb, name) => { window.__wb = { names: wb.SheetNames, dates: XLSX.utils.sheet_to_json(wb.Sheets.Dates, { header: 1 }), name }; };
    showTab('x');
  });
  await w(150);
  const ex = await p.evaluate(() => (document.getElementById('exp-dates') || {}).innerText || '');
  rec('Export Changes lists the moved dates (Cienapps has → change to, why, by)', /WO-1/.test(ex) && /WO-2/.test(ex) && /20 Nov 26/.test(ex) && /27 Nov 26/.test(ex) && /Customer delay — flooring late/.test(ex) && /Ann/.test(ex) && !/WO-4/.test(ex), ex.replace(/\n/g, ' ').slice(0, 300));
  await p.click('#btn-xchg2'); await w(100);
  const wb = await p.evaluate(() => window.__wb);
  rec('Changes Excel has a "Dates" sheet with both jobs', wb && wb.names.includes('Dates') && wb.names.includes('Changes') && wb.dates.length === 3 && wb.dates[1][0] === 'WO-1' && wb.dates[1][5] === '2026-11-20' && wb.dates[1][6] === '2026-11-27', JSON.stringify(wb && wb.dates));
  await p.click('#btn-mark'); await w(150);
  const ex2 = await p.evaluate(() => datesToCien().map(o => o.wo));
  rec('"Mark as applied" leaves the date rows', JSON.stringify(ex2) === '["WO-1","WO-2"]', JSON.stringify(ex2));
  await p.evaluate(async () => { clearTimeout(saveT); await saveDB(); });
  // re-import: WO-1 Cienapps still old date; WO-2 a third date; WO-3 new date (Take); WO-4 unchanged
  const HDR = ['WO # ', 'Title ', 'Customer ', 'Due Date ', 'Step ', 'Sub-Total '];
  const aoa = [HDR, ['WO-1', 'House WO-1', 'CAIRN', XD('2026-11-20'), '3. In production', 4000], ['WO-2', 'House WO-2', 'CAIRN', XD('2026-12-04'), '3. In production', 4000],
    ['WO-3', 'House WO-3', 'CAIRN', XD('2026-11-25'), '3. In production', 4000], ['WO-4', 'House WO-4', 'CAIRN', XD('2026-11-20'), '3. In production', 4000]];
  const r = await H.importAoa(p, aoa);
  rec('preview counts "Cienapps still has the old due date"', r.plan && JSON.stringify(r.plan.oldDates) === '["WO-1"]' && /1 job: Cienapps still has the old due date/.test(r.iprev), r.plan && JSON.stringify(r.plan.oldDates));
  const radios = await p.evaluate(() => { const o = {}; document.querySelectorAll('[data-dk]').forEach(x => { if (x.checked) o[x.dataset.dk] = x.value; }); return o; });
  rec('third date (planner moved it) starts on Keep; a plain Cienapps change starts on Take', radios['WO-2'] === 'keep' && radios['WO-3'] === 'take' && !('WO-1' in radios), JSON.stringify(radios));
  await p.evaluate(async () => { await document.getElementById('imp-apply').onclick(); });
  await w(200);
  const a = await p.evaluate(() => { const g = w => DB.orders.find(o => o.wo === w); return ['WO-1', 'WO-2', 'WO-3'].map(w => { const o = g(w); return { wo: w, due: o.dueDate, keep: o.dueKeep, wk: o.plannedWeek, veh: o.delVeh, day: o.delDay, rebook: !!o.delRebook, hist: (o.dueHist || []).map(h => h.src + ':' + h.to) }; }); });
  rec('old Cienapps date: planner date kept', a[0].due === '2026-11-27' && a[0].keep === '2026-11-20', JSON.stringify(a[0]));
  rec('third date kept (Keep): planner date stays, Dates list now shows the new Cienapps date', a[1].due === '2026-11-27' && a[1].keep === '2026-12-04', JSON.stringify(a[1]));
  rec('Take: date engine — history src cienapps, off the van (rebook), build week untouched', a[2].due === '2026-11-25' && !a[2].keep && !a[2].day && a[2].rebook && a[2].wk === '2026-11-16' && a[2].hist.join() === 'cienapps:2026-11-25', JSON.stringify(a[2]));
  // import with the planner date → clears
  await p.evaluate(async () => { clearTimeout(saveT); await saveDB(); });
  const aoa2 = [HDR, ['WO-1', 'House WO-1', 'CAIRN', XD('2026-11-27'), '3. In production', 4000]];
  await H.importAoa(p, aoa2);
  await p.evaluate(async () => { await document.getElementById('imp-apply').onclick(); }); await w(200);
  const c = await p.evaluate(() => ({ keep: DB.orders.find(o => o.wo === 'WO-1').dueKeep, list: datesToCien().map(o => o.wo) }));
  rec('Cienapps now has the planner date: dueKeep cleared and the job leaves the Dates list', c.keep === undefined && JSON.stringify(c.list) === '["WO-2"]', JSON.stringify(c));
  // saw card banner
  const s = await p.evaluate(async () => { ROLE = 'saw'; wlShowUpcoming = true; renderWorkList(document.getElementById('app'), 'saw'); await new Promise(r => setTimeout(r, 100));
    const card = [...document.querySelectorAll('.wl-card')].find(x => x.innerText.includes('House 3'));
    const o = DB.orders.find(x => x.wo === 'WO-3');
    const out = { card: card ? card.innerText : 'NOCARD wl=' + workLists().length + ' ' + document.getElementById('app').innerText.slice(0, 200), wed: !!movedBanner(o, '2026-11-11'), thu: !!movedBanner(o, '2026-11-12') };
    ROLE = 'office'; wlShowUpcoming = false; render(); return out; });
  rec('saw card: "WO-3 HAS MOVED" banner', /WO-3 HAS MOVED/.test(s.card), s.card.replace(/\n/g, ' ').slice(0, 200));
  rec('banner shows until the end of the next working day only', s.wed && !s.thu, JSON.stringify(s));
  rec('no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
  await t.close(); await browser.close();
  const f = res.filter(x => !x).length;
  console.log('\n' + (res.length - f) + ' passed, ' + f + ' failed');
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
