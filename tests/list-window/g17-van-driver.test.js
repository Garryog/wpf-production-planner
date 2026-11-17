// Garry 17 Nov (answer 5A): the Production Manager / office give each van a DRIVER per day on the Deliveries page; the driver's
// phone picks that van for him (and warns on another driver's van); the list window shows "— driver Pat". Fake Supabase only.
// Run: node tests/list-window/g17-van-driver.test.js
const L = require('./lw.js');
const { X, H, sleep, rec, closeAll, asks } = L;
(async () => {
  const browser = await H.chromium.launch(); let S;
  try {
    const r = X.v2Row();
    r.settings.staff = [{ id: 's1', n: 'Pat', r: ['driver'] }, { id: 's2', n: 'Mick', r: ['driver'] }];
    r.orders.push(H.order({ wo: 'WO-V1', customer: 'K', unit: '1', title: 'HOUSE 1', dueDate: '2026-10-22', origDueDate: '2026-10-22', delv: true, delVeh: 'VOLVO', delDay: 'Thu', delWk: '2026-10-19' }));
    S = X.makeServer(r);
    const t = await X.dev(browser, S, 'prod'), p = t.page; await asks(p);
    await p.evaluate(() => { ROLE = 'prod'; prodTab = 'deliv'; tab = 'd'; render(); }); await sleep(600);
    const sel = 'select[data-ddrv="VOLVO|2026-10-22"]';
    rec('Production Manager, Deliveries: a driver box in the Volvo · Thu 22 Oct cell, listing the drivers', await p.evaluate(s => { const e = document.querySelector(s); return !!e && [...e.options].map(o => o.text).join(',').includes('Pat'); }, sel));
    await p.selectOption(sel, 'Pat'); await sleep(2500);
    rec('picked Pat → saved in the planner settings (database)', ((S.row.settings || {}).vanDrv || {})['VOLVO|2026-10-22'] === 'Pat', JSON.stringify((S.row.settings || {}).vanDrv));
    // Pat on a second van the same day → asked
    await p.evaluate(() => { window.__asked = []; window.__confirm = false; }); const s2 = 'select[data-ddrv="ARTIC|2026-10-22"]';
    await p.selectOption(s2, 'Pat'); await sleep(300);
    const a2 = await p.evaluate(s => ({ asked: window.__asked.slice(), v: document.querySelector(s).value, m: (DB.vanDrv || {})['ARTIC|2026-10-22'] || '' }), s2);
    rec('Pat put on the Artic the same day → asked "already on the Volvo"; No → not set', a2.asked.some(x => /already on the Volvo/i.test(x)) && !a2.v && !a2.m, JSON.stringify(a2));
    await p.evaluate(() => { window.__confirm = true; });
    // list window shows the driver
    await p.evaluate(() => openListEditor(null, 'WO-V1')); await sleep(1200);
    const dl = await p.evaluate(() => ((document.getElementById('me-delmsg') || document.getElementById('me-delro') || {}).textContent || ''));
    rec('list window delivery line: "Booked: Volvo Thu 22 Oct — driver Pat"', /driver Pat/.test(dl), dl);
    await closeAll(p);
    // the driver's phone
    await p.evaluate(() => { ls.set('wpfDrvName', 'Pat'); ls.set('wpfDrvVeh', ''); ls.set('wpfDrvDay', 'Thu|2026-10-19'); ROLE = 'driver'; renderDriver(document.getElementById('app')); }); await sleep(500);
    const d1 = await p.evaluate(() => ({ veh: (document.getElementById('drv-veh') || {}).value, b: (document.getElementById('drv-asg') || {}).textContent || '', job: document.body.innerText.includes('WO-V1') }));
    rec('Pat\'s phone, Thu: the Volvo is picked for him, "You\'re on the Volvo … (set by the office)", his run shows', d1.veh === 'VOLVO' && /You're on the Volvo/.test(d1.b) && d1.job, JSON.stringify(d1));
    await p.evaluate(() => { ls.set('wpfDrvName', 'Mick'); ls.set('wpfDrvVeh', 'VOLVO'); renderDriver(document.getElementById('app')); }); await sleep(400);
    const d2 = await p.evaluate(() => (document.getElementById('drv-asg') || {}).textContent || '');
    rec('Mick picks the Volvo that day → warned "The Volvo on Thu … is Pat\'s"', /is Pat's/.test(d2), d2);
    // taking the driver off
    await p.evaluate(() => { ROLE = 'prod'; prodTab = 'deliv'; render(); }); await sleep(500);
    await p.selectOption(sel, ''); await sleep(2500);
    rec('driver taken off → gone from the settings', !(((S.row.settings || {}).vanDrv || {})['VOLVO|2026-10-22']), JSON.stringify((S.row.settings || {}).vanDrv));
    // PM: read-only
    await p.selectOption(sel, 'Pat'); await sleep(300);
    await p.evaluate(() => { ROLE = 'office'; tab = 'd'; render(); }); await sleep(300);
    rec('office also has the driver box', await p.evaluate(s => !!document.querySelector(s), sel));
    // phone 360
    await p.setViewportSize({ width: 360, height: 640 }); await p.evaluate(() => { ROLE = 'prod'; prodTab = 'deliv'; render(); }); await sleep(400);
    rec('phone 360 px: no sideways page scroll from the driver boxes', await p.evaluate(() => document.documentElement.scrollWidth <= 362), String(await p.evaluate(() => document.documentElement.scrollWidth)));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
