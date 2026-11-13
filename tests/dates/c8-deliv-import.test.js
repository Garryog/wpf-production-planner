// Dates & deliveries phase 2, steps 17–18: the delivery date from Cienapps column L, and the Settings numbers.
// Import: header "Delivery Date" maps (bare "Delivery" does not); a new job gets delivDate; an existing one takes a new
// Cienapps delivery date and is flagged when the build date didn't move / is after delivery; a planner-moved delivery
// date (delivKeep) is kept against the old Cienapps date, a third Cienapps date is flagged not taken, and the import
// clears delivKeep when Cienapps catches up. The build date is never worked out by the import.
// Settings: delivLead / siteDays / earlyDays saved in settings and read back after reload. Stubbed Supabase only.
// Run: node tests/dates/c8-deliv-import.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
(async () => {
  const browser = await H.chromium.launch();
  const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-20', origDueDate: '2026-11-20', plannedWeek: '2026-11-16', step: '3. In production', customer: 'CAIRN', title: 'House ' + wo }, x));
  const row = { id: 'main', nid: 9, settings: {}, orders: [
    O('WO-1'),                                                                   // no delivery date yet
    O('WO-2', { delivDate: '2026-11-25', origDelivDate: '2026-11-25' }),         // Cienapps moves delivery, not build
    O('WO-3', { delivDate: '2026-12-02', delivKeep: '2026-11-25' }),             // planner moved delivery; Cienapps still old
    O('WO-4', { delivDate: '2026-12-02', delivKeep: '2026-11-25' }),             // planner moved; Cienapps sends a third date
    O('WO-5', { delivDate: '2026-12-02', delivKeep: '2026-11-25' }),             // planner moved; Cienapps now has the planner date
  ] };
  const t = await H.open({ browser, now: '2026-11-10T10:00:00Z', row });
  const HDR = ['WO #', 'Title', 'Customer', 'Due Date', 'Step', 'Sub-Total', 'Delivery Date'];
  const r1 = await H.importAoa(t.page, [HDR,
    ['WO-1', 'House WO-1', 'CAIRN', 46346, '3. In production', 4000, 46353],
    ['WO-2', 'House WO-2', 'CAIRN', 46346, '3. In production', 4000, 46360],
    ['WO-3', 'House WO-3', 'CAIRN', 46346, '3. In production', 4000, 46351],
    ['WO-4', 'House WO-4', 'CAIRN', 46346, '3. In production', 4000, 46365],
    ['WO-5', 'House WO-5', 'CAIRN', 46346, '3. In production', 4000, 46358],
    ['WO-77', 'New job', 'CAIRN', 46360, '3. In production', 4000, 46358]]);
  const A = await t.page.evaluate(() => {
    const map = PEND ? PEND.map : null, flags = JSON.parse(JSON.stringify(IMPPLAN.flagged || []));
    applyImport(IMPPLAN);
    const g = w => DB.orders.find(o => o.wo === w), pk = o => ({ due: o.dueDate, dl: o.delivDate || '', keep: o.delivKeep, orig: o.origDelivDate || '', h: (o.dueHist || []).filter(x => x.f === 'deliv').map(x => x.from + '>' + x.to + ':' + x.src) });
    return { map, flags, j: Object.fromEntries(['WO-1', 'WO-2', 'WO-3', 'WO-4', 'WO-5', 'WO-77'].map(w => [w, pk(g(w))])) };
  });
  const fl = w => (A.flags.find(f => f.wo === w) || {}).why || '';
  rec('"Delivery Date" header maps to the delivery date', A.map == null || A.map.delivDate === 6, JSON.stringify(A.map));
  rec('existing job with no delivery date takes Cienapps\' one; build date untouched', A.j['WO-1'].dl === '2026-11-27' && A.j['WO-1'].due === '2026-11-20', JSON.stringify(A.j['WO-1']));
  rec('Cienapps moves the delivery date, not the build: taken + flagged "build date didn\'t — check" + history', A.j['WO-2'].dl === '2026-12-04' && A.j['WO-2'].due === '2026-11-20' && /delivery moved in Cienapps.*build date didn't/.test(fl('WO-2')) && A.j['WO-2'].h.join() === '2026-11-25>2026-12-04:cienapps' && A.j['WO-2'].orig === '2026-11-25', JSON.stringify([A.j['WO-2'], fl('WO-2')]));
  rec('planner-moved delivery date kept while Cienapps still has the old date', A.j['WO-3'].dl === '2026-12-02' && A.j['WO-3'].keep === '2026-11-25' && !A.j['WO-3'].h.length, JSON.stringify(A.j['WO-3']));
  rec('a third Cienapps delivery date: Keep by default (round 2) — planner date kept, delivKeep = what Cienapps now has', A.j['WO-4'].dl === '2026-12-02' && A.j['WO-4'].keep === '2026-12-09', JSON.stringify(A.j['WO-4']));
  rec('Cienapps now has the planner delivery date: delivKeep cleared', A.j['WO-5'].dl === '2026-12-02' && A.j['WO-5'].keep === undefined, JSON.stringify(A.j['WO-5']));
  rec('new job: delivery date + original kept; build after delivery flagged; the import never sets a build date from it', A.j['WO-77'].dl === '2026-12-02' && A.j['WO-77'].orig === '2026-12-02' && A.j['WO-77'].due === '2026-12-04' && /build date after the delivery date/.test(fl('WO-77')), JSON.stringify([A.j['WO-77'], fl('WO-77')]));
  const B = await t.page.evaluate(() => { const ws = XLSX.utils.aoa_to_sheet([['WO #', 'Due Date', 'Title', 'Delivery'], ['WO-1', '20/11/2026', 'x', '01/12/2026']]); const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 }); return mapFromHeader(aoa[0]).delivDate; });
  rec('a bare "Delivery" column is NOT taken as the delivery date', B === -1, String(B));
  // Settings
  const S = await t.page.evaluate(async () => {
    const out = { def: [delivLead(), siteDays(), earlyDays()] };
    showTab('s'); await new Promise(r => setTimeout(r, 150));
    const box = document.getElementById('set-dates'); out.has = !!box;
    if (box) { document.getElementById('s-delivLead').value = '4'; document.getElementById('s-siteDays').value = '7'; document.getElementById('s-earlyDays').value = '21'; document.getElementById('btn-save-dates').click(); }
    out.now = [delivLead(), siteDays(), earlyDays()];
    document.getElementById('s-earlyDays').value = '0'; document.getElementById('btn-save-dates').click(); out.bad = earlyDays();
    await new Promise(r => setTimeout(r, 1700));
    return out;
  });
  rec('Settings: defaults 3 / 5 / 14; saved as typed; a bad number keeps the old one', S.def.join() === '3,5,14' && S.has && S.now.join() === '4,7,21' && S.bad === 21, JSON.stringify(S));
  rec('Settings numbers saved inside settings', t.server.row.settings.delivLead === 4 && t.server.row.settings.siteDays === 7 && t.server.row.settings.earlyDays === 21, JSON.stringify([t.server.row.settings.delivLead, t.server.row.settings.siteDays, t.server.row.settings.earlyDays]));
  rec('no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
  await t.close();
  const t2 = await H.open({ browser, now: '2026-11-10T10:00:00Z', row: { id: 'main', nid: 2, settings: { delivLead: 4, siteDays: 7, earlyDays: 21 }, orders: [] } });
  const S2 = await t2.page.evaluate(() => [delivLead(), siteDays(), earlyDays()]);
  rec('…and read back by a PC opened later', S2.join() === '4,7,21', S2.join());
  await t2.close();
  await browser.close();
  console.log('\n' + res.filter(x => x).length + ' passed, ' + res.filter(x => !x).length + ' failed');
})().catch(e => { console.error(e); process.exit(1); });
