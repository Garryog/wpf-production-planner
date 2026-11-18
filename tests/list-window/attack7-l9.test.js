// Tester round 7 (18 Nov) — attack on L9 "add a cutting list in the delivery window" (Garry 17 Nov): ＋ List on a Deliveries card,
// ＋ Add cutting list / 📋 Open in the ⓘ check window. Roles drawn for real (PIN on the PC), two PCs, an archived list, blank
// floor / unit, on hold, delivered, odd characters, failed save, lists switched off, the grey background, phone 360 px.
// Fake Supabase only. Run: node tests/list-window/attack7-l9.test.js
const L = require('./lw.js');
const { X, H, sleep, rec, closeAll, asks, fillSaw, liveFor, err, rows } = L;
const ord = (wo, unit, x) => H.order(Object.assign({ wo, customer: 'Kildare Homes', floor: '1', unit, title: 'HOUSE ' + unit, dueDate: '2026-10-23', origDueDate: '2026-10-23', step: '5. WORK ORDER PROCESSED', delv: true }, x || {}));
const isEd = p => p.evaluate(() => !!document.querySelector('.me-ed'));
(async () => {
  const browser = await H.chromium.launch(); let S;
  try {
    const r = X.v2Row();
    r.orders.push(
      ord('WO-A1', '11'),                                                     // plain, pool
      ord('WO-A2', '', { floor: '', title: '' }),                             // blank floor / unit / title
      ord('WO-A3', '13', { delVeh: 'VOLVO', delDay: 'Thu', delWk: '2026-10-19' }), // archived list only
      ord('WO-A4', '14', { delVeh: 'VOLVO', delDay: 'Thu', delWk: '2026-10-19', delDelivAt: '2026-10-22T10:00:00Z', delivBy: 'Pat' }), // delivered
      ord('WO-A5', '15', { cienHold: true, holdAt: '2026-10-20T09:00:00Z' }),  // on hold but still on Deliveries (hold came from another PC)
      ord('WO-A6', '16', { title: '<img src=x onerror="window.__x7=1">O\'Grady "Q" 🏠', customer: 'O\'Grady & Sons' }),
      ord('WO-A7', '17'),                                                     // another PC makes its list meanwhile
      ord('WO-A8', '18'));                                                    // the save fails
    S = X.makeServer(r);
    const D0 = L.D; D0.insert(S.db, 'projects', { id: 'PK', name: 'Kildare Homes', customer: 'Kildare Homes', cien_names: ['Kildare Homes'] });
    D0.insert(S.db, 'project_materials', { id: 'MK1', project_id: 'PK', name: 'MFC White', kind: 'sheet' });
    X.F3.seedList(S, 'LA3', { wos: ['WO-A3'], name: 'Old archived', list: { archived: true } });
    X.F3.seedList(S, 'LA6', { wos: ['WO-A1x'], name: '<script>window.__x7s=1</script>', list: { project_id: 'PK' } });
    const t = await X.dev(browser, S, 'office'), p = t.page; await asks(p);
    const deliv = async role => { await p.evaluate(async rl => { localStorage.setItem('wpfPin_' + rl, pins()[rl] || '9000'); ROLE = rl; prodTab = 'deliv'; tab = 'd'; render(); }, role || 'office'); await sleep(500); };
    await p.evaluate(async () => { lsReset(); await lsLoad(); }); await deliv('office');
    const clk = sel => p.evaluate(sel => { const b = document.querySelector(sel); if (!b) return 'missing ' + sel; b.click(); return 'ok'; }, sel);
    const has = wo => p.evaluate(wo => !!document.querySelector('[data-dladd="' + wo + '"]'), wo);

    // ---------- roles, drawn for real ----------
    rec('R1: office — "＋ List" on WO-A1', await has('WO-A1'));
    await deliv('prod'); rec('R2: Production Manager (🚚 Deliveries tab) — "＋ List" on WO-A1', await has('WO-A1'));
    for (const role of ['pm', 'driver', 'floor', 'saw', 'stores', 'dash', 'design']) {
      await deliv(role);
      const w = await p.evaluate(rl => ({ ok: roleOk(rl), n: document.querySelectorAll('[data-dladd],[data-rdadd]').length, deliv: !!document.querySelector('[data-ddrv],[data-dinfo]') }), role);
      rec('R3: ' + role + ' screen (really drawn) — no "＋ List" / "＋ Add cutting list" on it', w.ok && w.n === 0, JSON.stringify(w));
    }
    await deliv('design');
    rec('(info) R4: the Drawing office screen has no way to the Deliveries page, so L9\'s "Drawing office may add" is only via 📋 Cutting Lists', !(await p.evaluate(() => !!document.querySelector('[data-dladd]'))));
    // the roles' check in tests/list-window/l9-delivery-add-list.test.js runs without the PIN → it draws the role picker, not the screen
    const vac = await p.evaluate(() => { localStorage.removeItem('wpfPin_pm'); ROLE = 'pm'; tab = 'd'; render(); return { ok: roleOk('pm'), app: document.getElementById('app').innerText.length }; });
    rec('(info, test quality) l9-delivery-add-list "pm / driver do NOT see" checks draw the role picker (no PIN set), so they cannot fail', vac.ok, JSON.stringify(vac));
    await deliv('office');

    // ---------- the cards ----------
    rec('C1: WO-A3 (its only list is ARCHIVED) offers "＋ List"', await has('WO-A3'));
    rec('C2: WO-A4 (DELIVERED) does not offer "＋ List"', !(await has('WO-A4')));
    rec('C3: WO-A2 (no floor / unit / title) offers "＋ List"', await has('WO-A2'));
    const hold = await has('WO-A5');
    rec('(info) C4: WO-A5 is ON HOLD but still on Deliveries — "＋ List" offered: ' + hold, true);
    // the ⓘ window on a delivered job (e.g. as "put on the delivery board")
    await p.evaluate(() => showReadiness(['WO-A4'], 'test', true)); await sleep(200);
    const rd4 = await p.evaluate(() => !!document.querySelector('[data-rdadd="WO-A4"]')); await closeAll(p);
    rec('(LOW) C5: the ⓘ check window does NOT offer "＋ Add cutting list" for a job already DELIVERED (the card does not)', !rd4, String(rd4));

    // ---------- blank floor / unit ----------
    await clk('[data-dladd="WO-A2"]'); await sleep(1200);
    const w2 = await p.evaluate(() => ({ ed: !!document.querySelector('.me-ed'), hwo: (document.getElementById('me-hwo') || {}).textContent || '', name: (document.getElementById('me-name') || {}).value }));
    rec('(LOW) B1: WO-A2 (blank floor / unit / title) → window opens on WO-A2 with a list name filled in', w2.ed && /WO-A2/.test(w2.hwo) && !!String(w2.name || '').trim(), JSON.stringify(w2));
    await fillSaw(p, 2, 'Side', '2', '720', '560', 'MFC White'); await p.evaluate(() => document.getElementById('me-saveclose').click()); await sleep(2600);
    rec('(LOW) B2: …Save & close straight away → one list on WO-A2 (no unit = the standard layout\'s top heading is blank, and the save refuses it)', liveFor(S, 'WO-A2').length === 1, String(liveFor(S, 'WO-A2').length) + ' ' + await err(p));
    if (!liveFor(S, 'WO-A2').length) { await L.setv(p, '0|item', 'Site job'); await p.evaluate(() => document.getElementById('me-saveclose').click()); await sleep(2600); }
    rec('B3: …after typing the heading it saves ONE list, named', liveFor(S, 'WO-A2').length === 1 && !!String(liveFor(S, 'WO-A2')[0].name || '').trim(), JSON.stringify(liveFor(S, 'WO-A2').map(l => l.name)) + ' ' + await err(p));
    await closeAll(p);

    // ---------- archived list ----------
    await deliv('office'); await p.evaluate(() => { window.__asked = []; }); await clk('[data-dladd="WO-A3"]'); await sleep(1200);
    await fillSaw(p, 2, 'Back', '1', '700', '500', 'MFC White'); await p.evaluate(() => document.getElementById('me-saveclose').click()); await sleep(2600);
    const a3 = S.db.t.lists.find(l => l.id === 'LA3');
    rec('A1: WO-A3 (only an archived list) → a new list is saved; the archived one stays archived and untouched', liveFor(S, 'WO-A3').length === 1 && a3.archived && liveFor(S, 'WO-A3')[0].id !== 'LA3', JSON.stringify([liveFor(S, 'WO-A3').map(l => l.id), a3.archived, await err(p)]));
    await closeAll(p);

    // ---------- odd characters ----------
    await deliv('office');
    await p.evaluate(() => showReadiness(['WO-A6'], 'O\'Grady <b>x</b>', true)); await sleep(300);
    const x1 = await p.evaluate(() => ({ x: window.__x7 || 0, img: document.querySelectorAll('.pod-ovl img').length, add: !!document.querySelector('[data-rdadd="WO-A6"]') }));
    rec('X1: a job title with <img onerror> / quotes / emoji in the ⓘ window → shown as text, nothing runs', x1.x === 0 && x1.img === 0 && x1.add, JSON.stringify(x1));
    await clk('[data-rdadd="WO-A6"]'); await sleep(1200);
    const x2 = await p.evaluate(() => ({ x: window.__x7 || 0, hwo: (document.getElementById('me-hwo') || {}).textContent || '', img: document.querySelectorAll('.me-ed img[src="x"]').length }));
    rec('X2: …＋ Add cutting list → window on WO-A6, nothing runs', x2.x === 0 && x2.img === 0 && /WO-A6/.test(x2.hwo), JSON.stringify(x2));
    await closeAll(p);
    // a list named <script> on a job: the 📋 Open button
    await p.evaluate(() => { const l = lsCache().all.find(x => x.id === 'LA6'); });
    D0.update(S.db, 'lists', S.db.t.lists.find(l => l.id === 'LA6'), { wos: ['WO-A1'] });
    await p.evaluate(async () => { lsReset(); await lsLoad(); }); await p.evaluate(() => showReadiness(['WO-A1'], 'test', true)); await sleep(300);
    const x3 = await p.evaluate(() => ({ s: window.__x7s || 0, btn: ((document.querySelector('[data-rdopen="LA6"]') || {}).textContent || '') }));
    rec('X3: a list named "<script>…" → the 📋 Open button shows the name as text, nothing runs', x3.s === 0 && /<script>/.test(x3.btn), JSON.stringify(x3));
    await closeAll(p);

    // ---------- two PCs: another PC makes WO-A7's list after this screen drew the card ----------
    await deliv('office');
    rec('T0: WO-A7 card shows "＋ List"', await has('WO-A7'));
    X.F3.seedList(S, 'LB7', { wos: ['WO-A7'], name: 'PC B list', list: { project_id: 'PK' } });
    await p.evaluate(() => { window.__asked = []; window.__confirm = false; }); await clk('[data-dladd="WO-A7"]'); await sleep(1300);
    const t1 = await p.evaluate(() => ({ asked: window.__asked.slice(), ed: !!document.querySelector('.me-ed'), err: (document.getElementById('me-err') || {}).textContent || '', info: (document.getElementById('me-woinfo') || {}).innerText || '' }));
    if (t1.ed) { await fillSaw(p, 2, 'Mine', '1', '700', '500', 'MFC White'); await p.evaluate(() => document.getElementById('me-saveclose').click()); await sleep(2600); }
    const t2 = await p.evaluate(() => ({ asked: window.__asked.slice(), ed: !!document.querySelector('.me-ed'), err: (document.getElementById('me-err') || {}).textContent || '' }));
    rec('T1: the stale "＋ List" pressed after PC B made a list → asked / told it already has one; Cancel → still one list (PC B\'s)', liveFor(S, 'WO-A7').length === 1 && liveFor(S, 'WO-A7')[0].id === 'LB7' && (t1.asked.concat(t2.asked).some(m => /already has/i.test(m)) || /already has/i.test(t1.err + t1.info + t2.err)), JSON.stringify([t1, t2]).slice(0, 400));
    rec('T2: …and the rows typed are still in the window after Cancel', !t2.ed || (await rows(p)).some(x => x.item === 'Mine'));
    await p.evaluate(() => { window.__confirm = true; }); await closeAll(p);

    // ---------- the save fails / no reply ----------
    await deliv('office'); await clk('[data-dladd="WO-A8"]'); await sleep(1200);
    await fillSaw(p, 2, 'Top', '1', '1200', '560', 'MFC White');
    S.fail3 = true; await p.evaluate(() => document.getElementById('me-saveclose').click()); await sleep(2600);
    const f1 = await p.evaluate(() => ({ ed: !!document.querySelector('.me-ed'), err: (document.getElementById('me-err') || {}).textContent || '', done: !!document.querySelector('.me-dov') }));
    rec('F1: database down → window stays open, says NOT saved, rows kept', f1.ed && !f1.done && /not saved|could not|failed|try again/i.test(f1.err) && (await rows(p)).some(x => x.item === 'Top'), JSON.stringify(f1));
    S.fail3 = false; await p.evaluate(() => document.getElementById('me-saveclose').click()); await sleep(2600);
    rec('F2: database back → Save & close saves ONE list on WO-A8', liveFor(S, 'WO-A8').length === 1, String(liveFor(S, 'WO-A8').length) + ' ' + await err(p));
    await closeAll(p);

    // ---------- the grey background (hotfix) when opened from Deliveries ----------
    await deliv('office'); await clk('[data-dladd="WO-A1"]'); await sleep(1200);
    if (!(await isEd(p))) { await p.evaluate(() => lsNewStd('WO-A1')); await sleep(1200); }
    await fillSaw(p, 2, 'Grey', '1', '700', '500', 'MFC White');
    await p.mouse.click(4, 4); await sleep(300);
    rec('G1: window opened from Deliveries — a click on the grey background does NOT close it', await isEd(p));
    const c = await p.evaluate(() => { const e = document.querySelector('.me-ed [data-mr="2|item"]'); const r = e.getBoundingClientRect(); return { x: r.left + 10, y: r.top + r.height / 2 }; });
    await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.move(c.x, 3, { steps: 4 }); await p.mouse.up(); await sleep(300);
    rec('G2: …a text selection dragged out onto the grey → still open, rows kept', await isEd(p) && (await rows(p)).some(x => x.item === 'Grey'));
    await p.mouse.move(4, 4); await p.mouse.down(); await p.mouse.move(c.x, c.y, { steps: 4 }); await p.mouse.up(); await sleep(300);
    rec('G3: …press on the grey, let go inside the window → still open', await isEd(p));
    await closeAll(p);

    // ---------- phone 360 ----------
    await p.setViewportSize({ width: 360, height: 640 }); await deliv('office');
    const ph = await p.evaluate(() => { const b = document.querySelector('[data-dladd]'); if (!b) return null; b.scrollIntoView(); const r = b.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width), l: Math.round(r.left), r: Math.round(r.right), sw: document.documentElement.scrollWidth }; });
    rec('P1: phone 360 — "＋ List" on screen, no page sideways scroll', ph && ph.l >= 0 && ph.r <= 360 && ph.sw <= 362, JSON.stringify(ph));
    rec('(info, LOW) P2: phone 360 — "＋ List" is at least 28 px tall (finger-sized)', ph && ph.h >= 28, JSON.stringify(ph));
    await p.evaluate(() => showReadiness(['WO-A6', 'WO-A1', 'WO-A5'], 'a long name for the check window on a phone', true)); await sleep(300);
    const p3 = await p.evaluate(() => [...document.querySelectorAll('.pod-ovl [data-rdadd], .pod-ovl [data-rdopen], .pod-ovl #pod-x')].map(b => { const r = b.getBoundingClientRect(); return { t: b.textContent.slice(0, 18), l: Math.round(r.left), r: Math.round(r.right), h: Math.round(r.height) }; }));
    rec('P3: phone 360 — every button in the ⓘ window is fully on screen and at least 28 px tall', p3.length >= 3 && p3.every(b => b.l >= 0 && b.r <= 360 && b.h >= 28), JSON.stringify(p3));
    await closeAll(p); await p.setViewportSize({ width: 1400, height: 900 });

    // ---------- lists switched OFF ----------
    S.row.settings.listStore = 'v1'; await p.evaluate(async () => { await loadDB(); }); await deliv('office');
    rec('O1: lists switched OFF → no "＋ List" anywhere', !(await p.evaluate(() => document.querySelectorAll('[data-dladd]').length)));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
