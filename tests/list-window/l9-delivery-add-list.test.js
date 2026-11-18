// L9 (Garry 17 Nov: "i need to be able to add a cutting list in the delivery window also"). On the Deliveries page a job with no
// list has "＋ List" on its card, and the ⓘ check window has "＋ Add cutting list" / "📋 Open <list>". They open the same list
// window, with the WO filled in. PMs / drivers see no button. Fake Supabase only. Run: node tests/list-window/l9-delivery-add-list.test.js
const L = require('./lw.js');
const { X, H, sleep, rec, closeAll, asks, fillSaw, liveFor } = L;
const ord = (wo, unit, x) => H.order(Object.assign({ wo, customer: 'Kildare Homes', floor: '1', unit, title: 'HOUSE ' + unit, dueDate: '2026-10-23', origDueDate: '2026-10-23', step: '5. WORK ORDER PROCESSED', delv: true }, x || {}));
(async () => {
  const browser = await H.chromium.launch(); let S;
  try {
    const r = X.v2Row(); r.orders.push(ord('WO-D1', '11'), ord('WO-D2', '12'), ord('WO-D3', '13', { delVeh: 'VOLVO', delDay: 'Thu', delWk: '2026-10-19' }));
    S = X.makeServer(r);
    const D0 = L.D; D0.insert(S.db, 'projects', { id: 'PK', name: 'Kildare Homes', customer: 'Kildare Homes', cien_names: ['Kildare Homes'] });
    D0.insert(S.db, 'project_materials', { id: 'MK1', project_id: 'PK', name: 'MFC White', kind: 'sheet' });
    X.F3.seedList(S, 'LD2', { wos: ['WO-D2'], name: 'House 12' });
    const t = await X.dev(browser, S, 'office'), p = t.page; await asks(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); ROLE = 'office'; tab = 'd'; render(); }); await sleep(800);
    const chips = await p.evaluate(() => ({ d1: !!document.querySelector('[data-dladd="WO-D1"]'), d2: !!document.querySelector('[data-dladd="WO-D2"]'), d3: !!document.querySelector('[data-dladd="WO-D3"]') }));
    rec('Office, Deliveries: "＋ List" on the cards of jobs with NO list (WO-D1 in the pool, WO-D3 booked), not on WO-D2 (has a list)', chips.d1 && chips.d3 && !chips.d2, JSON.stringify(chips));
    await p.click('[data-dladd="WO-D1"]'); await sleep(1200);
    const w = await p.evaluate(() => ({ ed: !!document.querySelector('.me-ed'), wo: (document.getElementById('me-hwo') || {}).textContent || '', sel: [...document.querySelectorAll('.dchip.sel')].length }));
    rec('＋ List → the cutting list window opens on WO-D1 (and the card was not selected by the click)', w.ed && /WO-D1/.test(w.wo) && w.sel === 0, JSON.stringify(w));
    await fillSaw(p, 2, 'Side', '2', '720', '560', 'MFC White'); await sleep(200);
    await p.evaluate(() => document.getElementById('me-saveclose').click()); await sleep(2500);
    rec('Save & close → one list on WO-D1', liveFor(S, 'WO-D1').length === 1, String(liveFor(S, 'WO-D1').length) + ' ' + await p.evaluate(() => (document.getElementById('me-err') || {}).textContent || ''));
    await p.evaluate(() => { tab = 'd'; render(); }); await sleep(500);
    rec('…and WO-D1\'s card no longer offers "＋ List"', !(await p.evaluate(() => !!document.querySelector('[data-dladd="WO-D1"]'))));
    // the ⓘ window
    await closeAll(p); await p.evaluate(() => showReadiness(['WO-D3', 'WO-D2'], 'test', true)); await sleep(300);
    const rd = await p.evaluate(() => ({ add: !!document.querySelector('[data-rdadd="WO-D3"]'), open: !!document.querySelector('[data-rdopen="LD2"]') }));
    rec('ⓘ check window: "＋ Add cutting list" for WO-D3 (no list), "📋 Open House 12" for WO-D2', rd.add && rd.open, JSON.stringify(rd));
    await p.click('[data-rdopen="LD2"]'); await sleep(1500);
    const o2 = await p.evaluate(() => ({ ed: !!document.querySelector('.me-ed'), n: document.querySelectorAll('.pod-ovl').length, rows: [...document.querySelectorAll('.me-ed [data-mr$="|item"]')].map(e => e.value).filter(Boolean).length }));
    rec('📋 Open → the list window opens with its rows, the check window closed', o2.ed && o2.n === 1 && o2.rows > 0, JSON.stringify(o2));
    await closeAll(p);
    await p.evaluate(() => showReadiness(['WO-D3'], 'test', true)); await sleep(300); await p.click('[data-rdadd="WO-D3"]'); await sleep(1200);
    rec('＋ Add cutting list → the window on WO-D3', await p.evaluate(() => /WO-D3/.test((document.getElementById('me-hwo') || {}).textContent || '')));
    await closeAll(p);
    // other roles
    for (const role of ['pm', 'driver', 'prod']) {
      // (18 Nov) the role's PIN is entered first, so the screen is really drawn (without it the PIN picker shows and the check can't fail)
      const drawn = await p.evaluate(rl => { localStorage.setItem('wpfPin_' + rl, pins()[rl]); ROLE = rl; tab = 'd'; if (rl === 'prod') prodTab = 'deliv'; render(); return roleOk(rl); }, role); await sleep(500);
      const n = await p.evaluate(() => document.querySelectorAll('[data-dladd]').length);
      await p.evaluate(() => showReadiness(['WO-D3'], 'test', true)); await sleep(200);
      const m = await p.evaluate(() => document.querySelectorAll('[data-rdadd]').length); await closeAll(p);
      rec(role + ': ' + (role === 'prod' ? 'sees' : 'does NOT see') + ' the add-list buttons (screen drawn with its PIN)', drawn && (role === 'prod' ? m > 0 : n === 0 && m === 0), JSON.stringify([drawn, n, m]));
    }
    // phone
    await p.setViewportSize({ width: 360, height: 640 }); await p.evaluate(() => { ROLE = 'office'; tab = 'd'; render(); }); await sleep(500);
    const ph = await p.evaluate(() => { const b = document.querySelector('[data-dladd]'); if (!b) return null; const r = b.getBoundingClientRect(), c = b.closest('.dchip').getBoundingClientRect(); return { inCard: r.right <= c.right + 1, h: r.height, page: document.documentElement.scrollWidth }; });
    rec('phone 360 px: "＋ List" sits inside its card, no page sideways scroll', ph && ph.inCard && ph.page <= 362, JSON.stringify(ph));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
