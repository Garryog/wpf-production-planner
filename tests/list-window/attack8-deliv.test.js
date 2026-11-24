// Tester round 8 (18 Nov) — attack on the round-7 fixes on the Deliveries side (commit e728dbf): the driver's phone picking the
// office's van (across midnight, his own choice / the amber line, two vans in a day, moved mid-day), vanDrv always saved ({} on two
// PCs in different cells, a record with no vanDrv key), the ⓘ window for loaded / on-the-road jobs, a job with no unit AND no title.
// Fake Supabase only (tests/seq/fixs.js). Run: node tests/list-window/attack8-deliv.test.js
const L = require('./lw.js');
const { X, H, sleep, rec, closeAll, asks, fillSaw, liveFor, err } = L;
const WED = '2026-10-21', THU = '2026-10-22', FRI = '2026-10-23';
const SEL = (v, d) => 'select[data-ddrv="' + v + '|' + d + '"]';
const wait = async p => { await p.evaluate(async () => { for (let i = 0; i < 80 && typeof SAVING !== 'undefined' && SAVING; i++) await new Promise(r => setTimeout(r, 100)); }); await sleep(400); };
(async () => {
  const browser = await H.chromium.launch(); let S;
  try {
    const r = X.v2Row();
    r.settings.staff = [{ id: 's1', n: 'Pat', r: ['driver'] }, { id: 's2', n: 'Mick', r: ['driver'] }];
    const job = (wo, veh, day, x) => H.order(Object.assign({ wo, customer: 'Kildare Homes', floor: '1', unit: wo.slice(-1), title: 'HOUSE ' + wo, dueDate: FRI, origDueDate: FRI, delv: true, delVeh: veh, delDay: day, delWk: '2026-10-19', step: '5. WORK ORDER PROCESSED' }, x || {}));
    r.orders.push(job('WO-W1', 'VOLVO', 'Wed'), job('WO-T1', 'VOLVO', 'Thu'), job('WO-T2', 'ARTIC', 'Thu'), job('WO-F1', 'VOLVO', 'Fri'),
      job('WO-LD', 'ARTIC', 'Fri', { delLoadedAt: '2026-10-21T07:00:00Z', ldBy: 'Pat' }), job('WO-RD', 'ARTIC', 'Fri', { delLoadedAt: '2026-10-21T07:00:00Z', delDispAt: '2026-10-21T08:00:00Z' }),
      job('WO-NU', '', '', { delVeh: '', delDay: '', delWk: undefined, floor: '', unit: '', title: '' }));
    S = X.makeServer(r);
    L.D.insert(S.db, 'projects', { id: 'PK', name: 'Kildare Homes', customer: 'Kildare Homes', cien_names: ['Kildare Homes'] });
    L.D.insert(S.db, 'project_materials', { id: 'MK1', project_id: 'PK', name: 'MFC White', kind: 'sheet' });
    const setDrv = m => { S.row.settings.vanDrv = m; S.row.version = (+S.row.version || 1) + 1; };
    // ---------- the driver's phone ----------
    const d = await X.dev(browser, S, 'driver'), pd = d.page;
    const phone = async () => { await pd.evaluate(async () => { await loadDB(); ROLE = 'driver'; renderDriver(document.getElementById('app')); }); await sleep(400);
      return pd.evaluate(() => ({ veh: (document.getElementById('drv-veh') || {}).value, day: (document.getElementById('drv-day') || {}).value, asg: (document.getElementById('drv-asg') || {}).textContent || '', amber: /fff4e5/.test((document.getElementById('drv-asg') || { getAttribute: () => '' }).getAttribute('style') || '') })); };
    const pick = (id, v) => pd.evaluate(({ id, v }) => { const s = document.getElementById(id); s.value = v; s.dispatchEvent(new Event('change')); }, { id, v });
    await pd.evaluate(() => { ls.set('wpfDrvName', 'Pat'); ls.set('wpfDrvVeh', ''); ['wpfDrvDay', 'wpfDrvAsg'].forEach(k => localStorage.removeItem(k)); localStorage.removeItem('wpf_wpfDrvDay'); });
    // D1: today Wed (no van given); Pat picks the Volvo himself; the office then gives him the Artic for TOMORROW
    let s = await phone(); await pick('drv-veh', 'VOLVO'); await sleep(300);
    setDrv({ ['ARTIC|' + THU]: 'Pat' }); s = await phone();
    rec('D1: Wed shown, Pat on the Volvo by his own choice; office gives him the Artic for THURSDAY → Wed screen unchanged (Volvo, no message)', s.veh === 'VOLVO' && /^Wed/.test(s.day) && !s.asg, JSON.stringify(s));
    // D2: midnight passes with the page open (Day box never touched)
    await pd.evaluate(() => { const R = Date, sh = 86400000; class D2 extends R { constructor(...a) { if (!a.length) super(R.now() + sh); else super(...a); } static now() { return R.now() + sh; } } D2.UTC = R.UTC; D2.parse = R.parse; window.Date = D2; });
    s = await phone();
    rec('D2: after midnight (Thu) the open phone shows Thursday, the Artic picked, "switched from the Volvo"', /^Thu/.test(s.day) && s.veh === 'ARTIC' && /You're on the Artic/.test(s.asg) && /switched from the Volvo/.test(s.asg), JSON.stringify(s));
    // D3: his own choice → amber line; it stands on the next refresh
    await pick('drv-veh', 'VOLVO'); s = await phone();
    rec('D3: Pat picks the Volvo himself → amber line "The office put you on the Artic … — you are looking at the Volvo"; it stands on refresh', s.veh === 'VOLVO' && s.amber && /put you on the Artic/.test(s.asg), JSON.stringify(s));
    // D4: he looks at Friday (where the office has him on the Volvo) and back to Thursday
    setDrv({ ['ARTIC|' + THU]: 'Pat', ['VOLVO|' + FRI]: 'Pat' }); await phone();
    await pick('drv-day', 'Fri|2026-10-19'); await sleep(300); const sf = await phone();
    await pick('drv-day', 'Thu|2026-10-19'); await sleep(300); s = await phone();
    rec('(LOW) D4: …looking at Friday and back at Thursday → his own Thursday choice (Volvo) still stands (not switched back to the Artic)', s.veh === 'VOLVO', JSON.stringify([sf, s]));
    // D5: two vans the same day (office said OK to "already on the Artic")
    setDrv({ ['ARTIC|' + THU]: 'Pat', ['VOLVO|' + THU]: 'Pat' }); await pd.evaluate(() => { ls.set('wpfDrvAsg', ''); ls.set('wpfDrvVeh', ''); }); s = await phone();
    await pick('drv-veh', 'VOLVO'); const s5 = await phone();
    rec('(LOW) D5: Pat on the Artic AND the Volvo Thu; he opens the Volvo → no warning that he is on the wrong van (he is on both)', !s5.amber && !/put you on/.test(s5.asg), JSON.stringify([s, s5]));
    // D6: moved mid-day by the office (Artic → Volvo)
    setDrv({ ['ARTIC|' + THU]: 'Pat' }); await pd.evaluate(() => { ls.set('wpfDrvAsg', ''); ls.set('wpfDrvVeh', ''); }); await phone();
    setDrv({ ['VOLVO|' + THU]: 'Pat', ['ARTIC|' + THU]: 'Mick' }); s = await phone();
    rec('D6: office moves Pat from the Artic to the Volvo mid-day → his phone switches, "switched from the Artic"', s.veh === 'VOLVO' && /switched from the Artic/.test(s.asg), JSON.stringify(s));
    await d.close();
    setDrv({});

    // ---------- vanDrv {} on two PCs ----------
    const a = await X.dev(browser, S, 'prod'), pa = a.page; await asks(pa);
    const b = await X.dev(browser, S, 'prod'), pb = b.page; await asks(pb);
    const deliv = async p => { await p.evaluate(() => { ROLE = 'prod'; prodTab = 'deliv'; tab = 'd'; render(); }); await sleep(400); };
    const reload = async p => { await p.evaluate(async () => { await loadDB(); render(); }); await sleep(400); await deliv(p); };
    await pa.evaluate(async () => { DB.vanDrv = { 'VOLVO|2026-10-22': 'Pat' }; sched(); await saveDB(); }); await wait(pa); await reload(pa); await reload(pb);
    await pa.selectOption(SEL('VOLVO', THU), ''); await pb.selectOption(SEL('ARTIC', THU), 'Mick'); await wait(pa); await wait(pb); await sleep(1800);
    let v = S.row.settings.vanDrv || {};
    rec('E1: PC A takes Pat off the Volvo (its map now {}) while PC B puts Mick on the Artic → Pat off, Mick on', !v['VOLVO|' + THU] && v['ARTIC|' + THU] === 'Mick', JSON.stringify(v));
    await reload(pa); await reload(pb);
    rec('E2: …both PCs agree after refresh', await pa.evaluate(() => JSON.stringify(DB.vanDrv)) === JSON.stringify(v) && await pb.evaluate(() => JSON.stringify(DB.vanDrv)) === JSON.stringify(v), await pa.evaluate(() => JSON.stringify(DB.vanDrv)) + ' / ' + await pb.evaluate(() => JSON.stringify(DB.vanDrv)));
    await pa.selectOption(SEL('ARTIC', THU), ''); await wait(pa); await sleep(1200); await reload(pb);
    await pa.selectOption(SEL('VOLVO', FRI), 'Pat'); await pb.selectOption(SEL('RENAULT', FRI), 'Mick'); await wait(pa); await wait(pb); await sleep(1800);
    v = S.row.settings.vanDrv || {};
    rec('E3: from {} on both PCs, A adds Pat (Volvo Fri) and B adds Mick (Renault Fri) at once → both kept', v['VOLVO|' + FRI] === 'Pat' && v['RENAULT|' + FRI] === 'Mick' && Object.keys(v).length === 2, JSON.stringify(v));
    rec('E4: the record holds vanDrv as {} or the drivers — never missing after a new-code save', 'vanDrv' in S.row.settings, JSON.stringify(Object.keys(S.row.settings)));
    // E5: a record with NO vanDrv key (an old screen saved it) — the open PCs still hold Pat / Mick
    delete S.row.settings.vanDrv; S.row.version++;
    await reload(pa); const ea = await pa.evaluate(() => JSON.stringify(DB.vanDrv));
    await pa.evaluate(async () => { const o = DB.orders.find(x => x.wo === 'WO-F1'); o.notes = 'A note'; sched(); await saveDB(); }); await wait(pa); await sleep(1200);
    await pa.evaluate(async () => { const o = DB.orders.find(x => x.wo === 'WO-F1'); o.notes = 'A note 2'; sched(); await saveDB(); }); await wait(pa); await sleep(1200);
    v = S.row.settings.vanDrv;
    rec('(info) E5: record with no vanDrv key (old screen) → an open new PC keeps showing its drivers: ' + ea, true);
    rec('(MEDIUM, old-screen type) E6: …its next saves put back ALL the drivers (Pat on the Volvo Fri AND Mick on the Renault Fri, set from PC B)', !!v && v['VOLVO|' + FRI] === 'Pat' && v['RENAULT|' + FRI] === 'Mick', JSON.stringify(v));
    const c = await X.dev(browser, S, 'prod'), pc = c.page; await deliv(pc);
    rec('(info) E7: a PC opened afterwards sees: ' + await pc.evaluate(() => JSON.stringify(DB.vanDrv)), true);
    await c.close();

    // ---------- the ⓘ window for loaded / on-the-road jobs ----------
    await pa.evaluate(() => { ROLE = 'office'; tab = 'd'; render(); }); await sleep(300);
    await pa.evaluate(() => showReadiness(['WO-LD', 'WO-RD', 'WO-F1'], 'test', true)); await sleep(300);
    const rd = await pa.evaluate(() => ({ ld: !!document.querySelector('[data-rdadd="WO-LD"]'), rd: !!document.querySelector('[data-rdadd="WO-RD"]'), f1: !!document.querySelector('[data-rdadd="WO-F1"]') }));
    rec('I1: ⓘ window — no "＋ Add cutting list" for the LOADED job or the one ON THE ROAD; still there for a planned job', !rd.ld && !rd.rd && rd.f1, JSON.stringify(rd));
    await closeAll(pa);
    // ---------- a job with no unit AND no title ----------
    await pa.evaluate(async () => { lsReset(); await lsLoad(); ROLE = 'office'; tab = 'd'; render(); }); await sleep(500);
    const nu = await pa.evaluate(() => { const b = document.querySelector('[data-dladd="WO-NU"]'); if (!b) return 'no button'; b.click(); return 'ok'; }); await sleep(1200);
    const w = await pa.evaluate(() => ({ ed: !!document.querySelector('.me-ed'), name: (document.getElementById('me-name') || {}).value, h0: (document.querySelector('.me-ed [data-mr="0|item"]') || {}).value }));
    rec('N1: WO-NU (no floor / unit / title) → window opens, list name and top heading = "WO-NU"', nu === 'ok' && w.ed && w.name === 'WO-NU' && w.h0 === 'WO-NU', JSON.stringify([nu, w]));
    await fillSaw(pa, 2, 'Side', '2', '720', '560', 'MFC White'); await pa.evaluate(() => document.getElementById('me-saveclose').click()); await sleep(2600);
    rec('N2: …Save & close straight away → one list on WO-NU', liveFor(S, 'WO-NU').length === 1, String(liveFor(S, 'WO-NU').length) + ' ' + await err(pa));
    await closeAll(pa);
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
